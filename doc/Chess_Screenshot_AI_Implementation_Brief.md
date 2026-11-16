# Chess Screenshot AI Upgrade --- Implementation Brief

## Project goal

Upgrade the existing chess project so it can recognize a chess position
from a screenshot of an online chess app or game (for example, Chess.com
or Lichess).

The feature must work offline after its required model/runtime files are
installed. It must detect the chessboard, recognize the pieces on all 64
squares, and produce a board position in FEN format for the existing
chess logic or Stockfish engine.

This feature is for **static 2D screenshots of digital chessboards**,
not photos of physical chessboards.

## Recommended model

**Use Fenshot's `chess-tiles-v2.onnx` model as the first choice.**

-   Project: https://github.com/scoriiu/fenshot
-   Package: `@scoriiu/fenshot`
-   Model filename: `chess-tiles-v2.onnx`
-   Reported model size: approximately **1.3 MB**
-   Model type: compact CNN tile classifier in ONNX format
-   Recognition workflow: board detection + classification of the 64
    squares + FEN generation
-   Intended examples: Chess.com and Lichess screenshots, diagrams, and
    other roughly axis-aligned 2D boards
-   License shown by the repository: MIT (verify the current license and
    notices before redistributing)

Reference README:
https://github.com/scoriiu/fenshot/blob/main/packages/fenshot/README.md

Do not substitute a large chat LLM. This is an image-recognition task; a
small specialized vision model is more appropriate.

### Compatibility note

Fenshot is documented as browser-first and uses JavaScript,
Canvas/ImageBitmap, and ONNX Runtime Web (WASM). The model is small, but
its browser package is **not automatically a drop-in Python module**.

Inspect the project's current architecture before implementation: - If
the project has a browser/web UI, prefer integrating the Fenshot package
and its ONNX Runtime Web assets into that UI. - If the project is
Python-only, determine whether ONNX Runtime for Python can run the model
and reproduce the required image preprocessing and board-detection
steps. Do not assume the ONNX model alone is sufficient. - If the
existing application uses another stack, choose the smallest compatible
integration path. - Keep the recognition feature modular so the existing
app does not need a full rewrite.

## Required user experience

1.  User imports, pastes, or selects a screenshot from an online chess
    game.
2.  App checks whether a chessboard is present.
3.  App locates the board area and maps it into an 8×8 grid.
4.  AI classifies each square as empty or one of the 12 colored chess
    piece classes.
5.  App corrects board orientation when possible.
6.  App builds a FEN position-placement string.
7.  App composes a full FEN only when the necessary metadata is known. A
    screenshot alone generally cannot reliably reveal side-to-move,
    castling rights, en-passant square, or move counters.
8.  App shows the detected board and confidence information to the user.
9.  If detection is uncertain, show a manual correction/edit board
    instead of silently accepting a potentially wrong position.
10. Pass the confirmed position into the project's existing chess
    analysis or Stockfish flow.

## Implementation tasks for the coding agent

### Phase 1 --- Inspect before editing

-   Read the entire project structure and identify its language, UI,
    board representation, image pipeline, and current piece-recognition
    code.
-   Locate existing modules such as board detection, square cropping,
    templates, recognition, FEN generation, and Stockfish integration
    (names may differ).
-   Explain where the new recognizer should be connected.
-   Do not delete or rewrite existing working features without a clear
    reason.
-   Do not download a model until confirming whether it is already
    present.

### Phase 2 --- Integrate recognition

-   Add a dedicated screenshot-recognition module/service.
-   Use Fenshot's `chess-tiles-v2.onnx` model as the primary model.
-   Add the necessary runtime assets for the chosen platform.
-   Keep all inference local; do not upload screenshots or positions to
    a server.
-   Add a file/image input pathway that accepts PNG, JPEG, and other
    formats supported by the app.
-   Detect the board region automatically; do not require the user to
    crop it manually for the normal workflow.
-   Recognize empty squares and all white/black piece classes.
-   Resolve board orientation where supported.
-   Return the recognized placement, board bounds,
    confidence/reliability, and an error state if no board is found.
-   Convert the placement into FEN using the project's existing FEN
    utility if possible.
-   Do not invent game metadata. Ask the user to select whose turn it is
    if needed; make castling rights and other unavailable fields
    editable or use explicitly documented defaults.
-   Retain the existing template recognizer as a fallback if it is
    useful and working.

### Phase 3 --- UI and error handling

Add a clear action such as **"Scan Chess Screenshot"**.

Show: - screenshot preview; - detected 8×8 board; - generated FEN; -
confidence/reliability indicator; - editable squares for corrections; -
"Use Position" / "Analyze Position" action.

Handle: - no board found; - cropped or partially visible board; -
unsupported/custom piece theme; - low-confidence squares; - rotated or
flipped orientation; - invalid or impossible chess position; -
runtime/model loading failure.

Never present a low-confidence scan as definitely correct.

### Phase 4 --- Testing

Test with screenshots from: - Chess.com light and dark board themes; -
Lichess light and dark themes; - both White-at-bottom and
Black-at-bottom orientations; - starting positions and mid-game
positions; - screenshots with surrounding app UI; - highlighted last
moves; - different piece sets; - resized or compressed screenshots.

For each test, compare the generated piece placement against a known
correct FEN. Record failures and fix preprocessing or integration
issues. Test offline after the assets have been installed.

## Size and performance targets

-   AI model: approximately 1.3 MB, according to the Fenshot README.
-   User's requested model cap: **100 MB maximum**.
-   Keep total added assets small; report model size and runtime size
    separately.
-   Avoid downloading a large general-purpose vision model.
-   Aim for a responsive scan on ordinary devices, but measure
    performance on the actual target hardware rather than promising a
    fixed speed.

## Definition of done

The feature is complete when:

-   A user can provide an online chess-game screenshot.
-   The app automatically detects the board and its 64 squares.
-   Pieces and empty squares are recognized correctly on supported
    themes.
-   A valid piece-placement string and editable FEN are produced.
-   Low-confidence scans can be corrected manually.
-   The confirmed position reaches the existing chess analysis/engine
    flow.
-   Recognition works offline and the AI model is below 100 MB.
-   Existing features remain intact.

## Instructions to the coding agent

Implement this in the existing project, not as a separate demo. First
inspect the repository and provide a short plan that names the files to
be changed and explains how Fenshot's browser-first runtime will fit the
project's actual stack. Then implement in small steps, run the available
tests, and summarize: - files changed; - model and runtime files
added; - actual model/asset sizes; - how to use the screenshot scan
feature; - test results; - known limitations.

Do not claim the feature works until it has been tested with real
screenshots.
