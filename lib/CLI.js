import readline from 'readline'
import path from 'path'
import fs from 'fs'

import Shell from './Shell'
import Command from './Command'
import CommandArgument from './CommandArgument'
import CommandDomain from './CommandDomain'
import UserScript from './UserScript'

class CLI {
  constructor( options = {} ) {
    this.shell = new Shell({
      outputHandler: message => this.writeOut( message, true, false ),
      chatDelay: options.chatDelay || 300
    })

    // Register CLI-relevant commands, i.e. "clear" and "shutdown"
    CLI.COMMANDS.forEach( CommandClass => {
      this.shell.setCommand( Shell.DEFAULT_DOMAIN, new CommandClass( this.shell, this, options ) )
    })

    // Create a readline interface for handling STDIN/STDOUT
    this.stdio = readline.createInterface({
      input:      process.stdin,
      output:     process.stdout,
      prompt:     options.prompt || '> ',
      completer:  this.completeCommandString.bind( this )
    })

    this.writeOut( '-terminal active-', false, true )

    // If a username was specified, use it
    if( options.username ) {
      this.writeOut( this.shell.executeCommand( Shell.DEFAULT_DOMAIN, "user", [options.username] ), false, true )
    }
    else {
      this.writeOut( this.shell.executeCommand( Shell.DEFAULT_DOMAIN, "user" ), false, true )
    }

    // If a directory containing user scripts was passed, register each .js file as a dynamic UserScript Command
    if( options.scriptDir )
      this.registerScriptDirectory( options.scriptDir )

    this.stdio.on( 'line', this.handleInput.bind( this ) )
    this.stdio.on( 'close', () => this.shell.executeCommand( Shell.DEFAULT_DOMAIN, 'shutdown' ) )
    this.stdio.prompt()

    if( !options.username ) {
      this.stdio.write( "user " )
      readline.cursorTo( process.stdout, 7 )
    }
  }

  /**
   * Match "input" against all known command strings
   */
  completeCommandString( input ) {
    let completions = this.shell.getCommandNames()
    let hits = completions.filter( command => command.indexOf( input ) === 0 )

    return [hits.length ? hits : completions, input]
  }

  handleInput( line ) {
    let result = this.shell.exec( line )

    if( !result )
      return this.writeOut( "", true, false )

    if( "object" === typeof result && !(result instanceof Array) ) {
      let props = Object.getOwnPropertyNames( result )

      switch( props.length ) {
        case 1:
          if( props[0] === "ok" )
            result = result.ok ? Shell.messages.success() : Shell.messages.failure()
          break

        case 2:
          if( props.every( prop => [ "ok", "msg" ].includes( prop ) ) ) {
            result = [
              result.ok ? Shell.messages.success() : Shell.messages.failure(),
              result.msg
            ]
          }
          break
      }
    }

    if( result instanceof Array )
      result = result.join( '\n' )

    this.writeOut( result, true )
  }

  registerScriptDirectory( path ) {
    var files = fs.readdirSync( path )

    files.forEach( filepath => this.registerScriptFile( filepath ) )
  }

  registerScriptFile( filepath, name, domain ) {
    if( !name )
      name = path.basename( filepath, '.js' )

    if( !domain )
      domain = Shell.USER_DOMAIN
    else
      domain = this.shell.normalizeCommandDomain( domain )

    if( !this.shell.commands.get( domain ) )
      this.shell.commands.set( domain, new CommandDomain( domain ) )

    if( path.extname( filepath ) !== '.js' )
      return

    this.shell.setCommand(
      domain,
      new UserScript(
        name,
        () => fs.readFileSync( filepath, 'utf8' ),
        this.shell
      )
    )
  }

  writeOut( message, moveCursor = false, spacer = true ) {
    this.stdio.pause()
    readline.cursorTo( process.stdout, 0 )
    process.stdout.write( message + '\n' + (spacer ? '\n' : '') )

    if( moveCursor )
      this.stdio.prompt( true )

    this.stdio.resume()
  }
}

// CLI-relevant Command definitions
CLI.COMMANDS = [
  // shutdown
  class ShutdownCommand extends Command {
    constructor( shell, cli ) {
      super(
        "shutdown"
      )

      this.shell = shell
      this.cli   = cli
    }

    operation( context, args ) {
      if( args )
        return Shell.messages.noScript( `${this.shell.username}.${this.name}` )

      this.cli.writeOut( '-terminal poweroff-' )
      process.exit(0);
    }
  },

  // clear
  class ClearCommand extends Command {
    constructor( shell ) {
      super(
        'clear'
      )

      this.shell = shell
    }

    operation( context, args ) {
      if( args )
        return Shell.messages.noScript( `${this.shell.username}.${this.name}` )

      console.log( '\r\n'.repeat( process.stdout.getWindowSize()[1] ) )
    }
  },

  // user
  // Overrides defualt user command to take into account game users, and automatically load game user scripts
  class UserCommand extends Shell.COMMANDS[0] { //TODO: clearly a hack - static Command definitions should be in an object, or a direct property of the relevant class.
    constructor( shell, cli ) {
      super(
        shell,
        {
          usernames: CLI.getGameUsernames()
        }
      )

      this.cli = cli
    }

    operation( context, args ) {
      let newUser      = args[0]
      let previousUser = this.shell.username
      let output       = super.operation( context, args )
      let changedUsers = previousUser !== this.shell.username

      if( changedUsers ) {
        this.shell.commands.delete( Shell.USER_DOMAIN )
        CLI.getGameUserScripts( newUser ).forEach( script => {
          this.cli.registerScriptFile( script.path, script.name, Shell.USER_DOMAIN )
        })
      }

      return output
    }
  }
]

/**
 * Attemps to determine the current user's hackmud game-data directory
 */
CLI.getGameDataDir = () => {
  // Windows
  if( process.platform === 'win32' ) {
    var appDataPath = process.env.APPDATA

    if( !appDataPath ) {
      appDataPath = process.env.HOME || process.env.USERPROFILE
      appDataPath = path.join( appDataPath, 'AppData', 'Roaming' )
    }

    return path.join( appDataPath, 'hackmud' )
  }

  //TODO: linux
  //TODO: Mac
}

CLI.getGameUsernames = ( gameDataPath ) => {
  if( !gameDataPath )
    gameDataPath = CLI.getGameDataDir()

  var usernames = []

  try {
    var filenames = fs.readdirSync( gameDataPath )
  } catch( e ) {
    return []
  }

  filenames.forEach( filename => {
    var stats = fs.statSync( path.join( gameDataPath, filename ) )

    if( !stats.isDirectory() )
      return

    try {
      fs.statSync( path.join( gameDataPath, filename + '.key' ) )
    } catch( e ) {
      return
    }

    usernames.push( filename )
  } )

  return usernames
}

CLI.getGameUserScripts = ( usernames, gameDataPath ) => {
  if( !gameDataPath )
    gameDataPath = CLI.getGameDataDir()

  if( !usernames )
    usernames = CLI.getGameUsernames( gameDataPath )
  else if( "string" === typeof usernames )
    usernames = [ usernames ]

  var scripts = []

  for( var username of usernames ) {
    var scriptsPath = path.join( gameDataPath, username, 'scripts' )
    var scriptsPathStats = fs.statSync( scriptsPath )

    if( !scriptsPathStats.isDirectory() )
      continue

    fs.readdirSync( scriptsPath )
      .filter( scriptName => path.extname( scriptName ) === '.js' )
      .forEach( scriptName => {
        scripts.push({
          user: username,
          name: path.basename( scriptName, '.js' ),
          path: path.join( scriptsPath, scriptName )
        })
      })
  }

  return scripts
}

export default CLI
