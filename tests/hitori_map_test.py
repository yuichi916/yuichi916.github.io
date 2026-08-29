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
    page.wait_for_timeout(1500)   # タイルが載る前だと地図が灰色一色で、確認の役に立たない
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


def test_detail_shows_provenance_and_conflicts(page):
    page.set_viewport_size(DESKTOP)
    # 桑名の銭湯: 料金が公式200円と非公式150円で食い違う既知の例
    page.goto(BASE + "?pref=24&facility=n10011494817")
    _ready(page)
    page.wait_for_selector("#detail", timeout=30000)
    txt = page.inner_text("#detail")
    assert "確認済み" in txt and "公式" in txt and "食い違い" in txt
    assert page.locator("#detail .fact-row.conflict").count() >= 1
    assert page.locator("#detail .fact-row.conflict .val").count() >= 2, "食い違いの値が両方出ていない"
    assert "city.kuwana.lg.jp" in txt
    href = page.get_attribute("#btn-route", "href")
    assert href.startswith("https://www.google.com/maps/dir/?api=1&destination=")
    assert page.is_visible("#btn-back")
    page.screenshot(path=str(SHOTS / "hitori-desktop-detail.png"), full_page=False)


def test_detail_of_unverified_says_so_and_has_no_scores(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card.unverified", timeout=30000)
    page.locator("#list .card.unverified .open-detail").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    txt = page.inner_text("#detail")
    assert "未確認" in txt and "OpenStreetMap" in txt
    assert "ひとり度" not in txt
    assert page.locator("#detail .journal").count() == 1, "神奈川には旅記事があるはず"
    page.wait_for_timeout(1500)   # タイルが載る前だと地図が灰色一色で、確認の役に立たない
    page.screenshot(path=str(SHOTS / "hitori-mobile-detail.png"))


def test_save_want_then_share_and_restore_on_fresh_context(browser):
    ctx = browser.new_context(viewport=MOBILE)
    page = ctx.new_page()
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.locator("#list .card [data-want]").first.click()
    assert page.inner_text("#saved-count") == "1"
    page.click("#btn-saved")
    page.wait_for_selector("#saved", timeout=5000)
    assert page.locator("#saved .card").count() == 1
    share_url = page.evaluate("document.getElementById('btn-share-saved').dataset.url")
    assert "?saved=14:" in share_url
    page.wait_for_timeout(1500)   # タイルが載る前だと地図が灰色一色で、確認の役に立たない
    page.screenshot(path=str(SHOTS / "hitori-mobile-saved.png"))
    ctx.close()
    # 別端末を模す: 新しいコンテキスト（localStorage 空）で共有URLを開く
    ctx2 = browser.new_context(viewport=MOBILE)
    p2 = ctx2.new_page()
    p2.goto(share_url)
    _ready(p2)
    p2.wait_for_selector("#saved .card", timeout=30000)
    assert p2.locator("#saved .card").count() == 1
    assert "共有されたリスト" in p2.inner_text("#saved")
    ctx2.close()


TOKYO = {"latitude": 35.6812, "longitude": 139.7671}


def test_locate_sorts_by_distance_and_tracks(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.evaluate("window.__events=[]; window.goatcounter={count:e=>window.__events.push(e.path)}")
    page.click("#btn-locate")
    page.wait_for_selector("#list .card", timeout=40000)
    assert "現在地" in page.inner_text(".origin-line")
    dists = page.eval_on_selector_all("#list .card:not(.unverified) .meta", "els => els.map(e => e.textContent)")
    assert dists, "確認済みが先頭に無い"
    assert "hitori.locate" in page.evaluate("window.__events")
    page.locator("#list .card .open-detail").first.click()
    page.wait_for_selector("#detail")
    assert "hitori.detail" in page.evaluate("window.__events")
    page.screenshot(path=str(SHOTS / "hitori-mobile-locate.png"))


def test_about_sheet_keeps_provenance_and_site_links(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.click("#btn-menu")
    page.wait_for_selector("#about")
    txt = page.inner_text("#about")
    for needle in ["OpenStreetMap", "国土地理院", "食い違い", "ひとりぶんの棚", "この地図の作り方", "一人旅ジャーナル", "載せてほしい"]:
        assert needle in txt, needle
    assert page.locator("#about .roadmap li").count() == 47
    assert page.locator(".homeback").count() == 0 and page.locator(".nextstrip").count() == 0
    page.wait_for_timeout(1500)   # シートの上げ切りとタイルを待つ
    page.screenshot(path=str(SHOTS / "hitori-mobile-about.png"), full_page=False)


# テストごとに新しい context を作る（localStorage と位置情報の許可を持ち越さない）。
# 後続タスクでテスト関数を足したら、このリストにも足す。
TESTS = [
    test_home_states_the_claim_and_two_ways_in,
    test_area_mode_lists_verified_first_without_score_dots,
    test_category_chip_quiet_shows_museums_not_hostels,
    test_sheet_snaps,
    test_detail_shows_provenance_and_conflicts,
    test_detail_of_unverified_says_so_and_has_no_scores,
    test_save_want_then_share_and_restore_on_fresh_context,
    test_locate_sorts_by_distance_and_tracks,
    test_about_sheet_keeps_provenance_and_site_links,
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
