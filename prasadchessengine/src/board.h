#pragma once

#include "types.h"
#include "bitboard.h"
#include "magic.h"
#include "zobrist.h"
#include <string>
#include <vector>

struct StateInfo {
    uint8_t castling_rights = 0;
    Square ep_square = SQ_NONE;
    int halfmove_clock = 0;
    Piece captured_piece = NO_PIECE;
    uint64_t zobrist_key = 0;
};

class Board {
public:
    Board();

    void clear();
    void set_startpos();
    bool set_fen(const std::string& fen);
    std::string get_fen() const;
    void print() const;

    // Piece accessors
    inline Bitboard pieces(Color c) const { return m_color_bb[c]; }
    inline Bitboard pieces(PieceType pt) const { return m_piece_bb[make_piece(WHITE, pt)] | m_piece_bb[make_piece(BLACK, pt)]; }
    inline Bitboard pieces(Color c, PieceType pt) const { return m_piece_bb[make_piece(c, pt)]; }
    inline Bitboard occupied() const { return m_color_bb[WHITE] | m_color_bb[BLACK]; }
    inline Piece piece_at(Square sq) const { return m_board[sq]; }
    inline Color side_to_move() const { return m_side; }
    inline Square ep_square() const { return m_ep_square; }
    inline uint8_t castling_rights() const { return m_castling_rights; }
    inline int halfmove_clock() const { return m_halfmove_clock; }
    inline int fullmove_number() const { return m_fullmove_number; }
    inline uint64_t zobrist_key() const { return m_zobrist_key; }
    inline Square king_square(Color c) const { return lsb(m_piece_bb[make_piece(c, KING)]); }

    // Check & attack queries
    bool is_square_attacked(Square sq, Color by_color) const;
    bool in_check() const { return is_square_attacked(king_square(m_side), ~m_side); }
    bool in_check(Color c) const { return is_square_attacked(king_square(c), ~c); }
    Bitboard attackers_to(Square sq, Bitboard occ) const;

    // Static Exchange Evaluation (SEE)
    int see(Move m) const;
    bool see_ge(Move m, int threshold = 0) const;

    // Move execution
    bool make_move(Move m, StateInfo& st);
    void unmake_move(Move m, const StateInfo& st);
    void make_null_move(StateInfo& st);
    void unmake_null_move(const StateInfo& st);

    // Repetition detection
    bool is_repetition(int count = 2) const;

    uint64_t compute_zobrist_key() const;

private:
    void put_piece(Piece p, Square sq);
    void remove_piece(Square sq);
    void move_piece(Square from, Square to);

    Bitboard m_piece_bb[PIECE_NB];
    Bitboard m_color_bb[COLOR_NB];
    Piece m_board[64];

    Color m_side;
    uint8_t m_castling_rights;
    Square m_ep_square;
    int m_halfmove_clock;
    int m_fullmove_number;
    uint64_t m_zobrist_key;

    std::vector<uint64_t> m_history_keys;
};
