"use strict";
const Transpiler = new Bun.Transpiler({
    loader: 'ts'
});
const fs = require('fs');
let old_code = '';
setInterval(() => {
    let blip = fs.readFileSync('blip_cli.ts', 'utf8');
    if (blip !== old_code) {
        try {
            fs.writeFileSync('blip_cli.js', Transpiler.transformSync(blip, {})).code;
            old_code = blip;
        }
        catch (e) {
            // console.log(e)
            // process.exit(1)
        }
    }
}, 50);
