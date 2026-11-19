#pragma once

#include "types.h"
#include "board.h"

struct ScoredMove {
    Move move = MOVE_NONE;
    int score = 0;
};

struct MoveList {
    ScoredMove moves[256];
    int count = 0;

    void add(Move m, int score = 0) {
        moves[count++] = {m, score};
    }
    int size() const { return count; }
    void clear() { count = 0; }
    Move move(int idx) const { return moves[idx].move; }
    int score(int idx) const { return moves[idx].score; }
};

enum GenType {
    GEN_ALL,
    GEN_CAPTURES
};

void generate_pseudo_moves(const Board& board, MoveList& list, GenType type = GEN_ALL);
void generate_legal_moves(Board& board, MoveList& list, GenType type = GEN_ALL);
