"""Chessmod - Desktop Application Entry Point.
by author PRASAD DHODAMANI

Runs full online chess sites (Chess.com, Lichess) in an embedded Edge WebView
with a live, integrated Stockfish 19 & AI Vision analysis sidebar.
"""
import os, sys, time, threading, json, traceback

# Allow custom DOM elements and disable strict TrustedTypes on protected sites
os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--disable-features=TrustedTypes"

import webview
import webview.util
from bridge import BridgeAPI

# Patch pywebview's js_bridge_call to gracefully handle page navigations during in-flight calls
_orig_js_bridge_call = webview.util.js_bridge_call

def patched_js_bridge_call(window, func_name, param, value_id):
    if func_name not in ('pywebviewMoveWindow', 'pywebviewEventHandler', 'pywebviewAsyncCallback', 'pywebviewStateUpdate', 'pywebviewStateDelete'):
        func = window._functions.get(func_name) or getattr(window._js_api, func_name, None)
        if func is not None:
            def _safe_call():
                try:
                    result = func(*param)
                    res_str = json.dumps(result).replace('\\', '\\\\').replace("'", "\\'")
                    retval = f"{{value: '{res_str}'}}"
                except Exception as e:
                    err_dict = {'message': str(e), 'name': type(e).__name__, 'stack': traceback.format_exc()}
                    res_str = json.dumps(err_dict).replace('\\', '\\\\').replace("'", "\\'")
                    retval = f"{{isError: true, value: '{res_str}'}}"

                # Deliver return value to JS callback; safely ignore if page navigated away
                try:
                    window.evaluate_js(
                        f'if (window.pywebview && window.pywebview._returnValuesCallbacks && '
                        f'window.pywebview._returnValuesCallbacks["{func_name}"] && '
                        f'typeof window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"] === "function") {{ '
                        f'window.pywebview._returnValuesCallbacks["{func_name}"]["{value_id}"]({retval}); }}'
                    )
                except Exception:
                    pass

            threading.Thread(target=_safe_call, daemon=True).start()
            return

    return _orig_js_bridge_call(window, func_name, param, value_id)

webview.util.js_bridge_call = patched_js_bridge_call

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(HERE, "assets")

def load_asset_text(filename):
    # 1. PyInstaller bundled path
    if hasattr(sys, "_MEIPASS"):
        p_bundle = os.path.join(sys._MEIPASS, "assets", filename)
        if os.path.exists(p_bundle):
            with open(p_bundle, "r", encoding="utf-8") as f:
                return f.read()

    # 2. Local development path in src/assets
    p_local = os.path.join(ASSETS_DIR, filename)
    if os.path.exists(p_local):
        with open(p_local, "r", encoding="utf-8") as f:
            return f.read()

    # 3. Fallback in root/assets
    p_root = os.path.join(os.path.dirname(HERE), "src", "assets", filename)
    if os.path.exists(p_root):
        with open(p_root, "r", encoding="utf-8") as f:
            return f.read()

    return ""

def main():
    window_container = [None]
    def get_window():
        return window_container[0]

    api = BridgeAPI(get_window)
    sidebar_css = load_asset_text("sidebar.css")
    sidebar_js = load_asset_text("sidebar.js")

    def on_loaded():
        w = get_window()
        if w:
            try:
                # Inject sidebar CSS
                if sidebar_css:
                    w.load_css(sidebar_css)
                # Inject assistant JS
                if sidebar_js:
                    w.evaluate_js(sidebar_js)
            except Exception as e:
                print(f"[Warning] Failed to inject assets: {e}")

    default_url = "https://www.chess.com/play/computer"
    print("=" * 60)
    print("  CHESSMOD - by author PRASAD DHODAMANI")
    print("=" * 60)
    print(f"Loading: {default_url}")

    window = webview.create_window(
        title="Chessmod by author PRASAD DHODAMANI",
        url=default_url,
        js_api=api,
        width=1400,
        height=900,
        min_size=(900, 600),
        background_color="#161512"
    )
    window_container[0] = window
    window.events.loaded += on_loaded

    webview.start(private_mode=False, debug=False)

if __name__ == "__main__":
    main()
