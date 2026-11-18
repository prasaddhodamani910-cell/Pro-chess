#include "tt.h"
#include <cstring>

TranspositionTable TT;

inline int score_to_tt(int score, int ply) {
    if (score >= VALUE_MATE_IN_MAX_PLY) return score + ply;
    if (score <= -VALUE_MATE_IN_MAX_PLY) return score - ply;
    return score;
}

inline int score_from_tt(int score, int ply) {
    if (score >= VALUE_MATE_IN_MAX_PLY) return score - ply;
    if (score <= -VALUE_MATE_IN_MAX_PLY) return score + ply;
    return score;
}

void TranspositionTable::resize(size_t mb) {
    size_t bytes = mb * 1024 * 1024;
    m_num_entries = bytes / sizeof(TTEntry);
    m_entries.resize(m_num_entries);
    clear();
}

void TranspositionTable::clear() {
    std::fill(m_entries.begin(), m_entries.end(), TTEntry{});
    m_age = 0;
}

bool TranspositionTable::probe_entry(uint64_t key, TTEntry& entry) const {
    if (m_num_entries == 0) return false;
    size_t index = key % m_num_entries;
    if (m_entries[index].key == key) {
        entry = m_entries[index];
        return true;
    }
    return false;
}

bool TranspositionTable::probe(uint64_t key, int ply, int depth, int alpha, int beta, int& out_score, Move& out_move) {
    if (m_num_entries == 0) return false;
    size_t index = key % m_num_entries;
    const TTEntry& entry = m_entries[index];

    if (entry.key == key) {
        out_move = entry.move;
        if (entry.depth >= depth) {
            int score = score_from_tt(entry.score, ply);
            if (entry.flag == TT_EXACT) {
                out_score = score;
                return true;
            }
            if (entry.flag == TT_LOWER_BOUND && score >= beta) {
                out_score = score;
                return true;
            }
            if (entry.flag == TT_UPPER_BOUND && score <= alpha) {
                out_score = score;
                return true;
            }
        }
    }
    return false;
}

void TranspositionTable::store(uint64_t key, Move move, int score, int depth, uint8_t flag, int ply) {
    if (m_num_entries == 0) return;
    size_t index = key % m_num_entries;
    TTEntry& entry = m_entries[index];

    // Replacement condition: empty slot, same position, older generation, or deeper search
    if (entry.key == 0 || entry.key == key || entry.age != m_age || depth >= entry.depth) {
        entry.key = key;
        entry.score = static_cast<int16_t>(score_to_tt(score, ply));
        entry.depth = static_cast<int8_t>(depth);
        entry.flag = flag;
        entry.age = m_age;
        if (move != MOVE_NONE || entry.key != key) {
            entry.move = move;
        }
    }
}

Move TranspositionTable::get_best_move(uint64_t key) {
    if (m_num_entries == 0) return MOVE_NONE;
    size_t index = key % m_num_entries;
    if (m_entries[index].key == key) {
        return m_entries[index].move;
    }
    return MOVE_NONE;
}
