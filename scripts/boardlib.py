import cv2
import numpy as np


# ---------- automatic board finder (checkerboard pattern + edge refine) ----------

def _integral(gray):
    return cv2.integral(gray.astype("float32"))


def _patch_means(ii, xs, ys, size):
    H1, W1 = ii.shape
    x0 = np.clip(xs, 0, W1 - 1 - size).astype(int)
    y0 = np.clip(ys, 0, H1 - 1 - size).astype(int)
    x1, y1 = x0 + size, y0 + size
    return (ii[y1, x1] - ii[y0, x1] - ii[y1, x0] + ii[y0, x0]) / (size * size)


def _checker_score(ii, cand, size):
    """How much does each candidate box look like an 8x8 two-colour checkerboard?"""
    N = len(cand)
    x0 = cand[:, 0][:, None, None].astype(float)
    y0 = cand[:, 1][:, None, None].astype(float)
    sq = cand[:, 2][:, None, None].astype(float) / 8
    r = np.arange(8)[None, :, None]
    c = np.arange(8)[None, None, :]
    xs = np.broadcast_to(x0 + c * sq + 0.12 * sq, (N, 8, 8))
    ys = np.broadcast_to(y0 + r * sq + 0.12 * sq, (N, 8, 8))
    v = _patch_means(ii, xs, ys, size)
    par = ((np.arange(8)[:, None] + np.arange(8)[None, :]) % 2).astype(bool)
    A, B = v[:, ~par], v[:, par]
    mA, mB = np.median(A, axis=1), np.median(B, axis=1)
    contrast = np.abs(mA - mB)
    tol = np.maximum(5.0, 0.15 * contrast)
    good = ((np.abs(A - mA[:, None]) < tol[:, None]).sum(1)
            + (np.abs(B - mB[:, None]) < tol[:, None]).sum(1))
    frac = good / 64.0
    frac[contrast < 12] = 0
    return frac


def _coarse(gray, sc=0.5):
    H, W = gray.shape
    sg = cv2.resize(gray, (int(W * sc), int(H * sc)), interpolation=cv2.INTER_AREA)
    ii = _integral(sg)
    h, w = sg.shape
    cands = []
    for x0 in range(0, int(0.2 * w), 2):
        for S in {w - x0, w - 2 * x0}:      # board touches the right edge, or is centred
            if S < 0.6 * w:
                continue
            for y0 in range(0, h - S + 1, 2):
                cands.append((x0, y0, S))
    if not cands:
        return None, 0.0
    cands = np.array(cands)
    frac = _checker_score(ii, cands, max(4, int(12 * sc / 0.5)))
    j = int(np.argmax(frac))
    top = cands[frac >= frac[j] - 1e-9]
    return np.median(top, axis=0) / sc, float(frac[j])


def _edge_energy(gx, gy, X0, Y0, S, n, W, H):
    ks = np.arange(0, 9)
    sq = S / 8
    t = np.linspace(0, S - 1, n).astype(int)
    hy = np.clip(np.round(Y0 + ks * sq).astype(int), 0, H - 1)
    vx = np.clip(np.round(X0 + ks * sq).astype(int), 0, W - 1)
    return (gy[hy[:, None], (X0 + t)[None, :]].sum()
            + gx[(Y0 + t)[:, None], vx[None, :]].sum())


def _refine(gray, box, rng=18):
    H, W = gray.shape
    x0, y0, S = [int(round(v)) for v in box]
    g = cv2.GaussianBlur(gray, (0, 0), 1.0).astype("float32")
    gx = np.abs(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3))
    gy = np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    best, bs = (x0, y0, S), -1.0
    for step, span, n in ((2, rng, 48), (1, 3, 64)):   # coarse pass, then fine pass
        cx, cy, cs = best
        for ds in range(-span, span + 1, step):
            for dx in range(-span, span + 1, step):
                for dy in range(-span, span + 1, step):
                    X0, Y0, S2 = cx + dx, cy + dy, cs + ds
                    if X0 < 0 or Y0 < 0 or X0 + S2 > W or Y0 + S2 > H:
                        continue
                    e = _edge_energy(gx, gy, X0, Y0, S2, n, W, H)
                    if e > bs:
                        bs, best = e, (X0, Y0, S2)
    return best


def auto_box(img):
    """Find the board automatically on PC or mobile. Returns (x, y, size) or None."""
    H, W = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ii = _integral(gray)

    # 1. Is the entire image already a cropped or nearly square board?
    if 0.88 <= W / H <= 1.14 and min(H, W) >= 120:
        s = min(H, W)
        sc_whole = _checker_score(ii, np.array([[0, 0, s]]), max(4, int(s / 60)))[0]
        if sc_whole >= 0.70:
            return (0, 0, s)

    # 2. If portrait (e.g. mobile screenshot), fast vertical-strip check
    if H >= W:
        box, frac = _coarse(gray)
        if box is not None and frac >= 0.75:
            return _refine(gray, box)

    # 3. Contour candidate search (PC desktop, browser windows, cropped regions)
    edges = cv2.dilate(cv2.Canny(gray, 50, 150), None, iterations=2)
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cands = []
    for c in cnts:
        x, yy, w, h = cv2.boundingRect(c)
        if 0.85 < w / h < 1.15 and min(w, h) >= 140:
            s = min(w, h)
            cands.append((x, yy, s))

    if cands:
        cands_arr = np.array(cands)
        scores = _checker_score(ii, cands_arr, max(4, int(cands_arr[:, 2].mean() / 60)))
        best_i = int(np.argmax(scores))
        if scores[best_i] >= 0.65:
            return _refine(gray, cands[best_i])

    # 4. Multi-scale sliding search for borderless / arbitrary desktop screenshots
    sc = 300.0 / max(H, W)
    sg = cv2.resize(gray, (int(W * sc), int(H * sc)), interpolation=cv2.INTER_AREA)
    ii_small = _integral(sg)
    sh, sw = sg.shape
    grid_cands = []
    min_s = max(8, int(120 * sc))
    max_s = min(sh, sw)
    for S in range(min_s, max_s + 1, max(4, int(24 * sc))):
        step = max(2, int(S // 8))
        for y0 in range(0, sh - S + 1, step):
            for x0 in range(0, sw - S + 1, step):
                grid_cands.append((x0, y0, S))

    if grid_cands:
        cands_arr = np.array(grid_cands)
        scores = _checker_score(ii_small, cands_arr, max(2, int(6 * sc / 0.5)))
        best_i = int(np.argmax(scores))
        if scores[best_i] >= 0.70:
            top_box = (grid_cands[best_i][0] / sc, grid_cands[best_i][1] / sc, grid_cands[best_i][2] / sc)
            return _refine(gray, top_box)

    # 5. Last resort fallback
    best, area = None, 0
    for c in cnts:
        x, yy, w, h = cv2.boundingRect(c)
        if 0.88 < w / h < 1.14 and w >= 150 and w * h > area:
            best, area = (x, yy, w, h), w * h
    if best is not None:
        x, yy, w, h = best
        s = min(w, h)
        return (x, yy, s)

    return None


def find_board(img, y=None, box=None):
    H, W = img.shape[:2]
    if box is not None:               # box = (x, y, size)
        bx, by, bs = box
        return img[by:by+bs, bx:bx+bs]
    if y is not None:                 # manual mode: board is full width
        return img[y:y+W, 0:W]
    auto = auto_box(img)              # automatic: look for the checkerboard
    if auto is not None:
        bx, by, bs = auto
        return img[by:by+bs, bx:bx+bs]
    return None


def split(board):
    step = board.shape[0] // 8
    return [[board[r*step:(r+1)*step, c*step:(c+1)*step]
             for c in range(8)] for r in range(8)]


def center(sq):
    h = sq.shape[0]
    m = int(h * 0.15)
    return sq[m:h-m, m:h-m]


def features(sq):
    g = cv2.cvtColor(center(sq), cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (32, 32))
    e = cv2.Canny(g, 50, 150)
    return cv2.GaussianBlur(e, (5, 5), 0).astype("float32")


def is_empty(sq):
    g = cv2.cvtColor(center(sq), cv2.COLOR_BGR2GRAY)
    return g.std() < 12


def recognize_grid(squares, templates, max_score=15, show=False):
    grid = []
    for r in range(8):
        row = []
        for c in range(8):
            sq = squares[r][c]
            if is_empty(sq):
                row.append(".")
                continue
            f = features(sq)
            best, best_score = "?", 1e9
            for piece, plist in templates.items():
                for t in plist:
                    score = abs(f - t).mean()
                    if score < best_score:
                        best, best_score = piece, score
            if show:
                print(f"{r}{c} {best} {best_score:.1f}")
            if max_score is not None and best_score > max_score:
                print(f"  dropped {r}{c} {best} {best_score:.1f}")
                row.append(".")
            else:
                row.append(best)
        grid.append(row)
    return grid


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


def flip_grid(grid):
    return [row[::-1] for row in grid[::-1]]


def needs_flip(grid):
    w_rows, b_rows = [], []
    for r in range(8):
        for c in range(8):
            p = grid[r][c]
            if p == ".":
                continue
            (w_rows if p.isupper() else b_rows).append(r)
    if not w_rows or not b_rows:
        return False
    return sum(w_rows) / len(w_rows) < sum(b_rows) / len(b_rows)