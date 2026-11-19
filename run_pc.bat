@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo               CHESS VISION PC LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0"

:: Detect Python executable
set "PYTHON_EXE="

if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else (
    where python >nul 2>nul
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        where py >nul 2>nul
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=py"
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python not found on your system!
    echo Please install Python 3.10+ from python.org or Microsoft Store.
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%

:: Ensure stockfish environment path is set if not already
if exist "%~dp0bin\stockfish.exe" (
    set "STOCKFISH_PATH=%~dp0bin\stockfish.exe"
    echo [OK] Stockfish engine: %~dp0bin\stockfish.exe
)

echo.
echo Starting web server on http://127.0.0.1:8000 ...
echo (Opening browser in 2 seconds...)
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"

"%PYTHON_EXE%" scripts\web.py

pause
