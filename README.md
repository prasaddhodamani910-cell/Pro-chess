# Chess board tools

## Folders

- `scripts/` contains the Python utilities. Run them from the project root, for example `python scripts/recognize.py ...`.
- `assets/screenshots/` contains the Chess.com and Lichess example screenshots.
- `assets/templates/` contains the piece templates (`t_chesscom.pkl` and `t_lichess.pkl`).
- `output/` contains generated previews, square crops, and board-search images. These files can be regenerated.

`analyze.py` and `tofen.py` accept an image path and a template path as arguments. `recognize.py` and `make_templates.py` do as well. Generated preview images are written to `output/preview.png`.

## AI mode
Add the word `ai` to tofen.py, analyze.py or game.py to use the AI recognizer
in `ai/` (Fenshot chess-tiles-v2 model, MIT license, see ai/models/LICENSE-fenshot).
Without `ai`, the template recognizer is used.