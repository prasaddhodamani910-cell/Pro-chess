#include "zobrist.h"

uint64_t ZobristPiece[PIECE_NB][64];
uint64_t ZobristCastle[16];
uint64_t ZobristEp[8];
uint64_t ZobristSide;

static uint64_t prng_state = 1070372ULL;

static uint64_t prng_next() {
    uint64_t z = (prng_state += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

void init_zobrist() {
    for (int p = 0; p < PIECE_NB; ++p) {
        for (int sq = 0; sq < 64; ++sq) {
            ZobristPiece[p][sq] = prng_next();
        }
    }

    for (int c = 0; c < 16; ++c) {
        ZobristCastle[c] = prng_next();
    }

    for (int f = 0; f < 8; ++f) {
        ZobristEp[f] = prng_next();
    }

    ZobristSide = prng_next();
}
