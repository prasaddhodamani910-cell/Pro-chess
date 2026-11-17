import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import analyze_image

# python scripts/scan.py IMAGE TURN [ai] [crop=X,Y,SIZE] [flip|noflip] [templates=FILE]
path, turn = sys.argv[1], sys.argv[2]
use_ai = "ai" in sys.argv
crop = None
tfile = None
flip = None
for a in sys.argv[3:]:
    if a.startswith("crop="):
        crop = tuple(int(v) for v in a[5:].split(","))
    elif a.startswith("templates="):
        tfile = a[10:]
    elif a == "flip":
        flip = True
    elif a == "noflip":
        flip = False

res = analyze_image(path, turn, use_ai, tfile, crop, None, flip)
if not res["ok"]:
    print("Error:", res["error"])
    raise SystemExit
print(res["board_text"])
print("FEN:", res["fen"])
if res["min_conf"] is not None:
    print("AI confidence: %.2f" % res["min_conf"] +
          ("   LOW: check the board by eye" if res["low_conf"] else ""))
if res["error"]:
    print("Error:", res["error"])
else:
    print("Best move:", res["best_move"])
    print("Score:", res["score"])