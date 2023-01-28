import { blip } from './blip.js'

//@ts-ignore
const Terminal = document.querySelector('terminal')
//@ts-ignore
const Files = document.querySelector('files')
//@ts-ignore
const Help = document.querySelector('HelpWrapper')
//@ts-ignore
const Window = document.querySelector('window')

function escapeHtml(unsafe: string): string {
    return unsafe
        .replaceAll('&', "&amp;")
        .replaceAll('<', "&lt;")
        .replaceAll('>', "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

//@ts-ignore
function setEndOfContenteditable(contentEditableElement) {
    if (Terminal.innerHTML.includes('<br><br>')) Terminal.innerHTML = Terminal.innerHTML.replaceAll('<br><br>', '<br>')
    if (Terminal.innerHTML.startsWith('<br>')) Terminal.innerHTML = Terminal.innerHTML.substring(4)

    let range, selection
    //@ts-ignore
    if (document.createRange) {
        //@ts-ignore
        range = document.createRange()
        range.selectNodeContents(contentEditableElement)
        range.collapse(false)
        //@ts-ignore
        selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
    }
    //@ts-ignore
    else if (document.selection) {
        //@ts-ignore
        range = document.body.createTextRange()
        range.moveToElementText(contentEditableElement)
        range.collapse(false)
        range.select();
    }
}

Terminal.setAttribute('contenteditable', '')
Terminal.setAttribute('spellcheck', 'false')

let add_command_input = 0

const files = (() => {
    Files.style.display = 'block'
    shell.stdout('<br>opening blip file explorer...')
})

const help = (() => {
    Help.style.display = 'block'
    shell.stdout('<br>opening blip manual...')
})

let window_click = true

Files.onclick = () => {
    if (!window_click) {
        Files.style.display = 'none'
        shell.stdout(null)
    }
}

Help.onclick = () => {
    if (!window_click) {
        Help.style.display = 'none'
        shell.stdout(null)
    }
}


let fs: dictionary = {
    'ok': 'øk'
}

type dictionary = {
    [key: string]: any
}

const deepCompare = (arg1: dictionary, arg2: dictionary): boolean => {
    if (Object.prototype.toString.call(arg1) === Object.prototype.toString.call(arg2)) {
        if (Object.prototype.toString.call(arg1) === '[object Object]' || Object.prototype.toString.call(arg1) === '[object Array]') {
            if (Object.keys(arg1).length !== Object.keys(arg2).length) {
                return false
            }

            return (Object.keys(arg1).every((key) => deepCompare(arg1[key], arg2[key])))
        }

        return (arg1 === arg2)
    }

    return false
}

var file_name = ''
let files__: dictionary = {}

//@ts-ignore
function getCursorPos(input) {
    //@ts-ignore
    if ("selectionStart" in input && document.activeElement == input) {
        return {
            start: input.selectionStart,
            end: input.selectionEnd
        }
    }
    else if (input.createTextRange) {
        //@ts-ignore
        let sel = document.selection.createRange()

        if (sel.parentElement() === input) {
            let rng = input.createTextRange()
            rng.moveToBookmark(sel.getBookmark())

            let len
            let pos

            for (len = 0; rng.compareEndPoints("EndToStart", rng) > 0; rng.moveEnd("character", -1)) {
                len++
            }

            rng.setEndPoint("StartToStart", input.createTextRange())

            for (pos = { start: 0, end: len }; rng.compareEndPoints("EndToStart", rng) > 0; rng.moveEnd("character", -1)) {
                pos.start++
                pos.end++
            }

            return pos
        }
    }

    return {
        start: -1,
        end: -1
    }
}

//@ts-ignore
function getCaretPosition(editableDiv) {
    var caretPos = 0,
        sel, range;
    //@ts-ignore
    if (window.getSelection) {
        //@ts-ignore
        sel = window.getSelection();
        if (sel.rangeCount) {
            range = sel.getRangeAt(0);
            if (range.commonAncestorContainer.parentNode == editableDiv) {
                caretPos = range.endOffset;
            }
        }
    }
    //@ts-ignore
    else if (document.selection && document.selection.createRange) {
        //@ts-ignore
        range = document.selection.createRange();
        if (range.parentElement() == editableDiv) {
            //@ts-ignore
            var tempEl = document.createElement("span");
            editableDiv.insertBefore(tempEl, editableDiv.firstChild);
            var tempRange = range.duplicate();
            tempRange.moveToElementText(tempEl);
            tempRange.setEndPoint("EndToEnd", range);
            caretPos = tempRange.text.length;
        }
    }
    return caretPos;
}

const switch_file = ((filename: string) => {
    file_name = filename
    if (!files__[filename]) {
        //@ts-ignore
        document.querySelector('Window > textarea').value = shell.filesystem()[filename] || ''
        files__[filename] = ''
    }
})

const opodato = (() => {
    let newfs = { ...shell.filesystem() }
    let suff = (() => {
        //@ts-ignore
        try { return document.querySelector('Window > textarea').value }
        catch { return '' }
    })()

    if (!deepCompare(newfs, fs)) {
        let html = ''
        fs = { ...newfs }

        let files = Object.keys(fs).map(jj => {
            return {
                name: jj,
                data: fs[jj]
            }
        })

        let elements = files.map(jj => {
            return `<thmingji><button onclick="switch_file('${jj.name}')"><span purple>-</span> ${jj.name}</button><X onclick="shell.filesystem('${jj.name}'); file_name = ''; opodato();">x</X></thmingji>`
        })

        if (elements.length == 0) elements = ['<thmingji><button>No files found...</button></thmingji>']

        html += `<bokes><thmingji><button onclick="switch_file(prompt('enter file name:'))"><span green>+</span> new file</button></thmingji>` + elements.join('') + `</bokes><textarea spellcheck="false">${suff}</textarea>`

        let range
        //@ts-ignore
        if (document.querySelector('Window > textarea')) range = getCursorPos(document.querySelector('Window > textarea'))

        Window.innerHTML = html

        if (suff != '') {
            //@ts-ignore
            document.querySelector('Window > textarea').focus()
            //@ts-ignore
            document.querySelector('Window > textarea').setSelectionRange(range.start, range.end)
        }
    }

    if (file_name != '') {
        //@ts-ignore
        shell.write(file_name, document.querySelector('textarea').value)
    }
})

let mouse = true

Terminal.onmouseenter = () => mouse = true
Terminal.onmouseleave = () => mouse = false

let crashed = false

function mulberry32(a: number): () => number {
    return function () {
        let t = a += 0x6D2B79F5
        t = Math.imul(t ^ t >>> 15, t | 1)
        t ^= t + Math.imul(t ^ t >>> 7, t | 61)

        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

//@ts-ignore
Terminal.onkeydown = (e) => {
    let key: string = e.key

    if (Terminal)
        if (mouse) setEndOfContenteditable(Terminal)

    if ((key.length === 1 || key.startsWith('Back')) && !(e.controlKey || e.metaKey) && crashed) return false

    //@ts-ignore
    if ((e.metaKey || e.controlKey) && key === 'r') location.reload()

    if (key === 'Enter') {
        let input = Terminal.innerText.split('~> ')[Terminal.innerText.split('~> ').length - 1]

        // if(input !== '') Terminal.innerHTML = escapeHtml(Terminal.innerHTML.replaceAll(input, `<span blue>${escapeHtml(input)}</span><br>`))

        input = input.toLowerCase()

        if (input === 'sadge') {
            console.log('Sadge triggered.')
            shell.stdout('<br><span cyan>Sorry to hear that.</span>')
            CozyPlace()
        }

        const gen = mulberry32(Math.random() * +new Date)
        const rnd = () => Math.floor(gen() * 255)
        const collar = () => `rgb(${rnd()}, ${rnd()}, ${rnd()})`

        if (input === 'files') files()
        else if (input === 'help') help()
        else if (input === 'explode') {
            crashed = true
            Terminal.setAttribute('contentEditable', 'false')
            shell.stdout('\nEPILEPSY WARNING!\nCLOSE THE WEBSITE NOW IF YOU HAVE EPILEPSY OR ANY TYPE OF PHOTOSENSITIVITY!')
            setTimeout(() => {
                shell.stdout('\nTWO SECONDS LEFT TO CLOSE THE WEBSITE!!')
                setTimeout(() => {
                    setInterval(() => {
                        shell.stdout('\n<span red>Boom!</span>')
                        //@ts-ignore
                        document.querySelectorAll('*').forEach(e => {
                            e.style = 'font-size: ' + (Math.random() * 3) + 'rem !important; color: ' + collar() + '; background-color: ' + collar() + ';'
                        })
                    }, 10)
                }, 2000)
            }, 2000)
        }
        else shell.run(input)

        return true
    }

    if (key.startsWith('Arrow')) return false
    if ((key.startsWith('Back') && Terminal.innerText.endsWith('~> ')) || (key.startsWith('Back') && (e.metaKey || e.controlKey))) return false
    if (key.startsWith('Back') && Terminal.innerHTML.endsWith('<br>')) {
        Terminal.innerHTML = Terminal.innerHTML.substring(0, Terminal.innerHTML.length - 4)
        return false
    }

    if (key.startsWith('Back')) {
        Terminal.innerHTML = Terminal.innerHTML.substring(0, Terminal.innerHTML.length - 1)
        return false
    }

    if (key === 'a' && (e.metaKey || e.controlKey)) return false

    if(!(e.metaKey || e.controlKey) && key.length === 1) {
        Terminal.innerHTML = Terminal.innerHTML + key
        return false
    }
}

//@ts-ignore
document.documentElement.onclick = () => {
    if(!window_click) Terminal.focus()
}

const shell = blip((...e) => {
    if (e[0] === null) {
        Terminal.innerHTML += '<br><span contenteditable="false" red>~> </span> '
        return
    }

    if (e[0]?.startsWith('error: ')) Terminal.innerHTML += `<span red>${e.join(' ').replaceAll('\n', '<br>')}</span><br>`
    else Terminal.innerHTML += e.join(' ').replaceAll('\n', '<br>') + '<br>'

    //@ts-ignore
    window.scrollTo({
        //@ts-ignore
        top: document.body.scrollHeight,
        left: 0,
        behavior: 'smooth'
    })
}, (base = 'false') => {
    Terminal.innerHTML = ''
})

Terminal.focus()

setInterval(opodato, 100)

let tm_data = ''
setInterval(() => {
    if (tm_data !== Terminal.innerHTML) {
        tm_data = Terminal.innerHTML

        Terminal.innerHTML = Terminal.innerHTML.replaceAll(/<span {0,1}[^>]+>[^<]*<br>/g, (f: string) => {
            return f.replaceAll('<br>', '')
        })

        setEndOfContenteditable(Terminal)
    }
}, 10)

//@ts-ignore
window.onerror = (e) => {
    shell.stop()
    shell.stdout('error: KERNEL crashed - <span cyan>Line: ' + shell.line() + '</span>\nCode:\n \n<span purple bold>' + shell.code() + '</span>\n \nReason:\n<span yellow>' + e.toString() + '</span>')
    crashed = true
    Terminal.setAttribute('contentEditable', 'false')
}

Help.innerHTML = Help.innerHTML
    .replaceAll(/blip/gi, (g: string) => '<span bold green>' + g + '</span>')
    .replaceAll('<span bold green>Blip</span> manual', 'Blip manual')
    .replaceAll(/`[^`]+`/g, (g: string) => '<code>' + g.substring(1, g.length - 1) + '</code>')



const CozyPlace = () => setTimeout(() => {
    //@ts-ignore
    let LoFi = new Audio('https://www.chosic.com/wp-content/uploads/2022/04/Cozy-Place-Chill-Background-Music.mp3')

    LoFi.loop = true
    LoFi.play()
})

shell.build(249)