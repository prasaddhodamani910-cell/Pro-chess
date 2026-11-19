"""Stockfish 19 UCI Engine Manager."""
import os, sys, shutil
import chess, chess.engine, chess.svg

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(HERE)


def get_stockfish_path():
    """Find Stockfish executable, handling PyInstaller bundle and local folders."""
    # 1. PyInstaller temporary folder
    if hasattr(sys, "_MEIPASS"):
        meipass_sf = os.path.join(sys._MEIPASS, "bin", "stockfish.exe")
        if os.path.exists(meipass_sf):
            return meipass_sf

    # 2. desktop_app/bin folder
    bin_sf = os.path.join(APP_ROOT, "bin", "stockfish.exe")
    if os.path.exists(bin_sf):
        return bin_sf

    # 3. Environment variable
    env_sf = os.environ.get("STOCKFISH_PATH")
    if env_sf and os.path.exists(env_sf):
        return env_sf

    # 4. PATH lookup
    for name in ("stockfish.exe", "stockfish"):
        p = shutil.which(name)
        if p:
            return p

    return "stockfish"


class ChessEngine:
    def __init__(self):
        self.path = get_stockfish_path()
        self.name = "Stockfish 19"
        self.available = os.path.exists(self.path) or shutil.which(self.path) is not None

    def analyze(self, fen, think=2, turn="w"):
        """Evaluate a position and return best move, evaluation, and SVG preview."""
        try:
            b = chess.Board(fen)
        except Exception as e:
            return {"ok": False, "error": f"Invalid FEN: {e}"}

        if not b.is_valid():
            return {"ok": False, "error": "Invalid board position (check piece placement)"}

        best_move_san = None
        best_move_uci = None
        score_str = "0.00"
        svg_code = None

        if self.available:
            try:
                engine = chess.engine.SimpleEngine.popen_uci(self.path)
                try:
                    info = engine.analyse(b, chess.engine.Limit(time=max(0.5, float(think))))
                    if info.get("pv"):
                        m = info["pv"][0]
                        best_move_san = b.san(m)
                        best_move_uci = m.uci()
                    score = info.get("score")
                    if score:
                        score_pov = score.pov(b.turn)
                        if score_pov.is_mate():
                            score_str = f"M{score_pov.mate()}"
                        else:
                            cp = score_pov.score()
                            score_str = f"{cp/100:+.2f}"
                finally:
                    engine.quit()
            except Exception as e:
                return {
                    "ok": True,
                    "fen": fen,
                    "warning": f"Engine execution note: {e}",
                    "best_move": None,
                    "score": None,
                    "svg": self._generate_svg(b, None, turn)
                }

        svg_code = self._generate_svg(b, best_move_san, turn)
        return {
            "ok": True,
            "fen": fen,
            "best_move": best_move_san,
            "best_move_uci": best_move_uci,
            "score": score_str,
            "svg": svg_code,
            "turn": "White" if b.turn == chess.WHITE else "Black"
        }

    def _generate_svg(self, board, best_move_san, turn):
        try:
            arrows = []
            if best_move_san:
                try:
                    m = board.parse_san(best_move_san)
                    arrows = [chess.svg.Arrow(m.from_square, m.to_square, color="#2e8b57dd")]
                except Exception:
                    pass
            flipped = (turn.lower() == "b") or (board.turn == chess.BLACK and turn.lower() == "auto")
            return chess.svg.board(board, size=280, arrows=arrows, flipped=flipped)
        except Exception:
            return None
