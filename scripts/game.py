import cv2, pickle, sys, os, chess, chess.engine
from boardlib import *

# ---------- 1. Read what you typed after "python scripts/game.py" ----------
folder = sys.argv[1]      # folder with the screenshots
tfile = sys.argv[2]       # template file (.pkl), ignored when "ai" is used
turn = sys.argv[3]        # w or b: who moves in the FIRST screenshot

y = None
box = None
show = "scores" in sys.argv          # add the word "scores" to see match scores
use_ai = "ai" in sys.argv            # add the word "ai" to use the AI model
for a in sys.argv[4:]:
    if a.isdigit():
        y = int(a)                   # a plain number = board Y position
    elif a.startswith("crop="):      # crop=X,Y,SIZE
        box = tuple(int(v) for v in a[5:].split(","))

DROP_LIMIT = 150                     # 150 = 1.5 pawns; lower = more sensitive
AI_LOW = 0.80                        # AI confidence below this = check by eye

# ---------- 2. Load the recognizer and start Stockfish ----------
if use_ai:
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, "..", "ai"))
    from ai_recognize import recognize_ai
    templates = None
else:
    templates = pickle.load(open(tfile, "rb"))

engine = chess.engine.SimpleEngine.popen_uci("stockfish")

files = sorted(f for f in os.listdir(folder)
               if f.lower().endswith((".png", ".jpg", ".jpeg")))
other = "b" if turn == "w" else "w"

prev = None          # evaluation of the previous position
prev_best = None     # best move in the previous position

# ---------- 3. Go through the screenshots one by one ----------
for i, name in enumerate(files):
    img = cv2.imread(os.path.join(folder, name))
    if img is None:
        print(name, "can't open")
        prev = prev_best = None
        continue

    board = find_board(img, y, box)
    if board is None or board.size == 0:
        print(name, "board not found")
        prev = prev_best = None
        continue
    if i == 0:
        cv2.imwrite("output/preview.png", board)

    # screenshot -> grid of pieces
    minc = None
    if use_ai:
        grid, conf = recognize_ai(board)
        minc = min(min(row) for row in conf)      # weakest square
    else:
        grid = recognize_grid(split(board), templates, max_score=40,
                              show=(show and i == 0))

    # grid -> FEN
    if needs_flip(grid):
        grid = flip_grid(grid)
    side = turn if i % 2 == 0 else other      # whose move it is now
    b = chess.Board(grid_to_fen(grid, side))
    if not b.is_valid():
        print(name, "invalid position:", b.board_fen())
        prev = prev_best = None
        continue

    # ---------- 4. Ask Stockfish ----------
    info = engine.analyse(b, chess.engine.Limit(time=1))
    cur = info["score"].white().score(mate_score=10000)   # +  = White better
    best = b.san(info["pv"][0]) if info.get("pv") else None

    line = f"{name}  eval {cur/100:+.2f}  {b.board_fen()}"
    if minc is not None:
        line += f"  [ai {minc:.2f}" + (" LOW]" if minc < AI_LOW else "]")

    # ---------- 5. Did the last move make things worse? ----------
    if prev is not None:
        mover = "White" if side == "b" else "Black"   # who just moved
        loss = (prev - cur) if side == "b" else (cur - prev)
        if loss > DROP_LIMIT:
            line += (f"   <-- big drop by {mover} ({loss/100:.1f} pawns),"
                     f" better was {prev_best}")
    print(line)

    prev = cur
    prev_best = best

engine.quit()