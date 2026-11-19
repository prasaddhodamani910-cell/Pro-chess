#pragma once

#include "types.h"
#include "board.h"
#include "movegen.h"
#include "timeman.h"
#include <atomic>
#include <vector>

constexpr int MAX_PLY = 64;

class Search {
public:
    Search();

    void start_search(Board& board, const Limits& limits);
    void stop();
    bool is_stopped() const { return m_stopped.load(); }

    void clear_history();
    void set_elo(int elo) {
        m_elo = (elo < 250) ? 250 : (elo > 3000 ? 3000 : elo);
        m_limit_strength = (m_elo < 3000);
    }
    int get_elo() const { return m_elo; }
    void set_limit_strength(bool limit) { m_limit_strength = limit; }
    bool get_limit_strength() const { return m_limit_strength; }

private:
    void init_lmr();
    Value negamax(Board& board, int depth, Value alpha, Value beta, int ply, bool do_null, bool can_singular, Move prev_move);
    Value quiescence(Board& board, Value alpha, Value beta, int ply);

    void order_moves(const Board& board, MoveList& list, Move tt_move, int ply, Move prev_move);
    void pick_next_move(MoveList& list, int start_index);

    std::atomic<bool> m_stopped;
    TimeManager m_timeman;
    Limits m_limits;

    int m_elo = 3000;
    bool m_limit_strength = false;

    uint64_t m_nodes;
    int m_seldepth;

    Move m_killer_moves[2][MAX_PLY];
    Move m_counter_moves[COLOR_NB][64][64];
    int m_history[COLOR_NB][64][64];
    int m_lmr_table[MAX_PLY][64];

    // PV table
    Move m_pv_table[MAX_PLY][MAX_PLY];
    int m_pv_length[MAX_PLY];
};

extern Search GlobalSearch;
