@echo off
echo ========================================================
echo   CHESSMOD - by author PRASAD DHODAMANI
echo ========================================================
echo.

cd /d "%~dp0"

if exist "dist\Chessmod\Chessmod.exe" (
    echo [OK] Launching Chessmod...
    start "" "dist\Chessmod\Chessmod.exe"
) else if exist "dist\chessmod\chessmod.exe" (
    echo [OK] Launching Chessmod...
    start "" "dist\chessmod\chessmod.exe"
) else (
    echo [ERROR] Chessmod.exe not found!
    echo Please run build_exe.bat first to build the executable.
    pause
)
