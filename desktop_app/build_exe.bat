@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   BUILDING STANDALONE CHESSMOD EXECUTABLE
echo   Chessmod by author PRASAD DHODAMANI
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

echo [1/3] Using Python: %PYTHON_EXE%
echo [2/3] Cleaning previous build folders...
if exist "build" rmdir /s /q "build"
if exist "dist\Chessmod" rmdir /s /q "dist\Chessmod"
if exist "Chessmod.spec" del "Chessmod.spec"

echo [3/3] Compiling standalone executable with PyInstaller...
echo.

"%PYTHON_EXE%" -m PyInstaller ^
    -y ^
    --onedir ^
    --windowed ^
    --name "Chessmod" ^
    --version-file "version_info.txt" ^
    --paths "src" ^
    --add-data "src\assets\sidebar.css;assets" ^
    --add-data "src\assets\sidebar.js;assets" ^
    --add-data "bin\stockfish.exe;bin" ^
    --add-data "models\chess-tiles-v2.onnx;models" ^
    --hidden-import "chess" ^
    --hidden-import "chess.engine" ^
    --hidden-import "chess.svg" ^
    --hidden-import "cv2" ^
    --hidden-import "numpy" ^
    --hidden-import "webview" ^
    --hidden-import "pythonnet" ^
    --hidden-import "clr_loader" ^
    src\main.py

echo.
if exist "dist\Chessmod\Chessmod.exe" (
    echo ========================================================
    echo  SUCCESS! Executable created:
    echo  dist\Chessmod\Chessmod.exe
    echo  Chessmod by author PRASAD DHODAMANI
    echo ========================================================
) else (
    echo [ERROR] Build failed. Check the logs above.
)

pause
