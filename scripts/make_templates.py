import cv2, pickle, sys
from boardlib import *

img = cv2.imread(sys.argv[1])
y = int(sys.argv[3]) if len(sys.argv) > 3 else None
board = find_board(img, y)
if board is None:
    print("Board not found. Add the Y number at the end of the command.")
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