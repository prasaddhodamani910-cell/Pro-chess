"""Tiny local web page: pick a screenshot, get the best move.
Run:  python scripts/web.py   then open  http://127.0.0.1:8000  in your browser.
It only listens on this device (127.0.0.1), nobody else can reach it."""
import os, sys, tempfile
from flask import Flask, request, render_template_string

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pipeline

ROOT = os.path.dirname(HERE)
TEMPLATES = os.path.join(ROOT, "assets", "templates", "t_review.pkl")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024      # uploads up to 20 MB

PAGE = """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chess screenshot analyzer</title>
<style>
 body{font-family:sans-serif;background:#161512;color:#ddd;margin:0;padding:16px;max-width:560px;margin:auto}
 h1{font-size:20px} label{display:block;margin:10px 0 4px}
 input,select,button{font-size:16px;padding:10px;border-radius:8px;border:0;width:100%;box-sizing:border-box}
 button{background:#629924;color:#fff;margin-top:14px}
 .card{background:#262421;border-radius:10px;padding:12px;margin-top:16px}
 .big{font-size:28px;font-weight:bold;color:#9fd356}
 .warn{color:#ffb74d} .err{color:#ef5350}
 code{word-break:break-all;font-size:13px} a{color:#7fb3ff}
 svg{max-width:100%;height:auto}
</style></head><body>
<h1>Chess screenshot analyzer</h1>
<form method="post" enctype="multipart/form-data">
 <label>Screenshot</label>
 <input type="file" name="shot" accept="image/*" required>
 <label>Side to move</label>
 <select name="turn">
  <option value="w" {{ 'selected' if turn=='w' }}>White</option>
  <option value="b" {{ 'selected' if turn=='b' }}>Black</option>
 </select>
 <label>Board orientation</label>
 <select name="flip">
  <option value="auto">Auto</option>
  <option value="flip">Force flip</option>
  <option value="noflip">Never flip</option>
 </select>
 <label><input type="checkbox" name="ai" checked style="width:auto"> Use AI reader</label>
 <button type="submit">Analyze</button>
</form>

{% if error %}<div class="card err">{{ error }}</div>{% endif %}
{% if res and res.ok %}
 <div class="card">
  {% if svg %}{{ svg|safe }}{% endif %}
  {% if res.best_move %}
   <div class="big">{{ res.best_move }}</div>
   <div>Score: {{ res.score }} (for the side to move)</div>
  {% endif %}
  {% if res.min_conf is not none %}
   <div class="{{ 'warn' if res.low_conf }}">AI confidence: {{ '%.2f'|format(res.min_conf) }}
   {% if res.low_conf %}: LOW, compare the board above with your screenshot{% endif %}</div>
  {% endif %}
  {% if res.error %}<div class="err">{{ res.error }}</div>{% endif %}
  <p>FEN:<br><code>{{ res.fen }}</code></p>
  <a href="https://lichess.org/analysis/{{ res.fen.replace(' ', '_') }}" target="_blank" rel="noopener">Open this position on Lichess</a>
 </div>
{% endif %}
</body></html>"""


def board_svg(fen, best, turn):
    """Draw the position the program read, with an arrow for the best move."""
    try:
        import chess, chess.svg
        b = chess.Board(fen)
        arrows = []
        if best:
            m = b.parse_san(best)
            arrows = [chess.svg.Arrow(m.from_square, m.to_square, color="#2e8b57cc")]
        return chess.svg.board(b, size=340, arrows=arrows, flipped=(turn == "b"))
    except Exception:
        return None


@app.route("/", methods=["GET", "POST"])
def index():
    res = svg = error = None
    turn = "w"
    if request.method == "POST":
        turn = "b" if request.form.get("turn") == "b" else "w"
        f = request.files.get("shot")
        if not f or not f.filename:
            error = "Choose a screenshot first."
        else:
            fd, path = tempfile.mkstemp(suffix=".img")   # our own name, never the uploaded one
            os.close(fd)
            try:
                f.save(path)
                flip = {"flip": True, "noflip": False}.get(request.form.get("flip"))
                use_ai = request.form.get("ai") == "on"
                res = pipeline.analyze_image(path, turn, use_ai, TEMPLATES,
                                             None, None, flip)
            finally:
                os.remove(path)                          # always delete the upload
            if not res["ok"]:
                error, res = res["error"], None
            else:
                svg = board_svg(res["fen"], res["best_move"], turn)
    return render_template_string(PAGE, res=res, svg=svg, error=error, turn=turn)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)