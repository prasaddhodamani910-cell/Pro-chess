package com.chessvision.app

import kotlin.math.max
import kotlin.math.min

/**
 * Pure Kotlin Chess Engine - Chessmod
 * by author PRASAD DHODAMANI
 *
 * Provides fast FEN parsing, legal move generation, piece-square evaluations,
 * and alpha-beta minimax search with iterative deepening.
 */
class ChessEngine {

    companion object {
        const val INF = 1000000
        const val CHECKMATE = 900000

        // Piece values
        val PIECE_VALUES = mapOf(
            'P' to 100, 'N' to 320, 'B' to 330, 'R' to 500, 'Q' to 900, 'K' to 20000,
            'p' to -100, 'n' to -320, 'b' to -330, 'r' to -500, 'q' to -900, 'k' to -20000
        )

        // Piece-Square Tables (White perspective: rank 0=8 to rank 7=1)
        val PAWN_PST = intArrayOf(
             0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
             5,  5, 10, 25, 25, 10,  5,  5,
             0,  0,  0, 20, 20,  0,  0,  0,
             5, -5,-10,  0,  0,-10, -5,  5,
             5, 10, 10,-20,-20, 10, 10,  5,
             0,  0,  0,  0,  0,  0,  0,  0
        )

        val KNIGHT_PST = intArrayOf(
            -50,-40,-30,-30,-30,-30,-40,-50,
            -40,-20,  0,  0,  0,  0,-20,-40,
            -30,  0, 10, 15, 15, 10,  0,-30,
            -30,  5, 15, 20, 20, 15,  5,-30,
            -30,  0, 15, 20, 20, 15,  0,-30,
            -30,  5, 10, 15, 15, 10,  5,-30,
            -40,-20,  0,  5,  5,  0,-20,-40,
            -50,-40,-30,-30,-30,-30,-40,-50
        )

        val BISHOP_PST = intArrayOf(
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5, 10, 10,  5,  0,-10,
            -10,  5,  5, 10, 10,  5,  5,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10, 10, 10, 10, 10, 10, 10,-10,
            -10,  5,  0,  0,  0,  0,  5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        )

        val ROOK_PST = intArrayOf(
              0,  0,  0,  0,  0,  0,  0,  0,
              5, 10, 10, 10, 10, 10, 10,  5,
             -5,  0,  0,  0,  0,  0,  0, -5,
             -5,  0,  0,  0,  0,  0,  0, -5,
             -5,  0,  0,  0,  0,  0,  0, -5,
             -5,  0,  0,  0,  0,  0,  0, -5,
             -5,  0,  0,  0,  0,  0,  0, -5,
              0,  0,  0,  5,  5,  0,  0,  0
        )

        val QUEEN_PST = intArrayOf(
            -20,-10,-10, -5, -5,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5,  5,  5,  5,  0,-10,
             -5,  0,  5,  5,  5,  5,  0, -5,
              0,  0,  5,  5,  5,  5,  0, -5,
            -10,  5,  5,  5,  5,  5,  0,-10,
            -10,  0,  5,  0,  0,  0,  0,-10,
            -20,-10,-10, -5, -5,-10,-10,-20
        )

        val KING_PST = intArrayOf(
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -10,-20,-20,-20,-20,-20,-20,-10,
             20, 20,  0,  0,  0,  0, 20, 20,
             20, 30, 10,  0,  0, 10, 30, 20
        )
    }

    data class Move(val from: Int, val to: Int, val promo: Char = ' ', val capture: Char = '.') {
        fun toUci(): String {
            val f = "${('a'.code + (from % 8)).toChar()}${8 - (from / 8)}"
            val t = "${('a'.code + (to % 8)).toChar()}${8 - (to / 8)}"
            val p = if (promo != ' ') promo.lowercaseChar().toString() else ""
            return "$f$t$p"
        }

        fun toSan(board: Board): String {
            val p = board.getPiece(from)
            val pieceType = p.uppercaseChar()
            val targetSquare = "${('a'.code + (to % 8)).toChar()}${8 - (to / 8)}"
            val isCapture = capture != '.' || (pieceType == 'P' && (from % 8 != to % 8))
            val promoStr = if (promo != ' ') "=${promo.uppercaseChar()}" else ""

            if (pieceType == 'K') {
                if (from == 60 && to == 62) return "O-O"
                if (from == 60 && to == 58) return "O-O-O"
                if (from == 4 && to == 6) return "O-O"
                if (from == 4 && to == 2) return "O-O-O"
            }

            if (pieceType == 'P') {
                return if (isCapture) {
                    val fileChar = ('a'.code + (from % 8)).toChar()
                    "${fileChar}x$targetSquare$promoStr"
                } else {
                    "$targetSquare$promoStr"
                }
            }

            val capStr = if (isCapture) "x" else ""
            return "$pieceType$capStr$targetSquare"
        }
    }

    data class AnalysisResult(
        val ok: Boolean,
        val bestMove: String = "",
        val uci: String = "",
        val score: String = "+0.00",
        val scoreVal: Double = 0.0,
        val depth: Int = 0,
        val nodes: Long = 0,
        val pv: List<String> = emptyList(),
        val fen: String = "",
        val turn: String = "White",
        val error: String = ""
    )

    class Board(
        val squares: CharArray = CharArray(64) { '.' },
        var turn: Char = 'w',
        var castling: String = "KQkq",
        var epSquare: Int = -1
    ) {
        fun copy(): Board {
            return Board(squares.copyOf(), turn, castling, epSquare)
        }

        fun getPiece(sq: Int): Char = squares[sq]
        fun setPiece(sq: Int, p: Char) { squares[sq] = p }

        companion object {
            fun fromFen(fen: String, defaultTurn: Char = 'w'): Board {
                val parts = fen.trim().split("\\s+".toRegex())
                val board = Board()
                val placement = parts[0]
                var rank = 0
                var file = 0
                for (ch in placement) {
                    when {
                        ch == '/' -> {
                            rank++
                            file = 0
                        }
                        ch.isDigit() -> {
                            file += (ch - '0')
                        }
                        else -> {
                            if (rank in 0..7 && file in 0..7) {
                                board.squares[rank * 8 + file] = ch
                            }
                            file++
                        }
                    }
                }

                board.turn = if (parts.size > 1 && parts[1].isNotEmpty()) {
                    parts[1][0].lowercaseChar()
                } else {
                    defaultTurn
                }

                board.castling = if (parts.size > 2) parts[2] else "-"
                board.epSquare = if (parts.size > 3 && parts[3] != "-") {
                    val ep = parts[3]
                    if (ep.length == 2) {
                        val f = ep[0] - 'a'
                        val r = 8 - (ep[1] - '0')
                        if (f in 0..7 && r in 0..7) r * 8 + f else -1
                    } else -1
                } else -1

                return board
            }
        }
    }

    private var nodeCount = 0L
    private var stopSearch = false
    private var searchEndTime = 0L

    fun analyze(fen: String, turn: Char = 'w', maxThinkMs: Long = 1000): AnalysisResult {
        return try {
            val board = Board.fromFen(fen, turn)
            if (turn == 'w' || turn == 'b') {
                board.turn = turn
            }

            nodeCount = 0L
            stopSearch = false
            searchEndTime = System.currentTimeMillis() + maxThinkMs

            val legalMoves = generateLegalMoves(board)
            if (legalMoves.isEmpty()) {
                val inCheck = isKingInCheck(board, board.turn)
                return if (inCheck) {
                    AnalysisResult(
                        ok = true,
                        bestMove = "-",
                        score = if (board.turn == 'w') "#-0" else "#+0",
                        depth = 0,
                        fen = fen,
                        turn = if (board.turn == 'w') "White" else "Black"
                    )
                } else {
                    AnalysisResult(
                        ok = true,
                        bestMove = "-",
                        score = "0.00",
                        depth = 0,
                        fen = fen,
                        turn = if (board.turn == 'w') "White" else "Black"
                    )
                }
            }

            var bestMoveOverall: Move = legalMoves[0]
            var bestScoreOverall = if (board.turn == 'w') -INF else INF
            var maxDepthReached = 1

            // Iterative deepening from depth 1 to 6
            for (d in 1..6) {
                if (System.currentTimeMillis() >= searchEndTime) break
                var currentBestMove = bestMoveOverall
                var currentBestScore = if (board.turn == 'w') -INF else INF

                val orderedMoves = orderMoves(board, legalMoves)
                var alpha = -INF
                var beta = INF

                for (m in orderedMoves) {
                    val nb = makeMove(board, m)
                    val score = alphaBeta(nb, d - 1, alpha, beta, nb.turn == 'w')

                    if (board.turn == 'w') {
                        if (score > currentBestScore) {
                            currentBestScore = score
                            currentBestMove = m
                        }
                        alpha = max(alpha, score)
                    } else {
                        if (score < currentBestScore) {
                            currentBestScore = score
                            currentBestMove = m
                        }
                        beta = min(beta, score)
                    }
                    if (beta <= alpha || stopSearch) break
                }

                if (!stopSearch) {
                    bestMoveOverall = currentBestMove
                    bestScoreOverall = currentBestScore
                    maxDepthReached = d
                }
            }

            val scoreStr = formatScore(bestScoreOverall, board.turn)
            val scoreVal = bestScoreOverall / 100.0
            val sanMove = bestMoveOverall.toSan(board)
            val uciMove = bestMoveOverall.toUci()
            val displayMove = if (sanMove != uciMove) "$sanMove ($uciMove)" else sanMove

            AnalysisResult(
                ok = true,
                bestMove = displayMove,
                uci = uciMove,
                score = scoreStr,
                scoreVal = scoreVal,
                depth = maxDepthReached,
                nodes = nodeCount,
                pv = listOf(uciMove),
                fen = fen,
                turn = if (board.turn == 'w') "White" else "Black"
            )
        } catch (e: Exception) {
            AnalysisResult(ok = false, error = e.message ?: "Analysis failed")
        }
    }

    private fun formatScore(score: Int, turn: Char): String {
        return when {
            score >= CHECKMATE - 100 -> "#+" + ((CHECKMATE - score + 1) / 2)
            score <= -CHECKMATE + 100 -> "#-" + ((CHECKMATE + score + 1) / 2)
            else -> {
                val pawns = score / 100.0
                if (pawns >= 0) "+%.2f".format(pawns) else "%.2f".format(pawns)
            }
        }
    }

    private fun alphaBeta(board: Board, depth: Int, mutAlpha: Int, mutBeta: Int, isWhite: Boolean): Int {
        nodeCount++
        if (System.currentTimeMillis() >= searchEndTime) {
            stopSearch = true
            return evaluate(board)
        }

        if (depth <= 0) {
            return quiescence(board, mutAlpha, mutBeta, isWhite, 0)
        }

        val moves = generateLegalMoves(board)
        if (moves.isEmpty()) {
            return if (isKingInCheck(board, board.turn)) {
                if (isWhite) -CHECKMATE - depth else CHECKMATE + depth
            } else {
                0 // Stalemate
            }
        }

        var alpha = mutAlpha
        var beta = mutBeta
        val orderedMoves = orderMoves(board, moves)

        if (isWhite) {
            var maxEval = -INF
            for (m in orderedMoves) {
                val nb = makeMove(board, m)
                val eval = alphaBeta(nb, depth - 1, alpha, beta, false)
                maxEval = max(maxEval, eval)
                alpha = max(alpha, eval)
                if (beta <= alpha || stopSearch) break
            }
            return maxEval
        } else {
            var minEval = INF
            for (m in orderedMoves) {
                val nb = makeMove(board, m)
                val eval = alphaBeta(nb, depth - 1, alpha, beta, true)
                minEval = min(minEval, eval)
                beta = min(beta, eval)
                if (beta <= alpha || stopSearch) break
            }
            return minEval
        }
    }

    private fun quiescence(board: Board, mutAlpha: Int, mutBeta: Int, isWhite: Boolean, qDepth: Int): Int {
        nodeCount++
        val standPat = evaluate(board)
        if (qDepth >= 3 || System.currentTimeMillis() >= searchEndTime) return standPat

        var alpha = mutAlpha
        var beta = mutBeta

        if (isWhite) {
            if (standPat >= beta) return beta
            if (standPat > alpha) alpha = standPat

            val captures = generateLegalMoves(board).filter { it.capture != '.' }
            for (m in captures) {
                val nb = makeMove(board, m)
                val score = quiescence(nb, alpha, beta, false, qDepth + 1)
                if (score >= beta) return beta
                if (score > alpha) alpha = score
            }
            return alpha
        } else {
            if (standPat <= alpha) return alpha
            if (standPat < beta) beta = standPat

            val captures = generateLegalMoves(board).filter { it.capture != '.' }
            for (m in captures) {
                val nb = makeMove(board, m)
                val score = quiescence(nb, alpha, beta, true, qDepth + 1)
                if (score <= alpha) return alpha
                if (score < beta) beta = score
            }
            return beta
        }
    }

    fun evaluate(board: Board): Int {
        var score = 0
        for (i in 0..63) {
            val p = board.getPiece(i)
            if (p == '.') continue
            val valBase = PIECE_VALUES[p] ?: 0
            val pstVal = getPstValue(p, i)
            score += (valBase + pstVal)
        }
        return score
    }

    private fun getPstValue(piece: Char, sq: Int): Int {
        val rank = sq / 8
        val file = sq % 8
        val whiteSq = sq
        val blackSq = (7 - rank) * 8 + file

        return when (piece) {
            'P' -> PAWN_PST[whiteSq]
            'p' -> -PAWN_PST[blackSq]
            'N' -> KNIGHT_PST[whiteSq]
            'n' -> -KNIGHT_PST[blackSq]
            'B' -> BISHOP_PST[whiteSq]
            'b' -> -BISHOP_PST[blackSq]
            'R' -> ROOK_PST[whiteSq]
            'r' -> -ROOK_PST[blackSq]
            'Q' -> QUEEN_PST[whiteSq]
            'q' -> -QUEEN_PST[blackSq]
            'K' -> KING_PST[whiteSq]
            'k' -> -KING_PST[blackSq]
            else -> 0
        }
    }

    private fun orderMoves(board: Board, moves: List<Move>): List<Move> {
        return moves.sortedByDescending { m ->
            var score = 0
            if (m.capture != '.') {
                val victimVal = kotlin.math.abs(PIECE_VALUES[m.capture] ?: 0)
                val attackerVal = kotlin.math.abs(PIECE_VALUES[board.getPiece(m.from)] ?: 0)
                score += 1000 + (victimVal - attackerVal / 10)
            }
            if (m.promo != ' ') score += 800
            score
        }
    }

    fun generateLegalMoves(board: Board): List<Move> {
        val pseudoMoves = generatePseudoMoves(board)
        val legalMoves = ArrayList<Move>(pseudoMoves.size)
        val turn = board.turn
        for (m in pseudoMoves) {
            val nextBoard = makeMove(board, m)
            if (!isKingInCheck(nextBoard, turn)) {
                legalMoves.add(m)
            }
        }
        return legalMoves
    }

    private fun generatePseudoMoves(board: Board): List<Move> {
        val moves = ArrayList<Move>(60)
        val isWhite = board.turn == 'w'

        for (sq in 0..63) {
            val p = board.getPiece(sq)
            if (p == '.') continue
            val pieceIsWhite = p.isUpperCase()
            if (pieceIsWhite != isWhite) continue

            val rank = sq / 8
            val file = sq % 8

            when (p.uppercaseChar()) {
                'P' -> {
                    val dir = if (isWhite) -1 else 1
                    val startRank = if (isWhite) 6 else 1
                    val promoRank = if (isWhite) 0 else 7

                    // Step 1 forward
                    val fwd = (rank + dir) * 8 + file
                    if (fwd in 0..63 && board.getPiece(fwd) == '.') {
                        if (rank + dir == promoRank) {
                            for (promo in listOf('Q', 'R', 'B', 'N')) {
                                moves.add(Move(sq, fwd, promo = promo))
                            }
                        } else {
                            moves.add(Move(sq, fwd))
                            // Double step
                            if (rank == startRank) {
                                val fwd2 = (rank + 2 * dir) * 8 + file
                                if (fwd2 in 0..63 && board.getPiece(fwd2) == '.') {
                                    moves.add(Move(sq, fwd2))
                                }
                            }
                        }
                    }

                    // Diagonal captures
                    for (df in listOf(-1, 1)) {
                        val nf = file + df
                        val nr = rank + dir
                        if (nf in 0..7 && nr in 0..7) {
                            val targetSq = nr * 8 + nf
                            val targetPiece = board.getPiece(targetSq)
                            if (targetPiece != '.' && targetPiece.isUpperCase() != isWhite) {
                                if (nr == promoRank) {
                                    for (promo in listOf('Q', 'R', 'B', 'N')) {
                                        moves.add(Move(sq, targetSq, promo = promo, capture = targetPiece))
                                    }
                                } else {
                                    moves.add(Move(sq, targetSq, capture = targetPiece))
                                }
                            } else if (targetSq == board.epSquare) {
                                moves.add(Move(sq, targetSq, capture = if (isWhite) 'p' else 'P'))
                            }
                        }
                    }
                }
                'N' -> {
                    val knightOffsets = listOf(
                        -17, -15, -10, -6, 6, 10, 15, 17
                    )
                    for (off in knightOffsets) {
                        val to = sq + off
                        if (to in 0..63) {
                            val toRank = to / 8
                            val toFile = to % 8
                            if (kotlin.math.abs(toFile - file) in 1..2 && kotlin.math.abs(toRank - rank) in 1..2) {
                                val tp = board.getPiece(to)
                                if (tp == '.') moves.add(Move(sq, to))
                                else if (tp.isUpperCase() != isWhite) moves.add(Move(sq, to, capture = tp))
                            }
                        }
                    }
                }
                'B' -> generateRayMoves(board, sq, moves, isWhite, listOf(-9, -7, 7, 9))
                'R' -> generateRayMoves(board, sq, moves, isWhite, listOf(-8, 8, -1, 1))
                'Q' -> generateRayMoves(board, sq, moves, isWhite, listOf(-9, -7, 7, 9, -8, 8, -1, 1))
                'K' -> {
                    val kingOffsets = listOf(-9, -8, -7, -1, 1, 7, 8, 9)
                    for (off in kingOffsets) {
                        val to = sq + off
                        if (to in 0..63) {
                            val toRank = to / 8
                            val toFile = to % 8
                            if (kotlin.math.abs(toFile - file) <= 1 && kotlin.math.abs(toRank - rank) <= 1) {
                                val tp = board.getPiece(to)
                                if (tp == '.') moves.add(Move(sq, to))
                                else if (tp.isUpperCase() != isWhite) moves.add(Move(sq, to, capture = tp))
                            }
                        }
                    }

                    // Castling
                    if (isWhite && sq == 60) { // e1
                        if (board.castling.contains("K") && board.getPiece(61) == '.' && board.getPiece(62) == '.') {
                            if (!isSquareAttacked(board, 60, 'b') && !isSquareAttacked(board, 61, 'b') && !isSquareAttacked(board, 62, 'b')) {
                                moves.add(Move(60, 62))
                            }
                        }
                        if (board.castling.contains("Q") && board.getPiece(59) == '.' && board.getPiece(58) == '.' && board.getPiece(57) == '.') {
                            if (!isSquareAttacked(board, 60, 'b') && !isSquareAttacked(board, 59, 'b') && !isSquareAttacked(board, 58, 'b')) {
                                moves.add(Move(60, 58))
                            }
                        }
                    } else if (!isWhite && sq == 4) { // e8
                        if (board.castling.contains("k") && board.getPiece(5) == '.' && board.getPiece(6) == '.') {
                            if (!isSquareAttacked(board, 4, 'w') && !isSquareAttacked(board, 5, 'w') && !isSquareAttacked(board, 6, 'w')) {
                                moves.add(Move(4, 6))
                            }
                        }
                        if (board.castling.contains("q") && board.getPiece(3) == '.' && board.getPiece(2) == '.' && board.getPiece(1) == '.') {
                            if (!isSquareAttacked(board, 4, 'w') && !isSquareAttacked(board, 3, 'w') && !isSquareAttacked(board, 2, 'w')) {
                                moves.add(Move(4, 2))
                            }
                        }
                    }
                }
            }
        }
        return moves
    }

    private fun generateRayMoves(board: Board, sq: Int, moves: ArrayList<Move>, isWhite: Boolean, rayDirs: List<Int>) {
        for (dir in rayDirs) {
            var curr = sq
            while (true) {
                val prevRank = curr / 8
                val prevFile = curr % 8
                curr += dir
                if (curr !in 0..63) break
                val currRank = curr / 8
                val currFile = curr % 8
                if (kotlin.math.abs(currFile - prevFile) > 1 || kotlin.math.abs(currRank - prevRank) > 1) break

                val tp = board.getPiece(curr)
                if (tp == '.') {
                    moves.add(Move(sq, curr))
                } else {
                    if (tp.isUpperCase() != isWhite) {
                        moves.add(Move(sq, curr, capture = tp))
                    }
                    break
                }
            }
        }
    }

    fun makeMove(board: Board, move: Move): Board {
        val nb = board.copy()
        var p = nb.getPiece(move.from)
        val isWhite = p.isUpperCase()

        if (move.promo != ' ') {
            p = if (isWhite) move.promo.uppercaseChar() else move.promo.lowercaseChar()
        }

        nb.setPiece(move.from, '.')
        nb.setPiece(move.to, p)

        // En passant capture
        if ((p == 'P' || p == 'p') && move.to == board.epSquare) {
            val capturedPawnSq = if (isWhite) move.to + 8 else move.to - 8
            if (capturedPawnSq in 0..63) nb.setPiece(capturedPawnSq, '.')
        }

        // Set en passant square for next move
        nb.epSquare = -1
        if (p == 'P' && move.from / 8 == 6 && move.to / 8 == 4) {
            nb.epSquare = move.from - 8
        } else if (p == 'p' && move.from / 8 == 1 && move.to / 8 == 3) {
            nb.epSquare = move.from + 8
        }

        // Castling rook move
        if (p == 'K' && move.from == 60) {
            if (move.to == 62) { nb.setPiece(63, '.'); nb.setPiece(61, 'R') }
            else if (move.to == 58) { nb.setPiece(56, '.'); nb.setPiece(59, 'R') }
            nb.castling = nb.castling.replace("K", "").replace("Q", "")
        } else if (p == 'k' && move.from == 4) {
            if (move.to == 6) { nb.setPiece(7, '.'); nb.setPiece(5, 'r') }
            else if (move.to == 2) { nb.setPiece(0, '.'); nb.setPiece(3, 'r') }
            nb.castling = nb.castling.replace("k", "").replace("q", "")
        }

        // Castling rights update if rook moves or is captured
        if (move.from == 63 || move.to == 63) nb.castling = nb.castling.replace("K", "")
        if (move.from == 56 || move.to == 56) nb.castling = nb.castling.replace("Q", "")
        if (move.from == 7 || move.to == 7) nb.castling = nb.castling.replace("k", "")
        if (move.from == 0 || move.to == 0) nb.castling = nb.castling.replace("q", "")
        if (nb.castling.isEmpty()) nb.castling = "-"

        nb.turn = if (isWhite) 'b' else 'w'
        return nb
    }

    private fun isKingInCheck(board: Board, turn: Char): Boolean {
        val kingChar = if (turn == 'w') 'K' else 'k'
        var kingSq = -1
        for (i in 0..63) {
            if (board.getPiece(i) == kingChar) {
                kingSq = i
                break
            }
        }
        if (kingSq == -1) return false
        val enemyColor = if (turn == 'w') 'b' else 'w'
        return isSquareAttacked(board, kingSq, enemyColor)
    }

    private fun isSquareAttacked(board: Board, sq: Int, byColor: Char): Boolean {
        val byWhite = byColor == 'w'
        val sqRank = sq / 8
        val sqFile = sq % 8

        // Pawn attacks
        val pDir = if (byWhite) 1 else -1 // inverted because looking from square to attacker
        for (df in listOf(-1, 1)) {
            val f = sqFile + df
            val r = sqRank + pDir
            if (f in 0..7 && r in 0..7) {
                val p = board.getPiece(r * 8 + f)
                if (p == (if (byWhite) 'P' else 'p')) return true
            }
        }

        // Knight attacks
        val knightOffsets = listOf(-17, -15, -10, -6, 6, 10, 15, 17)
        val knightChar = if (byWhite) 'N' else 'n'
        for (off in knightOffsets) {
            val to = sq + off
            if (to in 0..63) {
                if (kotlin.math.abs(to % 8 - sqFile) in 1..2 && kotlin.math.abs(to / 8 - sqRank) in 1..2) {
                    if (board.getPiece(to) == knightChar) return true
                }
            }
        }

        // Diagonals (Bishop / Queen)
        val bChar = if (byWhite) 'B' else 'b'
        val qChar = if (byWhite) 'Q' else 'q'
        for (dir in listOf(-9, -7, 7, 9)) {
            var curr = sq
            while (true) {
                val pf = curr % 8
                val pr = curr / 8
                curr += dir
                if (curr !in 0..63) break
                val cf = curr % 8
                val cr = curr / 8
                if (kotlin.math.abs(cf - pf) > 1 || kotlin.math.abs(cr - pr) > 1) break
                val tp = board.getPiece(curr)
                if (tp != '.') {
                    if (tp == bChar || tp == qChar) return true
                    break
                }
            }
        }

        // Orthogonals (Rook / Queen)
        val rChar = if (byWhite) 'R' else 'r'
        for (dir in listOf(-8, 8, -1, 1)) {
            var curr = sq
            while (true) {
                val pf = curr % 8
                val pr = curr / 8
                curr += dir
                if (curr !in 0..63) break
                val cf = curr % 8
                val cr = curr / 8
                if (kotlin.math.abs(cf - pf) > 1 || kotlin.math.abs(cr - pr) > 1) break
                val tp = board.getPiece(curr)
                if (tp != '.') {
                    if (tp == rChar || tp == qChar) return true
                    break
                }
            }
        }

        // King attacks (adjacent square)
        val kChar = if (byWhite) 'K' else 'k'
        for (off in listOf(-9, -8, -7, -1, 1, 7, 8, 9)) {
            val to = sq + off
            if (to in 0..63) {
                if (kotlin.math.abs(to % 8 - sqFile) <= 1 && kotlin.math.abs(to / 8 - sqRank) <= 1) {
                    if (board.getPiece(to) == kChar) return true
                }
            }
        }

        return false
    }
}
