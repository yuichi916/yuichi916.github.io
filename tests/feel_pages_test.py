# -*- coding: utf-8 -*-
"""気持ちスタンプを置いた各ページの検査。外の計測とフォームは横取りする。

  set PYTHONUTF8=1 && python tests/feel_pages_test.py           # 全部
  set PYTHONUTF8=1 && python tests/feel_pages_test.py hyaku     # 名前に hyaku を含む行だけ

見ていること（設計書 7 章）:
  - はがきが描かれ、スマホ 375px・PC 1280px のどちらでも画面の横幅に収まる
  - ページ側の CSS がはがきのボタンに漏れていない（字間・文字サイズ）
  - 最初は隠れている画面（読了画面・結果画面・奥付）でも、表に出たら描かれる
撮った画像は %TEMP%\\feel_shots に置く。文字が読めること・切れていないことを目で確かめる。
"""
import functools
import http.server
import json
import socketserver
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8774
SHOTS = Path(tempfile.gettempdir()) / "feel_shots"
VIEWPORTS = {"375": {"width": 375, "height": 812}, "1280": {"width": 1280, "height": 900}}
GC_STUB = "window.goatcounter = { count: () => {} };"

# (名前, URL, はがきの場所, 描く前に実行する JS, 期待する見出し)。Task 4〜6 で行を足す
PAGES = [
    ("index", "/index.html?nofx=1", '[data-feel="site"]', None, "このサイトに、ひとこと"),
]

# 隠れた親をすべて表に出してから、はがきを画面の中央に持ってくる
REVEAL = """(sel) => {
  const host = document.querySelector(sel);
  if (!host) return false;
  for (let p = host.parentElement; p && p !== document.body; p = p.parentElement) {
    p.hidden = false;
    p.classList.remove('hidden');
    if (getComputedStyle(p).display === 'none') p.style.display = 'flex';
  }
  host.scrollIntoView({ block: 'center' });
  return true;
}"""

MEASURE = """(sel) => {
  const host = document.querySelector(sel);
  const root = host && host.shadowRoot;
  const card = root && root.querySelector('.card');
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const s = getComputedStyle(root.querySelector('.stamp'));
  return { left: r.left, right: r.right, width: r.width, vw: innerWidth,
           ls: s.letterSpacing, fs: s.fontSize, title: root.querySelector('.title').textContent };
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def install_net(ctx):
    ctx.route("**/gc.zgo.at/**", lambda route: route.abort())
    ctx.route("https://viewsengineer.goatcounter.com/counter/**",
              lambda route: route.fulfill(status=200, content_type="application/json",
                                          headers={"Access-Control-Allow-Origin": "*"},
                                          body=json.dumps({"count": "3", "count_unique": "3"})))
    ctx.route("https://docs.google.com/forms/**", lambda route: route.fulfill(status=200, body="ok"))


def extra_index(page, vw):
    page.evaluate(REVEAL, "[data-feel-board]")
    page.wait_for_function(
        "(() => { const h = document.querySelector('[data-feel-board]');"
        " return !!(h && h.shadowRoot && h.shadowRoot.querySelectorAll('.row').length >= 3); })()",
        timeout=10000)
    nav = page.evaluate("[...document.querySelectorAll('#siteNav a')].map(a => a.getAttribute('href'))")
    assert "#feelings" in nav, nav


# 名前ごとの追加の検査。Task 4 で hyaku を足す
EXTRA = {"index": extra_index}


def check_page(browser, name, url, sel, prep, heading, vw):
    ctx = browser.new_context(viewport=VIEWPORTS[vw], locale="ja-JP")
    ctx.add_init_script(GC_STUB)
    install_net(ctx)
    page = ctx.new_page()
    try:
        page.goto(f"http://127.0.0.1:{PORT}{url}", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1500)
        if prep:
            page.evaluate(prep)
        assert page.evaluate(REVEAL, sel), f"{sel} が無い"
        page.wait_for_function(
            "(sel) => { const h = document.querySelector(sel);"
            " return !!(h && h.shadowRoot && h.shadowRoot.querySelector('.card')); }",
            arg=sel, timeout=10000)
        page.wait_for_timeout(400)
        m = page.evaluate(MEASURE, sel)
        assert m, "はがきが描かれていない"
        assert m["left"] >= -1 and m["right"] <= m["vw"] + 1, f"横にはみ出している: {m}"
        assert m["width"] >= 200, f"つぶれている: {m}"
        assert m["ls"] in ("normal", "0px"), f"字間が漏れている: {m['ls']}"
        assert m["fs"] == "14px", f"文字サイズが漏れている: {m['fs']}"
        if heading:
            assert m["title"] == heading, f"見出し: {m['title']!r}"
        page.locator(sel).screenshot(path=str(SHOTS / f"{name}_{vw}.png"))
        if name in EXTRA:
            EXTRA[name](page, vw)
    finally:
        ctx.close()


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    SHOTS.mkdir(exist_ok=True)
    httpd = serve()
    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, url, sel, prep, heading in PAGES:
            if only and only not in name:
                continue
            for vw in VIEWPORTS:
                try:
                    check_page(browser, name, url, sel, prep, heading, vw)
                    print(f"ok    {name} {vw}")
                except Exception as e:  # noqa: BLE001 — 失敗は数えて最後にまとめて返す
                    failures.append(f"{name} {vw}")
                    print(f"FAIL  {name} {vw}: {e}")
        browser.close()
    httpd.shutdown()
    print(f"\n画像: {SHOTS}")
    if failures:
        print(f"{len(failures)} 件失敗: {failures}")
        sys.exit(1)
    print("feel_pages_test: ALL PASS")


if __name__ == "__main__":
    main()
