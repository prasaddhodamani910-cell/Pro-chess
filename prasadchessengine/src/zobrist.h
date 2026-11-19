#pragma once

#include "types.h"

extern uint64_t ZobristPiece[PIECE_NB][64];
extern uint64_t ZobristCastle[16];
extern uint64_t ZobristEp[8]; // Hashed by en-passant file (0 to 7)
extern uint64_t ZobristSide;

void init_zobrist();
