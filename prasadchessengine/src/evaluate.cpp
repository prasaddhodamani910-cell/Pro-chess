#include "evaluate.h"
#include <algorithm>

// Material values (MG / EG)
constexpr int MaterialMG[6] = { 82, 337, 365, 477, 1025, 0 };
constexpr int MaterialEG[6] = { 94, 281, 297, 512,  936, 0 };

// PeSTO's Piece-Square Tables (from White's perspective)
// Square indexing: A1 = 0 ... H8 = 63
static const int mg_pawn_table[64] = {
      0,   0,   0,   0,   0,   0,   0,   0,
     98, 134,  61,  95,  68, 126,  34, -11,
     -6,   7,  26,  31,  65,  56,  25, -20,
    -14,  13,   6,  21,  23,  12,  17, -23,
    -27,  -2,  -5,  12,  17,   6,  10, -25,
    -26,  -4,  -4, -10,   3,   3,  33, -12,
    -35,  -1, -20, -23, -15,  24,  38, -22,
      0,   0,   0,   0,   0,   0,   0,   0,
};

static const int eg_pawn_table[64] = {
      0,   0,   0,   0,   0,   0,   0,   0,
    178, 173, 158, 134, 147, 132, 165, 187,
     94, 100,  85,  67,  56,  53,  82,  84,
     32,  24,  13,   5,  -2,   4,  17,  17,
     13,   9,  -3,  -7,  -7,  -8,   3,  -1,
      4,   7,  -6,   1,   0,  -5,  -1,  -8,
     13,   8,   8, -10,   7,   0,  12,  -7,
      0,   0,   0,   0,   0,   0,   0,   0,
};

static const int mg_knight_table[64] = {
   -167, -89, -34, -49,  61, -97,  -15, -107,
    -73, -41,  72,  36,  23,  62,    7,  -17,
    -47,  60,  37,  65,  84, 129,   73,   44,
     -9,  17,  19,  53,  37,  69,   18,   22,
    -13,   4,  16,  13,  28,  19,   21,   -8,
    -23,  -9,  12,  10,  19,  17,   25,  -16,
    -29, -53, -12,  -3,  -1,  18,  -14,  -19,
   -105, -21, -58, -33, -17, -28,  -19,  -23,
};

static const int eg_knight_table[64] = {
    -58, -38, -13, -28, -31, -27, -63, -99,
    -25,  -8, -25,  -2,  -9, -25, -24, -52,
    -24, -20,  10,   9,  -1,  -9, -19, -41,
    -17,   3,  22,  22,  22,  11,   8, -18,
    -18,  -6,  16,  25,  16,  17,   4, -18,
    -23,  -3,  -1,  15,  10,  -3, -20, -22,
    -42, -20, -10,  -5,  -2, -20, -23, -44,
    -29, -51, -23, -15, -22, -18, -50, -64,
};

static const int mg_bishop_table[64] = {
    -29,   4, -82, -37, -25, -42,   7,  -8,
    -26,  16, -18, -13,  30,  59,  18, -47,
    -16,  37,  43,  40,  35,  50,  37,  -2,
     -4,   5,  19,  50,  37,  37,   7,  -2,
     -6,  13,  13,  26,  34,  12,  10,   4,
      0,  15,  15,  15,  14,  27,  18,  10,
      4,  15,  16,   0,   7,  21,  33,   1,
    -33,  -3, -14, -21, -13, -12, -39, -21,
};

static const int eg_bishop_table[64] = {
    -14, -21, -11,  -8,  -7,  -9, -17, -24,
     -8,  -4,   7, -12,  -3, -13,  -4, -14,
      2,  -8,   0,  -1,  -2,   6,   0,   4,
     -3,   9,  12,   9,  14,  10,   3,   2,
     -6,   3,  13,  19,   7,  10,  -3,  -9,
    -12,  -3,   8,  10,  13,   3,  -7, -15,
    -14, -18,  -7,  -1,   4,  -9, -15, -27,
    -23,  -9, -23,  -5,  -9, -16,  -5, -17,
};

static const int mg_rook_table[64] = {
     32,  42,  32,  51,  63,   9,  31,  43,
     27,  32,  58,  62,  80,  67,  26,  44,
     -5,  19,  26,  36,  17,  45,  61,  16,
    -24, -11,   7,  26,  24,  35,  -8, -20,
    -36, -26, -12,  -1,   9,  -7,   6, -23,
    -45, -25, -16, -17,   3,   0,  -5, -33,
    -44, -16, -20,  -9,  -1,  11,  -6, -71,
    -19, -13,   1,  17,  16,   7, -37, -26,
};

static const int eg_rook_table[64] = {
     13,  10,  18,  15,  12,  12,   8,   5,
     11,  13,  13,  11,  -3,   3,   8,   3,
      7,   7,   7,   5,   4,  -3,  -5,  -3,
      4,   3,  13,   1,   2,   1,  -1,   2,
      3,   5,   8,   4,  -5,  -6,  -8, -11,
     -4,   0,  -5,  -1,  -7, -12,  -8, -16,
     -6,  -6,   0,   2,  -9,  -9, -11,  -3,
     -9,   2,   3,  -1,  -5, -13,   4, -20,
};

static const int mg_queen_table[64] = {
    -28,   0,  29,  12,  59,  44,  43,  45,
    -24, -39,  -5,   1, -16,  57,  28,  54,
    -13, -17,   7,   8,  29,  56,  47,  57,
    -27, -27, -16, -16,  -1,  17,  -2,   1,
     -9, -26,  -9, -10,  -2,  -4,   3,  -3,
    -14,   2, -11,  -2,  -5,   2,  14,   5,
    -35,  -8,  11,   2,   8,  15,  -3,   1,
     -1, -18,  -9,  10, -15, -25, -48, -18,
};

static const int eg_queen_table[64] = {
     -9,  22,  22,  27,  27,  19,  10,  20,
    -17,  20,  32,  41,  58,  25,  30,   0,
    -20,   6,   9,  49,  47,  35,  19,   9,
      3,  22,  24,  45,  57,  40,  57,  36,
    -18,  28,  19,  47,  31,  34,  39,  18,
    -16, -27,  15,   6,   9,  17,  10,   5,
    -22, -23, -30, -16, -16, -23, -36, -32,
    -33, -28, -22, -43,  -5, -32, -20, -41,
};

static const int mg_king_table[64] = {
    -65,  23,  16, -15, -56, -34,   2,  13,
     29,  -1, -20,  -7,  -8,  -4, -38, -29,
     -9,  24,   2, -16, -20,   6,  22, -22,
    -17, -20, -12, -27, -30, -25, -14, -36,
    -49,  -1, -27, -39, -46, -44, -33, -51,
    -14, -14, -22, -46, -44, -30, -15, -27,
      1,   7,  -8, -64, -43, -16,   9,   8,
    -15,  36,  12, -54,   8, -28,  24,  14,
};

static const int eg_king_table[64] = {
    -74, -35, -18, -18, -11,  15,   4, -17,
    -12,  17,  14,  17,  17,  38,  23,  11,
     10,  17,  23,  15,  20,  45,  44,  13,
     -8,  22,  24,  27,  26,  33,  26,   3,
    -18,  -4,  21,  24,  27,  23,   9, -11,
    -19,  -3,  11,  21,  23,  16,   7,  -9,
    -27, -11,   4,  13,  14,   4,  -5, -17,
    -53, -34, -21, -11, -28, -14, -24, -43,
};

static const int* mg_tables[6] = {
    mg_pawn_table, mg_knight_table, mg_bishop_table, mg_rook_table, mg_queen_table, mg_king_table
};

static const int* eg_tables[6] = {
    eg_pawn_table, eg_knight_table, eg_bishop_table, eg_rook_table, eg_queen_table, eg_king_table
};

static Bitboard PassedPawnMask[COLOR_NB][64];

void init_evaluation() {
    for (int sq = 0; sq < 64; ++sq) {
        int r = rank_of(static_cast<Square>(sq));
        int f = file_of(static_cast<Square>(sq));

        // White passed pawn mask: ranks above sq on files f-1, f, f+1
        PassedPawnMask[WHITE][sq] = 0;
        for (int nr = r + 1; nr < 8; ++nr) {
            PassedPawnMask[WHITE][sq] |= square_bb(make_square(static_cast<File>(f), static_cast<Rank>(nr)));
            if (f > 0) PassedPawnMask[WHITE][sq] |= square_bb(make_square(static_cast<File>(f - 1), static_cast<Rank>(nr)));
            if (f < 7) PassedPawnMask[WHITE][sq] |= square_bb(make_square(static_cast<File>(f + 1), static_cast<Rank>(nr)));
        }

        // Black passed pawn mask: ranks below sq on files f-1, f, f+1
        PassedPawnMask[BLACK][sq] = 0;
        for (int nr = r - 1; nr >= 0; --nr) {
            PassedPawnMask[BLACK][sq] |= square_bb(make_square(static_cast<File>(f), static_cast<Rank>(nr)));
            if (f > 0) PassedPawnMask[BLACK][sq] |= square_bb(make_square(static_cast<File>(f - 1), static_cast<Rank>(nr)));
            if (f < 7) PassedPawnMask[BLACK][sq] |= square_bb(make_square(static_cast<File>(f + 1), static_cast<Rank>(nr)));
        }
    }
}

Value evaluate(const Board& board) {
    int mg_score[2] = {0, 0};
    int eg_score[2] = {0, 0};
    int game_phase = 0;

    Bitboard w_pawns = board.pieces(WHITE, PAWN);
    Bitboard b_pawns = board.pieces(BLACK, PAWN);

    for (int c = 0; c < 2; ++c) {
        Color us = static_cast<Color>(c);
        Color them = ~us;
        Bitboard our_pawns = (us == WHITE) ? w_pawns : b_pawns;
        Bitboard their_pawns = (us == WHITE) ? b_pawns : w_pawns;

        // Loop over piece types
        for (int pt = 0; pt < 6; ++pt) {
            PieceType ptype = static_cast<PieceType>(pt);
            Bitboard bb = board.pieces(us, ptype);

            while (bb) {
                Square sq = pop_lsb(bb);
                int table_sq = (us == WHITE) ? sq : (sq ^ 56);

                mg_score[us] += MaterialMG[pt] + mg_tables[pt][table_sq];
                eg_score[us] += MaterialEG[pt] + eg_tables[pt][table_sq];

                // Accumulate game phase
                if (ptype == KNIGHT || ptype == BISHOP) game_phase += 1;
                else if (ptype == ROOK)                game_phase += 2;
                else if (ptype == QUEEN)               game_phase += 4;

                // Passed pawn bonus
                if (ptype == PAWN) {
                    if (!(PassedPawnMask[us][sq] & their_pawns)) {
                        int r = (us == WHITE) ? rank_of(sq) : (7 - rank_of(sq));
                        const int passed_bonus[8] = { 0, 5, 10, 20, 35, 60, 100, 0 };
                        mg_score[us] += passed_bonus[r] / 2;
                        eg_score[us] += passed_bonus[r];
                    }
                }

                // Rook on open / semi-open files
                if (ptype == ROOK) {
                    File f = file_of(sq);
                    bool no_our_pawns = !(our_pawns & FileBB[f]);
                    bool no_their_pawns = !(their_pawns & FileBB[f]);
                    if (no_our_pawns && no_their_pawns) {
                        mg_score[us] += 25; // Open file
                        eg_score[us] += 25;
                    } else if (no_our_pawns) {
                        mg_score[us] += 12; // Semi-open file
                        eg_score[us] += 12;
                    }
                }
            }
        }

        // Bishop pair bonus
        if (pop_count(board.pieces(us, BISHOP)) >= 2) {
            mg_score[us] += 30;
            eg_score[us] += 30;
        }

        // Minor piece development bonus
        Bitboard minors = board.pieces(us, KNIGHT) | board.pieces(us, BISHOP);
        if (us == WHITE) {
            int developed = pop_count(minors & ~RankBB[RANK_1]);
            mg_score[us] += 12 * developed;
        } else {
            int developed = pop_count(minors & ~RankBB[RANK_8]);
            mg_score[us] += 12 * developed;
        }

        // Doubled and isolated pawns
        for (int f = 0; f < 8; ++f) {
            int pawn_count = pop_count(our_pawns & FileBB[f]);
            if (pawn_count > 1) {
                mg_score[us] -= 15 * (pawn_count - 1);
                eg_score[us] -= 15 * (pawn_count - 1);
            }
            if (pawn_count > 0) {
                bool has_left = (f > 0) && (our_pawns & FileBB[f - 1]);
                bool has_right = (f < 7) && (our_pawns & FileBB[f + 1]);
                if (!has_left && !has_right) {
                    mg_score[us] -= 12;
                    eg_score[us] -= 12;
                }
            }
        }

        // King Safety: Pawn Shelter & King Zone Attacks
        Square ksq = board.king_square(us);
        int kf = file_of(ksq);
        int kr = rank_of(ksq);

        // 1. Pawn Shelter & Center King Vulnerability (Middle Game)
        if (us == WHITE) {
            bool castled_kingside = (ksq == SQ_G1 || ksq == SQ_H1);
            bool castled_queenside = (ksq == SQ_B1 || ksq == SQ_C1);

            if (castled_kingside) {
                // Kingside pawn shield (files F, G, H)
                Bitboard g_pawns = our_pawns & FileBB[FILE_G];
                if (!g_pawns) mg_score[WHITE] -= 250; // Open G-file to King is lethal!
                else {
                    int pr = rank_of(lsb(g_pawns));
                    if (pr == RANK_3) mg_score[WHITE] -= 15;
                    else if (pr >= RANK_4) mg_score[WHITE] -= 220; // Pushing g4 when castled ruins King shield!
                }

                Bitboard f_pawns = our_pawns & FileBB[FILE_F];
                if (!f_pawns) mg_score[WHITE] -= 200;
                else {
                    int pr = rank_of(lsb(f_pawns));
                    if (pr == RANK_3) mg_score[WHITE] -= 20;
                    else if (pr >= RANK_4) mg_score[WHITE] -= 180;
                }

                Bitboard h_pawns = our_pawns & FileBB[FILE_H];
                if (!h_pawns) mg_score[WHITE] -= 150;
                else {
                    int pr = rank_of(lsb(h_pawns));
                    if (pr == RANK_3) mg_score[WHITE] -= 10;
                    else if (pr >= RANK_4) mg_score[WHITE] -= 80;
                }
            } else if (castled_queenside) {
                // Queenside pawn shield (files A, B, C)
                Bitboard b_pawns = our_pawns & FileBB[FILE_B];
                if (!b_pawns) mg_score[WHITE] -= 220;
                else {
                    int pr = rank_of(lsb(b_pawns));
                    if (pr == RANK_3) mg_score[WHITE] -= 15;
                    else if (pr >= RANK_4) mg_score[WHITE] -= 180;
                }

                Bitboard a_pawns = our_pawns & FileBB[FILE_A];
                if (!a_pawns) mg_score[WHITE] -= 120;

                Bitboard c_pawns = our_pawns & FileBB[FILE_C];
                if (!c_pawns) mg_score[WHITE] -= 150;
                else {
                    int pr = rank_of(lsb(c_pawns));
                    if (pr >= RANK_4) mg_score[WHITE] -= 100;
                }
            } else {
                // King uncastled in center (e.g. e1 or d1)
                if (!(our_pawns & FileBB[kf])) mg_score[WHITE] -= 70;
                if (!(their_pawns & FileBB[kf])) mg_score[WHITE] -= 40;

                if ((board.castling_rights() & WHITE_CASTLING) == 0) {
                    mg_score[WHITE] -= 90;
                } else {
                    if (board.castling_rights() & WHITE_OO) {
                        Bitboard g_pawns = our_pawns & FileBB[FILE_G];
                        if (!g_pawns) mg_score[WHITE] -= 120;
                        else if (rank_of(lsb(g_pawns)) >= RANK_4) mg_score[WHITE] -= 180;

                        Bitboard f_pawns = our_pawns & FileBB[FILE_F];
                        if (!f_pawns) mg_score[WHITE] -= 80;
                        else if (rank_of(lsb(f_pawns)) >= RANK_4) mg_score[WHITE] -= 120;

                        Bitboard h_pawns = our_pawns & FileBB[FILE_H];
                        if (!h_pawns) mg_score[WHITE] -= 50;
                    }
                }
            }
        } else {
            // Black King Safety
            bool castled_kingside = (ksq == SQ_G8 || ksq == SQ_H8);
            bool castled_queenside = (ksq == SQ_B8 || ksq == SQ_C8);

            if (castled_kingside) {
                Bitboard g_pawns = our_pawns & FileBB[FILE_G];
                if (!g_pawns) mg_score[BLACK] -= 250;
                else {
                    int pr = rank_of(msb(g_pawns));
                    if (pr == RANK_6) mg_score[BLACK] -= 15;
                    else if (pr <= RANK_5) mg_score[BLACK] -= 220;
                }

                Bitboard f_pawns = our_pawns & FileBB[FILE_F];
                if (!f_pawns) mg_score[BLACK] -= 200;
                else {
                    int pr = rank_of(msb(f_pawns));
                    if (pr == RANK_6) mg_score[BLACK] -= 20;
                    else if (pr <= RANK_5) mg_score[BLACK] -= 180;
                }

                Bitboard h_pawns = our_pawns & FileBB[FILE_H];
                if (!h_pawns) mg_score[BLACK] -= 150;
                else {
                    int pr = rank_of(msb(h_pawns));
                    if (pr == RANK_6) mg_score[BLACK] -= 10;
                    else if (pr <= RANK_5) mg_score[BLACK] -= 80;
                }
            } else if (castled_queenside) {
                Bitboard b_pawns = our_pawns & FileBB[FILE_B];
                if (!b_pawns) mg_score[BLACK] -= 220;
                else {
                    int pr = rank_of(msb(b_pawns));
                    if (pr == RANK_6) mg_score[BLACK] -= 15;
                    else if (pr <= RANK_5) mg_score[BLACK] -= 180;
                }

                Bitboard a_pawns = our_pawns & FileBB[FILE_A];
                if (!a_pawns) mg_score[BLACK] -= 120;

                Bitboard c_pawns = our_pawns & FileBB[FILE_C];
                if (!c_pawns) mg_score[BLACK] -= 150;
                else {
                    int pr = rank_of(msb(c_pawns));
                    if (pr <= RANK_5) mg_score[BLACK] -= 100;
                }
            } else {
                if (!(our_pawns & FileBB[kf])) mg_score[BLACK] -= 70;
                if (!(their_pawns & FileBB[kf])) mg_score[BLACK] -= 40;

                if ((board.castling_rights() & BLACK_CASTLING) == 0) {
                    mg_score[BLACK] -= 90;
                } else {
                    if (board.castling_rights() & BLACK_OO) {
                        Bitboard g_pawns = our_pawns & FileBB[FILE_G];
                        if (!g_pawns) mg_score[BLACK] -= 120;
                        else if (rank_of(msb(g_pawns)) <= RANK_5) mg_score[BLACK] -= 180;

                        Bitboard f_pawns = our_pawns & FileBB[FILE_F];
                        if (!f_pawns) mg_score[BLACK] -= 80;
                        else if (rank_of(msb(f_pawns)) <= RANK_5) mg_score[BLACK] -= 120;

                        Bitboard h_pawns = our_pawns & FileBB[FILE_H];
                        if (!h_pawns) mg_score[BLACK] -= 50;
                    }
                }
            }
        }

        // 2. King Zone Attacks (Virtual King Ring)
        Bitboard king_ring = KingAttacks[ksq];
        if (us == WHITE) king_ring |= (king_ring << 8);
        else king_ring |= (king_ring >> 8);

        int attack_units = 0;
        int attackers_count = 0;
        Bitboard occ = board.occupied();

        Bitboard e_knights = board.pieces(them, KNIGHT);
        while (e_knights) {
            Square esq = pop_lsb(e_knights);
            if (KnightAttacks[esq] & king_ring) {
                attack_units += 2;
                attackers_count++;
            }
        }

        Bitboard e_bishops = board.pieces(them, BISHOP);
        while (e_bishops) {
            Square esq = pop_lsb(e_bishops);
            if (get_bishop_attacks(esq, occ) & king_ring) {
                attack_units += 2;
                attackers_count++;
            }
        }

        Bitboard e_rooks = board.pieces(them, ROOK);
        while (e_rooks) {
            Square esq = pop_lsb(e_rooks);
            if (get_rook_attacks(esq, occ) & king_ring) {
                attack_units += 3;
                attackers_count++;
            }
        }

        Bitboard e_queens = board.pieces(them, QUEEN);
        while (e_queens) {
            Square esq = pop_lsb(e_queens);
            if ((get_bishop_attacks(esq, occ) | get_rook_attacks(esq, occ)) & king_ring) {
                attack_units += 5;
                attackers_count++;
            }
        }

        static const int KingDangerWeight[32] = {
            0, 0, 8, 18, 32, 50, 75, 105, 140, 180,
            225, 275, 330, 390, 455, 525, 600, 680, 765, 855,
            950, 1050, 1150, 1250, 1350, 1450, 1550, 1650, 1750, 1850,
            1950, 2050
        };
        if (attackers_count >= 2) {
            int idx = std::min(31, attack_units);
            mg_score[us] -= KingDangerWeight[idx];
        }
    }

    // Tapered evaluation interpolation
    int mg_eval = mg_score[WHITE] - mg_score[BLACK];
    int eg_eval = eg_score[WHITE] - eg_score[BLACK];

    int phase = std::min(24, game_phase);
    int eval = ((mg_eval * phase) + (eg_eval * (24 - phase))) / 24;

    return (board.side_to_move() == WHITE) ? eval : -eval;
}
