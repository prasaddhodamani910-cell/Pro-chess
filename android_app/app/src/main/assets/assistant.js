/**
 * Chessmod Mobile Assistant
 * by author PRASAD DHODAMANI
 *
 * Real-time board recognition and chess engine analysis for Android.
 * Implemented with pure DOM methods (zero innerHTML) for strict TrustedHTML compliance.
 */
(function() {
  if (window.__CHESSMOD_MOBILE_LOADED__) return;
  window.__CHESSMOD_MOBILE_LOADED__ = true;

  let autoScanEnabled = true;
  let lastAnalyzedFen = "";
  let isAnalyzing = false;
  let forcedTurn = "auto";
  let observer = null;

  // Safe DOM element helper
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

  function initUI() {
    if (document.getElementById("cv-fab")) return;

    // 1. Floating Action Button
    const fab = el("div", { id: "cv-fab", title: "Chessmod Assistant" }, [
      el("span", { textContent: "\u265E" }),
      el("span", { id: "cv-fab-badge", textContent: "" })
    ]);

    // 2. Bottom Sheet HUD
    const sheet = el("div", { id: "cv-sheet" }, [
      el("div", { className: "cv-drag-handle" }),
      el("div", { className: "cv-sheet-header" }, [
        el("div", {}, [
          el("div", { className: "cv-title" }, [
            el("span", { textContent: "\u265E" }),
            document.createTextNode(" Chessmod")
          ]),
          el("div", { style: "font-size:10px; color:#81b64c; font-weight:600; margin-top:1px;" }, [
            document.createTextNode("by author PRASAD DHODAMANI")
          ])
        ]),
        el("div", { style: "display:flex; align-items:center; gap:8px;" }, [
          el("span", { className: "cv-badge", textContent: "Engine" }),
          el("button", { className: "cv-btn-close", id: "cv-btn-close", textContent: "\u2715" })
        ])
      ]),
      el("div", { className: "cv-quick-nav" }, [
        el("button", { className: "cv-nav-btn", id: "cv-nav-chesscom", textContent: "Chess.com" }),
        el("button", { className: "cv-nav-btn", id: "cv-nav-lichess", textContent: "Lichess" }),
        el("button", { className: "cv-nav-btn", id: "cv-nav-puzzles", textContent: "Puzzles" })
      ]),
      el("div", { className: "cv-sheet-content" }, [
        el("div", { className: "cv-hero-card" }, [
          el("div", {}, [
            el("div", { className: "cv-hero-lbl", textContent: "Best Move" }),
            el("div", { className: "cv-hero-move", id: "cv-move", textContent: "-" }),
            el("div", { id: "cv-turn-indicator", style: "font-size:10px; color:#aaa; margin-top:2px;", textContent: "Turn: -" })
          ]),
          el("div", {}, [
            el("div", { className: "cv-hero-lbl", style: "text-align:right;", textContent: "Eval" }),
            el("div", { className: "cv-hero-score", id: "cv-score", textContent: "-" })
          ])
        ]),
        el("button", { className: "cv-action-btn", id: "cv-btn-scan", textContent: "\u25BA Analyze Board Now" }),
        el("div", { className: "cv-row" }, [
          el("label", { className: "cv-toggle-label" }, [
            el("input", { type: "checkbox", id: "cv-autoscan", checked: true }),
            document.createTextNode(" Live Auto-Scan")
          ]),
          el("span", { id: "cv-status-badge", style: "color:#81b64c; font-size:11px; font-weight:600;", textContent: "Active" })
        ]),
        el("div", { className: "cv-turn-group" }, [
          el("button", { className: "cv-turn-btn cv-active", id: "cv-turn-auto", textContent: "Auto Turn" }),
          el("button", { className: "cv-turn-btn", id: "cv-turn-w", textContent: "White" }),
          el("button", { className: "cv-turn-btn", id: "cv-turn-b", textContent: "Black" })
        ]),
        el("div", { className: "cv-board-container" }, [
          el("div", { className: "cv-board-preview", id: "cv-board-svg" })
        ]),
        el("div", { className: "cv-fen-container" }, [
          el("div", { className: "cv-fen-input", id: "cv-fen", textContent: "FEN: -" }),
          el("button", { className: "cv-copy-btn", id: "cv-btn-copy", textContent: "Copy" })
        ]),
        el("div", { style: "margin-top:10px;" }, [
          el("div", { style: "display:flex; justify-content:space-between; font-size:11px; color:#888; margin-bottom:3px;" }, [
            document.createTextNode("Think Time"),
            el("span", { id: "cv-think-lbl", textContent: "1.0s" })
          ]),
          el("input", { type: "range", id: "cv-think", min: "0.4", max: "2.5", step: "0.3", value: "1.0", style: "width:100%;" })
        ]),
        el("div", { className: "cv-status-msg", id: "cv-status", textContent: "Ready to analyze" })
      ])
    ]);

    document.body.appendChild(fab);
    document.body.appendChild(sheet);

    // Event listeners
    fab.onclick = () => {
      sheet.classList.toggle("cv-open");
    };

    document.getElementById("cv-btn-close").onclick = () => {
      sheet.classList.remove("cv-open");
    };

    document.getElementById("cv-nav-chesscom").onclick = () => {
      if (window.AndroidBridge && window.AndroidBridge.navigate) {
        window.AndroidBridge.navigate("https://www.chess.com/play/computer");
      } else {
        window.location.href = "https://www.chess.com/play/computer";
      }
    };

    document.getElementById("cv-nav-lichess").onclick = () => {
      if (window.AndroidBridge && window.AndroidBridge.navigate) {
        window.AndroidBridge.navigate("https://lichess.org");
      } else {
        window.location.href = "https://lichess.org";
      }
    };

    document.getElementById("cv-nav-puzzles").onclick = () => {
      if (window.AndroidBridge && window.AndroidBridge.navigate) {
        window.AndroidBridge.navigate("https://www.chess.com/puzzles/rated");
      } else {
        window.location.href = "https://www.chess.com/puzzles/rated";
      }
    };

    // Auto-scan checkbox
    const autoScanCb = document.getElementById("cv-autoscan");
    const statusBadge = document.getElementById("cv-status-badge");
    autoScanCb.onchange = (e) => {
      autoScanEnabled = e.target.checked;
      statusBadge.textContent = autoScanEnabled ? "Active" : "Paused";
      statusBadge.style.color = autoScanEnabled ? "#81b64c" : "#888";
    };

    // Turn selection
    const btnAuto = document.getElementById("cv-turn-auto");
    const btnW = document.getElementById("cv-turn-w");
    const btnB = document.getElementById("cv-turn-b");
    function setTurn(t) {
      forcedTurn = t;
      [btnAuto, btnW, btnB].forEach(b => b.classList.remove("cv-active"));
      if (t === "auto") btnAuto.classList.add("cv-active");
      else if (t === "w") btnW.classList.add("cv-active");
      else if (t === "b") btnB.classList.add("cv-active");
      scanBoard(true);
    }
    btnAuto.onclick = () => setTurn("auto");
    btnW.onclick = () => setTurn("w");
    btnB.onclick = () => setTurn("b");

    // Think time slider
    const thinkSlider = document.getElementById("cv-think");
    const thinkLbl = document.getElementById("cv-think-lbl");
    thinkSlider.oninput = () => {
      thinkLbl.textContent = thinkSlider.value + "s";
    };

    // Scan button
    document.getElementById("cv-btn-scan").onclick = () => {
      scanBoard(true);
    };

    // Copy FEN button
    document.getElementById("cv-btn-copy").onclick = () => {
      if (lastAnalyzedFen) {
        navigator.clipboard?.writeText(lastAnalyzedFen);
        if (window.AndroidBridge && window.AndroidBridge.showToast) {
          window.AndroidBridge.showToast("FEN copied to clipboard");
        }
      }
    };
  }

  // --- Turn Detection Helper ---
  function determineTurnChesscom(board, grid, isFlipped) {
    if (forcedTurn !== "auto") return forcedTurn;

    // 1. Check highlights on the board (the last move made)
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
      // If a White piece moved -> White just played -> it is now BLACK'S turn ('b')!
      // If a Black piece moved -> Black just played -> it is now WHITE'S turn ('w')!
      return (lastMovedPiece === lastMovedPiece.toUpperCase()) ? "b" : "w";
    }

    // 2. Check active player clocks
    const activeClocks = document.querySelectorAll(".clock-player-turn, .clock-running, .player-turn");
    if (activeClocks && activeClocks.length > 0) {
      for (const clk of activeClocks) {
        const isBlackClock = clk.closest(".player-component.black, .player-row.black, .player-top.black, .black");
        const isWhiteClock = clk.closest(".player-component.white, .player-row.white, .player-top.white, .white");
        if (isBlackClock) return "b";
        if (isWhiteClock) return "w";
      }
    }

    // 3. Check move list plies
    const moveNodes = document.querySelectorAll(".move-list-row .node, wc-move-list-item .node, .game-move-component .node");
    if (moveNodes && moveNodes.length > 0) {
      return (moveNodes.length % 2 === 1) ? "b" : "w";
    }

    // 4. Default: starting position
    return isFlipped ? "w" : "w";
  }

  // --- Board Scanners ---
  function parseChesscom() {
    let board = document.querySelector("wc-chess-board") ||
                document.querySelector("chess-board") ||
                document.querySelector("#board-single") ||
                document.querySelector(".board");
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
          col = parseInt(sqMatch[1], 10) - 1;
          row = parseInt(sqMatch[2], 10) - 1;
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
        // Correct 180-degree board reversal on Lichess when playing Black
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

  function renderMiniBoard(grid, isFlipped, bestMove) {
    const container = document.getElementById("cv-board-svg");
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 160 160");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    const sqSize = 20;
    const lightColor = "#ebecd0";
    const darkColor = "#779556";
    const highlightColor = "rgba(235, 97, 80, 0.65)";

    let moveFrom = null, moveTo = null;
    if (bestMove && bestMove.length >= 4) {
      const fCol = bestMove.charCodeAt(0) - 97;
      const fRow = 8 - parseInt(bestMove[1], 10);
      const tCol = bestMove.charCodeAt(2) - 97;
      const tRow = 8 - parseInt(bestMove[3], 10);
      moveFrom = { col: fCol, row: fRow };
      moveTo = { col: tCol, row: tRow };
    }

    const unicodePieces = {
      'P': '\u2659', 'N': '\u2658', 'B': '\u2657', 'R': '\u2656', 'Q': '\u2655', 'K': '\u2654',
      'p': '\u265F', 'n': '\u265E', 'b': '\u265D', 'r': '\u265C', 'q': '\u265B', 'k': '\u265A'
    };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const dispR = isFlipped ? 7 - r : r;
        const dispC = isFlipped ? 7 - c : c;

        const isLight = (r + c) % 2 === 0;
        let fill = isLight ? lightColor : darkColor;

        if ((moveFrom && moveFrom.row === dispR && moveFrom.col === dispC) ||
            (moveTo && moveTo.row === dispR && moveTo.col === dispC)) {
          fill = highlightColor;
        }

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", (c * sqSize).toString());
        rect.setAttribute("y", (r * sqSize).toString());
        rect.setAttribute("width", sqSize.toString());
        rect.setAttribute("height", sqSize.toString());
        rect.setAttribute("fill", fill);
        svg.appendChild(rect);

        const piece = grid[dispR][dispC];
        if (piece !== ".") {
          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("x", (c * sqSize + sqSize / 2).toString());
          text.setAttribute("y", (r * sqSize + sqSize / 2 + 5).toString());
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("font-size", "14px");
          text.setAttribute("fill", piece === piece.toUpperCase() ? "#ffffff" : "#111111");
          text.setAttribute("font-weight", "bold");
          text.textContent = unicodePieces[piece] || piece;
          svg.appendChild(text);
        }
      }
    }

    container.appendChild(svg);
  }

  function handleAnalysisResponse(data, res) {
    isAnalyzing = false;
    document.getElementById("cv-status").textContent = "Ready";

    if (!data.ok) {
      document.getElementById("cv-status").textContent = "Engine error: " + (data.error || "Failed");
      return;
    }

    const move = data.best_move || "-";
    const score = data.score || "-";
    const depth = data.depth || 0;

    document.getElementById("cv-move").textContent = move;
    document.getElementById("cv-score").textContent = score;
    document.getElementById("cv-status").textContent = `Depth: ${depth} | Nodes: ${data.nodes || 0}`;

    const turnIndicator = document.getElementById("cv-turn-indicator");
    if (turnIndicator) {
      turnIndicator.textContent = `Turn: ${res.turn === "w" ? "White" : "Black"} ${res.isFlipped ? "(Playing Black)" : "(Playing White)"}`;
      turnIndicator.style.color = (res.turn === "b") ? "#9fd356" : "#ddd";
    }

    // Update FAB badge with best move so user can see it when HUD is closed
    const badge = document.getElementById("cv-fab-badge");
    if (move && move !== "-") {
      badge.textContent = move;
      badge.style.display = "block";
    }

    renderMiniBoard(res.grid, res.isFlipped, move);
  }

  window.onAsyncAnalysis = function(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const res = parseChesscom() || parseLichess();
      if (res) handleAnalysisResponse(data, res);
    } catch (e) {
      console.error(e);
    }
  };

  function scanBoard(force = false) {
    if (isAnalyzing) return;

    const res = parseChesscom() || parseLichess();
    if (!res) {
      if (force) {
        document.getElementById("cv-status").textContent = "No board detected on screen.";
      }
      return;
    }

    const fen = gridToFen(res.grid, res.turn);
    if (!force && fen === lastAnalyzedFen) return;
    lastAnalyzedFen = fen;

    const fenInput = document.getElementById("cv-fen");
    if (fenInput) fenInput.textContent = fen;

    const turnIndicator = document.getElementById("cv-turn-indicator");
    if (turnIndicator) {
      turnIndicator.textContent = `Turn: ${res.turn === "w" ? "White" : "Black"} ${res.isFlipped ? "(Playing Black)" : "(Playing White)"}`;
      turnIndicator.style.color = (res.turn === "b") ? "#9fd356" : "#ddd";
    }

    isAnalyzing = true;
    document.getElementById("cv-status").textContent = `Analyzing for ${res.turn === "w" ? "White" : "Black"}...`;

    const thinkVal = parseFloat(document.getElementById("cv-think")?.value || "1.0");
    const thinkMs = Math.round(thinkVal * 1000);

    if (window.AndroidBridge && window.AndroidBridge.analyzeFenAsync) {
      window.AndroidBridge.analyzeFenAsync(fen, res.turn, thinkMs, "req_" + Date.now());
    } else if (window.AndroidBridge && window.AndroidBridge.analyzeFen) {
      try {
        const respStr = window.AndroidBridge.analyzeFen(fen, res.turn, thinkMs);
        const data = JSON.parse(respStr);
        handleAnalysisResponse(data, res);
      } catch (err) {
        isAnalyzing = false;
        document.getElementById("cv-status").textContent = "Bridge error: " + err;
      }
    } else {
      isAnalyzing = false;
      document.getElementById("cv-status").textContent = "Android engine bridge not connected.";
      renderMiniBoard(res.grid, res.isFlipped, "");
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();

    let scanTimer = null;
    function triggerScan() {
      if (!autoScanEnabled) return;
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        scanBoard(false);
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

    const target = document.querySelector(".main-board, .round__app, .analyse__board, .cg-wrap, wc-chess-board, chess-board, cg-board") ||
                   document.body;

    if (target) {
      observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }
  }

  function init() {
    initUI();
    startObserver();
    setTimeout(() => scanBoard(false), 800);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }

  setInterval(() => {
    if (!document.getElementById("cv-fab")) {
      initUI();
      startObserver();
    }
  }, 2000);
})();
