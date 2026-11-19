"""Universal Board Detector for PC & Mobile."""
import cv2
import numpy as np


def _integral(gray):
    return cv2.integral(gray.astype("float32"))


def _patch_means(ii, xs, ys, size):
    H1, W1 = ii.shape
    x0 = np.clip(xs, 0, W1 - 1 - size).astype(int)
    y0 = np.clip(ys, 0, H1 - 1 - size).astype(int)
    x1, y1 = x0 + size, y0 + size
    return (ii[y1, x1] - ii[y0, x1] - ii[y1, x0] + ii[y0, x0]) / (size * size)


def _checker_score(ii, cand, size):
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
    for step, span, n in ((2, rng, 48), (1, 3, 64)):
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
    H, W = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ii = _integral(gray)

    # 1. Whole image is square
    if 0.88 <= W / H <= 1.14 and min(H, W) >= 120:
        s = min(H, W)
        sc = _checker_score(ii, np.array([[0, 0, s]]), max(4, int(s / 60)))[0]
        if sc >= 0.70:
            return (0, 0, s)

    # 2. Contour candidate search
    edges = cv2.dilate(cv2.Canny(gray, 50, 150), None, iterations=2)
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cands = []
    for c in cnts:
        x, yy, w, h = cv2.boundingRect(c)
        if 0.85 < w / h < 1.15 and min(w, h) >= 140:
            cands.append((x, yy, min(w, h)))

    if cands:
        cands_arr = np.array(cands)
        scores = _checker_score(ii, cands_arr, max(4, int(cands_arr[:, 2].mean() / 60)))
        best_i = int(np.argmax(scores))
        if scores[best_i] >= 0.65:
            return _refine(gray, cands[best_i])

    # 3. Multi-scale search
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

    return None


def crop_board(img):
    box = auto_box(img)
    if box is None:
        return None
    x, y, s = box
    return img[y:y+s, x:x+s]
