/**
 * Command Line Interface for using hackshell from a console
 * TODO: hackmud-esque ouput formatting & auto-coloring
 */
var readline  = require( 'readline' )
var Shell     = require( './dist/hackshell.js' ).Shell

function writeOut( message, moveCursor = false ) {
  stdio.pause()
  readline.cursorTo( process.stdout, 0 )
  process.stdout.write( message + '\n\n' )

  if( moveCursor )
    stdio.prompt( true )

  stdio.resume()
}

var shell = new Shell({
  outputHandler: message => writeOut( message, true ),
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
    writeOut( '-terminal poweroff-' )
    process.exit(0);
  });
