"""Find a board inside a bigger picture (for example a photo of a screen).
Used only as a fallback when the normal screenshot finder fails."""
import os, sys, itertools
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import boardlib as B
from ai_recognize import recognize_ai


def _candidates(img, K=8):
    """Square-ish blobs made of two of the picture's main colours."""
    H, W = img.shape[:2]
    sc = 800.0 / max(H, W)
    small = cv2.resize(img, (int(W * sc), int(H * sc)), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB)
    h, w = lab.shape[:2]
    data = lab.reshape(-1, 3).astype("float32")
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 1.0)
    cv2.setRNGSeed(1)
    _, _, centers = cv2.kmeans(data[::4], K, None, crit, 1, cv2.KMEANS_PP_CENTERS)
    labels = ((data[:, None, :] - centers[None, :, :]) ** 2).sum(2).argmin(1).reshape(h, w)
    seen, out = set(), []
    for i, j in itertools.combinations(range(K), 2):
        m = (((labels == i) | (labels == j)) * 255).astype("uint8")
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            x, y, bw, bh = cv2.boundingRect(c)
            if bw < 0.2 * w or not (0.9 < bw / bh < 1.1):
                continue
            if cv2.contourArea(c) / float(bw * bh) < 0.7:
                continue
            key = (x // 12, y // 12, bw // 12)
            if key not in seen:
                seen.add(key)
                out.append((x / sc, y / sc, bw / sc))
    return out


def _quality(img, box):
    """How sure is the AI about this crop? (higher = better)"""
    x, y, s = box
    H, W = img.shape[:2]
    if x < 0 or y < 0 or s < 100 or x + s > W or y + s > H:
        return -1.0
    _, conf = recognize_ai(img[y:y+s, x:x+s])
    flat = np.array(conf).ravel()
    return 0.5 * float(flat.min()) + 0.5 * float(flat.mean())


def _polish(img, box):
    """Nudge x, y, size a few pixels at a time while the AI gets more confident."""
    best = tuple(int(round(v)) for v in box)
    bq = _quality(img, best)
    for step in (8, 4, 2):
        improved = True
        while improved:
            improved = False
            for d in ((step, 0, 0), (-step, 0, 0), (0, step, 0), (0, -step, 0),
                      (0, 0, step), (0, 0, -step)):
                cand = (best[0] + d[0], best[1] + d[1], best[2] + d[2])
                q = _quality(img, cand)
                if q > bq + 1e-4:
                    best, bq, improved = cand, q, True
    return best, bq


def photo_box(img):
    """Returns ((x, y, size), quality) or (None, 0)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    ii = B._integral(gray)
    scored = []
    for cx, cy, cs in _candidates(img):
        x, y, s = B._refine(gray, (cx, cy, cs), rng=max(10, int(0.04 * cs)))
        f = B._checker_score(ii, np.array([[x, y, s]]), max(6, int(s / 60)))[0]
        scored.append((f, (x, y, s)))
    scored.sort(reverse=True)
    best, bq = None, 0.0
    for f, box in scored[:3]:                 # polish the three most board-like
        if f < 0.5:
            continue
        pb, q = _polish(img, box)
        if q > bq:
            best, bq = pb, q
    return best, bq