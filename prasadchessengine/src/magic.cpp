#include "magic.h"
#include "magic_numbers.inc"
#include <iostream>

static Bitboard AttackTable[TOTAL_ATTACK_TABLE_SIZE];

static Bitboard compute_bishop_attacks(Square sq, Bitboard block) {
    Bitboard attacks = 0;
    int r = rank_of(sq), f = file_of(sq);
    for (int dr : {-1, 1}) {
        for (int df : {-1, 1}) {
            int nr = r + dr, nf = f + df;
            while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
                attacks |= square_bb(make_square(static_cast<File>(nf), static_cast<Rank>(nr)));
                if (block & square_bb(make_square(static_cast<File>(nf), static_cast<Rank>(nr)))) break;
                nr += dr;
                nf += df;
            }
        }
    }
    return attacks;
}

static Bitboard compute_rook_attacks(Square sq, Bitboard block) {
    Bitboard attacks = 0;
    int r = rank_of(sq), f = file_of(sq);
    const int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
    for (auto& d : dirs) {
        int nr = r + d[0], nf = f + d[1];
        while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
            attacks |= square_bb(make_square(static_cast<File>(nf), static_cast<Rank>(nr)));
            if (block & square_bb(make_square(static_cast<File>(nf), static_cast<Rank>(nr)))) break;
            nr += d[0];
            nf += d[1];
        }
    }
    return attacks;
}

void init_magics() {
    // Populate Bishop attacks
    for (int sq = 0; sq < 64; ++sq) {
        Bitboard mask = BISHOP_MASKS[sq];
        Bitboard magic = BISHOP_MAGICS[sq];
        int shift = BISHOP_SHIFTS[sq];
        int offset = BISHOP_OFFSETS[sq];

        Bitboard b = 0;
        do {
            Bitboard att = compute_bishop_attacks(static_cast<Square>(sq), b);
            unsigned int idx = static_cast<unsigned int>((b * magic) >> shift);
            AttackTable[offset + idx] = att;
            b = (b - mask) & mask;
        } while (b);
    }

    // Populate Rook attacks
    for (int sq = 0; sq < 64; ++sq) {
        Bitboard mask = ROOK_MASKS[sq];
        Bitboard magic = ROOK_MAGICS[sq];
        int shift = ROOK_SHIFTS[sq];
        int offset = ROOK_OFFSETS[sq];

        Bitboard b = 0;
        do {
            Bitboard att = compute_rook_attacks(static_cast<Square>(sq), b);
            unsigned int idx = static_cast<unsigned int>((b * magic) >> shift);
            AttackTable[offset + idx] = att;
            b = (b - mask) & mask;
        } while (b);
    }
}

Bitboard get_bishop_attacks(Square sq, Bitboard occ) {
    Bitboard b = occ & BISHOP_MASKS[sq];
    unsigned int idx = static_cast<unsigned int>((b * BISHOP_MAGICS[sq]) >> BISHOP_SHIFTS[sq]);
    return AttackTable[BISHOP_OFFSETS[sq] + idx];
}

Bitboard get_rook_attacks(Square sq, Bitboard occ) {
    Bitboard b = occ & ROOK_MASKS[sq];
    unsigned int idx = static_cast<unsigned int>((b * ROOK_MAGICS[sq]) >> ROOK_SHIFTS[sq]);
    return AttackTable[ROOK_OFFSETS[sq] + idx];
}
