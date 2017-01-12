import Shell from '../Shell'
import CommandDomain from '../CommandDomain'
import Command from '../Command'
import CommandArgument from '../CommandArgument'

class Scripts extends CommandDomain {
  constructor( shell ) {
    super( Scripts.DOMAIN )

    this.shell = shell

    Scripts.COMMANDS.forEach( CommandClass => {
      let command = new CommandClass( shell )
      this.setCommand( command.name, command )
    } )
  }
}

Scripts.DOMAIN   = "scripts"
Scripts.COMMANDS = [
  // scripts.get_access_level
  class GetAccessLevelCommand extends Command {
    constructor( shell ) {
      super(
        "get_access_level",
        {
          securityLevel: Command.SECURTIY_LEVELS.FULLSEC,
          accessLevel:   Command.ACCESS_LEVELS.TRUST,
          usage: 'Usage: scripts.get_access_level { name: "<scriptname>" }',
          args: [
            new CommandArgument(
              "name",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.shell = shell
    }

    operation( context, args ) {
      let commandString = args.name.trim()
      let command

      try {
        command = this.shell.resolveCommandString( commandString )
      } catch( err ) {
        return {ok: false, msg:Shell.messages.noScript( commandString )}
      }

      if( !command )
        return {ok: false, msg:Shell.messages.noScript( commandString )}

      return command.getAccessLevel()
    }
  },

  // scripts.get_level
  class GetLevelCommand extends Command {
    constructor( shell ) {
      super(
        "get_level",
        {
          securityLevel: Command.SECURTIY_LEVELS.FULLSEC,
          accessLevel:   Command.ACCESS_LEVELS.TRUST,
          usage: 'Usage: scripts.get_level { name: "<scriptname>" }',
          args: [
            new CommandArgument(
              "name",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.shell = shell
    }

    operation( context, args ) {
      let commandString = args.name.trim()
      let command

      try {
        command = this.shell.resolveCommandString( commandString )
      } catch( err ) {
        return {ok: false, msg:Shell.messages.noScript( commandString )}
      }

      if( !command )
        return {ok: false, msg:Shell.messages.noScript( commandString )}

      let level = command.getSecurityLevel()

      if( context.calling_script && context.calling_script !== null )
        return level

      return Command.getSecurityLevelName( level )
    }
  },

  // scripts.lib
  class LibCommand extends Command {
    constructor( shell ) {
      super(
        "lib",
        {
          securityLevel: Command.SECURTIY_LEVELS.FULLSEC,
          accessLevel:   Command.ACCESS_LEVELS.TRUST
        }
      )

      this.shell = shell
    }

    operation() {
      return Scripts.LIB()
    }
  },

  // scripts.trust
  class TrustCommand extends Command {
    constructor( shell ) {
      super(
        "trust",
        {
          securityLevel: Command.SECURTIY_LEVELS.FULLSEC,
          accessLevel:   Command.ACCESS_LEVELS.TRUST
        }
      )

      this.shell = shell
    }

    operation() {
      let commandStrings = []

      this.shell.commands.forEach( commandDomain => {
        // Filter out User and top-level commands.
        // TODO: may be better to filter all domains for scripts with TRUST access level. Maybe add helper methods to Shell.
        if( [ Shell.DEFAULT_DOMAIN, Shell.USER_DOMAIN ].includes( commandDomain.name ) )
          return

        commandStrings.push.apply( commandStrings, commandDomain.getCommandNames( true ) )
      })

      return commandStrings
    }
  },

  // scripts.user
  class UserCommand extends Command {
    constructor( shell ) {
      super(
        "user",
        {
          securityLevel: Command.SECURTIY_LEVELS.MIDSEC,
          accessLevel:   Command.ACCESS_LEVELS.TRUST
        }
      )

      this.shell = shell
    }

    operation() {
      return this.shell.getCommandNames( Shell.USER_DOMAIN )
    }
  }
]

//TODO: these all need to be verified against in-game behaviors (particularly for invalid arguments)
Scripts.LIB = function() {
  var log = []

  return {
    corruption_chars: "¡¢£¤¥¦§¨©ª",
    colors: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    corruptions: [ 0, 1, 1.5, 2.5, 5 ],
    security_level_names: Command.SECURTIY_LEVEL_NAMES.slice(),

    //TODO: add_time
    //TODO: array?
    //TODO: are_ids_eq
    //TODO: can_continue_execution
    //TODO: can_continue_execution_error
    cap_str_len: ( string, length ) => string.length > length ? string.substr( 0, length ) : string,
    //TODO: corrupt
    clone: v => Object.assign( {}, v ),
    count: ( array, fn ) => array.filter( ( value, index ) => fn( index, value ) ).length,
    create_rand_string: length => {
      let str = ''

      for( let i = length - 1; i; i-- )
        str += String.fromCharCode( Math.round( Math.random() * 42 ) + 48 )

      return str
    },
    //TODO: date
    dump: v => JSON.stringify( v, null, 2 ),
    each: ( array, fn ) => array.forEach( ( value, index ) => fn( index, value ) ),
    //TODO: get_date
    //TODO: get_date_utcsecs
    get_log:  () => log,
    get_security_level_name: level => Scripts.SECURTIY_LEVEL_NAMES[ level ], //TODO: check out-of-range hackmud behavior
    get_user_from_script: name => name.split( '.' )[0],
    //TODO: get_values
    //TODO: hash_code
    is_arr:  v => v instanceof Array,
    is_def:  v => 'undefined' !== typeof v,
    is_func: v => 'function' === typeof v,
    is_int:  v => v === parseInt( v, 10 ),
    is_num:  v => 'number' === typeof v,
    is_obj:  v => 'object' === typeof v,
    is_str:  v => 'string' === typeof v,
    is_valid_name: v => /^[a-z]\w*$/i.test( v ),
    //TODO: json?
    log: v => log.push( v ),
    map: ( array, fn ) => array.map( ( value, index ) => fn( index, value ) ),
    //TODO: math?
    max_val_index: ( array ) => {
      if( !array.length )
        return

      let index = 0
      let max = array[ 0 ]

      // TODO: verify hackmud behavior works LTR in case of ties
      for( let i = 1; i < array.length - 1; i++ ) {
        if( array[ i ] <= max )
          continue

        max = array[ i ]
        index = i
      }

      return index
    },
    merge: ( a, b ) => Object.assign( {}, a, b ),
    not_impl: () => {return {ok:false, msg:"not implemented"}},
    //TODO: number?
    num_sort_asc: ( a, b ) => a === b ? 0 : ( a > b ? 1 : -1 ),
    num_sort_desc: ( a, b ) => a === b ? 0 : ( a > b ? -1 : 1 ),
    //TODO: object?
    ok: () => {return {ok:true}},
    //TODO: parse_int
    //TODO: parse_float
    rand_int: ( min, max ) => Math.round( Math.random() * ( max - min ) ) + min,
    select: ( array, fn ) => array.filter( ( value, index ) => fn( index, value ) ),
    select_one: ( array, fn ) => array.find( ( value, index ) => fn( index, value ) ),
    shuffle: array => {
      array = array.slice()
      for (let i = array.length; i; i--) {
          let j = Math.floor(Math.random() * i);
          [array[i - 1], array[j]] = [array[j], array[i - 1]];
      }
      return array
    },
    //TODO: sort_asc
    //TODO: sort_desc
    //TODO: to_game_timestr
    to_gc_num: v => parseInt( v.replace( /(?:[KMBTQ]|GC)/g, "" ), 10 ),
    to_gc_str: v => {
      let isNeg = v < 0
      let str = ''
      let groupings = {
        1000: 'K',
        1000000: 'M',
        1000000000: 'B',
        1000000000000: 'T',
        1000000000000000: 'Q'
      }
      let val = 1000

      if( isNeg )
        v *= -1

      while( val < v ) {
        let gv = Math.floor( v / val ) % 1000
        str = gv + groupings[ val ] + str
        val *= 1000
      }

      return ( isNeg ? '-' : '' ) + str + ( v % 1000 ) + 'GC'
    },
    u_sort_num_arr_desc: array => {
      array = array.slice()
      array.sort()
      return array.reverse()
    }
  }
}

export default Scripts
