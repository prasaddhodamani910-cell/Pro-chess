#pragma once

#include "types.h"
#include "board.h"

void init_evaluation();
Value evaluate(const Board& board);
