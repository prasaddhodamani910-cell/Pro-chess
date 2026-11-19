// Complete Chess Rules Engine for Prasad Chess
// Standard Square indexing: 0 = a1, 7 = h1, 56 = a8, 63 = h8

const WHITE = 0;
const BLACK = 1;

const EMPTY = '.';
const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];

class ChessGame {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = new Array(64).fill(EMPTY);
        this.side = WHITE;
        this.castling = 15; // 1: WK, 2: WQ, 4: BK, 8: BQ
        this.epSquare = -1;
        this.halfmove = 0;
        this.fullmove = 1;
        this.history = [];
        this.positionHistory = [];

        this.loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    squareToFile(sq) { return sq & 7; }
    squareToRank(sq) { return sq >> 3; }
    coordsToSquare(f, r) { return (r << 3) | f; }
    squareToString(sq) {
        if (sq < 0 || sq > 63) return "-";
        const f = String.fromCharCode('a'.charCodeAt(0) + (sq & 7));
        const r = (sq >> 3) + 1;
        return f + r;
    }
    stringToSquare(str) {
        if (!str || str.length < 2) return -1;
        const f = str.charCodeAt(0) - 'a'.charCodeAt(0);
        const r = parseInt(str[1]) - 1;
        if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
        return (r << 3) | f;
    }

    isWhite(p) { return p !== EMPTY && p === p.toUpperCase(); }
    isBlack(p) { return p !== EMPTY && p === p.toLowerCase(); }
    pieceColor(p) {
        if (p === EMPTY) return -1;
        return p === p.toUpperCase() ? WHITE : BLACK;
    }

    loadFen(fen) {
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 1) return false;

        this.board.fill(EMPTY);
        const ranks = parts[0].split('/');
        if (ranks.length !== 8) return false;

        for (let r = 7; r >= 0; r--) {
            const rankStr = ranks[7 - r];
            let f = 0;
            for (let i = 0; i < rankStr.length; i++) {
                const c = rankStr[i];
                if (c >= '1' && c <= '8') {
                    f += parseInt(c);
                } else {
                    if (f < 8) {
                        this.board[(r << 3) | f] = c;
                        f++;
                    }
                }
            }
        }

        this.side = (parts[1] && parts[1].toLowerCase() === 'b') ? BLACK : WHITE;

        this.castling = 0;
        const cast = parts[2] || "-";
        if (cast.includes('K')) this.castling |= 1;
        if (cast.includes('Q')) this.castling |= 2;
        if (cast.includes('k')) this.castling |= 4;
        if (cast.includes('q')) this.castling |= 8;

        this.epSquare = parts[3] ? this.stringToSquare(parts[3]) : -1;
        this.halfmove = parts[4] ? parseInt(parts[4]) : 0;
        this.fullmove = parts[5] ? parseInt(parts[5]) : 1;

        this.history = [];
        this.positionHistory = [this.getFenPositionOnly()];
        return true;
    }

    getFen() {
        let fen = "";
        for (let r = 7; r >= 0; r--) {
            let emptyCount = 0;
            for (let f = 0; f < 8; f++) {
                const p = this.board[(r << 3) | f];
                if (p === EMPTY) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += p;
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (r > 0) fen += "/";
        }

        fen += (this.side === WHITE ? " w " : " b ");

        let cast = "";
        if (this.castling & 1) cast += "K";
        if (this.castling & 2) cast += "Q";
        if (this.castling & 4) cast += "k";
        if (this.castling & 8) cast += "q";
        fen += (cast === "" ? "-" : cast) + " ";

        fen += (this.epSquare !== -1 ? this.squareToString(this.epSquare) : "-") + " ";
        fen += this.halfmove + " " + this.fullmove;
        return fen;
    }

    getFenPositionOnly() {
        let fen = "";
        for (let r = 7; r >= 0; r--) {
            let emptyCount = 0;
            for (let f = 0; f < 8; f++) {
                const p = this.board[(r << 3) | f];
                if (p === EMPTY) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += p;
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (r > 0) fen += "/";
        }
        return fen + " " + (this.side === WHITE ? "w" : "b") + " " + this.castling + " " + (this.epSquare !== -1 ? this.squareToString(this.epSquare) : "-");
    }

    isSquareAttacked(sq, byColor) {
        // Pawn attacks
        const pRank = sq >> 3;
        const pFile = sq & 7;
        if (byColor === WHITE) {
            if (pRank > 0) {
                if (pFile > 0 && this.board[sq - 9] === 'P') return true;
                if (pFile < 7 && this.board[sq - 7] === 'P') return true;
            }
        } else {
            if (pRank < 7) {
                if (pFile > 0 && this.board[sq + 7] === 'p') return true;
                if (pFile < 7 && this.board[sq + 9] === 'p') return true;
            }
        }

        // Knight attacks
        const knOffsets = [-17, -15, -10, -6, 6, 10, 15, 17];
        const targetKnight = (byColor === WHITE) ? 'N' : 'n';
        for (let off of knOffsets) {
            const to = sq + off;
            if (to >= 0 && to < 64) {
                const df = Math.abs((to & 7) - pFile);
                const dr = Math.abs((to >> 3) - pRank);
                if (df + dr === 3 && df >= 1 && dr >= 1) {
                    if (this.board[to] === targetKnight) return true;
                }
            }
        }

        // King attacks
        const kOffsets = [-9, -8, -7, -1, 1, 7, 8, 9];
        const targetKing = (byColor === WHITE) ? 'K' : 'k';
        for (let off of kOffsets) {
            const to = sq + off;
            if (to >= 0 && to < 64) {
                if (Math.abs((to & 7) - pFile) <= 1 && Math.abs((to >> 3) - pRank) <= 1) {
                    if (this.board[to] === targetKing) return true;
                }
            }
        }

        // Slider attacks (Bishops/Queens diagonals, Rooks/Queens straight)
        const targetQueen = (byColor === WHITE) ? 'Q' : 'q';
        const targetBishop = (byColor === WHITE) ? 'B' : 'b';
        const targetRook = (byColor === WHITE) ? 'R' : 'r';

        const diagDirs = [
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        for (let [df, dr] of diagDirs) {
            let f = pFile + df;
            let r = pRank + dr;
            while (f >= 0 && f < 8 && r >= 0 && r < 8) {
                const s = (r << 3) | f;
                const p = this.board[s];
                if (p !== EMPTY) {
                    if (p === targetBishop || p === targetQueen) return true;
                    break;
                }
                f += df;
                r += dr;
            }
        }

        const straightDirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        for (let [df, dr] of straightDirs) {
            let f = pFile + df;
            let r = pRank + dr;
            while (f >= 0 && f < 8 && r >= 0 && r < 8) {
                const s = (r << 3) | f;
                const p = this.board[s];
                if (p !== EMPTY) {
                    if (p === targetRook || p === targetQueen) return true;
                    break;
                }
                f += df;
                r += dr;
            }
        }

        return false;
    }

    inCheck(side = this.side) {
        const king = (side === WHITE) ? 'K' : 'k';
        let kingSq = -1;
        for (let i = 0; i < 64; i++) {
            if (this.board[i] === king) {
                kingSq = i;
                break;
            }
        }
        if (kingSq === -1) return false;
        return this.isSquareAttacked(kingSq, 1 - side);
    }

    generatePseudoMoves() {
        const moves = [];
        const us = this.side;
        const them = 1 - us;

        for (let sq = 0; sq < 64; sq++) {
            const p = this.board[sq];
            if (p === EMPTY || this.pieceColor(p) !== us) continue;

            const rank = sq >> 3;
            const file = sq & 7;
            const type = p.toLowerCase();

            if (type === 'p') {
                const fwd = (us === WHITE) ? 8 : -8;
                const startRank = (us === WHITE) ? 1 : 6;
                const promoRank = (us === WHITE) ? 7 : 0;

                // Single push
                const to1 = sq + fwd;
                if (to1 >= 0 && to1 < 64 && this.board[to1] === EMPTY) {
                    if ((to1 >> 3) === promoRank) {
                        for (let pr of ['q', 'r', 'b', 'n']) {
                            moves.push({ from: sq, to: to1, promo: pr, captured: EMPTY });
                        }
                    } else {
                        moves.push({ from: sq, to: to1, promo: null, captured: EMPTY });
                        // Double push
                        const to2 = sq + fwd + fwd;
                        if (rank === startRank && this.board[to2] === EMPTY) {
                            moves.push({ from: sq, to: to2, promo: null, captured: EMPTY, isDouble: true });
                        }
                    }
                }

                // Captures
                const capOffsets = (us === WHITE) ? [7, 9] : [-9, -7];
                for (let off of capOffsets) {
                    const to = sq + off;
                    if (to >= 0 && to < 64 && Math.abs((to & 7) - file) === 1) {
                        const target = this.board[to];
                        if (target !== EMPTY && this.pieceColor(target) === them) {
                            if ((to >> 3) === promoRank) {
                                for (let pr of ['q', 'r', 'b', 'n']) {
                                    moves.push({ from: sq, to: to, promo: pr, captured: target });
                                }
                            } else {
                                moves.push({ from: sq, to: to, promo: null, captured: target });
                            }
                        } else if (to === this.epSquare) {
                            // En-passant capture
                            moves.push({ from: sq, to: to, promo: null, captured: (us === WHITE ? 'p' : 'P'), isEp: true });
                        }
                    }
                }
            } else if (type === 'n') {
                const knOffsets = [-17, -15, -10, -6, 6, 10, 15, 17];
                for (let off of knOffsets) {
                    const to = sq + off;
                    if (to >= 0 && to < 64) {
                        const df = Math.abs((to & 7) - file);
                        const dr = Math.abs((to >> 3) - rank);
                        if (df + dr === 3 && df >= 1 && dr >= 1) {
                            const target = this.board[to];
                            if (target === EMPTY || this.pieceColor(target) === them) {
                                moves.push({ from: sq, to: to, promo: null, captured: target });
                            }
                        }
                    }
                }
            } else if (type === 'b' || type === 'r' || type === 'q') {
                const dirs = [];
                if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
                if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

                for (let [df, dr] of dirs) {
                    let f = file + df;
                    let r = rank + dr;
                    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
                        const to = (r << 3) | f;
                        const target = this.board[to];
                        if (target === EMPTY) {
                            moves.push({ from: sq, to: to, promo: null, captured: EMPTY });
                        } else {
                            if (this.pieceColor(target) === them) {
                                moves.push({ from: sq, to: to, promo: null, captured: target });
                            }
                            break;
                        }
                        f += df;
                        r += dr;
                    }
                }
            } else if (type === 'k') {
                const kOffsets = [-9, -8, -7, -1, 1, 7, 8, 9];
                for (let off of kOffsets) {
                    const to = sq + off;
                    if (to >= 0 && to < 64 && Math.abs((to & 7) - file) <= 1 && Math.abs((to >> 3) - rank) <= 1) {
                        const target = this.board[to];
                        if (target === EMPTY || this.pieceColor(target) === them) {
                            moves.push({ from: sq, to: to, promo: null, captured: target });
                        }
                    }
                }

                // Castling
                if (us === WHITE && sq === 4 && !this.inCheck(WHITE)) {
                    // Kingside (e1 -> g1)
                    if ((this.castling & 1) && this.board[5] === EMPTY && this.board[6] === EMPTY && this.board[7] === 'R') {
                        if (!this.isSquareAttacked(5, BLACK) && !this.isSquareAttacked(6, BLACK)) {
                            moves.push({ from: 4, to: 6, promo: null, captured: EMPTY, isCastle: 'K' });
                        }
                    }
                    // Queenside (e1 -> c1)
                    if ((this.castling & 2) && this.board[3] === EMPTY && this.board[2] === EMPTY && this.board[1] === EMPTY && this.board[0] === 'R') {
                        if (!this.isSquareAttacked(3, BLACK) && !this.isSquareAttacked(2, BLACK)) {
                            moves.push({ from: 4, to: 2, promo: null, captured: EMPTY, isCastle: 'Q' });
                        }
                    }
                } else if (us === BLACK && sq === 60 && !this.inCheck(BLACK)) {
                    // Kingside (e8 -> g8)
                    if ((this.castling & 4) && this.board[61] === EMPTY && this.board[62] === EMPTY && this.board[63] === 'r') {
                        if (!this.isSquareAttacked(61, WHITE) && !this.isSquareAttacked(62, WHITE)) {
                            moves.push({ from: 60, to: 62, promo: null, captured: EMPTY, isCastle: 'k' });
                        }
                    }
                    // Queenside (e8 -> c8)
                    if ((this.castling & 8) && this.board[59] === EMPTY && this.board[58] === EMPTY && this.board[57] === EMPTY && this.board[56] === 'r') {
                        if (!this.isSquareAttacked(59, WHITE) && !this.isSquareAttacked(58, WHITE)) {
                            moves.push({ from: 60, to: 58, promo: null, captured: EMPTY, isCastle: 'q' });
                        }
                    }
                }
            }
        }

        return moves;
    }

    makeMove(move) {
        const state = {
            move: move,
            board: [...this.board],
            side: this.side,
            castling: this.castling,
            epSquare: this.epSquare,
            halfmove: this.halfmove,
            fullmove: this.fullmove
        };
        this.history.push(state);

        const us = this.side;
        const p = this.board[move.from];
        const isCapture = move.captured !== EMPTY;
        const isPawn = (p.toLowerCase() === 'p');

        // Halfmove clock reset on pawn push or capture
        if (isPawn || isCapture) {
            this.halfmove = 0;
        } else {
            this.halfmove++;
        }

        // Apply piece move
        this.board[move.from] = EMPTY;
        if (move.promo) {
            this.board[move.to] = (us === WHITE) ? move.promo.toUpperCase() : move.promo.toLowerCase();
        } else {
            this.board[move.to] = p;
        }

        // Handle En Passant capture removal
        if (move.isEp) {
            const epPawnSq = (us === WHITE) ? (move.to - 8) : (move.to + 8);
            this.board[epPawnSq] = EMPTY;
        }

        // Handle Castling Rook move
        if (move.isCastle) {
            if (move.isCastle === 'K') {
                this.board[7] = EMPTY;
                this.board[5] = 'R';
            } else if (move.isCastle === 'Q') {
                this.board[0] = EMPTY;
                this.board[3] = 'R';
            } else if (move.isCastle === 'k') {
                this.board[63] = EMPTY;
                this.board[61] = 'r';
            } else if (move.isCastle === 'q') {
                this.board[56] = EMPTY;
                this.board[59] = 'r';
            }
        }

        // Update Castling rights if king or rook moved or rook captured
        if (move.from === 4) this.castling &= ~3;
        else if (move.from === 60) this.castling &= ~12;
        else if (move.from === 0) this.castling &= ~2;
        else if (move.from === 7) this.castling &= ~1;
        else if (move.from === 56) this.castling &= ~8;
        else if (move.from === 63) this.castling &= ~4;

        if (move.to === 0) this.castling &= ~2;
        else if (move.to === 7) this.castling &= ~1;
        else if (move.to === 56) this.castling &= ~8;
        else if (move.to === 63) this.castling &= ~4;

        // Set en-passant square if double push
        if (move.isDouble) {
            this.epSquare = (us === WHITE) ? (move.from + 8) : (move.from - 8);
        } else {
            this.epSquare = -1;
        }

        if (us === BLACK) {
            this.fullmove++;
        }
        this.side = 1 - us;

        this.positionHistory.push(this.getFenPositionOnly());
    }

    undoMove() {
        if (this.history.length === 0) return null;
        const state = this.history.pop();
        this.positionHistory.pop();

        this.board = state.board;
        this.side = state.side;
        this.castling = state.castling;
        this.epSquare = state.epSquare;
        this.halfmove = state.halfmove;
        this.fullmove = state.fullmove;

        return state.move;
    }

    getLegalMoves() {
        const pseudo = this.generatePseudoMoves();
        const legal = [];
        const us = this.side;

        for (let m of pseudo) {
            this.makeMove(m);
            // If our king is in check after making the move, it's illegal
            if (!this.inCheck(us)) {
                legal.push(m);
            }
            this.undoMove();
        }

        return legal;
    }

    isCheckmate() {
        return this.inCheck() && this.getLegalMoves().length === 0;
    }

    isStalemate() {
        return !this.inCheck() && this.getLegalMoves().length === 0;
    }

    isThreefoldRepetition() {
        const current = this.getFenPositionOnly();
        let count = 0;
        for (let fen of this.positionHistory) {
            if (fen === current) count++;
        }
        return count >= 3;
    }

    is50MoveRule() {
        return this.halfmove >= 100;
    }

    isInsufficientMaterial() {
        const pieces = [];
        for (let p of this.board) {
            if (p !== EMPTY) pieces.push(p.toLowerCase());
        }
        if (pieces.length === 2) return true; // K vs K
        if (pieces.length === 3) {
            // K + B vs K or K + N vs K
            return pieces.includes('b') || pieces.includes('n');
        }
        return false;
    }

    isGameOver() {
        if (this.isCheckmate()) return { over: true, result: (this.side === WHITE ? "0-1" : "1-0"), reason: "Checkmate" };
        if (this.isStalemate()) return { over: true, result: "1/2-1/2", reason: "Stalemate" };
        if (this.isThreefoldRepetition()) return { over: true, result: "1/2-1/2", reason: "Threefold Repetition" };
        if (this.is50MoveRule()) return { over: true, result: "1/2-1/2", reason: "50-Move Rule" };
        if (this.isInsufficientMaterial()) return { over: true, result: "1/2-1/2", reason: "Insufficient Material" };
        return { over: false };
    }

    moveToSan(move) {
        if (move.isCastle) {
            return (move.isCastle === 'K' || move.isCastle === 'k') ? "O-O" : "O-O-O";
        }

        const p = this.board[move.from];
        const type = p.toLowerCase();
        let san = "";

        if (type !== 'p') {
            san += type.toUpperCase();
            // Disambiguation
            const legalMoves = this.getLegalMoves();
            const sameTypeSameTarget = legalMoves.filter(m => 
                m.from !== move.from && 
                m.to === move.to && 
                this.board[m.from].toLowerCase() === type
            );

            if (sameTypeSameTarget.length > 0) {
                const sameFile = sameTypeSameTarget.some(m => (m.from & 7) === (move.from & 7));
                const sameRank = sameTypeSameTarget.some(m => (m.from >> 3) === (move.from >> 3));

                if (!sameFile) {
                    san += String.fromCharCode('a'.charCodeAt(0) + (move.from & 7));
                } else if (!sameRank) {
                    san += ((move.from >> 3) + 1);
                } else {
                    san += String.fromCharCode('a'.charCodeAt(0) + (move.from & 7)) + ((move.from >> 3) + 1);
                }
            }
        }

        if (move.captured !== EMPTY || move.isEp) {
            if (type === 'p') {
                san += String.fromCharCode('a'.charCodeAt(0) + (move.from & 7));
            }
            san += "x";
        }

        san += this.squareToString(move.to);

        if (move.promo) {
            san += "=" + move.promo.toUpperCase();
        }

        // Test if causes check or checkmate
        this.makeMove(move);
        if (this.inCheck()) {
            san += (this.getLegalMoves().length === 0) ? "#" : "+";
        }
        this.undoMove();

        return san;
    }
}
