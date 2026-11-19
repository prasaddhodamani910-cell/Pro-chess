cmake_minimum_required(VERSION 3.15)
project(PrasadChessEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SOURCES
    src/main.cpp
    src/bitboard.cpp
    src/magic.cpp
    src/zobrist.cpp
    src/board.cpp
    src/movegen.cpp
    src/perft.cpp
    src/evaluate.cpp
    src/tt.cpp
    src/timeman.cpp
    src/search.cpp
    src/uci.cpp
)

add_executable(prasadchessengine ${SOURCES})

target_include_directories(prasadchessengine PRIVATE src)

if (MSVC)
    target_compile_options(prasadchessengine PRIVATE /O2 /Oi /Ot /EHsc /W3)
else()
    target_compile_options(prasadchessengine PRIVATE -O3 -march=native -Wall)
endif()
