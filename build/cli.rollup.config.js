import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';

let pkg = require('../package.json');
let external = Object.keys(pkg.dependencies);

external.push.apply( external, [ 'fs', 'path', 'readline' ] )

export default {
  entry:   'lib/CLI.js',
  plugins: [
    babel( babelrc() )
  ],
  external: external,
  targets: [
    {
      dest: pkg.directories.dist + '/hackshell-cli.js',
      format: 'cjs',
      moduleName: 'hackshell-cli',
      sourceMap: true
    }
  ]
};
