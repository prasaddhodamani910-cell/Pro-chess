@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================================
echo   BUILDING NATIVE PRASAD CHESS STANDALONE EXECUTABLE
echo   Author: PRASAD DHODAMANI
echo ========================================================
echo.

set "PYTHON_EXE=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"

if not exist "%PYTHON_EXE%" (
    where python >nul 2>nul
    if !errorlevel! equ 0 set "PYTHON_EXE=python"
)

echo [1/3] Using Python: %PYTHON_EXE%
echo [2/3] Cleaning previous build...
if exist "build" rmdir /s /q "build"
if exist "dist\PrasadChess" rmdir /s /q "dist\PrasadChess"

echo [3/3] Compiling native Windows application with PyInstaller...
"%PYTHON_EXE%" -m PyInstaller ^
    -y ^
    --onedir ^
    --windowed ^
    --name "PrasadChess" ^
    --add-data "gui;gui" ^
    prasad_desktop.py

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Native PrasadChess.exe successfully created!
    echo Location: %~dp0dist\PrasadChess\PrasadChess.exe
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed!
)
