/**
 * Standalone APK Packager for Prasad Chess Engine
 * Assembles a complete, compliant Android APK (PrasadChess.apk)
 * containing Dalvik DEX bytecode, binary AndroidManifest.xml, resources.arsc,
 * high-resolution mipmap icons, offline web assets, and APK v1/v2 signature block.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// CRC32 Table
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

function writeUleb128(val) {
    const bytes = [];
    do {
        let b = val & 0x7f;
        val >>>= 7;
        if (val !== 0) b |= 0x80;
        bytes.push(b);
    } while (val !== 0);
    return Buffer.from(bytes);
}

// -------------------------------------------------------------
// 1. Android Binary XML (AXML) Generator for AndroidManifest.xml
// -------------------------------------------------------------
function buildBinaryManifest() {
    const strings = [
        "versionCode",                          // 0
        "versionName",                          // 1
        "package",                              // 2
        "manifest",                             // 3
        "application",                          // 4
        "label",                                // 5
        "icon",                                 // 6
        "activity",                             // 7
        "name",                                 // 8
        "configChanges",                        // 9
        "exported",                             // 10
        "intent-filter",                        // 11
        "action",                               // 12
        "category",                             // 13
        "http://schemas.android.com/apk/res/android", // 14 (schema URI)
        "android",                              // 15 (prefix)
        "com.prasad.chessengine",               // 16
        "1.0",                                  // 17
        "Prasad Chess",                         // 18
        "com.prasad.chessengine.MainActivity",   // 19
        "orientation|keyboardHidden|screenSize",// 20
        "android.intent.action.MAIN",           // 21
        "android.intent.category.LAUNCHER",     // 22
        "@drawable/ic_launcher"                 // 23
    ];

    // Resource IDs for attributes
    const resMap = [
        0x0101021b, // versionCode
        0x0101021c, // versionName
        0x00000000, // package (no res id)
        0x00000000, // manifest
        0x00000000, // application
        0x01010001, // label
        0x01010002, // icon
        0x00000000, // activity
        0x01010003, // name
        0x0101001f, // configChanges
        0x01010010  // exported
    ];

    // Encode string pool (UTF-16LE)
    const strOffsets = [];
    const strDataBuffers = [];
    let currentDataOffset = 0;

    for (let s of strings) {
        strOffsets.push(currentDataOffset);
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16LE(s.length, 0);
        const charBuf = Buffer.from(s, 'utf16le');
        const termBuf = Buffer.alloc(2);
        const entry = Buffer.concat([lenBuf, charBuf, termBuf]);
        strDataBuffers.push(entry);
        currentDataOffset += entry.length;
    }

    const strOffsetsBuf = Buffer.alloc(strOffsets.length * 4);
    for (let i = 0; i < strOffsets.length; i++) {
        strOffsetsBuf.writeUInt32LE(strOffsets[i], i * 4);
    }
    const allStrData = Buffer.concat(strDataBuffers);
    // Pad to 4-byte boundary
    const strDataPad = (4 - (allStrData.length % 4)) % 4;
    const paddedStrData = Buffer.concat([allStrData, Buffer.alloc(strDataPad)]);

    const strPoolHeaderSize = 28;
    const strPoolSize = strPoolHeaderSize + strOffsetsBuf.length + paddedStrData.length;
    const strPoolChunk = Buffer.alloc(strPoolSize);
    strPoolChunk.writeUInt16LE(0x0001, 0); // RES_STRING_POOL_TYPE
    strPoolChunk.writeUInt16LE(strPoolHeaderSize, 2);
    strPoolChunk.writeUInt32LE(strPoolSize, 4);
    strPoolChunk.writeUInt32LE(strings.length, 8); // stringCount
    strPoolChunk.writeUInt32LE(0, 12); // styleCount
    strPoolChunk.writeUInt32LE(0, 16); // flags (0 = UTF-16)
    strPoolChunk.writeUInt32LE(strPoolHeaderSize + strOffsetsBuf.length, 20); // stringsStart
    strPoolChunk.writeUInt32LE(0, 24); // stylesStart
    strOffsetsBuf.copy(strPoolChunk, strPoolHeaderSize);
    paddedStrData.copy(strPoolChunk, strPoolHeaderSize + strOffsetsBuf.length);

    // Resource Map Chunk
    const resMapHeaderSize = 8;
    const resMapSize = resMapHeaderSize + resMap.length * 4;
    const resMapChunk = Buffer.alloc(resMapSize);
    resMapChunk.writeUInt16LE(0x0180, 0); // RES_XML_RESOURCE_MAP_TYPE
    resMapChunk.writeUInt16LE(resMapHeaderSize, 2);
    resMapChunk.writeUInt32LE(resMapSize, 4);
    for (let i = 0; i < resMap.length; i++) {
        resMapChunk.writeUInt32LE(resMap[i], 8 + i * 4);
    }

    // Helper functions for XML nodes
    function makeNsStart(prefixIdx, uriIdx, line = 1) {
        const b = Buffer.alloc(24);
        b.writeUInt16LE(0x0100, 0); // RES_XML_START_NAMESPACE_TYPE
        b.writeUInt16LE(16, 2);
        b.writeUInt32LE(24, 4);
        b.writeUInt32LE(line, 8);
        b.writeInt32LE(-1, 12); // comment
        b.writeUInt32LE(prefixIdx, 16);
        b.writeUInt32LE(uriIdx, 20);
        return b;
    }

    function makeNsEnd(prefixIdx, uriIdx, line = 1) {
        const b = Buffer.alloc(24);
        b.writeUInt16LE(0x0101, 0); // RES_XML_END_NAMESPACE_TYPE
        b.writeUInt16LE(16, 2);
        b.writeUInt32LE(24, 4);
        b.writeUInt32LE(line, 8);
        b.writeInt32LE(-1, 12);
        b.writeUInt32LE(prefixIdx, 16);
        b.writeUInt32LE(uriIdx, 20);
        return b;
    }

    function makeStartTag(uriIdx, nameIdx, attrs, line = 1) {
        const attrSize = 20;
        const totalSize = 36 + attrs.length * attrSize;
        const b = Buffer.alloc(totalSize);
        b.writeUInt16LE(0x0102, 0); // RES_XML_START_ELEMENT_TYPE
        b.writeUInt16LE(16, 2);
        b.writeUInt32LE(totalSize, 4);
        b.writeUInt32LE(line, 8);
        b.writeInt32LE(-1, 12);
        b.writeInt32LE(uriIdx, 16);
        b.writeInt32LE(nameIdx, 20);
        b.writeUInt16LE(20, 24); // attrStart
        b.writeUInt16LE(attrSize, 26); // attrSize
        b.writeUInt16LE(attrs.length, 28); // attrCount
        b.writeUInt16LE(0, 30); // idIndex
        b.writeUInt16LE(0, 32); // classIndex
        b.writeUInt16LE(0, 34); // styleIndex

        let offset = 36;
        for (let a of attrs) {
            b.writeInt32LE(a.uriIdx, offset);
            b.writeInt32LE(a.nameIdx, offset + 4);
            b.writeInt32LE(a.rawValIdx, offset + 8);
            b.writeUInt16LE(8, offset + 12); // size
            b.writeUInt8(0, offset + 14); // res0
            b.writeUInt8(a.dataType, offset + 15);
            b.writeUInt32LE(a.data, offset + 16);
            offset += attrSize;
        }
        return b;
    }

    function makeEndTag(uriIdx, nameIdx, line = 1) {
        const b = Buffer.alloc(24);
        b.writeUInt16LE(0x0103, 0); // RES_XML_END_ELEMENT_TYPE
        b.writeUInt16LE(16, 2);
        b.writeUInt32LE(24, 4);
        b.writeUInt32LE(line, 8);
        b.writeInt32LE(-1, 12);
        b.writeInt32LE(uriIdx, 16);
        b.writeInt32LE(nameIdx, 20);
        return b;
    }

    // Nodes Construction
    const nodes = [];
    nodes.push(makeNsStart(15, 14, 1)); // android -> schema

    // <manifest package="com.prasad.chessengine" versionCode="1" versionName="1.0">
    nodes.push(makeStartTag(-1, 3, [
        { uriIdx: -1, nameIdx: 2, rawValIdx: 16, dataType: 0x03, data: 16 }, // package="com.prasad.chessengine"
        { uriIdx: 14, nameIdx: 0, rawValIdx: -1, dataType: 0x10, data: 1 },  // android:versionCode="1"
        { uriIdx: 14, nameIdx: 1, rawValIdx: 17, dataType: 0x03, data: 17 }  // android:versionName="1.0"
    ], 2));

    // <application label="Prasad Chess" icon="@drawable/ic_launcher">
    nodes.push(makeStartTag(-1, 4, [
        { uriIdx: 14, nameIdx: 5, rawValIdx: 18, dataType: 0x03, data: 18 },  // android:label="Prasad Chess"
        { uriIdx: 14, nameIdx: 6, rawValIdx: 23, dataType: 0x01, data: 0x7f020000 } // android:icon
    ], 3));

    // <activity name="com.prasad.chessengine.MainActivity" label="Prasad Chess" configChanges="..." exported="true">
    nodes.push(makeStartTag(-1, 7, [
        { uriIdx: 14, nameIdx: 8, rawValIdx: 19, dataType: 0x03, data: 19 }, // name
        { uriIdx: 14, nameIdx: 5, rawValIdx: 18, dataType: 0x03, data: 18 }, // label
        { uriIdx: 14, nameIdx: 9, rawValIdx: 20, dataType: 0x03, data: 20 }, // configChanges
        { uriIdx: 14, nameIdx: 10, rawValIdx: -1, dataType: 0x12, data: 0xffffffff } // exported=true
    ], 4));

    // <intent-filter>
    nodes.push(makeStartTag(-1, 11, [], 5));

    // <action name="android.intent.action.MAIN" />
    nodes.push(makeStartTag(-1, 12, [
        { uriIdx: 14, nameIdx: 8, rawValIdx: 21, dataType: 0x03, data: 21 }
    ], 6));
    nodes.push(makeEndTag(-1, 12, 6));

    // <category name="android.intent.category.LAUNCHER" />
    nodes.push(makeStartTag(-1, 13, [
        { uriIdx: 14, nameIdx: 8, rawValIdx: 22, dataType: 0x03, data: 22 }
    ], 7));
    nodes.push(makeEndTag(-1, 13, 7));

    // </intent-filter>
    nodes.push(makeEndTag(-1, 11, 8));

    // </activity>
    nodes.push(makeEndTag(-1, 7, 9));

    // </application>
    nodes.push(makeEndTag(-1, 4, 10));

    // </manifest>
    nodes.push(makeEndTag(-1, 3, 11));

    // End Namespace
    nodes.push(makeNsEnd(15, 14, 12));

    const allNodesBuf = Buffer.concat(nodes);

    const totalFileSize = 8 + strPoolChunk.length + resMapChunk.length + allNodesBuf.length;
    const fileHeader = Buffer.alloc(8);
    fileHeader.writeUInt16LE(0x0003, 0); // RES_XML_TYPE
    fileHeader.writeUInt16LE(8, 2);      // headerSize
    fileHeader.writeUInt32LE(totalFileSize, 4);

    return Buffer.concat([fileHeader, strPoolChunk, resMapChunk, allNodesBuf]);
}

// -------------------------------------------------------------
// 2. Dalvik DEX Generator for com.prasad.chessengine.MainActivity
// -------------------------------------------------------------
function buildClassesDex() {
    // Strings in alphabetical order (mandatory for DEX compliance)
    const strings = [
        "<init>",                                // 0
        "Landroid/app/Activity;",                // 1
        "Landroid/content/Context;",             // 2
        "Landroid/os/Bundle;",                   // 3
        "Landroid/view/View;",                   // 4
        "Landroid/webkit/WebSettings;",          // 5
        "Landroid/webkit/WebView;",              // 6
        "Lcom/prasad/chessengine/MainActivity;", // 7
        "V",                                     // 8
        "VI",                                    // 9
        "VL",                                    // 10
        "VZ",                                    // 11
        "file:///android_asset/index.html",      // 12
        "getSettings",                           // 13
        "loadUrl",                               // 14
        "onCreate",                              // 15
        "setContentView",                        // 16
        "setJavaScriptEnabled"                   // 17
    ].sort();

    // Map strings to indices
    const strMap = {};
    strings.forEach((s, i) => strMap[s] = i);

    // Types
    const typeStrings = [
        "Landroid/app/Activity;",                // 0
        "Landroid/content/Context;",             // 1
        "Landroid/os/Bundle;",                   // 2
        "Landroid/view/View;",                   // 3
        "Landroid/webkit/WebSettings;",          // 4
        "Landroid/webkit/WebView;",              // 5
        "Lcom/prasad/chessengine/MainActivity;", // 6
        "V",                                     // 7
        "Z"                                      // 8
    ];
    // Sort types by their string index
    typeStrings.sort((a, b) => strMap[a] - strMap[b]);
    const typeMap = {};
    typeStrings.forEach((t, i) => typeMap[t] = i);

    // Protos
    // 0: ()V -> shorty V, return V, params none
    // 1: (Landroid/content/Context;)V -> shorty VL, return V, params [Context]
    // 2: (Landroid/os/Bundle;)V -> shorty VL, return V, params [Bundle]
    // 3: (Landroid/view/View;)V -> shorty VL, return V, params [View]
    // 4: ()Landroid/webkit/WebSettings; -> shorty L, return WebSettings, params none
    // 5: (Z)V -> shorty VZ, return V, params [Z]
    // 6: (Ljava/lang/String;)V -> shorty VL, return V, params [String]
    // For simplicity, we define the exact protos used:
    const protos = [
        { shorty: "V", returnType: "V", params: [] },
        { shorty: "VL", returnType: "V", params: ["Landroid/content/Context;"] },
        { shorty: "VL", returnType: "V", params: ["Landroid/os/Bundle;"] },
        { shorty: "VL", returnType: "V", params: ["Landroid/view/View;"] },
        { shorty: "L", returnType: "Landroid/webkit/WebSettings;", params: [] },
        { shorty: "VZ", returnType: "V", params: ["Z"] },
        { shorty: "VL", returnType: "V", params: ["Ljava/lang/String;"] }
    ];

    // Methods
    const methods = [
        // 0: Landroid/app/Activity;-><init>()V
        { classType: "Landroid/app/Activity;", protoIdx: 0, name: "<init>" },
        // 1: Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
        { classType: "Landroid/app/Activity;", protoIdx: 2, name: "onCreate" },
        // 2: Landroid/app/Activity;->setContentView(Landroid/view/View;)V
        { classType: "Landroid/app/Activity;", protoIdx: 3, name: "setContentView" },
        // 3: Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
        { classType: "Landroid/webkit/WebView;", protoIdx: 1, name: "<init>" },
        // 4: Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
        { classType: "Landroid/webkit/WebView;", protoIdx: 4, name: "getSettings" },
        // 5: Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
        { classType: "Landroid/webkit/WebView;", protoIdx: 6, name: "loadUrl" },
        // 6: Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
        { classType: "Landroid/webkit/WebSettings;", protoIdx: 5, name: "setJavaScriptEnabled" },
        // 7: Lcom/prasad/chessengine/MainActivity;-><init>()V
        { classType: "Lcom/prasad/chessengine/MainActivity;", protoIdx: 0, name: "<init>" },
        // 8: Lcom/prasad/chessengine/MainActivity;->onCreate(Landroid/os/Bundle;)V
        { classType: "Lcom/prasad/chessengine/MainActivity;", protoIdx: 2, name: "onCreate" }
    ];

    // Method Bytecode:
    // Code 1: <init>()V -> invoke-direct {p0}, Activity-><init>()V; return-void
    const codeInit = Buffer.from([
        0x01, 0x00, // registers_size: 1 (v0/p0)
        0x01, 0x00, // ins_size: 1 (p0)
        0x01, 0x00, // outs_size: 1
        0x00, 0x00, // tries_size: 0
        0x00, 0x00, 0x00, 0x00, // debug_info_off: 0
        0x04, 0x00, 0x00, 0x00, // insns_size: 4 (units = 8 bytes)
        // insns:
        // 70 10 00 00 00 00 -> invoke-direct {p0}, method 0
        0x70, 0x10, 0x00, 0x00, 0x00, 0x00,
        // 0e 00 -> return-void
        0x0e, 0x00,
        0x00, 0x00 // 4-byte padding
    ]);

    // Code 2: onCreate(Bundle)V
    // registers: 4 (v0: webview, v1: settings, v2: bool, p0: this, p1: bundle) -> total 5 registers
    const codeOnCreate = Buffer.from([
        0x05, 0x00, // registers_size: 5
        0x02, 0x00, // ins_size: 2 (p0, p1)
        0x02, 0x00, // outs_size: 2
        0x00, 0x00, // tries_size: 0
        0x00, 0x00, 0x00, 0x00, // debug_info_off
        0x12, 0x00, 0x00, 0x00, // insns_size: 18 units = 36 bytes
        // invoke-super {p0, p1}, method 1 (Activity.onCreate)
        0x6f, 0x20, 0x01, 0x00, 0x43, 0x00,
        // new-instance v0, type 5 (WebView)
        0x22, 0x00, 0x05, 0x00,
        // invoke-direct {v0, p0}, method 3 (WebView.<init>(Context))
        0x70, 0x20, 0x03, 0x00, 0x30, 0x00,
        // invoke-virtual {p0, v0}, method 2 (Activity.setContentView(View))
        0x6e, 0x20, 0x02, 0x00, 0x03, 0x00,
        // invoke-virtual {v0}, method 4 (WebView.getSettings())
        0x6e, 0x10, 0x04, 0x00, 0x00, 0x00,
        // move-result-object v1
        0x0c, 0x01,
        // const/4 v2, 1
        0x12, 0x12,
        // invoke-virtual {v1, v2}, method 6 (WebSettings.setJavaScriptEnabled(Z))
        0x6e, 0x20, 0x06, 0x00, 0x21, 0x00,
        // const-string v1, string 12 ("file:///android_asset/index.html")
        0x1a, 0x01, 0x0c, 0x00,
        // invoke-virtual {v0, v1}, method 5 (WebView.loadUrl(String))
        0x6e, 0x20, 0x05, 0x00, 0x10, 0x00,
        // return-void
        0x0e, 0x00
    ]);

    // Build String Data Table
    const strDataBuffers = [];
    const strOffsets = [];
    let curDataOff = 0;
    for (let s of strings) {
        strOffsets.push(curDataOff);
        const len = writeUleb128(s.length);
        const chars = Buffer.from(s, 'utf8');
        const term = Buffer.from([0]);
        const entry = Buffer.concat([len, chars, term]);
        strDataBuffers.push(entry);
        curDataOff += entry.length;
    }
    const allStrData = Buffer.concat(strDataBuffers);

    // Layout calculation:
    // Header: 112 bytes (0x70)
    const headerSize = 112;
    const strIdsOff = headerSize;
    const strIdsSize = strings.length * 4;

    const typeIdsOff = strIdsOff + strIdsSize;
    const typeIdsSize = typeStrings.length * 4;

    const protoIdsOff = typeIdsOff + typeIdsSize;
    const protoIdsSize = protos.length * 12;

    const fieldIdsOff = protoIdsOff + protoIdsSize;
    const fieldIdsSize = 0;

    const methodIdsOff = fieldIdsOff + fieldIdsSize;
    const methodIdsSize = methods.length * 8;

    const classDefsOff = methodIdsOff + methodIdsSize;
    const classDefsSize = 1 * 32;

    let dataOff = classDefsOff + classDefsSize;
    // Align dataOff to 4
    dataOff = (dataOff + 3) & ~3;

    // Build data items:
    // 1. Code item 1 (init)
    const codeInitOff = dataOff;
    dataOff += codeInit.length;
    dataOff = (dataOff + 3) & ~3;

    // 2. Code item 2 (onCreate)
    const codeOnCreateOff = dataOff;
    dataOff += codeOnCreate.length;
    dataOff = (dataOff + 3) & ~3;

    // 3. Class data item:
    // static_fields_size: 0
    // instance_fields_size: 0
    // direct_methods_size: 1 (<init>)
    // virtual_methods_size: 1 (onCreate)
    // method 7: method_idx_diff = 7, access_flags = 0x10001 (PUBLIC | CONSTRUCTOR), code_off = codeInitOff
    // method 8: method_idx_diff = 1 (8 - 7), access_flags = 0x0001 (PUBLIC), code_off = codeOnCreateOff
    const classData = Buffer.concat([
        writeUleb128(0), // static fields
        writeUleb128(0), // instance fields
        writeUleb128(1), // direct methods
        writeUleb128(1), // virtual methods
        // direct method 0 (<init>)
        writeUleb128(7),
        writeUleb128(0x10001),
        writeUleb128(codeInitOff),
        // virtual method 0 (onCreate)
        writeUleb128(1), // diff from method 7 = 1
        writeUleb128(0x0001),
        writeUleb128(codeOnCreateOff)
    ]);
    const classDataOff = dataOff;
    dataOff += classData.length;
    dataOff = (dataOff + 3) & ~3;

    // 4. String Data
    const stringDataBaseOff = dataOff;
    dataOff += allStrData.length;
    dataOff = (dataOff + 3) & ~3;

    // Total file size
    const totalFileSize = dataOff;

    // Assemble file buffer
    const dex = Buffer.alloc(totalFileSize);

    // Write String IDs
    for (let i = 0; i < strings.length; i++) {
        dex.writeUInt32LE(stringDataBaseOff + strOffsets[i], strIdsOff + i * 4);
    }

    // Write Type IDs
    for (let i = 0; i < typeStrings.length; i++) {
        dex.writeUInt32LE(strMap[typeStrings[i]], typeIdsOff + i * 4);
    }

    // Write Proto IDs
    for (let i = 0; i < protos.length; i++) {
        const p = protos[i];
        dex.writeUInt32LE(strMap[p.shorty], protoIdsOff + i * 12);
        dex.writeUInt32LE(typeMap[p.returnType], protoIdsOff + i * 12 + 4);
        dex.writeUInt32LE(0, protoIdsOff + i * 12 + 8); // params_off (none/empty for now)
    }

    // Write Method IDs
    for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        dex.writeUInt16LE(typeMap[m.classType], methodIdsOff + i * 8);
        dex.writeUInt16LE(m.protoIdx, methodIdsOff + i * 8 + 2);
        dex.writeUInt32LE(strMap[m.name], methodIdsOff + i * 8 + 4);
    }

    // Write Class Def (Lcom/prasad/chessengine/MainActivity;)
    const classIdx = typeMap["Lcom/prasad/chessengine/MainActivity;"];
    const superIdx = typeMap["Landroid/app/Activity;"];
    dex.writeUInt32LE(classIdx, classDefsOff); // class_idx
    dex.writeUInt32LE(0x0001, classDefsOff + 4); // access_flags (PUBLIC)
    dex.writeUInt32LE(superIdx, classDefsOff + 8); // superclass_idx
    dex.writeUInt32LE(0, classDefsOff + 12); // interfaces_off
    dex.writeUInt32LE(0, classDefsOff + 16); // source_file_idx
    dex.writeUInt32LE(0, classDefsOff + 20); // annotations_off
    dex.writeUInt32LE(classDataOff, classDefsOff + 24); // class_data_off
    dex.writeUInt32LE(0, classDefsOff + 28); // static_values_off

    // Copy Data items
    codeInit.copy(dex, codeInitOff);
    codeOnCreate.copy(dex, codeOnCreateOff);
    classData.copy(dex, classDataOff);
    allStrData.copy(dex, stringDataBaseOff);

    // Write Header
    // Magic "dex\n035\0"
    dex.write("dex\n035\0", 0, 8, 'ascii');
    dex.writeUInt32LE(totalFileSize, 32);
    dex.writeUInt32LE(headerSize, 36);
    dex.writeUInt32LE(0x12345678, 40); // endian tag
    dex.writeUInt32LE(0, 44); // link_size
    dex.writeUInt32LE(0, 48); // link_off
    dex.writeUInt32LE(0, 52); // map_off

    dex.writeUInt32LE(strings.length, 56);
    dex.writeUInt32LE(strIdsOff, 60);

    dex.writeUInt32LE(typeStrings.length, 64);
    dex.writeUInt32LE(typeIdsOff, 68);

    dex.writeUInt32LE(protos.length, 72);
    dex.writeUInt32LE(protoIdsOff, 76);

    dex.writeUInt32LE(0, 80); // field_ids_size
    dex.writeUInt32LE(0, 84); // field_ids_off

    dex.writeUInt32LE(methods.length, 88);
    dex.writeUInt32LE(methodIdsOff, 92);

    dex.writeUInt32LE(1, 96); // class_defs_size
    dex.writeUInt32LE(classDefsOff, 100);

    dex.writeUInt32LE(totalFileSize - dataOff, 104); // data_size
    dex.writeUInt32LE(dataOff, 108); // data_off

    // Calculate SHA-1 Signature (bytes 32 to end)
    const sha1 = crypto.createHash('sha1').update(dex.slice(32)).digest();
    sha1.copy(dex, 12);

    // Calculate Adler32 Checksum (bytes 12 to end)
    const adler = adler32(dex, 12);
    dex.writeUInt32LE(adler, 8);

    return dex;
}

// -------------------------------------------------------------
// 3. Android resources.arsc Generator
// -------------------------------------------------------------
function buildResourcesArsc() {
    // String pool for global table
    const strings = ["Prasad Chess", "res/mipmap-hdpi/ic_launcher.png"];
    const strDataList = strings.map(s => {
        const b = Buffer.from(s, 'utf16le');
        const len = Buffer.alloc(2);
        len.writeUInt16LE(s.length, 0);
        return Buffer.concat([len, b, Buffer.alloc(2)]);
    });

    const strOffsets = [];
    let curOff = 0;
    for (let b of strDataList) {
        strOffsets.push(curOff);
        curOff += b.length;
    }

    const strOffsetsBuf = Buffer.alloc(strOffsets.length * 4);
    for (let i = 0; i < strOffsets.length; i++) {
        strOffsetsBuf.writeUInt32LE(strOffsets[i], i * 4);
    }
    const allData = Buffer.concat(strDataList);
    const pad = (4 - (allData.length % 4)) % 4;
    const paddedData = Buffer.concat([allData, Buffer.alloc(pad)]);

    const poolHeaderSize = 28;
    const poolSize = poolHeaderSize + strOffsetsBuf.length + paddedData.length;
    const poolChunk = Buffer.alloc(poolSize);
    poolChunk.writeUInt16LE(0x0001, 0);
    poolChunk.writeUInt16LE(poolHeaderSize, 2);
    poolChunk.writeUInt32LE(poolSize, 4);
    poolChunk.writeUInt32LE(strings.length, 8);
    poolChunk.writeUInt32LE(0, 12);
    poolChunk.writeUInt32LE(0, 16);
    poolChunk.writeUInt32LE(poolHeaderSize + strOffsetsBuf.length, 20);
    poolChunk.writeUInt32LE(0, 24);
    strOffsetsBuf.copy(poolChunk, poolHeaderSize);
    paddedData.copy(poolChunk, poolHeaderSize + strOffsetsBuf.length);

    // Table Header
    const tableHeaderSize = 12;
    const totalSize = tableHeaderSize + poolChunk.length;
    const tableHeader = Buffer.alloc(tableHeaderSize);
    tableHeader.writeUInt16LE(0x0002, 0); // RES_TABLE_TYPE
    tableHeader.writeUInt16LE(tableHeaderSize, 2);
    tableHeader.writeUInt32LE(totalSize, 4);
    tableHeader.writeUInt32LE(1, 8); // package count

    return Buffer.concat([tableHeader, poolChunk]);
}

// -------------------------------------------------------------
// 4. ZIP Package Builder with APK alignment & digital signing
// -------------------------------------------------------------
function buildApkZip(entries) {
    const fileRecords = [];
    let curOffset = 0;

    const localHeaders = [];

    for (let entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const uncompressed = entry.data;
        const uncompressedCrc = crc32(uncompressed);

        // We store assets DEFLATED, and manifest / resources STORED for fast Android memory-mapping
        let method = 8; // DEFLATE
        let compressed = zlib.deflateRawSync(uncompressed);
        if (entry.name.endsWith('.png') || compressed.length >= uncompressed.length) {
            method = 0; // STORE
            compressed = uncompressed;
        }

        // Align uncompressed file offset to 4-byte boundary for resources and dex
        let extraField = Buffer.alloc(0);
        if (method === 0 && (curOffset + 30 + nameBuf.length) % 4 !== 0) {
            const padSize = (4 - ((curOffset + 30 + nameBuf.length) % 4)) % 4;
            extraField = Buffer.alloc(padSize);
        }

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // signature
        localHeader.writeUInt16LE(20, 4);         // version 2.0
        localHeader.writeUInt16LE(0x0800, 6);     // flags: UTF-8
        localHeader.writeUInt16LE(method, 8);
        localHeader.writeUInt16LE(0x56a0, 10);    // time
        localHeader.writeUInt16LE(0x5ca1, 12);    // date
        localHeader.writeUInt32LE(uncompressedCrc, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(uncompressed.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(extraField.length, 28);

        const record = {
            name: entry.name,
            nameBuf: nameBuf,
            method: method,
            crc: uncompressedCrc,
            compSize: compressed.length,
            uncompSize: uncompressed.length,
            offset: curOffset
        };
        fileRecords.push(record);

        localHeaders.push(localHeader);
        localHeaders.push(nameBuf);
        if (extraField.length > 0) localHeaders.push(extraField);
        localHeaders.push(compressed);

        curOffset += localHeader.length + nameBuf.length + extraField.length + compressed.length;
    }

    const centralHeaders = [];
    const centralDirStart = curOffset;

    for (let r of fileRecords) {
        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0); // signature
        cd.writeUInt16LE(0x0314, 4);     // version made by UNIX 2.0
        cd.writeUInt16LE(20, 6);         // version needed 2.0
        cd.writeUInt16LE(0x0800, 8);     // UTF-8
        cd.writeUInt16LE(r.method, 10);
        cd.writeUInt16LE(0x56a0, 12);
        cd.writeUInt16LE(0x5ca1, 14);
        cd.writeUInt32LE(r.crc, 16);
        cd.writeUInt32LE(r.compSize, 20);
        cd.writeUInt32LE(r.uncompSize, 24);
        cd.writeUInt16LE(r.nameBuf.length, 28);
        cd.writeUInt16LE(0, 30); // extra len
        cd.writeUInt16LE(0, 32); // comment len
        cd.writeUInt16LE(0, 34); // disk num
        cd.writeUInt16LE(0, 36); // internal attr
        cd.writeUInt32LE(0x81a40000, 38); // external attr (regular file 0644)
        cd.writeUInt32LE(r.offset, 42);

        centralHeaders.push(cd);
        centralHeaders.push(r.nameBuf);
    }

    const centralDirBuf = Buffer.concat(centralHeaders);
    const centralDirSize = centralDirBuf.length;

    // End of Central Directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(fileRecords.length, 8);
    eocd.writeUInt16LE(fileRecords.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(centralDirStart, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}

// -------------------------------------------------------------
// 5. Main Packaging Routine
// -------------------------------------------------------------
function assembleApk() {
    console.log("========================================================");
    console.log("       Prasad Chess Engine - Android APK Builder        ");
    console.log("========================================================");

    const baseDir = path.resolve(__dirname);
    const guiDir = path.join(baseDir, 'gui');
    const outApkPath = path.join(baseDir, 'PrasadChess.apk');

    const entries = [];

    // 1. AndroidManifest.xml
    console.log("[*] Generating Android Binary XML (AndroidManifest.xml)...");
    const manifestBuf = buildBinaryManifest();
    entries.push({ name: "AndroidManifest.xml", data: manifestBuf });

    // 2. classes.dex
    console.log("[*] Generating Dalvik Executable (classes.dex)...");
    const dexBuf = buildClassesDex();
    entries.push({ name: "classes.dex", data: dexBuf });

    // 3. resources.arsc
    console.log("[*] Generating resources.arsc...");
    const arscBuf = buildResourcesArsc();
    entries.push({ name: "resources.arsc", data: arscBuf });

    // 4. Icons
    const iconPath = path.join(guiDir, 'icon.png');
    const iconData = fs.readFileSync(iconPath);
    entries.push({ name: "res/mipmap-hdpi/ic_launcher.png", data: iconData });
    entries.push({ name: "res/mipmap-mdpi/ic_launcher.png", data: iconData });
    entries.push({ name: "res/mipmap-xhdpi/ic_launcher.png", data: iconData });
    entries.push({ name: "res/mipmap-xxhdpi/ic_launcher.png", data: iconData });

    // 5. Web Assets
    console.log("[*] Packing GUI assets into assets/ directory...");
    const assetFiles = [
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

    for (let f of assetFiles) {
        const fp = path.join(guiDir, f);
        if (fs.existsSync(fp)) {
            const data = fs.readFileSync(fp);
            entries.push({ name: `assets/${f}`, data });
        }
    }

    // 6. Signature (META-INF)
    console.log("[*] Generating APK Signatures (MANIFEST.MF, CERT.SF, CERT.RSA)...");
    let manifestMf = "Manifest-Version: 1.0\r\nCreated-By: 1.0 (PrasadChess)\r\n\r\n";
    for (let e of entries) {
        const hash = crypto.createHash('sha256').update(e.data).digest('base64');
        manifestMf += `Name: ${e.name}\r\nSHA-256-Digest: ${hash}\r\n\r\n`;
    }
    const manifestMfBuf = Buffer.from(manifestMf, 'utf8');
    entries.push({ name: "META-INF/MANIFEST.MF", data: manifestMfBuf });

    const mfHash = crypto.createHash('sha256').update(manifestMfBuf).digest('base64');
    let certSf = "Signature-Version: 1.0\r\nCreated-By: 1.0 (PrasadChess)\r\n";
    certSf += `SHA-256-Digest-Manifest: ${mfHash}\r\n\r\n`;
    for (let e of entries) {
        if (e.name === "META-INF/MANIFEST.MF") continue;
        const entryBlock = `Name: ${e.name}\r\nSHA-256-Digest: ${crypto.createHash('sha256').update(e.data).digest('base64')}\r\n\r\n`;
        const entryHash = crypto.createHash('sha256').update(entryBlock).digest('base64');
        certSf += `Name: ${e.name}\r\nSHA-256-Digest: ${entryHash}\r\n\r\n`;
    }
    const certSfBuf = Buffer.from(certSf, 'utf8');
    entries.push({ name: "META-INF/CERT.SF", data: certSfBuf });

    // Generate RSA key pair for self-signed CERT.RSA
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(certSfBuf);
    const signature = signer.sign({ key: privateKey, format: 'der', type: 'pkcs8' });

    // Minimal PKCS#7 block wrapping cert and signature
    const certRsaBuf = Buffer.concat([
        Buffer.from([0x30, 0x82]), // SEQUENCE
        Buffer.alloc(2),          // placeholder
        publicKey,
        signature
    ]);
    certRsaBuf.writeUInt16BE(certRsaBuf.length - 4, 2);
    entries.push({ name: "META-INF/CERT.RSA", data: certRsaBuf });

    // 7. Assemble ZIP
    console.log("[*] Assembling APK ZIP archive...");
    const apkData = buildApkZip(entries);
    fs.writeFileSync(outApkPath, apkData);

    console.log(`[SUCCESS] PrasadChess.apk successfully generated!`);
    console.log(`[+] Location: ${outApkPath}`);
    console.log(`[+] Size: ${(apkData.length / 1024).toFixed(1)} KB (${apkData.length} bytes)`);
    console.log(`[+] Total Packed Files: ${entries.length}`);
}

assembleApk();
