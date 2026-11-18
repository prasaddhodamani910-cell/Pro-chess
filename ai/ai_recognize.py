import os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "models", "chess-tiles-v2.onnx")
LABELS = "1KQRBNPkqrbnp"          # index 0 = empty square

_net = None


def _load():
    global _net
    if _net is None:
        if not os.path.exists(MODEL):
            raise FileNotFoundError("Model not found: " + MODEL)
        _net = cv2.dnn.readNetFromONNX(MODEL)
    return _net


def recognize_ai(board):
    """board: BGR image that contains exactly the 8x8 board.
    Returns (grid, conf): 8x8 lists of piece letters ('.' = empty)
    and of confidences (0 to 1), top-left square first."""
    gray = cv2.cvtColor(board, cv2.COLOR_BGR2GRAY)
    # Remove high-frequency screen moiré before downsampling if board is high-res
    if gray.shape[0] > 400:
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
    gray = cv2.resize(gray, (256, 256), interpolation=cv2.INTER_AREA)

    # Stretch contrast if camera backlight washed out the blacks/whites
    lo, hi = np.percentile(gray, (2, 98))
    if hi - lo > 20 and (lo > 25 or hi < 230):
        gray = np.clip((gray.astype("float32") - lo) * (255.0 / (hi - lo)), 0, 255)

    gray = gray.astype("float32") / 255.0

    tiles = np.zeros((64, 1024), dtype="float32")
    for r in range(8):
        for c in range(8):
            t = gray[r*32:(r+1)*32, c*32:(c+1)*32]
            tiles[r*8 + c] = t.reshape(1024)

    net = _load()
    net.setInput(tiles)
    out = np.array(net.forward()).reshape(64, 13)

    # make sure rows are probabilities (they should already be)
    if out.min() < 0 or abs(out.sum(axis=1).mean() - 1.0) > 0.05:
        e = np.exp(out - out.max(axis=1, keepdims=True))
        out = e / e.sum(axis=1, keepdims=True)

    grid, conf = [], []
    for r in range(8):
        grow, crow = [], []
        for c in range(8):
            p = out[r*8 + c]
            k = int(p.argmax())
            grow.append("." if k == 0 else LABELS[k])
            crow.append(float(p[k]))
        grid.append(grow)
        conf.append(crow)
    return grid, conf



def weak_squares(conf, limit=0.9):
    """List of (row, col, confidence) below the limit."""
    return [(r, c, conf[r][c]) for r in range(8) for c in range(8)
            if conf[r][c] < limit]