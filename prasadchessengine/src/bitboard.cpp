#include "bitboard.h"
#include <iostream>
#include <algorithm>

Bitboard SquareBB[64];
Bitboard FileBB[8];
Bitboard RankBB[8];

Bitboard PawnAttacks[COLOR_NB][64];
Bitboard KnightAttacks[64];
Bitboard KingAttacks[64];

Bitboard BetweenBB[64][64];
Bitboard LineBB[64][64];

void print_bitboard(Bitboard b) {
    std::cout << "\n";
    for (int r = 7; r >= 0; --r) {
        std::cout << (r + 1) << " ";
        for (int f = 0; f < 8; ++f) {
            Square sq = make_square(static_cast<File>(f), static_cast<Rank>(r));
            std::cout << (test_bit(b, sq) ? " 1" : " .");
        }
        std::cout << "\n";
    }
    std::cout << "    a b c d e f g h\n";
    std::cout << "Bitboard: 0x" << std::hex << b << std::dec << "\n\n";
}

void init_bitboards() {
    // 1. Initialize SquareBB, FileBB, RankBB
    for (int sq = 0; sq < 64; ++sq) {
        SquareBB[sq] = 1ULL << sq;
    }

    for (int f = 0; f < 8; ++f) {
        FileBB[f] = 0;
        for (int r = 0; r < 8; ++r) {
            FileBB[f] |= SquareBB[make_square(static_cast<File>(f), static_cast<Rank>(r))];
        }
    }

    for (int r = 0; r < 8; ++r) {
        RankBB[r] = 0;
        for (int f = 0; f < 8; ++f) {
            RankBB[r] |= SquareBB[make_square(static_cast<File>(f), static_cast<Rank>(r))];
        }
    }

    // 2. Knight Attacks
    const int knight_deltas[8][2] = {
        {-2, -1}, {-2, 1}, {-1, -2}, {-1, 2},
        {1, -2},  {1, 2},  {2, -1},  {2, 1}
    };
    for (int sq = 0; sq < 64; ++sq) {
        KnightAttacks[sq] = 0;
        int r = rank_of(static_cast<Square>(sq));
        int f = file_of(static_cast<Square>(sq));
        for (auto& d : knight_deltas) {
            int nr = r + d[0];
            int nf = f + d[1];
            if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
                KnightAttacks[sq] |= SquareBB[make_square(static_cast<File>(nf), static_cast<Rank>(nr))];
            }
        }
    }

    // 3. King Attacks
    const int king_deltas[8][2] = {
        {-1, -1}, {-1, 0}, {-1, 1},
        { 0, -1},          { 0, 1},
        { 1, -1}, { 1, 0}, { 1, 1}
    };
    for (int sq = 0; sq < 64; ++sq) {
        KingAttacks[sq] = 0;
        int r = rank_of(static_cast<Square>(sq));
        int f = file_of(static_cast<Square>(sq));
        for (auto& d : king_deltas) {
            int nr = r + d[0];
            int nf = f + d[1];
            if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
                KingAttacks[sq] |= SquareBB[make_square(static_cast<File>(nf), static_cast<Rank>(nr))];
            }
        }
    }

    // 4. Pawn Attacks
    for (int sq = 0; sq < 64; ++sq) {
        PawnAttacks[WHITE][sq] = 0;
        PawnAttacks[BLACK][sq] = 0;
        int r = rank_of(static_cast<Square>(sq));
        int f = file_of(static_cast<Square>(sq));

        // White captures up-left (f-1, r+1) and up-right (f+1, r+1)
        if (r < 7) {
            if (f > 0) PawnAttacks[WHITE][sq] |= SquareBB[make_square(static_cast<File>(f - 1), static_cast<Rank>(r + 1))];
            if (f < 7) PawnAttacks[WHITE][sq] |= SquareBB[make_square(static_cast<File>(f + 1), static_cast<Rank>(r + 1))];
        }
        // Black captures down-left (f-1, r-1) and down-right (f+1, r-1)
        if (r > 0) {
            if (f > 0) PawnAttacks[BLACK][sq] |= SquareBB[make_square(static_cast<File>(f - 1), static_cast<Rank>(r - 1))];
            if (f < 7) PawnAttacks[BLACK][sq] |= SquareBB[make_square(static_cast<File>(f + 1), static_cast<Rank>(r - 1))];
        }
    }

    // 5. BetweenBB and LineBB
    for (int s1 = 0; s1 < 64; ++s1) {
        for (int s2 = 0; s2 < 64; ++s2) {
            BetweenBB[s1][s2] = 0;
            LineBB[s1][s2] = 0;
        }
    }

    for (int s1 = 0; s1 < 64; ++s1) {
        int r1 = rank_of(static_cast<Square>(s1));
        int f1 = file_of(static_cast<Square>(s1));

        for (int s2 = 0; s2 < 64; ++s2) {
            if (s1 == s2) continue;
            int r2 = rank_of(static_cast<Square>(s2));
            int f2 = file_of(static_cast<Square>(s2));

            int dr = r2 - r1;
            int df = f2 - f1;

            int step_r = (dr == 0) ? 0 : (dr > 0 ? 1 : -1);
            int step_f = (df == 0) ? 0 : (df > 0 ? 1 : -1);

            // Check if they align along rank, file, or diagonal
            if (dr == 0 || df == 0 || std::abs(dr) == std::abs(df)) {
                // Calculate BetweenBB
                int cr = r1 + step_r;
                int cf = f1 + step_f;
                while (cr != r2 || cf != f2) {
                    BetweenBB[s1][s2] |= SquareBB[make_square(static_cast<File>(cf), static_cast<Rank>(cr))];
                    cr += step_r;
                    cf += step_f;
                }

                // Calculate LineBB (full ray extending both ways)
                LineBB[s1][s2] |= SquareBB[s1] | SquareBB[s2] | BetweenBB[s1][s2];
                // Extend in positive direction
                cr = r2 + step_r;
                cf = f2 + step_f;
                while (cr >= 0 && cr < 8 && cf >= 0 && cf < 8) {
                    LineBB[s1][s2] |= SquareBB[make_square(static_cast<File>(cf), static_cast<Rank>(cr))];
                    cr += step_r;
                    cf += step_f;
                }
                // Extend in negative direction
                cr = r1 - step_r;
                cf = f1 - step_f;
                while (cr >= 0 && cr < 8 && cf >= 0 && cf < 8) {
                    LineBB[s1][s2] |= SquareBB[make_square(static_cast<File>(cf), static_cast<Rank>(cr))];
                    cr -= step_r;
                    cf -= step_f;
                }
            }
        }
    }
}
