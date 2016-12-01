import CommandDomain from '../CommandDomain'
import Command from '../Command'
import CommandArgument from '../CommandArgument'

/**
 * Simulates hackdev "chats" scripts and return values
 */
class Chats extends CommandDomain {
  constructor( messageHandler, messageDelay = 300 ) {
    super( Chats.DOMAIN )

    this.channels       = []
    this.joinedChannels = []
    this.messageHandler = messageHandler || ( message => console.log( `[Chats] dispatch: ${message}` ))
    this.messageDelay   = messageDelay

    // Associate all relevant Shell Commands with this domain
    Chats.COMMANDS.forEach( CommandClass => {
      let command = new CommandClass( this )
      this.setCommand( command.name, command )
    } )
  }

  createChannel( name ) {
    if( this.channelExists( name ) )
      return false

    this.channels.push( name )
    return true
  }

  isPortChannel( name ) {
    return /^[\dA-F]{4}$/.exec( name ) !== null
  }

  channelExists( name ) {
    return this.channels.includes( name ) || this.isPortChannel( name )
  }

  hasJoinedChannel( name ) {
    return this.joinedChannels.includes( name )
  }

  joinChannel( name ) {
    if( !this.channelExists( name ) || this.hasJoinedChannel( name ) )
      return false

    this.joinedChannels.push( name )
    return true
  }

  leaveChannel( name ) {
    if( !this.hasJoinedChannel( name ) )
      return false

    this.joinedChannels.splice( this.joinedChannels.indexOf( name ), 1 )

    if( !this.isPortChannel( name ) )
      this.channels.splice( this.channels.indexOf( name ), 1 )

    return true
  }

  dispatchMessage( channel, sender, message, delay ) {
    if( !delay )
      delay = this.messageDelay

    setTimeout( () => this.messageHandler( this.formatMessage( channel, sender, message ) ), delay )
  }

  getTimestamp() {
    let d = new Date(), e = new Date(d)
    let minSinceMidnight = Math.floor( ( e - d.setHours(0,0,0,0) ) / 60000 )

    return Math.floor( minSinceMidnight / 60 ) + "" + ( minSinceMidnight % 60 )
  }

  formatMessage( channel, username, message ) {
    return this.getTimestamp() + ` ${channel} ${username} :::${message}:::`
  }
}

Chats.DOMAIN = "chats"
// chats Shell Command definitions
//TODO: pull out CommandArguments into their own static object
//TODO: Various CommandArguments need more complex validators (message length, channel names, etc.)
Chats.COMMANDS = [
  // chats.channels
  class ChannelsCommand extends Command {
    constructor( chatSim ) {
      super(
        "channels",
        {
          securityLevel: 2
        }
      )

      this.chatSim = chatSim
    }

    /*eslint-disable no-unused-vars*/
    operation( context, args ) {
      /*eslint-enable no-unused-vars*/
      return this.chatSim.joinedChannels
    }
  },

  // chats.create
  class CreateCommand extends Command {
    constructor( chatSim ) {
      super(
        "create",
        {
          securityLevel: 4,
          usage: 'chats.create { name:"<channel name>", password: "<optional password>" }',
          args: [
            new CommandArgument(
              "name",
              [ "string" ],
              true
            ),
            new CommandArgument(
              "password",
              [ "string" ]
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    operation( context, args ) {
      let {name, password} = args

      if( this.chatSim.joinedChannels.length === 5 )
        return {ok: false, msg:'you cannot create any more channels'}

      if( this.chatSim.channelExists( name ) )
        return {ok: false, msg:`channel ${name} is taken`}

      this.chatSim.createChannel( name )

      return this.chatSim.executeCommand( "join", context, {channel: name, password} )
    }
  },

  // chats.join
  class JoinCommand extends Command {
    constructor( chatSim ) {
      super(
        "join",
        {
          securityLevel: 0,
          usage: 'chats.join { channel:"<channel name>", password:"<optional password>" }',
          args: [
            new CommandArgument(
              "channel",
              [ "string" ],
              true
            ),
            new CommandArgument(
              "password",
              [ "string" ]
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    /*eslint-disable no-unused-vars*/
    operation( context, args ) {
      let {channel, password} = args
      /*eslint-enable no-unused-vars*/

      if( this.chatSim.hasJoinedChannel( channel ) )
        return {ok:false, msg:"you cannot join this channel again"}

      if( this.chatSim.channelExists( channel ) ) {
        this.chatSim.joinChannel( channel )
        this.chatSim.dispatchMessage( channel, context.caller, "user joined channel" )

        return {ok:true}
      }

      return {ok: false, msg:`channel ${channel} does not exist`}
    }
  },

  // chats.leave
  class LeaveCommand extends Command {
    constructor( chatSim ) {
      super(
        "leave",
        {
          securityLevel: 0,
          usage: 'chats.leave { channel:"<channel name>" }',
          args: [
            new CommandArgument(
              "channel",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    operation( context, args ) {
      let {channel} = args

      if( !this.chatSim.channelExists( channel ) )
        return {ok: false, msg:`channel ${channel} does not exist`}

      if( !this.chatSim.hasJoinedChannel( channel ) )
        return {ok:false, msg:`you aren't in ${channel}. join channel with chats.join`}

      this.chatSim.leaveChannel( channel )
      return {ok:true}
    }
  },

  // chats.send
  class SendCommand extends Command {
    constructor( chatSim ) {
      super(
        "send",
        {
          securityLevel: 4,
          usage: 'chats.send { channel:"<channel name>", msg:"<message (1000/10)>" }',
          args: [
            new CommandArgument(
              "channel",
              [ "string" ],
              true
            ),
            new CommandArgument(
              "msg",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    operation( context, args ) {
      let {channel, msg} = args

      if( !this.chatSim.hasJoinedChannel( channel ) )
        return {ok:false, msg:`you aren't in ${channel}. join channel with chats.join`}

      this.chatSim.dispatchMessage( channel, context.caller, msg )

      return "Msg Sent"
    }
  },

  // chats.tell
  class TellCommand extends Command {
    constructor( chatSim ) {
      super(
        "tell",
        {
          securityLevel: 4,
          usage: 'chats.tell { to:"<username>", msg:"<message (1000/10)>" }',
          args: [
            new CommandArgument(
              "to",
              [ /^[a-z]\w*$/i ],
              true
            ),
            new CommandArgument(
              "msg",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    operation( context, args ) {
      let {to, msg} = args

      if( to !== context.caller )
        return {ok:false, msg:`User ${to} does not exist.`}

      this.chatSim.dispatchMessage( "from", to, msg )
      this.chatSim.dispatchMessage( "to", to, msg )

      return "Msg Sent"
    }
  },

  // chats.users
  class UsersCommand extends Command {
    constructor( chatSim ) {
      super(
        "users",
        {
          securityLevel: 2,
          usage: 'chats.users { channel:"<channel name>" }',
          args: [
            new CommandArgument(
              "channel",
              [ "string" ],
              true
            )
          ]
        }
      )

      this.chatSim = chatSim
    }

    operation( context, args ) {
      let {channel} = args

      if( !this.chatSim.hasJoinedChannel( channel ) )
        return {ok: false, msg:`Can't list users for ${channel} because you haven't joined it.`}

      return [context.caller]
    }
  }
]

export default Chats
