@echo off
setlocal
cd /d "%~dp0"
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
cl /O2 /EHsc /std:c++17 /Isrc match_runner.cpp src\bitboard.cpp src\magic.cpp src\zobrist.cpp src\board.cpp src\movegen.cpp /Fe:match_runner.exe
if %errorlevel% equ 0 (
    echo [SUCCESS] match_runner.exe built!
    del *.obj >nul 2>nul
) else (
    echo [ERROR] build failed!
)
