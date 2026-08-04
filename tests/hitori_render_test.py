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
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
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
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
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
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    page.wait_for_function("window.__ready === true", timeout=15000)
    before = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    page.click("#f-cat-bath")   # 湯だけ外す
    page.wait_for_timeout(300)
    after = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    assert before != after, "カテゴリを外しても塗り分けが変わらない"


def test_url_restore(page):
    page.goto(BASE + "#tab=nation&cat=bath&nochain=1")
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert page.evaluate("document.querySelector('#f-nochain').checked") is True
    assert page.evaluate("document.querySelector('#f-cat-eat').checked") is False
    assert page.evaluate("document.querySelector('#f-cat-bath').checked") is True


def test_hashchange_resets_absent_params(page):
    """URLに書かれていない項目は初期値へ戻す。

    hashchange は文書を再読込しないため、前の状態を残すと絞り込みが漏れて残る。
    """
    page.goto(BASE + "#tab=nation&cat=stay")
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert page.evaluate("state.cats.size") == 1

    page.evaluate("location.hash = 'nochain=1'")   # cat を書かずに遷移
    page.wait_for_timeout(300)
    assert page.evaluate("state.cats.size") == 4, "cat 不在なのに前の絞り込みが残っている"
    assert page.evaluate("state.nochain") is True
    for c in ("bath", "eat", "play", "stay"):
        assert page.evaluate(f"document.getElementById('f-cat-{c}').checked") is True


def test_tabs(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)

    # 既定は「探す」
    assert page.evaluate("state.tab") == "search"
    assert page.is_visible("#panel-search")
    assert page.is_hidden("#panel-nation")

    # 「全国で見る」へ切り替えると地図が出る
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.evaluate("state.tab") == "nation"
    assert page.is_hidden("#panel-search")
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, f"県パスが {n} 件"
    assert "tab=nation" in page.evaluate("location.hash")

    # 戻れる
    page.click("#tab-search")
    page.wait_for_timeout(200)
    assert page.evaluate("state.tab") == "search"
    assert page.is_visible("#panel-search")


def test_nation_tab_restores_from_url(page):
    page.goto(BASE + "#tab=nation&cat=bath")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.evaluate("state.tab") == "nation"
    assert page.evaluate("document.querySelector('#f-cat-bath').checked") is True


def test_detail(page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
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
    page.goto(BASE + "#tab=nation&pref=13")
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
    page.goto(BASE + "#tab=nation&pref=13")
    page.wait_for_selector("#scatter circle", timeout=15000)
    vb = [float(v) for v in page.get_attribute("#scatter", "viewBox").split()]
    cx = page.eval_on_selector_all("#scatter circle", "els => els.map(e => +e.getAttribute('cx'))")
    cy = page.eval_on_selector_all("#scatter circle", "els => els.map(e => +e.getAttribute('cy'))")
    w, h = vb[2], vb[3]
    # ピンが viewBox の面積の大半を使っていること（潰れていない）
    assert (max(cx) - min(cx)) > w * 0.5, f"ピンの横幅 {max(cx)-min(cx):.1f} が viewBox幅 {w:.1f} に対して狭い"
    assert (max(cy) - min(cy)) > h * 0.5, f"ピンの高さ {max(cy)-min(cy):.1f} が viewBox高 {h:.1f} に対して低い"


def test_detail_chain_filter(page):
    page.goto(BASE + "#tab=nation&pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    before = page.evaluate("visibleItems(PREF_CACHE[13]).length")
    page.click("#f-nochain")
    page.wait_for_timeout(400)
    after = page.evaluate("visibleItems(PREF_CACHE[13]).length")
    assert after < before, f"チェーンを隠しても件数が減らない ({before} -> {after})"


def test_detail_fetch_failure_is_contained(page):
    page.goto(BASE)
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    page.wait_for_function("window.__ready === true", timeout=15000)
    page.route("**/data/hitori/pref/*.json", lambda route: route.abort())
    page.select_option("#pref-select", "26")
    page.wait_for_selector("#detail .error", timeout=10000)
    # 地図本体は生きている
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, "県データの取得失敗で地図が壊れた"
    assert page.eval_on_selector_all("#detail button.retry", "els => els.length") == 1
    page.unroute("**/data/hitori/pref/*.json")


def test_file_protocol_explains_itself(page):
    """file:// で開かれたら、ページの不具合ではなく開き方の問題だと分かる案内を出す。"""
    uri = (ROOT / "hitori.html").resolve().as_uri()
    page.goto(uri)
    page.wait_for_function("window.__ready === true", timeout=15000)
    body = page.inner_text("body")
    assert "file://" in body, body[:300]
    assert "localhost:8000" in body, body[:300]
    assert "yuichi916.github.io/hitori.html" in body, body[:300]


def test_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "#tab=nation&pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    # 横スクロールが発生していないこと
    overflow = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"横スクロールが {overflow}px 発生している"
    page.screenshot(path="C:/tmp/hitori_mobile.png", full_page=True)


TOKYO = {"latitude": 35.6812, "longitude": 139.7671}


def test_search_with_location(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    assert not errors, f"JSエラー: {errors}"

    n = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "現在地の一覧が空"

    # 近い順に並んでいる
    d = page.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.dist)")
    assert d == sorted(d), d[:20]

    # 各行に徒歩分と直線距離の両方が出ている
    first = page.inner_text("#search-list li.item")
    assert "徒歩" in first and "直線" in first, first

    # 東京にいるので東京都が読まれている
    assert 13 in page.evaluate("Object.keys(PREF_CACHE).map(Number)")


def test_search_distance_filter(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    before = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    page.select_option("#f-dist", "400")
    page.wait_for_timeout(400)
    after = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert after < before, f"距離を絞っても減らない ({before} -> {after})"
    maxd = page.eval_on_selector_all("#search-list li.item", "els => Math.max(...els.map(e => +e.dataset.dist))")
    assert maxd <= 400, maxd


def test_search_quiet_filter(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    page.check("#f-quiet")
    page.wait_for_timeout(400)
    quiets = page.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.quiet)")
    assert quiets, "静かフィルタで0件になった"
    assert min(quiets) >= 4, quiets[:20]


def test_facility_sheet(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)

    page.click("#search-list li.item")
    page.wait_for_selector("#facility[open], #facility:not([hidden])", timeout=10000)

    body = page.inner_text("#facility")
    assert "徒歩" in body and "直線" in body
    for label in ("ひとり度", "静けさ", "入りやすさ"):
        assert label in body, f"{label} が詳細に無い: {body[:300]}"

    # Google マップのリンクは座標ではなく店名で検索する
    href = page.get_attribute("#facility a.to-maps", "href")
    assert "google.com/maps" in href
    name = page.inner_text("#facility h3")
    from urllib.parse import unquote
    assert name.split()[0] in unquote(href), f"店名がクエリに入っていない: {href}"
    import re
    assert not re.search(r"query=3[0-9]\.\d+,1[0-9]{2}\.\d+", href), f"座標クエリのまま: {href}"

    # 閉じられる
    page.click("#facility .close")
    page.wait_for_timeout(200)
    assert page.eval_on_selector("#facility", "el => el.hidden") is True


def test_facility_keyboard_open_close(context, page):
    """一覧項目にフォーカスした状態で Enter → シート内にフォーカスが移り、
    Escape で閉じると元の一覧項目にフォーカスが戻ることを確認する。

    #facility は <footer> の後の <main> 末尾にあるため、閉じるボタンへ
    フォーカスすると一覧の残り項目とフッター全体をタブで飛ばさないと
    辿り着けない、という回帰を防ぐ。
    """
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    # __searchReady は自県データの読み込み完了時点で立つが、隣接県は
    # その後も非同期に読み込まれ、届くたびに renderSearchList() が
    # #search-list の innerHTML を丸ごと差し替える。ここで focus() した
    # 直後にその差し替えが起きると、フォーカスしたノードごと消えて
    # フォーカスが失われるため、ネットワークが落ち着くまで待つ。
    page.wait_for_load_state("networkidle")

    page.eval_on_selector("#search-list li.item", "el => el.focus()")
    page.keyboard.press("Enter")
    page.wait_for_selector("#facility:not([hidden])", timeout=10000)

    # フォーカスがシート（#facility自身、または内部の要素）に入っている
    in_sheet = page.evaluate("""
      () => {
        const facility = document.getElementById('facility');
        return facility === document.activeElement || facility.contains(document.activeElement);
      }
    """)
    assert in_sheet, "Enterで開いてもフォーカスがシート内に無い"

    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    assert page.eval_on_selector("#facility", "el => el.hidden") is True, "Escapeでシートが閉じない"

    # 元のリスト項目にフォーカスが戻っている
    back_on_item = page.evaluate("""
      () => document.activeElement === document.querySelector('#search-list li.item')
    """)
    assert back_on_item, "Escape後にフォーカスが元の一覧項目に戻っていない"


def test_facility_shows_gem_reason(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE + "#tab=search")
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    # 穴場が1件でもあれば、その理由が数字で出ていること
    gem = page.evaluate("""
      () => { const r = currentSearchResults().find(isGem); return r ? r.id : null; }
    """)
    if not gem:
        return   # この地点に穴場が無いのは異常ではない
    page.evaluate(f"openFacility({gem!r})")
    page.wait_for_selector("#facility .gem-reason", timeout=10000)
    reason = page.inner_text("#facility .gem-reason")
    assert "周辺" in reason and "チェーン" in reason, reason


def test_facility_map(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.add_init_script("""
      window.__tileHosts = [];
      // MapLibre GL 4.7.1 はタイル取得を fetch(new Request(url, opts)) で行う
      // （素の文字列URLではない）。Request を new URL() にそのまま渡すと
      // toString() が "[object Request]" になり host を取り違えるため、
      // .url を持つオブジェクトはそちらを優先して読む。
      const toUrl = u => (u && typeof u === 'object' && u.url) ? u.url : u;
      const _f = window.fetch;
      window.fetch = function (u, ...rest) {
        try { window.__tileHosts.push(new URL(toUrl(u), location.href).host); } catch (e) {}
        return _f.call(this, u, ...rest);
      };
      const _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (m, u, ...rest) {
        try { window.__tileHosts.push(new URL(toUrl(u), location.href).host); } catch (e) {}
        return _open.call(this, m, u, ...rest);
      };
    """)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    page.click("#search-list li.item")
    page.wait_for_selector("#facility-map canvas", timeout=20000)
    # canvas は Map 生成直後に同期で現れるが、タイルの fetch() はスタイル読込
    # 後の非同期タイミングで発火する。canvas 出現直後に __tileHosts を読むと
    # 発火前に読んでしまうことがあるため、実際に来るまで待つ。
    page.wait_for_function(
        "(window.__tileHosts || []).some(h => h.includes('gsi.go.jp'))", timeout=15000)

    # 地理院タイルを実際に取りに行っていること
    reqs = page.evaluate("window.__tileHosts || []")
    assert any("cyberjapandata.gsi.go.jp" in h for h in reqs), reqs

    # 出典が出ている
    body = page.inner_text("#facility")
    assert "地理院タイル" in body, body[:300]

    # 施設と現在地の2つのマーカー
    n = page.eval_on_selector_all("#facility-map .maplibregl-marker", "els => els.length")
    assert n == 2, f"マーカーが {n} 個"


def test_search_without_location(context, page):
    # 権限を与えない → 拒否系統
    context.clear_permissions()
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    body = page.inner_text("#panel-search")
    assert "位置情報" in body, body[:200]
    # 全国で見るへの導線が出ている
    assert page.eval_on_selector_all("#panel-search a[href*='tab=nation'], #panel-search button.to-nation",
                                     "els => els.length") >= 1
    # 地図と一覧が壊れていない
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.eval_on_selector_all("#map path[data-code]", "els => els.length") == 47


def test_search_retry_after_permission_denied(context, page):
    """権限拒否後に再試行ボタンで検索をやり直せる。

    searchStarted は初回到達時に一度だけ立つ番人で、拒否/失敗後も戻らない
    ため、拒否後にブラウザ側で許可を出し直しても再読み込みしない限り
    一覧に戻れなかった。再試行ボタンが番人を下ろして locateAndSearch() を
    やり直すことを確認する。新しいページで開き、直前のテストのモジュール
    状態（searchStarted 等）を引きずらないようにする。
    """
    context.clear_permissions()
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    body = p.inner_text("#panel-search")
    assert "位置情報" in body, body[:200]
    assert p.eval_on_selector_all("#search-status button.retry-location", "els => els.length") == 1

    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p.click("#search-status button.retry-location")
    p.wait_for_selector("#search-list li.item", timeout=30000)
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "再試行しても一覧が populate されない"
    p.close()


def test_search_prefecture_fetch_failure_surfaces(context, page):
    """自県のデータ取得に失敗したとき「該当なし」ではなく読み込み失敗を伝える。

    PREF_CACHE が空のまま items.length === 0 になる経路で、黙って「近くには
    何もありませんでした」と出すと、実際は調べられていないのに調べた上で
    無かったと誤解させる。renderSearchList() の空件数分岐で FAILED_PREFS を
    見ているかを確認する。

    直前のテストが残した URL のハッシュ違いだけで page.goto() すると、
    Playwright/Chromium はフラグメントだけのナビゲーションとみなして
    ページを再読込せず、前のテストのモジュール状態（FAILED_PREFS 等）を
    引きずってしまう。新しいページで開き、直前のテストから完全に隔離する。
    """
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.route("**/data/hitori/pref/*.json", lambda route: route.abort())
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n == 0, f"取得失敗のはずが一覧に {n} 件出ている"
    status = p.inner_text("#search-status")
    assert "東京都" in status, status
    assert "読み込めませんでした" in status, status
    p.close()


def test_search_starts_on_first_tab_entry(context, page):
    """共有URL等で「全国で見る」から入っても、探すタブへ切り替えた時点で検索が始まる。

    init() は起動時の state.tab が 'search' のときしか locateAndSearch() を
    呼ばない旧実装だと、#tab=nation で開いてから探すタブに切り替えても
    #search-list が永久に空のままになる。新しいページで開き、直前のテストの
    モジュール状態（searchStarted 等）を引きずらないようにする（フラグメント
    のみが違うURLへの page.goto() は Chromium がページ再読込をしないため）。
    """
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE + "#tab=nation")
    p.wait_for_selector("#map path[data-code='13']", timeout=15000)
    p.click("#tab-search")
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "探すタブへ切り替えても一覧が始まらない"
    p.close()


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            test_overview(page)
            test_chain_toggle_changes_map(page)
            test_category_filter_changes_map(page)
            test_url_restore(page)
            test_hashchange_resets_absent_params(page)
            test_tabs(page)
            test_nation_tab_restores_from_url(page)
            test_detail(page)
            test_detail_caps_are_disclosed(page)
            test_scatter_frames_the_items(page)
            test_detail_chain_filter(page)
            test_detail_fetch_failure_is_contained(page)
            test_file_protocol_explains_itself(page)
            test_search_with_location(context, page)
            test_search_distance_filter(context, page)
            test_search_quiet_filter(context, page)
            test_facility_sheet(context, page)
            test_facility_keyboard_open_close(context, page)
            test_facility_shows_gem_reason(context, page)
            test_facility_map(context, page)
            test_search_without_location(context, page)
            test_search_retry_after_permission_denied(context, page)
            test_search_prefecture_fetch_failure_surfaces(context, page)
            test_search_starts_on_first_tab_entry(context, page)
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
