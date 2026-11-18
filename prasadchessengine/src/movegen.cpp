#include "movegen.h"

void generate_pseudo_moves(const Board& board, MoveList& list, GenType type) {
    Color us = board.side_to_move();
    Color them = ~us;
    Bitboard us_bb = board.pieces(us);
    Bitboard them_bb = board.pieces(them);
    Bitboard occ = board.occupied();
    Bitboard empty = ~occ;

    // 1. Pawns
    Bitboard pawns = board.pieces(us, PAWN);
    while (pawns) {
        Square from = pop_lsb(pawns);
        int r = rank_of(from);

        if (us == WHITE) {
            // Single push
            Square to = static_cast<Square>(from + 8);
            if (!test_bit(occ, to)) {
                if (r == RANK_7) {
                    list.add(make_move(from, to, FLAG_PROMO_Q));
                    list.add(make_move(from, to, FLAG_PROMO_R));
                    list.add(make_move(from, to, FLAG_PROMO_B));
                    list.add(make_move(from, to, FLAG_PROMO_N));
                } else if (type == GEN_ALL) {
                    list.add(make_move(from, to, FLAG_QUIET));
                    // Double push
                    Square d_to = static_cast<Square>(from + 16);
                    if (r == RANK_2 && !test_bit(occ, d_to)) {
                        list.add(make_move(from, d_to, FLAG_DOUBLE_PUSH));
                    }
                }
            }

            // Captures
            Bitboard attacks = PawnAttacks[WHITE][from] & them_bb;
            while (attacks) {
                Square cap_to = pop_lsb(attacks);
                if (r == RANK_7) {
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_Q));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_R));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_B));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_N));
                } else {
                    list.add(make_move(from, cap_to, FLAG_CAPTURE));
                }
            }

            // En passant
            if (board.ep_square() != SQ_NONE) {
                if (test_bit(PawnAttacks[WHITE][from], board.ep_square())) {
                    list.add(make_move(from, board.ep_square(), FLAG_EP_CAPTURE));
                }
            }
        } else { // BLACK pawns
            Square to = static_cast<Square>(from - 8);
            if (!test_bit(occ, to)) {
                if (r == RANK_2) {
                    list.add(make_move(from, to, FLAG_PROMO_Q));
                    list.add(make_move(from, to, FLAG_PROMO_R));
                    list.add(make_move(from, to, FLAG_PROMO_B));
                    list.add(make_move(from, to, FLAG_PROMO_N));
                } else if (type == GEN_ALL) {
                    list.add(make_move(from, to, FLAG_QUIET));
                    // Double push
                    Square d_to = static_cast<Square>(from - 16);
                    if (r == RANK_7 && !test_bit(occ, d_to)) {
                        list.add(make_move(from, d_to, FLAG_DOUBLE_PUSH));
                    }
                }
            }

            // Captures
            Bitboard attacks = PawnAttacks[BLACK][from] & them_bb;
            while (attacks) {
                Square cap_to = pop_lsb(attacks);
                if (r == RANK_2) {
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_Q));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_R));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_B));
                    list.add(make_move(from, cap_to, FLAG_PROMO_CAP_N));
                } else {
                    list.add(make_move(from, cap_to, FLAG_CAPTURE));
                }
            }

            // En passant
            if (board.ep_square() != SQ_NONE) {
                if (test_bit(PawnAttacks[BLACK][from], board.ep_square())) {
                    list.add(make_move(from, board.ep_square(), FLAG_EP_CAPTURE));
                }
            }
        }
    }

    // 2. Knights
    Bitboard knights = board.pieces(us, KNIGHT);
    while (knights) {
        Square from = pop_lsb(knights);
        Bitboard attacks = KnightAttacks[from] & ~us_bb;
        while (attacks) {
            Square to = pop_lsb(attacks);
            if (test_bit(them_bb, to)) {
                list.add(make_move(from, to, FLAG_CAPTURE));
            } else if (type == GEN_ALL) {
                list.add(make_move(from, to, FLAG_QUIET));
            }
        }
    }

    // 3. Bishops
    Bitboard bishops = board.pieces(us, BISHOP);
    while (bishops) {
        Square from = pop_lsb(bishops);
        Bitboard attacks = get_bishop_attacks(from, occ) & ~us_bb;
        while (attacks) {
            Square to = pop_lsb(attacks);
            if (test_bit(them_bb, to)) {
                list.add(make_move(from, to, FLAG_CAPTURE));
            } else if (type == GEN_ALL) {
                list.add(make_move(from, to, FLAG_QUIET));
            }
        }
    }

    // 4. Rooks
    Bitboard rooks = board.pieces(us, ROOK);
    while (rooks) {
        Square from = pop_lsb(rooks);
        Bitboard attacks = get_rook_attacks(from, occ) & ~us_bb;
        while (attacks) {
            Square to = pop_lsb(attacks);
            if (test_bit(them_bb, to)) {
                list.add(make_move(from, to, FLAG_CAPTURE));
            } else if (type == GEN_ALL) {
                list.add(make_move(from, to, FLAG_QUIET));
            }
        }
    }

    // 5. Queens
    Bitboard queens = board.pieces(us, QUEEN);
    while (queens) {
        Square from = pop_lsb(queens);
        Bitboard attacks = get_queen_attacks(from, occ) & ~us_bb;
        while (attacks) {
            Square to = pop_lsb(attacks);
            if (test_bit(them_bb, to)) {
                list.add(make_move(from, to, FLAG_CAPTURE));
            } else if (type == GEN_ALL) {
                list.add(make_move(from, to, FLAG_QUIET));
            }
        }
    }

    // 6. King
    Square k_from = board.king_square(us);
    Bitboard k_attacks = KingAttacks[k_from] & ~us_bb;
    while (k_attacks) {
        Square to = pop_lsb(k_attacks);
        if (test_bit(them_bb, to)) {
            list.add(make_move(k_from, to, FLAG_CAPTURE));
        } else if (type == GEN_ALL) {
            list.add(make_move(k_from, to, FLAG_QUIET));
        }
    }

    // Castling (only when not in check and generating all moves)
    if (type == GEN_ALL && !board.in_check()) {
        uint8_t cr = board.castling_rights();
        if (us == WHITE) {
            // Kingside: E1 -> G1
            if ((cr & WHITE_OO) &&
                !test_bit(occ, SQ_F1) && !test_bit(occ, SQ_G1) &&
                !board.is_square_attacked(SQ_F1, BLACK) &&
                !board.is_square_attacked(SQ_G1, BLACK)) {
                list.add(make_move(SQ_E1, SQ_G1, FLAG_KING_CASTLE));
            }
            // Queenside: E1 -> C1
            if ((cr & WHITE_OOO) &&
                !test_bit(occ, SQ_D1) && !test_bit(occ, SQ_C1) && !test_bit(occ, SQ_B1) &&
                !board.is_square_attacked(SQ_D1, BLACK) &&
                !board.is_square_attacked(SQ_C1, BLACK)) {
                list.add(make_move(SQ_E1, SQ_C1, FLAG_QUEEN_CASTLE));
            }
        } else {
            // Kingside: E8 -> G8
            if ((cr & BLACK_OO) &&
                !test_bit(occ, SQ_F8) && !test_bit(occ, SQ_G8) &&
                !board.is_square_attacked(SQ_F8, WHITE) &&
                !board.is_square_attacked(SQ_G8, WHITE)) {
                list.add(make_move(SQ_E8, SQ_G8, FLAG_KING_CASTLE));
            }
            // Queenside: E8 -> C8
            if ((cr & BLACK_OOO) &&
                !test_bit(occ, SQ_D8) && !test_bit(occ, SQ_C8) && !test_bit(occ, SQ_B8) &&
                !board.is_square_attacked(SQ_D8, WHITE) &&
                !board.is_square_attacked(SQ_C8, WHITE)) {
                list.add(make_move(SQ_E8, SQ_C8, FLAG_QUEEN_CASTLE));
            }
        }
    }
}

void generate_legal_moves(Board& board, MoveList& list, GenType type) {
    list.clear();
    MoveList pseudo;
    generate_pseudo_moves(board, pseudo, type);

    StateInfo st;
    for (int i = 0; i < pseudo.size(); ++i) {
        Move m = pseudo.move(i);
        if (board.make_move(m, st)) {
            board.unmake_move(m, st);
            list.add(m);
        }
    }
}
