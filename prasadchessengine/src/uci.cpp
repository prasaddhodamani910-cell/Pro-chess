#include "uci.h"
#include "search.h"
#include "evaluate.h"
#include "tt.h"
#include "perft.h"
#include "movegen.h"
#include <iostream>
#include <sstream>
#include <thread>

Move UCI::parse_move(Board& board, const std::string& move_str) {
    MoveList list;
    generate_legal_moves(board, list, GEN_ALL);
    for (int i = 0; i < list.size(); ++i) {
        Move m = list.move(i);
        if (move_to_string(m) == move_str) {
            return m;
        }
    }
    return MOVE_NONE;
}

void UCI::handle_position(Board& board, std::istringstream& ss) {
    std::string token;
    ss >> token;

    if (token == "startpos") {
        board.set_startpos();
        ss >> token; // Might be "moves"
    } else if (token == "fen") {
        std::string fen;
        while (ss >> token && token != "moves") {
            fen += token + " ";
        }
        board.set_fen(fen);
    }

    if (token == "moves") {
        std::string move_str;
        StateInfo st;
        while (ss >> move_str) {
            Move m = parse_move(board, move_str);
            if (m != MOVE_NONE) {
                board.make_move(m, st);
            } else {
                break;
            }
        }
    }
}

void UCI::handle_go(Board& board, std::istringstream& ss) {
    Limits limits;
    std::string token;

    while (ss >> token) {
        if (token == "wtime") ss >> limits.wtime;
        else if (token == "btime") ss >> limits.btime;
        else if (token == "winc") ss >> limits.winc;
        else if (token == "binc") ss >> limits.binc;
        else if (token == "movestogo") ss >> limits.movestogo;
        else if (token == "depth") ss >> limits.depth;
        else if (token == "nodes") ss >> limits.nodes;
        else if (token == "movetime") ss >> limits.movetime;
        else if (token == "infinite") limits.infinite = true;
        else if (token == "perft") {
            int d = 1;
            ss >> d;
            perft_divide(board, d);
            return;
        }
    }

    GlobalSearch.start_search(board, limits);
}

void UCI::loop() {
    Board board;
    std::string line;
    std::thread search_thread;

    while (std::getline(std::cin, line)) {
        std::istringstream ss(line);
        std::string command;
        ss >> command;

        if (command == "uci") {
            std::cout << "id name PrasadChessEngine 1.0\n";
            std::cout << "id author Prasad\n";
            std::cout << "option name Hash type spin default 64 min 1 max 1024\n";
            std::cout << "uciok" << std::endl;
        } else if (command == "isready") {
            std::cout << "readyok" << std::endl;
        } else if (command == "setoption") {
            std::string name_token, opt_name, value_token;
            int opt_val = 64;
            ss >> name_token >> opt_name >> value_token >> opt_val;
            if (opt_name == "Hash" || opt_name == "hash") {
                TT.resize(std::max(1, std::min(1024, opt_val)));
            }
        } else if (command == "ucinewgame") {
            GlobalSearch.stop();
            if (search_thread.joinable()) search_thread.join();
            TT.clear();
            GlobalSearch.clear_history();
            board.set_startpos();
        } else if (command == "position") {
            GlobalSearch.stop();
            if (search_thread.joinable()) search_thread.join();
            handle_position(board, ss);
        } else if (command == "go") {
            GlobalSearch.stop();
            if (search_thread.joinable()) search_thread.join();
            search_thread = std::thread([this, &board, &ss, line]() {
                std::istringstream thread_ss(line);
                std::string cmd;
                thread_ss >> cmd;
                handle_go(board, thread_ss);
            });
        } else if (command == "stop") {
            GlobalSearch.stop();
            if (search_thread.joinable()) search_thread.join();
        } else if (command == "quit") {
            GlobalSearch.stop();
            if (search_thread.joinable()) search_thread.join();
            break;
        } else if (command == "d" || command == "print") {
            board.print();
        } else if (command == "eval") {
            std::cout << "Static eval: " << evaluate(board) << " cp (side to move)\n";
        } else if (command == "perftsuite") {
            run_perft_suite(board);
        }
    }

    if (search_thread.joinable()) {
        GlobalSearch.stop();
        search_thread.join();
    }
}
