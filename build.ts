import * as fs from 'fs'

const Transpiler = new Bun.Transpiler({
    loader: 'ts'
})

const compile = () => fs.readFileSync('app/main.html', 'utf8')
    .replace('<Typescript />',
        `<script transpiled>/* automatically transpiled from typescript by bun transpiler */\n${Transpiler.transformSync(
            fs.readFileSync('app/blip.ts', 'utf8').replace("export const blip = _blip", '') + '\n' +
            fs.readFileSync('app/app.ts', 'utf8').replace("import { blip } from './blip.js'", '').replace("blip(", "_blip(")
            , {})
        }\n</script>`)

const compiled = compile()

fs.mkdirSync('build/')
fs.writeFileSync('build/index.html', compiled)