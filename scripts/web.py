"""Chess Vision & Analysis Web Interface for PC and Mobile.
Run:  python scripts/web.py
Open: http://127.0.0.1:8000 in your browser.
"""
import os, sys, tempfile, shutil
from flask import Flask, request, render_template_string, jsonify

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pipeline

ROOT = os.path.dirname(HERE)
TEMPLATES = os.path.join(ROOT, "assets", "templates", "t_review.pkl")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024      # up to 32 MB

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chess Vision PC - Screenshot & Live Engine Analysis</title>
<style>
 :root {
   --bg: #161512;
   --card: #24221e;
   --card-hover: #2c2925;
   --border: #36332e;
   --text: #e6e6e6;
   --muted: #9e9a92;
   --accent: #629924;
   --accent-hover: #73b32a;
   --accent-light: #9fd356;
   --danger: #e04545;
   --warn: #f59e0b;
   --board-size: 420px;
 }
 * { box-sizing: border-box; }
 body {
   font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
   background: var(--bg);
   color: var(--text);
   margin: 0;
   padding: 16px;
 }
 .header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   max-width: 1140px;
   margin: 0 auto 16px;
   padding-bottom: 12px;
   border-bottom: 1px solid var(--border);
 }
 .header h1 {
   font-size: 22px;
   margin: 0;
   display: flex;
   align-items: center;
   gap: 10px;
 }
 .badge {
   font-size: 11px;
   background: #2e3820;
   color: var(--accent-light);
   border: 1px solid #486326;
   border-radius: 999px;
   padding: 3px 9px;
   font-weight: normal;
 }
 .layout {
   display: grid;
   grid-template-columns: 1fr;
   gap: 20px;
   max-width: 1140px;
   margin: 0 auto;
 }
 @media (min-width: 860px) {
   .layout {
     grid-template-columns: 1.05fr 1.15fr;
   }
 }
 .card {
   background: var(--card);
   border: 1px solid var(--border);
   border-radius: 12px;
   padding: 16px;
   margin-bottom: 16px;
 }
 .tabs {
   display: flex;
   gap: 6px;
   background: #1c1a17;
   padding: 4px;
   border-radius: 10px;
   margin-bottom: 14px;
 }
 .tabs button {
   flex: 1;
   margin: 0;
   padding: 9px 6px;
   font-size: 13px;
   font-weight: 600;
   background: transparent;
   color: var(--muted);
   border: 0;
   border-radius: 7px;
   cursor: pointer;
   transition: all 0.15s;
 }
 .tabs button.active {
   background: var(--card);
   color: #fff;
   box-shadow: 0 2px 4px rgba(0,0,0,0.3);
 }
 label {
   display: block;
   font-size: 13px;
   color: var(--muted);
   margin: 10px 0 4px;
   font-weight: 500;
 }
 input, select, button {
   font-size: 14px;
   padding: 9px 12px;
   border-radius: 8px;
   border: 1px solid var(--border);
   background: #1c1a17;
   color: #fff;
   width: 100%;
 }
 input[type=range] {
   padding: 0;
   margin: 6px 0;
   border: 0;
   background: transparent;
 }
 .btn {
   background: var(--accent);
   color: #fff;
   border: 0;
   cursor: pointer;
   font-weight: bold;
   margin-top: 10px;
   transition: background 0.15s;
 }
 .btn:hover { background: var(--accent-hover); }
 .btn-sec { background: #383530; border: 1px solid #48443e; }
 .btn-sec:hover { background: #48443e; }
 .btn-danger { background: var(--danger); }
 .btn-danger:hover { background: #c53030; }
 .dropzone {
   border: 2px dashed #4a4740;
   border-radius: 10px;
   padding: 32px 16px;
   text-align: center;
   cursor: pointer;
   background: #1c1a17;
   transition: border-color 0.15s, background 0.15s;
 }
 .dropzone:hover, .dropzone.dragover {
   border-color: var(--accent);
   background: #21261a;
 }
 .dropzone-icon {
   font-size: 32px;
   margin-bottom: 8px;
 }
 .kbd {
   display: inline-block;
   background: #33302a;
   border: 1px solid #4d483f;
   border-radius: 4px;
   padding: 2px 6px;
   font-size: 11px;
   color: #ddd;
   font-family: monospace;
 }
 .row { display: flex; gap: 10px; }
 .row > * { flex: 1; }
 .video-wrap {
   position: relative;
   width: 100%;
   border-radius: 8px;
   overflow: hidden;
   background: #000;
   margin-top: 10px;
 }
 video {
   width: 100%;
   max-height: 380px;
   display: block;
   object-fit: contain;
   transform-origin: center center;
 }
 .guide {
   position: absolute;
   inset: 0;
   pointer-events: none;
   display: flex;
   align-items: center;
   justify-content: center;
 }
 .guide-box {
   width: 76%;
   aspect-ratio: 1/1;
   border: 2px dashed rgba(159,211,86,0.7);
   border-radius: 6px;
   box-shadow: 0 0 0 9999px rgba(0,0,0,0.3);
 }
 .hidden { display: none !important; }
 .status-bar {
   font-size: 13px;
   color: var(--muted);
   margin-top: 8px;
   min-height: 20px;
 }
 .err-box {
   background: #3b1818;
   border: 1px solid #6b2a2a;
   color: #ff9191;
   border-radius: 8px;
   padding: 10px 14px;
   font-size: 13px;
   margin-bottom: 12px;
 }
 .board-display {
   text-align: center;
   margin-bottom: 16px;
 }
 .board-display svg {
   max-width: 100%;
   height: auto;
   display: block;
   margin: 0 auto;
   border-radius: 6px;
   box-shadow: 0 6px 16px rgba(0,0,0,0.4);
 }
 .move-card {
   display: flex;
   align-items: center;
   justify-content: space-between;
   background: #1c1a17;
   padding: 12px 16px;
   border-radius: 10px;
   border-left: 5px solid var(--accent);
   margin-bottom: 12px;
 }
 .move-title { font-size: 12px; color: var(--muted); text-transform: uppercase; }
 .move-val { font-size: 28px; font-weight: 800; color: var(--accent-light); font-family: monospace; }
 .score-val { font-size: 15px; font-weight: 600; }
 .fen-box {
   background: #181715;
   padding: 10px 12px;
   border-radius: 8px;
   border: 1px solid var(--border);
   font-family: monospace;
   font-size: 12px;
   word-break: break-all;
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 8px;
 }
 .btn-copy {
   width: auto;
   padding: 4px 10px;
   font-size: 12px;
   background: #33302a;
   border: 0;
   border-radius: 5px;
   cursor: pointer;
 }
 .btn-copy:hover { background: #444038; }
 a.lichess-link {
   display: inline-block;
   margin-top: 10px;
   color: #7fb3ff;
   text-decoration: none;
   font-size: 13px;
   font-weight: 500;
 }
 a.lichess-link:hover { text-decoration: underline; }
 .preview-thumb {
   max-width: 100%;
   max-height: 180px;
   display: block;
   margin: 10px auto 0;
   border-radius: 6px;
   border: 1px solid var(--border);
 }
 .spinner {
   display: inline-block;
   width: 14px;
   height: 14px;
   border: 2px solid rgba(255,255,255,0.25);
   border-top-color: #fff;
   border-radius: 50%;
   animation: spin 0.8s linear infinite;
   vertical-align: middle;
   margin-right: 6px;
 }
 @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div class="header">
 <h1><span>&#9816;</span> Chess Vision PC <span class="badge" id="engine-badge">Engine Ready</span></h1>
 <div style="font-size:12px; color:var(--muted)">Works with Chess.com &middot; Lichess &middot; Screenshots &middot; Screen Share</div>
</div>

<div class="layout">
 <!-- Left Column: Inputs & Controls -->
 <div>
   <!-- Tabs -->
   <div class="tabs">
     <button type="button" id="tab-paste" class="active" onclick="switchTab('paste')">Paste / Drop</button>
     <button type="button" id="tab-screen" onclick="switchTab('screen')">Share Screen / Tab</button>
     <button type="button" id="tab-cam" onclick="switchTab('cam')">Camera / Webcam</button>
   </div>

   <!-- Mode 1: Paste / Dropzone (Default PC workflow) -->
   <div id="panel-paste" class="card">
     <div class="dropzone" id="drop-area" onclick="document.getElementById('file-input').click()">
       <div class="dropzone-icon">&#128247;</div>
       <div style="font-weight:600; margin-bottom:4px">Click or Press <span class="kbd">Ctrl</span> + <span class="kbd">V</span> anywhere to Paste</div>
       <div style="font-size:12px; color:var(--muted)">or drag & drop a screenshot image here</div>
     </div>
     <input type="file" id="file-input" accept="image/*" class="hidden" onchange="handleFileSelect(this.files[0])">
     <img id="paste-preview" class="preview-thumb hidden">
     <button type="button" class="btn btn-sec" style="margin-top:10px" onclick="readClipboardDirect()">Paste From Clipboard</button>
   </div>

   <!-- Mode 2: Screen / Window / Tab Share (PC Live Capture) -->
   <div id="panel-screen" class="card hidden">
     <button type="button" id="btn-start-screen" class="btn" onclick="startScreenShare()">Select Chess Window / Tab</button>
     <div id="screen-controls" class="hidden">
       <div class="video-wrap">
         <video id="screen-video" autoplay playsinline muted></video>
       </div>
       <div class="row" style="margin-top:10px">
         <button type="button" id="btn-snap-screen" class="btn" onclick="captureScreenOnce()">Analyze Screen Now</button>
         <button type="button" id="btn-live-screen" class="btn btn-sec" onclick="toggleScreenLive()">Start Auto-Scan</button>
       </div>
       <button type="button" class="btn btn-danger" style="margin-top:8px" onclick="stopScreenShare()">Stop Sharing</button>
     </div>
     <div id="screen-status" class="status-bar">Share your Chess.com or Lichess window to analyze live.</div>
   </div>

   <!-- Mode 3: Webcam / Phone Camera -->
   <div id="panel-cam" class="card hidden">
     <button type="button" id="btn-start-cam" class="btn" onclick="startCamera()">Start Camera</button>
     <div id="cam-controls" class="hidden">
       <label>Camera Device</label>
       <select id="cam-select" onchange="switchCamera()"></select>

       <label>Zoom: <span id="zoom-val">1.0x</span></label>
       <input type="range" id="zoom-slider" min="1" max="3" step="0.1" value="1.0" oninput="applyZoom(this.value)">

       <div class="video-wrap">
         <video id="cam-video" autoplay playsinline muted></video>
         <div class="guide"><div class="guide-box"></div></div>
       </div>

       <div class="row" style="margin-top:10px">
         <button type="button" class="btn" onclick="captureCamOnce()">Scan Camera Frame</button>
         <button type="button" id="btn-live-cam" class="btn btn-sec" onclick="toggleCamLive()">Live Scan</button>
       </div>
     </div>
     <div id="cam-status" class="status-bar">Align the board inside the view.</div>
   </div>

   <!-- Shared Settings -->
   <div class="card">
     <h3 style="font-size:14px; margin:0 0 10px; color:#fff">Game & Engine Settings</h3>
     <div class="row">
       <div>
         <label>Side to move</label>
         <select id="turn">
           <option value="w" selected>White to move</option>
           <option value="b">Black to move</option>
         </select>
       </div>
       <div>
         <label>Board orientation</label>
         <select id="flip">
           <option value="auto" selected>Auto detect</option>
           <option value="noflip">White at bottom</option>
           <option value="flip">Black at bottom</option>
         </select>
       </div>
     </div>
     <div class="row" style="margin-top:6px">
       <div>
         <label>Engine Think Time: <span id="think-val">2s</span></label>
         <input type="range" id="think" min="1" max="5" step="1" value="2" oninput="document.getElementById('think-val').textContent=this.value+'s'">
       </div>
       <div style="display:flex; align-items:center; padding-top:20px">
         <label style="margin:0; cursor:pointer"><input type="checkbox" id="ai" checked style="width:auto; margin-right:6px"> AI piece recognizer</label>
       </div>
     </div>
   </div>
 </div>

 <!-- Right Column: Board & Analysis Results -->
 <div>
   <div id="error-box" class="err-box hidden"></div>

   <div class="card">
     <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
       <h3 style="font-size:15px; margin:0; color:#fff">Engine Analysis & Board</h3>
       <div id="status-pill" style="font-size:12px; color:var(--muted)">Waiting for position...</div>
     </div>

     <!-- Best Move Hero -->
     <div id="move-card" class="move-card hidden">
       <div>
         <div class="move-title">Recommended Best Move</div>
         <div class="move-val" id="res-move">-</div>
       </div>
       <div style="text-align:right">
         <div class="move-title">Engine Eval</div>
         <div class="score-val" id="res-score">-</div>
       </div>
     </div>

     <!-- Board SVG -->
     <div class="board-display" id="board-container">
       <div style="padding: 60px 20px; color:var(--muted); font-size:13px; border:1px dashed var(--border); border-radius:8px">
         Paste an image or share your screen to see the board here.
       </div>
     </div>

     <!-- FEN String -->
     <div id="fen-container" class="hidden">
       <label style="margin-top:0">Position FEN</label>
       <div class="fen-box">
         <span id="res-fen">-</span>
         <button type="button" class="btn-copy" onclick="copyFen()">Copy</button>
       </div>
       <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px">
         <a id="res-lichess" href="#" target="_blank" rel="noopener" class="lichess-link">Open in Lichess Analysis &#8599;</a>
         <span id="res-conf" style="font-size:12px; color:var(--muted)"></span>
       </div>
     </div>
   </div>
 </div>
</div>

<canvas id="canvas" class="hidden"></canvas>

<script>
let screenStream = null;
let camStream = null;
let liveScreenActive = false;
let liveCamActive = false;
let isProcessing = false;
let lastFen = "";
let currentZoom = 1.0;

// Switch tab
function switchTab(mode) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + mode).classList.add("active");

  document.getElementById("panel-paste").classList.toggle("hidden", mode !== "paste");
  document.getElementById("panel-screen").classList.toggle("hidden", mode !== "screen");
  document.getElementById("panel-cam").classList.toggle("hidden", mode !== "cam");

  if (mode !== "screen" && liveScreenActive) toggleScreenLive();
  if (mode !== "cam" && liveCamActive) toggleCamLive();
}

// Global Clipboard Paste Handler (Ctrl+V)
window.addEventListener("paste", function(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const file = items[i].getAsFile();
      switchTab("paste");
      handleFileSelect(file);
      e.preventDefault();
      return;
    }
  }
});

// Drag and drop handlers
const dropArea = document.getElementById("drop-area");
["dragenter", "dragover"].forEach(event => {
  dropArea.addEventListener(event, e => { e.preventDefault(); dropArea.classList.add("dragover"); });
});
["dragleave", "drop"].forEach(event => {
  dropArea.addEventListener(event, e => { e.preventDefault(); dropArea.classList.remove("dragover"); });
});
dropArea.addEventListener("drop", e => {
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

async function readClipboardDirect() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          handleFileSelect(blob);
          return;
        }
      }
    }
    showError("No image found on clipboard. Try pressing Ctrl + V directly.");
  } catch (err) {
    showError("Clipboard access blocked by browser. Please press Ctrl + V directly into the window.");
  }
}

function handleFileSelect(file) {
  if (!file) return;
  const preview = document.getElementById("paste-preview");
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  sendBlobForAnalysis(file, false);
}

// Screen / Window / Tab Sharing (PC getDisplayMedia)
async function startScreenShare() {
  try {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });
    const video = document.getElementById("screen-video");
    video.srcObject = screenStream;
    document.getElementById("screen-controls").classList.remove("hidden");
    document.getElementById("btn-start-screen").textContent = "Re-select Screen / Tab";
    document.getElementById("screen-status").textContent = "Active share connected. Click 'Analyze Screen Now'.";

    screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
  } catch (err) {
    showError("Screen share cancelled or failed: " + err.message);
  }
}

function stopScreenShare() {
  if (liveScreenActive) toggleScreenLive();
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  document.getElementById("screen-controls").classList.add("hidden");
  document.getElementById("btn-start-screen").textContent = "Select Chess Window / Tab";
  document.getElementById("screen-status").textContent = "Screen sharing stopped.";
}

function toggleScreenLive() {
  liveScreenActive = !liveScreenActive;
  const btn = document.getElementById("btn-live-screen");
  const status = document.getElementById("screen-status");
  if (liveScreenActive) {
    btn.textContent = "Stop Auto-Scan";
    btn.classList.add("btn-danger");
    status.textContent = "Auto-scan active (scanning every 2.5s)...";
    screenLiveLoop();
  } else {
    btn.textContent = "Start Auto-Scan";
    btn.classList.remove("btn-danger");
    status.textContent = "Auto-scan paused.";
  }
}

async function screenLiveLoop() {
  if (!liveScreenActive) return;
  await captureScreenFrame(true);
  if (liveScreenActive) setTimeout(screenLiveLoop, 2500);
}

async function captureScreenOnce() {
  document.getElementById("screen-status").textContent = "Scanning frame...";
  await captureScreenFrame(false);
}

async function captureScreenFrame(isLive) {
  if (isProcessing || !screenStream) return;
  const video = document.getElementById("screen-video");
  if (video.videoWidth === 0) return;

  const canvas = document.getElementById("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.92));
  await sendBlobForAnalysis(blob, isLive);
}

// Camera / Webcam support
async function startCamera(deviceId = null) {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  try {
    const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1920 } } };
    camStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById("cam-video");
    video.srcObject = camStream;
    document.getElementById("cam-controls").classList.remove("hidden");
    document.getElementById("btn-start-cam").textContent = "Restart Camera";

    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = document.getElementById("cam-select");
    select.innerHTML = "";
    devices.filter(d => d.kind === "videoinput").forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${i+1}`;
      select.appendChild(opt);
    });
  } catch (err) {
    showError("Camera error: " + err.message);
  }
}

function switchCamera() {
  startCamera(document.getElementById("cam-select").value);
}

function applyZoom(val) {
  currentZoom = parseFloat(val);
  document.getElementById("zoom-val").textContent = currentZoom.toFixed(1) + "x";
  document.getElementById("cam-video").style.transform = `scale(${currentZoom})`;
}

function toggleCamLive() {
  liveCamActive = !liveCamActive;
  const btn = document.getElementById("btn-live-cam");
  if (liveCamActive) {
    btn.textContent = "Stop Live Scan";
    btn.classList.add("btn-danger");
    camLiveLoop();
  } else {
    btn.textContent = "Live Scan";
    btn.classList.remove("btn-danger");
  }
}

async function camLiveLoop() {
  if (!liveCamActive) return;
  await captureCamFrame(true);
  if (liveCamActive) setTimeout(camLiveLoop, 1500);
}

async function captureCamOnce() {
  await captureCamFrame(false);
}

async function captureCamFrame(isLive) {
  if (isProcessing || !camStream) return;
  const video = document.getElementById("cam-video");
  if (video.videoWidth === 0) return;

  const canvas = document.getElementById("canvas");
  const vw = video.videoWidth / currentZoom;
  const vh = video.videoHeight / currentZoom;
  const sx = (video.videoWidth - vw) / 2;
  const sy = (video.videoHeight - vh) / 2;

  canvas.width = vw;
  canvas.height = vh;
  canvas.getContext("2d").drawImage(video, sx, sy, vw, vh, 0, 0, vw, vh);

  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.90));
  await sendBlobForAnalysis(blob, isLive);
}

// Core Analysis Communication
async function sendBlobForAnalysis(blob, isLive) {
  if (isProcessing) return;
  isProcessing = true;

  const statusPill = document.getElementById("status-pill");
  statusPill.innerHTML = '<span class="spinner"></span> Analyzing position...';

  const formData = new FormData();
  formData.append("shot", blob, "shot.jpg");
  formData.append("turn", document.getElementById("turn").value);
  formData.append("flip", document.getElementById("flip").value);
  formData.append("think", document.getElementById("think").value);
  if (document.getElementById("ai").checked) formData.append("ai", "on");

  try {
    const resp = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await resp.json();
    if (!data.ok) {
      if (!isLive) showError(data.error);
      statusPill.textContent = "Analysis failed: " + data.error;
    } else {
      hideError();
      renderResult(data);
      statusPill.textContent = (data.fen === lastFen) ? "Position unchanged" : "Updated!";
      lastFen = data.fen;
    }
  } catch (err) {
    if (!isLive) showError("Network error: " + err.message);
    statusPill.textContent = "Network error";
  } finally {
    isProcessing = false;
  }
}

function renderResult(data) {
  if (data.svg) {
    document.getElementById("board-container").innerHTML = data.svg;
  }
  const moveCard = document.getElementById("move-card");
  if (data.best_move) {
    moveCard.classList.remove("hidden");
    document.getElementById("res-move").textContent = data.best_move;
    document.getElementById("res-score").textContent = data.score || "Equal";
  } else {
    moveCard.classList.add("hidden");
  }

  document.getElementById("fen-container").classList.remove("hidden");
  document.getElementById("res-fen").textContent = data.fen;
  document.getElementById("res-lichess").href = "https://lichess.org/analysis/" + data.fen.replace(/ /g, "_");

  if (data.min_conf !== null && data.min_conf !== undefined) {
    const pct = Math.round(data.min_conf * 100);
    const confEl = document.getElementById("res-conf");
    confEl.textContent = `AI Confidence: ${pct}%`;
    confEl.style.color = (pct < 80) ? "var(--warn)" : "var(--muted)";
  }
}

function copyFen() {
  const fen = document.getElementById("res-fen").textContent;
  navigator.clipboard.writeText(fen);
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => btn.textContent = orig, 1500);
}

function showError(msg) {
  const b = document.getElementById("error-box");
  b.textContent = msg;
  b.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-box").classList.add("hidden");
}

// Fetch engine status on load
fetch("/api/engine_status").then(r => r.json()).then(d => {
  const b = document.getElementById("engine-badge");
  if (d.stockfish) {
    b.textContent = d.name + " Connected";
  } else {
    b.textContent = "Stockfish Optional";
    b.style.borderColor = "var(--warn)";
    b.style.color = "var(--warn)";
  }
}).catch(() => {});
</script>

</body>
</html>"""


def board_svg(fen, best, turn):
    """Draw the position the program read, with an arrow for the best move."""
    try:
        import chess, chess.svg
        b = chess.Board(fen)
        arrows = []
        if best:
            try:
                m = b.parse_san(best)
                arrows = [chess.svg.Arrow(m.from_square, m.to_square, color="#2e8b57dd")]
            except Exception:
                pass
        return chess.svg.board(b, size=400, arrows=arrows, flipped=(turn == "b"))
    except Exception:
        return None


def process_upload(file_storage, turn, flip_raw, use_ai, think=2):
    """Save upload to a temp file, run pipeline, and clean up."""
    fd, path = tempfile.mkstemp(suffix=".img")
    os.close(fd)
    try:
        file_storage.save(path)
        flip = {"flip": True, "noflip": False}.get(flip_raw)
        res = pipeline.analyze_image(path, turn, use_ai, TEMPLATES, None, None, flip, think=think)
    finally:
        if os.path.exists(path):
            os.remove(path)
    return res


@app.route("/api/engine_status", methods=["GET"])
def api_engine_status():
    sf_path = pipeline.find_stockfish()
    has_sf = False
    name = "Stockfish"
    if sf_path:
        try:
            import chess.engine
            engine = chess.engine.SimpleEngine.popen_uci(sf_path)
            name = engine.id.get("name", "Stockfish")
            engine.quit()
            has_sf = True
        except Exception:
            pass
    return jsonify({"stockfish": has_sf, "path": sf_path, "name": name})


@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    """JSON endpoint for screenshot, clipboard, screen share, and camera frames."""
    f = request.files.get("shot")
    if not f:
        return jsonify({"ok": False, "error": "No image received."})
    turn = "b" if request.form.get("turn") == "b" else "w"
    use_ai = request.form.get("ai") == "on"
    try:
        think = int(request.form.get("think", 2))
    except (ValueError, TypeError):
        think = 2
    res = process_upload(f, turn, request.form.get("flip"), use_ai, think=think)
    if not res["ok"]:
        return jsonify({"ok": False, "error": res["error"]})
    return jsonify({
        "ok": True,
        "fen": res["fen"],
        "best_move": res.get("best_move"),
        "score": res.get("score"),
        "min_conf": res.get("min_conf"),
        "low_conf": res.get("low_conf"),
        "error": res.get("error") or res.get("stockfish_warning"),
        "svg": board_svg(res["fen"], res.get("best_move"), turn),
    })


@app.route("/", methods=["GET", "POST"])
def index():
    return render_template_string(PAGE)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Chess Vision PC server on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
