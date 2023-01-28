const readline = require('readline-sync')
const blip = require('./blip_cli')

const stdout: stream = (...args) => {
    if(args[0] === null) {
        shell.run(readline.question('~> '))
    }
    else console.log(...args)
}

const shell = blip(stdout, console.clear)

shell.build(249)