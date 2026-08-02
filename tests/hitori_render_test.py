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


def test_hashchange_resets_absent_params(page):
    """URLに書かれていない項目は初期値へ戻す。

    hashchange は文書を再読込しないため、前の状態を残すと絞り込みが漏れて残る。
    """
    page.goto(BASE + "#cat=stay")
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert page.evaluate("state.cats.size") == 1

    page.evaluate("location.hash = 'nochain=1'")   # cat を書かずに遷移
    page.wait_for_timeout(300)
    assert page.evaluate("state.cats.size") == 4, "cat 不在なのに前の絞り込みが残っている"
    assert page.evaluate("state.nochain") is True
    for c in ("bath", "eat", "play", "stay"):
        assert page.evaluate(f"document.getElementById('f-cat-{c}').checked") is True


def test_detail(page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)

    # 地図クリックの配線確認は形の大きい北海道で行う。東京都は伊豆諸島まで
    # 含むためパスの重心が海上に来てしまい、中心クリックがどこにも当たらない。
    page.click("#map path[data-code='1']")
    page.wait_for_selector("#detail li.item", timeout=15000)
    assert "北海道" in page.inner_text("#detail h2"), page.inner_text("#detail h2")

    # 以降の件数系の検証は件数の多い東京都で。県セレクタから開く。
    page.select_option("#pref-select", "13")
    page.wait_for_function("document.querySelector('#detail h2')?.textContent?.includes('東京都')",
                           timeout=15000)
    page.wait_for_selector("#detail li.item", timeout=15000)
    assert not errors, f"JSエラー: {errors}"
    n = page.eval_on_selector_all("#detail li.item", "els => els.length")
    assert n > 0, "施設が1件も出ていない"

    # スコア降順
    scores = page.eval_on_selector_all(
        "#detail li.item", "els => els.map(e => +e.dataset.score)")
    assert scores == sorted(scores, reverse=True), scores[:20]

    # 各件に Google Maps リンクがある
    links = page.eval_on_selector_all(
        "#detail li.item a[href*='google.com/maps']", "els => els.length")
    assert links == n, f"Google Mapsリンクが {links}/{n} 件"

    # 散布図のピンが出ている
    pins = page.eval_on_selector_all("#scatter circle", "els => els.length")
    assert pins > 0, "散布図のピンがない"

    assert "pref=13" in page.evaluate("location.hash")


def test_detail_caps_are_disclosed(page):
    """大量件数は打ち切るが、打ち切ったことを黙って隠さない。"""
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)

    total = page.evaluate("PREF_CACHE[13].items.length")
    shown = page.eval_on_selector_all("#detail li.item", "els => els.length")
    pins = page.eval_on_selector_all("#scatter circle", "els => els.length")

    assert total > 1000, f"東京都が {total} 件しかない。上限テストの前提が崩れている"
    assert shown <= total
    assert pins <= total

    stat = page.inner_text("#detail .counts")
    assert f"{total:,}" in stat, f"総件数 {total:,} が表示されていない: {stat}"
    if shown < total:
        assert str(shown) in stat, f"表示件数 {shown} が表示されていない: {stat}"


def test_scatter_frames_the_items(page):
    """散布図のviewBoxは施設の分布から決める。

    県ポリゴンのbboxを使うと、伊豆諸島を持つ東京都では本土がごく一部に潰れる。
    """
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#scatter circle", timeout=15000)
    vb = [float(v) for v in page.get_attribute("#scatter", "viewBox").split()]
    cx = page.eval_on_selector_all("#scatter circle", "els => els.map(e => +e.getAttribute('cx'))")
    cy = page.eval_on_selector_all("#scatter circle", "els => els.map(e => +e.getAttribute('cy'))")
    w, h = vb[2], vb[3]
    # ピンが viewBox の面積の大半を使っていること（潰れていない）
    assert (max(cx) - min(cx)) > w * 0.5, f"ピンの横幅 {max(cx)-min(cx):.1f} が viewBox幅 {w:.1f} に対して狭い"
    assert (max(cy) - min(cy)) > h * 0.5, f"ピンの高さ {max(cy)-min(cy):.1f} が viewBox高 {h:.1f} に対して低い"


def test_detail_chain_filter(page):
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    before = page.evaluate("visibleItems(PREF_CACHE[13]).length")
    page.click("#f-nochain")
    page.wait_for_timeout(400)
    after = page.evaluate("visibleItems(PREF_CACHE[13]).length")
    assert after < before, f"チェーンを隠しても件数が減らない ({before} -> {after})"


def test_detail_fetch_failure_is_contained(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    page.route("**/data/hitori/pref/*.json", lambda route: route.abort())
    page.select_option("#pref-select", "26")
    page.wait_for_selector("#detail .error", timeout=10000)
    # 地図本体は生きている
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, "県データの取得失敗で地図が壊れた"
    assert page.eval_on_selector_all("#detail button.retry", "els => els.length") == 1
    page.unroute("**/data/hitori/pref/*.json")


def test_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    # 横スクロールが発生していないこと
    overflow = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"横スクロールが {overflow}px 発生している"
    page.screenshot(path="C:/tmp/hitori_mobile.png", full_page=True)


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
            test_hashchange_resets_absent_params(page)
            test_detail(page)
            test_detail_caps_are_disclosed(page)
            test_scatter_frames_the_items(page)
            test_detail_chain_filter(page)
            test_detail_fetch_failure_is_contained(page)
            page.goto(BASE)
            page.wait_for_function("window.__ready === true", timeout=15000)
            page.screenshot(path="C:/tmp/hitori_overview.png", full_page=True)
            test_mobile(page)
            browser.close()
    finally:
        httpd.shutdown()
    print("OK: render -> C:/tmp/hitori_overview.png, C:/tmp/hitori_mobile.png")


if __name__ == "__main__":
    main()
