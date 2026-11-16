import cv2, pickle, sys, os, chess
from boardlib import *

name, tfile = sys.argv[1], sys.argv[2]
turn = sys.argv[3]                      # w or b

y = None
box = None
use_ai = "ai" in sys.argv               # add the word "ai" to use the AI model
for a in sys.argv[4:]:
    if a.isdigit():
        y = int(a)                      # a plain number = board Y position
    elif a.startswith("crop="):         # crop=X,Y,SIZE
        box = tuple(int(v) for v in a[5:].split(","))

img = cv2.imread(name)
if img is None:
    print("Can't open", name)
    raise SystemExit
board = find_board(img, y, box)
if board is None or board.size == 0:
    print("Board not found. Add the Y number or crop=X,Y,SIZE.")
    raise SystemExit
cv2.imwrite("output/preview.png", board)

if use_ai:
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, "..", "ai"))
    from ai_recognize import recognize_ai, weak_squares
    grid, conf = recognize_ai(board)
else:
    templates = pickle.load(open(tfile, "rb"))
    grid = recognize_grid(split(board), templates, show="scores" in sys.argv)
    conf = None

if "flip" in sys.argv:
    grid = flip_grid(grid)
    if conf: conf = flip_grid(conf)
elif "noflip" not in sys.argv and needs_flip(grid):
    grid = flip_grid(grid)
    if conf: conf = flip_grid(conf)

fen = grid_to_fen(grid, turn)
print("FEN:", fen)

b = chess.Board(fen)
print(b)
print("Valid position:", b.is_valid())

if conf:
    low = min(min(row) for row in conf)
    print("AI lowest confidence: %.2f" % low)
    if low < 0.80:
        print("LOW confidence: check the board by eye before trusting it.")