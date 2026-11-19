// Prasad Chess Main Application Controller

document.addEventListener("DOMContentLoaded", () => {
    const game = new ChessGame();
    const engine = new ChessEngine();

    // App state
    let playerColor = WHITE;
    let selectedSq = -1;
    let legalMovesForSelected = [];
    let isFlipped = false;
    let isEngineThinking = false;
    let currentPieceSet = 'lichess';
    let currentBoardTheme = 'chesscom-green';
    let showCoordinates = true;
    let pendingPromoMove = null;
    let lastMoveFrom = -1;
    let lastMoveTo = -1;
    let hintMove = null;

    // DOM Elements
    const boardEl = document.getElementById("chess-board");
    const evalBarWhite = document.getElementById("eval-white");
    const evalBarBlack = document.getElementById("eval-black");
    const evalText = document.getElementById("eval-text");
    const notationPanel = document.getElementById("notation-panel");
    const engineStatusTag = document.getElementById("engine-status");
    const userEloSelect = document.getElementById("elo-select");
    const headerEloBadge = document.getElementById("header-elo-badge");
    const opponentEloText = document.getElementById("opponent-elo-text");
    const capturedWhiteEl = document.getElementById("captured-white");
    const capturedBlackEl = document.getElementById("captured-black");
    const matDiffWhiteEl = document.getElementById("mat-diff-white");
    const matDiffBlackEl = document.getElementById("mat-diff-black");

    // Modal elements
    const settingsModal = document.getElementById("settings-modal");
    const promoModal = document.getElementById("promo-modal");
    const gameOverModal = document.getElementById("gameover-modal");
    const gameoverTitle = document.getElementById("gameover-title");
    const gameoverReason = document.getElementById("gameover-reason");

    // Buttons
    const btnNewGame = document.getElementById("btn-new-game");
    const btnUndo = document.getElementById("btn-undo");
    const btnFlip = document.getElementById("btn-flip");
    const btnHint = document.getElementById("btn-hint");
    const btnSettings = document.getElementById("btn-settings");
    const btnCloseSettings = document.getElementById("btn-close-settings");
    const btnRematch = document.getElementById("btn-rematch");

    // Settings inputs
    const settingTheme = document.getElementById("setting-theme");
    const settingPieces = document.getElementById("setting-pieces");
    const settingCoords = document.getElementById("setting-coords");
    const settingSound = document.getElementById("setting-sound");

    // Load saved settings
    try {
        const savedTheme = localStorage.getItem("prasad_chess_theme");
        if (savedTheme) {
            currentBoardTheme = savedTheme;
            settingTheme.value = savedTheme;
        }
        const savedPieces = localStorage.getItem("prasad_chess_pieces");
        if (savedPieces) {
            currentPieceSet = savedPieces;
            settingPieces.value = savedPieces;
        }
        const savedElo = localStorage.getItem("prasad_chess_elo");
        if (savedElo) {
            userEloSelect.value = savedElo;
        }
    } catch(e) {}

    applyTheme(currentBoardTheme);
    updateElo(parseInt(userEloSelect.value));

    // Render 64 Board Squares
    function initBoardUI() {
        boardEl.innerHTML = "";
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const sqDiv = document.createElement("div");
                sqDiv.className = "square";
                sqDiv.dataset.row = row;
                sqDiv.dataset.col = col;

                sqDiv.addEventListener("click", () => onSquareClick(getSquareFromDisplay(row, col)));
                boardEl.appendChild(sqDiv);
            }
        }
    }

    function getSquareFromDisplay(row, col) {
        if (!isFlipped) {
            // White on bottom: row 0 is rank 8 (sq 56-63), col 0 is file a
            const rank = 7 - row;
            const file = col;
            return (rank << 3) | file;
        } else {
            // Black on bottom: row 0 is rank 1 (sq 0-7), col 0 is file h
            const rank = row;
            const file = 7 - col;
            return (rank << 3) | file;
        }
    }

    function renderBoard() {
        const checkSq = game.inCheck() ? findKingSquare(game.side) : -1;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const sq = getSquareFromDisplay(row, col);
                const rank = sq >> 3;
                const file = sq & 7;
                const isLight = ((rank + file) % 2) === 1;

                const index = row * 8 + col;
                const sqDiv = boardEl.children[index];
                sqDiv.className = "square " + (isLight ? "light" : "dark");

                // Highlight last move
                if (sq === lastMoveFrom || sq === lastMoveTo) {
                    sqDiv.classList.add("last-move");
                }

                // Selected square
                if (sq === selectedSq) {
                    sqDiv.classList.add("selected");
                }

                // Check highlight
                if (sq === checkSq) {
                    sqDiv.classList.add("check");
                }

                // Hint move highlight
                if (hintMove && (sq === hintMove.from || sq === hintMove.to)) {
                    sqDiv.classList.add("hint");
                }

                // Legal move indicator
                const targetMove = legalMovesForSelected.find(m => m.to === sq);
                if (targetMove) {
                    if (targetMove.captured !== EMPTY || targetMove.isEp) {
                        sqDiv.classList.add("capture-target");
                    } else {
                        sqDiv.classList.add("move-target");
                    }
                }

                // Inner Piece
                const p = game.board[sq];
                let pieceSvgHtml = "";
                if (p !== EMPTY) {
                    const pieceKey = (p === p.toUpperCase() ? 'w' : 'b') + p.toUpperCase();
                    pieceSvgHtml = getPieceSvg(pieceKey, currentPieceSet);
                }

                let coordsHtml = "";
                if (showCoordinates) {
                    const showFile = (!isFlipped && row === 7) || (isFlipped && row === 7);
                    const showRank = (!isFlipped && col === 0) || (isFlipped && col === 0);

                    if (showFile) {
                        const fileChar = String.fromCharCode('a'.charCodeAt(0) + file);
                        coordsHtml += `<span class="coord-file">${fileChar}</span>`;
                    }
                    if (showRank) {
                        const rankNum = rank + 1;
                        coordsHtml += `<span class="coord-rank">${rankNum}</span>`;
                    }
                }

                sqDiv.innerHTML = pieceSvgHtml + coordsHtml;
            }
        }

        updateCaptured();
        updateEvaluation();
    }

    function findKingSquare(side) {
        const king = (side === WHITE) ? 'K' : 'k';
        return game.board.indexOf(king);
    }

    function onSquareClick(sq) {
        if (isEngineThinking) return;
        if (game.side !== playerColor) return;

        const p = game.board[sq];
        const isOwnPiece = (p !== EMPTY && game.pieceColor(p) === playerColor);

        if (selectedSq === -1) {
            if (isOwnPiece) {
                selectedSq = sq;
                legalMovesForSelected = game.getLegalMoves().filter(m => m.from === sq);
                hintMove = null;
                renderBoard();
            }
        } else {
            const move = legalMovesForSelected.find(m => m.to === sq);
            if (move) {
                // If promotion
                if (move.promo) {
                    pendingPromoMove = move;
                    showPromotionModal(move);
                    return;
                }
                executePlayerMove(move);
            } else if (isOwnPiece) {
                // Select another own piece
                selectedSq = sq;
                legalMovesForSelected = game.getLegalMoves().filter(m => m.from === sq);
                hintMove = null;
                renderBoard();
            } else {
                // Deselect
                selectedSq = -1;
                legalMovesForSelected = [];
                renderBoard();
            }
        }
    }

    function executePlayerMove(move) {
        selectedSq = -1;
        legalMovesForSelected = [];
        hintMove = null;
        lastMoveFrom = move.from;
        lastMoveTo = move.to;

        const isCapture = (move.captured !== EMPTY || move.isEp);
        const isCastle = Boolean(move.isCastle);
        const san = game.moveToSan(move);

        game.makeMove(move);
        addMoveToNotation(san, game.side === BLACK);

        // Sound effect
        if (game.inCheck()) {
            soundManager.playCheck();
        } else if (isCapture) {
            soundManager.playCapture();
        } else if (isCastle) {
            soundManager.playCastle();
        } else {
            soundManager.playMove();
        }

        renderBoard();

        const over = game.isGameOver();
        if (over.over) {
            handleGameOver(over);
            return;
        }

        // Trigger Engine turn
        triggerEngineMove();
    }

    async function triggerEngineMove() {
        if (game.side === playerColor) return;

        isEngineThinking = true;
        engineStatusTag.textContent = "Thinking...";
        engineStatusTag.className = "engine-status-tag thinking";

        // Give UI a moment to repaint thinking state
        await new Promise(r => setTimeout(r, 60));

        const result = await engine.findBestMoveAsync(game, (progress) => {
            if (progress && progress.score !== undefined) {
                const evalCp = (game.side === WHITE) ? progress.score : -progress.score;
                const winChance = 1 / (1 + Math.pow(10, -evalCp / 400));
                const whitePct = Math.max(5, Math.min(95, winChance * 100));
                evalBarWhite.style.height = `${whitePct}%`;
                evalBarBlack.style.height = `${100 - whitePct}%`;
            }
        });

        isEngineThinking = false;
        engineStatusTag.textContent = "Ready";
        engineStatusTag.className = "engine-status-tag";

        if (result && result.bestMove) {
            const move = result.bestMove;
            lastMoveFrom = move.from;
            lastMoveTo = move.to;

            const isCapture = (move.captured !== EMPTY || move.isEp);
            const isCastle = Boolean(move.isCastle);
            const san = game.moveToSan(move);

            game.makeMove(move);
            addMoveToNotation(san, game.side === BLACK);

            if (game.inCheck()) {
                soundManager.playCheck();
            } else if (isCapture) {
                soundManager.playCapture();
            } else if (isCastle) {
                soundManager.playCastle();
            } else {
                soundManager.playMove();
            }

            renderBoard();

            const over = game.isGameOver();
            if (over.over) {
                handleGameOver(over);
            }
        }
    }

    function addMoveToNotation(san, isWhiteMove) {
        if (isWhiteMove) {
            // White move: create new row
            const moveNum = game.fullmove;
            const numSpan = document.createElement("span");
            numSpan.className = "notation-row-num";
            numSpan.textContent = moveNum + ".";

            const whiteCell = document.createElement("span");
            whiteCell.className = "notation-cell active";
            whiteCell.textContent = san;

            // Remove active from previous
            notationPanel.querySelectorAll(".notation-cell.active").forEach(el => el.classList.remove("active"));

            notationPanel.appendChild(numSpan);
            notationPanel.appendChild(whiteCell);
        } else {
            // Black move: append to current row
            const blackCell = document.createElement("span");
            blackCell.className = "notation-cell active";
            blackCell.textContent = san;

            notationPanel.querySelectorAll(".notation-cell.active").forEach(el => el.classList.remove("active"));
            notationPanel.appendChild(blackCell);
        }

        notationPanel.scrollTop = notationPanel.scrollHeight;
    }

    function updateCaptured() {
        const pieceCounts = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };
        const baseCounts = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
        const pieceVals = { p: 1, n: 3, b: 3, r: 5, q: 9 };

        for (let p of game.board) {
            if (p !== EMPTY && p.toLowerCase() !== 'k') {
                pieceCounts[p] = (pieceCounts[p] || 0) + 1;
            }
        }

        let whiteScore = 0;
        let blackScore = 0;

        let capturedByWhiteHtml = "";
        let capturedByBlackHtml = "";

        // Pieces captured by White (missing Black pieces)
        for (let t of ['q', 'r', 'b', 'n', 'p']) {
            const missing = Math.max(0, baseCounts[t] - (pieceCounts[t] || 0));
            if (missing > 0) {
                const svg = getPieceSvg('b' + t.toUpperCase(), currentPieceSet);
                for (let i = 0; i < missing; i++) {
                    capturedByWhiteHtml += `<span style="width:16px;height:16px;display:inline-block">${svg}</span>`;
                }
            }
            blackScore += (pieceCounts[t] || 0) * pieceVals[t];
        }

        // Pieces captured by Black (missing White pieces)
        for (let t of ['Q', 'R', 'B', 'N', 'P']) {
            const missing = Math.max(0, baseCounts[t] - (pieceCounts[t] || 0));
            if (missing > 0) {
                const svg = getPieceSvg('w' + t.toUpperCase(), currentPieceSet);
                for (let i = 0; i < missing; i++) {
                    capturedByBlackHtml += `<span style="width:16px;height:16px;display:inline-block">${svg}</span>`;
                }
            }
            whiteScore += (pieceCounts[t] || 0) * pieceVals[t.toLowerCase()];
        }

        capturedWhiteEl.innerHTML = capturedByWhiteHtml;
        capturedBlackEl.innerHTML = capturedByBlackHtml;

        const diff = whiteScore - blackScore;
        if (diff > 0) {
            matDiffWhiteEl.textContent = `+${diff}`;
            matDiffBlackEl.textContent = "";
        } else if (diff < 0) {
            matDiffWhiteEl.textContent = "";
            matDiffBlackEl.textContent = `+${Math.abs(diff)}`;
        } else {
            matDiffWhiteEl.textContent = "";
            matDiffBlackEl.textContent = "";
        }
    }

    function updateEvaluation() {
        const rawEval = engine.evaluate(game);
        const evalCp = (game.side === WHITE) ? rawEval : -rawEval;

        // Sigmoid mapping from centipawns to percentage (0% to 100%)
        // eval = 0 -> 50%
        const winChance = 1 / (1 + Math.pow(10, -evalCp / 400));
        const whitePct = Math.max(5, Math.min(95, winChance * 100));
        const blackPct = 100 - whitePct;

        evalBarWhite.style.height = `${whitePct}%`;
        evalBarBlack.style.height = `${blackPct}%`;

        const pawnAdvantage = (evalCp / 100).toFixed(1);
        evalText.textContent = (evalCp >= 0 ? `+${pawnAdvantage}` : pawnAdvantage);
    }

    function showPromotionModal(move) {
        promoModal.classList.add("active");
        const promoBoxes = document.querySelectorAll(".promo-option");
        promoBoxes.forEach(box => {
            const pieceType = box.dataset.piece;
            const pieceKey = (playerColor === WHITE ? 'w' : 'b') + pieceType.toUpperCase();
            box.innerHTML = getPieceSvg(pieceKey, currentPieceSet);
            box.onclick = () => {
                promoModal.classList.remove("active");
                move.promo = pieceType;
                executePlayerMove(move);
            };
        });
    }

    function handleGameOver(over) {
        soundManager.playGameOver();
        gameoverTitle.textContent = over.result === "1/2-1/2" ? "Draw!" : (over.result === "1-0" ? "White Wins!" : "Black Wins!");
        gameoverReason.textContent = `By ${over.reason} (${over.result})`;
        gameOverModal.classList.add("active");
    }

    function updateElo(newElo) {
        engine.setElo(newElo);
        headerEloBadge.textContent = `${newElo} Elo`;
        opponentEloText.textContent = `(${newElo})`;
        try {
            localStorage.setItem("prasad_chess_elo", newElo);
        } catch(e) {}
    }

    function applyTheme(themeName) {
        document.body.className = `theme-${themeName}`;
        currentBoardTheme = themeName;
        try {
            localStorage.setItem("prasad_chess_theme", themeName);
        } catch(e) {}
    }

    // Event Handlers
    userEloSelect.addEventListener("change", (e) => {
        updateElo(parseInt(e.target.value));
    });

    btnNewGame.addEventListener("click", () => {
        game.reset();
        selectedSq = -1;
        legalMovesForSelected = [];
        lastMoveFrom = -1;
        lastMoveTo = -1;
        hintMove = null;
        notationPanel.innerHTML = "";
        gameOverModal.classList.remove("active");
        renderBoard();

        if (playerColor === BLACK) {
            triggerEngineMove();
        }
    });

    btnRematch.addEventListener("click", () => {
        gameOverModal.classList.remove("active");
        btnNewGame.click();
    });

    btnUndo.addEventListener("click", () => {
        if (isEngineThinking) return;
        // Undo player move and engine move
        game.undoMove();
        game.undoMove();
        selectedSq = -1;
        legalMovesForSelected = [];
        lastMoveFrom = -1;
        lastMoveTo = -1;
        hintMove = null;

        // Rebuild notation
        notationPanel.innerHTML = "";
        // Re-render
        renderBoard();
    });

    btnFlip.addEventListener("click", () => {
        isFlipped = !isFlipped;
        playerColor = 1 - playerColor;
        renderBoard();

        if (game.side !== playerColor) {
            triggerEngineMove();
        }
    });

    btnHint.addEventListener("click", async () => {
        if (isEngineThinking) return;
        const result = await engine.findBestMoveAsync(game);
        if (result && result.bestMove) {
            hintMove = result.bestMove;
            renderBoard();
        }
    });

    btnSettings.addEventListener("click", () => {
        settingsModal.classList.add("active");
    });

    btnCloseSettings.addEventListener("click", () => {
        settingsModal.classList.remove("active");
    });

    settingTheme.addEventListener("change", (e) => {
        applyTheme(e.target.value);
        renderBoard();
    });

    settingPieces.addEventListener("change", (e) => {
        currentPieceSet = e.target.value;
        try {
            localStorage.setItem("prasad_chess_pieces", currentPieceSet);
        } catch(e) {}
        renderBoard();
    });

    settingCoords.addEventListener("change", (e) => {
        showCoordinates = (e.target.value === "true");
        renderBoard();
    });

    settingSound.addEventListener("change", (e) => {
        soundManager.enabled = (e.target.value === "true");
    });

    // Close modals on outside click
    window.addEventListener("click", (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove("active");
        if (e.target === gameOverModal) gameOverModal.classList.remove("active");
    });

    // Start
    initBoardUI();
    renderBoard();
});
