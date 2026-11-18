"""One entry point for reading a chess screenshot.
The command-line scripts and (later) the Android app both call this file.
It never prints; it returns a dictionary."""
import os, sys, pickle, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from boardlib import (find_board, split, recognize_grid, grid_to_fen,
                      flip_grid, needs_flip)

LOW_CONF = 0.80          # AI confidence below this = check the board by eye


def _photo_fallback(img):
    """Slower search for a small board inside a bigger picture (AI mode only)."""
    sys.path.insert(0, os.path.join(HERE, "..", "ai"))
    from photo_board import photo_box
    box, quality = photo_box(img)
    if box is None or quality < 0.6:
        return None
    x, y, s = box
    return img[y:y+s, x:x+s]


def read_board(img, use_ai=True, templates=None, crop=None, y=None, flip=None):
    """Screenshot (OpenCV image) -> grid of pieces.
    flip: None = auto, True = force flip, False = never flip."""
    board = find_board(img, y, crop)
    if (board is None or board.size == 0) and use_ai and crop is None and y is None:
        board = _photo_fallback(img)         # e.g. a photo of a screen
    if board is None or board.size == 0:
        return {"ok": False, "error": "Board not found"}

    conf = None
    if use_ai:
        sys.path.insert(0, os.path.join(HERE, "..", "ai"))
        from ai_recognize import recognize_ai
        grid, conf = recognize_ai(board)
    else:
        if templates is None:
            return {"ok": False, "error": "No templates given"}
        grid = recognize_grid(split(board), templates, max_score=40)

    do_flip = needs_flip(grid) if flip is None else flip
    if do_flip:
        grid = flip_grid(grid)
        if conf:
            conf = flip_grid(conf)
    low = min(min(r) for r in conf) if conf else None
    return {"ok": True, "grid": grid, "conf": conf, "min_conf": low,
            "board": board}


def analyze_image(path, turn="w", use_ai=True, templates_file=None,
                  crop=None, y=None, flip=None, think=3):
    """Screenshot file -> FEN, best move and score. Returns a dictionary:
    ok, error, fen, valid, min_conf, low_conf, best_move, score"""
    img = cv2.imread(path)
    if img is None:
        return {"ok": False, "error": "Can't open " + str(path)}

    templates = None
    if not use_ai:
        try:
            templates = pickle.load(open(templates_file, "rb"))
        except Exception as e:
            return {"ok": False, "error": "Templates: %s" % e}

    r = read_board(img, use_ai, templates, crop, y, flip)
    if not r["ok"]:
        return r

    import chess, chess.engine           # only needed from here on
    fen = grid_to_fen(r["grid"], turn)
    b = chess.Board(fen)
    out = {"ok": True, "error": None, "fen": fen, "board_text": str(b),
           "valid": b.is_valid(), "min_conf": r["min_conf"],
           "low_conf": r["min_conf"] is not None and r["min_conf"] < LOW_CONF,
           "best_move": None, "score": None}
    if not out["valid"]:
        out["error"] = "Invalid position: check the recognition first"
        return out

    path_sf = os.environ.get("STOCKFISH_PATH", "stockfish")
    try:
        engine = chess.engine.SimpleEngine.popen_uci(path_sf)
    except Exception as e:
        out["error"] = "Stockfish not found (%s)" % e
        return out
    try:
        info = engine.analyse(b, chess.engine.Limit(time=think))
    finally:
        engine.quit()
    out["best_move"] = b.san(info["pv"][0]) if info.get("pv") else None
    out["score"] = str(info["score"].pov(b.turn))
    return out