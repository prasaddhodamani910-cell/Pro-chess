#include "perft.h"
#include "movegen.h"
#include <iostream>
#include <chrono>
#include <iomanip>

uint64_t perft(Board& board, int depth) {
    if (depth == 0) return 1ULL;

    MoveList list;
    generate_legal_moves(board, list, GEN_ALL);

    if (depth == 1) return list.size();

    uint64_t nodes = 0;
    StateInfo st;
    for (int i = 0; i < list.size(); ++i) {
        board.make_move(list.move(i), st);
        nodes += perft(board, depth - 1);
        board.unmake_move(list.move(i), st);
    }
    return nodes;
}

void perft_divide(Board& board, int depth) {
    if (depth <= 0) {
        std::cout << "Nodes: 1\n";
        return;
    }

    MoveList list;
    generate_legal_moves(board, list, GEN_ALL);

    auto t0 = std::chrono::high_resolution_clock::now();
    uint64_t total_nodes = 0;
    StateInfo st;

    for (int i = 0; i < list.size(); ++i) {
        Move m = list.move(i);
        board.make_move(m, st);
        uint64_t nodes = perft(board, depth - 1);
        board.unmake_move(m, st);

        total_nodes += nodes;
        std::cout << move_to_string(m) << ": " << nodes << "\n";
    }

    auto t1 = std::chrono::high_resolution_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    uint64_t nps = (ms > 0) ? (total_nodes * 1000 / ms) : 0;

    std::cout << "\n===========================\n";
    std::cout << "Total Nodes: " << total_nodes << "\n";
    std::cout << "Time:        " << ms << " ms\n";
    std::cout << "NPS:         " << nps << " nodes/sec\n";
    std::cout << "===========================\n";
}

struct PerftTestCase {
    const char* fen;
    int depth;
    uint64_t expected_nodes;
};

bool run_perft_suite(Board& board) {
    const PerftTestCase tests[] = {
        // Initial Position
        {"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1, 20ULL},
        {"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 2, 400ULL},
        {"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 3, 8902ULL},
        {"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 4, 197281ULL},
        {"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 5, 4865609ULL},

        // Kiwipete (Tricky castling, pins, EP, checks)
        {"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 1, 48ULL},
        {"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 2, 2039ULL},
        {"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3, 97862ULL},
        {"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 4, 4085603ULL},

        // Position 3 (Endgame & promotion)
        {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 1, 14ULL},
        {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 2, 191ULL},
        {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 3, 2812ULL},
        {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4, 43238ULL},
        {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 5, 674624ULL}
    };

    std::cout << "\n--- Starting Perft Verification Suite ---\n";
    bool all_passed = true;

    for (const auto& test : tests) {
        board.set_fen(test.fen);
        auto t0 = std::chrono::high_resolution_clock::now();
        uint64_t nodes = perft(board, test.depth);
        auto t1 = std::chrono::high_resolution_clock::now();
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();

        bool pass = (nodes == test.expected_nodes);
        if (!pass) all_passed = false;

        std::cout << (pass ? "[PASS]" : "[FAIL]")
                  << " Depth " << test.depth
                  << " Nodes: " << nodes
                  << " (Expected: " << test.expected_nodes << ")"
                  << " in " << ms << " ms\n";
    }

    std::cout << (all_passed ? "\nALL PERFT TESTS PASSED SUCCESSFULLY!\n\n" : "\nSOME PERFT TESTS FAILED!\n\n");
    return all_passed;
}
