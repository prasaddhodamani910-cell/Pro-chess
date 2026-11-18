#include "board.h"
#include <sstream>
#include <cctype>
#include <iostream>

static const uint8_t CastlingRightsMask[64] = {
    13, 15, 15, 15, 12, 15, 15, 14,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
    15, 15, 15, 15, 15, 15, 15, 15,
     7, 15, 15, 15,  3, 15, 15, 11
};

Board::Board() {
    clear();
    set_startpos();
}

void Board::clear() {
    for (int p = 0; p < PIECE_NB; ++p) m_piece_bb[p] = 0;
    m_color_bb[WHITE] = 0;
    m_color_bb[BLACK] = 0;
    for (int sq = 0; sq < 64; ++sq) m_board[sq] = NO_PIECE;

    m_side = WHITE;
    m_castling_rights = NO_CASTLING;
    m_ep_square = SQ_NONE;
    m_halfmove_clock = 0;
    m_fullmove_number = 1;
    m_zobrist_key = 0;
    m_history_keys.clear();
}

void Board::put_piece(Piece p, Square sq) {
    Color c = color_of_piece(p);
    m_board[sq] = p;
    set_bit(m_piece_bb[p], sq);
    set_bit(m_color_bb[c], sq);
    m_zobrist_key ^= ZobristPiece[p][sq];
}

void Board::remove_piece(Square sq) {
    Piece p = m_board[sq];
    Color c = color_of_piece(p);
    m_board[sq] = NO_PIECE;
    clear_bit(m_piece_bb[p], sq);
    clear_bit(m_color_bb[c], sq);
    m_zobrist_key ^= ZobristPiece[p][sq];
}

void Board::move_piece(Square from, Square to) {
    Piece p = m_board[from];
    Color c = color_of_piece(p);

    m_board[from] = NO_PIECE;
    m_board[to] = p;

    clear_bit(m_piece_bb[p], from);
    set_bit(m_piece_bb[p], to);

    clear_bit(m_color_bb[c], from);
    set_bit(m_color_bb[c], to);

    m_zobrist_key ^= ZobristPiece[p][from] ^ ZobristPiece[p][to];
}

uint64_t Board::compute_zobrist_key() const {
    uint64_t key = 0;
    for (int sq = 0; sq < 64; ++sq) {
        Piece p = m_board[sq];
        if (p != NO_PIECE) {
            key ^= ZobristPiece[p][sq];
        }
    }
    key ^= ZobristCastle[m_castling_rights];
    if (m_ep_square != SQ_NONE) {
        key ^= ZobristEp[file_of(m_ep_square)];
    }
    if (m_side == BLACK) {
        key ^= ZobristSide;
    }
    return key;
}

void Board::set_startpos() {
    set_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

bool Board::set_fen(const std::string& fen) {
    clear();
    std::istringstream ss(fen);
    std::string pieces_str, side_str, castle_str, ep_str;
    int halfmove = 0, fullmove = 1;

    if (!(ss >> pieces_str >> side_str >> castle_str >> ep_str)) {
        return false;
    }
    ss >> halfmove >> fullmove;

    // 1. Piece placement
    int r = 7, f = 0;
    for (char ch : pieces_str) {
        if (ch == '/') {
            r--;
            f = 0;
        } else if (std::isdigit(ch)) {
            f += ch - '0';
        } else {
            Square sq = make_square(static_cast<File>(f), static_cast<Rank>(r));
            Color c = std::isupper(ch) ? WHITE : BLACK;
            PieceType pt;
            switch (std::tolower(ch)) {
                case 'p': pt = PAWN; break;
                case 'n': pt = KNIGHT; break;
                case 'b': pt = BISHOP; break;
                case 'r': pt = ROOK; break;
                case 'q': pt = QUEEN; break;
                case 'k': pt = KING; break;
                default: return false;
            }
            put_piece(make_piece(c, pt), sq);
            f++;
        }
    }

    // 2. Active side
    m_side = (side_str == "w") ? WHITE : BLACK;

    // 3. Castling rights
    m_castling_rights = NO_CASTLING;
    for (char ch : castle_str) {
        switch (ch) {
            case 'K': m_castling_rights |= WHITE_OO; break;
            case 'Q': m_castling_rights |= WHITE_OOO; break;
            case 'k': m_castling_rights |= BLACK_OO; break;
            case 'q': m_castling_rights |= BLACK_OOO; break;
            default: break;
        }
    }

    // 4. En-passant square
    if (ep_str != "-") {
        m_ep_square = string_to_square(ep_str);
    } else {
        m_ep_square = SQ_NONE;
    }

    // 5. Clocks
    m_halfmove_clock = halfmove;
    m_fullmove_number = (fullmove > 0) ? fullmove : 1;

    m_zobrist_key = compute_zobrist_key();
    m_history_keys.push_back(m_zobrist_key);
    return true;
}

std::string Board::get_fen() const {
    std::ostringstream ss;
    // 1. Pieces
    for (int r = 7; r >= 0; --r) {
        int empty_count = 0;
        for (int f = 0; f < 8; ++f) {
            Square sq = make_square(static_cast<File>(f), static_cast<Rank>(r));
            Piece p = m_board[sq];
            if (p == NO_PIECE) {
                empty_count++;
            } else {
                if (empty_count > 0) {
                    ss << empty_count;
                    empty_count = 0;
                }
                const char piece_chars[] = "PNBRQKpnbrqk";
                ss << piece_chars[p];
            }
        }
        if (empty_count > 0) ss << empty_count;
        if (r > 0) ss << '/';
    }

    // 2. Active side
    ss << (m_side == WHITE ? " w " : " b ");

    // 3. Castling rights
    if (m_castling_rights == NO_CASTLING) {
        ss << "- ";
    } else {
        if (m_castling_rights & WHITE_OO)  ss << 'K';
        if (m_castling_rights & WHITE_OOO) ss << 'Q';
        if (m_castling_rights & BLACK_OO)  ss << 'k';
        if (m_castling_rights & BLACK_OOO) ss << 'q';
        ss << ' ';
    }

    // 4. En-passant
    if (m_ep_square != SQ_NONE) {
        ss << square_to_string(m_ep_square) << ' ';
    } else {
        ss << "- ";
    }

    // 5. Clocks
    ss << m_halfmove_clock << ' ' << m_fullmove_number;
    return ss.str();
}

void Board::print() const {
    std::cout << "\n +---+---+---+---+---+---+---+---+\n";
    const char piece_symbols[] = "PNBRQKpnbrqk";
    for (int r = 7; r >= 0; --r) {
        std::cout << " | ";
        for (int f = 0; f < 8; ++f) {
            Square sq = make_square(static_cast<File>(f), static_cast<Rank>(r));
            Piece p = m_board[sq];
            if (p == NO_PIECE) {
                std::cout << ". | ";
            } else {
                std::cout << piece_symbols[p] << " | ";
            }
        }
        std::cout << (r + 1) << "\n +---+---+---+---+---+---+---+---+\n";
    }
    std::cout << "   a   b   c   d   e   f   g   h\n\n";
    std::cout << "FEN: " << get_fen() << "\n";
    std::cout << "Zobrist: 0x" << std::hex << m_zobrist_key << std::dec << "\n\n";
}

Bitboard Board::attackers_to(Square sq, Bitboard occ) const {
    Bitboard attackers = 0;
    attackers |= (PawnAttacks[WHITE][sq] & pieces(BLACK, PAWN));
    attackers |= (PawnAttacks[BLACK][sq] & pieces(WHITE, PAWN));
    attackers |= (KnightAttacks[sq] & pieces(KNIGHT));
    attackers |= (KingAttacks[sq] & pieces(KING));
    attackers |= (get_bishop_attacks(sq, occ) & (pieces(BISHOP) | pieces(QUEEN)));
    attackers |= (get_rook_attacks(sq, occ) & (pieces(ROOK) | pieces(QUEEN)));
    return attackers;
}

bool Board::is_square_attacked(Square sq, Color by_color) const {
    Bitboard occ = occupied();
    // Pawn attacks: from sq, pawns of by_color that attack sq
    Color victim_color = ~by_color;
    if (PawnAttacks[victim_color][sq] & pieces(by_color, PAWN)) return true;
    if (KnightAttacks[sq] & pieces(by_color, KNIGHT)) return true;
    if (KingAttacks[sq] & pieces(by_color, KING)) return true;
    if (get_bishop_attacks(sq, occ) & (pieces(by_color, BISHOP) | pieces(by_color, QUEEN))) return true;
    if (get_rook_attacks(sq, occ) & (pieces(by_color, ROOK) | pieces(by_color, QUEEN))) return true;
    return false;
}

int Board::see(Move m) const {
    Square from = from_sq(m);
    Square to = to_sq(m);

    Piece victim = m_board[to];
    if (is_en_passant(m)) {
        victim = make_piece(~m_side, PAWN);
    }

    int val[32];
    int d = 0;

    val[0] = (victim != NO_PIECE) ? SeePieceValues[type_of_piece(victim)] : 0;
    if (is_promotion(m)) {
        val[0] += SeePieceValues[promotion_piece_type(m)] - SeePieceValues[PAWN];
    }

    Piece attacker = m_board[from];
    PieceType attacker_pt = (attacker != NO_PIECE) ? type_of_piece(attacker) : PAWN;
    if (is_promotion(m)) {
        attacker_pt = promotion_piece_type(m);
    }

    Bitboard occ = occupied();
    occ ^= square_bb(from);

    Color side = ~m_side;
    Bitboard attackers = attackers_to(to, occ);

    Bitboard diag_pieces = pieces(BISHOP) | pieces(QUEEN);
    Bitboard orth_pieces = pieces(ROOK) | pieces(QUEEN);

    while (true) {
        Bitboard side_attackers = attackers & pieces(side);
        if (!side_attackers) break;

        Square next_from = SQ_NONE;
        PieceType next_pt = NO_PIECE_TYPE;

        for (int pt = PAWN; pt <= KING; ++pt) {
            Bitboard bb = side_attackers & pieces(side, static_cast<PieceType>(pt));
            if (bb) {
                next_from = lsb(bb);
                next_pt = static_cast<PieceType>(pt);
                break;
            }
        }

        if (next_pt == KING) {
            if (attackers & pieces(~side)) break;
        }

        d++;
        val[d] = SeePieceValues[attacker_pt];
        attacker_pt = next_pt;

        occ ^= square_bb(next_from);

        if (next_pt == PAWN || next_pt == BISHOP || next_pt == QUEEN) {
            attackers |= get_bishop_attacks(to, occ) & diag_pieces;
        }
        if (next_pt == ROOK || next_pt == QUEEN) {
            attackers |= get_rook_attacks(to, occ) & orth_pieces;
        }
        attackers &= occ;

        side = ~side;
    }

    // Minimax back-propagation
    int score = 0;
    while (d > 0) {
        score = std::max(0, val[d] - score);
        d--;
    }
    return val[0] - score;
}

bool Board::see_ge(Move m, int threshold) const {
    return see(m) >= threshold;
}

bool Board::make_move(Move m, StateInfo& st) {
    Square from = from_sq(m);
    Square to = to_sq(m);
    int flag = move_flag(m);
    Piece moving_piece = m_board[from];
    Color us = m_side;
    Color them = ~us;

    // Save state
    st.castling_rights = m_castling_rights;
    st.ep_square = m_ep_square;
    st.halfmove_clock = m_halfmove_clock;
    st.captured_piece = m_board[to];
    st.zobrist_key = m_zobrist_key;

    // Reset EP square in zobrist if previously active
    if (m_ep_square != SQ_NONE) {
        m_zobrist_key ^= ZobristEp[file_of(m_ep_square)];
        m_ep_square = SQ_NONE;
    }

    // Reset halfmove clock on pawn move or capture
    if (type_of_piece(moving_piece) == PAWN || is_capture(m)) {
        m_halfmove_clock = 0;
    } else {
        m_halfmove_clock++;
    }

    if (us == BLACK) {
        m_fullmove_number++;
    }

    // Handle captures
    if (is_capture(m)) {
        if (flag == FLAG_EP_CAPTURE) {
            Square cap_sq = make_square(file_of(to), rank_of(from));
            st.captured_piece = m_board[cap_sq];
            remove_piece(cap_sq);
        } else {
            remove_piece(to);
        }
    }

    // Move the piece
    if (is_promotion(m)) {
        remove_piece(from);
        PieceType promo_pt = promotion_piece_type(m);
        put_piece(make_piece(us, promo_pt), to);
    } else {
        move_piece(from, to);
    }

    // Castling rook movement
    if (flag == FLAG_KING_CASTLE) {
        if (us == WHITE) move_piece(SQ_H1, SQ_F1);
        else             move_piece(SQ_H8, SQ_F8);
    } else if (flag == FLAG_QUEEN_CASTLE) {
        if (us == WHITE) move_piece(SQ_A1, SQ_D1);
        else             move_piece(SQ_A8, SQ_D8);
    }

    // Double pawn push sets new EP square
    if (flag == FLAG_DOUBLE_PUSH) {
        Square ep = make_square(file_of(from), static_cast<Rank>((rank_of(from) + rank_of(to)) / 2));
        m_ep_square = ep;
        m_zobrist_key ^= ZobristEp[file_of(ep)];
    }

    // Update castling rights
    m_zobrist_key ^= ZobristCastle[m_castling_rights];
    m_castling_rights &= CastlingRightsMask[from] & CastlingRightsMask[to];
    m_zobrist_key ^= ZobristCastle[m_castling_rights];

    // Switch side
    m_side = them;
    m_zobrist_key ^= ZobristSide;

    m_history_keys.push_back(m_zobrist_key);

    // Check legality: King cannot be left in check!
    if (in_check(us)) {
        unmake_move(m, st);
        return false;
    }

    return true;
}

void Board::unmake_move(Move m, const StateInfo& st) {
    if (!m_history_keys.empty()) {
        m_history_keys.pop_back();
    }

    Square from = from_sq(m);
    Square to = to_sq(m);
    int flag = move_flag(m);

    Color them = m_side;
    Color us = ~them;

    // Restore side and counters
    m_side = us;
    m_castling_rights = st.castling_rights;
    m_ep_square = st.ep_square;
    m_halfmove_clock = st.halfmove_clock;
    m_zobrist_key = st.zobrist_key;

    if (us == BLACK) {
        m_fullmove_number--;
    }

    // Move pieces back
    if (is_promotion(m)) {
        remove_piece(to);
        put_piece(make_piece(us, PAWN), from);
    } else {
        move_piece(to, from);
    }

    // Restore captured pieces
    if (is_capture(m)) {
        if (flag == FLAG_EP_CAPTURE) {
            Square cap_sq = make_square(file_of(to), rank_of(from));
            put_piece(st.captured_piece, cap_sq);
        } else {
            put_piece(st.captured_piece, to);
        }
    }

    // Restore castling rook
    if (flag == FLAG_KING_CASTLE) {
        if (us == WHITE) move_piece(SQ_F1, SQ_H1);
        else             move_piece(SQ_F8, SQ_H8);
    } else if (flag == FLAG_QUEEN_CASTLE) {
        if (us == WHITE) move_piece(SQ_D1, SQ_A1);
        else             move_piece(SQ_D8, SQ_A8);
    }
}

void Board::make_null_move(StateInfo& st) {
    st.castling_rights = m_castling_rights;
    st.ep_square = m_ep_square;
    st.halfmove_clock = m_halfmove_clock;
    st.captured_piece = NO_PIECE;
    st.zobrist_key = m_zobrist_key;

    if (m_ep_square != SQ_NONE) {
        m_zobrist_key ^= ZobristEp[file_of(m_ep_square)];
        m_ep_square = SQ_NONE;
    }

    m_side = ~m_side;
    m_zobrist_key ^= ZobristSide;
    m_halfmove_clock++;
    m_history_keys.push_back(m_zobrist_key);
}

void Board::unmake_null_move(const StateInfo& st) {
    if (!m_history_keys.empty()) {
        m_history_keys.pop_back();
    }
    m_side = ~m_side;
    m_castling_rights = st.castling_rights;
    m_ep_square = st.ep_square;
    m_halfmove_clock = st.halfmove_clock;
    m_zobrist_key = st.zobrist_key;
}

bool Board::is_repetition(int count) const {
    int reps = 0;
    int size = static_cast<int>(m_history_keys.size());
    // Only search back up to the halfmove clock
    int limit = std::max(0, size - 1 - m_halfmove_clock);
    for (int i = size - 3; i >= limit; i -= 2) {
        if (m_history_keys[i] == m_zobrist_key) {
            reps++;
            if (reps >= count - 1) return true;
        }
    }
    return false;
}
