const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height) {
    // CRC table
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

    // Header
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // 8 bit
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // Raw image data
    // Draw a stylish chess icon: Dark charcoal round rect background, gold chess crown / knight
    const rowSize = 1 + width * 4;
    const rawData = Buffer.alloc(rowSize * height);

    const cx = width / 2;
    const cy = height / 2;
    const r = width * 0.44;

    for (let y = 0; y < height; y++) {
        const rowOffset = y * rowSize;
        rawData[rowOffset] = 0; // filter None
        for (let x = 0; x < width; x++) {
            const px = rowOffset + 1 + x * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= r) {
                // Background gradient
                let bgR = 28 + Math.floor((dy / r) * 10);
                let bgG = 30 + Math.floor((dy / r) * 10);
                let bgB = 38 + Math.floor((dy / r) * 10);

                // Gold crown emblem in center
                const inEmblem = (Math.abs(dx) < r * 0.55 && dy > -r * 0.45 && dy < r * 0.45);
                const isBorder = (dist > r - 4);

                if (isBorder) {
                    rawData[px] = 245;     // R
                    rawData[px + 1] = 166; // G
                    rawData[px + 2] = 35;  // B
                    rawData[px + 3] = 255; // A
                } else if (inEmblem && (
                    // Crown base
                    (dy > r * 0.2 && dy < r * 0.35 && Math.abs(dx) < r * 0.4) ||
                    // Crown peaks
                    (dy <= r * 0.2 && dy > -r * 0.3 && (
                        Math.abs(dx) < r * 0.1 || 
                        Math.abs(dx - r * 0.25) < r * 0.08 || 
                        Math.abs(dx + r * 0.25) < r * 0.08
                    ))
                )) {
                    // Gold
                    rawData[px] = 245;
                    rawData[px + 1] = 190;
                    rawData[px + 2] = 50;
                    rawData[px + 3] = 255;
                } else {
                    rawData[px] = bgR;
                    rawData[px + 1] = bgG;
                    rawData[px + 2] = bgB;
                    rawData[px + 3] = 255;
                }
            } else {
                // Transparent
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

const iconBuf = createPng(192, 192);
const iconPath = path.join(__dirname, 'icon.png');
fs.writeFileSync(iconPath, iconBuf);
console.log('Created ' + iconPath + ' (' + iconBuf.length + ' bytes)');
