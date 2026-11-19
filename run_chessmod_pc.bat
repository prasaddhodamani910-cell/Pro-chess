@echo off
echo ========================================================
echo   CHESSMOD - Windows Desktop App Launcher
echo   by author PRASAD DHODAMANI
echo ========================================================
echo.

cd /d "%~dp0"

if exist "desktop_app\dist\Chessmod\Chessmod.exe" (
    echo [OK] Launching Chessmod.exe...
    start "" "desktop_app\dist\Chessmod\Chessmod.exe"
) else (
    echo [INFO] Standalone executable not found. Launching via desktop_app\run_desktop.bat...
    call "desktop_app\run_desktop.bat"
)
