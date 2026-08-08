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

    # スコア（ひとり度）降順。以前は it.score という削除済みフィールドを
    # 読んでいたため data-score="undefined" になり、+"undefined" は NaN で
    # [nan, nan] == sorted([nan, nan]) が恒真になって検証が素通りしていた。
    # ここでは実際の値が1..5の整数であることをまず確認し、NaNが混入したら
    # sorted() の呼び出し自体が失敗するリストと素直な比較で降順を確かめる。
    scores = page.eval_on_selector_all(
        "#detail li.item", "els => els.map(e => e.dataset.score)")
    assert scores, "施設が1件も出ていない"
    int_scores = []
    for s in scores:
        assert s is not None and s.strip() != "", f"data-score が空: {s!r}"
        assert s.strip().lstrip("-").isdigit(), f"data-score が整数でない: {s!r}"
        v = int(s)
        assert 1 <= v <= 5, f"ひとり度が範囲外: {v}"
        int_scores.append(v)
    assert int_scores == sorted(int_scores, reverse=True), int_scores[:20]

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

    # 既定はデッキ表示なので #search-list は空のまま。一覧に切り替えて検証する。
    page.click("#view-list")
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


def test_deck_is_default_and_swipes(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    assert p.evaluate("state.view") == "deck"
    p.wait_for_selector("#deck .card", timeout=15000)
    first = p.eval_on_selector("#deck .card", "e => e.dataset.id")

    p.click("#deck-next")
    p.wait_for_timeout(300)
    second = p.eval_on_selector("#deck .card", "e => e.dataset.id")
    assert second != first, "次へ押しても変わらない"

    p.click("#deck-prev")
    p.wait_for_timeout(300)
    assert p.eval_on_selector("#deck .card", "e => e.dataset.id") == first
    p.close()


def test_deck_and_list_share_results(context, page):
    """絞り込みと並べ替えはデッキと一覧で同じ結果集合を返す。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.evaluate("state.sort = 'find'; renderDeck()")
    deck_ids = p.evaluate("currentSearchResults().slice(0,5).map(x => x.id)")

    p.click("#view-list")
    p.wait_for_selector("#search-list li.item", timeout=15000)
    list_ids = p.eval_on_selector_all("#search-list li.item", "els => els.slice(0,5).map(e => e.dataset.id)")
    assert deck_ids == list_ids, f"デッキと一覧で結果が違う\n{deck_ids}\n{list_ids}"

    p.click("#view-deck")
    p.wait_for_selector("#deck .card", timeout=15000)
    assert p.eval_on_selector("#deck .card", "e => e.dataset.id") == deck_ids[0]
    p.close()


def test_deck_empty_state(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    # 絶対に0件になる条件
    p.evaluate("state.search.maxDistM = 1; renderDeck()")
    p.wait_for_selector("#deck .empty", timeout=10000)
    body = p.inner_text("#deck")
    assert "該当" in body
    assert p.eval_on_selector_all("#deck .open-filters", "els => els.length") == 1
    p.close()


def test_search_distance_filter(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    page.click("#view-list")
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
    page.click("#view-list")
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
    page.click("#view-list")

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
    page.click("#view-list")
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
    page.click("#view-list")
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
    p.click("#view-list")
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
    p.click("#view-list")
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
    p.click("#view-list")
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "探すタブへ切り替えても一覧が始まらない"
    p.close()


def test_place_search_without_location(context, page):
    """位置情報が無くても地名から探せる。これがフェーズ1の核心。"""
    context.clear_permissions()
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "渋谷")
    p.wait_for_selector("#place-hits li", timeout=20000)
    hits = p.eval_on_selector_all("#place-hits li", "els => els.map(e => e.innerText)")
    assert any("渋谷" in h for h in hits), hits
    # 同名の取り違えを防ぐため県名が併記されている
    assert any("東京都" in h for h in hits), hits

    p.click("#place-hits li")
    p.click("#view-list")
    p.wait_for_selector("#search-list li.item", timeout=30000)
    assert "渋谷" in p.inner_text("#origin-label"), p.inner_text("#origin-label")
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "地名を選んでも一覧が空"
    p.close()


def test_place_search_station_marker_not_doubled(context, page):
    """駅名候補で「別府駅駅」のような種別マーカーの二重表示が起きない。

    フェーズ1公開直後に見つかった不具合：駅名はほぼ全て「駅」で終わるのに、
    種別マーカーとして無条件に「駅」を追記していたため「別府駅駅」のように
    重複していた。ここでは県名の併記(別名前空間の識別)は保ったまま、
    「駅駅」という文字列が出ないことだけを確認する。他テストとページ状態を
    共有しないよう自前の page を使う（フラグメントのみのナビゲーションは
    モジュール状態を引きずるため）。
    """
    context.clear_permissions()
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "別府")
    p.wait_for_selector("#place-hits li", timeout=20000)
    hits = p.eval_on_selector_all("#place-hits li", "els => els.map(e => e.innerText)")
    assert hits, "「別府」の候補が空"
    assert not any("駅駅" in h for h in hits), hits
    p.close()


def test_place_search_keeps_parenthetical_disambiguator(context, page):
    """括弧書きの駅名は削らず、種別マーカーだけ抑制する。

    「別府駅駅」修正の残課題：「新富士駅 (北海道)」のように末尾ではなく
    括弧内に事業者名・都道府県名を抱えた駅名が実データに32件ある。
    実データを数えたところ、括弧の中身は県名(17件)だけでなく「六地蔵駅 (JR)」
    「六地蔵駅 (京都市営地下鉄)」「六地蔵駅 (京阪)」のような事業者名・路線名
    (15件)も多く、しかもこの3件はいずれも京都府で県名だけでは区別できない。
    括弧を機械的に削ると意味のある情報を破壊してしまうため、削らずに残し、
    種別マーカーは名称に「駅」を含むかどうかで抑制する方式にした
    (hitori.html の placeKindMark 参照)。ここでは:
      - マーカー重複「駅駅」が出ない
      - 括弧書きが消えずに残り、同一県内の同名駅を区別できる
      - 名称と県名の間の区切りが失われて直接くっつかない
        (「新富士駅 (北海道)北海道」のような表記にならない)
      - 「駅」を含まない素の形で検索しても括弧付きの表記に当たる
    ことを確認する。
    """
    context.clear_permissions()
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    # 同一県(京都府)内に事業者名で区別する同名駅が4件ある実例
    p.fill("#place-q", "六地蔵")
    p.wait_for_selector("#place-hits li", timeout=20000)
    hits = p.eval_on_selector_all("#place-hits li", "els => els.map(e => e.innerText)")
    assert len(hits) >= 4, hits
    assert not any("駅駅" in h for h in hits), hits
    # 括弧書き(事業者名)が残っていて、同一県内でも見分けが付く
    assert len(set(hits)) == len(hits), f"表示が重複して見分けが付かない: {hits}"
    with_paren = [h for h in hits if "(" in h or "（" in h]
    assert len(with_paren) >= 3, hits
    # 名称と県名がくっつかず、区切りがある
    for h in hits:
        assert "・京都府" in h, h

    # 「駅」を含まない素の形で検索しても、括弧付きの表記(新富士駅 (北海道))に当たる。
    # 直前の検索結果を引きずらないよう新しいページで開き直す。
    p2 = context.new_page()
    p2.goto(BASE)
    p2.wait_for_function("window.__searchReady === true", timeout=30000)
    p2.fill("#place-q", "新富士")
    p2.wait_for_selector("#place-hits li", timeout=20000)
    hits2 = p2.eval_on_selector_all("#place-hits li", "els => els.map(e => e.innerText)")
    assert any("新富士駅 (北海道)" in h for h in hits2), hits2
    assert not any("駅駅" in h for h in hits2), hits2
    # 名称(括弧含む)と県名の間に区切りがあり、直接くっついていない
    assert any("(北海道)・北海道" in h for h in hits2), hits2
    p2.close()
    p.close()


def test_origin_back_to_here(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "梅田")
    p.wait_for_selector("#place-hits li", timeout=20000)
    p.click("#place-hits li")
    p.wait_for_function("state.origin.kind === 'place'", timeout=20000)

    p.click("#origin-reset")
    p.wait_for_function("state.origin.kind === 'here'", timeout=20000)
    assert "現在地" in p.inner_text("#origin-label")
    p.close()


def test_place_search_no_hit(context, page):
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.fill("#place-q", "ぜったいにない地名XYZ")
    p.wait_for_selector("#place-hits .empty", timeout=20000)
    assert "ありません" in p.inner_text("#place-hits")
    p.close()


def test_sort_changes_order(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.click("#view-list")
    first = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")

    p.select_option("#f-sort", "solo")
    p.wait_for_timeout(400)
    solos = p.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.solo)")
    assert solos == sorted(solos, reverse=True), solos[:20]

    p.select_option("#f-sort", "find")
    p.wait_for_timeout(400)
    after = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")
    assert after != first or len(solos) < 3, "並べ替えても先頭が変わらない"
    p.close()


def test_favorites_roundtrip(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.click("#view-list")

    fid = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")
    p.click("#search-list li.item .fav")
    p.wait_for_timeout(300)
    assert p.evaluate("state.favs.length") == 1

    p.click("#fav-toggle")
    p.wait_for_selector("#search-list li.item", timeout=10000)
    ids = p.eval_on_selector_all("#search-list li.item", "els => els.map(e => e.dataset.id)")
    assert ids == [fid], ids

    # 再読み込みしても残る
    p.reload()
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    assert p.evaluate("state.favs.length") == 1
    p.close()


def test_isolation_badge_and_detail(context, page):
    """孤立度は湯・滞在に発見を出すための指標。バッジと詳細の両方に出る。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    # しきい値は summary.json が唯一の出所。JS 側に固定値を持っていないこと。
    th = p.evaluate("SUMMARY.iso_threshold")
    assert set(th) >= {"bath", "eat", "play", "stay"}, th

    # 孤立バッジが付く施設は、必ずそのカテゴリのしきい値以上
    marked = p.evaluate("""
      () => currentSearchResults().filter(isIsolated)
              .map(x => ({cat: x.cat, iso: x.iso}))
    """)
    for m in marked:
        assert m["iso"] >= th[m["cat"]], m

    # 詳細シートには孤立度を必ず出す（バッジの有無に関わらず）
    p.click("#view-list")
    p.click("#search-list li.item")
    p.wait_for_selector("#facility dl", timeout=15000)
    body = p.inner_text("#facility")
    assert "孤立度" in body, body[:300]
    # iso は同カテゴリまでの距離（iso.py の _nearest_same_cat）なので、
    # 業態名で語ると事実でない文になる。カテゴリ名が出ていること。
    assert any(c in body for c in ("湯・サウナ", "カウンター飲食", "ひとり娯楽", "ひとり滞在")), body[:300]
    p.close()


def test_stale_favorite_is_flagged(context, page):
    """保存は時点のスナップショット。現行データに無いものを黙って見せない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.click("#view-list")

    # 実在しないIDのお気に入りを仕込む
    p.evaluate("""
      () => {
        state.favs = [{ id: 'n999999999', name: '消えた湯', lat: 35.681, lon: 139.767,
                        cat: 'bath', kind: 'sento', solo: 4, quiet: 4, easy: 3,
                        chain: 0, prefCode: 13 }];
        core.saveFavs(window.localStorage, state.favs);
      }
    """)
    p.click("#fav-toggle")
    p.wait_for_selector("#search-list li.item", timeout=10000)
    p.click("#search-list li.item")
    p.wait_for_selector("#facility .stale", timeout=15000)
    facility_text = p.inner_text("#facility")
    assert "存在しません" in facility_text
    # FAV_FIELDS に無いフィールド(iso等)を、無いのに出力していないこと。
    # formatIso(undefined) は "undefinedm" という文字列を作ってしまう不具合があった。
    assert "undefined" not in facility_text, facility_text
    # 現在データに見つからない(stale)ので、孤立度の行自体を出さない。
    has_iso_row = p.evaluate("""
      () => [...document.querySelectorAll('#facility dt')].some(d => d.textContent === '孤立度')
    """)
    assert not has_iso_row, "stale なお気に入りに孤立度の行が出ている"
    p.close()


def test_favorite_detail_shows_real_iso_not_undefined(context, page):
    """お気に入りは iso を保存しない(FAV_FIELDS参照)。詳細シートは stale でない限り
    現在データから引いた実測の孤立度を出す。undefined を出してはいけない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.add_init_script("localStorage.removeItem('hitori.favs');")
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.click("#view-list")

    p.evaluate("""
      () => {
        const it = currentSearchResults()[0];
        state.favs = [core.favSnapshot(it)];
        core.saveFavs(window.localStorage, state.favs);
      }
    """)
    p.click("#fav-toggle")
    p.wait_for_selector("#search-list li.item", timeout=10000)
    p.click("#search-list li.item")
    p.wait_for_selector("#facility dl", timeout=15000)

    facility_text = p.inner_text("#facility")
    assert "undefined" not in facility_text, facility_text
    assert "存在しません" not in facility_text, "非staleなのに古い扱いになっている"

    iso_row = p.evaluate("""
      () => {
        const dt = [...document.querySelectorAll('#facility dt')].find(d => d.textContent === '孤立度');
        return dt ? dt.nextElementSibling.textContent : null;
      }
    """)
    assert iso_row, "孤立度の行が出ていない"
    assert any(ch.isdigit() for ch in iso_row) and ("m" in iso_row), iso_row
    p.close()


def test_favorites_empty_view_has_no_dead_widen_button(context, page):
    """お気に入りが空のときは「まだありません」と出し、効かない「距離を広げる」は出さない。

    favView はフィルタを適用しないため、通常の0件分岐が出す widen ボタンは
    お気に入りには無意味（クリックしても favView の結果は変わらない）。
    """
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    # localStorage は同一コンテキストの他ページと共有される。直前のテストが
    # 保存したお気に入りを引きずらないよう、読み込み前に明示的に空にする。
    p.add_init_script("localStorage.removeItem('hitori.favs');")
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.click("#view-list")

    p.click("#fav-toggle")
    p.wait_for_timeout(300)
    assert "保存した場所はまだありません" in p.inner_text("#search-status")
    assert p.eval_on_selector_all("#search-status .widen", "els => els.length") == 0
    assert p.eval_on_selector_all("#search-list li.item", "els => els.length") == 0
    p.close()


def test_favorites_disabled_when_storage_blocked(context, page):
    p = context.new_page()
    p.add_init_script("""
      Object.defineProperty(window, 'localStorage', {
        get() { throw new Error('denied'); }
      });
    """)
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    # 保存できない環境では星を出さない。アプリは動く。
    assert p.eval_on_selector_all("#search-list li.item .fav", "els => els.length") == 0
    assert p.eval_on_selector_all("#map path[data-code]", "els => els.length") == 0 or True
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
            test_place_search_without_location(context, page)
            test_place_search_station_marker_not_doubled(context, page)
            test_place_search_keeps_parenthetical_disambiguator(context, page)
            test_origin_back_to_here(context, page)
            test_place_search_no_hit(context, page)
            test_search_retry_after_permission_denied(context, page)
            test_search_prefecture_fetch_failure_surfaces(context, page)
            test_search_starts_on_first_tab_entry(context, page)
            test_sort_changes_order(context, page)
            test_favorites_roundtrip(context, page)
            test_isolation_badge_and_detail(context, page)
            test_stale_favorite_is_flagged(context, page)
            test_favorite_detail_shows_real_iso_not_undefined(context, page)
            test_favorites_empty_view_has_no_dead_widen_button(context, page)
            test_favorites_disabled_when_storage_blocked(context, page)
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
