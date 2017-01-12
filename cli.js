var fs = require( 'fs' )
var path = require( 'path' )

var pkg = require( './package.json' )
var CLI = require( './' + pkg.directories.dist + '/hackshell-cli.js' )

var options = {}
var tokens = process.argv.slice(2)

for( var i = 0; i < tokens.length; i++ ) {
  var token = tokens[i]

  switch( token ) {
    case "--directory":
    case "-d":
      options.scriptDir = tokens[++i]
      break
    case "--chatdelay":
    case "-c":
      options.chatDelay = parseInt( tokens[++i], 10 )
      break
    case "--user":
    case "-u":
      options.username = tokens[++i]
      console.log( "username: " + options.username )
      break
    default:
      break
  }
}

new CLI( options )
