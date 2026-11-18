#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <iostream>
#include <sstream>

using Bitboard = uint64_t;

enum Color : int {
    WHITE = 0,
    BLACK = 1,
    COLOR_NB = 2
};

inline Color operator~(Color c) {
    return static_cast<Color>(c ^ 1);
}

enum PieceType : int {
    PAWN = 0,
    KNIGHT = 1,
    BISHOP = 2,
    ROOK = 3,
    QUEEN = 4,
    KING = 5,
    NO_PIECE_TYPE = 6,
    PIECE_TYPE_NB = 6
};

enum Piece : int {
    W_PAWN = 0, W_KNIGHT = 1, W_BISHOP = 2, W_ROOK = 3, W_QUEEN = 4, W_KING = 5,
    B_PAWN = 6, B_KNIGHT = 7, B_BISHOP = 8, B_ROOK = 9, B_QUEEN = 10, B_KING = 11,
    NO_PIECE = 12,
    PIECE_NB = 12
};

inline Piece make_piece(Color c, PieceType pt) {
    return static_cast<Piece>((c * 6) + pt);
}

inline PieceType type_of_piece(Piece p) {
    return static_cast<PieceType>(p % 6);
}

inline Color color_of_piece(Piece p) {
    return static_cast<Color>(p / 6);
}

enum Square : int {
    SQ_A1 = 0,  SQ_B1, SQ_C1, SQ_D1, SQ_E1, SQ_F1, SQ_G1, SQ_H1,
    SQ_A2,      SQ_B2, SQ_C2, SQ_D2, SQ_E2, SQ_F2, SQ_G2, SQ_H2,
    SQ_A3,      SQ_B3, SQ_C3, SQ_D3, SQ_E3, SQ_F3, SQ_G3, SQ_H3,
    SQ_A4,      SQ_B4, SQ_C4, SQ_D4, SQ_E4, SQ_F4, SQ_G4, SQ_H4,
    SQ_A5,      SQ_B5, SQ_C5, SQ_D5, SQ_E5, SQ_F5, SQ_G5, SQ_H5,
    SQ_A6,      SQ_B6, SQ_C6, SQ_D6, SQ_E6, SQ_F6, SQ_G6, SQ_H6,
    SQ_A7,      SQ_B7, SQ_C7, SQ_D7, SQ_E7, SQ_F7, SQ_G7, SQ_H7,
    SQ_A8,      SQ_B8, SQ_C8, SQ_D8, SQ_E8, SQ_F8, SQ_G8, SQ_H8,
    SQ_NONE = 64
};

enum File : int {
    FILE_A = 0, FILE_B, FILE_C, FILE_D, FILE_E, FILE_F, FILE_G, FILE_H
};

enum Rank : int {
    RANK_1 = 0, RANK_2, RANK_3, RANK_4, RANK_5, RANK_6, RANK_7, RANK_8
};

inline Square make_square(File f, Rank r) {
    return static_cast<Square>((r << 3) | f);
}

inline File file_of(Square s) {
    return static_cast<File>(s & 7);
}

inline Rank rank_of(Square s) {
    return static_cast<Rank>(s >> 3);
}

// Castling rights flags
enum CastlingRights : uint8_t {
    NO_CASTLING = 0,
    WHITE_OO    = 1,
    WHITE_OOO   = 2,
    BLACK_OO    = 4,
    BLACK_OOO   = 8,
    WHITE_CASTLING = WHITE_OO | WHITE_OOO,
    BLACK_CASTLING = BLACK_OO | BLACK_OOO,
    ALL_CASTLING   = 15
};

// Move Flag Definitions (4 bits)
enum MoveFlag : int {
    FLAG_QUIET          = 0,
    FLAG_DOUBLE_PUSH    = 1,
    FLAG_KING_CASTLE    = 2,
    FLAG_QUEEN_CASTLE   = 3,
    FLAG_CAPTURE        = 4,
    FLAG_EP_CAPTURE     = 5,
    FLAG_PROMO_N        = 8,
    FLAG_PROMO_B        = 9,
    FLAG_PROMO_R        = 10,
    FLAG_PROMO_Q        = 11,
    FLAG_PROMO_CAP_N    = 12,
    FLAG_PROMO_CAP_B    = 13,
    FLAG_PROMO_CAP_R    = 14,
    FLAG_PROMO_CAP_Q    = 15
};

using Move = uint16_t;
constexpr Move MOVE_NONE = 0;

inline Move make_move(Square from, Square to, int flag = FLAG_QUIET) {
    return static_cast<Move>(from | (to << 6) | (flag << 12));
}

inline Square from_sq(Move m) {
    return static_cast<Square>(m & 0x3F);
}

inline Square to_sq(Move m) {
    return static_cast<Square>((m >> 6) & 0x3F);
}

inline int move_flag(Move m) {
    return (m >> 12) & 0x0F;
}

inline bool is_capture(Move m) {
    return (move_flag(m) & 4) != 0;
}

inline bool is_promotion(Move m) {
    return (move_flag(m) & 8) != 0;
}

inline bool is_castling(Move m) {
    int f = move_flag(m);
    return f == FLAG_KING_CASTLE || f == FLAG_QUEEN_CASTLE;
}

inline bool is_en_passant(Move m) {
    return move_flag(m) == FLAG_EP_CAPTURE;
}

inline PieceType promotion_piece_type(Move m) {
    return static_cast<PieceType>(((move_flag(m) & 3) + 1));
}

inline std::string square_to_string(Square s) {
    if (s < SQ_A1 || s > SQ_H8) return "-";
    std::string str;
    str += static_cast<char>('a' + file_of(s));
    str += static_cast<char>('1' + rank_of(s));
    return str;
}

inline Square string_to_square(const std::string& str) {
    if (str.length() < 2) return SQ_NONE;
    int f = str[0] - 'a';
    int r = str[1] - '1';
    if (f < 0 || f > 7 || r < 0 || r > 7) return SQ_NONE;
    return make_square(static_cast<File>(f), static_cast<Rank>(r));
}

inline std::string move_to_string(Move m) {
    if (m == MOVE_NONE) return "0000";
    std::string s = square_to_string(from_sq(m)) + square_to_string(to_sq(m));
    if (is_promotion(m)) {
        switch (promotion_piece_type(m)) {
            case KNIGHT: s += 'n'; break;
            case BISHOP: s += 'b'; break;
            case ROOK:   s += 'r'; break;
            case QUEEN:  s += 'q'; break;
            default: break;
        }
    }
    return s;
}

// Evaluation Constants
using Value = int;
constexpr Value VALUE_ZERO = 0;
constexpr Value VALUE_DRAW = 0;
constexpr Value VALUE_MATE = 30000;
constexpr Value VALUE_MATE_IN_MAX_PLY = 30000 - 256;
constexpr Value VALUE_INF = 32000;

constexpr int SeePieceValues[7] = { 100, 300, 300, 500, 900, 10000, 0 };
