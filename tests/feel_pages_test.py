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
    ("hyaku", "/hyaku.html", '[data-feel="hyaku"]', None, "この物語に、気持ちを置いていく"),
    ("hyaku-en", "/hyaku.html?lang=en", '[data-feel="hyaku"]', None, "Leave a feeling for this story"),
    ("seikai", "/seikai.html", '[data-feel="seikai"]',
     "st.cleared = true; st.maxEp = 14; paintTitle()", "この物語に、気持ちを置いていく"),
    ("kototsugi", "/kototsugi/index.html", '[data-feel="kototsugi"]', None, "この物語に、気持ちを置いていく"),
    ("sudoku", "/sudoku.html", '[data-feel="sudoku"]', None, "遊んでみて、どうでした？"),
    ("shogi-puyo", "/shogi-puyo.html", '[data-feel="shogi-puyo"]',
     "document.getElementById('startCard').hidden = true", "遊んでみて、どうでした？"),
    ("bakekurabe", "/bakekurabe.html", '[data-feel="bakekurabe"]',
     "document.getElementById('titleOv').hidden = true", "遊んでみて、どうでした？"),
    ("ehon", "/ehon.html", '[data-feel="ehon"]',
     "typeof renderColophon === 'function' && renderColophon()", "この絵本、どうでした？"),
    ("ai-map", "/ai-map.html", '[data-feel="ai-map"]', None, "ここまで見て、どうでした？"),
    ("salon", "/salon.html", '[data-feel="salon"]', None, "ここまで見て、どうでした？"),
    ("ai-english", "/ai-english.html", '[data-feel="ai-english"]', None, "ここまで見て、どうでした？"),
    ("toeic", "/toeic.html", '[data-feel="toeic"]', None, "ここまで見て、どうでした？"),
    ("novel-bench", "/novel-bench.html", '[data-feel="novel-bench"]', None, "ここまで見て、どうでした？"),
    ("hitoritabi", "/hitoritabi/index.html", '[data-feel="hitoritabi"]', None, "ここまで見て、どうでした？"),
    ("method-ja", "/method/kansoku-suru-monogatari.html",
     '[data-feel="method/kansoku-suru-monogatari"]', None, "このノート、どうでした？"),
    ("method-en", "/method/en/stories-that-watch-you.html",
     '[data-feel="method/en/stories-that-watch-you"]', None, "How was this note?"),
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
  // はがきの中の 5 点に、ページ側の別の要素（影・飾りの層など）がかぶさっていないか
  const pts = [[r.left + 24, r.top + 16], [r.left + r.width / 2, r.top + 16], [r.right - 24, r.top + 16],
               [r.left + r.width / 2, r.top + r.height / 2], [r.left + 24, r.bottom - 16]];
  const covered = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)
    .map(([x, y]) => document.elementFromPoint(x, y))
    .filter((e) => e && e !== host)
    .map((e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')));
  return { left: r.left, right: r.right, width: r.width, vw: innerWidth, covered,
           ls: s.letterSpacing, fs: s.fontSize, title: root.querySelector('.title').textContent };
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class QuietServer(socketserver.ThreadingTCPServer):
    """ページを閉じると、ブラウザが読み込み途中の画像や音声の接続を切る。その切断は失敗ではないので黙る。"""

    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], ConnectionError):
            return
        super().handle_error(request, client_address)


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    QuietServer.allow_reuse_address = True
    httpd = QuietServer(("127.0.0.1", PORT), handler)
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
        " return !!(h && h.shadowRoot && h.shadowRoot.querySelectorAll('.row').length >= 2); })()",
        timeout=10000)
    nav = page.evaluate("[...document.querySelectorAll('#siteNav a')].map(a => a.getAttribute('href'))")
    assert "#feelings" in nav, nav


# 名前ごとの追加の検査。Task 4 で hyaku を足す
def extra_hyaku(page, vw):
    # 読了画面は画面より高くなる。末尾の「表紙へもどる」までスクロールで届くこと
    bottom = page.evaluate("""() => { const e = document.getElementById('ending');
        e.scrollTop = e.scrollHeight; return document.getElementById('btnBack').getBoundingClientRect().bottom; }""")
    height = page.evaluate("innerHeight")
    assert bottom <= height + 1, f"表紙へもどる に届かない: {bottom} > {height}"
    # 冒頭の「（了）」にも届くこと。Safari 17.6 未満は justify-content の safe を知らず、
    # 手前の center に戻る。その状態をまねてから測る
    top = page.evaluate("""() => { const e = document.getElementById('ending');
        if (getComputedStyle(e).justifyContent.includes('safe')) e.style.justifyContent = 'center';
        e.scrollTop = 0; return document.getElementById('endFin').getBoundingClientRect().top; }""")
    assert top >= 0, f"（了）がスクロールで戻れない上にはみ出している: top={top}"


def extra_seikai(page, vw):
    # 読み終えていない人（最初にタイトル画面を見る人）には出さない
    hidden = page.evaluate("""() => { st.cleared = false; st.maxEp = 0; paintTitle();
        return document.querySelector('[data-feel="seikai"]').hidden; }""")
    assert hidden, "読み終えていないのに、はがきが出ている"
    page.evaluate("() => { st.cleared = true; st.maxEp = 14; paintTitle(); }")
    # 本編を始めるとタイトル画面は見えなくなる。その上のはがきが見えないまま押せてはいけない
    page.click("#tStart")
    page.wait_for_function("document.getElementById('title').classList.contains('gone')", timeout=10000)
    vis, hit = page.evaluate("""() => { const h = document.querySelector('[data-feel="seikai"]');
        const c = h.shadowRoot.querySelector('.card'); const r = c.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
        return [getComputedStyle(c).visibility, e === h]; }""")
    assert vis == "hidden", f"本編の上ではがきが見えている: {vis}"
    assert hit is False, "本編の上で見えないはがきがクリックを受け取っている"


EXTRA = {"index": extra_index, "hyaku": extra_hyaku, "seikai": extra_seikai}


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
        # 描かれる前の空の枠で中央に寄せたので、背が伸びたはがきを改めて中央に寄せてから測る
        page.evaluate("(sel) => document.querySelector(sel).scrollIntoView({ block: 'center' })", sel)
        page.wait_for_timeout(400)
        m = page.evaluate(MEASURE, sel)
        assert m, "はがきが描かれていない"
        assert m["left"] >= -1 and m["right"] <= m["vw"] + 1, f"横にはみ出している: {m}"
        assert m["width"] >= 220, f"つぶれている: {m}"
        assert not m["covered"], f"はがきの上に別の要素が重なっている: {m['covered']}"
        assert m["ls"] in ("normal", "0px"), f"字間が漏れている: {m['ls']}"
        assert m["fs"] == "14px", f"文字サイズが漏れている: {m['fs']}"
        if heading:
            assert m["title"] == heading, f"見出し: {m['title']!r}"
        # 読了画面のフェードなどの途中で撮らないよう、アニメーションは終わった状態で撮る
        page.locator(sel).screenshot(path=str(SHOTS / f"{name}_{vw}.png"), animations="disabled")
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
