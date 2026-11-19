#include <windows.h>
#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <fstream>
#include <chrono>
#include <thread>
#include "board.h"
#include "movegen.h"

struct UciProcess {
    HANDLE hChildStd_IN_Rd = NULL;
    HANDLE hChildStd_IN_Wr = NULL;
    HANDLE hChildStd_OUT_Rd = NULL;
    HANDLE hChildStd_OUT_Wr = NULL;
    PROCESS_INFORMATION piProcInfo;

    bool start(const std::string& cmdline) {
        SECURITY_ATTRIBUTES saAttr;
        saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
        saAttr.bInheritHandle = TRUE;
        saAttr.lpSecurityDescriptor = NULL;

        if (!CreatePipe(&hChildStd_OUT_Rd, &hChildStd_OUT_Wr, &saAttr, 0)) return false;
        if (!SetHandleInformation(hChildStd_OUT_Rd, HANDLE_FLAG_INHERIT, 0)) return false;

        if (!CreatePipe(&hChildStd_IN_Rd, &hChildStd_IN_Wr, &saAttr, 0)) return false;
        if (!SetHandleInformation(hChildStd_IN_Wr, HANDLE_FLAG_INHERIT, 0)) return false;

        STARTUPINFOA siStartInfo;
        ZeroMemory(&piProcInfo, sizeof(PROCESS_INFORMATION));
        ZeroMemory(&siStartInfo, sizeof(STARTUPINFOA));
        siStartInfo.cb = sizeof(STARTUPINFOA);
        siStartInfo.hStdError = hChildStd_OUT_Wr;
        siStartInfo.hStdOutput = hChildStd_OUT_Wr;
        siStartInfo.hStdInput = hChildStd_IN_Rd;
        siStartInfo.dwFlags |= STARTF_USESTDHANDLES;

        std::vector<char> cmd(cmdline.begin(), cmdline.end());
        cmd.push_back(0);

        BOOL bSuccess = CreateProcessA(NULL, cmd.data(), NULL, NULL, TRUE, 0, NULL, NULL, &siStartInfo, &piProcInfo);
        if (!bSuccess) return false;

        return true;
    }

    void send(const std::string& msg) {
        std::string s = msg + "\n";
        DWORD dwWritten;
        WriteFile(hChildStd_IN_Wr, s.c_str(), static_cast<DWORD>(s.length()), &dwWritten, NULL);
    }

    std::string read_line() {
        std::string line;
        char ch;
        DWORD dwRead;
        while (ReadFile(hChildStd_OUT_Rd, &ch, 1, &dwRead, NULL) && dwRead > 0) {
            if (ch == '\n') break;
            if (ch != '\r') line += ch;
        }
        return line;
    }

    std::string get_best_move(std::string& out_eval) {
        std::string line;
        std::string best_move = "";
        std::string last_score = "0";

        while (true) {
            line = read_line();
            if (line.empty()) continue;

            // Extract eval from info line if available
            size_t cp_pos = line.find("score cp ");
            if (cp_pos != std::string::npos) {
                std::istringstream ss(line.substr(cp_pos + 9));
                int cp = 0;
                ss >> cp;
                last_score = std::to_string(cp) + " cp";
            }
            size_t mate_pos = line.find("score mate ");
            if (mate_pos != std::string::npos) {
                std::istringstream ss(line.substr(mate_pos + 11));
                int m = 0;
                ss >> m;
                last_score = "Mate in " + std::to_string(m);
            }

            if (line.rfind("bestmove", 0) == 0) {
                std::istringstream ss(line);
                std::string token;
                ss >> token >> best_move;
                break;
            }
        }
        out_eval = last_score;
        return best_move;
    }

    void wait_ready() {
        send("isready");
        while (true) {
            std::string line = read_line();
            if (line == "readyok") break;
        }
    }

    void stop() {
        send("quit");
        CloseHandle(hChildStd_IN_Wr);
        CloseHandle(hChildStd_IN_Rd);
        CloseHandle(hChildStd_OUT_Rd);
        CloseHandle(hChildStd_OUT_Wr);
        WaitForSingleObject(piProcInfo.hProcess, 1000);
        CloseHandle(piProcInfo.hProcess);
        CloseHandle(piProcInfo.hThread);
    }
};

struct MoveRecord {
    int move_number;
    std::string player;
    std::string uci_move;
    std::string eval;
    std::string fen;
};

int main(int argc, char* argv[]) {
    init_bitboards();
    init_magics();
    init_zobrist();

    std::cout << "========================================================\n";
    std::cout << "  LIVE MATCH: PrasadChessEngine vs Stockfish 19\n";
    std::cout << "  (Skill Level: Maximum / 20, Handcrafted Bitboards)\n";
    std::cout << "========================================================\n\n";

    UciProcess p_engine;
    UciProcess sf_engine;

    std::string p_path = "prasadchessengine.exe";
    std::string sf_path = "C:\\Projects by Prasad\\chessproject\\bin\\stockfish.exe";

    std::cout << "[1/4] Launching PrasadChessEngine... ";
    if (!p_engine.start(p_path)) {
        std::cerr << "FAILED to launch " << p_path << std::endl;
        return 1;
    }
    std::cout << "OK\n";

    std::cout << "[2/4] Launching Stockfish 19... ";
    if (!sf_engine.start(sf_path)) {
        std::cerr << "FAILED to launch " << sf_path << std::endl;
        p_engine.stop();
        return 1;
    }
    std::cout << "OK\n";

    std::cout << "[3/4] Initializing UCI options...\n";
    p_engine.send("uci");
    p_engine.send("setoption name Hash value 64");
    p_engine.wait_ready();

    sf_engine.send("uci");
    sf_engine.send("setoption name Hash value 64");
    sf_engine.send("setoption name Skill Level value 20"); // Maximum Stockfish level
    sf_engine.wait_ready();

    std::cout << "[4/4] Starting Game...\n\n";
    p_engine.send("ucinewgame");
    sf_engine.send("ucinewgame");
    p_engine.wait_ready();
    sf_engine.wait_ready();

    Board board;
    board.set_startpos();

    std::vector<std::string> moves_history;
    std::vector<MoveRecord> recorded_moves;

    int move_count = 1;
    std::string game_result = "*";
    const int MOVE_TIME_MS = 1000; // 1 second per move for dynamic live match

    while (true) {
        Color side = board.side_to_move();
        std::string player_name = (side == WHITE) ? "PrasadChessEngine (White)" : "Stockfish 19 (Black)";

        MoveList legal_moves;
        generate_legal_moves(board, legal_moves, GEN_ALL);
        if (legal_moves.size() == 0) {
            if (board.in_check()) {
                game_result = (side == WHITE) ? "0-1 (Stockfish wins by checkmate)" : "1-0 (PrasadChessEngine wins by checkmate)";
                std::cout << "\nCHECKMATE! " << game_result << "\n";
            } else {
                game_result = "1/2-1/2 (Stalemate)";
                std::cout << "\nSTALEMATE! Game is a draw.\n";
            }
            break;
        }

        if (board.is_repetition(3)) {
            game_result = "1/2-1/2 (Draw by 3-fold repetition)";
            std::cout << "\nDRAW by 3-fold repetition!\n";
            break;
        }

        if (board.halfmove_clock() >= 100) {
            game_result = "1/2-1/2 (Draw by 50-move rule)";
            std::cout << "\nDRAW by 50-move rule!\n";
            break;
        }

        if (move_count > 150) {
            game_result = "1/2-1/2 (Draw by move limit)";
            std::cout << "\nMatch concluded by move limit.\n";
            break;
        }

        // Build position string
        std::string pos_cmd = "position startpos";
        if (!moves_history.empty()) {
            pos_cmd += " moves";
            for (const auto& m : moves_history) {
                pos_cmd += " " + m;
            }
        }

        std::string chosen_move;
        std::string eval_str;

        if (side == WHITE) {
            p_engine.send(pos_cmd);
            p_engine.send("go movetime " + std::to_string(MOVE_TIME_MS));
            chosen_move = p_engine.get_best_move(eval_str);
        } else {
            sf_engine.send(pos_cmd);
            sf_engine.send("go movetime " + std::to_string(MOVE_TIME_MS));
            chosen_move = sf_engine.get_best_move(eval_str);
        }

        // Validate move
        Move parsed_m = MOVE_NONE;
        for (int i = 0; i < legal_moves.size(); ++i) {
            if (move_to_string(legal_moves.move(i)) == chosen_move) {
                parsed_m = legal_moves.move(i);
                break;
            }
        }

        if (parsed_m == MOVE_NONE) {
            std::cerr << "ILLEGAL MOVE RECEIVED: " << chosen_move << " from " << player_name << std::endl;
            game_result = (side == WHITE) ? "0-1 (Illegal move)" : "1-0 (Illegal move)";
            break;
        }

        StateInfo st;
        board.make_move(parsed_m, st);
        moves_history.push_back(chosen_move);

        MoveRecord rec;
        rec.move_number = (side == WHITE) ? (move_count / 2 + 1) : (move_count / 2);
        rec.player = (side == WHITE) ? "PrasadChessEngine" : "Stockfish 19";
        rec.uci_move = chosen_move;
        rec.eval = eval_str;
        rec.fen = board.get_fen();
        recorded_moves.push_back(rec);

        std::cout << "[" << ((side == WHITE) ? std::to_string(rec.move_number) + ". " : "   ")
                  << (side == WHITE ? "W: " : "B: ")
                  << rec.player << "] -> " << chosen_move
                  << " (Eval: " << eval_str << ")\n";

        move_count++;
    }

    std::cout << "\n========================================================\n";
    std::cout << "  FINAL RESULT: " << game_result << "\n";
    std::cout << "  Total Moves:  " << moves_history.size() << "\n";
    std::cout << "========================================================\n\n";

    board.print();

    // Export JSON match data for Generative UI Live Viewer
    std::ofstream out("match_data.json");
    out << "{\n";
    out << "  \"white\": \"PrasadChessEngine\",\n";
    out << "  \"black\": \"Stockfish 19 (Skill Level 20)\",\n";
    out << "  \"result\": \"" << game_result << "\",\n";
    out << "  \"moves\": [\n";
    for (size_t i = 0; i < recorded_moves.size(); ++i) {
        const auto& r = recorded_moves[i];
        out << "    {\"num\": " << r.move_number
            << ", \"player\": \"" << r.player
            << "\", \"move\": \"" << r.uci_move
            << "\", \"eval\": \"" << r.eval
            << "\", \"fen\": \"" << r.fen << "\"}";
        if (i + 1 < recorded_moves.size()) out << ",";
        out << "\n";
    }
    out << "  ]\n";
    out << "}\n";

    p_engine.stop();
    sf_engine.stop();
    return 0;
}
