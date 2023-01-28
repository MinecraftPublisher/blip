const version = '1.2.1'

type stream = ((...data: (string | null)[]) => void)

type _function = {
    function: boolean
    name: string
    args: string[]
    data: kcmd
}

type memory_check_result = {
    name: string
    value: string | undefined
}

type _string = string & {
    function?: false
    name?: string
    args?: string[]
    data: string
}

type dictionary = {
    [key: string]: any
}

type localstorage = {
    getItem: (name: string) => string | undefined,
    setItem: (name: string, value: string) => void
}

type module_holder = {
    [key: string]: ((cmd: string, args: string[], localStorage: localstorage, memory: dictionary, shell: Blip) => {})
}

type kcmd = {
    time: number
    id: number
    arr: Array<{
        cmd: string
        args: string[]
    }>
}

interface Blip {
    stdin: stream
    stdout: stream
    stdclear: stream

    line: () => number
    code: () => string

    memory: () => dictionary
    write: (name: string, value: string) => any

    build: ((tps: number) => void)
    stop: (() => void)

    run: ((line: string) => void)
}

function http(url: string): string {
    /*//@ts-ignore
    let xmlHttp = new XMLHttpRequest()

    xmlHttp.open("GET", url, false)
    xmlHttp.send(null)

    return xmlHttp.responseText*/
    return fs.readFileSync(url, 'utf8')
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replaceAll('&', "&amp;")
        .replaceAll('<', "&lt;")
        .replaceAll('>', "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function mulberry32(a: number): () => number {
    return function () {
        let t = a += 0x6D2B79F5
        t = Math.imul(t ^ t >>> 15, t | 1)
        t ^= t + Math.imul(t ^ t >>> 7, t | 61)

        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

let modules: module_holder = {}

const localStorage = {
    setItem: (name: string, content: string) => fs.writeFileSync(name, content),
    getItem: (name: string) => fs.existsSync(name) ? fs.readFileSync(name, 'utf8') : undefined
}

const _blip = ((stdout: stream, stdclear: stream): Blip => {
    let kernel_input: Array<kcmd> = []

    let kernel_interval: number = -100000

    let kernel_count = 0
    let kernel_wait = 0
    let kernel_last = 0

    let stdin_data = []

    let kernel_line = 0
    let kernel_code = ''

    /**
     * The kernel is the heart of blip. It is responsible for parsing and executing instructions, and writing to filesystem.
     * 
     *   Keep in mind that multi-line instructions will be executed in a single tick, 
     * Which means if the tps is too high and the instructions are time-consuming, 
     * The kernel's ticks might interfere with each other.
     * 
     *   To avoid the issue mentioned above, The kernel will "halt" until the previous tick is processed.
     */
    const kernel = (() => {
        if (kernel_count !== 0) return

        if (kernel_wait > 0) {
            kernel_last = kernel_wait
            return --kernel_wait
        }

        if(kernel_last !== 0) {
            kernel_last = 0
            stdout(null)
        }

        kernel_count++

        if (kernel_input.length > 0) {
            // we first want to process all input instructions.
            let j = kernel_input[0]

            const interop = (j: kcmd) => {
                let skip_line = 0

                kernel_code = j.arr.map(e => e.cmd + ' ' + e.args.join(' ')).join('\n')

                for (let i2 = 0; i2 < j.arr.length; i2++) {
                    if (skip_line > 0) return skip_line--

                    // set the kernel line.
                    kernel_line = i2

                    let i = j.arr[i2]
                    let cmd = i.cmd

                    if (cmd === '#' || cmd === '//' || cmd === '') null

                    else if (cmd === 'echo') stdout(...i.args)
                    else if (cmd === 'clear') stdclear()

                    else if (cmd === 'wait') kernel_wait += parseInt(i.args[0])

                    else if (cmd === 'write') localStorage.setItem(i.args[0], i.args.slice(1).join(' ').replaceAll('\\n', '\n'))
                    else if (cmd === 'read') memory[i.args[0]] = localStorage.getItem(i.args.slice(1).join(' '))
                    else if (cmd === 'if' || cmd === '!if') {
                        let ifnot = cmd === '!if'

                        let op = ' ' + (i.args.join(' ').match(/(==|!=|\|\||>|<|<=|>=)/g) || [])[0] + ' '
                        let v1 = JSON.parse(i.args.join(' ').split(op)[0])
                        let v2 = JSON.parse(i.args.join(' ').split(op)[0])

                        op = op.substring(1, op.length - 1)

                        let output = false
                        const bf = (f: string): boolean => f === 'true' ? true : false

                        if (op === '==') output = (v1 === v2)
                        else if (op === '!=') output = (v1 !== v2)
                        else if (op === '||') output = (bf(v1) || bf(v2))
                        else if (op === '&&') output = (bf(v1) && bf(v2))
                        else if (op === '>') output = (parseInt(v1) > parseInt(v2))
                        else if (op === '<') output = (parseInt(v1) > parseInt(v2))
                        else if (op === '>=') output = (parseInt(v1) >= parseInt(v2))
                        else if (op === '<=') output = (parseInt(v1) >= parseInt(v2))
                        else stdout('error: unsupported condition "' + op + '"')

                        const run_code = ((exps: string[]) => {
                            let id = Math.floor(rnd() * 1e20)
                            let output_if: kcmd = {
                                time: +new Date,
                                id,
                                arr: []
                            }

                            // get the code
                            let prev_line = i.cmd + i.args.join(' ')
                            let if_count = 0

                            let i3 = i2 + skip_line

                            while (!(prev_line.startsWith('}') && if_count === 0) && j.arr.length > i3) {
                                i3 = i2 + skip_line

                                if (j.arr[i3].cmd === '}' && if_count > 0) if_count--
                                prev_line = j.arr[i3].cmd + j.arr[i3].args.join(' ')

                                if (exps.includes(j.arr[i3].cmd)) if_count++
                                else output_if.arr.push(j.arr[i3])

                                skip_line++
                            }

                            output_if.arr = output_if.arr.slice(0, output_if.arr.length - 1)

                            return output_if
                        })

                        let code = run_code(['if', '!if'])
                        if (output && !ifnot) interop(code)
                        else if (!output && ifnot) interop(code)
                    } else if (cmd === 'function') {
                        let name = i.args[0]

                        const run_code = ((exps: string[]) => {
                            let id = Math.floor(rnd() * 1e20)
                            let output_dev: kcmd = {
                                time: +new Date,
                                id,
                                arr: []
                            }

                            // get the code
                            let prev_line = i.cmd + i.args.join(' ')
                            let dev_count = 0

                            let i3 = i2 + skip_line

                            while (!(prev_line.startsWith('}') && dev_count === 0) && j.arr.length > i3) {
                                i3 = i2 + skip_line

                                if (j.arr[i3].cmd === '}' && dev_count > 0) dev_count--
                                prev_line = j.arr[i3].cmd + ' ' + j.arr[i3].args.join(' ')

                                if (exps.includes(j.arr[i3].cmd)) dev_count++
                                else output_dev.arr.push(j.arr[i3])

                                skip_line++
                            }

                            output_dev.arr = output_dev.arr.slice(0, output_dev.arr.length - 1)
                            return output_dev
                        })

                        let raw = run_code(['function'])
                        let data = raw.arr.map(e => e.cmd + ' ' + e.args.join(' ')).join('\n')
                        let args = (data.match(/^(define .+\n{0,1})+/g) || []).map(e => e.substring(0, e.length - 1).split(' ').slice(1).join(' '))

                        data = data.replaceAll(/^(define .+\n{0,1})+/g, '')

                        raw.arr = data.split('\n').map(e => {
                            return {
                                cmd: e.split(' ')[0],
                                args: e.split(' ').slice(1)
                            }
                        })

                        let func_obj: _function = {
                            function: true,
                            name,
                            args,
                            data: raw
                        }

                        memory[name] = func_obj
                    } else if (cmd === 'define') {
                        stdout('warning: define is not supported outside of functions and therefore has no effect.')
                    }

                    else if (cmd === 'run') {
                        if (localStorage.getItem(i.args.join(' '))) blip_shell.run(localStorage.getItem(i.args.join(' ')) ?? '')
                        else stdout('error: file not found: "' + i.args.join(' ') + '"')
                    }

                    /* else if (cmd === 'download') {
                        let filename = i.args[0]
                        let url = i.args.slice(1).join(' ')

                        memory[filename] = escapeHtml(http(url))
                    } */

                    else if (cmd === 'import') {
                        let url = i.args.join(' ')
                        let json: ({ name: string, function: string })[] = JSON.parse(escapeHtml(http(url)))

                        for(let i in json) {
                            let obj = json[i]
                            modules[obj.name] = new Function(`return ((cmd, args, localStorage, memory, shell) => { ${obj.function} })`)()
                        }
                    }

                    /* funny shit */
                    else if (cmd === 'sadge') stdout(':(')

                    /* get a custom command from memory */
                    else if (memory[cmd] && memory[cmd].function === true) {
                        let fn: _function = {...memory[cmd]}

                        let args: Array<memory_check_result> = fn.args.map((e, n) => {
                            return {
                                name: e,
                                value: (i.args[n] || 'undefined')
                            }
                        })

                        let _data = fn.data.arr.map(e => {
                            return e.cmd + ' ' + e.args.join(' ')
                        }).join('DIVIDER\nDIVIDER')

                        for(let arg of args) {
                            console.log(arg, fn)
                            if(arg.value) _data = _data.replaceAll('[' + arg.name + ']', arg.value.toString())
                        }

                        interop({
                            id: rnd(),
                            time: +new Date,
                            arr: _data.split('DIVIDER\nDIVIDER').map(e => {
                                return {
                                    cmd: e.split(' ')[0],
                                    args: e.split(' ').slice(1)
                                }
                            })
                        })
                    } else if (i.args[0] === '=') {
                        let name = cmd
                        let value = JSON.parse(i.args.slice(1).join(' '))

                        memory[name] = value
                    }
                    
                    else if (modules[i.cmd]) {
                        modules[i.cmd](cmd, i.args, localStorage, memory, blip_shell)
                    }

                    else stdout('error: unknown command "' + cmd + '" in line "' + i.cmd + ' ' + i.args.join(' ') + '"')
                }
            }

            interop(j)

            // remove the executed command from the stack.
            kernel_input = kernel_input.filter(e => e.id !== j.id)

            // send a signal to the client to declare that the execution is finished.
            if(kernel_input.length === 0 && kernel_wait === 0) stdout(null)
        }

        kernel_count--
    })

    /**
     * @param tps The number of ticks per second for the kernel to execute. The hard limit set by browsers is 250, But the kernel caps at 249.
     */
    const kernel_tick = ((tps: number) => {
        stdout('blip kernel\nv' + version + '')

        kernel_interval = parseInt(setInterval(() => kernel(), 1000 / tps > 249 ? 249 : 1000 / tps).toString())
    })

    let rnd = mulberry32(Math.random() * (+new Date))
    let memory: dictionary = {}

    const blip_shell: Blip = {
        stdin: ((...data: (string | null)[]) => stdin_data.push(data)),
        stdout: stdout,
        stdclear: stdclear,

        line: () => kernel_line + 1,
        code: () => kernel_code,

        memory: () => memory,
        write: (name: string, value: string) => localStorage.setItem(name, value),
        
        build: (tps: number = 20) => {

            // then we need to check if 

            // then, we need to start up the kernel.
            kernel_tick(tps)

            // after we start the kernel, we need to check for `main.blip` and then run it if it exists.
            if(localStorage.getItem('main.blip')) blip_shell.run('run main.blip')
            else stdout(null)
        },
        stop: () => {
            // first we need to stop the kernel.
            clearInterval(kernel_interval)

            //@ts-ignore
            // then finally, we need to free memory by clearing variables.
            memory = {}
        },
        run: (line) => {
            let id = Math.floor(rnd() * 1e20)

            let arr = line.replaceAll('\r', '').replaceAll(/function [^}]+ {\n([^}]+\n)+}/g, (f) => {
                return f.replaceAll(/[^\\]\[[^\]]+\]/g, (g) => {
                    return g.substring(0, 1) + '\\' + g.substring(1)
                })
            }).split('\n').map(e => {
                let w = e ?? ''
                while (w.startsWith(' ')) w = w.substring(1)

                while (w.match(/[^\\]\[[^\]]+\]/g)) {
                    w = w.replaceAll(/[^\\]\[[^\]]+\]/g, (f) => {
                        return f.substring(0, 1) + memory[f.substring(2, f.length - 1)]
                    })
                }

                w = w.replaceAll(/\\\[[^\]]+\]/g, (f) => f.substring(1))

                let cmd = w.split(' ')[0]
                let rnd2 = mulberry32(+new Date * Math.random() * 128378)
                let DIVIDER = Math.floor(Math.random() * rnd2() * 200).toString()
                let args = w.replaceAll('\\ ', DIVIDER).split(' ').slice(1).map(e => e.replaceAll(DIVIDER, ' ')) ?? []

                return { cmd, args }
            })

            kernel_input.push({ time: +new Date, id, arr })
        }
    }

    return blip_shell
})

module.exports = {
    blip: _blip
}