import * as uglify from 'uglify-js'
import * as defchalk from 'chalk'
import * as fs from 'fs'

const chalk = defchalk.default
const port = 2000

const Transpiler = new Bun.Transpiler({
    loader: 'ts'
})

let encoder = new TextEncoder("utf-8");
let decoder = new TextDecoder("utf-8");
let base64Table = encoder.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');
function toBase64(dataArr: Buffer){

    let padding = dataArr.byteLength % 3
    let len = dataArr.byteLength - padding
    padding = padding > 0 ? (3 - padding) : 0

    let outputLen = ((len/3) * 4) + (padding > 0 ? 4 : 0)
    let output = new Uint8Array(outputLen)
    let outputCtr = 0

    for(let i=0; i<len; i+=3){              
        let buffer = ((dataArr[i] & 0xFF) << 16) | ((dataArr[i+1] & 0xFF) << 8) | (dataArr[i+2] & 0xFF)
        output[outputCtr++] = base64Table[buffer >> 18]
        output[outputCtr++] = base64Table[(buffer >> 12) & 0x3F]
        output[outputCtr++] = base64Table[(buffer >> 6) & 0x3F]
        output[outputCtr++] = base64Table[buffer & 0x3F]
    }

    if (padding == 1) {
        let buffer = ((dataArr[len] & 0xFF) << 8) | (dataArr[len+1] & 0xFF)
        output[outputCtr++] = base64Table[buffer >> 10]
        output[outputCtr++] = base64Table[(buffer >> 4) & 0x3F]
        output[outputCtr++] = base64Table[(buffer << 2) & 0x3F]
        output[outputCtr++] = base64Table[64]
    } else if (padding == 2) {
        let buffer = dataArr[len] & 0xFF
        output[outputCtr++] = base64Table[buffer >> 2]
        output[outputCtr++] = base64Table[(buffer << 4) & 0x3F]
        output[outputCtr++] = base64Table[64]
        output[outputCtr++] = base64Table[64]
    }

    return decoder.decode(output)
}

const compile = () => fs.readFileSync('app/main.html', 'utf8')
    .replace('<Typescript />',
        `<script transpiled>/* automatically transpiled from typescript by bun transpiler */\n${uglify.minify(Transpiler.transformSync(
            fs.readFileSync('app/blip.ts', 'utf8').replace("export const blip = _blip", '') + '\n' +
            fs.readFileSync('app/app.ts', 'utf8').replace("import { blip } from './blip.js'", '').replace("blip(", "_blip(")
            , {})).code
        }\n</script>`)

if (!process.argv.includes('build')) {
    Bun.serve({
        port: port,
        fetch(request: Request) {
            if (!request.url.includes('favicon.ico')) console.log(`${chalk.green(chalk.bold(`get`))} ${request.url}`)
            else return new Response('fuck you bitch')

            if(request.url.includes('blip.json')) {
                // build the mods
                let mod: {
                    name: string,
                    function: string
                }[] = []

                let files = fs.readdirSync('mod/')

                for(let file of files) {
                    mod.push({
                        name: file.split('.').slice(0, file.split('.').length - 1).join('.'),
                        function: fs.readFileSync('mod/' + file, 'utf8')
                    })
                }

                return new Response(JSON.stringify(mod), {
                    headers: {
                        'Content-Type': 'text/json'
                    }
                })
            }

            let compiled = compile()
            fs.writeFileSync('index.html', compiled)
            fetch(process.env.CHECK_URL ?? '').then(e => e.text()).then(e => {
                if (e !== compiled) {
                    fetch((process.env.UPLOAD_URL ?? '') + process.env.KEY, {
                        'method': 'POST',
                        'body': compiled.replaceAll('<meta property="og:description" content="A programmable shell in the browser." />', '<meta property="og:description" content="A programmable shell in the browser.\n\nWARNING: Experimental build. Subject to live changes." />')
                    }).then(e => console.log('Uploaded newest version.')).catch(e => {
                        console.log('Error while uploading newest version.')
                        console.log(e)
                    })
                }
            }).catch(e => console.log('Failed to fetch uploaded version.', e))

            return new Response(
                compiled,
                {
                    headers: {
                        'Content-Type': 'text/html'
                    }
                }
            )
        }
    })

    let old_code = ''
    setInterval(() => {
        let blip = fs.readFileSync('app/blip.ts', 'utf8')
        if (blip !== old_code) {
            try {
                fs.writeFileSync('app/blip.js', uglify.minify(Transpiler.transformSync(blip, {})).code)
                old_code = blip
            } catch { }
        }
    }, 50)

    /**
     * Infiltrate console.log to make it look pretty!
     */
    let _log = console.log
    if (!console.log.toString().includes(`chalk`)) {
        console.log = (...args) => {
            let hours = new Date().getHours().toString()
            let minutes = new Date().getMinutes().toString()
            let seconds = new Date().getSeconds().toString()

            hours = parseInt(hours) < 10 ? `0` + hours : hours
            minutes = parseInt(minutes) < 10 ? `0` + minutes : minutes
            seconds = parseInt(seconds) < 10 ? `0` + seconds : seconds

            _log(`${chalk.gray(chalk.bold(`[`))}${chalk.yellowBright(chalk.bold(hours + chalk.redBright(`:`) + minutes + chalk.redBright(`:`) + seconds))}${chalk.gray(chalk.bold(`]`))}`, ...args)
        }
    }

    const init = () => {
        console.clear()
        console.log(`${chalk.green(chalk.bold(`blip http`))} server is running!`)
        console.log(`${chalk.cyanBright(chalk.bold(`development`))}: ${process.env.NODE_ENV !== `production` ? chalk.bold(chalk.greenBright(`true`)) : chalk.bold(chalk.redBright(`false`))}`)
        console.log(`${chalk.magentaBright(chalk.bold(`port`))}: ${chalk.redBright(chalk.bold(port))}`)
    }

    init()
} else {
    fs.mkdirSync('build/')
    fs.writeFileSync('build/index.html', compile())
}