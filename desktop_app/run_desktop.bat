@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        CHESSMOD - DESKTOP APP (MADE BY PRASAD)
echo        Author: PRASAD DHIDAMANI
echo ========================================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE="

if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
) else (
    where python >nul 2>nul
    if !errorlevel! equ 0 set "PYTHON_EXE=python"
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python not found on system!
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%
echo [OK] Launching chessmod desktop app...
echo.

"%PYTHON_EXE%" src\main.py

pause
