"""伏せる: 通信ゼロの検証とスクリーンショット（Python Playwright, channel="chrome"）。

使い方:  python scripts/fuseru/qc_playwright.py [出力フォルダ]   （既定 C:\\tmp\\fuseru-qc）

確かめること
  1. ページ表示中の要求: 同じオリジン（このサイトのファイル）と、GoatCounter の固定URLの画像1回だけ
  2. 文章を貼る・種類を切り替える・伏せない/伏せるを押す・手で足す・コピー・AIの返事を戻す・全部消す の間、
     要求が 1件も出ない（同じオリジンも含めて 0件）
  3. 入力に入れた目印の文字列が、どの要求の URL・本文にも出てこない
  4. ページの中から fetch / XMLHttpRequest / WebSocket / sendBeacon を試しても、CSP で止まり外へ出ない
  5. コンソールのエラー 0件、390px 幅で横スクロールが出ない
  6. 390x844 と 1280x800 のスクリーンショット
GoatCounter への要求は記録したうえで、手元で 1x1 の GIF を返す（検証で本番の集計を汚さないため）。
"""
from __future__ import annotations

import base64
import http.server
import json
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\tmp\fuseru-qc")
GC = "https://viewsengineer.goatcounter.com/count?p=/fuseru.html"
GIF = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
MARK = "鳴海 透子"   # 入力に混ぜる目印（架空の名前）。どの要求にも出てはいけない
SAMPLE = (
    "株式会社ミナト企画\n営業部 田中 一郎 様\n\nお世話になっております。さくら坂商事の佐藤です。\n"
    f"氏名：{MARK}\n電話：090-0000-1234\nメール：kensho@example.jp\n住所：東京都港区芝公園9-9-9 ミナトハイツ301\n"
    "マイナンバー：1234 5678 9018\nカード：4111 1111 1111 1111\n振込先：さくら坂銀行 港南支店 普通 1234567\n"
    "生年月日：1985年3月12日\n社員番号 A-1029 の件です。\n--\n佐藤 健\nsato@example.co.jp"
)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


SINK_HITS: list[str] = []


class Sink(http.server.BaseHTTPRequestHandler):
    """別オリジンの受け口。ここに1件でも届いたら「外へ出た」"""
    def log_message(self, *a):
        pass

    def _hit(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode("utf-8", "replace") if n else ""
        SINK_HITS.append(f"{self.command} {self.path} {body[:80]}")
        self.send_response(204); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()

    do_GET = do_POST = do_PUT = do_OPTIONS = _hit


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{srv.server_address[1]}"
    sink = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Sink)
    threading.Thread(target=sink.serve_forever, daemon=True).start()
    ext = f"localhost:{sink.server_address[1]}"   # 127.0.0.1 から見て別オリジン
    url = f"{origin}/fuseru.html?nofx=1"
    report: dict = {"origin": origin, "checks": {}}
    ok = True

    def check(name: str, cond: bool, detail=None) -> None:
        nonlocal ok
        report["checks"][name] = {"ok": bool(cond), "detail": detail}
        print(("PASS " if cond else "FAIL ") + name + ("" if detail is None else f"  {detail}"))
        ok = ok and bool(cond)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome")
            for vw, vh, tag in [(1280, 800, "desktop"), (390, 844, "mobile")]:
                ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1 if vw > 500 else 2,
                                          is_mobile=vw < 500, has_touch=vw < 500)
                ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=origin)
                reqs: list[dict] = []
                phase = {"name": "load"}
                errors: list[str] = []
                page = ctx.new_page()
                page.route("https://viewsengineer.goatcounter.com/**",
                           lambda route: route.fulfill(status=200, content_type="image/gif", body=GIF))
                page.on("request", lambda r: reqs.append({"phase": phase["name"], "url": r.url, "method": r.method,
                                                          "type": r.resource_type, "post": r.post_data}))
                page.on("websocket", lambda ws: reqs.append({"phase": phase["name"], "url": ws.url, "method": "WS", "type": "websocket", "post": None}))
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))

                page.goto(url, wait_until="load")
                page.wait_for_timeout(800)

                # ---- 操作（ここからは要求ゼロのはず）
                phase["name"] = "interaction"
                page.fill("#src", SAMPLE)
                page.wait_for_timeout(400)
                n_marks = page.locator("#preview mark.hl").count()
                out_text = page.input_value("#out")
                check(f"{tag}: 検出してハイライト", n_marks >= 13, n_marks)
                check(f"{tag}: 伏せた文に目印も電話も残らない", MARK not in out_text and "090-0000-1234" not in out_text and "[人名" in out_text)
                # 種類のオン・オフ
                page.locator("label.chip.t-phone").click(); page.wait_for_timeout(200)
                check(f"{tag}: 電話をオフにすると電話が残る", "090-0000-1234" in page.input_value("#out"))
                page.locator("label.chip.t-phone").click(); page.wait_for_timeout(200)
                # 伏せない（押す）→ 戻す
                first = page.locator("#preview mark.hl.t-company").first
                first.click(); page.wait_for_timeout(200)
                check(f"{tag}: 押すと伏せない", "株式会社ミナト企画" in page.input_value("#out"))
                page.locator("#preview mark.hl.t-company.off").first.click(); page.wait_for_timeout(200)
                check(f"{tag}: もう一度押すと伏せる", "株式会社ミナト企画" not in page.input_value("#out"))
                # 手で足す: 「A-1029」を選んで人名として足す
                page.evaluate("""() => {
                  const pv = document.getElementById('preview');
                  const w = document.createTreeWalker(pv, NodeFilter.SHOW_TEXT);
                  let n; while ((n = w.nextNode())) { const i = n.data.indexOf('A-1029'); if (i >= 0) {
                    const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 6);
                    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } }
                }""")
                page.select_option("#add-type", "person")
                page.click("#btn-add"); page.wait_for_timeout(200)
                check(f"{tag}: 選んだ所を手で足せる", "A-1029" not in page.input_value("#out"))
                # コピー
                page.click("#btn-copy-out"); page.wait_for_timeout(200)
                # AIの返事を戻す
                page.fill("#reply", "【人名1】様へ。［電話 1］に連絡し、[人名3]さんにも伝えます。[人名99]")
                page.wait_for_timeout(200)
                back = page.input_value("#back")
                check(f"{tag}: 戻す", "田中 一郎" in back and "090-0000-1234" in back and "[人名99]" in back, back)
                page.click("#btn-copy-back"); page.wait_for_timeout(200)
                page.locator("#table-box summary").click()
                page.wait_for_timeout(200)

                # ---- スクリーンショット（操作後の状態。例文ボタンの表示で撮る）
                page.click("#btn-reset"); page.click("#btn-example"); page.wait_for_timeout(300)
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(path=str(OUT / f"{tag}_{vw}x{vh}_top.png"))
                page.locator("#step2").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{tag}_{vw}x{vh}_step2.png"))
                page.locator("#accuracy").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{tag}_{vw}x{vh}_accuracy.png"))
                page.screenshot(path=str(OUT / f"{tag}_{vw}x{vh}_full.png"), full_page=True)
                sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
                check(f"{tag}: 横スクロールなし", sw[0] <= sw[1], sw)
                page.click("#btn-clear")
                page.wait_for_timeout(200)

                inter = [r for r in reqs if r["phase"] == "interaction"]
                load = [r for r in reqs if r["phase"] == "load"]
                ext_load = [r for r in load if not r["url"].startswith(origin)]
                gc = [r for r in reqs if r["url"].startswith("https://viewsengineer.goatcounter.com")]
                check(f"{tag}: 操作中の要求 0件（同じオリジンも含む）", len(inter) == 0, [r["url"] for r in inter])
                check(f"{tag}: 表示時の外部要求は GoatCounter の固定URLの画像1件だけ",
                      len(ext_load) == 1 and ext_load[0]["url"] == GC and ext_load[0]["method"] == "GET" and ext_load[0]["type"] == "image",
                      [(r["url"], r["method"], r["type"]) for r in ext_load])
                check(f"{tag}: GoatCounter は全体で1回だけ", len(gc) == 1, len(gc))
                leak = [r["url"] for r in reqs if MARK in (r["url"] + (r["post"] or "")) or "090-0000-1234" in (r["url"] + (r["post"] or ""))]
                check(f"{tag}: 目印・電話番号を含む要求なし", not leak, leak)
                check(f"{tag}: コンソールのエラー 0件", not errors, errors)
                report[tag] = {"requests": reqs, "consoleErrors": errors}
                ctx.close()

            # ---- 4. 送ろうとしても止まるか（別のページで。CSP 違反のメッセージは出るのが正しい）
            ctx = browser.new_context()
            page = ctx.new_page()
            page.route("https://viewsengineer.goatcounter.com/**", lambda route: route.fulfill(status=200, content_type="image/gif", body=GIF))
            seen: list[str] = []
            page.on("request", lambda r: seen.append(r.url))
            page.goto(url, wait_until="load")
            page.wait_for_timeout(500)
            seen.clear()
            res = page.evaluate("""async (ext) => {
              const out = {}, data = encodeURIComponent(document.getElementById('src').value || 'secret');
              try { await fetch('http://' + ext + '/fetch?d=' + data); out.fetch = 'sent'; }
              catch (e) { out.fetch = 'blocked: ' + e.name; }
              try { await fetch('http://' + ext + '/fetch-nocors', { mode: 'no-cors', method: 'POST', body: 'secret' }); out.fetchNoCors = 'sent'; }
              catch (e) { out.fetchNoCors = 'blocked: ' + e.name; }
              out.xhr = await new Promise(res => { try { const x = new XMLHttpRequest(); x.open('POST', 'http://' + ext + '/xhr');
                x.onload = () => res('sent'); x.onerror = () => res('blocked'); x.send('secret'); } catch (e) { res('blocked: ' + e.name); } });
              out.ws = await new Promise(res => { try { const w = new WebSocket('ws://' + ext + '/ws'); w.onopen = () => res('open');
                w.onerror = () => res('blocked'); setTimeout(() => res('no-open'), 1500); } catch (e) { res('blocked: ' + e.name); } });
              try { out.beacon = navigator.sendBeacon('http://' + ext + '/beacon', 'secret') ? 'queued' : 'refused'; } catch (e) { out.beacon = 'blocked: ' + e.name; }
              try { const f = document.createElement('form'); f.method = 'POST'; f.action = 'http://' + ext + '/form';
                const i = document.createElement('input'); i.name = 'd'; i.value = 'secret'; f.appendChild(i); document.body.appendChild(f); f.submit(); out.form = 'submitted'; }
              catch (e) { out.form = 'blocked: ' + e.name; }
              const img = document.createElement('img'); img.src = 'http://' + ext + '/img?d=secret'; document.body.appendChild(img);
              const sc = document.createElement('script'); sc.src = 'http://' + ext + '/script.js'; document.body.appendChild(sc);
              return out;
            }""", ext)
            page.wait_for_timeout(2500)
            check("CSP: fetch は止まる", res["fetch"].startswith("blocked") and res["fetchNoCors"].startswith("blocked"), {k: res[k] for k in ("fetch", "fetchNoCors")})
            check("CSP: XMLHttpRequest は止まる", res["xhr"].startswith("blocked"), res["xhr"])
            check("CSP: WebSocket は開かない", res["ws"] != "open", res["ws"])
            check("CSP: fetch・XHR・WebSocket・sendBeacon・フォーム・画像・スクリプトのどれも、別オリジンの受け口に1件も届かない",
                  not SINK_HITS, {"hits": SINK_HITS, "beacon": res["beacon"], "form": res["form"]})
            report["csp_probe"] = res
            ctx.close()

            # ---- トップのカード
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            page.route("**/*", lambda route: route.abort() if not route.request.url.startswith(origin) else route.continue_())
            page.goto(f"{origin}/index.html?nofx=1", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            card = page.locator('a.wm-card[href="fuseru.html"]')
            check("index: カードがある", card.count() == 1)
            card.scroll_into_view_if_needed(); page.wait_for_timeout(500)
            page.locator("#solotime").screenshot(path=str(OUT / "index_solotime_1280.png"))
            page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(500)
            card.scroll_into_view_if_needed(); page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / "index_card_390.png"))
            ctx.close()
            browser.close()
    finally:
        srv.shutdown()
        sink.shutdown()
    (OUT / "qc_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ALL PASS" if ok else "SOME FAILED", "→", OUT)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
