# hackshell
An emulator for the shell environment used in [Drizzly Bear](http://drizzlybear.com/)'s game '[h a c k m u d](https://www.hackmud.com/)'

hackshell intends to provide a means to accelerate development of the JavaScript user scripts used in-game. By locally simulating the game's shell and standard library, the latency stemming from repeatedly uploading scripts to the game server (as well as incidental delays in script execution) are eliminated.

hackshell provides the core execution environment for the hackdev.io IDE, enabling scripts written in the hackdev editor to execute as-is without the intermediary process of saving and uploading. hackdev's console component provides a means to directly interact with hackshell via command-line-emulator.

# Installation & Building
The project is not currently served on NPM, so now you'll need to download hackshell or `git clone` manually.

`npm install --dev` in the project root to install development dependencies, then `npm run build` to compile CommonJS and ES2015 bundles and sourcemaps to the `dist` directory. Use `npm run watch` to compile bundles on changes to source files.

The resulting packages are usable in the browser and Node, assuming appropriate feature support.

hackshell was written on Node v6.9.1

# Basic Usage
After loading a bundle, instantiate Shell and use the `exec` method to execute game-like input strings:

```
import {Shell} from 'hackshell'

let shell = new Shell()

console.log( shell.exec( '/join-0000 = chats.join { channel: "0000" }') )
console.log( shell.exec( '/join-0000' ) )
console.log( shell.exec( 'chats.send{ channel: "0000", msg:"Hello Scum!" }' ) )
```

# Structure & Implementation
The shell emulator works by organizing "commands" (analogous to hackmud's "scripts") defined with a name, security level, and operation into "command domains" (hackmud's "users", "corps", and... basically anything that might prefix a script name). The shell can then parse input strings and scriptors to resolve respective commands in the appropriate domain.

The emulator is composed of four basic classes.

## Shell
The Shell class is responsible for interpreting input, maintaining macro definitions, organizing command domains, and executing commands and macros. Of particular note, it composes the context object passed to every command's operation function on execution.

## CommandDomain
A CommandDomain collects functionally or semantically related or dependent Commands into a group identified with "domain name" which serves as a prefix for input and scriptors. In the case of functionally dependent Commands, a Command Domain may serve as a controller for it's Commands, enabling them to share state and information.

For example, the in-game script "chats.tell" is emulated with a "TellCommand" Command instance (with a name property containing the value "tell") which resides in a "Chats" instance extended from CommandDomain (with a name property containing the value "chats"). Chats instantiates TellCommand by passing a reference to itself to TellCommand's constructor, allowing TellCommand to access the various common Chats methods related to chat-functionality simulation and state, including available channels, joined channels, and the operations which affect them.

When the Chats CommandDomain is then registered with the Shell, the Shell is then able to resolve "chats.tell" within a scriptor or input string to the TellCommand instance in the registered Chats instance - and subsequently execute it's operation or retrieve it's security level.

## Command
The Command class represents a single in-game script. It contains the name of the script, it's security level, a usage string, an "operation" function representing the actual functionality of the command, and a number of CommandArguments describing the parameters which the operation might utilize within the `args` object.

In general, a single command is described by extending the Command Class and overwriting the constructor and `operation` methods. The command's name and an object of arguments including security level, usage string, and CommandArguments will then be passed to the call to `super` within the constructor.

State shared among multiple Commands best resides in a common CommandDomain, however state relevant only to one command can logically be added to a Command class via properties and methods.

## CommandArgument
Instances of CommandArgument verbosely describe a single parameter (or property on the args object) that a Command's operation might use by collecting the parameter's name, whether or not it's required, and any possible validation criteria. This allows hackshell to easily simulate script usage standards in a manner consistent with hackmud's standard scripts without repeating type checks and validation flow for each individual script.

# Contributing
Currently, hackshell does a commendable job at emulating hackmud's shell environment - the principal of the remaining work is in fleshing out the standard scripts and writing tests (via mocha).

The Chats CommandDomain accurately simulates the in-game chat scripts (with the limitations of multiple users and password-protected channels), however the remaining trusts scripts have yet to be implemented. `lib/commands/Chats.js` serves as a good reference for Command and CommandDomain implementation.

I'd be happy to look over pull requests for missing Commands, tests describing existing or missing in-game script use-cases, and anything addressing TODOs. Or anything else really :)
