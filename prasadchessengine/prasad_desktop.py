"""Prasad Chess Engine - Native Desktop GUI Application
Author: PRASAD DHODAMANI

True standalone desktop application powered by WebView2.
Loads offline Prasad Chess game with 250 - 3000 Elo and Lichess/Chess.com themes.
"""
import os
import sys
import webview

def get_entry_url():
    if hasattr(sys, "_MEIPASS"):
        bundle_index = os.path.join(sys._MEIPASS, "gui", "index.html")
        if os.path.exists(bundle_index):
            return "file:///" + bundle_index.replace("\\", "/")

    here = os.path.dirname(os.path.abspath(__file__))
    local_index = os.path.join(here, "gui", "index.html")
    if os.path.exists(local_index):
        return "file:///" + local_index.replace("\\", "/")

    parent_index = os.path.join(os.path.dirname(here), "gui", "index.html")
    if os.path.exists(parent_index):
        return "file:///" + parent_index.replace("\\", "/")

    return "file:///" + local_index.replace("\\", "/")

def main():
    target_url = get_entry_url()

    window = webview.create_window(
        title="Prasad Chess Engine",
        url=target_url,
        width=1180,
        height=880,
        min_size=(800, 600),
        background_color="#18191c"
    )

    webview.start(private_mode=False, debug=False)

if __name__ == "__main__":
    main()
