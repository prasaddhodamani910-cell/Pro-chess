import cv2, pickle, sys, os, chess, chess.engine
from boardlib import *

# ---------- 1. Read what you typed after "python scripts/game.py" ----------
folder = sys.argv[1]      # folder with the screenshots
tfile = sys.argv[2]       # template file (.pkl), ignored when "ai" is used
turn = sys.argv[3]        # w or b: who moves in the FIRST screenshot

y = None
box = None
start_num = 1                        # move number of the FIRST screenshot
show = "scores" in sys.argv          # show template match scores
use_ai = "ai" in sys.argv            # use the AI model
show_fen = "fen" in sys.argv         # print the board FEN on every line
for a in sys.argv[4:]:
    if a.isdigit():
        y = int(a)                   # a plain number = board Y position
    elif a.startswith("crop="):      # crop=X,Y,SIZE
        box = tuple(int(v) for v in a[5:].split(","))
    elif a.startswith("move="):      # move=3 -> first screenshot is move 3
        start_num = int(a[5:])

DROP_LIMIT = 150                     # 150 = 1.5 pawns; lower = more sensitive
AI_LOW = 0.80                        # AI confidence below this = check by eye


def find_move(prev_board, cur_placement):
    """Which move turns the previous position into the current one?
    Returns it in normal notation (like Nf3), or None if no move fits."""
    pb = prev_board.copy()
    pb.castling_rights = chess.BB_CORNERS        # allow castling to be found
    pb.castling_rights = pb.clean_castling_rights()
    for m in list(pb.legal_moves):
        san = pb.san(m)
        pb.push(m)
        same = pb.board_fen() == cur_placement
        pb.pop()
        if same:
            return san
    return None


def label(num, side, san):
    """5.Qd3 for White, 5...Qxd3 for Black."""
    return f"{num}.{san}" if side == "w" else f"{num}...{san}"


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

prev = None            # evaluation of the previous position
prev_best = None       # best move label in the previous position
prev_board = None      # the previous position as a chess board
prev_side = None       # who was to move in the previous position
prev_num = None        # move number of the previous position
mistakes = []          # list of (move label, pawns lost)

# ---------- 3. Go through the screenshots one by one ----------
for i, name in enumerate(files):
    img = cv2.imread(os.path.join(folder, name))
    if img is None:
        print(name, "can't open")
        prev = prev_best = prev_board = None
        continue

    board = find_board(img, y, box)
    if board is None or board.size == 0:
        print(name, "board not found")
        prev = prev_best = prev_board = None
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

    # grid -> chess position
    if needs_flip(grid):
        grid = flip_grid(grid)
    side = turn if i % 2 == 0 else other          # whose move it is now
    num = start_num + (i + (1 if turn == "b" else 0)) // 2
    b = chess.Board(grid_to_fen(grid, side))
    if not b.is_valid():
        print(name, "invalid position:", b.board_fen())
        prev = prev_best = prev_board = None
        continue

    # ---------- 4. Which move was played to get here? ----------
    played = "start"
    if prev_board is not None:
        san = find_move(prev_board, b.board_fen())
        played = label(prev_num, prev_side, san) if san else "?"

    # ---------- 5. Ask Stockfish ----------
    info = engine.analyse(b, chess.engine.Limit(time=1))
    cur = info["score"].white().score(mate_score=10000)   # + = White better
    best = label(num, side, b.san(info["pv"][0])) if info.get("pv") else None

    line = f"{name}  {played}  eval {cur/100:+.2f}"
    if show_fen:
        line += f"  {b.board_fen()}"
    if minc is not None and minc < AI_LOW:
        line += f"  [ai LOW {minc:.2f}]"

    # ---------- 6. Did that move make things worse? ----------
    if prev is not None:
        mover = "White" if side == "b" else "Black"       # who just moved
        loss = (prev - cur) if side == "b" else (cur - prev)
        if loss > DROP_LIMIT:
            line += (f"   <-- big drop by {mover} ({loss/100:.1f} pawns),"
                     f" better was {prev_best}")
            mistakes.append((played, loss / 100))
    print(line)

    prev, prev_best = cur, best
    prev_board, prev_side, prev_num = b, side, num

engine.quit()

# ---------- 7. Summary ----------
print()
if mistakes:
    print("Mistakes:", ", ".join(f"{m} ({p:.1f})" for m, p in mistakes))
else:
    print("No big drops found.")