# -*- coding: utf-8 -*-
"""気持ちスタンプ部品（assets/feel/feel.js）の動作確認。外への通信はすべて横取りする。

  set PYTHONUTF8=1 && python tests/feel_widget_test.py

試験台は tests/feel_harness.html。数（GoatCounter 公開カウンタ）とひとこと（Google フォーム）は
Net が横取りして、送られた中身を記録する。count.js は読ませず、window.goatcounter を差し替える。
"""
import functools
import http.server
import json
import socketserver
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8773
URL = f"http://127.0.0.1:{PORT}/tests/feel_harness.html"
SHOTS = Path(tempfile.gettempdir()) / "feel_shots"

GC_STUB = "window.__gc = []; window.goatcounter = { count: (o) => window.__gc.push(o) };"
BLOCK_STORAGE = """
for (const k of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, k, { configurable: true, get() { throw new Error('storage blocked'); } });
}
"""
COUNTS = {
    "feel/harness-story/naita": "2 035",
    "feel/seikai/naita": "5",
    "feel/hyaku/naita": "3",
    "game/hyaku/clear": "14",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Net:
    """公開カウンタとフォームを横取りする。counter / form に 'abort' や '500' を渡すと失敗させる。"""

    def __init__(self, counter="ok", form="ok"):
        self.counter, self.form, self.posts = counter, form, []

    def install(self, ctx):
        ctx.route("**/gc.zgo.at/**", lambda route: route.abort())
        ctx.route("https://viewsengineer.goatcounter.com/counter/**", self.on_counter)
        ctx.route("https://docs.google.com/forms/**", self.on_form)

    def on_counter(self, route):
        if self.counter == "abort":
            return route.abort()
        if self.counter == "500":
            return route.fulfill(status=500, body="oops")
        tail = route.request.url.split("/counter/", 1)[1]
        name = urllib.parse.unquote(tail[: -len(".json")])
        n = COUNTS.get(name, "0")
        route.fulfill(status=200, content_type="application/json",
                      headers={"Access-Control-Allow-Origin": "*"},
                      body=json.dumps({"count": n, "count_unique": n}))

    def on_form(self, route):
        if self.form == "abort":
            return route.abort()
        self.posts.append(route.request.post_data or "")
        route.fulfill(status=200, body="ok")


failures = []


def check(name, fn):
    try:
        fn()
        print(f"ok    {name}")
    except Exception as e:  # noqa: BLE001 — 失敗は数えて最後にまとめて返す
        failures.append(name)
        print(f"FAIL  {name}: {e}")


def open_page(browser, net, init="", width=1280):
    ctx = browser.new_context(viewport={"width": width, "height": 900})
    ctx.add_init_script(GC_STUB + init)
    net.install(ctx)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.locator("#full .card")).to_be_visible()
    return ctx, page, errors


def gc_paths(page):
    return [e["path"] for e in page.evaluate("window.__gc")]


def main():
    SHOTS.mkdir(exist_ok=True)
    httpd = serve()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        def counts_render():
            ctx, page, _ = open_page(browser, Net())
            expect(page.locator("#full .stamp")).to_have_count(4)
            expect(page.locator('#full .stamp[data-key="naita"] .n')).to_have_text("2035人")
            expect(page.locator('#full .stamp[data-key="tsuzuki"] .n')).to_have_text("まだ誰も")
            expect(page.locator("#full .title")).to_have_text("この物語に、気持ちを置いていく")
            ctx.close()

        def press_and_reload():
            ctx, page, _ = open_page(browser, Net())
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b.locator(".n")).to_have_text("2035人")
            b.click()
            expect(b).to_have_attribute("aria-pressed", "true")
            expect(page.locator("#full .msg")).to_have_text("あなたと同じ気持ちの人が 2036 人います。")
            ev = page.evaluate("window.__gc")
            assert ev == [{"path": "feel/harness-story/naita",
                           "title": "気持ちスタンプ試験台 — 泣いた", "event": True}], ev
            page.reload()
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b).to_have_attribute("aria-pressed", "true")
            expect(b.locator(".n")).to_have_text("2036人")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("もう届いています。ありがとう。")
            assert gc_paths(page) == [], gc_paths(page)
            ctx.close()

        def first_person():
            ctx, page, _ = open_page(browser, Net())
            b = page.locator('#full .stamp[data-key="tsuzuki"]')
            expect(b.locator(".n")).to_have_text("まだ誰も")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("最初のひとりになりました。")
            expect(b.locator(".n")).to_have_text("1人")
            ctx.close()

        def note_sends():
            net = Net()
            ctx, page, _ = open_page(browser, net)
            page.click("#full .note-toggle")
            page.fill("#full textarea", "最後の一行で泣きました")
            page.wait_for_timeout(3200)
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("届きました。ありがとう。")
            assert len(net.posts) == 1, net.posts
            q = urllib.parse.parse_qs(net.posts[0])
            assert q["entry.796994745"] == ["harness-story"], q
            assert q["entry.20892979"] == ["/tests/feel_harness.html"], q
            assert q["entry.274902902"] == ["最後の一行で泣きました"], q
            assert page.input_value("#full textarea") == ""
            assert "feel/harness-story/note" in gc_paths(page), gc_paths(page)
            ctx.close()

        def note_too_fast():
            net = Net()
            ctx, page, _ = open_page(browser, net)
            page.click("#full .note-toggle")
            page.fill("#full textarea", "すぐ送る")
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("もう一度「届ける」を押してください。")
            assert net.posts == [], net.posts
            ctx.close()

        def note_failure_keeps_draft():
            ctx, page, _ = open_page(browser, Net(form="abort"))
            page.click("#full .note-toggle")
            page.fill("#full textarea", "通信が切れても消えない")
            page.wait_for_timeout(3200)
            page.click("#full .send")
            expect(page.locator("#full .note-msg")).to_have_text("送れませんでした。もう一度どうぞ。")
            assert page.input_value("#full textarea") == "通信が切れても消えない"
            page.reload()
            expect(page.locator("#full .card")).to_be_visible()
            expect(page.locator("#full textarea")).to_have_value("通信が切れても消えない")
            ctx.close()

        def counter_unreachable(mode):
            def run():
                ctx, page, errors = open_page(browser, Net(counter=mode))
                b = page.locator('#full .stamp[data-key="naita"]')
                page.wait_for_timeout(500)
                expect(b.locator(".n")).to_have_text("")
                b.click()
                expect(page.locator("#full .msg")).to_have_text("ありがとう。")
                assert errors == [], errors
                ctx.close()
            return run

        def storage_blocked():
            ctx, page, errors = open_page(browser, Net(), init=BLOCK_STORAGE)
            blocked = page.evaluate("(() => { try { localStorage; return 'open'; } catch (e) { return 'blocked'; } })()")
            assert blocked == "blocked", "試験の前提（ストレージの遮断）が効いていない"
            b = page.locator('#full .stamp[data-key="naita"]')
            expect(b.locator(".n")).to_have_text("2035人")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("あなたと同じ気持ちの人が 2036 人います。")
            b.click()
            expect(page.locator("#full .msg")).to_have_text("もう届いています。ありがとう。")
            assert gc_paths(page) == ["feel/harness-story/naita"], gc_paths(page)
            assert errors == [], errors
            ctx.close()

        def english_and_compact():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#en").scroll_into_view_if_needed()
            expect(page.locator("#en .title")).to_have_text("How was this note?")
            expect(page.locator('#en .stamp[data-key="yakudatta"] .label')).to_have_text("Useful")
            expect(page.locator('#en .stamp[data-key="yakudatta"] .n')).to_have_text("be the first")
            page.locator("#compact").scroll_into_view_if_needed()
            expect(page.locator("#compact .stamp")).to_have_count(3)
            expect(page.locator("#compact .note-toggle")).to_have_count(0)
            ctx.close()

        def page_css_does_not_leak():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#compact").scroll_into_view_if_needed()
            expect(page.locator("#compact .stamp").first).to_be_visible()
            ls, fs = page.eval_on_selector(
                "#compact",
                "h => { const s = getComputedStyle(h.shadowRoot.querySelector('.stamp'));"
                " return [s.letterSpacing, s.fontSize]; }")
            assert ls in ("normal", "0px"), ls
            assert fs == "14px", fs
            ctx.close()

        def hidden_then_shown():
            ctx, page, _ = open_page(browser, Net())
            assert page.eval_on_selector("#late", "h => h.shadowRoot === null")
            page.evaluate("document.getElementById('later').hidden = false")
            page.locator("#late").scroll_into_view_if_needed()
            expect(page.locator("#late .card")).to_be_visible()
            ctx.close()

        def board():
            ctx, page, _ = open_page(browser, Net())
            page.locator("#board").scroll_into_view_if_needed()
            rows = page.locator("#board .row")
            expect(rows).to_have_count(3)
            expect(rows.nth(0).locator(".n")).to_have_text("😭 泣いた 5人")
            expect(rows.nth(0).locator(".name")).to_contain_text("正解の外側")
            expect(rows.nth(1).locator(".name")).to_contain_text("最後まで読んだ 14人")
            expect(rows.nth(2).locator(".n")).to_have_text("まだ誰も押していません")
            page.click('#board .chip[data-id="learn"]')
            expect(rows).to_have_count(4)
            expect(page.locator('#board .chip[data-id="learn"]')).to_have_attribute("aria-pressed", "true")
            page.eval_on_selector(
                "#board", "h => h.shadowRoot.addEventListener('click', e => e.preventDefault(), true)")
            rows.nth(0).click()
            assert any(p.startswith("feel/board/open/") for p in gc_paths(page)), gc_paths(page)
            ctx.close()

        def phone_layout():
            ctx, page, _ = open_page(browser, Net(), width=375)
            for sel in ("#full", "#compact", "#board", "#en"):
                page.locator(sel).scroll_into_view_if_needed()
                page.wait_for_timeout(300)
            sw = page.evaluate("document.documentElement.scrollWidth")
            assert sw <= 375, f"横にはみ出している: {sw}px"
            page.screenshot(path=str(SHOTS / "harness_375.png"), full_page=True)
            ctx.close()

        check("数が描かれる", counts_render)
        check("押すと +1 し、読み直しても押した状態のまま", press_and_reload)
        check("0 人のスタンプを押すと最初のひとり", first_person)
        check("ひとことがフォームへ届く", note_sends)
        check("3 秒未満の送信は送らない", note_too_fast)
        check("送信失敗でも下書きが残る", note_failure_keeps_draft)
        check("数の取得が遮断されても押せる", counter_unreachable("abort"))
        check("数の取得が 500 でも押せる", counter_unreachable("500"))
        check("ストレージが使えなくても動き、二重に押せない", storage_blocked)
        check("英語と小型版", english_and_compact)
        check("ページの CSS がはがきに漏れない", page_css_does_not_leak)
        check("隠れていた場所も、表に出たら描かれる", hidden_then_shown)
        check("トップのボード", board)
        check("スマホ幅で横にはみ出さない", phone_layout)
        browser.close()
    httpd.shutdown()
    if failures:
        print(f"\n{len(failures)} 件失敗: {failures}")
        sys.exit(1)
    print("\nfeel_widget_test: ALL PASS")


if __name__ == "__main__":
    main()
