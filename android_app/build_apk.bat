@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        CHESSMOD - ANDROID APK BUILDER
echo        Chessmod by author PRASAD DHODAMANI
echo ========================================================
echo.

set "JAVA_HOME=C:\Program Files\Java\jdk-21"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "GRADLE_BAT=C:\Users\Pranali Dhodamani\AppData\Local\Android\gradle\gradle-8.7\bin\gradle.bat"

if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo [ERROR] JDK 21 not found at: %JAVA_HOME%
    pause
    exit /b 1
)

if not exist "%GRADLE_BAT%" (
    echo [ERROR] Gradle 8.7 not found at: %GRADLE_BAT%
    pause
    exit /b 1
)

echo [OK] Using Java: %JAVA_HOME%
echo [OK] Using Gradle: %GRADLE_BAT%
echo.

cd /d "%~dp0"

echo [1/3] Building Chessmod Debug APK...
call "%GRADLE_BAT%" assembleDebug --no-daemon

if errorlevel 1 (
    echo.
    echo [ERROR] Gradle build failed! Check errors above.
    pause
    exit /b 1
)

echo.
echo [2/3] Copying APK to dist folder...
if not exist "dist" mkdir dist

set "SOURCE_APK=app\build\outputs\apk\debug\app-debug.apk"
set "TARGET_APK=dist\Chessmod.apk"
set "TARGET_APK_LEGACY=dist\ChessVision.apk"

if exist "%SOURCE_APK%" (
    copy /y "%SOURCE_APK%" "%TARGET_APK%" >nul
    copy /y "%SOURCE_APK%" "%TARGET_APK_LEGACY%" >nul
    echo [OK] APK copied to: %TARGET_APK%
) else (
    echo [ERROR] Output APK not found at %SOURCE_APK%
    pause
    exit /b 1
)

echo.
echo [3/3] Build Finished Successfully!
echo ========================================================
echo Output File: %~dp0dist\Chessmod.apk
echo Chessmod by author PRASAD DHODAMANI
echo ========================================================
echo.
echo You can install this on any Android phone using:
echo   adb install dist\Chessmod.apk
echo or transfer Chessmod.apk to your phone and tap to install.
echo.
pause
