@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo Building PrasadChessEngine (Optimized Release)
echo ========================================================

where cl >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
    )
)

cl /O2 /Oi /Ot /EHsc /std:c++17 /Isrc src\main.cpp src\bitboard.cpp src\magic.cpp src\zobrist.cpp src\board.cpp src\movegen.cpp src\perft.cpp src\evaluate.cpp src\tt.cpp src\timeman.cpp src\search.cpp src\uci.cpp /Fe:prasadchessengine.exe

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] prasadchessengine.exe built successfully!
    del *.obj >nul 2>nul
) else (
    echo.
    echo [ERROR] Build failed!
)
