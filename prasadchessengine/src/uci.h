#pragma once

#include "board.h"
#include <string>

class UCI {
public:
    UCI() = default;
    void loop();

private:
    void handle_position(Board& board, std::istringstream& ss);
    void handle_go(Board& board, std::istringstream& ss);

    Move parse_move(Board& board, const std::string& move_str);
};
