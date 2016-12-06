import Command from './Command'
import Shell from './Shell'

/**
 * Represents a user-implemented command.
 */
// TODO: review dependency resolution/execution/sec level calculation recursion when next sane.
// TODO: function sanitation - disallow things hackmud disallows (this, super, eval, function constructors, prototype, etc.)
class UserScript extends Command {
  constructor( name, content, shell, accessLevel ) {
    super(
      name,
      {
        accessLevel: accessLevel || Command.ACCESS_LEVELS.PRIVATE,
        domain:      shell.commands.get( Shell.USER_DOMAIN )
      }
    )

    this.shell              = shell
    this.executionLocks     = 0
    this.isDependencyLocked = false
    this.isDynamic          = "function" === typeof content
    this.dependencies       = new Set()

    if( !this.isDynamic ) {
      this.content = content
      this.setSecurityLevel( this.calculateSecurityLevel() )
    }
    else {
      this.loadContent = content
    }
  }

  /**
   * Resolves a UserScript dependency graph into a single set containing all "leafs" (independant
   * commands which reference nothing)
   */
  calculateDependencies() {
    let scriptDependencies    = new Map( [[ this, this.getDependencies() ]] ) // Create a Map of UserScripts to their dependencies
    let flattenedDependencies = new Set() // Create a set to hold all non-UserScript "leafs" (independant commands)

    // Iterate through all user script dependencies. Add non-UserScript "leafs" to
    // flattenedDependencies, and add UserScript dependencies to be iterated upon,
    // if they're not already in scriptDependencies
    scriptDependencies.forEach( dependencies => {
      dependencies.forEach( command => {
        if( command instanceof UserScript ) {
          if( !scriptDependencies.has( command ) )
            scriptDependencies.set( command, command.getDependencies() )
        }
        else if( !flattenedDependencies.has( command ) ) {
          flattenedDependencies.add( command )
        }
      } )
    } )

    return flattenedDependencies
  }

  /**
   * Calculates this script's security level by examining the security levels of every independant
   * command that this script (and all UserScripts it depends on) depend on.
   */
  calculateSecurityLevel( content ) {
    let flattenedDependencies = this.calculateDependencies()
    let secLevel              = 4

    for( let command of flattenedDependencies ) {
      let cSecLevel = command.getSecurityLevel()

      if( cSecLevel < secLevel ) {
        secLevel = cSecLevel

        if( secLevel === 0 )
          break // Can't go lower than NULLSEC - no reason to keep iterating
      }
    }

    return secLevel
  }

  execute( context, args ) {
    this.evaluate()
    this.executionLocks++ // Add an execution lock to prevent infinite pre-processing due to dependency recursion

    let result

    try {
      result = this.callback( context, args )
    } catch( e ) {
      result = Shell.messages.runtimeError( e.constructor.name, e.message )
    }

    this.executionLocks--

    return result
  }

  evaluate() {
    if( this.callback && ( !this.isDynamic || this.executionLocks ) )
      return

    let content     = UserScript.stripComments( this.getContent() )
    content         = UserScript.substituteScriptorIIFEs( content, `${this.shell.username}.${this.name}` )
    let callback    = (new Function( '$_hackshell', `return (${content})` ))( this.shell )

    if( "function" !== typeof callback )
      throw new Error( Shell.messages.badSignature( `${this.shell.username}.${this.name}`, "1" ) )

    this.callback = callback
  }

  getContent() {
    if( this.isDynamic )
      this.content = this.loadContent()

    return this.content
  }

  /**
   * Retrieve a set of Command objects which this script references
   */
  getDependencies() {
    if( !this.isDependencyLocked ) {
      let scriptors = UserScript.getScriptors( this.getContent(), true )

      this.dependencies = new Set()

      scriptors.forEach( scriptor => {
        let command = this.shell.getCommand( scriptor.domain, scriptor.name )

        //TODO: continue, or throw error? What to do about invalid scriptors?
        if( !command )
          return

        this.dependencies.add( command )
      })

      if( !this.isDynamic )
        this.isDependencyLocked = true // If it's not dynamic, lock the dependencies the first time
    }

    return new Set( this.dependencies )
  }

  getSecurityLevel() {
    if( this.isDynamic && !this.executionLocks )
      this.calculateSecurityLevel()

    return this.securityLevel
  }
}

UserScript.getScriptors = ( content, unique = false ) => {
  content = UserScript.stripComments( content )

  let scriptors     = []
  let scriptorRegEx = /#s\.([a-zA-Z]\w*)\.([a-zA-Z]\w*)/g
  let match         = scriptorRegEx.exec( content )

  while( match !== null ) {
    if( !unique || !scriptors.some( scriptor => scriptor.raw === match[0] ) ) {
      scriptors.push({
        raw:    match[0],
        domain: match[1],
        name:   match[2]
      })
    }

    match = scriptorRegEx.exec( content )
  }

  return scriptors
}

UserScript.stripComments = content => {
  return content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
}

/**
 * Replace scriptors with IIFEs which execute respective shell commands
 * TODO: verfiy argsString matching/handling
 * TODO: ignore scriptors in comments (allow content to be eval'd with comments for debugging purposes)
 */
UserScript.substituteScriptorIIFEs = ( content, callingScript ) => {
  return content.replace(
    /([=:\(]\s*)?#s\.([a-zA-Z]\w*)\.([a-zA-Z]\w*)(?:\s*\(([^\)]*)\))?/g,
    ( match, delimiter, domain, name, argsString ) => {
      let iife = `(( function( args ){ return $_hackshell.executeCommand.call( $_hackshell, "${domain}", "${name}", args, "${callingScript}" ); } )( ${argsString} ))`

      if( !delimiter || delimiter === null )
        iife = '; ' + iife // Try to prevent anomalies in JS interpretation when semicolons are omitted
      else
        iife = delimiter + iife

      return iife
    }
  )
}

UserScript.getNameFromFilepath = filepath => {
  filepath = filepath.replace( '\\', '/' )

  let parts = filepath.split( '/' ).filter( part => part != false )

  if( !parts.length )
    throw Error( 'Invalid filepath' )

  let name = parts[ parts.length - 1 ]
  let nameparts = name.split( '.' ).filter( part => part !== 'js' )

  if( nameparts.length > 1 || !nameparts.length )
    throw Error( `Invalid filename "${name}"` )

  return nameparts[0]
}

export default UserScript
