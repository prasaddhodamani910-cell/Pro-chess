@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo Building PrasadChess.exe (Windows Desktop Application)
echo ========================================================

where cl >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
    )
)

cl /O2 /EHsc /std:c++17 PrasadChessApp.cpp ws2_32.lib shell32.lib user32.lib /Fe:PrasadChess.exe

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] PrasadChess.exe built successfully!
    del PrasadChessApp.obj >nul 2>nul
) else (
    echo.
    echo [ERROR] Build failed!
)
