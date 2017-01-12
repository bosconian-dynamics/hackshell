import CommandArgument from './CommandArgument'

/**
 * Represents a single Shell command capable of performing an operation upon receiving context and
 * arguments objects. Parameters are secified as CommandArgument instances enabling run-time
 * argument validation (and appropriate responses in case of validation failure)
 */
class Command {
  constructor( name, options = {} ) {
    this.name             = name
    this.domain           = options.domain
    this.commandArguments = options.args || []
    this.accessLevel      = options.accessLevel || Command.ACCESS_LEVELS.PRIVATE
    this.usage            = options.usage || "" // TODO: auto-generate usage strings by parsing validators

    if( this.commandArguments.some( arg => !(arg instanceof CommandArgument) ) )
      throw new TypeError( `Invalid args for Command ${name}: "args" must be an array of CommandArgument objects` )

    if( !Command.ACCESS_LEVELS[ this.accessLevel ] )
      throw new Error( `Invalid accessLevel "${this.accessLevel}" for Command ${name}: must be one of "HIDDEN", "PRIVATE", "PUBLIC", or "TRUST"` )

    if( options.securityLevel === undefined )
      options.securityLevel = -1

    this.setSecurityLevel( options.securityLevel )
  }

  /**
   * Primary function to be carried out when the command is executed (after argument validation).
   * Should be overriden by child class
   */
  operation( context, args ) {
    return {ok: true, context, args}
  }

  /**
   * Sets the CommandDomain name identifier associated with this Command
   */
  setDomain( domain ) {
    this.domain = domain
  }

  setSecurityLevel( level ) {
    let secType = typeof level

    if( !["number", "function"].includes( secType ) )
      throw new TypeError( `Invalid securityLevel "${level}" for Command ${name}: must be an integer from -1 to 4 or a function` )

    if( "number" === secType && ( level < -1 || level > 4 ) )
      throw new RangeError( `Invalid securityLevel "${level}" for Command ${name}: must be in the range -1 to 4` )

    this.securityLevel = level
  }

  getAccessLevel() {
    return this.accessLevel
  }

  /**
   * Get the security level of this command. If the security level was specified as a function,
   * returns the return value of that callback
   */
  getSecurityLevel() {
    if( "number" === typeof this.securityLevel )
      return this.securityLevel

    // The possibility of specifying a callback enables dynamic security level detection for user
    // scripts
    //TODO: may not be necessary anymore - UserScript implementation calculates sec levels without callback
    if( "function" === typeof this.securityLevel )
      return this.securityLevel()
  }

  /**
   * Performs argument validation then returns a failure response (or usage string), or the return
   * value of the Command operation if all arguments passed validation
   */
  execute( context, args ) {
    if( !args ) {
      if( this.commandArguments.some( commandArg => commandArg.required ) )
        return "function" === typeof this.usage ? this.usage() : this.usage

      return this.operation( context )
    }

    for( let commandArg of this.commandArguments ) {
      if( !args[ commandArg.name ] ) {
        if( commandArg.required )
          return {ok: false, msg: this.usage}

        continue
      }

      if( !commandArg.validate( args[ commandArg.name ] ) )
        return {ok: false, msg: commandArg.invalidRespose || this.usage}
    }

    if( !context.this_script ) {
      if( this.domain )
        context.this_script = `${this.domain.name}.${this.name}`
      else
        context.this_script = this.name
    }

    return this.operation( context, args )
  }
}

Command.ACCESS_LEVELS = {
  HIDDEN:  "HIDDEN",
  PRIVATE: "PRIVATE",
  PUBLIC:  "PUBLIC",
  TRUST:   "TRUST"
}

Command.SECURTIY_LEVELS = {
  NULLSEC: 0,
  LOWSEC:  1,
  MIDSEC:  2,
  HIGHSEC: 3,
  FULLSEC: 4
}

Command.SECURTIY_LEVEL_NAMES = Object.getOwnPropertyNames( Command.SECURTIY_LEVELS )

Command.getSecurityLevelName = level => {
  if( Command.SECURTIY_LEVEL_NAMES[ level ] )
    return Command.SECURTIY_LEVEL_NAMES[ level ]

  throw new Error( `Invalid security level "${level}"` )
}

export default Command
