#pragma once

#include "types.h"
#include "board.h"

uint64_t perft(Board& board, int depth);
void perft_divide(Board& board, int depth);
bool run_perft_suite(Board& board);
