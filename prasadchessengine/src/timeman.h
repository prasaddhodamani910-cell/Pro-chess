#pragma once

#include "types.h"
#include <chrono>

struct Limits {
    int wtime = 0;
    int btime = 0;
    int winc = 0;
    int binc = 0;
    int movestogo = 0;
    int movetime = 0;
    int depth = 0;
    uint64_t nodes = 0;
    bool infinite = false;
};

class TimeManager {
public:
    TimeManager() = default;

    void init(const Limits& limits, Color side);
    bool should_stop(uint64_t nodes_searched);
    bool is_hard_limit_exceeded();

    int allocated_time_ms() const { return m_optimum_time; }

private:
    std::chrono::high_resolution_clock::time_point m_start_time;
    int m_optimum_time = 0;
    int m_maximum_time = 0;
    bool m_use_time = false;
    uint64_t m_node_limit = 0;
};
