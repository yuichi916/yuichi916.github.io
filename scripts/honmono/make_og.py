"""どっちが本物？: OGP 画像（1200x630）を _dev/honmono/og.html から書き出す。

使い方:  python scripts/honmono/make_og.py
出力:    assets/og/honmono-1200x630.jpg
"""
from __future__ import annotations

import http.server
import socketserver
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "og" / "honmono-1200x630.jpg"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main() -> None:
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            page = b.new_page(viewport={"width": 1200, "height": 630})
            page.goto(f"http://127.0.0.1:{srv.server_address[1]}/_dev/honmono/og.html", wait_until="networkidle")
            page.wait_for_selector("body[data-ready='1']")
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT), type="jpeg", quality=90)
            b.close()
    finally:
        srv.shutdown()
    print("wrote", OUT.relative_to(ROOT), OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
