#include "timeman.h"
#include <algorithm>

void TimeManager::init(const Limits& limits, Color side) {
    m_start_time = std::chrono::high_resolution_clock::now();
    m_node_limit = limits.nodes;

    if (limits.movetime > 0) {
        m_optimum_time = limits.movetime;
        m_maximum_time = limits.movetime;
        m_use_time = true;
        return;
    }

    int time_left = (side == WHITE) ? limits.wtime : limits.btime;
    int inc = (side == WHITE) ? limits.winc : limits.binc;

    if (time_left > 0) {
        m_use_time = true;
        int moves = (limits.movestogo > 0) ? std::min(limits.movestogo, 30) : 30;
        m_optimum_time = (time_left / moves) + (inc * 3 / 4);

        // Maximum time allows extending when in complex position
        m_maximum_time = std::min(time_left - 50, m_optimum_time * 3);
        if (m_maximum_time <= 0) m_maximum_time = std::max(10, time_left - 10);
    } else {
        m_use_time = false;
        m_optimum_time = 0;
        m_maximum_time = 0;
    }
}

bool TimeManager::should_stop(uint64_t nodes_searched) {
    if (m_node_limit > 0 && nodes_searched >= m_node_limit) {
        return true;
    }

    if (!m_use_time) return false;

    // Only query clock periodically to reduce overhead
    if ((nodes_searched & 2047) == 0) {
        auto now = std::chrono::high_resolution_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - m_start_time).count();
        if (elapsed >= m_maximum_time) {
            return true;
        }
    }
    return false;
}

bool TimeManager::is_hard_limit_exceeded() {
    if (!m_use_time) return false;
    auto now = std::chrono::high_resolution_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - m_start_time).count();
    return elapsed >= m_maximum_time;
}
