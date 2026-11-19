/**
 * Chessmod Assistant - Desktop Sidebar
 * by author PRASAD DHODAMANI
 *
 * Automatically parses board state from Chess.com and Lichess DOM
 * and coordinates with the Python Stockfish 19 engine.
 *
 * Implemented using pure DOM methods (zero innerHTML) to comply with
 * TrustedHTML / Content-Security-Policy on Chess.com.
 */
(function () {
  if (window.__CHESSMOD_LOADED__) return;
  window.__CHESSMOD_LOADED__ = true;

  let autoScanEnabled = true;
  let lastAnalyzedFen = "";
  let isAnalyzing = false;
  let observer = null;
  let forcedTurn = "auto";

  // Guard pywebview callback structure to prevent unhandled JavascriptException on navigation
  function guardPywebview() {
    if (!window.pywebview) return;
    if (!window.pywebview._returnValuesCallbacks) {
      window.pywebview._returnValuesCallbacks = {};
    }
    const safeHandler = {
      get(target, prop) {
        if (!(prop in target)) {
          target[prop] = new Proxy({}, {
            get(t, id) {
              return (typeof t[id] === 'function') ? t[id] : function() {};
            }
          });
        }
        return target[prop];
      }
    };
    try {
      window.pywebview._returnValuesCallbacks = new Proxy(window.pywebview._returnValuesCallbacks, safeHandler);
    } catch (_) {}
  }
  guardPywebview();
  setInterval(guardPywebview, 1000);

  // Safe DOM node builder
  function el(tag, props = {}, children = []) {
    const elem = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'id') elem.id = v;
      else if (k === 'className') elem.className = v;
      else if (k === 'textContent') elem.textContent = v;
      else if (k === 'title') elem.title = v;
      else if (k === 'type') elem.type = v;
      else if (k === 'checked') elem.checked = v;
      else if (k === 'min') elem.min = v;
      else if (k === 'max') elem.max = v;
      else if (k === 'step') elem.step = v;
      else if (k === 'value') elem.value = v;
      else if (k === 'style') elem.style.cssText = v;
      else elem.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
      else if (child) elem.appendChild(child);
    }
    return elem;
  }

  function initAssistant() {
    if (document.getElementById("cv-assistant-root")) return;

    const root = el("div", { id: "cv-assistant-root" }, [
      el("div", { id: "cv-toggle-btn", title: "Toggle Assistant", textContent: "\u265E" }),
      el("div", { className: "cv-header" }, [
        el("div", {}, [
          el("div", { className: "cv-title" }, [
            el("span", { textContent: "\u265E" }),
            document.createTextNode(" Chessmod")
          ]),
          el("div", { style: "font-size:10px; color:#81b64c; margin-top:2px; font-weight:600;" }, [
            document.createTextNode("by author PRASAD DHODAMANI")
          ])
        ]),
        el("div", { className: "cv-badge", id: "cv-engine-badge", textContent: "Stockfish 19" })
      ]),
      el("div", { className: "cv-nav" }, [
        el("button", { className: "cv-btn-nav", id: "cv-nav-chesscom", textContent: "Chess.com" }),
        el("button", { className: "cv-btn-nav", id: "cv-nav-lichess", textContent: "Lichess" }),
        el("button", { className: "cv-btn-nav", id: "cv-nav-puzzles", textContent: "Puzzles" })
      ]),
      el("div", { className: "cv-body" }, [
        el("button", { className: "cv-action-btn", id: "cv-btn-scan", textContent: "\u25BA Analyze Board Now" }),
        el("div", { className: "cv-toggle-row" }, [
          el("label", { style: "cursor:pointer; display:flex; align-items:center; gap:6px;" }, [
            el("input", { type: "checkbox", id: "cv-autoscan", checked: true }),
            document.createTextNode(" Auto-scan moves live")
          ]),
          el("span", { id: "cv-mode-indicator", style: "color:#9fd356; font-size:11px; font-weight:600;", textContent: "Active" })
        ]),
        el("div", { style: "display:flex; gap:6px; margin-bottom:10px;" }, [
          el("button", { className: "cv-btn-nav", id: "cv-turn-auto", textContent: "Turn: Auto", style: "background:#3a3731; color:#9fd356; font-weight:bold;" }),
          el("button", { className: "cv-btn-nav", id: "cv-turn-w", textContent: "White" }),
          el("button", { className: "cv-btn-nav", id: "cv-turn-b", textContent: "Black" })
        ]),
        el("div", { className: "cv-hero", id: "cv-hero-card" }, [
          el("div", {}, [
            el("div", { style: "font-size:10px; color:#888; text-transform:uppercase;", textContent: "Best Move" }),
            el("div", { className: "cv-hero-move", id: "cv-move", textContent: "-" }),
            el("div", { id: "cv-turn-label", style: "font-size:10px; color:#aaa; margin-top:2px;", textContent: "Turn: -" })
          ]),
          el("div", { style: "text-align:right;" }, [
            el("div", { style: "font-size:10px; color:#888; text-transform:uppercase;", textContent: "Eval" }),
            el("div", { className: "cv-hero-score", id: "cv-score", textContent: "-" })
          ])
        ]),
        el("div", { className: "cv-board-wrap", id: "cv-board-svg" }, [
          el("div", { style: "padding:30px 10px; color:#777; font-size:11px;", textContent: "Ready. Make a move or click Analyze." })
        ]),
        el("div", {}, [
          el("div", { style: "font-size:11px; color:#888; margin-top:8px;", textContent: "Current FEN" }),
          el("div", { className: "cv-fen-box" }, [
            el("span", { id: "cv-fen", style: "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;", textContent: "-" }),
            el("button", { className: "cv-copy-btn", id: "cv-btn-copy", textContent: "Copy" })
          ])
        ]),
        el("div", { style: "margin-top:12px; font-size:11px; color:#888;" }, [
          el("div", { style: "display:flex; justify-content:space-between; margin-bottom:4px;" }, [
            el("span", {}, [
              document.createTextNode("Think Time: "),
              el("span", { id: "cv-think-label", textContent: "1.5s" })
            ])
          ]),
          el("input", { type: "range", id: "cv-think", min: "0.5", max: "4.0", step: "0.5", value: "1.5", style: "width:100%;" })
        ]),
        el("div", { className: "cv-status-text", id: "cv-status", textContent: "Ready" })
      ])
    ]);

    document.body.appendChild(root);

    // Event listeners
    document.getElementById("cv-toggle-btn").onclick = () => {
      root.classList.toggle("cv-collapsed");
    };

    document.getElementById("cv-nav-chesscom").onclick = () => {
      window.location.href = "https://www.chess.com/play/computer";
    };
    document.getElementById("cv-nav-lichess").onclick = () => {
      window.location.href = "https://lichess.org";
    };
    document.getElementById("cv-nav-puzzles").onclick = () => {
      window.location.href = "https://www.chess.com/puzzles/rated";
    };

    // Turn selection buttons
    const btnAuto = document.getElementById("cv-turn-auto");
    const btnW = document.getElementById("cv-turn-w");
    const btnB = document.getElementById("cv-turn-b");

    function setTurnMode(mode) {
      forcedTurn = mode;
      btnAuto.style.color = (mode === "auto") ? "#9fd356" : "#bbb";
      btnAuto.style.background = (mode === "auto") ? "#3a3731" : "#222";
      btnW.style.color = (mode === "w") ? "#9fd356" : "#bbb";
      btnW.style.background = (mode === "w") ? "#3a3731" : "#222";
      btnB.style.color = (mode === "b") ? "#9fd356" : "#bbb";
      btnB.style.background = (mode === "b") ? "#3a3731" : "#222";
      scanCurrentBoard(true);
    }
    btnAuto.onclick = () => setTurnMode("auto");
    btnW.onclick = () => setTurnMode("w");
    btnB.onclick = () => setTurnMode("b");

    document.getElementById("cv-btn-scan").onclick = () => scanCurrentBoard(true);

    const autoBox = document.getElementById("cv-autoscan");
    autoBox.onchange = () => {
      autoScanEnabled = autoBox.checked;
      setStatus(autoScanEnabled ? "Auto-scan enabled" : "Auto-scan paused");
    };

    document.getElementById("cv-think").oninput = (e) => {
      document.getElementById("cv-think-label").textContent = e.target.value + "s";
    };

    document.getElementById("cv-btn-copy").onclick = () => {
      const fen = document.getElementById("cv-fen").textContent;
      if (fen && fen !== "-") {
        navigator.clipboard.writeText(fen);
        const b = document.getElementById("cv-btn-copy");
        b.textContent = "Copied!";
        setTimeout(() => b.textContent = "Copy", 1200);
      }
    };

    setupBoardObserver();
    setTimeout(() => scanCurrentBoard(false), 1000);
  }

  function setStatus(text) {
    const el = document.getElementById("cv-status");
    if (el) el.textContent = text;
  }

  // --- Turn Detection Helper ---
  function determineTurnChesscom(board, grid, isFlipped) {
    if (forcedTurn !== "auto") return forcedTurn;

    // 1. Look for board move highlights (most accurate: finds the piece that just moved)
    let highlightEls = board.querySelectorAll(".highlight");
    if ((!highlightEls || highlightEls.length === 0) && board.shadowRoot) {
      highlightEls = board.shadowRoot.querySelectorAll(".highlight");
    }

    let lastMovedPiece = null;
    if (highlightEls && highlightEls.length > 0) {
      highlightEls.forEach(el => {
        el.classList.forEach(cls => {
          const m = cls.match(/^square-(\d)(\d)$/);
          if (m) {
            const col = parseInt(m[1], 10) - 1;
            const row = parseInt(m[2], 10) - 1;
            if (col >= 0 && col < 8 && row >= 0 && row < 8) {
              const p = grid[7 - row][col];
              if (p && p !== ".") {
                lastMovedPiece = p;
              }
            }
          }
        });
      });
    }

    if (lastMovedPiece) {
      // If White piece moved -> White just played -> it is now BLACK'S turn ('b')!
      // If Black piece moved -> Black just played -> it is now WHITE'S turn ('w')!
      return (lastMovedPiece === lastMovedPiece.toUpperCase()) ? "b" : "w";
    }

    // 2. Look for active player clocks
    const activeClocks = document.querySelectorAll(".clock-player-turn, .clock-running, .player-turn");
    if (activeClocks && activeClocks.length > 0) {
      for (const clk of activeClocks) {
        const isBlackClock = clk.closest(".player-component.black, .player-row.black, .player-top.black, .black");
        const isWhiteClock = clk.closest(".player-component.white, .player-row.white, .player-top.white, .white");
        if (isBlackClock) return "b";
        if (isWhiteClock) return "w";
      }
    }

    // 3. Look for move list items
    const moveNodes = document.querySelectorAll(".move-list-row .node, wc-move-list-item .node, .game-move-component .node");
    if (moveNodes && moveNodes.length > 0) {
      // Odd plies (1, 3, 5...) -> White played -> Black's turn!
      // Even plies (2, 4, 6...) -> Black played -> White's turn!
      return (moveNodes.length % 2 === 1) ? "b" : "w";
    }

    // 4. Default: If starting position or waiting for White
    return isFlipped ? "w" : "w";
  }

  // --- Board Readers ---
  function parseChesscom() {
    const board = document.querySelector("chess-board, .board, wc-chess-board, #board-single");
    if (!board) return null;

    let pieceEls = board.querySelectorAll(".piece");
    if ((!pieceEls || pieceEls.length === 0) && board.shadowRoot) {
      pieceEls = board.shadowRoot.querySelectorAll(".piece");
    }
    if (!pieceEls || pieceEls.length === 0) return null;

    const grid = Array(8).fill(null).map(() => Array(8).fill("."));
    pieceEls.forEach(el => {
      let pieceChar = null;
      let col = -1, row = -1;
      el.classList.forEach(cls => {
        if (/^[wb][pnbrqk]$/.test(cls)) {
          const colCode = cls[0];
          const type = cls[1];
          pieceChar = (colCode === "w") ? type.toUpperCase() : type.toLowerCase();
        }
        const sqMatch = cls.match(/^square-(\d)(\d)$/);
        if (sqMatch) {
          col = parseInt(sqMatch[1], 10) - 1; // 0..7
          row = parseInt(sqMatch[2], 10) - 1; // 0..7
        }
      });
      if (pieceChar && col >= 0 && col < 8 && row >= 0 && row < 8) {
        grid[7 - row][col] = pieceChar;
      }
    });

    const isFlipped = board.classList.contains("flipped") || (board.closest(".flipped") !== null);
    const turn = determineTurnChesscom(board, grid, isFlipped);

    return { grid, isFlipped, turn };
  }

  function parseLichess() {
    const board = document.querySelector(".main-board cg-board, .round__app cg-board, .analyse__board cg-board, cg-board");
    if (!board) return null;

    const pieceEls = board.querySelectorAll("piece");
    if (!pieceEls || pieceEls.length === 0) return null;

    const grid = Array(8).fill(null).map(() => Array(8).fill("."));
    const rect = board.getBoundingClientRect();
    const sq = rect.width / 8;

    const wrap = board.closest(".cg-wrap") || board.closest(".round__app") || document.querySelector(".main-board .cg-wrap") || board.parentElement;
    const isFlipped = wrap ? wrap.classList.contains("orientation-black") : false;

    pieceEls.forEach(el => {
      let pieceChar = null;
      const isWhite = el.classList.contains("white");
      const isBlack = el.classList.contains("black");
      if (!isWhite && !isBlack) return;

      const types = ["pawn", "knight", "bishop", "rook", "queen", "king"];
      for (const t of types) {
        if (el.classList.contains(t)) {
          const letter = (t === "knight") ? "n" : t[0];
          pieceChar = isWhite ? letter.toUpperCase() : letter.toLowerCase();
          break;
        }
      }
      if (!pieceChar) return;

      const style = el.style.transform;
      const m = style.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/);
      if (m) {
        const x = parseFloat(m[1]);
        const y = parseFloat(m[2]);
        const col = Math.round(x / sq);
        const row = Math.round(y / sq);
        // On Lichess with orientation-black, coordinates are reversed 180 degrees
        const targetRow = isFlipped ? 7 - row : row;
        const targetCol = isFlipped ? 7 - col : col;
        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
          grid[targetRow][targetCol] = pieceChar;
        }
      }
    });

    let turn = "w";
    if (forcedTurn !== "auto") {
      turn = forcedTurn;
    } else {
      // Check last-move highlight on Lichess
      let lastMovedPiece = null;
      const lastMoves = board.querySelectorAll(".last-move");
      lastMoves.forEach(sqEl => {
        const style = sqEl.style.transform;
        const m = style.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/);
        if (m) {
          const col = Math.round(parseFloat(m[1]) / sq);
          const row = Math.round(parseFloat(m[2]) / sq);
          const targetRow = isFlipped ? 7 - row : row;
          const targetCol = isFlipped ? 7 - col : col;
          if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
            const p = grid[targetRow][targetCol];
            if (p && p !== ".") lastMovedPiece = p;
          }
        }
      });

      if (lastMovedPiece) {
        // White piece moved -> Black's turn!
        turn = (lastMovedPiece === lastMovedPiece.toUpperCase()) ? "b" : "w";
      } else {
        const moves = document.querySelectorAll("l4x > kwdb, rm6 > kwdb");
        if (moves && moves.length > 0) {
          turn = (moves.length % 2 === 1) ? "b" : "w";
        } else {
          turn = "w";
        }
      }
    }

    return { grid, isFlipped, turn };
  }

  function gridToFen(grid, turn) {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let s = "", empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = grid[r][c];
        if (p === ".") {
          empty++;
        } else {
          if (empty > 0) { s += empty; empty = 0; }
          s += p;
        }
      }
      if (empty > 0) s += empty;
      rows.push(s);
    }
    return rows.join("/") + ` ${turn} - - 0 1`;
  }

  async function scanCurrentBoard(force = false) {
    if (isAnalyzing) return;

    let res = parseChesscom() || parseLichess();
    if (!res) {
      if (force) setStatus("Searching for board...");
      return;
    }

    const currentFen = gridToFen(res.grid, res.turn);
    if (!force && currentFen === lastAnalyzedFen) return;

    isAnalyzing = true;
    lastAnalyzedFen = currentFen;

    const turnLabel = document.getElementById("cv-turn-label");
    if (turnLabel) {
      turnLabel.textContent = `Turn: ${res.turn === "w" ? "White" : "Black"} ${res.isFlipped ? "(Playing Black)" : "(Playing White)"}`;
      turnLabel.style.color = (res.turn === "b") ? "#9fd356" : "#e0e0e0";
    }

    setStatus(`Stockfish analyzing for ${res.turn === "w" ? "White" : "Black"}...`);

    const thinkVal = parseFloat(document.getElementById("cv-think").value) || 1.5;

    try {
      guardPywebview();
      if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.analyze_fen === "function") {
        const result = await window.pywebview.api.analyze_fen(currentFen, res.turn, thinkVal);
        renderAnalysis(result);
        setStatus("Best move found: " + (result.best_move || "Analyzed"));
      } else {
        setStatus("Waiting for engine bridge...");
      }
    } catch (err) {
      console.warn("[Chessmod] Analysis call error:", err);
      setStatus("Engine ready");
    } finally {
      isAnalyzing = false;
    }
  }

  function renderAnalysis(data) {
    if (!data || !data.ok) {
      setStatus(data ? data.error : "Analysis failed");
      return;
    }
    document.getElementById("cv-move").textContent = data.best_move || "-";
    document.getElementById("cv-score").textContent = data.score || "0.00";
    document.getElementById("cv-fen").textContent = data.fen;
    if (data.svg) {
      const svgBox = document.getElementById("cv-board-svg");
      svgBox.textContent = "";
      try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(data.svg, "image/svg+xml");
        if (svgDoc && svgDoc.documentElement) {
          svgBox.appendChild(svgDoc.documentElement);
        }
      } catch (e) {
        svgBox.textContent = "Best move: " + data.best_move;
      }
    }
  }

  function setupBoardObserver() {
    if (observer) observer.disconnect();

    let scanTimer = null;
    function triggerScan() {
      if (!autoScanEnabled) return;
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        scanCurrentBoard(false);
      }, 400);
    }

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList" || m.type === "attributes") {
          triggerScan();
          break;
        }
      }
    });

    const target = document.querySelector(".main-board, .round__app, .analyse__board, .cg-wrap, chess-board, .board, wc-chess-board, cg-board") || document.body;
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  }

  // Auto-init on load
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initAssistant();
  } else {
    document.addEventListener("DOMContentLoaded", initAssistant);
  }

  setInterval(() => {
    if (!document.getElementById("cv-assistant-root")) {
      initAssistant();
    }
  }, 2000);
})();
