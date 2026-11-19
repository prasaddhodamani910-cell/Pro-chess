# Chessmod (PC & Android)
### by author PRASAD DHODAMANI

A fast, offline-capable chess board recognition and analysis suite that works on PC (Windows) and Android mobile devices.

Detects digital chessboards (Chess.com, Lichess, diagrams, or screen shares), identifies all 64 squares, generates FEN positions, and calculates the best moves using integrated engines (Stockfish 19 on PC, and native high-speed engine on Android).

---

## Screenshots

### PC

| Chess.com | Lichess |
| --- | --- |
| ![Chessmod running on Chess.com on PC](<Result screenshot/PC_chesscom.jpg>) | ![Chessmod running on Lichess on PC](<Result screenshot/PC_lichess.jpg>) |

### Android

| Chess.com | Lichess |
| --- | --- |
| ![Chessmod running on Chess.com on Android](<Result screenshot/android_chesscom.jpg>) | ![Chessmod running on Lichess on Android](<Result screenshot/android_lichess.jpg>) |

---

## 📱 Android App (.apk) - *Mobile Live Chess Player & Analyzer*

The Android companion application is located in the dedicated [`android_app`](android_app/) folder.

- **Pre-built APK:** [Download Chessmod for Android](android_app/dist/Chessmod.apk) (Android chess assistant)
- **Alternate APK:** [Download ChessVision](android_app/dist/ChessVision.apk) (alternate Android build)
- **1-Click Rebuild Batch:** [`android_app/build_apk.bat`](android_app/build_apk.bat)

### Android Features:
1. **Accurate Black & White Turn Detection**:
   - Detects the last move played on the board using `.highlight` elements.
   - When playing as **Black**, as soon as White makes a move, the engine immediately calculates the **best move for Black**!
   - Supports board orientation flipping and Lichess 180-degree coordinate correction.
2. **Embedded Online Chess**: Loads Chess.com, Lichess, and Tactics Puzzles with full touch support.
3. **Floating Knight HUD (`♞`)**: Minimized floating button shows best move directly on its badge without blocking the board.
4. **Slide-up Bottom Sheet**: Expands to show best move (e.g. `e5 (e7e5)`, `Nf6 (g8f6)`), evaluation (+0.75, etc.), 2D board SVG preview, and FEN copy.
5. **On-Device Pure Kotlin Engine**: 100% offline, zero-latency position evaluation using alpha-beta minimax search with piece-square tables.
6. **Auto-Scan Live**: Automatically detects moves made on screen and calculates the best response in real time.

---

## 🚀 Ways to Run on PC

### 1. Standalone Desktop App (.exe) - *All-in-One Live Chess Player & Analyzer*
- Double-click [`run_chessmod_pc.bat`](run_chessmod_pc.bat) in the root folder
- OR open [`desktop_app`](desktop_app/) and double-click [`run_exe.bat`](desktop_app/run_exe.bat)
- OR run directly: [Chessmod desktop app](desktop_app/dist/Chessmod/Chessmod.exe) (Windows live chess analysis)
- **Alternate desktop build:** [ChessVisionPC](desktop_app/dist/ChessVisionPC/ChessVisionPC.exe) (Windows board recognition app)

### PrasadChess engine builds

- [PrasadChess desktop app](prasadchessengine/PrasadChess.exe) (Windows graphical engine app)
- [PrasadChess UCI engine](prasadchessengine/prasadchessengine.exe) (Windows command-line chess engine for UCI-compatible chess software)
- [PrasadChess Android APK](prasadchessengine/PrasadChess.apk) (Android engine app)

*Features:* Opens full **Chess.com** or **Lichess** in an embedded browser window with an integrated live **Stockfish 19 & AI assistant dock** on the right side. Auto-scans every move live as you play for both White and Black!

### 2. Web Interface (Browser Dashboard)
Double-click [`run_pc.bat`](run_pc.bat) (or run `python scripts/web.py`) and visit **`http://127.0.0.1:8000`**.
*Features:* Paste screenshots (`Ctrl+V`), drag & drop image files, or share your screen/tab.

---

## 🖥️ PC Features

1. **Intelligent Black & White Move Generation**:
   - Auto-detects whether White or Black just moved using board highlights and clocks.
   - Accurately renders move recommendations and green arrow highlights for whichever side the user is playing.
2. **Clipboard Paste (Ctrl + V)**:
   - Snip any board with `Win + Shift + S` or `PrintScreen`.
   - Simply press `Ctrl + V` inside the browser window to instantly detect the board, evaluate the position, and view the best move.
3. **Screen & Tab Sharing (Live PC Capture)**:
   - Click **"Share Screen / Tab"** to select your Chess.com or Lichess browser tab.
   - Click **"Analyze Screen Now"** or enable **"Auto-Scan"** for hands-free live analysis while you play.
4. **Universal Board Detection**:
   - Upgraded to automatically find 2D chessboards anywhere on widescreen PC monitors (1080p, 1440p, 4K), browser windows, cropped snippets, or mobile screenshots.
5. **Bundled Stockfish 19 Engine**:
   - Stockfish 19 for Windows is located directly in `bin/stockfish.exe` and is detected automatically without needing manual configuration.
6. **Interactive Analysis**:
   - Visual SVG board with green move arrows. Automatically flips when playing Black.
   - Best move readout & engine evaluation score.
   - One-click **Copy FEN** and **Open in Lichess Analysis** buttons.
   - Side-to-move and board-flip controls.

---

## Project layout

- [`scripts/`](scripts/): Python board recognition, image processing, web interface, and development utilities in `scripts/dev/`.
- [`ai/`](ai/): AI recognition code and related checks.
- [`desktop_app/`](desktop_app/): Windows desktop application source (`src/`), assets, build files, and its [guide](desktop_app/README.md).
- [`android_app/`](android_app/): Android application source, Gradle configuration, and its [guide](android_app/README.md).
- [`prasadchessengine/`](prasadchessengine/): C++ engine (`src/`), web interface (`gui/`), and platform build scripts; see its [guide](prasadchessengine/README.md).
- [`assets/`](assets/): input and project media; [`doc/`](doc/): design and implementation notes.
- `output/` is for generated recognition previews and square images. Treat build and distribution folders as generated artifacts.

For the file organization and maintenance notes, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md). Recent documentation and organization updates are recorded in [CHANGELOG.md](CHANGELOG.md).
