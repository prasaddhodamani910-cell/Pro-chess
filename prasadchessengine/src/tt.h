#pragma once

#include "types.h"
#include <vector>

enum TTFlag : uint8_t {
    TT_NONE = 0,
    TT_EXACT = 1,
    TT_LOWER_BOUND = 2, // Beta cutoff / Fail high
    TT_UPPER_BOUND = 3  // Alpha cutoff / Fail low
};

struct TTEntry {
    uint64_t key = 0;
    Move move = MOVE_NONE;
    int16_t score = 0;
    int8_t depth = 0;
    uint8_t flag = TT_NONE;
    uint8_t age = 0;
};

class TranspositionTable {
public:
    TranspositionTable() = default;

    void resize(size_t mb);
    void clear();
    void increment_age() { m_age++; }

    bool probe(uint64_t key, int ply, int depth, int alpha, int beta, int& out_score, Move& out_move);
    bool probe_entry(uint64_t key, TTEntry& entry) const;
    void store(uint64_t key, Move move, int score, int depth, uint8_t flag, int ply);

    Move get_best_move(uint64_t key);

private:
    std::vector<TTEntry> m_entries;
    size_t m_num_entries = 0;
    uint8_t m_age = 0;
};

extern TranspositionTable TT;
