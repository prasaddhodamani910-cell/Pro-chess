"""Bridge between WebView2 JavaScript and Python Backend."""
import base64
import cv2
import numpy as np
from engine import ChessEngine
from board_detector import crop_board
from vision import recognize_board_image, grid_to_fen


class BridgeAPI:
    def __init__(self, window_getter):
        self._get_window = window_getter
        self.engine = ChessEngine()

    def get_status(self):
        return {
            "engine_name": self.engine.name,
            "engine_available": self.engine.available,
            "engine_path": self.engine.path
        }

    def analyze_fen(self, fen, turn="w", think=2):
        """Analyze a FEN string using Stockfish."""
        if not fen or not isinstance(fen, str):
            return {"ok": False, "error": "No FEN provided"}
        return self.engine.analyze(fen.strip(), think=think, turn=turn)

    def analyze_base64_image(self, b64_str, turn="w", think=2):
        """Analyze a screenshot of the board using AI Vision + Stockfish."""
        try:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return {"ok": False, "error": "Failed to decode image data"}

            board = crop_board(img)
            if board is None:
                board = img  # Assume image itself is the cropped board

            grid, conf = recognize_board_image(board)
            fen = grid_to_fen(grid, turn=turn)
            res = self.engine.analyze(fen, think=think, turn=turn)
            res["confidence"] = round(conf * 100, 1)
            return res
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def navigate(self, url):
        """Navigate WebView to another URL (e.g. Chess.com, Lichess)."""
        win = self._get_window()
        if win:
            if not url.startswith("http://") and not url.startswith("https://"):
                url = "https://" + url
            win.load_url(url)
            return {"ok": True, "url": url}
        return {"ok": False, "error": "Window not ready"}
