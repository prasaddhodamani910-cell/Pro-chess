import cv2, pickle, sys
from boardlib import *

img = cv2.imread(sys.argv[1])
if img is None:
    print("Can't open", sys.argv[1])
    raise SystemExit
y = None
box = None
for a in sys.argv[3:]:
    if a.isdigit():
        y = int(a)
    elif a.startswith("crop="):
        box = tuple(int(v) for v in a[5:].split(","))

board = find_board(img, y, box)
if board is None or board.size == 0:
    print("Board not found.")
    raise SystemExit
cv2.imwrite("output/preview.png", board)
squares = split(board)

layout = {0: "rnbqkbnr", 1: "pppppppp",
          6: "PPPPPPPP", 7: "RNBQKBNR"}

templates = {}
for r, row in layout.items():
    for c, piece in enumerate(row):
        templates.setdefault(piece, []).append(features(squares[r][c]))

pickle.dump(templates, open(sys.argv[2], "wb"))
print("Saved", len(templates), "piece types")