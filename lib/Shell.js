import CommandDomain from './CommandDomain'
import Command from './Command'
import CommandArgument from './CommandArgument'

import ChatCommands from './commands/Chats'

class Shell {
  constructor( config = {} ) {
    this.macros        = new Map( config.macros || [] )
    this.username      = config.username || "anon_p87dsf" // TODO: dynamic username generation

    this.setOutputHandler( config.outputHandler || (message => console.log(`[hackshell] output: ${message}`)) )

    // Load default command domains
    this.commands = new Map(
      [
        new ChatCommands( this.writeOut.bind(this), config.chatDelay )
      ].map( commandDomain => [ commandDomain.name, commandDomain ] )
    )

    // Load pre-defined root-level (domainless) commands
    for( let CommandClass of Shell.COMMANDS )
      this.setCommand( Shell.DEFAULT_DOMAIN, new CommandClass( this ) )
  }

  setOutputHandler( callback ) {
    this.outputHandler = callback
  }

  writeOut( message ) {
    this.outputHandler( message )
  }

  setUser( username ) {
    username = username.trim()

    if( ! /^[a-z]\w*$/.test( username ) )
      throw new Error( `Invalid username "${username}"` )

    if( username === this.username )
      return false

    this.username = username
    return true
  }

  /**
   * Associate a ShellCommand object with CommandDomain object
   */
  setCommand( domain, command ) {
    domain = this.normalizeCommandDomain( domain )
    let commandDomain = this.commands.get( domain )

    if( !commandDomain ) {
      commandDomain = new CommandDomain( domain )
      this.commands.set( domain, commandDomain )
    }

    commandDomain.setCommand( command.name, command )
  }

  /**
   * Returns a CommandDomain name suitable for internal use
   */
  normalizeCommandDomain( domain ) {
    if( !domain || domain === null )
      return Shell.DEFAULT_DOMAIN

    if( domain === this.username )
      return Shell.USER_DOMAIN

    return domain
  }

  /**
   * Returns a CommandDomain name suitable for user consumption
   */
  regularizeCommandDomain( domain ) {
    if( !domain || domain === Shell.DEFAULT_DOMAIN )
      return

    if( domain === Shell.USER_DOMAIN )
      return this.username

    return domain
  }

  regularizeCommandName( domain, name ) {
    domain = this.regularizeCommandDomain( domain )

    if( !domain )
      return name

    return `${domain}.${name}`
  }

  /**
   * Returns the appropriate CommandDomain for the given CommandDomain name and/or Command name, if
   * it exists. If a Command name is passed, will return the CommandDomain for the domain name only
   * if that CommandDomain has that Command - if no domain is specified, attempts to find the
   * Command first within the default domain, then the user domain.
   */
  resolveCommandDomain( domain, name ) {
    let normalizedDomain = this.normalizeCommandDomain( domain )
    let commandDomain    = this.commands.get( normalizedDomain )

    if( !name )
      return commandDomain

    if( commandDomain && commandDomain.hasCommand( name ) )
      return commandDomain

    if( !domain ) {
      commandDomain = this.commands.get( Shell.USER_DOMAIN )

      if( commandDomain && commandDomain.hasCommand( name ) )
        return commandDomain
    }
  }

  /**
   * Retrieves a Command object for the given Command name
   */
  getCommand( domain, name ) {
    let commandDomain = this.resolveCommandDomain( domain, name )

    if( commandDomain )
      return commandDomain.getCommand( name )
  }

  getCommandNames( domain ) {
    if( domain ) {
      let commandDomain = this.resolveCommandDomain( domain )
      return commandDomain.getCommandNames().map( commandName => this.regularizeCommandName( commandDomain.name, commandName ) )
    }

    let domainIterator = this.commands.values()
    let commands = []

    for( let commandDomain of domainIterator ) {
      commands.push.apply(
        commands,
        commandDomain.getCommandNames().map(
          commandName => this.regularizeCommandName( commandDomain.name, commandName )
        )
      )
    }

    return commands
  }

  hasCommand( domain, name ) {
    let commandDomain = this.resolveCommandDomain( domain, name )

    if( commandDomain )
      return commandDomain.hasCommand( name )

    return false
  }

  /**
   * Retrieves the security level for the given Command name
   */
  getSecurityLevel( domain, name ) {
    let command = this.getCommand( domain, name )

    if( command )
      return command.getSecurityLevel()
  }

  /**
   * Associate a macro with an input string
   */
  setMacro( name, commandString ) {
    this.macros.set( name, commandString )

    return Shell.messages.macroSet( name, commandString )
  }

  /**
   * Interpret string input and return the result
   */
  exec( input ) {
    input = input.trim()

    //console.log( `[hackshell] execute: ${input}` )
    let commandString = /^\s*([\w\.]*)\s*/i.exec( input )
    let command       = ""
    let domain        = null
    let args

    // If input doesn't appear to be a valid command string, attempt to process it as a macro operation
    if( commandString === null || !commandString[1] ) {
      let macroString = /^\s*\/([\w]*)(?:\s*=\s*(.*))?\s*$/.exec( input )

      if( macroString === null )
        return Shell.messages.noMacro()

      // A slash with no identifier returns all registered macros
      if( macroString[0] === "/" ) {
        let output = []

        this.macros.forEach( ( command, macro ) => output.push( macro + " = " + command ) )

        return output
      }

      // If the input string includes "={something}", set a macro
      if( macroString[2] )
        return this.setMacro( macroString[1], macroString[2] )

      // If no "=", execute the implied macro
      return this.executeMacro( macroString[1] )
    }

    commandString = commandString[1] // Command string is in the first match group

    let commandParts = /^([a-z]\w*)(?:\.([a-z]\w*))?$/i.exec( commandString ) // Snag command name, and possibly domain

    if( commandParts === null ) // No command syntax match
      return Shell.messages.badName( commandString )

    if( commandParts[2] ) {
      domain  = commandParts[1]
      command = commandParts[2]
    }
    else {
      command = commandParts[1]
    }

    if( domain === null && this.getCommandNames( Shell.DEFAULT_DOMAIN ).includes( command ) ) {
      // If this is a root-level ShellCommand without a domain, args aren't formatted in a JSON-like string
      let argsString = input.replace( /\s+/g, " " ).replace( command, "" )
      args = argsString.split( " " ).filter( entry => entry.length > 0 )

      if( !args.length )
        args = undefined
    }
    else {
      // This should only grab the first group of {}, then ignore everything after it - seems to be
      // consistent with hackmud behavior.
      // TODO: verify greediness behavior (for nested objects in argument string)
      let argsString = /{.*}/.exec( input )

      if( argsString !== null )
        args = this.processArgumentString( argsString[0], this.regularizeCommandName( domain, command ) )
    }

    return this.executeCommand( domain, command, args )
  }

  /**
   * Parse a string enclosed in {} into an object and perform scriptor substitution
   */
  processArgumentString( argsString, callingScript ) {
    let scriptors      = {}
    let nextScriptorID = 0
    let argsJSON       = argsString.replace(/([\W\s])(\w*):/g, '$1"$2":' ) // Enclose property names in quotes

    // Replace each unquoted scriptor-like value in the string with a unique (within the string) identifier
    argsJSON = argsJSON.replace(
      /([:,\[]\s*)(#[\w.]*)/g,
      ( match, before, scriptor ) => {
        let scriptorID = "#SID#_" + nextScriptorID++

        while( argsString.includes( scriptorID ) )
          scriptorID = "#SID#_" + nextScriptorID++

        scriptors[ scriptorID ] = scriptor

        return `${before}"${scriptorID}"`
      }
    )

    let args = JSON.parse( argsJSON )

    return this.substituteScriptorArguments( args, scriptors, callingScript )
  }

  /**
   * Given an args object and an object mapping temporary scriptor IDs to their verbatim input,
   * recursively replaces all scriptor-ID-values in args with a callable scriptor object and
   * returns the modified args
   */
  substituteScriptorArguments( args, scriptors, callingScript ) {
    for( let property in args ) {
      if( !args.hasOwnProperty( property ) )
        continue

      let value = args[ property ]

      if( value instanceof Array ) {
        args[ property ] = value.map( entry => {
          if( "string" === typeof entry && scriptors.hasOwnProperty( entry ) )
            return this.getScriptorObject( scriptors[ entry ], callingScript )

          return entry
        } )
      }
      else if( "string" === typeof value && scriptors.hasOwnProperty( value ) ) {
        args[ property ] = this.getScriptorObject( scriptors[ value ], callingScript )
      }
      else if( "object" === typeof value ) {
        args[ property ] = this.substituteScriptorArguments( value, scriptors )
      }
    }

    return args
  }

  /**
   * Given a scriptor identifier, returns a scriptor object suitable for calling within a script
   * via {scriptor objext}.call(). If a callingScript is specified, it will be added to the context
   * of the Command executed upon {scriptor object}.call()
   */
  getScriptorObject( scriptor, callingScript ) {
    let parts = /#s\.([a-z]\w*)\.([a-z]\w*)/gi.exec( scriptor )

    // TODO: verify and emulate hackmud behavior for invalid scriptor syntax
    if( !parts )
      return null

    let domain = parts[1]
    let name   = parts[2]

    // TODO: verify and emulate hackmud behavior for unknown scriptors
    if( !this.hasCommand( domain, name ) )
      return null

    return {
      name: this.regularizeCommandName( domain, name ),
      call: args => this.executeCommand( domain, name, args, callingScript )
    }
  }

  /**
   * Execute the input string associated with a macro name
   */
  executeMacro( name ) {
    let commandString = this.macros.get( name )

    if( !commandString )
      return Shell.messages.noMacro()

    this.writeOut( commandString )

    return this.exec( commandString )
  }

  /**
   * Execute a command and return the result
   */
  executeCommand( domain, name, args, callingScript = null ) {
    let command = this.getCommand( domain, name )

    if( !command ) {
      if( !domain )
        domain = this.username

      return Shell.messages.noScript( `${domain}.${name}` )
    }

    let result = command.execute(
      {
        this_script: this.regularizeCommandName( domain, name ),
        caller: this.username,
        calling_script: callingScript
      },
      args
    )

    return result
  }
}

Shell.DEFAULT_DOMAIN  = "default"  // CommandDomain name identifier for commands defined without a domain
Shell.USER_DOMAIN     = "user"     // CommandDomain name identifier for user-space commands (i.e. anon_p87dsf.script)
Shell.MESSAGE_STRINGS = {          // Reusable message substrings
  "trust":             ':::TRUST COMMUNICATION:::',
  "parse error":       "PARSE ERROR",
  "nonexistant":       "doesn't exist",
  "invalid":           "is an invalid",
  "script lambda":     "code must be wrapped in a function (must start with 'function (context, args) {')",
  "identifier format": "only numbers, letters and underscore characters and may not begin with a number"
}
Shell.COMMANDS = [ // Top-level (domainless) commands
  class UserCommand extends Command {
    constructor( shell ) {
      super(
        "user",
        {
          usage: "Usage: user <username>",
          args: [
            new CommandArgument(
              0,
              [ "string" ],
              true
            )
          ]
        }
      )

      this.shell = shell
    }

    operation( context, args ) {
      if( args.length > 1 )
        return this.usage

      let success = false
      try {
        success = this.shell.setUser( args[0] )
      }
      catch( err ) {
        return Shell.messages.badUsername( args[0] )
      }

      return `Active user is ${success ? 'now' : 'already'} ${args[0]}`
    }
  }
]

/**
 * @param  {[type]} strings [description]
 * @param  {[type]} keys    [description]
 * @return {[type]}         [description]
 */
Shell.templateString = ( strings, ...keys ) => {
  strings = strings.map( string => string.replace(
    /{([^}]*)}/g,
    ( match, token ) => Shell.MESSAGE_STRINGS[ token ]
  ))

  return ( ...values ) => {
    let dict   = values[ values.length - 1 ] || {}
    let result = [ strings[0] ]

    keys.forEach( ( key, i ) => {
      let value = Number.isInteger( key ) ? values[ key ] : dict[ key ]
      result.push( value, strings[ i + 1 ])
    })

    return result.join( '' )
  }
}

Shell.messages = { // Pre-defined message templates
  badName:      Shell.templateString`${0} {invalid} script name.`,
  noScript:     Shell.templateString`{trust} {parse error} ${0}: script {nonexistant}`,
  badSignature: Shell.templateString`{parse error} ${0} (line ${1}): {script lambda}`,
  badSyntax:    Shell.templateString`{parse error} ${0}: ${1}: Line ${2}: ${3}`,
  badUsername:  Shell.templateString`${0} {invalid} name.\nYour name must have {identifier format}.`,
  runtimeError: Shell.templateString`{trust} ${0}: ${1}`,
  noMacro:      () => "Macro does not exist.",
  macroSet:     Shell.templateString`Macro created: ${0} = ${1}`,
  success:      () => "Success",
  failure:      () => "Failure"
}

export default Shell
