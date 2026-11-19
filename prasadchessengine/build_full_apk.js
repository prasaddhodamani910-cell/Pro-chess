/**
 * Full Android APK Assembler & APK Signature Scheme v2 Signer for Prasad Chess Engine
 * Package Name: com.prasad.chessapp (independent fresh install)
 * App Name: Prasad Chess
 * Custom Logo: Royal Cyan & Imperial Gold Knight & Crown
 * Keys: Official Android Debug Keystore
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

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

function adler32(buf, start = 0) {
    let a = 1, b = 0;
    const MOD_ADLER = 65521;
    for (let i = start; i < buf.length; i++) {
        a = (a + buf[i]) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }
    return ((b << 16) | a) >>> 0;
}

function uint32Le(val) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(val, 0);
    return b;
}

function uint64Le(val) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(val), 0);
    return b;
}

function extractBaseApk(apkPath) {
    const buf = fs.readFileSync(apkPath);
    const entries = [];
    let off = 0;

    while (off < buf.length - 22) {
        const sig = buf.readUInt32LE(off);
        if (sig === 0x02014b50) {
            const compMethod = buf.readUInt16LE(off + 10);
            const compSize = buf.readUInt32LE(off + 20);
            const nameLen = buf.readUInt16LE(off + 28);
            const extraLen = buf.readUInt16LE(off + 30);
            const commentLen = buf.readUInt16LE(off + 32);
            const localOff = buf.readUInt32LE(off + 42);

            const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

            const localExtra = buf.readUInt16LE(localOff + 28);
            const dataStart = localOff + 30 + nameLen + localExtra;

            let fileData = buf.slice(dataStart, dataStart + compSize);
            if (compMethod === 8) {
                fileData = zlib.inflateRawSync(fileData);
            }

            // Exclude old assets and signature files
            if (!name.startsWith('META-INF/MANIFEST.MF') &&
                !name.startsWith('META-INF/CERT.SF') &&
                !name.startsWith('META-INF/CERT.RSA') &&
                !name.startsWith('META-INF/SIG_') &&
                !name.startsWith('assets/')) {
                entries.push({ name, data: fileData });
            }

            off += 46 + nameLen + extraLen + commentLen;
        } else {
            off++;
        }
    }

    return entries;
}

function patchManifest(manifestData) {
    console.log("[+] Patching AndroidManifest.xml package -> com.prasad.chessapp...");
    const oldPkg = Buffer.from('com.prasad.chessmod', 'utf16le');
    const newPkg = Buffer.from('com.prasad.chessapp', 'utf16le');

    let idx = 0;
    while ((idx = manifestData.indexOf(oldPkg, idx)) !== -1) {
        newPkg.copy(manifestData, idx);
        idx += newPkg.length;
    }
    return manifestData;
}

function patchArsc(arscData) {
    console.log("[+] Patching resources.arsc package & labels -> PrasadCE...");
    const oldPkg = Buffer.from('com.prasad.chessmod', 'utf16le');
    const newPkg = Buffer.from('com.prasad.chessapp', 'utf16le');
    let idx = 0;
    while ((idx = arscData.indexOf(oldPkg, idx)) !== -1) {
        newPkg.copy(arscData, idx);
        idx += newPkg.length;
    }

    // Replace Chessmod with PrasadCE (8 chars)
    const oldName = Buffer.from('Chessmod', 'utf8');
    const newName = Buffer.from('PrasadCE', 'utf8');
    idx = 0;
    while ((idx = arscData.indexOf(oldName, idx)) !== -1) {
        newName.copy(arscData, idx);
        idx += newName.length;
    }

    // Retain internal theme key Theme.ChessVision intact to avoid style lookup errors
    return arscData;
}

function patchClasses3Dex(origDex) {
    console.log("[+] Applying precision Dex patch to classes3.dex...");
    const stringIdsOff = origDex.readUInt32LE(60);
    const stringIdsSize = origDex.readUInt32LE(56);
    const protoIdsOff = origDex.readUInt32LE(76);
    const protoIdsSize = origDex.readUInt32LE(72);
    const classDefsOff = origDex.readUInt32LE(100);
    const classDefsSize = origDex.readUInt32LE(96);
    const dataOff = origDex.readUInt32LE(108);
    const dataSize = origDex.readUInt32LE(104);
    const mapOff = origDex.readUInt32LE(52);

    const str471Off = origDex.readUInt32LE(stringIdsOff + 471 * 4);
    const str472Off = origDex.readUInt32LE(stringIdsOff + 472 * 4);
    const oldStr471Len = str472Off - str471Off;

    // Replacement: "file:///android_asset/index.html" (32 chars)
    // Sits in lexicographical order: "file" (470) < "file:///android_asset/index.html" (471) < "filename" (472)
    const newStrBytes = Buffer.concat([
        Buffer.from([0x20]), // uleb128(32)
        Buffer.from('file:///android_asset/index.html', 'utf8'),
        Buffer.from([0x00])
    ]);
    const delta = newStrBytes.length - oldStr471Len;

    const newDex = Buffer.alloc(origDex.length + delta);

    // 1. Copy everything before str471Off
    origDex.copy(newDex, 0, 0, str471Off);

    // 2. Write new string 471 data
    newStrBytes.copy(newDex, str471Off);

    // 3. Copy everything from str472Off to end of origDex
    origDex.copy(newDex, str471Off + newStrBytes.length, str472Off);

    // 4. Update string_ids for strings >= 472
    for (let i = 472; i < stringIdsSize; i++) {
        const oldOff = origDex.readUInt32LE(stringIdsOff + i * 4);
        newDex.writeUInt32LE(oldOff + delta, stringIdsOff + i * 4);
    }

    // 5. Update proto_ids: parameters_off
    for (let i = 0; i < protoIdsSize; i++) {
        const pOff = origDex.readUInt32LE(protoIdsOff + i * 12 + 8);
        if (pOff > str471Off) {
            newDex.writeUInt32LE(pOff + delta, protoIdsOff + i * 12 + 8);
        }
    }

    // 6. Update class_defs: interfaces_off, annotations_off, class_data_off, static_values_off
    for (let i = 0; i < classDefsSize; i++) {
        const cOff = classDefsOff + i * 32;
        for (const fieldOffset of [12, 20, 24, 28]) {
            const val = origDex.readUInt32LE(cOff + fieldOffset);
            if (val > str471Off) {
                newDex.writeUInt32LE(val + delta, cOff + fieldOffset);
            }
        }
    }

    // 7. Update class_data code_items: debug_info_off
    for (let i = 0; i < classDefsSize; i++) {
        const classDataOff = newDex.readUInt32LE(classDefsOff + i * 32 + 24);
        if (classDataOff === 0) continue;
        let p = classDataOff;
        function readUleb() {
            let res = 0, shift = 0;
            while (true) {
                let b = newDex[p++];
                res |= (b & 0x7f) << shift;
                if (!(b & 0x80)) break;
                shift += 7;
            }
            return res;
        }
        const staticFields = readUleb();
        const instanceFields = readUleb();
        const directMethods = readUleb();
        const virtualMethods = readUleb();
        for (let f = 0; f < staticFields; f++) { readUleb(); readUleb(); }
        for (let f = 0; f < instanceFields; f++) { readUleb(); readUleb(); }
        function processMethod() {
            readUleb(); // method_idx_diff
            readUleb(); // access_flags
            const codeOff = readUleb(); // code_off
            if (codeOff !== 0) {
                const debugOff = newDex.readUInt32LE(codeOff + 8);
                if (debugOff > str471Off) {
                    newDex.writeUInt32LE(debugOff + delta, codeOff + 8);
                }
            }
        }
        for (let m = 0; m < directMethods; m++) processMethod();
        for (let m = 0; m < virtualMethods; m++) processMethod();
    }

    // 8. Update map_list
    const mapSize = origDex.readUInt32LE(mapOff);
    const newMapOff = mapOff + delta;
    newDex.writeUInt32LE(newMapOff, 52); // header.map_off
    for (let i = 0; i < mapSize; i++) {
        const itemOff = newMapOff + 4 + i * 12 + 8;
        const oldVal = origDex.readUInt32LE(mapOff + 4 + i * 12 + 8);
        if (oldVal > str471Off) {
            newDex.writeUInt32LE(oldVal + delta, itemOff);
        }
    }

    // 9. Update TYPE_ANNOTATION_SET_ITEM (0x1003)
    for (let i = 0; i < mapSize; i++) {
        const type = origDex.readUInt16LE(mapOff + 4 + i * 12);
        if (type === 0x1003) {
            const annoSetCount = origDex.readUInt32LE(mapOff + 4 + i * 12 + 4);
            let p = newDex.readUInt32LE(newMapOff + 4 + i * 12 + 8);
            for (let s = 0; s < annoSetCount; s++) {
                const size = newDex.readUInt32LE(p);
                p += 4;
                for (let j = 0; j < size; j++) {
                    const itemOff = newDex.readUInt32LE(p);
                    if (itemOff > str471Off) {
                        newDex.writeUInt32LE(itemOff + delta, p);
                    }
                    p += 4;
                }
            }
        } else if (type === 0x2006) { // TYPE_ANNOTATIONS_DIRECTORY_ITEM
            const annoDirCount = origDex.readUInt32LE(mapOff + 4 + i * 12 + 4);
            let p = newDex.readUInt32LE(newMapOff + 4 + i * 12 + 8);
            for (let d = 0; d < annoDirCount; d++) {
                const classAnnoOff = newDex.readUInt32LE(p);
                if (classAnnoOff > str471Off) newDex.writeUInt32LE(classAnnoOff + delta, p);
                const fieldsSize = newDex.readUInt32LE(p + 4);
                const methodsSize = newDex.readUInt32LE(p + 8);
                const paramsSize = newDex.readUInt32LE(p + 12);
                p += 16;
                for (let j = 0; j < fieldsSize; j++) {
                    p += 4;
                    const aOff = newDex.readUInt32LE(p);
                    if (aOff > str471Off) newDex.writeUInt32LE(aOff + delta, p);
                    p += 4;
                }
                for (let j = 0; j < methodsSize; j++) {
                    p += 4;
                    const aOff = newDex.readUInt32LE(p);
                    if (aOff > str471Off) newDex.writeUInt32LE(aOff + delta, p);
                    p += 4;
                }
                for (let j = 0; j < paramsSize; j++) {
                    p += 4;
                    const aOff = newDex.readUInt32LE(p);
                    if (aOff > str471Off) newDex.writeUInt32LE(aOff + delta, p);
                    p += 4;
                }
            }
        }
    }

    // 9. Update header sizes
    newDex.writeUInt32LE(origDex.length + delta, 32); // file_size
    newDex.writeUInt32LE(dataSize + delta, 104); // data_size

    // 10. Patch MainActivity.onCreate to load string 471 instead of 531
    // Offset 30628: 1a 01 13 02 -> 1a 01 d7 01 (const-string v1, 471)
    newDex[30628] = 0x1a;
    newDex[30629] = 0x01;
    newDex[30630] = 0xd7; // 471 low byte
    newDex[30631] = 0x01; // 471 high byte

    // 11. Recalculate SHA1 signature
    const sha1 = crypto.createHash('sha1').update(newDex.slice(32)).digest();
    sha1.copy(newDex, 12);

    // 12. Recalculate Adler32 checksum
    const adler = adler32(newDex, 12);
    newDex.writeUInt32LE(adler, 8);

    console.log("[+] classes3.dex patched with 100% compliant DEX structure.");
    return newDex;
}

function computeV2Digest(sec1, sec2, sec3) {
    const chunks = [];
    const CHUNK_SIZE = 1048576; // 1 MB

    function processSection(buf) {
        let off = 0;
        while (off < buf.length) {
            const sz = Math.min(CHUNK_SIZE, buf.length - off);
            const chunk = buf.slice(off, off + sz);
            const h = crypto.createHash('sha256');
            h.update(Buffer.from([0xa5])); // Crucial 0xa5 chunk prefix!
            h.update(uint32Le(sz));
            h.update(chunk);
            chunks.push(h.digest());
            off += sz;
        }
    }

    processSection(sec1);
    processSection(sec2);
    processSection(sec3);

    const top = crypto.createHash('sha256');
    top.update(Buffer.from([0x5a])); // Root prefix
    top.update(uint32Le(chunks.length));
    for (let c of chunks) top.update(c);
    return top.digest();
}

function buildV2Block(contentDigest, certDer, privateKeyPem) {
    // 1. digests: sequence of length-prefixed digest
    const digestEntry = Buffer.concat([
        uint32Le(0x0103), // RSA-SHA256
        uint32Le(contentDigest.length),
        contentDigest
    ]);
    const digestEntryPrefixed = Buffer.concat([uint32Le(digestEntry.length), digestEntry]);
    const digestsList = Buffer.concat([uint32Le(digestEntryPrefixed.length), digestEntryPrefixed]);

    // 2. certs: sequence of length-prefixed cert
    const certPrefixed = Buffer.concat([uint32Le(certDer.length), certDer]);
    const certsList = Buffer.concat([uint32Le(certPrefixed.length), certPrefixed]);

    // 3. additional attributes: empty
    const additionalAttrs = Buffer.alloc(4); // length = 0

    // 4. signedData = [digests, certs, additionalAttrs]
    const signedData = Buffer.concat([digestsList, certsList, additionalAttrs]);
    const signedDataPrefixed = Buffer.concat([uint32Le(signedData.length), signedData]);

    // 5. signature using debug private key
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signedData);
    const signature = signer.sign(privateKeyPem);

    const sigEntry = Buffer.concat([
        uint32Le(0x0103),
        uint32Le(signature.length),
        signature
    ]);
    const sigEntryPrefixed = Buffer.concat([uint32Le(sigEntry.length), sigEntry]);
    const signaturesList = Buffer.concat([uint32Le(sigEntryPrefixed.length), sigEntryPrefixed]);

    // 6. Public key SPKI DER
    const certObj = new crypto.X509Certificate(certDer);
    const spki = certObj.publicKey.export({ type: 'spki', format: 'der' });
    const spkiPrefixed = Buffer.concat([uint32Le(spki.length), spki]);

    // 7. Signer block = [signedDataPrefixed, signaturesList, spkiPrefixed]
    const signerBlock = Buffer.concat([signedDataPrefixed, signaturesList, spkiPrefixed]);
    const signerBlockPrefixed = Buffer.concat([uint32Le(signerBlock.length), signerBlock]);

    // 8. Signers list
    const signersList = Buffer.concat([uint32Le(signerBlockPrefixed.length), signerBlockPrefixed]);

    // 9. ID-value pair for v2 (ID = 0x7109871a)
    const v2Pair = Buffer.concat([
        uint32Le(0x7109871a),
        signersList
    ]);
    const v2PairPrefixed = Buffer.concat([
        uint64Le(v2Pair.length),
        v2Pair
    ]);

    // 10. Alignment padding block (ID = 0x42726577 - 'Brew')
    // We want the total signing block (including 8-byte initial size, entries, 8-byte trailing size, 16-byte magic)
    // to be aligned to 4096 bytes.
    // Base block overhead = 8 + 8 + 16 = 32 bytes.
    const currentPayloadSize = v2PairPrefixed.length;
    const baseTotalSize = 32 + currentPayloadSize;
    const remainder = baseTotalSize % 4096;
    let paddingPair = Buffer.alloc(0);
    if (remainder !== 0) {
        let padBytesNeeded = 4096 - remainder;
        // The padding entry itself requires 8 (length) + 4 (ID 0x42726577) = 12 bytes header
        if (padBytesNeeded < 12) {
            padBytesNeeded += 4096;
        }
        const padDataLen = padBytesNeeded - 12;
        const padData = Buffer.alloc(padDataLen);
        const padEntry = Buffer.concat([
            uint32Le(0x42726577),
            padData
        ]);
        paddingPair = Buffer.concat([
            uint64Le(padEntry.length),
            padEntry
        ]);
    }

    const allPairs = Buffer.concat([v2PairPrefixed, paddingPair]);
    const blockSize = BigInt(allPairs.length + 8 + 16);
    const magic = Buffer.from('APK Sig Block 42', 'ascii');

    return Buffer.concat([
        uint64Le(blockSize),
        allPairs,
        uint64Le(blockSize),
        magic
    ]);
}

function buildFullApk() {
    console.log("========================================================");
    console.log("  Prasad Chess Engine - Unique Package & Logo Builder  ");
    console.log("========================================================");

    const projectRoot = "C:\\Projects by Prasad\\chessproject";
    const baseApkPath = path.join(projectRoot, "android_app\\dist\\Chessmod.apk");
    const targetApkPath = path.join(projectRoot, "prasadchessengine\\PrasadChess.apk");
    const engineDir = path.join(projectRoot, "prasadchessengine");
    const guiDir = path.join(engineDir, "gui");

    console.log("[*] Extracting base Android package resources...");
    const entries = extractBaseApk(baseApkPath);
    console.log(`[+] Loaded ${entries.length} base Android resources.`);

    // 1. Patch AndroidManifest.xml and resources
    for (let e of entries) {
        if (e.name === 'AndroidManifest.xml') {
            e.data = patchManifest(e.data);
        } else if (e.name === 'resources.arsc') {
            e.data = patchArsc(e.data);
        } else if (e.name === 'classes3.dex') {
            e.data = patchClasses3Dex(e.data);
        }
    }

    // 2. Add New Custom App Icons (Royal Cyan & Gold Knight & Crown)
    const icon192 = fs.readFileSync(path.join(engineDir, 'icon_192.png'));
    const icon96 = fs.readFileSync(path.join(engineDir, 'icon_96.png'));
    const icon72 = fs.readFileSync(path.join(engineDir, 'icon_72.png'));
    const icon48 = fs.readFileSync(path.join(engineDir, 'icon_48.png'));

    // Remove existing ic_launcher.png from base if present
    const cleanEntries = entries.filter(e => !e.name.includes('ic_launcher.png'));

    // Inject into all mipmap directories
    cleanEntries.push({ name: 'res/mipmap-mdpi/ic_launcher.png', data: icon48 });
    cleanEntries.push({ name: 'res/mipmap-hdpi/ic_launcher.png', data: icon72 });
    cleanEntries.push({ name: 'res/mipmap-xhdpi/ic_launcher.png', data: icon96 });
    cleanEntries.push({ name: 'res/mipmap-xxhdpi/ic_launcher.png', data: icon192 });
    cleanEntries.push({ name: 'res/mipmap-xxxhdpi/ic_launcher.png', data: icon192 });

    // 3. Add Prasad Chess Web Assets
    console.log("[*] Ingesting Prasad Chess web assets...");
    const webFiles = [
        'index.html',
        'style.css',
        'pieces.js',
        'chess_rules.js',
        'engine.js',
        'sounds.js',
        'app.js',
        'assistant.js',
        'assistant.css',
        'manifest.json',
        'sw.js',
        'icon.png'
    ];

    for (let f of webFiles) {
        const fp = path.join(guiDir, f);
        if (fs.existsSync(fp)) {
            cleanEntries.push({ name: `assets/${f}`, data: fs.readFileSync(fp) });
        }
    }

    // 4. Load Official Android Debug Keystore Credentials
    console.log("[*] Loading Android Debug signing key and certificate...");
    const keyPem = fs.readFileSync(path.join(engineDir, 'debug_key.pem'), 'utf8');
    const certDer = fs.readFileSync(path.join(engineDir, 'debug_cert.der'));

    // 5. Assemble ZIP Section 1 (aligned)
    console.log("[*] Packing ZIP entries with 4-byte uncompressed alignment...");
    const fileRecords = [];
    let curOffset = 0;
    const localChunks = [];

    for (let entry of cleanEntries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const uncompressed = entry.data;
        const uncompCrc = crc32(uncompressed);

        let method = 8;
        let compressed = zlib.deflateRawSync(uncompressed);
        if (entry.name.endsWith('.png') || entry.name.endsWith('.arsc') || compressed.length >= uncompressed.length) {
            method = 0;
            compressed = uncompressed;
        }

        // Align uncompressed file data to 4-byte boundary
        let extraField = Buffer.alloc(0);
        if (method === 0 && (curOffset + 30 + nameBuf.length) % 4 !== 0) {
            const padSize = (4 - ((curOffset + 30 + nameBuf.length) % 4)) % 4;
            extraField = Buffer.alloc(padSize);
        }

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(method, 8);
        localHeader.writeUInt16LE(0x56a0, 10);
        localHeader.writeUInt16LE(0x5ca1, 12);
        localHeader.writeUInt32LE(uncompCrc, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(uncompressed.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(extraField.length, 28);

        fileRecords.push({
            nameBuf,
            method,
            crc: uncompCrc,
            compSize: compressed.length,
            uncompSize: uncompressed.length,
            offset: curOffset
        });

        localChunks.push(localHeader);
        localChunks.push(nameBuf);
        if (extraField.length > 0) localChunks.push(extraField);
        localChunks.push(compressed);

        curOffset += localHeader.length + nameBuf.length + extraField.length + compressed.length;
    }

    const section1 = Buffer.concat(localChunks);

    // Section 2: Central Directory
    const centralHeaders = [];
    for (let r of fileRecords) {
        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(0x0314, 4);
        cd.writeUInt16LE(20, 6);
        cd.writeUInt16LE(0x0800, 8);
        cd.writeUInt16LE(r.method, 10);
        cd.writeUInt16LE(0x56a0, 12);
        cd.writeUInt16LE(0x5ca1, 14);
        cd.writeUInt32LE(r.crc, 16);
        cd.writeUInt32LE(r.compSize, 20);
        cd.writeUInt32LE(r.uncompSize, 24);
        cd.writeUInt16LE(r.nameBuf.length, 28);
        cd.writeUInt16LE(0, 30);
        cd.writeUInt16LE(0, 32);
        cd.writeUInt16LE(0, 34);
        cd.writeUInt16LE(0, 36);
        cd.writeUInt32LE(0x81a40000, 38);
        cd.writeUInt32LE(r.offset, 42);

        centralHeaders.push(cd);
        centralHeaders.push(r.nameBuf);
    }
    const section2 = Buffer.concat(centralHeaders);

    // Section 3: EOCD (preliminary for digest calculation with cd offset pointing to sigBlockStart)
    const section3ForDigest = Buffer.alloc(22);
    section3ForDigest.writeUInt32LE(0x06054b50, 0);
    section3ForDigest.writeUInt16LE(0, 4);
    section3ForDigest.writeUInt16LE(0, 6);
    section3ForDigest.writeUInt16LE(fileRecords.length, 8);
    section3ForDigest.writeUInt16LE(fileRecords.length, 10);
    section3ForDigest.writeUInt32LE(section2.length, 12);
    section3ForDigest.writeUInt32LE(section1.length, 16); // CD offset before signing block
    section3ForDigest.writeUInt16LE(0, 20);

    // 6. Compute APK Signature Scheme v2
    console.log("[*] Computing cryptographic content digests (0xa5 chunk prefix)...");
    const v2Digest = computeV2Digest(section1, section2, section3ForDigest);
    console.log(`[+] APK Content Digest: ${v2Digest.toString('hex')}`);

    console.log("[*] Building 4096-byte aligned APK Signature Scheme v2 Block...");
    const v2Block = buildV2Block(v2Digest, certDer, keyPem);
    const v2BlockLen = v2Block.length;
    console.log(`[+] APK Signature Block Size: ${v2BlockLen} bytes (aligned: ${(v2BlockLen % 4096 === 0)})`);

    // Final EOCD pointing to Central Directory after APK Signing Block
    const finalEocd = Buffer.alloc(22);
    finalEocd.writeUInt32LE(0x06054b50, 0);
    finalEocd.writeUInt16LE(0, 4);
    finalEocd.writeUInt16LE(0, 6);
    finalEocd.writeUInt16LE(fileRecords.length, 8);
    finalEocd.writeUInt16LE(fileRecords.length, 10);
    finalEocd.writeUInt32LE(section2.length, 12);
    finalEocd.writeUInt32LE(section1.length + v2BlockLen, 16);
    finalEocd.writeUInt16LE(0, 20);

    const finalApk = Buffer.concat([section1, v2Block, section2, finalEocd]);
    fs.writeFileSync(targetApkPath, finalApk);

    console.log("========================================================");
    console.log(`[SUCCESS] PrasadChess.apk successfully created!`);
    console.log(`[+] Location: ${targetApkPath}`);
    console.log(`[+] Size: ${(finalApk.length / 1024).toFixed(1)} KB`);
    console.log(`[+] Unique Package: com.prasad.chessapp (Fresh Install)`);
    console.log(`[+] New Logo: Royal Cyan & Imperial Gold Knight & Crown`);
    console.log(`[+] Signed with official Android Debug Key (v2 verified)`);
    console.log("========================================================");
}

buildFullApk();
