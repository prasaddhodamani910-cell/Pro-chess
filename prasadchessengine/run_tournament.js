/**
 * 26-Match Tournament: PrasadChessEngine (3000 Elo) vs Stockfish 19 (Level 20)
 * Time Control: Exactly 1.6 seconds per move (movetime 1600)
 * Colors: Alternating colors each game
 * Output: matches_26_prasad_vs_stockfish.md
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_DIR = 'C:/Projects by Prasad/chessproject/prasadchessengine';
const STOCKFISH_EXE = 'C:/Projects by Prasad/chessproject/bin/stockfish.exe';
const PRASAD_EXE = 'C:/Projects by Prasad/chessproject/prasadchessengine/prasadchessengine.exe';
const OUTPUT_MD = path.join(PROJECT_DIR, 'matches_26_prasad_vs_stockfish.md');
const CHECKPOINT_FILE = path.join(PROJECT_DIR, 'tournament_checkpoint.json');

// Load Chess Rules Engine
const rulesCode = fs.readFileSync(path.join(PROJECT_DIR, 'gui/chess_rules.js'), 'utf8');
const rulesModule = { exports: {} };
const rulesFn = new Function('module', 'exports', rulesCode + '\nmodule.exports = { ChessGame, WHITE, BLACK, EMPTY };');
rulesFn(rulesModule, rulesModule.exports);
const { ChessGame, WHITE, BLACK, EMPTY } = rulesModule.exports;

function findLegalMove(game, uci) {
    if (!uci || uci.length < 4) return null;
    const fromStr = uci.substring(0, 2);
    const toStr = uci.substring(2, 4);
    const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
    const from = game.stringToSquare(fromStr);
    const to = game.stringToSquare(toStr);
    const legal = game.getLegalMoves();
    return legal.find(m => m.from === from && m.to === to && (!promo || m.promo === promo));
}

class UciEngine {
    constructor(exePath, name, options = []) {
        this.exePath = exePath;
        this.name = name;
        this.options = options;
        this.proc = null;
        this.buffer = '';
    }

    start() {
        this.proc = spawn(this.exePath);
        this.proc.stdout.on('data', (d) => {
            this.buffer += d.toString();
        });
        this.send('uci');
        for (const opt of this.options) {
            this.send(opt);
        }
    }

    send(cmd) {
        if (this.proc && this.proc.stdin.writable) {
            this.proc.stdin.write(cmd + '\n');
        }
    }

    async waitReady() {
        return new Promise((resolve) => {
            this.send('isready');
            const interval = setInterval(() => {
                if (this.buffer.includes('readyok')) {
                    clearInterval(interval);
                    this.buffer = this.buffer.substring(this.buffer.indexOf('readyok') + 7);
                    resolve();
                }
            }, 5);
        });
    }

    async searchMove(posCmd, moveTimeMs = 1600) {
        this.buffer = '';
        this.send(posCmd);
        const t0 = Date.now();
        this.send(`go movetime ${moveTimeMs}`);

        return new Promise((resolve) => {
            let lastScore = '0.00';
            const interval = setInterval(() => {
                const lines = this.buffer.split('\n');
                for (const line of lines) {
                    const cpMatch = line.match(/score cp (-?\d+)/);
                    if (cpMatch) {
                        const cp = parseInt(cpMatch[1], 10);
                        lastScore = (cp / 100).toFixed(2);
                        if (cp > 0 && !lastScore.startsWith('+')) lastScore = '+' + lastScore;
                    }
                    const mateMatch = line.match(/score mate (-?\d+)/);
                    if (mateMatch) {
                        const m = parseInt(mateMatch[1], 10);
                        lastScore = `Mate in ${m}`;
                    }
                }

                const bmMatch = this.buffer.match(/bestmove\s+(\S+)/);
                if (bmMatch) {
                    const t1 = Date.now();
                    clearInterval(interval);
                    const move = bmMatch[1];
                    this.buffer = '';
                    resolve({
                        move,
                        timeMs: t1 - t0,
                        eval: lastScore
                    });
                }
            }, 5);
        });
    }

    stop() {
        try {
            this.send('quit');
            this.proc.kill();
        } catch(e) {}
    }
}

async function playSingleMatch(gameNum, whiteIsPrasad) {
    const whiteName = whiteIsPrasad ? 'PrasadChess (3000 Elo)' : 'Stockfish 19 (Level 20)';
    const blackName = whiteIsPrasad ? 'Stockfish 19 (Level 20)' : 'PrasadChess (3000 Elo)';

    const prasadOpts = [
        'setoption name UCI_LimitStrength value true',
        'setoption name UCI_Elo value 3000',
        'setoption name Hash value 32'
    ];
    const sfOpts = [
        'setoption name Skill Level value 20',
        'setoption name Threads value 1',
        'setoption name Hash value 32'
    ];

    const prasadEngine = new UciEngine(PRASAD_EXE, 'PrasadChess', prasadOpts);
    const sfEngine = new UciEngine(STOCKFISH_EXE, 'Stockfish', sfOpts);

    prasadEngine.start();
    sfEngine.start();
    await prasadEngine.waitReady();
    await sfEngine.waitReady();

    prasadEngine.send('ucinewgame');
    sfEngine.send('ucinewgame');
    await prasadEngine.waitReady();
    await sfEngine.waitReady();

    const game = new ChessGame();
    const uciMoves = [];
    const moveRecords = [];

    let result = '*';
    let termination = 'Ongoing';
    let ply = 0;

    let hopelessCount = 0;

    while (ply < 240) { // Max 120 full moves
        const isWhiteTurn = (game.side === WHITE);
        const engine = isWhiteTurn ? (whiteIsPrasad ? prasadEngine : sfEngine) : (whiteIsPrasad ? sfEngine : prasadEngine);
        const playerName = isWhiteTurn ? whiteName : blackName;

        const overStatus = game.isGameOver();
        if (overStatus.over) {
            result = overStatus.result;
            termination = overStatus.reason;
            break;
        }

        const posCmd = 'position startpos' + (uciMoves.length ? ' moves ' + uciMoves.join(' ') : '');
        const searchRes = await engine.searchMove(posCmd, 1600);

        if (!searchRes.move || searchRes.move === '(none)' || searchRes.move === '0000') {
            result = isWhiteTurn ? '0-1' : '1-0';
            termination = 'Forfeit / No Move';
            break;
        }

        const legalMove = findLegalMove(game, searchRes.move);
        if (!legalMove) {
            console.error(`[Game ${gameNum}] ILLEGAL MOVE: ${searchRes.move} by ${playerName}`);
            result = isWhiteTurn ? '0-1' : '1-0';
            termination = 'Illegal Move (' + searchRes.move + ')';
            break;
        }

        const san = game.moveToSan(legalMove);
        game.makeMove(legalMove);
        uciMoves.push(searchRes.move);
        ply++;

        const moveRecord = {
            ply,
            moveNum: Math.floor((ply - 1) / 2) + 1,
            isWhite: isWhiteTurn,
            player: playerName,
            uci: searchRes.move,
            san,
            timeMs: searchRes.timeMs,
            eval: searchRes.eval,
            fen: game.getFen()
        };
        moveRecords.push(moveRecord);

        // Check resignation threshold
        if (searchRes.eval.includes('Mate in -1') || searchRes.eval.includes('Mate in -2')) {
            hopelessCount++;
            if (hopelessCount >= 2) {
                result = isWhiteTurn ? '0-1' : '1-0';
                termination = 'Resignation';
                break;
            }
        } else if (searchRes.eval.startsWith('-') && parseFloat(searchRes.eval) <= -15.0 && ply > 60) {
            hopelessCount++;
            if (hopelessCount >= 4) {
                result = isWhiteTurn ? '0-1' : '1-0';
                termination = 'Resignation';
                break;
            }
        } else {
            hopelessCount = 0;
        }

        const postOverStatus = game.isGameOver();
        if (postOverStatus.over) {
            result = postOverStatus.result;
            termination = postOverStatus.reason;
            break;
        }
    }

    if (result === '*' && ply >= 240) {
        result = '1/2-1/2';
        termination = 'Move Limit (120 moves)';
    }

    prasadEngine.stop();
    sfEngine.stop();

    // Compute statistics
    let whiteTotalTime = 0;
    let blackTotalTime = 0;
    let whiteMoveCount = 0;
    let blackMoveCount = 0;

    for (const m of moveRecords) {
        if (m.isWhite) {
            whiteTotalTime += m.timeMs;
            whiteMoveCount++;
        } else {
            blackTotalTime += m.timeMs;
            blackMoveCount++;
        }
    }

    // Build PGN
    let pgn = `[Event "PrasadChess vs Stockfish Tournament"]\n`;
    pgn += `[Site "Local PC"]\n`;
    pgn += `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]\n`;
    pgn += `[Round "${gameNum}"]\n`;
    pgn += `[White "${whiteName}"]\n`;
    pgn += `[Black "${blackName}"]\n`;
    pgn += `[Result "${result}"]\n`;
    pgn += `[Termination "${termination}"]\n`;
    pgn += `[TimeControl "1.6s/move"]\n\n`;

    let pgnBody = '';
    for (let i = 0; i < moveRecords.length; i += 2) {
        const w = moveRecords[i];
        const b = moveRecords[i + 1];
        pgnBody += `${w.moveNum}. ${w.san} {[%emt ${(w.timeMs / 1000).toFixed(2)}]} `;
        if (b) {
            pgnBody += `${b.san} {[%emt ${(b.timeMs / 1000).toFixed(2)}]} `;
        }
    }
    pgnBody += result;
    pgn += pgnBody;

    return {
        gameNum,
        whiteName,
        blackName,
        whiteIsPrasad,
        result,
        termination,
        totalPlies: ply,
        totalFullMoves: Math.ceil(ply / 2),
        whiteTotalTimeMs: whiteTotalTime,
        blackTotalTimeMs: blackTotalTime,
        whiteAvgTimeMs: whiteMoveCount ? Math.round(whiteTotalTime / whiteMoveCount) : 0,
        blackAvgTimeMs: blackMoveCount ? Math.round(blackTotalTime / blackMoveCount) : 0,
        moves: moveRecords,
        pgn
    };
}

function generateMarkdown(results) {
    let md = `# PrasadChess (3000 Elo) vs Stockfish 19 (Level 20) — 26 Match Tournament\n\n`;
    md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n`;
    md += `**Time Control:** Exactly 1.6 Seconds Per Move (\`movetime 1600\`)\n`;
    md += `**Format:** 26 Games, Alternating Colours Every Match\n`;
    md += `**Engines:**\n`;
    md += `- **PrasadChessEngine**: 3000 Elo (\`UCI_LimitStrength=true\`, \`UCI_Elo=3000\`, 32MB Hash)\n`;
    md += `- **Stockfish 19**: Maximum Level 20 (\`Skill Level=20\`, 1 Thread, 32MB Hash)\n\n`;

    // Calculate tournament scores
    let prasadScore = 0;
    let sfScore = 0;
    let prasadWins = 0;
    let sfWins = 0;
    let draws = 0;

    let totalMoves = 0;
    let totalTimePrasad = 0;
    let totalTimeSf = 0;
    let prasadMovesCount = 0;
    let sfMovesCount = 0;

    for (const r of results) {
        totalMoves += r.totalFullMoves;
        if (r.whiteIsPrasad) {
            totalTimePrasad += r.whiteTotalTimeMs;
            totalTimeSf += r.blackTotalTimeMs;
            prasadMovesCount += Math.ceil(r.totalPlies / 2);
            sfMovesCount += Math.floor(r.totalPlies / 2);

            if (r.result === '1-0') { prasadScore += 1; prasadWins++; }
            else if (r.result === '0-1') { sfScore += 1; sfWins++; }
            else { prasadScore += 0.5; sfScore += 0.5; draws++; }
        } else {
            totalTimeSf += r.whiteTotalTimeMs;
            totalTimePrasad += r.blackTotalTimeMs;
            sfMovesCount += Math.ceil(r.totalPlies / 2);
            prasadMovesCount += Math.floor(r.totalPlies / 2);

            if (r.result === '1-0') { sfScore += 1; sfWins++; }
            else if (r.result === '0-1') { prasadScore += 1; prasadWins++; }
            else { prasadScore += 0.5; sfScore += 0.5; draws++; }
        }
    }

    md += `## 🏆 Final Tournament Standings\n\n`;
    md += `| Engine | Score | Record (W-L-D) | Win Rate | Avg Move Time |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: |\n`;
    md += `| **Stockfish 19 (Level 20)** | **${sfScore} / 26** | ${sfWins}W - ${prasadWins}L - ${draws}D | ${((sfScore / 26) * 100).toFixed(1)}% | ${(totalTimeSf / sfMovesCount / 1000).toFixed(2)}s |\n`;
    md += `| **PrasadChess (3000 Elo)** | **${prasadScore} / 26** | ${prasadWins}W - ${sfWins}L - ${draws}D | ${((prasadScore / 26) * 100).toFixed(1)}% | ${(totalTimePrasad / prasadMovesCount / 1000).toFixed(2)}s |\n\n`;

    md += `## 📋 Tournament Cross-Table (26 Matches)\n\n`;
    md += `| Game | White | Black | Result | Total Moves | White Avg (s) | Black Avg (s) | Termination |\n`;
    md += `| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n`;

    for (const r of results) {
        md += `| **Game ${r.gameNum}** | ${r.whiteName} | ${r.blackName} | **${r.result}** | ${r.totalFullMoves} | ${(r.whiteAvgTimeMs / 1000).toFixed(2)}s | ${(r.blackAvgTimeMs / 1000).toFixed(2)}s | ${r.termination} |\n`;
    }
    md += `\n---\n\n`;

    // Detailed Game-by-Game Section
    md += `## ♟️ Complete Move-by-Move Game Records\n\n`;

    for (const r of results) {
        md += `### Game ${r.gameNum}: ${r.whiteName} vs ${r.blackName}\n\n`;
        md += `- **Result:** \`${r.result}\` (${r.termination})\n`;
        md += `- **Total Moves:** ${r.totalFullMoves} (${r.totalPlies} plies)\n`;
        md += `- **White Time Taken:** ${(r.whiteTotalTimeMs / 1000).toFixed(2)}s (Average: ${(r.whiteAvgTimeMs / 1000).toFixed(2)}s/move)\n`;
        md += `- **Black Time Taken:** ${(r.blackTotalTimeMs / 1000).toFixed(2)}s (Average: ${(r.blackAvgTimeMs / 1000).toFixed(2)}s/move)\n\n`;

        md += `#### Moves & Response Times\n\n`;
        md += `| Move | White Move | UCI | White Time | White Eval | Black Move | UCI | Black Time | Black Eval |\n`;
        md += `| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

        for (let i = 0; i < r.moves.length; i += 2) {
            const w = r.moves[i];
            const b = r.moves[i + 1];
            const moveNum = w.moveNum;
            const wTime = (w.timeMs / 1000).toFixed(2) + 's';
            const bTime = b ? (b.timeMs / 1000).toFixed(2) + 's' : '-';
            const bSan = b ? b.san : '-';
            const bUci = b ? b.uci : '-';
            const bEval = b ? b.eval : '-';

            md += `| ${moveNum} | **${w.san}** | \`${w.uci}\` | ${wTime} | ${w.eval} | **${bSan}** | \`${bUci}\` | ${bTime} | ${bEval} |\n`;
        }
        md += `\n`;

        md += `#### PGN Record\n\n`;
        md += `\`\`\`pgn\n${r.pgn}\n\`\`\`\n\n`;
        md += `---\n\n`;
    }

    return md;
}

async function main() {
    console.log("================================================================");
    console.log("  PRASADCHESS (3000 Elo) vs STOCKFISH 19 (Level 20) TOURNAMENT  ");
    console.log("  Matches: 26 | Time Control: Exactly 1.6s per move            ");
    console.log("================================================================\n");

    const TOTAL_GAMES = 26;
    const CONCURRENCY = 4; // 4 concurrent games on 16-thread CPU
    const results = new Array(TOTAL_GAMES);

    // Prepare match configurations
    const tasks = [];
    for (let i = 1; i <= TOTAL_GAMES; i++) {
        // Alternating: odd games White=Prasad, even games White=Stockfish
        const whiteIsPrasad = (i % 2 !== 0);
        tasks.push({ gameNum: i, whiteIsPrasad });
    }

    let currentIndex = 0;
    let completedCount = 0;

    async function worker(workerId) {
        while (currentIndex < tasks.length) {
            const task = tasks[currentIndex++];
            console.log(`[Worker ${workerId}] Starting Game ${task.gameNum}/26: ${task.whiteIsPrasad ? 'Prasad (White) vs Stockfish (Black)' : 'Stockfish (White) vs Prasad (Black)'}...`);
            const startTime = Date.now();
            try {
                const res = await playSingleMatch(task.gameNum, task.whiteIsPrasad);
                results[task.gameNum - 1] = res;
                completedCount++;
                const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[Worker ${workerId}] [DONE ${completedCount}/${TOTAL_GAMES}] Game ${task.gameNum}: ${res.result} (${res.termination}) in ${res.totalFullMoves} moves [${elapsedSec}s]`);

                // Save checkpoint
                fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(results.filter(Boolean), null, 2));

                // Also update markdown incrementally
                const partialMd = generateMarkdown(results.filter(Boolean));
                fs.writeFileSync(OUTPUT_MD, partialMd);
            } catch (err) {
                console.error(`[Worker ${workerId}] ERROR in Game ${task.gameNum}:`, err);
            }
        }
    }

    const workers = [];
    for (let w = 1; w <= CONCURRENCY; w++) {
        workers.push(worker(w));
    }

    await Promise.all(workers);

    console.log("\n================================================================");
    console.log(`[SUCCESS] All 26 matches completed!`);
    console.log(`[+] Final Markdown Report: ${OUTPUT_MD}`);
    console.log("================================================================\n");

    const finalMd = generateMarkdown(results);
    fs.writeFileSync(OUTPUT_MD, finalMd);
}

main().catch(console.error);
