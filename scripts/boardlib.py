import cv2

def find_board(img, y=None):
    H, W = img.shape[:2]
    if y is not None:                 # manual mode: board is full width
        return img[y:y+W, 0:W]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.dilate(cv2.Canny(gray, 50, 150), None, iterations=2)
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best, area = None, 0
    for c in cnts:
        x, yy, w, h = cv2.boundingRect(c)
        if 0.9 < w / h < 1.1 and w > W * 0.5 and w * h > area:
            best, area = (x, yy, w, h), w * h
    if best is None:
        return None
    x, yy, w, h = best
    s = min(w, h)
    return img[yy:yy+s, x:x+s]

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

def recognize_grid(squares, templates):
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