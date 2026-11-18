# Chessmod Android App (APK)
### by author PRASAD DHODAMANI

Companion mobile application to the Chessmod PC suite.
Runs online chess platforms (Chess.com, Lichess, Puzzles) inside a customized mobile WebView with a real-time, on-device Chess Assistant HUD.

---

## Systematic Directory Structure

```
android_app/
├── app/
│   ├── build.gradle                  # App build configuration (compileSdk 34, minSdk 24)
│   ├── proguard-rules.pro            # ProGuard preservation rules for JavascriptInterface
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml   # Internet permission, activities & hardware acceleration
│           ├── assets/
│           │   ├── assistant.js      # Mobile DOM board observer & assistant controller
│           │   └── assistant.css     # Touch-friendly bottom-sheet HUD & floating knight FAB
│           ├── java/com/chessvision/app/
│           │   ├── MainActivity.kt   # Native Android Activity, WebView & bridge coordinator
│           │   ├── ChessEngine.kt    # Pure Kotlin chess engine (PST evaluation, legal moves, alpha-beta search)
│           │   └── AndroidBridge.kt  # Thread-safe JS interface between WebView DOM and Kotlin engine
│           └── res/
│               ├── drawable/         # Vector knight icons & UI drawables
│               ├── layout/           # Activity layouts with WebView and progress indicators
│               ├── mipmap-anydpi-v26/# Adaptive launcher icon
│               └── values/           # Strings, styles, and dark theme definitions (App Name: Chessmod)
├── build.gradle                      # Root project build configuration
├── settings.gradle                   # Gradle module and repository resolution
├── gradle.properties                 # JVM arguments & AndroidX flags
├── local.properties                  # Android SDK path configuration
├── build_apk.bat                     # 1-click Windows batch script to compile the APK
└── dist/
    └── Chessmod.apk                  # Final installable Android APK package (Chessmod by PRASAD DHODAMANI)
```

---

## Features & Black / White Move Fix

1. **Intelligent Turn & Color Detection**:
   - **Playing as Black**: Detects when White plays a move using live board move highlights (`.highlight` on Chess.com, `.last-move` on Lichess). As soon as White moves, it immediately generates the **best response move for Black**.
   - **Playing as White**: Generates moves for White when it is White's turn.
   - **Board Coordinate Correction**: Automatically maps Lichess 180-degree board reversal when `orientation-black` is active so pieces and moves are always accurate.
   - **Turn Override Buttons**: Quick toggle between `Auto Turn`, `White`, or `Black` at any time.

2. **Touch-Friendly Bottom Sheet HUD**:
   - **Floating Action Knight (`♞`)**: Shows the best move directly on its badge without blocking the board.
   - **Slide-Up Bottom Sheet**: View recommended move (e.g. `e5 (e7e5)`, `Nf6 (g8f6)`), evaluation (+0.75, etc.), depth, nodes, and mini 2D SVG board preview.
   - **Live Auto-Scan**: MutationObserver listens for move changes in real time and automatically evaluates positions.

3. **100% On-Device Pure Kotlin Engine**:
   - Runs locally on the phone with zero external server latency or network requirements.
   - Positional piece-square tables, alpha-beta minimax search, MVV-LVA move ordering.

---

## How to Install on Android

1. Transfer **[`android_app/dist/Chessmod.apk`](file:///C:/Projects%20by%20Prasad/chessproject/android_app/dist/Chessmod.apk)** to your Android phone via USB cable, Google Drive, or messaging.
2. Tap the file on your phone and choose **Install**.
3. Or install via ADB:
   ```bat
   adb install "android_app\dist\Chessmod.apk"
   ```

To rebuild the APK at any time, run **[`android_app/build_apk.bat`](file:///C:/Projects%20by%20Prasad/chessproject/android_app/build_apk.bat)**.
