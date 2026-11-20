"""きょうの県: OGP 画像（1200x630）を _dev/kyou-no-ken/og.html から書き出す。

使い方:  python scripts/kyou_no_ken/make_og.py
出力:    assets/og/kyou-no-ken-1200x630.jpg（ゲーム）
         assets/og/kyou-no-ken-omoikomi-1200x630.jpg（みんなの思い込み地図）
"""
from __future__ import annotations

import http.server
import socketserver
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUTS = {"game": ROOT / "assets" / "og" / "kyou-no-ken-1200x630.jpg",
        "omoi": ROOT / "assets" / "og" / "kyou-no-ken-omoikomi-1200x630.jpg"}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main() -> None:
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for v, out in OUTS.items():
                page = b.new_page(viewport={"width": 1200, "height": 630})
                page.goto(f"http://127.0.0.1:{srv.server_address[1]}/_dev/kyou-no-ken/og.html?v={v}", wait_until="networkidle")
                page.wait_for_selector("body[data-ready='1']")
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(300)
                page.screenshot(path=str(out), type="jpeg", quality=90)
                page.close()
                print("wrote", out.relative_to(ROOT), out.stat().st_size, "bytes")
            b.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
