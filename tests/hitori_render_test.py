# -*- coding: utf-8 -*-
"""hitori.html の描画検証。ローカルHTTPサーバを立てて Playwright で確認する。

file:// では fetch が CORS で落ちるため、必ず HTTP で配信すること。
"""
import sys, threading, functools, http.server, socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8899
BASE = f"http://127.0.0.1:{PORT}/hitori.html"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def test_overview(page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert not errors, f"JSエラー: {errors}"

    # 47県すべてが描かれている
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, f"県パスが {n} 件"

    # 塗り分けが効いている（全部同じ色ではない）
    fills = page.eval_on_selector_all(
        "#map path[data-code]", "els => [...new Set(els.map(e => e.getAttribute('fill')))]")
    assert len(fills) >= 3, f"塗り色が {len(fills)} 種しかない: {fills}"

    # ランキングが10件
    rank = page.eval_on_selector_all("#ranking li", "els => els.length")
    assert rank == 10, f"ランキングが {rank} 件"

    # 出典と免責が出ている
    body = page.inner_text("body")
    for needle in ["地球地図日本", "OpenStreetMap", "機械的に推定"]:
        assert needle in body, f"'{needle}' が表示されていない"

    # チェーンフィルタの文言。「個人店だけ」と書いてはいけない
    assert "チェーンを隠す" in body
    assert "個人店だけ" not in body


def test_chain_toggle_changes_map(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    before = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    page.click("#f-nochain")
    page.wait_for_timeout(300)
    after = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    assert before != after, "チェーンを隠しても塗り分けが変わらない"
    assert "nochain=1" in page.evaluate("location.hash")


def test_category_filter_changes_map(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    before = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    page.click("#f-cat-bath")   # 湯だけ外す
    page.wait_for_timeout(300)
    after = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    assert before != after, "カテゴリを外しても塗り分けが変わらない"


def test_url_restore(page):
    page.goto(BASE + "#cat=bath&nochain=1")
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert page.evaluate("document.querySelector('#f-nochain').checked") is True
    assert page.evaluate("document.querySelector('#f-cat-eat').checked") is False
    assert page.evaluate("document.querySelector('#f-cat-bath').checked") is True


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            test_overview(page)
            test_chain_toggle_changes_map(page)
            test_category_filter_changes_map(page)
            test_url_restore(page)
            page.screenshot(path="C:/tmp/hitori_overview.png", full_page=True)
            browser.close()
    finally:
        httpd.shutdown()
    print("OK: render (overview) -> C:/tmp/hitori_overview.png")


if __name__ == "__main__":
    main()
