#pragma once

#include "bitboard.h"

// Magic Bitboards for ultra-fast sliding piece move generation
void init_magics();

Bitboard get_bishop_attacks(Square sq, Bitboard occ);
Bitboard get_rook_attacks(Square sq, Bitboard occ);

inline Bitboard get_queen_attacks(Square sq, Bitboard occ) {
    return get_bishop_attacks(sq, occ) | get_rook_attacks(sq, occ);
}
