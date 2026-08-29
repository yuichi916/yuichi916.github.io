# -*- coding: utf-8 -*-
"""新 hitori.html の描画検証。ローカルHTTPで配信して Playwright で確認する。
file:// では ES Modules と fetch が落ちるので必ず HTTP。
pytest-playwright は入っていないので、hitori_render_test.py と同じく main() が順に呼ぶ。
実行: PYTHONUTF8=1 python tests/hitori_map_test.py
"""
import sys, threading, functools, http.server, socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8898
BASE = f"http://127.0.0.1:{PORT}/hitori.html"
SHOTS = ROOT / "tests" / "screens"
SHOTS.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


MOBILE = {"width": 390, "height": 844}
DESKTOP = {"width": 1400, "height": 900}


def _ready(page):
    page.wait_for_function("window.__ready === true", timeout=30000)


def test_home_states_the_claim_and_two_ways_in(page):
    page.set_viewport_size(MOBILE)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    _ready(page)
    body = page.inner_text("#sheet")
    assert "ひとりで入れるか、根拠つきで。" in body
    assert "確認済み" in body and "817" in body.replace(",", "")
    assert page.is_visible("#btn-locate") and page.is_visible("#btn-area")
    assert page.locator("#scenes button").count() == 4
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"横スクロール {overflow}px"
    assert not errors, errors
    page.screenshot(path=str(SHOTS / "hitori-mobile-home.png"))


def test_area_mode_lists_verified_first_without_score_dots(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.click("#btn-area")
    page.select_option("#pref", "14")
    page.wait_for_selector("#list .card", timeout=30000)
    cards = page.locator("#list .card")
    assert cards.count() >= 10
    first = cards.nth(0).inner_text()
    assert "確認済み" in first, f"先頭が確認済みでない: {first}"
    assert page.locator("#list .dots").count() == 0, "未確認に推定スコアの点線が出ている"
    assert page.locator("#list .card.unverified").count() > 0
    assert "候補" in page.locator("#list .card.unverified").first.inner_text()
    page.screenshot(path=str(SHOTS / "hitori-mobile-list.png"))


def test_category_chip_quiet_shows_museums_not_hostels(page):
    page.set_viewport_size(DESKTOP)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.click("#chips [data-cat='quiet']")
    page.wait_for_timeout(300)
    kinds = page.eval_on_selector_all("#list .card .kind", "els => els.map(e => e.textContent)")
    assert kinds and all(k in ("図書館", "博物館・美術館") for k in kinds), kinds
    page.click("#chips [data-cat='stay']")
    page.wait_for_timeout(300)
    kinds = page.eval_on_selector_all("#list .card .kind", "els => els.map(e => e.textContent)")
    assert kinds and all(k == "ホステル" for k in kinds), kinds
    page.screenshot(path=str(SHOTS / "hitori-desktop-list.png"))


def test_sheet_snaps(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    h_half = page.evaluate("document.getElementById('sheet').getBoundingClientRect().top")
    page.click("#sheet-handle")
    page.wait_for_timeout(400)
    h_full = page.evaluate("document.getElementById('sheet').getBoundingClientRect().top")
    assert h_full < h_half, "ハンドルを押してもシートが上がらない"


# テストごとに新しい context を作る（localStorage と位置情報の許可を持ち越さない）。
# 後続タスクでテスト関数を足したら、このリストにも足す。
TESTS = [
    test_home_states_the_claim_and_two_ways_in,
    test_area_mode_lists_verified_first_without_score_dots,
    test_category_chip_quiet_shows_museums_not_hostels,
    test_sheet_snaps,
]


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    failed = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for fn in TESTS:
                context = browser.new_context(viewport=MOBILE)
                page = context.new_page()
                try:
                    params = fn.__code__.co_varnames[:fn.__code__.co_argcount]
                    fn(**{k: {"page": page, "context": context, "browser": browser}[k] for k in params})
                    print("ok", fn.__name__)
                except Exception as e:  # 1件落ちても残りを回す
                    failed.append(fn.__name__)
                    print("FAIL", fn.__name__, repr(e))
                finally:
                    context.close()
            browser.close()
    finally:
        httpd.shutdown()
    if failed:
        print(f"{len(failed)} failed: {failed}")
        sys.exit(1)
    print(f"OK: hitori map ({len(TESTS)} tests) -> {SHOTS}")


if __name__ == "__main__":
    main()
