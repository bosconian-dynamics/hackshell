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
Scripts.SECURTIY_LEVEL_NAMES = [
  "NULLSEC",
  "LOWSEC",
  "MIDSEC",
  "HIGHSEC",
  "FULLSEC"
]
Scripts.COMMANDS = [
  // scripts.get_level
  class GetLevelCommand extends Command {
    constructor( shell ) {
      super(
        "get_level",
        {
          securityLevel: 4,
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

      if( context.calling_script )
        return level

      return Scripts.SECURTIY_LEVEL_NAMES[ level ]
    }
  },

  // scripts.lib
  class LibCommand extends Command {
    constructor( shell ) {
      super(
        "lib",
        {
          securityLevel: 4
        }
      )

      this.shell = shell
    }

    operation() {
      var log = []
      var lib = Object.assign( {}, Scripts.LIB() )
      return lib
    }
  }
]

//TODO: check basically ALL of these against in-game behavior
Scripts.LIB = function() {
  var log = []

  return {
    corruption_chars: "¡¢£¤¥¦§¨©ª",
    colors: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    corruptions: [ 0, 1, 1.5, 2.5, 5 ],
    security_level_names: Scripts.SECURTIY_LEVEL_NAMES.slice(),

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
    get_log: () => log,
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
      let str = ''
      let groupings = {
        1000: 'K',
        1000000: 'M',
        1000000000: 'B',
        1000000000000: 'T',
        1000000000000000: 'Q'
      }
      let val = 1000

      while( val < v ) {
        let gv = Math.floor( v / val ) % 1000
        str = gv + groupings[ val ] + str
        val *= 1000
      }

      return str + ( v % 1000 ) + 'GC'
    },
    u_sort_num_arr_desc: array => {
      array = array.slice()
      array.sort()
      return array.reverse()
    }
  }
}

export default Scripts
