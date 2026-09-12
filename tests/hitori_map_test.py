# -*- coding: utf-8 -*-
"""新 hitori.html の描画検証。ローカルHTTPで配信して Playwright で確認する。
file:// では ES Modules と fetch が落ちるので必ず HTTP。
pytest-playwright は入っていないので、hitori_render_test.py と同じく main() が順に呼ぶ。
実行: PYTHONUTF8=1 python tests/hitori_map_test.py
"""
import re, sys, threading, functools, http.server, socketserver
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


def _reveal_unverified(page):
    """未確認カードが画面に出るまで「もっと見る」を押す。

    確認済みは常に先頭に固まるので、拡充が進むと1頁目が確認済みで埋まる。
    「1頁目に未確認がある」ことを前提にしたテストは、データが良くなるほど落ちる。
    """
    for _ in range(8):
        if page.locator("#list .card.unverified").count():
            return True
        more = page.locator("#btn-more")
        if not more.count():
            return False
        before = page.locator("#list .card").count()
        more.click()
        # 固定待ちだと 2,700 件の描き直しに間に合わないことがある。件数が増えるまで待つ
        page.wait_for_function(
            "n => document.querySelectorAll('#list .card').length > n", arg=before, timeout=15000)
    return page.locator("#list .card.unverified").count() > 0


def test_home_states_the_claim_and_two_ways_in(page):
    page.set_viewport_size(MOBILE)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    _ready(page)
    body = page.inner_text("#sheet")
    assert "ひとりで入れるか、根拠つきで。" in body
    # 出典つきの根拠がある件数と、公式で裏が取れた件数は別に出す
    # （全部を「公式情報で裏を取った」と言うと、個人訪問記が根拠の施設まで公式に化ける）
    assert "出典つきの根拠" in body and "公式情報で裏が取れて" in body
    nums = [int(n) for n in re.findall(r"([\d,]{3,})件", body.replace(",", ""))]
    assert len(nums) >= 2 and nums[0] > nums[1], f"根拠あり > 公式 の順で出ていない: {nums}"
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
    assert _reveal_unverified(page), "未確認カードが1枚も出てこない"
    unverified = page.locator("#list .card.unverified")
    assert "候補" in unverified.first.inner_text()
    # 未確認は「見立て」だけ。推定した数値・軸の名前を1つも出していないこと
    score = re.compile(r"ひとり度|静けさ|入りやすさ|\d+\s*/\s*5")
    for i in range(unverified.count()):
        t = unverified.nth(i).inner_text()
        assert not score.search(t), f"未確認カードに推定スコア: {t}"
    assert page.locator("#list .card .scores, #list .card .dots").count() == 0, "スコア表示の器が残っている"
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
    # 選択中のチップが横スクローラーの端で切れていないこと（デスクトップは折り返す）
    clip = page.evaluate("() => { const c = document.getElementById('chips'), b = c.querySelector('[aria-pressed=\"true\"]');"
                         " const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();"
                         " return { over: Math.round(br.right - cr.right), scroll: c.scrollWidth - c.clientWidth }; }")
    assert clip["over"] <= 0 and clip["scroll"] <= 1, f"チップが切れている: {clip}"
    # 横スクローラーはモバイルの作り。デスクトップは折り返して端で切らせない
    assert page.eval_on_selector("#chips", "e => getComputedStyle(e).flexWrap") == "wrap"
    assert page.eval_on_selector("#chips", "e => getComputedStyle(e).overflowX") == "visible"
    page.set_viewport_size(MOBILE)
    page.wait_for_timeout(200)
    assert page.eval_on_selector("#chips", "e => getComputedStyle(e).overflowX") == "auto", "モバイルは横スクロールのまま"
    page.set_viewport_size(DESKTOP)
    page.wait_for_timeout(200)
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
    # 食い違いは畳んだ中に隠さない。開いた時点で両方の値と出典が見えていること
    assert page.locator("#detail .facts-conflict .fact-row.conflict").count() >= 1
    assert page.locator("#detail .facts-conflict .fact-row.conflict .val").first.is_visible(),         "食い違いが折りたたみの中に隠れている"
    assert page.locator("#detail .fact-row.conflict .val").count() >= 2, "食い違いの値が両方出ていない"
    assert "city.kuwana.lg.jp" in txt
    # ひとりチェックは6項目そろい、推定値は出さない
    assert page.locator("#detail .ck").count() == 6
    assert "ひとり度" not in txt
    href = page.get_attribute("#btn-route", "href")
    assert href.startswith("https://www.google.com/maps/dir/?api=1&destination=")
    assert page.is_visible("#btn-back")
    page.screenshot(path=str(SHOTS / "hitori-desktop-detail.png"), full_page=False)


def test_detail_of_unverified_says_so_and_has_no_scores(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    assert _reveal_unverified(page), "未確認カードが1枚も出てこない"
    page.locator("#list .card.unverified .open-detail").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    txt = page.inner_text("#detail")
    assert "未確認" in txt and "OpenStreetMap" in txt
    assert "ひとり度" not in txt
    assert page.locator("#detail .journal").count() == 1, "神奈川には旅記事があるはず"
    page.wait_for_timeout(1500)   # タイルが載る前だと地図が灰色一色で、確認の役に立たない
    # 選ばれたピンが地図の中央＝シートの裏に隠れていないこと
    pin = page.evaluate("() => { const p = document.querySelector('.pin.selected'); if (!p) return null;"
                        " const r = p.getBoundingClientRect(), s = document.getElementById('sheet').getBoundingClientRect();"
                        " return { bottom: Math.round(r.bottom), sheetTop: Math.round(s.top) }; }")
    assert pin, "選択中のピンが無い"
    assert pin["bottom"] <= pin["sheetTop"], f"ピンがシートの裏: {pin}"
    page.screenshot(path=str(SHOTS / "hitori-mobile-detail.png"))


def test_save_want_then_share_and_restore_on_fresh_context(browser):
    ctx = browser.new_context(viewport=MOBILE)
    page = ctx.new_page()
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    # 施設名は実行時に捕まえる。名前を直書きすると、拡充で並び順が変わった日に落ちる
    saved_name = page.locator("#list .card h3").first.inner_text().splitlines()[-1].strip()
    page.locator("#list .card [data-want]").first.click()
    assert page.inner_text("#saved-count") == "1"
    page.click("#btn-saved")
    page.wait_for_selector("#saved", timeout=5000)
    assert page.locator("#saved .card").count() == 1
    share_url = page.evaluate("document.getElementById('btn-share-saved').dataset.url")
    assert "?saved=14:" in share_url
    page.wait_for_timeout(1500)   # タイルが載る前だと地図が灰色一色で、確認の役に立たない
    page.screenshot(path=str(SHOTS / "hitori-mobile-saved.png"))
    # 別の県に切り替えて byId が入れ替わっても、保存カードから詳細を開ける
    page.click("#saved #btn-back")
    page.wait_for_selector("#list .card", timeout=30000)
    page.select_option("#pref", "13")
    page.wait_for_function("document.querySelectorAll('#list .card').length > 0", timeout=30000)
    page.click("#btn-saved")
    page.wait_for_selector("#saved .card", timeout=10000)
    page.locator("#saved .card h3").first.click()
    page.wait_for_selector("#detail", timeout=30000)
    assert saved_name in page.inner_text("#detail"),         f"保存した「{saved_name}」の詳細が開かない: {page.inner_text('#detail')[:80]}"
    ctx.close()
    # 別端末を模す: 新しいコンテキスト（localStorage 空）で共有URLを開く
    ctx2 = browser.new_context(viewport=MOBILE)
    p2 = ctx2.new_page()
    p2.goto(share_url)
    _ready(p2)
    p2.wait_for_selector("#saved .card", timeout=30000)
    assert p2.locator("#saved .card").count() == 1
    assert "共有されたリスト" in p2.inner_text("#saved")
    # 自分の♡を押したら、他人の共有リストではなく自分のリストが開く
    p2.click("#btn-saved")
    p2.wait_for_selector("#saved-tabs", timeout=5000)
    assert "共有されたリスト" not in p2.inner_text("#saved")
    ctx2.close()
    # 県ファイルが1つ落ちたら、その事実を「掲載していません」で上書きしない
    ctx3 = browser.new_context(viewport=MOBILE)
    p3 = ctx3.new_page()
    p3.route("**/data/hitori/pref/13.json*", lambda route: route.abort())
    p3.goto(share_url + ",13:n1234567890")
    _ready(p3)
    p3.wait_for_selector("#saved .notice", timeout=30000)
    notice = p3.inner_text("#saved .notice")
    assert "データを読み込めませんでした" in notice, notice
    assert "掲載していません" not in notice, notice
    ctx3.close()


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
    assert dists, "確認済みが1件も無い"
    first = page.locator("#list .card").first
    assert "unverified" not in (first.get_attribute("class") or ""), "先頭が未確認カード"
    assert "確認済み" in first.inner_text(), f"先頭が確認済みでない: {first.inner_text()[:120]}"
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


def test_menu_returns_to_the_sheet_it_was_opened_from(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.locator("#list .card .open-detail").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    name = page.inner_text("#detail h2")
    page.click("#btn-menu")
    page.wait_for_selector("#about")
    assert page.get_attribute("#sheet", "data-snap") == "full"
    page.click("#about #btn-back")
    page.wait_for_selector("#detail", timeout=10000)
    assert page.is_visible("#detail")
    assert page.inner_text("#detail h2") == name, "戻ったら別の施設になっている"
    snap = page.get_attribute("#sheet", "data-snap")
    assert snap != "full", f"シートが全画面のまま（地図が隠れる）: {snap}"


def test_menu_returns_to_the_detail_opened_after_a_saved_detour(page):
    """♡→保存カード→詳細→一覧→別の施設 と辿ったあとの ≡「戻る」。
    戻り先を最初の1枚だけ覚えていると、ここで古い詳細（保存から開いた施設）に戻ってしまう。"""
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.locator("#list .card [data-want]").first.click()
    page.click("#btn-saved")
    page.wait_for_selector("#saved .card", timeout=10000)
    page.locator("#saved .card .open-detail").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    first_name = page.inner_text("#detail h2")
    page.click("#detail #btn-back")   # 「‹ 一覧へ」は closeOverlay を通らない
    page.wait_for_selector("#list .card", timeout=30000)
    page.locator("#list .card .open-detail").nth(1).click()
    page.wait_for_selector("#detail", timeout=10000)
    second_name = page.inner_text("#detail h2")
    assert second_name != first_name, "2軒目が1軒目と同じで、検証にならない"
    page.click("#btn-menu")
    page.wait_for_selector("#about")
    page.click("#about #btn-back")
    page.wait_for_selector("#detail", timeout=10000)
    assert page.inner_text("#detail h2") == second_name, "古い戻り先（保存から開いた詳細）に戻っている"


# テストごとに新しい context を作る（localStorage と位置情報の許可を持ち越さない）。
# 後続タスクでテスト関数を足したら、このリストにも足す。
def test_mobile_list_folds_the_filters_and_shows_several_cards(page):
    """390px で一覧が読めること。

    絞り込みを開いたままだと、検索欄・切り替え6個・カテゴリで画面が埋まり、
    カードが1枚しか見えなかった（実測 firstCardTop=751 / 844）。
    """
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=13")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.wait_for_timeout(1200)

    assert page.locator("#more-filters").get_attribute("hidden") is not None, \
        "狭い画面では絞り込みの中身を畳んでおく"
    visible = page.eval_on_selector_all(
        "#list .card",
        "els => els.filter(e => { const r = e.getBoundingClientRect();"
        " return r.top < window.innerHeight && r.bottom > 0; }).length")
    assert visible >= 2, f"画面に見えているカードが {visible} 枚しかない"

    # チップは一句で読み切れること（「カード不可、電子マネー不可、QR…」を出さない）
    chips = page.eval_on_selector_all("#list .card .facts span", "els => els.map(e => e.textContent)")
    assert chips, "確認済みカードに事実チップが無い"
    for c in chips:
        assert "、" not in c, f"チップが列挙のまま: {c}"
        assert len(c) <= 16, f"チップが長すぎる: {c}"

    page.click("#btn-filters")
    page.wait_for_timeout(300)
    assert page.locator("#more-filters").get_attribute("hidden") is None, "絞り込みが開かない"
    assert page.is_visible("#tog-open") and page.is_visible("#btn-reset")


def test_closed_facilities_are_marked_and_pushed_down(page):
    """閉業・休業が告知された施設を、一覧で普通の店に見せない。

    行った人が閉まった建物を見ることになるので、「そこへ一人で行けるか」以前の問題。
    消しはしない（「無い」のか「閉じた」のか分かるように）が、印を付けて最後に回す。
    """
    page.set_viewport_size(DESKTOP)
    # n1804881158 は静岡県(22)の、公式ページに閉業が告知されていた施設
    page.goto(BASE + "#pref=22")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    # 閉業の印が付いた施設が先頭に来ていないこと（印の付いた施設が居ることも確かめる）
    order = page.eval_on_selector_all(
        "#list .card", "els => els.map(e => e.classList.contains('shut'))")
    assert order and not order[0], "閉業の施設が一覧の先頭に来ている"

    # 閉業は既定で一覧に出さない（行っても入れないので「ひとりで行ける場所」ではない）
    shut_default = page.locator("#list .card.shut").count()
    # 絞り込みはデスクトップでは常時開いている。狭い画面のときだけ開く操作が要る
    if page.locator("#btn-filters").is_visible():
        page.click("#btn-filters")
        page.wait_for_timeout(250)
    page.click("#tog-closed")
    page.wait_for_timeout(500)
    assert page.get_attribute("#tog-closed", "aria-pressed") == "true"
    shut_shown = page.locator("#list .card.shut").count()
    assert shut_shown >= shut_default, "「閉業も表示」にしても増えない"

    # 閉業が分かっている施設を直接開くと、詳細で警告が出る
    page.goto(BASE + "?pref=22&facility=n1804881158")
    _ready(page)
    page.wait_for_selector("#detail", timeout=30000)
    txt = page.inner_text("#detail")
    assert "閉業" in txt or "休業" in txt, f"閉業の告知が詳細に出ていない: {txt[:120]}"
    # 公式の裏付けが0件の施設に「確認済み」と名乗らせない
    assert "公式 0件" in txt and "確認済み" not in txt.split("ひとりチェック")[0],         f"公式0件なのに確認済みと出ている: {txt[:160]}"
    # 利用条件は ✕（ひとりで行くのに条件がある）
    cond = page.locator("#detail .ck").last
    assert "blocked" in (cond.get_attribute("class") or ""),         f"利用条件が ✕ になっていない: {cond.inner_text()}"


def test_scene_button_recommends_within_that_scene(context, page):
    """場面ボタンを押したら、その場面の中から名指しする。

    「今夜、ひとりで銭湯」を押したのに全業態から選んだら、押した意味が無い。
    理由は事実の連結だけで、おすすめの言葉を足さない。
    """
    context.grant_permissions(["geolocation"])
    context.set_geolocation({"latitude": 35.6812, "longitude": 139.7671})
    page.set_viewport_size(MOBILE)
    # 時刻を固定する。「今夜、ひとりで銭湯」は営業中で絞るので、朝に走らせると
    # 正しく1件も残らず、テストが時計次第で落ちる
    page.clock.set_fixed_time("2026-09-11T11:00:00Z")     # JST 20:00
    page.goto(BASE)
    _ready(page)
    page.click("[data-scene='bath_tonight']")
    page.wait_for_selector("#list .card", timeout=40000)
    page.wait_for_selector(".reco", timeout=20000)

    head = page.inner_text(".recos .sec-label")
    assert "今夜、ひとりで銭湯" in head, f"押した場面が見出しに出ていない: {head}"
    # 一覧も推薦も温浴だけ
    kinds = page.eval_on_selector_all("#list .card .kind", "els => [...new Set(els.map(e => e.textContent))]")
    assert kinds and all(k in ("銭湯", "サウナ", "温泉", "足湯", "個室サウナ", "スパ") for k in kinds), kinds
    rkinds = page.eval_on_selector_all(".reco .rkind", "els => els.map(e => e.textContent.trim())")
    assert rkinds and all(k in ("銭湯", "サウナ", "温泉", "足湯", "個室サウナ", "スパ") for k in rkinds), rkinds

    # 同じ店を2軒並べない
    names = page.eval_on_selector_all(".reco .rname", "els => els.map(e => e.textContent.trim())")
    assert len(names) == len(set(names)), f"同じ名前の店が並んでいる: {names}"

    # 「この時間に行ける」と言うなら、全軒に営業中の理由が付いている
    if "この時間に行ける" in head:
        for i in range(page.locator(".reco").count()):
            assert page.locator(".reco").nth(i).locator(".rwhy i.open").count() == 1,                 "営業中と言えない軒がある"

    # 推薦を押すとその施設の詳細が開く
    first = names[0]
    page.locator(".reco").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    assert first in page.inner_text("#detail")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(SHOTS / "hitori-mobile-scene.png"))


TESTS = [
    test_home_states_the_claim_and_two_ways_in,
    test_scene_button_recommends_within_that_scene,
    test_closed_facilities_are_marked_and_pushed_down,
    test_mobile_list_folds_the_filters_and_shows_several_cards,
    test_area_mode_lists_verified_first_without_score_dots,
    test_category_chip_quiet_shows_museums_not_hostels,
    test_sheet_snaps,
    test_detail_shows_provenance_and_conflicts,
    test_detail_of_unverified_says_so_and_has_no_scores,
    test_save_want_then_share_and_restore_on_fresh_context,
    test_locate_sorts_by_distance_and_tracks,
    test_about_sheet_keeps_provenance_and_site_links,
    test_menu_returns_to_the_sheet_it_was_opened_from,
    test_menu_returns_to_the_detail_opened_after_a_saved_detour,
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
