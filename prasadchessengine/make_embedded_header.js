// Converts files in gui/ to a C++ header gui_embedded.h
const fs = require('fs');
const path = require('path');

const guiDir = path.join(__dirname, 'gui');
const files = [
    'index.html',
    'style.css',
    'pieces.js',
    'chess_rules.js',
    'engine.js',
    'sounds.js',
    'app.js',
    'manifest.json',
    'sw.js',
    'icon.png'
];

let header = '#pragma once\n#include <string>\n#include <unordered_map>\n#include <vector>\n\n';
header += 'struct EmbeddedFile {\n    std::string mime;\n    std::vector<unsigned char> data;\n};\n\n';
header += 'inline const std::unordered_map<std::string, EmbeddedFile>& get_embedded_assets() {\n';
header += '    static const std::unordered_map<std::string, EmbeddedFile> assets = {\n';

function getMime(filename) {
    if (filename.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filename.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filename.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filename.endsWith('.json')) return 'application/json';
    if (filename.endsWith('.png')) return 'image/png';
    return 'text/plain';
}

for (let f of files) {
    const fp = path.join(guiDir, f);
    if (!fs.existsSync(fp)) continue;
    const buf = fs.readFileSync(fp);
    const mime = getMime(f);

    header += `        {"/${f}", {"${mime}", {`;
    const hexBytes = [];
    for (let i = 0; i < buf.length; i++) {
        hexBytes.push('0x' + buf[i].toString(16));
    }
    header += hexBytes.join(',') + '}}},\n';
}

header += '    };\n    return assets;\n}\n';

const outPath = path.join(__dirname, 'gui_embedded.h');
fs.writeFileSync(outPath, header);
console.log('Generated gui_embedded.h successfully (' + (header.length / 1024).toFixed(1) + ' KB)');
