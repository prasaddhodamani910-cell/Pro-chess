#include "search.h"
#include "evaluate.h"
#include "movegen.h"
#include "tt.h"
#include <iostream>
#include <chrono>
#include <algorithm>
#include <cmath>
#include <random>

Search GlobalSearch;

Search::Search() : m_stopped(false), m_elo(3000), m_limit_strength(false), m_nodes(0), m_seldepth(0) {
    init_lmr();
    clear_history();
}

void Search::init_lmr() {
    for (int d = 0; d < MAX_PLY; ++d) {
        for (int m = 0; m < 64; ++m) {
            if (d == 0 || m == 0) {
                m_lmr_table[d][m] = 0;
            } else {
                m_lmr_table[d][m] = static_cast<int>(0.75 + std::log(d) * std::log(m) / 1.75);
            }
        }
    }
}

void Search::clear_history() {
    for (int c = 0; c < COLOR_NB; ++c) {
        for (int from = 0; from < 64; ++from) {
            for (int to = 0; to < 64; ++to) {
                m_history[c][from][to] = 0;
                m_counter_moves[c][from][to] = MOVE_NONE;
            }
        }
    }
    for (int i = 0; i < 2; ++i) {
        for (int p = 0; p < MAX_PLY; ++p) {
            m_killer_moves[i][p] = MOVE_NONE;
        }
    }
}

void Search::stop() {
    m_stopped.store(true);
}

void Search::pick_next_move(MoveList& list, int start_index) {
    int best_idx = start_index;
    int best_score = list.score(start_index);

    for (int i = start_index + 1; i < list.size(); ++i) {
        if (list.score(i) > best_score) {
            best_score = list.score(i);
            best_idx = i;
        }
    }

    if (best_idx != start_index) {
        std::swap(list.moves[start_index], list.moves[best_idx]);
    }
}

void Search::order_moves(const Board& board, MoveList& list, Move tt_move, int ply, Move prev_move) {
    Color us = board.side_to_move();

    for (int i = 0; i < list.size(); ++i) {
        Move m = list.move(i);
        int score = 0;

        if (m == tt_move) {
            score = 30000000;
        } else if (is_capture(m)) {
            int see_val = board.see(m);
            if (see_val >= 0) {
                Piece victim = board.piece_at(to_sq(m));
                Piece attacker = board.piece_at(from_sq(m));
                if (is_en_passant(m)) {
                    victim = make_piece(~us, PAWN);
                }
                int victim_val = (victim != NO_PIECE) ? SeePieceValues[type_of_piece(victim)] : 100;
                int attacker_val = (attacker != NO_PIECE) ? SeePieceValues[type_of_piece(attacker)] : 100;
                score = 20000000 + (victim_val * 10 - attacker_val);
            } else {
                score = 1000000 + see_val; // Bad captures sorted after quiet moves
            }
        } else if (is_promotion(m)) {
            score = 19000000 + SeePieceValues[promotion_piece_type(m)];
        } else {
            // Quiet moves
            if (ply < MAX_PLY && m == m_killer_moves[0][ply]) {
                score = 15000000;
            } else if (ply < MAX_PLY && m == m_killer_moves[1][ply]) {
                score = 14000000;
            } else if (prev_move != MOVE_NONE && m == m_counter_moves[us][from_sq(prev_move)][to_sq(prev_move)]) {
                score = 13000000;
            } else {
                score = m_history[us][from_sq(m)][to_sq(m)];
            }
        }

        list.moves[i].score = score;
    }
}

Value Search::quiescence(Board& board, Value alpha, Value beta, int ply) {
    if ((m_nodes & 2047) == 0 && m_timeman.should_stop(m_nodes)) {
        m_stopped.store(true);
        return VALUE_ZERO;
    }

    if (m_stopped.load()) return VALUE_ZERO;
    m_nodes++;
    if (ply > m_seldepth) m_seldepth = ply;

    bool in_check = board.in_check();

    if (ply >= MAX_PLY - 1) {
        return in_check ? VALUE_ZERO : evaluate(board);
    }

    Value stand_pat = -VALUE_INF;
    if (!in_check) {
        stand_pat = evaluate(board);
        if (stand_pat >= beta) return beta;
        if (stand_pat > alpha) alpha = stand_pat;
    }

    MoveList list;
    generate_legal_moves(board, list, in_check ? GEN_ALL : GEN_CAPTURES);

    if (in_check && list.size() == 0) {
        return -VALUE_MATE + ply;
    }

    order_moves(board, list, MOVE_NONE, ply, MOVE_NONE);

    StateInfo st;
    for (int i = 0; i < list.size(); ++i) {
        pick_next_move(list, i);
        Move m = list.move(i);

        if (!in_check) {
            // Prune losing captures using SEE
            if (!is_promotion(m) && board.see(m) < 0) {
                continue;
            }

            // Delta pruning
            if (!is_promotion(m)) {
                Piece victim = board.piece_at(to_sq(m));
                int victim_val = (victim != NO_PIECE) ? SeePieceValues[type_of_piece(victim)] : 100;
                if (stand_pat + victim_val + 200 < alpha) continue;
            }
        }

        board.make_move(m, st);
        Value score = -quiescence(board, -beta, -alpha, ply + 1);
        board.unmake_move(m, st);

        if (m_stopped.load()) return VALUE_ZERO;

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }

    return alpha;
}

Value Search::negamax(Board& board, int depth, Value alpha, Value beta, int ply, bool do_null, bool can_singular, Move prev_move) {
    m_pv_length[ply] = ply;

    if ((m_nodes & 2047) == 0 && m_timeman.should_stop(m_nodes)) {
        m_stopped.store(true);
        return VALUE_ZERO;
    }

    if (m_stopped.load()) return VALUE_ZERO;

    // Repetition and 50-move draw
    if (ply > 0 && (board.is_repetition(2) || board.halfmove_clock() >= 100)) {
        return VALUE_DRAW;
    }

    if (ply >= MAX_PLY - 1) {
        return evaluate(board);
    }

    bool is_root = (ply == 0);
    bool in_check = board.in_check();

    // Check extension
    if (in_check) depth++;

    // Base condition
    if (depth <= 0) {
        return quiescence(board, alpha, beta, ply);
    }

    m_nodes++;
    if (ply > m_seldepth) m_seldepth = ply;

    // Transposition Table probe
    Move tt_move = MOVE_NONE;
    int tt_score = 0;
    TTEntry tt_entry;
    bool tt_hit = TT.probe_entry(board.zobrist_key(), tt_entry);

    if (tt_hit) {
        tt_move = tt_entry.move;
        if (!is_root && tt_entry.depth >= depth) {
            int score = tt_entry.score;
            if (score >= VALUE_MATE_IN_MAX_PLY) score -= ply;
            else if (score <= -VALUE_MATE_IN_MAX_PLY) score += ply;

            if (tt_entry.flag == TT_EXACT) return score;
            if (tt_entry.flag == TT_LOWER_BOUND && score >= beta) return score;
            if (tt_entry.flag == TT_UPPER_BOUND && score <= alpha) return score;
        }
    }

    Value static_eval = evaluate(board);

    // Static Null Move Pruning (Reverse Futility Pruning)
    if (!is_root && !in_check && depth <= 3 && std::abs(beta) < VALUE_MATE_IN_MAX_PLY) {
        int margin = 100 * depth;
        if (static_eval - margin >= beta) {
            return static_eval - margin;
        }
    }

    // Null Move Pruning
    if (do_null && !is_root && !in_check && depth >= 3 && std::abs(beta) < VALUE_MATE_IN_MAX_PLY && static_eval >= beta) {
        Color us = board.side_to_move();
        Bitboard non_pawns = board.pieces(us) ^ board.pieces(us, PAWN) ^ board.pieces(us, KING);
        if (non_pawns != 0) {
            StateInfo st;
            board.make_null_move(st);
            int R = 3 + depth / 3;
            Value score = -negamax(board, depth - 1 - R, -beta, -beta + 1, ply + 1, false, false, MOVE_NONE);
            board.unmake_null_move(st);

            if (m_stopped.load()) return VALUE_ZERO;
            if (score >= beta) return beta;
        }
    }

    bool is_pv = (beta - alpha > 1);

    // Singular Extension ("Brilliant Moves")
    int extension = 0;
    if (is_pv && can_singular && !is_root && depth >= 6 && tt_move != MOVE_NONE && tt_hit) {
        if (tt_entry.depth >= depth - 3 && tt_entry.flag != TT_UPPER_BOUND && std::abs(tt_score) < VALUE_MATE_IN_MAX_PLY) {
            Value singular_beta = tt_entry.score - 2 * depth;
            int singular_depth = (depth - 1) / 2;

            MoveList sing_list;
            generate_legal_moves(board, sing_list, GEN_ALL);
            order_moves(board, sing_list, MOVE_NONE, ply, MOVE_NONE);
            bool is_singular = true;
            StateInfo sing_st;

            for (int s = 0; s < sing_list.size(); ++s) {
                pick_next_move(sing_list, s);
                Move sm = sing_list.move(s);
                if (sm == tt_move) continue;

                board.make_move(sm, sing_st);
                Value s_score = -negamax(board, singular_depth, -singular_beta, -singular_beta + 1, ply + 1, false, false, sm);
                board.unmake_move(sm, sing_st);

                if (s_score >= singular_beta) {
                    is_singular = false;
                    break;
                }
            }

            if (is_singular) {
                extension = 1;
                // Double extension for sharp singular piece sacrifices
                if (is_capture(tt_move) && board.see(tt_move) < -100) {
                    extension = 2;
                }
            }
        }
    }

    depth += extension;

    MoveList list;
    generate_legal_moves(board, list, GEN_ALL);

    // Checkmate or Stalemate detection
    if (list.size() == 0) {
        if (in_check) {
            return -VALUE_MATE + ply;
        } else {
            return VALUE_DRAW;
        }
    }

    order_moves(board, list, tt_move, ply, prev_move);

    Move best_move = MOVE_NONE;
    uint8_t tt_flag = TT_UPPER_BOUND;
    int legal_moves = 0;
    int quiet_moves_count = 0;
    Move quiet_moves_searched[64];
    StateInfo st;

    for (int i = 0; i < list.size(); ++i) {
        pick_next_move(list, i);
        Move m = list.move(i);
        bool is_quiet = !is_capture(m) && !is_promotion(m);

        // Futility Pruning
        if (!is_root && !in_check && depth <= 3 && is_quiet && (static_eval + 120 * depth <= alpha)) {
            continue;
        }

        // Late Move Pruning (LMP)
        if (!is_root && !in_check && depth <= 4 && is_quiet && quiet_moves_count >= (3 + depth * depth)) {
            continue;
        }

        // SEE Pruning for losing captures in non-PV nodes
        if (!is_root && !in_check && !is_pv && depth <= 4 && is_capture(m) && !is_promotion(m) && (board.see(m) < -60 * depth)) {
            continue;
        }

        board.make_move(m, st);
        legal_moves++;
        if (is_quiet && quiet_moves_count < 64) {
            quiet_moves_searched[quiet_moves_count++] = m;
        }

        Value score;

        // Late Move Reductions (LMR)
        if (legal_moves >= 3 && depth >= 3 && is_quiet && !in_check) {
            int d_idx = std::min(depth, MAX_PLY - 1);
            int m_idx = std::min(legal_moves, 63);
            int reduction = m_lmr_table[d_idx][m_idx];

            if (ply < MAX_PLY && (m == m_killer_moves[0][ply] || m == m_killer_moves[1][ply])) {
                reduction--;
            }
            if (prev_move != MOVE_NONE && m == m_counter_moves[board.side_to_move()][from_sq(prev_move)][to_sq(prev_move)]) {
                reduction--;
            }
            if (m_history[board.side_to_move()][from_sq(m)][to_sq(m)] < 0) {
                reduction++;
            }

            reduction = std::clamp(reduction, 0, depth - 2);
            int reduced_depth = depth - 1 - reduction;

            score = -negamax(board, reduced_depth, -alpha - 1, -alpha, ply + 1, true, false, m);

            if (score > alpha && score < beta) {
                score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, true, true, m);
            }
        } else if (legal_moves == 1) {
            // PV Search
            score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, true, true, m);
        } else {
            // Zero window search (can_singular = false)
            score = -negamax(board, depth - 1, -alpha - 1, -alpha, ply + 1, true, false, m);
            if (score > alpha && score < beta) {
                score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, true, true, m);
            }
        }

        board.unmake_move(m, st);

        if (m_stopped.load()) return VALUE_ZERO;

        if (score >= beta) {
            // Beta cutoff (fail-high)
            TT.store(board.zobrist_key(), m, beta, depth, TT_LOWER_BOUND, ply);

            // Update killers, countermoves, and history with Malus
            if (is_quiet) {
                if (ply < MAX_PLY) {
                    m_killer_moves[1][ply] = m_killer_moves[0][ply];
                    m_killer_moves[0][ply] = m;
                }
                Color us = board.side_to_move();
                int bonus = depth * depth;
                m_history[us][from_sq(m)][to_sq(m)] += bonus;

                if (prev_move != MOVE_NONE) {
                    m_counter_moves[us][from_sq(prev_move)][to_sq(prev_move)] = m;
                }

                // History malus for failed quiet moves
                for (int q = 0; q < quiet_moves_count - 1; ++q) {
                    Move qm = quiet_moves_searched[q];
                    m_history[us][from_sq(qm)][to_sq(qm)] -= bonus;
                }
            }

            return beta;
        }

        if (score > alpha) {
            alpha = score;
            best_move = m;
            tt_flag = TT_EXACT;

            // Update PV table
            m_pv_table[ply][ply] = m;
            for (int next_ply = ply + 1; next_ply < m_pv_length[ply + 1]; ++next_ply) {
                m_pv_table[ply][next_ply] = m_pv_table[ply + 1][next_ply];
            }
            m_pv_length[ply] = m_pv_length[ply + 1];
        }
    }

    TT.store(board.zobrist_key(), best_move, alpha, depth, tt_flag, ply);
    return alpha;
}

void Search::start_search(Board& board, const Limits& limits) {
    m_stopped.store(false);
    m_limits = limits;
    m_nodes = 0;
    m_seldepth = 0;
    TT.increment_age();

    m_timeman.init(limits, board.side_to_move());

    int max_depth = limits.depth > 0 ? limits.depth : 64;
    int blunder_chance = 0;

    if (m_limit_strength || m_elo < 3000) {
        int elo_depth = 64;
        if (m_elo <= 250) { elo_depth = 1; blunder_chance = 65; }
        else if (m_elo <= 500) { elo_depth = 2; blunder_chance = 40; }
        else if (m_elo <= 750) { elo_depth = 3; blunder_chance = 20; }
        else if (m_elo <= 1200) { elo_depth = 4; blunder_chance = 8; }
        else if (m_elo <= 1750) { elo_depth = 6; blunder_chance = 2; }
        else if (m_elo <= 2200) { elo_depth = 8; blunder_chance = 0; }
        else if (m_elo <= 2700) { elo_depth = 12; blunder_chance = 0; }
        else { elo_depth = 64; blunder_chance = 0; }

        max_depth = std::min(max_depth, elo_depth);
    }
    Move best_move = MOVE_NONE;
    Value best_score = -VALUE_INF;

    auto search_start = std::chrono::high_resolution_clock::now();

    for (int depth = 1; depth <= max_depth; ++depth) {
        m_seldepth = 0;

        Value score = 0;
        // Aspiration Windows for depth >= 4
        if (depth >= 4) {
            Value delta = 30;
            Value alpha = std::max(-VALUE_INF, best_score - delta);
            Value beta  = std::min(VALUE_INF, best_score + delta);

            while (!m_stopped.load()) {
                score = negamax(board, depth, alpha, beta, 0, false, true, MOVE_NONE);
                if (score <= alpha) {
                    alpha = std::max(-VALUE_INF, alpha - delta);
                    delta += delta / 2;
                } else if (score >= beta) {
                    beta = std::min(VALUE_INF, beta + delta);
                    delta += delta / 2;
                } else {
                    break;
                }
            }
        } else {
            score = negamax(board, depth, -VALUE_INF, VALUE_INF, 0, false, true, MOVE_NONE);
        }

        if (m_stopped.load()) break;

        best_score = score;
        best_move = m_pv_table[0][0];

        auto now = std::chrono::high_resolution_clock::now();
        auto elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now - search_start).count();
        uint64_t nps = (elapsed_ms > 0) ? (m_nodes * 1000 / elapsed_ms) : 0;

        // Print UCI info line
        std::cout << "info depth " << depth
                  << " seldepth " << m_seldepth;

        if (std::abs(score) >= VALUE_MATE_IN_MAX_PLY) {
            int mate_in = (VALUE_MATE - std::abs(score) + 1) / 2;
            if (score < 0) mate_in = -mate_in;
            std::cout << " score mate " << mate_in;
        } else {
            std::cout << " score cp " << score;
        }

        std::cout << " nodes " << m_nodes
                  << " nps " << nps
                  << " time " << elapsed_ms
                  << " pv";

        for (int i = 0; i < m_pv_length[0]; ++i) {
            std::cout << " " << move_to_string(m_pv_table[0][i]);
        }
        std::cout << std::endl;

        if (std::abs(score) >= VALUE_MATE_IN_MAX_PLY || m_timeman.is_hard_limit_exceeded()) {
            break;
        }
    }

    if (best_move == MOVE_NONE) {
        MoveList list;
        generate_legal_moves(board, list, GEN_ALL);
        if (list.size() > 0) best_move = list.move(0);
    } else if (blunder_chance > 0) {
        MoveList list;
        generate_legal_moves(board, list, GEN_ALL);
        if (list.size() > 1) {
            static std::mt19937 rng(std::random_device{}());
            std::uniform_int_distribution<int> dist(0, 99);
            if (dist(rng) < blunder_chance) {
                std::uniform_int_distribution<int> move_dist(0, list.size() - 1);
                Move candidate = list.move(move_dist(rng));
                if (candidate != best_move) {
                    best_move = candidate;
                }
            }
        }
    }

    std::cout << "bestmove " << move_to_string(best_move) << std::endl;
}
