// Generates custom, distinct app icon PNGs for Prasad Chess
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
}

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.slice(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
}

function generateIconPng(size) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // 8 bit
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const rowSize = 1 + size * 4;
    const rawData = Buffer.alloc(rowSize * size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.46;

    for (let y = 0; y < size; y++) {
        const rowOffset = y * rowSize;
        rawData[rowOffset] = 0;

        for (let x = 0; x < size; x++) {
            const px = rowOffset + 1 + x * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Squircle / Shield rounded container
            const dNormX = Math.abs(dx) / r;
            const dNormY = Math.abs(dy) / r;
            const superellipse = Math.pow(dNormX, 3.2) + Math.pow(dNormY, 3.2);

            if (superellipse <= 1.0) {
                const isBorder = (superellipse > 0.86);

                if (isBorder) {
                    // Electric Cyan / Teal gradient border
                    rawData[px] = 0;       // R
                    rawData[px + 1] = 229; // G
                    rawData[px + 2] = 255; // B
                    rawData[px + 3] = 255; // A
                } else {
                    // Deep Royal Midnight Navy gradient
                    let bgR = Math.max(10, Math.floor(15 + (dy / r) * 12));
                    let bgG = Math.max(18, Math.floor(25 + (dy / r) * 15));
                    let bgB = Math.max(42, Math.floor(58 + (dy / r) * 25));

                    // Golden Knight & Crown Emblem in center
                    // Crown top Cross:
                    const isCross = (Math.abs(dx) < r * 0.08 && dy < -r * 0.45 && dy > -r * 0.65) ||
                                    (Math.abs(dy + r * 0.55) < r * 0.07 && Math.abs(dx) < r * 0.22);

                    // Crown peaks
                    const isCrown = (dy >= -r * 0.45 && dy <= -r * 0.22 && (
                        Math.abs(dx) < r * 0.45 - (dy + r * 0.45) * 0.4
                    ));

                    // Knight body & chest
                    const isKnightHead = (dy > -r * 0.22 && dy < r * 0.15 && dx > -r * 0.35 && dx < r * 0.35 && (
                        (dx < 0 && dy > -r * 0.1) || (dx >= 0 && Math.abs(dy) < r * 0.2)
                    ));

                    // Pedestal / Base
                    const isBase = (dy >= r * 0.25 && dy <= r * 0.48 && Math.abs(dx) < (r * 0.55 - (dy - r * 0.25) * 0.2));

                    // Letter "P" cut-out inside the base
                    const isP_Stem = (dy >= r * 0.28 && dy <= r * 0.45 && dx >= -r * 0.14 && dx <= -r * 0.06);
                    const isP_Loop = (dy >= r * 0.28 && dy <= r * 0.37 && dx >= -r * 0.06 && dx <= r * 0.12);
                    const isP_Hole = (dy >= r * 0.31 && dy <= r * 0.34 && dx >= -r * 0.03 && dx <= r * 0.07);
                    const isLetterP = (isP_Stem || isP_Loop) && !isP_Hole;

                    if (isLetterP) {
                        // Diamond White inside P
                        rawData[px] = 255;
                        rawData[px + 1] = 255;
                        rawData[px + 2] = 255;
                        rawData[px + 3] = 255;
                    } else if (isCross || isCrown || isKnightHead || isBase) {
                        // Imperial Gold gradient
                        const goldFactor = 0.5 + 0.5 * ((dx + r) / (2 * r));
                        rawData[px] = Math.floor(255 * (0.8 + 0.2 * goldFactor)); // R
                        rawData[px + 1] = Math.floor(185 * (0.8 + 0.2 * goldFactor)); // G
                        rawData[px + 2] = 20; // B
                        rawData[px + 3] = 255;
                    } else {
                        // Background
                        rawData[px] = bgR;
                        rawData[px + 1] = bgG;
                        rawData[px + 2] = bgB;
                        rawData[px + 3] = 255;
                    }
                }
            } else {
                rawData[px] = 0;
                rawData[px + 1] = 0;
                rawData[px + 2] = 0;
                rawData[px + 3] = 0;
            }
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = makeChunk('IDAT', compressed);
    const ihdrChunk = makeChunk('IHDR', ihdr);
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const icon192 = generateIconPng(192);
const icon512 = generateIconPng(512);
const icon96 = generateIconPng(96);
const icon72 = generateIconPng(72);
const icon48 = generateIconPng(48);

fs.writeFileSync(path.join(__dirname, 'gui/icon.png'), icon192);
fs.writeFileSync(path.join(__dirname, 'icon_192.png'), icon192);
fs.writeFileSync(path.join(__dirname, 'icon_512.png'), icon512);
fs.writeFileSync(path.join(__dirname, 'icon_96.png'), icon96);
fs.writeFileSync(path.join(__dirname, 'icon_72.png'), icon72);
fs.writeFileSync(path.join(__dirname, 'icon_48.png'), icon48);

console.log('Generated brand-new Prasad Chess Royal Cyan & Gold icons (48px - 512px).');
