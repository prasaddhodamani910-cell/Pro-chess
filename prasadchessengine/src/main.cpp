#include "bitboard.h"
#include "magic.h"
#include "zobrist.h"
#include "evaluate.h"
#include "tt.h"
#include "perft.h"
#include "uci.h"
#include <iostream>
#include <cstring>

int main(int argc, char* argv[]) {
    // 1. Initialize all engine subsystems
    init_bitboards();
    init_magics();
    init_zobrist();
    init_evaluation();
    TT.resize(64); // Default 64 MB Transposition Table

    // 2. Command-line shortcuts
    if (argc > 1) {
        if (std::strcmp(argv[1], "perft") == 0 || std::strcmp(argv[1], "bench") == 0) {
            Board board;
            bool ok = run_perft_suite(board);
            return ok ? 0 : 1;
        }
    }

    // 3. Launch UCI loop
    UCI uci;
    uci.loop();

    return 0;
}
