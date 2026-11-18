"""AI Vision Recognizer using Fenshot ONNX Model."""
import os, sys, cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)


def get_model_path():
    if hasattr(sys, "_MEIPASS"):
        m = os.path.join(sys._MEIPASS, "models", "chess-tiles-v2.onnx")
        if os.path.exists(m):
            return m
    local_m = os.path.join(APP_ROOT, "models", "chess-tiles-v2.onnx")
    if os.path.exists(local_m):
        return local_m
    root_m = os.path.join(os.path.dirname(APP_ROOT), "ai", "models", "chess-tiles-v2.onnx")
    return root_m


LABELS = "1KQRBNPkqrbnp"
_net = None


def _load_net():
    global _net
    if _net is None:
        p = get_model_path()
        if not os.path.exists(p):
            raise FileNotFoundError(f"AI ONNX model not found: {p}")
        _net = cv2.dnn.readNetFromONNX(p)
    return _net


def recognize_board_image(board_bgr):
    """Classify 64 squares from an extracted 8x8 board image."""
    gray = cv2.cvtColor(board_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (256, 256), interpolation=cv2.INTER_LINEAR)
    gray = gray.astype("float32") / 255.0

    tiles = np.zeros((64, 1024), dtype="float32")
    for r in range(8):
        for c in range(8):
            t = gray[r*32:(r+1)*32, c*32:(c+1)*32]
            tiles[r*8 + c] = t.reshape(1024)

    net = _load_net()
    net.setInput(tiles)
    out = np.array(net.forward()).reshape(64, 13)

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

    # Orientation check: White pieces usually on bottom
    w_rows = [r for r in range(8) for c in range(8) if grid[r][c].isupper()]
    b_rows = [r for r in range(8) for c in range(8) if grid[r][c].islower()]
    if w_rows and b_rows and (sum(w_rows) / len(w_rows) < sum(b_rows) / len(b_rows)):
        grid = [row[::-1] for row in grid[::-1]]
        conf = [row[::-1] for row in conf[::-1]]

    min_conf = min(min(r) for r in conf)
    return grid, min_conf


def grid_to_fen(grid, turn="w"):
    rows = []
    for row in grid:
        s, empty = "", 0
        for p in row:
            if p == ".":
                empty += 1
            else:
                if empty:
                    s += str(empty)
                    empty = 0
                s += p
        if empty:
            s += str(empty)
        rows.append(s)
    return "/".join(rows) + f" {turn} - - 0 1"
