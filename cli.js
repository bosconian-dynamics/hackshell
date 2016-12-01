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
    writeOut( shell.exec( input ), true )
  })
  .on('close', () => {
    writeOut( '-terminal poweroff-' )
    process.exit(0);
  });
