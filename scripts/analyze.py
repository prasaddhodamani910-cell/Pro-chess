import cv2, pickle, sys, chess, chess.engine
from boardlib import *

name, tfile, turn = sys.argv[1], sys.argv[2], sys.argv[3]
flip = "flip" in sys.argv
nums = [a for a in sys.argv[4:] if a.isdigit()]
y = int(nums[0]) if nums else None

templates = pickle.load(open(tfile, "rb"))
img = cv2.imread(name)
board = find_board(img, y)
if board is None:
    print("Board not found. Add the Y number.")
    raise SystemExit

grid = recognize_grid(split(board), templates, show="scores" in sys.argv)
if "noflip" not in sys.argv and needs_flip(grid):
    grid = flip_grid(grid)
fen = grid_to_fen(grid, turn)
print("FEN:", fen)

b = chess.Board(fen)
if not b.is_valid():
    print("Invalid position, check the recognition first.")
    raise SystemExit

engine = chess.engine.SimpleEngine.popen_uci("stockfish")
info = engine.analyse(b, chess.engine.Limit(time=3))
engine.quit()

move = info["pv"][0]
print("Best move:", b.san(move))
print("Score:", info["score"].pov(b.turn))