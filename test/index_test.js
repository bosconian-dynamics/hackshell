import expect from 'expect.js'
import {
  Shell,
  Command,
  CommandArgument
} from '../'

describe( 'hackmud emulation', function() {
  describe( 'macro input', function() {
    let shell = new Shell()
    let dummyMacro = {
      name:  "dummyMacro",
      input: "foobar{}"
    }

    it( 'returns "Macro does not exist." for undefined macros', function() {
      expect( shell.exec( `/${dummyMacro.name}` ) ).to.be( 'Macro does not exist.' )
    })

    it( 'returns "Macro created: {macro name} = {input}" when creating a macro', function() {
      expect( shell.exec( `/${dummyMacro.name} = ${dummyMacro.input}` ) ).to.be( `Macro created: ${dummyMacro.name} = ${dummyMacro.input}` )
    })

    it( 'returns [{input}, {command respose}] when executing a macro', function() {
      let expectedCommandRespose = shell.exec( dummyMacro.input )
      let response = shell.exec( `/${dummyMacro.name}` )

      expect( response ).to.be.an( Array ).and.to.have.length( 2 )
      expect( response ).to.eql( [ dummyMacro.input, expectedCommandRespose ] )
    })

    it( 'returns an array of "{macro name} = {input}" strings when no macro name is specified', function() {
      let response = shell.exec( `/` )

      expect( response ).to.be.an( Array ).and.to.have.length( 1 )
      expect( response ).to.eql( [ `${dummyMacro.name} = ${dummyMacro.input}` ] )
    })

    it( 'ignores extraneous whitespace padding', function() {
      expect( shell.exec( ` /${dummyMacro.name} ` ) ).to.eql( shell.exec( `/${dummyMacro.name}` ) )
      expect( shell.exec( ` /${dummyMacro.name} = ${dummyMacro.input} ` ) ).to.be( shell.exec( `/${dummyMacro.name} = ${dummyMacro.input}` ) )
    })

    it( 'returns "Macro does not exist." when executing "/ ${macro name}" (with extraneous space character)', function() {
      expect( shell.exec( `/ ${dummyMacro.name}` ) ).to.be( "Macro does not exist." )
    })
  })

  describe( 'command input', function() {
    let shell    = new Shell()
    let comUsage = 'test.com {req:<required number>, op:<optional string>}'
    let Com1     = class extends Command {
      constructor() {
        super(
          'com1',
          {
            securityLevel: 2,
            usage: comUsage,
            args: [
              new CommandArgument(
                'req',
                [ 'number' ],
                true
              ),
              new CommandArgument(
                'op',
                [ 'string' ],
                false
              )
            ]
          }
        )
      }

      operation( context, args ) {
        let {req, op} = args

        if( op )
          return {ok:true, msg:op}

        return {ok:true}
      }
    }
    let Com2     = class extends Command {
      constructor() {
        super(
          'com2',
          {
            securityLevel: 4,
            usage: comUsage
          }
        )
      }

      operation( context, args ) {
        return {ok:true, args}
      }
    }

    let com1 = new Com1()
    let com2 = new Com2()

    shell.setCommand( 'test', com1 )
    shell.setCommand( shell.username, com2 )

    it( 'resolves commands in dynamic domains', function() {
      let command = shell.getCommand( 'test', 'com1' )

      expect( command ).to.eql( com1 )
    })

    it( 'resolves user script commands by user domain', function() {
      let command = shell.getCommand( shell.username, 'com2' )

      expect( command ).to.eql( com2 )
    })

    it( 'resolves domain-less commands to user domain', function() {
      let command = shell.getCommand( undefined, 'com2' )

      expect( command ).to.eql( com2 )
      expect( shell.regularizeCommandDomain( command.domain.name ) ).to.eql( shell.username )
    })

    it( 'returns usage string when no arguments are supplied and at least one is required', function() {
      expect( shell.exec( `test.com1` ) ).to.be( comUsage )
    })

    it( 'returns {ok:false, msg:<command usage string>} when arguments are supplied but a required arg is missing', function() {
      let result = shell.exec( `test.com1 {op:"optional string"}` )

      expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok', 'msg' )
      expect( result.ok ).to.not.be.ok()
      expect( result.msg ).to.be( comUsage )
    })

    it( 'returns {ok:false, msg:<command usage string>} when args are the wrong type', function() {
      let result = shell.exec( `test.com1 {req:"should be a number"}` )

      expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok', 'msg' )
      expect( result.ok ).to.not.be.ok()
      expect( result.msg ).to.be( comUsage )
    })

    it( 'returns operation return value when all required args are present and valid', function() {
      let result = shell.exec( `test.com1 {req:6}` )

      expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok' )
      expect( result.ok ).to.be.ok()
    })
  })

  describe( 'scripts.trust simulation', function() {
    var shell = new Shell({
      chatDelay: 10
    })

    beforeEach( function() {
      shell.setOutputHandler(() => {})
    })

    describe( 'chats', function() {
      var chatController   = shell.commands.get( 'chats' )

      // chats.channels
      describe( '.channels', function() {
        it( 'returns an empty array when no channels have been joined', function() {
          chatController.joinedChannels = []

          expect( shell.exec( 'chats.channels' ) ).to.be.an( Array ).and.to.have.length( 0 )
        })

        it( 'returns an array of strings after joining channels', function() {
          chatController.joinedChannels = [ "0000", "FFFF" ]

          expect( shell.exec( 'chats.channels' ) ).to.be.an( Array )
            .and.to.contain( "0000" )
            .and.to.contain( "FFFF" )
        })
      })

      // chats.create
      describe( '.create', function() {
        beforeEach( function() {
          chatController.joinedChannels = []
          chatController.channels = []
        })

        it( 'returns {ok: true} when creating a new, non-port channel', function() {
          let result = shell.exec( 'chats.create {name: "test"}' )

          expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok' )
          expect( result.ok ).to.be.ok()
        })

        it( 'joins a newly created channel', function() {
          shell.exec( 'chats.create {name: "test"}' )

          expect( chatController.channels ).to.contain( "test" )
        })

        it( 'returns {ok:false, msg:"channel <channel name> is taken"} when creating a pre-existing channel', function() {
          chatController.channels.push( "test" )

          let result = shell.exec( 'chats.create {name: "test"}' )

          expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok', 'msg' )
          expect( result.ok ).to.not.be.ok()
          expect( result.msg ).to.be( "channel test is taken" )
        })

        it( 'returns {ok:false, msg:"you cannot create any more channels"} when already in 5 channels', function() {
          chatController.joinedChannels.push( "0000", "111111", "222222", "333333", "444444" )

          let result = shell.exec( 'chats.create {name: "test"}' )

          expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok', 'msg' )
          expect( result.ok ).to.not.be.ok()
          expect( result.msg ).to.be( "you cannot create any more channels" )
        })
      })

      // chats.join
      describe( '.join', function() {
        beforeEach( function() {
          chatController.joinedChannels = []
          chatController.channels = []
        })

        it( 'sends an async join message to output when joining an un-joined, pre-existing channel', function( done ) {
          this.timeout( 500 )

          shell.setOutputHandler( message => {
            expect( message ).to.match( new RegExp( `\\d{1,4} 0000 ${shell.username} :::user joined channel:::` ) )
            done()
          })

          shell.exec( 'chats.join {channel: "0000"}')
        })

        it( 'returns {ok:true} when joining un-joined port channel in range 0000-FFFF', function() {
          let channels = [ "0000", "FFFF" ]

          channels.forEach( channel => {
            let result = shell.exec( `chats.join {channel:"${channel}"}` )

            expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok' )
            expect( result.ok ).to.be.ok()
          })
        })

        it( 'returns {ok:false, msg:"you cannot join this channel again"} when joining a previously joined channel', function() {
          chatController.joinedChannels.push( "0000" )

          let result = shell.exec( 'chats.join{channel:"0000"}' )

          expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok', 'msg' )
          expect( result.ok ).to.not.be.ok()
          expect( result.msg ).to.be( "you cannot join this channel again" )
        })

        it( 'returns {ok:true} when joining a previously created, not joined, non-port channel', function() {
          chatController.channels.push( "test" )

          let result = shell.exec( 'chats.join{channel:"test"}' )

          expect( result ).to.be.an( 'object' ).and.to.only.have.keys( 'ok' )
          expect( result.ok ).to.be.ok()
        })
      })

      // chats.leave
      // chats.send
      // chats.tell
    })
  })
})
