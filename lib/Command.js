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
    this.securityLevel    = options.securityLevel !== false && options.securityLevel !== undefined ? options.securityLevel : -1
    this.usage            = options.usage || "" // TODO: auto-generate usage strings by parsing validators

    if( this.commandArguments.some( arg => !(arg instanceof CommandArgument) ) )
      throw new TypeError( `Invalid args for Command ${name}: "args" must be an array of CommandArgument objects` )

    let secType = typeof this.securityLevel

    if( !["number", "function"].includes( secType ) )
      throw new TypeError( `Invalid securityLevel "${this.securityLevel}" for Command ${name}: must be an integer from -1 to 4 or a function` )

    if( "number" === secType && ( this.securityLevel < -1 || this.securityLevel > 4 ) )
      throw new RangeError( `securityLevel "${this.securityLevel}" for Command ${name} must be in the range -1 to 4` )
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

  /**
   * Get the security level of this command. If the security level was specified as a function,
   * returns the return value of that callback
   */
  getSecurityLevel() {
    if( "number" === typeof this.securityLevel )
      return this.securityLevel

    // The possibility of specifying a callback enables dynamic security level detection for user
    // scripts
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
        return this.usage

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

export default Command
