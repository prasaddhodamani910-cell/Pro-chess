# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['src/main.py'],
    pathex=['src'],
    binaries=[],
    datas=[('src/assets/sidebar.css', 'assets'), ('src/assets/sidebar.js', 'assets'), ('bin/stockfish.exe', 'bin'), ('models/chess-tiles-v2.onnx', 'models')],
    hiddenimports=['chess', 'chess.engine', 'chess.svg', 'cv2', 'numpy', 'webview', 'pythonnet', 'clr_loader'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ChessVisionPC',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ChessVisionPC',
)
