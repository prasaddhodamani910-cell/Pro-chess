"""Tiny local web page: pick a screenshot OR use live camera to get the best move.
Run:  python scripts/web.py   then open  http://127.0.0.1:8000  in your browser.
It only listens on this device (127.0.0.1), nobody else can reach it."""
import os, sys, tempfile
from flask import Flask, request, render_template_string, jsonify

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pipeline

ROOT = os.path.dirname(HERE)
TEMPLATES = os.path.join(ROOT, "assets", "templates", "t_review.pkl")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024      # uploads up to 20 MB

PAGE = r"""<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chess board analyzer</title>
<style>
 body{font-family:sans-serif;background:#161512;color:#ddd;margin:0;padding:16px;max-width:560px;margin:auto}
 h1{font-size:20px;margin-bottom:12px}
 label{display:block;margin:10px 0 4px}
 input,select,button{font-size:16px;padding:10px;border-radius:8px;border:0;width:100%;box-sizing:border-box}
 input[type=range]{padding:0;margin:6px 0}
 button{background:#629924;color:#fff;margin-top:10px;cursor:pointer;font-weight:bold}
 button.sec{background:#3a3733}
 button.stop{background:#c62828}
 .tabs{display:flex;gap:8px;margin-bottom:12px}
 .tabs button{margin-top:0;background:#262421;color:#aaa}
 .tabs button.active{background:#629924;color:#fff}
 .row{display:flex;gap:8px}
 .card{background:#262421;border-radius:10px;padding:12px;margin-top:16px}
 .big{font-size:28px;font-weight:bold;color:#9fd356}
 .warn{color:#ffb74d} .err{color:#ef5350} .muted{color:#999;font-size:13px}
 code{word-break:break-all;font-size:13px} a{color:#7fb3ff}
 svg{max-width:100%;height:auto;display:block;margin:0 auto 10px}
 .cam-wrap{position:relative;width:100%;margin-top:10px;border-radius:8px;overflow:hidden;background:#000}
 video{width:100%;display:block;transform-origin:center center;transition:transform 0.15s ease}
 .guide{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center}
 .guide-box{width:78%;aspect-ratio:1/1;border:2px dashed rgba(159,211,86,0.65);border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,0.28)}
 .hidden{display:none}
</style></head><body>
<h1>Chess board analyzer</h1>

<div class="tabs">
 <button type="button" id="tab-cam" class="active" onclick="switchMode('cam')">Live Camera</button>
 <button type="button" id="tab-file" onclick="switchMode('file')">Upload Screenshot</button>
</div>

<!-- Shared Settings -->
<div class="card" style="margin-top:0">
 <label>Side to move</label>
 <select id="turn" name="turn">
  <option value="w" {{ 'selected' if turn=='w' }}>White</option>
  <option value="b" {{ 'selected' if turn=='b' }}>Black</option>
 </select>
 <label>Board orientation</label>
 <select id="flip" name="flip">
  <option value="auto">Auto</option>
  <option value="flip">Force flip</option>
  <option value="noflip">Never flip</option>
 </select>
 <label><input type="checkbox" id="ai" name="ai" checked style="width:auto"> Use AI reader</label>
</div>

<!-- Mode 1: Camera -->
<div id="panel-cam" class="card">
 <button type="button" id="btn-start-cam" onclick="startCamera()">Start Main Camera (2x)</button>

 <div id="cam-controls" class="hidden">
  <label>Camera Lens (avoid 0.5x ultrawide)</label>
  <select id="cam-select" onchange="switchSelectedCamera()"></select>

  <label>Zoom: <span id="zoom-val">2.0x</span> <span id="zoom-mode" class="muted"></span></label>
  <input type="range" id="zoom-slider" min="1" max="3" step="0.1" value="2.0" oninput="applyZoom(this.value)">

  <div class="cam-wrap">
   <video id="video" autoplay playsinline muted></video>
   <div class="guide"><div class="guide-box"></div></div>
  </div>
  <canvas id="canvas" class="hidden"></canvas>

  <div class="row">
   <button type="button" id="btn-snap" onclick="captureOnce()">Scan Once</button>
   <button type="button" id="btn-live" class="sec" onclick="toggleLive()">Start Live Scan</button>
  </div>
  <div id="live-status" class="muted" style="margin-top:8px">Align the board inside the green box.</div>
 </div>
</div>

<!-- Mode 2: Screenshot Upload -->
<form id="panel-file" class="card hidden" method="post" enctype="multipart/form-data" onsubmit="syncFormSettings()">
 <input type="hidden" name="turn" id="form-turn">
 <input type="hidden" name="flip" id="form-flip">
 <input type="hidden" name="ai" id="form-ai">
 <label style="margin-top:0">Screenshot</label>
 <input type="file" name="shot" accept="image/*" required>
 <button type="submit">Analyze Screenshot</button>
</form>

<!-- Results Container -->
<div id="error-box" class="card err {{ '' if error else 'hidden' }}">{{ error or '' }}</div>

<div id="result-box" class="card {{ '' if (res and res.ok) else 'hidden' }}">
 <div id="res-svg">{% if svg %}{{ svg|safe }}{% endif %}</div>
 <div id="res-move-wrap" class="{{ '' if (res and res.best_move) else 'hidden' }}">
  <div class="big" id="res-move">{{ res.best_move if res else '' }}</div>
  <div>Score: <span id="res-score">{{ res.score if res else '' }}</span> (for the side to move)</div>
 </div>
 <div id="res-conf-wrap" class="{{ 'warn' if (res and res.low_conf) else '' }} {{ '' if (res and res.min_conf is not none) else 'hidden' }}">
  AI confidence: <span id="res-conf">{{ '%.2f'|format(res.min_conf) if (res and res.min_conf is not none) else '' }}</span>
  <span id="res-low-warn">{{ ': LOW, compare the board above with your view' if (res and res.low_conf) else '' }}</span>
 </div>
 <div id="res-sub-err" class="err">{{ res.error if (res and res.error) else '' }}</div>
 <p>FEN:<br><code id="res-fen">{{ res.fen if res else '' }}</code></p>
 <a id="res-lichess" href="{{ 'https://lichess.org/analysis/' + res.fen.replace(' ', '_') if res else '#' }}" target="_blank" rel="noopener">Open this position on Lichess</a>
</div>

<script>
let stream = null;
let liveActive = false;
let isProcessing = false;
let lastFen = "";
let currentZoom = 2.0;
let hardwareZoomSupported = false;

function switchMode(mode) {
 document.getElementById("panel-cam").classList.toggle("hidden", mode !== "cam");
 document.getElementById("panel-file").classList.toggle("hidden", mode !== "file");
 document.getElementById("tab-cam").classList.toggle("active", mode === "cam");
 document.getElementById("tab-file").classList.toggle("active", mode === "file");
 if (mode !== "cam" && liveActive) toggleLive();
}

function syncFormSettings() {
 document.getElementById("form-turn").value = document.getElementById("turn").value;
 document.getElementById("form-flip").value = document.getElementById("flip").value;
 document.getElementById("form-ai").value = document.getElementById("ai").checked ? "on" : "";
}

function pickBestMainCamera(devices) {
 const videoDevices = devices.filter(d => d.kind === "videoinput");
 if (!videoDevices.length) return null;

 // Prefer back/environment cameras that are NOT ultrawide/macro/telephoto
 const backCams = videoDevices.filter(d => /back|rear|environment/i.test(d.label));
 const pool = backCams.length ? backCams : videoDevices;

 const mainCam = pool.find(d => !/wide|0\.5|0\.6|macro|depth|tele/i.test(d.label));
 return (mainCam || pool[0]).deviceId;
}

async function populateCameraList(activeDeviceId) {
 const devices = await navigator.mediaDevices.enumerateDevices();
 const select = document.getElementById("cam-select");
 select.innerHTML = "";
 devices.filter(d => d.kind === "videoinput").forEach((d, idx) => {
  const opt = document.createElement("option");
  opt.value = d.deviceId;
  opt.textContent = d.label || `Camera ${idx + 1}`;
  if (d.deviceId === activeDeviceId) opt.selected = true;
  select.appendChild(opt);
 });
}

async function startCamera(requestedDeviceId = null) {
 if (stream) {
  stream.getTracks().forEach(t => t.stop());
 }
 try {
  // Initial permission grant + device discovery if no specific deviceId was passed
  if (!requestedDeviceId) {
   const tempStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false
   });
   const devices = await navigator.mediaDevices.enumerateDevices();
   tempStream.getTracks().forEach(t => t.stop());
   requestedDeviceId = pickBestMainCamera(devices);
  }

  const videoConstraints = {
   width: { ideal: 1920 },
   height: { ideal: 1080 }
  };
  if (requestedDeviceId) {
   videoConstraints.deviceId = { exact: requestedDeviceId };
  } else {
   videoConstraints.facingMode = { ideal: "environment" };
  }

  stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  const video = document.getElementById("video");
  video.srcObject = stream;

  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  await populateCameraList(settings.deviceId);

  document.getElementById("cam-controls").classList.remove("hidden");
  document.getElementById("btn-start-cam").textContent = "Restart Camera";
  document.getElementById("error-box").classList.add("hidden");

  // Apply default 2.0x zoom once stream starts
  await applyZoom(document.getElementById("zoom-slider").value);
 } catch (err) {
  showError("Camera error: " + err.message);
 }
}

function switchSelectedCamera() {
 const deviceId = document.getElementById("cam-select").value;
 startCamera(deviceId);
}

async function applyZoom(val) {
 currentZoom = parseFloat(val);
 document.getElementById("zoom-val").textContent = currentZoom.toFixed(1) + "x";
 const video = document.getElementById("video");
 const modeLabel = document.getElementById("zoom-mode");

 hardwareZoomSupported = false;
 if (stream) {
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (caps.zoom) {
   const clamped = Math.min(Math.max(currentZoom, caps.zoom.min), caps.zoom.max);
   try {
    await track.applyConstraints({ advanced: [{ zoom: clamped }] });
    hardwareZoomSupported = true;
    video.style.transform = "scale(1)";
    modeLabel.textContent = "(optical/sensor zoom)";
    return;
   } catch (e) {
    // Fallback to digital center crop below
   }
  }
 }

 // Software 2x center-crop preview & capture fallback
 video.style.transform = `scale(${currentZoom})`;
 modeLabel.textContent = "(digital crop zoom)";
}

function toggleLive() {
 liveActive = !liveActive;
 const btn = document.getElementById("btn-live");
 const status = document.getElementById("live-status");
 if (liveActive) {
  btn.textContent = "Stop Live Scan";
  btn.classList.add("stop");
  status.textContent = "Live scanning active...";
  liveLoop();
 } else {
  btn.textContent = "Start Live Scan";
  btn.classList.remove("stop");
  status.textContent = "Live scan paused.";
 }
}

async function liveLoop() {
 if (!liveActive) return;
 await captureAndSend(true);
 if (liveActive) {
  setTimeout(liveLoop, 400);
 }
}

async function captureOnce() {
 document.getElementById("live-status").textContent = "Scanning frame...";
 await captureAndSend(false);
 if (!liveActive) {
  document.getElementById("live-status").textContent = "Scan complete.";
 }
}

async function captureAndSend(isLive) {
 if (isProcessing || !stream) return;
 const video = document.getElementById("video");
 if (video.videoWidth === 0) return;

 isProcessing = true;
 const canvas = document.getElementById("canvas");
 const vw = video.videoWidth;
 const vh = video.videoHeight;

 // Crop a clean square around the center (matching zoom + guide box with 12% margin)
 const cropFactor = hardwareZoomSupported ? 1.0 : currentZoom;
 const baseSide = Math.min(vw, vh) / cropFactor;
 const side = Math.round(baseSide * 0.90);
 const sx = Math.max(0, Math.round((vw - side) / 2));
 const sy = Math.max(0, Math.round((vh - side) / 2));

 canvas.width = side;
 canvas.height = side;
 canvas.getContext("2d").drawImage(video, sx, sy, side, side, 0, 0, side, side);

 const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
 const formData = new FormData();
 formData.append("shot", blob, "frame.jpg");
 formData.append("turn", document.getElementById("turn").value);
 formData.append("flip", document.getElementById("flip").value);
 if (document.getElementById("ai").checked) formData.append("ai", "on");

 try {
  const resp = await fetch("/api/analyze", { method: "POST", body: formData });
  const data = await resp.json();
  if (!data.ok) {
   if (!isLive) showError(data.error);
   else document.getElementById("live-status").textContent = "Live scan: " + data.error;
  } else {
   renderResult(data);
   if (isLive) {
    document.getElementById("live-status").textContent =
     (data.fen === lastFen) ? "Live: Position unchanged" : "Live: Board updated!";
   }
   lastFen = data.fen;
  }
 } catch (e) {
  if (!isLive) showError("Network error: " + e.message);
 } finally {
  isProcessing = false;
 }
}


function showError(msg) {
 const errBox = document.getElementById("error-box");
 errBox.textContent = msg;
 errBox.classList.remove("hidden");
}

function renderResult(data) {
 document.getElementById("error-box").classList.add("hidden");
 document.getElementById("result-box").classList.remove("hidden");
 document.getElementById("res-svg").innerHTML = data.svg || "";

 const moveWrap = document.getElementById("res-move-wrap");
 if (data.best_move) {
  moveWrap.classList.remove("hidden");
  document.getElementById("res-move").textContent = data.best_move;
  document.getElementById("res-score").textContent = data.score;
 } else {
  moveWrap.classList.add("hidden");
 }

 const confWrap = document.getElementById("res-conf-wrap");
 if (data.min_conf !== null && data.min_conf !== undefined) {
  confWrap.classList.remove("hidden");
  confWrap.classList.toggle("warn", !!data.low_conf);
  document.getElementById("res-conf").textContent = Number(data.min_conf).toFixed(2);
  document.getElementById("res-low-warn").textContent =
   data.low_conf ? ": LOW, compare the board above with your view" : "";
 } else {
  confWrap.classList.add("hidden");
 }

 document.getElementById("res-sub-err").textContent = data.error || "";
 document.getElementById("res-fen").textContent = data.fen;
 document.getElementById("res-lichess").href =
  "https://lichess.org/analysis/" + data.fen.replace(/ /g, "_");
}
</script>
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


def process_upload(file_storage, turn, flip_raw, use_ai):
    """Save upload to a temp file, run pipeline, and clean up."""
    fd, path = tempfile.mkstemp(suffix=".img")
    os.close(fd)
    try:
        file_storage.save(path)
        flip = {"flip": True, "noflip": False}.get(flip_raw)
        res = pipeline.analyze_image(path, turn, use_ai, TEMPLATES, None, None, flip)
    finally:
        if os.path.exists(path):
            os.remove(path)
    return res


@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    """JSON endpoint for live camera frames."""
    f = request.files.get("shot")
    if not f:
        return jsonify({"ok": False, "error": "No frame received."})
    turn = "b" if request.form.get("turn") == "b" else "w"
    use_ai = request.form.get("ai") == "on"
    res = process_upload(f, turn, request.form.get("flip"), use_ai)
    if not res["ok"]:
        return jsonify({"ok": False, "error": res["error"]})
    return jsonify({
        "ok": True,
        "fen": res["fen"],
        "best_move": res.get("best_move"),
        "score": res.get("score"),
        "min_conf": res.get("min_conf"),
        "low_conf": res.get("low_conf"),
        "error": res.get("error"),
        "svg": board_svg(res["fen"], res.get("best_move"), turn),
    })


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
            use_ai = request.form.get("ai") == "on"
            res = process_upload(f, turn, request.form.get("flip"), use_ai)
            if not res["ok"]:
                error, res = res["error"], None
            else:
                svg = board_svg(res["fen"], res["best_move"], turn)
    return render_template_string(PAGE, res=res, svg=svg, error=error, turn=turn)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)

