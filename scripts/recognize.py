import cv2, pickle, sys
from boardlib import *

name = sys.argv[1]            # image file
tfile = sys.argv[2]           # templates file

templates = pickle.load(open(tfile, "rb"))
img = cv2.imread(name)
if img is None:
    print("Can't open", name)
    raise SystemExit
y = int(sys.argv[3]) if len(sys.argv) > 3 else None
board = find_board(img, y)
if board is None:
    print("Board not found. Add the Y number at the end of the command.")
    raise SystemExit
cv2.imwrite("output/preview.png", board)
squares = split(board)

for r in range(8):
    line = ""
    for c in range(8):
        sq = squares[r][c]
        if is_empty(sq):
            line += ". "
            continue
        f = features(sq)
        best, best_score = "?", 1e9
        for piece, plist in templates.items():
            for t in plist:
                score = abs(f - t).mean()
                if score < best_score:
                    best, best_score = piece, score
        line += best + " "
    print(line)