# hackshell
An emulator for the shell environment used in [Drizzly Bear](http://drizzlybear.com/)'s game '[h a c k m u d](https://www.hackmud.com/)'

hackshell intends to provide a means to accelerate development of the JavaScript user scripts used in-game. By locally simulating the game's shell and standard library, the latency stemming from repeatedly uploading scripts to the game server (as well as incidental delays in script execution) are eliminated.

hackshell provides the core execution environment for the hackdev.io IDE, enabling scripts written in the hackdev editor to execute as-is without the intermediary process of saving and uploading. hackdev's console component provides a means to directly interact with hackshell via command-line-emulator.

# Installation & Building
The project is not currently served on NPM, so for now you'll need to download hackshell from GitHub or `git clone https://github.com/KuroTsuto/hackshell.git` manually.

`npm install --dev` in the project root to install development dependencies, then `npm run build` to compile UMD (`hackshell.js`) and ES2015 (`hackshell.mjs`) bundles and sourcemaps to the `dist` directory. Use `npm run watch` to compile bundles on changes to source files.

The resulting packages are usable in the browser and Node, assuming appropriate feature support.

hackshell was written on Node v6.9.1

# Basic Usage
## Command Line
`cli.js` provides a basic command line interface. Run `node cli` in the project root to start the command line, then pass and execute input as you would in-game. To exit the CLI, either execute the `shutdown` command, or send a standard SIGINT (<kbd>ctrl</kbd>+<kbd>c</kbd> in most environments).

```shell-script
$node cli
> user an1k3t0s
Active user is now an1k3t0s

> scripts.get_level { name: "chats.join" }
NULLSEC

> /join0 = chats.join { channel: "0000" }
Macro created: join0 = chats.join { channel: "0000" }

> /join0
chats.join { channel: "0000" }
Success

1652 0000 an1k3t0s :::user joined channel:::
> chats.send { channel: "0000", msg: "Hello, Scum!" }
Msg Sent

1652 0000 an1k3t0s :::Hello, Scum!:::
> shutdown
-terminal poweroff-

$
```

## Bundles
Import or require hackshell as you would any other package. If you're using a module bundler that recognizes the `"module"` or `"jsnext:main"` fields in `package.json` it should automatically select the proper hackshell bundle - otherwise it will select the basic UMD bundle by default. Then instantiate Shell and use the `exec` method to execute game-like input strings and retrieve the return values:

```node
var hackshell = require( 'hackshell' )
var shell = new hackshell.Shell()

function execLog( input ) {
  console.log( shell.exec( input ) )
}

execLog( '/join0 = chats.join { channel: "0000" }' )
execLog( '/join0' )
execLog( 'chats.send{ channel: "0000", msg:"Hello, Scum!" }' )
```

You may also specify an output handler callback to deal with asynchronous output (like chat messages):

```node
shell.setOutputHandler( message => {
  console.log( '[async hackshell output]: ' + message )
})
```

## Modules
If you're working in an environment that supports ES2015 and the spread operator, you can import hackshell modules directly (useful when you'd like your own build process to handle optimizations and transpilation):

```node
import {Shell, Command, controllers} from 'hackshell/lib'
```

# Structure & Implementation
The shell emulator works by organizing "commands" (analogous to hackmud's "scripts") defined with a name, security level, and operation into "command domains" (hackmud's "users", "corps", and... basically anything that might prefix a script name). The shell can then parse input strings and scriptors to resolve respective commands in the appropriate domain.

The emulator is composed of five basic classes.

## Shell
The Shell class is responsible for interpreting input, maintaining macro definitions, organizing command domains, and executing commands and macros. Of particular note, it composes the context object passed to every command's operation function on execution.

## CommandDomain
A CommandDomain collects functionally or semantically related or dependent Commands into a group identified with "domain name" which serves as a prefix for input and scriptors. In the case of functionally dependent Commands, a Command Domain may serve as a controller for it's Commands, enabling them to share state and information.

For example, the in-game script "chats.tell" is emulated with a "TellCommand" Command instance (with a name property containing the value "tell") which resides in a "Chats" instance extended from CommandDomain (with a name property containing the value "chats"). Chats instantiates TellCommand by passing a reference to itself to TellCommand's constructor, allowing TellCommand to access the various common Chats methods related to chat-functionality simulation and state, including available channels, joined channels, and the operations which affect them.

When the Chats CommandDomain is then registered with the Shell, the Shell is then able to resolve "chats.tell" within a scriptor or input string to the TellCommand instance in the registered Chats instance - and subsequently execute it's operation or retrieve it's security level.

## Command
The `Command` class represents a single in-game script. It contains the name of the script, it's security level, a usage string, an `operation()` method representing the actual function of the command, and a number of `CommandArgument`s describing the parameters which the operation might utilize within the `args` object.

In general, a single in-game script is described by extending the `Command` class and overriding the constructor and `operation()` methods. The command's name and an object of options will then be passed to the call to `super()` within the constructor.

State utilized by multiple `Command`s best resides in their common `CommandDomain`, however state relevant only to one `Command` can logically be added to a `Command` class via properties and methods.

Take hackshell's simulation of `chats.send`, for example:

```node
// chats.send
class SendCommand extends Command {
  constructor( chatSim ) {
    /*
     * Here, we define the properties of the in-game script within the call to super(). SendCommand
     * represents the in-game script chats.send, so we specify "send" as the name argument.
     */
    super(
      "send",
      {
        securityLevel: Command.SECURTIY_LEVELS.FULLSEC,
        accessLevel:   Command.ACCESS_LEVELS.TRUST,
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

  /*
   * When something calls SendCommand.execute( <context object>, <arguments object> ), the
   * the arguments object will be validated against the CommandArguments specified in the
   * constructor. If any argument fails validation, a usage response will be returned. If
   * validation is successful, this "operation" method will be executed and it's return value
   * returned to whatever called originally called .execute
   */
  operation( context, args ) {
    let {channel, msg} = args

    if( !this.chatSim.hasJoinedChannel( channel ) )
      return {ok:false, msg:`you aren't in ${channel}. join channel with chats.join`}

    this.chatSim.dispatchMessage( channel, context.caller, msg )

    return "Msg Sent"
  }
}
```

Here, `chatSim` is an instance of the `Chats` `CommandDomain`, which includes utility methods for sending messages to output and managing channels. `chats.send`'s functionality is only dependent on the state of the larger chat simulation, so `SendCommand` implements no additional methods of it's own, instead relying on the helper methods provided by the `Chats` `CommandDomain` (i.e. `hasJoinedChannel()` and `dispatchMessage()`).

Since a `usage` string and array of `CommandArgument`s (`options.args`) were passed to `Command`'s constructor in the call to `super()`, `SendCommand` will automatically return it's usage string in the correct format when necessary. In this case, since both `CommandArgument`s were constructed with their `required` parameter set to `true`, `SendCommand` will return just the usage string if it receives no arguments, and an object consisting of `{ok:false, msg:<usage string>}` if arguments were supplied but one or both of the required properties are missing. Since both also specify a basic `"string"` validator, `SendCommand` will also return the aforementioned object when arguments are supplied, but either of the defined arguments are not a string.

## CommandArgument
Instances of CommandArgument verbosely describe a single parameter (or property on the args object) that a Command's operation might use by collecting the parameter's name, whether or not it's required, and any possible validation criteria. This allows hackshell to easily simulate script usage standards in a manner consistent with hackmud's standard scripts without repeating type checks and validation flow for each individual script.

## UserScript
`UserScript`s are `Commands`s which represent user-implemented functions, analogous to scripts created by users in hackmud. Constructed with a name and a string containing the script's function-body (or a callback which returns such a string), the `UserScript` class is capable of dynamically determining the function's security-level by examining a dependency graph created from the scriptors (references to other `Commands` in the format `#s.<domain name>.<command name>`) contained in the function body.

Instead of calling a pre-defined `operation()` method when `execute()`ed, `UserScripts` evaluate the given function body by inserting it into a `new Function()` constructor. Scriptors contained in the function body are replaced with IIFEs which execute the respective `Command`s.

Measures are taken to prevent infinite pre-processing and evaluation as well as security level calculations in the case of recursive scriptor dependencies (e.g. a `UserScript` will not evaluate it's function body more than once per execution stack).

A `UserScript` which represents and executes a hackmud script file can thus be implemented as such:
```node
var fs        = require( 'fs' )
var hackshell = require( 'hackshell' )

var Shell      = hackshell.Shell
var UserScript = hackshell.UserScript

var username = 'an1k3t0s'
var shell    = new Shell()

var myScriptCommand = new UserScript(
  'myscript',
  function() {
    return fs.readFileSync( 'path/to/myscript.js', {encoding: 'utf8'} )
  },
  shell
)

shell.setUser( username )
shell.setCommand( 'myscript', myScriptCommand )
```

After which, `shell.exec( 'myscript {some: "argument", digit: 1}' )` would execute as expected, and `myScriptCommand.getSecurityLevel()` or `shell.exec( 'scripts.get_level {name: "an1k3t0s.myscript"}' )` would return a security level respective of the scriptors used in the file `myscript.js`.

# Contributing
Currently, hackshell does a commendable job at emulating hackmud's shell environment - the principal of the remaining work is in fleshing out the standard scripts and writing tests (via mocha).

However, the overall structure and implementation of hackshell should be considered **unstable** - much refactoring is still likely to occur, particularly with regards to more complicated functionality such as the scriptor substitution and security calculations performed by `UserScript`. In short, many things can and should be done better.

Many files contain a good number of `// TODO` comments regarding things not yet implemented, not tested or checked against in-game behaviors, or implemented poorly.

## Commands
The Chats CommandDomain accurately simulates the in-game chat scripts (with the limitations of multiple users and password-protected channels), however the remaining trusts scripts have yet to be implemented. `lib/commands/Chats.js` serves as a good reference for Command and CommandDomain implementation.

## Tests
hackshell needs various additional tests. In particular, tests for non-implemented Commands would be particularly useful and serve to create a specification for Command implementation. Expected values can be easily extrapolated from the game - simply run a possible test case for a script in hackmud and see what it spits back.
