# repl.sh

> A command line helper for [repl.it](http://repl.it)

[![NPM version][npm-version-image]][npm-url] [![NPM downloads][npm-downloads-image]][npm-url] [![MIT License][license-image]][license-url]


## Install

    $ npm install -g repl.it

## Usage
  
    Usage: repl.sh [options]
  
      connect your local environment to repl.it
  
    Options:
  
      -V, --version              output the version number
      -G, --goval [host]         goval host to connect to (default: eval.repl.it)
      -P                         project mode, implies -Fwr
      -l, --language [language]  language to use (default: bash)
      -f, --file [value]         provide file to container (takes globs) (default: )
      -F                         send files in current directory, honoring .gitignore
      -w, --watch                watch files for changes and resend them
      -c, --send [string]        send string shell after connect
      -s, --save                 commit files back to the replit
      -r, --reset                reset on change
      -h, --help                 output usage information
  
    Examples:
  
      repl.sh      Connect to a bash shell in the cloud 
      repl.sh -P   Upload the project in the current directry and attach
  

## License

MIT © 2018 Neoreason

[license-image]: http://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: LICENSE

[npm-url]: https://npmjs.org/package/repl.sh
[npm-version-image]: http://img.shields.io/npm/v/repl.sh.svg?style=flat
[npm-downloads-image]: http://img.shields.io/npm/dm/repl.sh.svg?style=flat

