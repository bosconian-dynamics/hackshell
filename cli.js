/**
 * Command Line Interface for using hackshell from a console
 * TODO: hackmud-esque ouput formatting & auto-coloring
 * TODO: restructure this. All of it.
 */
var readline  = require( 'readline' )
var hackshell = require( './dist/hackshell.js' )

var Shell           = hackshell.Shell
var Command         = hackshell.Command
var CommandArgument = hackshell.CommandArgument

//TODO: these commands are terribly hackish, and possibly fail to emulate hackmud behaviors
Shell.COMMANDS.push(
  class ShutdownCommand extends Command {
    constructor( shell ) {
      super(
        "shutdown"
      )

      this.shell = shell
    }

    operation( context, args ) {
      if( args )
        return Shell.messages.noScript( `${this.shell.username}.${this.name}` )

      writeOut( '-terminal poweroff-' )
      process.exit(0);
    }
  }
)

Shell.COMMANDS.push(
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
  }
)

function writeOut( message, moveCursor = false, spacer = true ) {
  stdio.pause()
  readline.cursorTo( process.stdout, 0 )
  process.stdout.write( message + '\n' + (spacer ? '\n' : '') )

  if( moveCursor )
    stdio.prompt( true )

  stdio.resume()
}

function loadUserScripts( shell ) {
  let scriptsDir

  switch( process.platform ) {
    case "win32":
      
  }
}

var shell = new Shell({
  outputHandler: message => writeOut( message, true, false ),
  chatDelay: 300
})

var stdio = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
  prompt: '> ',
  completer: line => {
    let completions = shell.getCommandNames()
    let hits = completions.filter( command => command.indexOf( line ) === 0 )

    return [hits.length ? hits : completions, line]
  }
})

stdio.prompt()

stdio
  .on( 'line', input => {
    let result = shell.exec( input )

    if( !result )
      return writeOut( "", true, false )

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

    writeOut( result, true )
  })
  .on('close', () => {
    shell.executeCommand( Shell.DEFAULT_DOMAIN, 'shutdown' )
  });
