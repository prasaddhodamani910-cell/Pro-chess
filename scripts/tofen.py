import cv2, pickle, sys, chess
from boardlib import *

name, tfile = sys.argv[1], sys.argv[2]
turn = sys.argv[3]                      # w or b
y = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else None

templates = pickle.load(open(tfile, "rb"))
img = cv2.imread(name)
board = find_board(img, y)
if board is None:
    print("Board not found. Add the Y number at the end.")
    raise SystemExit
cv2.imwrite("output/preview.png", board)

grid = recognize_grid(split(board), templates)
if "flip" in sys.argv:
    grid = flip_grid(grid)
fen = grid_to_fen(grid, turn)
print("FEN:", fen)

b = chess.Board(fen)
print(b)
print("Valid position:", b.is_valid())