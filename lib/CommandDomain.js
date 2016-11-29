import Command from './Command'

/**
 * A grouping of functionally or semantically-related and/or dependant Shell Commands
 */
class CommandDomain {
  constructor( name, commands = [] ) {
    this.name     = name
    this.commands = new Map( commands.map( command => [ command.name, command ] ) )

    if( commands.some( command => !(command instanceof Command) ) )
      throw new TypeError( `Invalid commands for CommandDoman ${name}: commands must be an array of Command objects` )
  }

  /**
   * Associate a Command object with this CommandDomain
   */
  setCommand( name, command ) {
    if( !(command instanceof Command) )
      throw new TypeError( `Invalid command for "${name}"` )

    command.setDomain( this )

    this.commands.set( name, command )
  }

  /**
   * Retrieve an array of command names in this domain, with or without the CommandDomain name prefix
   * @type {[type]}
   */
  getCommandNames( withDomainPrefix = false ) {
    let names = Array.from( this.commands.keys() )

    if( !withDomainPrefix )
      return names

    return names.map( name => `${this.name}.${name}` )
  }

  /**
   * Retrieve the Command object in this domain identified by name
   */
  getCommand( name ) {
    if( name.includes( '.' ) )
      name = name.split( '.' )[1]

    return this.commands.get( name )
  }

  /**
   * Retrieve the security level of a Command object in this domain
   */
  getCommandSecurityLevel( name ) {
    let command = this.getCommand( name )

    if( !command )
      throw new Error( `CommandDomain ${this.name} does not contain Command ${name}` )

    return command.getSecurityLevel()
  }

  hasCommand( name ) {
    return this.commands.has( name )
  }

  /**
   * Execute the command identified by name with the given context and arguments
   */
  executeCommand( name, context, args ) {
    let command = this.getCommand( name )

    if( !command )
      throw new Error( `CommandDomain ${this.name} does not contain Command ${name}` )

    context.this_script = `${this.name}.${name}`

    return command.execute( context, args )
  }
}

export default CommandDomain
