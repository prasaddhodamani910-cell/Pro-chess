# PrasadChessEngine

## Ready-to-run builds

- [PrasadChess.exe](PrasadChess.exe) — Windows graphical application.
- [prasadchessengine.exe](prasadchessengine.exe) — Windows UCI command-line engine for chess GUIs.
- [PrasadChess.apk](PrasadChess.apk) — Android application package.

These are prebuilt downloads. Build instructions for compiling from source are below.

A high-performance, Stockfish-inspired chess engine written in modern C++ (C++17) using a 64-bit Bitboard architecture, Magic Bitboards, and the Universal Chess Interface (UCI) protocol.

---

## Architecture & Features

### 1. Board Representation & Move Generation
- **Bitboards (64-bit `uint64_t`)**: Compact, cache-friendly bitboards for all piece types, colors, and occupancy.
- **Magic Bitboards**: $O(1)$ constant-time lookup tables for sliding pieces (Bishops, Rooks, Queens) using 100% collision-free verified magic numbers.
- **Move Encoding**: Packed 16-bit move format (from-square, to-square, promotion piece, special flags: quiet, double push, castling, en-passant, captures).
- **Zobrist Hashing**: 64-bit deterministic hash keys for transposition table lookups and 3-fold repetition detection.
- **Perft Verified**: Validated against canonical test suites (Initial Position, *Kiwipete*, and complex endgame positions) passing 100% of leaf node tests at ~35,000,000 nodes/sec.

### 2. Search Engine
- **Negamax Alpha-Beta** search with **Iterative Deepening**.
- **Aspiration Windows**: Narrow search windows centered on the previous iteration score to accelerate alpha-beta cutoffs.
- **Quiescence Search**: Evaluates tactical captures and promotions to prevent the horizon effect, with delta pruning.
- **Transposition Table (TT)**: Configurable hash table (default 64 MB, scalable up to 1024 MB) with depth-preferred and age-based replacement policies.
- **Move Ordering**:
  1. Transposition table (hash) move.
  2. MVV-LVA (Most Valuable Victim – Least Valuable Attacker) for captures.
  3. Killer move heuristic (2 killer moves per ply).
  4. History heuristic table indexed by `[color][from][to]`.
- **Search Pruning & Reductions**:
  - Null Move Pruning (NMP) with adaptive reduction.
  - Reverse Futility Pruning (Static Null Move Pruning).
  - Late Move Reductions (LMR) on quiet, non-tactical moves.
  - Check extension (extends search depth by 1 ply when in check).

### 3. Evaluation
- **Tapered Hand-Crafted Evaluation (HCE)**: Smoothly blends Middlegame (MG) and Endgame (EG) scores based on material phase.
- **PeSTO's Piece-Square Tables (PSQT)**: Encourages rapid piece development, central control, and king safety.
- **Positional Factors**: Passed pawns, doubled pawns, isolated pawns, bishop pair bonus, and rook on open / semi-open files.

### 4. UCI Interface & Time Management
- Fully compliant with the Universal Chess Interface (UCI) protocol.
- Multi-threaded search loop allowing immediate non-blocking response to `stop` and `quit` commands.
- Dynamic time allocation considering remaining clock time, increments, and game phase.

---

## Building the Engine

### Prerequisites
- Visual Studio 2022 / modern MSVC compiler (`cl.exe`) **or** GCC/Clang with C++17 support.

### 1-Click Windows Build (MSVC)
Run the included batch script:
```cmd
build.bat
```
This compiles with maximum optimizations (`/O2 /Oi /Ot /EHsc /std:c++17`) and produces `prasadchessengine.exe`.

### CMake Build
```cmd
mkdir build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
```

---

## Usage & UCI Commands

### Connecting to a GUI
Add `prasadchessengine.exe` as a UCI engine in any modern chess GUI:
- **Arena Chess GUI**
- **CuteChess**
- **Banksia GUI**
- **Lichess Bot (via lichess-bot python client)**

### Interactive Command Line Usage
Run `prasadchessengine.exe`:

| Command | Description |
| :--- | :--- |
| `uci` | Engine handshake and capabilities |
| `isready` | Engine status check (responds with `readyok`) |
| `ucinewgame` | Reset hash table and history for a new game |
| `position startpos [moves ...]` | Setup board from initial position |
| `position fen <fen> [moves ...]` | Setup board from a custom FEN |
| `go depth <d>` | Search to a fixed depth |
| `go movetime <ms>` | Search for a fixed duration in milliseconds |
| `go wtime <ms> btime <ms> winc <ms> binc <ms>` | Tournament game time control |
| `go perft <d>` | Run perft move generation divide for current position |
| `stop` | Stop search immediately and output best move |
| `d` / `print` | Display current board in ASCII and FEN string |
| `eval` | Show static evaluation of current position |
| `quit` | Exit the engine |

### Automated Tests
Run built-in benchmark verification directly from terminal:
```cmd
prasadchessengine.exe perft
```
