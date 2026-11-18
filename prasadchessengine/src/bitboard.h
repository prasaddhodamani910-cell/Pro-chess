#pragma once

#include "types.h"

#if defined(_MSC_VER)
#include <intrin.h>
#endif

// Fast bit manipulation
inline int pop_count(Bitboard b) {
#if defined(_MSC_VER)
    return static_cast<int>(__popcnt64(b));
#else
    return __builtin_popcountll(b);
#endif
}

inline Square lsb(Bitboard b) {
#if defined(_MSC_VER)
    unsigned long index;
    _BitScanForward64(&index, b);
    return static_cast<Square>(index);
#else
    return static_cast<Square>(__builtin_ctzll(b));
#endif
}

inline Square msb(Bitboard b) {
#if defined(_MSC_VER)
    unsigned long index;
    _BitScanReverse64(&index, b);
    return static_cast<Square>(index);
#else
    return static_cast<Square>(63 - __builtin_clzll(b));
#endif
}

inline Square pop_lsb(Bitboard& b) {
    Square s = lsb(b);
    b &= b - 1;
    return s;
}

inline Bitboard square_bb(Square s) {
    return 1ULL << s;
}

inline void set_bit(Bitboard& b, Square s) {
    b |= (1ULL << s);
}

inline void clear_bit(Bitboard& b, Square s) {
    b &= ~(1ULL << s);
}

inline bool test_bit(Bitboard b, Square s) {
    return (b & (1ULL << s)) != 0;
}

// Global bitboard lookup tables
extern Bitboard SquareBB[64];
extern Bitboard FileBB[8];
extern Bitboard RankBB[8];

extern Bitboard PawnAttacks[COLOR_NB][64];
extern Bitboard KnightAttacks[64];
extern Bitboard KingAttacks[64];

extern Bitboard BetweenBB[64][64];
extern Bitboard LineBB[64][64];

// Ray shifts
inline Bitboard shift_north(Bitboard b) { return b << 8; }
inline Bitboard shift_south(Bitboard b) { return b >> 8; }
inline Bitboard shift_east(Bitboard b)  { return (b & ~FileBB[FILE_H]) << 1; }
inline Bitboard shift_west(Bitboard b)  { return (b & ~FileBB[FILE_A]) >> 1; }
inline Bitboard shift_north_east(Bitboard b) { return (b & ~FileBB[FILE_H]) << 9; }
inline Bitboard shift_north_west(Bitboard b) { return (b & ~FileBB[FILE_A]) << 7; }
inline Bitboard shift_south_east(Bitboard b) { return (b & ~FileBB[FILE_H]) >> 7; }
inline Bitboard shift_south_west(Bitboard b) { return (b & ~FileBB[FILE_A]) >> 9; }

void init_bitboards();
void print_bitboard(Bitboard b);
