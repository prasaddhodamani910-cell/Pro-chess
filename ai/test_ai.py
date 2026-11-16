import os, sys, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
from boardlib import find_board, flip_grid, needs_flip, grid_to_fen
from ai_recognize import recognize_ai, weak_squares

name = sys.argv[1]
box = None
expect = None
for a in sys.argv[2:]:
    if a.startswith("crop="):
        box = tuple(int(v) for v in a[5:].split(","))
    elif a.startswith("expect="):
        expect = a[7:]

img = cv2.imread(name)
if img is None:
    print("Can't open", name)
    raise SystemExit
board = find_board(img, None, box)
if board is None or board.size == 0:
    print("Board not found")
    raise SystemExit

grid, conf = recognize_ai(board)
if needs_flip(grid):
    grid = flip_grid(grid)
    conf = flip_grid(conf)

for row in grid:
    print(" ".join(row))

placement = grid_to_fen(grid).split(" ")[0]
print("Placement:", placement)
print("Lowest confidence: %.2f" % min(min(r) for r in conf))
weak = weak_squares(conf)
print("Weak squares (<0.90):", [(r, c, round(v, 2)) for r, c, v in weak] or "none")

if expect:
    print("MATCH" if placement == expect else "DIFFERENT from expected")