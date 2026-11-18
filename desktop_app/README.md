# Chessmod PC - Desktop Application
### by author PRASAD DHODAMANI

Standalone desktop application for Windows that embeds online chess platforms (Chess.com, Lichess) in a lightweight Edge WebView2 container with an integrated real-time Stockfish 19 analysis assistant.

---

## 🚀 Quick Launch

### Run the Standalone Executable
- Double-click **[`run_exe.bat`](file:///C:/Projects%20by%20Prasad/chessproject/desktop_app/run_exe.bat)**
- OR run directly: **[`dist/Chessmod/Chessmod.exe`](file:///C:/Projects%20by%20Prasad/chessproject/desktop_app/dist/Chessmod/Chessmod.exe)**

### Run from Python Source
- Double-click **[`run_desktop.bat`](file:///C:/Projects%20by%20Prasad/chessproject/desktop_app/run_desktop.bat)**

---

## ⚙️ Features & Black / White Move Fix

1. **Automatic Color & Turn Detection**:
   - Accurately determines whose turn it is using board move highlights (`.highlight` on Chess.com, `.last-move` on Lichess).
   - When playing as **Black** (board flipped), as soon as White makes a move, the engine immediately evaluates and displays the **best move for Black**!
   - When playing as **White**, displays the best move for White.
   - Fully supports manual overrides via `Turn: Auto`, `White`, or `Black` buttons.
2. **Integrated Stockfish 19**:
   - High-performance chess engine bundled directly inside the executable.
3. **Interactive Visual SVG Board**:
   - Renders live 2D board with green move arrows. Automatically flips orientation when playing Black!
4. **TrustedHTML & CSP Compliant**:
   - Zero `innerHTML` DOM methods prevent policy blocks on Chess.com.

---

## 🔨 How to Rebuild the Executable

Double-click:
```bat
build_exe.bat
```
This compiles `src/main.py` into `dist/Chessmod/Chessmod.exe` using PyInstaller.
