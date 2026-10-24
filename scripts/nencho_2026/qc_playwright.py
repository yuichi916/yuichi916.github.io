"""年末調整の計算機: Playwright（Chrome）で画面を確かめる。

使い方:  python scripts/nencho_2026/qc_playwright.py [出力フォルダ]   （既定 C:\\tmp\\nencho-qc）
  - 390x844（スマホ）と 1280x800（PC）で、空の状態・入力後・内訳を開いた状態・出典の表をスクリーンショット
  - 国税庁の設例2（令和8年分 26,100円／令和7年分 34,300円）を画面から入力し、表示が一致するか
  - 横スクロールが出ていないか、コンソールエラーが 0 か
"""
from __future__ import annotations

import http.server
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\tmp\nencho-qc")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def fill(page, sel, v):
    page.fill(sel, str(v))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/nencho-2026.html?nofx=1"
    fails = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for name, vp in [("390", {"width": 390, "height": 844}), ("1280", {"width": 1280, "height": 800})]:
                ctx = b.new_context(viewport=vp, device_scale_factor=2 if name == "390" else 1, is_mobile=name == "390", has_touch=name == "390")
                page = ctx.new_page()
                errors = []
                # GoatCounter は本番と同じく読み込む（localhost では数えない旨の警告だけは除く）
                page.on("console", lambda m: errors.append(m.text) if m.type in ("error", "warning") and "not counting because of: localhost" not in m.text else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(base, wait_until="networkidle")
                page.wait_for_function("document.querySelectorAll('#src-tbl .srow').length > 5")
                page.evaluate("document.fonts.ready")
                page.screenshot(path=str(OUT / f"{name}-01-top.png"))
                page.screenshot(path=str(OUT / f"{name}-02-full-empty.png"), full_page=True, scale="css")

                # 設例2（過不足額の精算の設例）を画面から入れる
                fill(page, "#salary", "439")
                page.click("[data-sp='1']")
                fill(page, "#spSalary", "0")
                row = page.locator(".kid", has_text="23〜69歳").first
                row.locator("[data-d='1']").click()
                fill(page, "#si", "64.1525")
                page.click("details.more >> text=2011年以前の契約")
                fill(page, "#lifeGenOld", "50200")
                fill(page, "#lifePen", "56000")
                fill(page, "#quake", "45000")
                fill(page, "#bonus", "70")
                page.wait_for_timeout(100)
                refund = page.inner_text("#refund-v").replace("\n", "")
                if "26,200" not in refund:
                    fails.append(f"{name}: 戻る目安 {refund!r} ≠ 約26,200（見込み 52,285 − 26,100）")
                tax = page.inner_text("#tax-v").replace("\n", "")
                last = page.inner_text("#last-v").replace("\n", "")
                if "26,100" not in tax:
                    fails.append(f"{name}: 令和8年分の表示 {tax!r} ≠ 26,100")
                if "34,300" not in last:
                    fails.append(f"{name}: 令和7年分の表示 {last!r} ≠ 34,300")
                page.evaluate("document.getElementById('h-result').scrollIntoView({block:'start'})")
                page.screenshot(path=str(OUT / f"{name}-03-result.png"))
                page.click("#bd > summary")
                page.wait_for_timeout(100)
                page.locator("#bd").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{name}-04-breakdown.png"))
                page.screenshot(path=str(OUT / f"{name}-05-full-filled.png"), full_page=True, scale="css")

                # 家族の多い例・19〜22歳の入力欄
                fill(page, "#salary", "980")
                row = page.locator(".kid", has_text="19〜22歳").first
                row.locator("[data-d='1']").click()
                row.locator("[data-d='1']").click()
                page.fill("[data-st='1']", "150")
                page.locator(".kid", has_text="16歳未満").first.locator("[data-d='1']").click()
                page.wait_for_timeout(100)
                page.locator("#kids").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{name}-06-family.png"))
                page.evaluate("document.getElementById('h-result').scrollIntoView({block:'start'})")
                page.screenshot(path=str(OUT / f"{name}-07-family-result.png"))

                # 対象外（2,000万円超）
                fill(page, "#salary", "2100")
                page.wait_for_timeout(100)
                msg = page.inner_text("#notEligible")
                if "2,000万円" not in msg:
                    fails.append(f"{name}: 2,000万円超の案内が出ない: {msg!r}")
                page.evaluate("document.getElementById('h-result').scrollIntoView({block:'start'})")
                page.screenshot(path=str(OUT / f"{name}-08-over2000.png"))

                page.locator("#sources").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{name}-09-sources.png"))

                sw = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
                if sw[0] > sw[1]:
                    fails.append(f"{name}: 横スクロール {sw}")
                if errors:
                    fails.append(f"{name}: コンソールエラー {errors}")
                print(f"{name}: 令和8年分 {tax} / 令和7年分 {last} / scrollWidth {sw} / errors {len(errors)}")
                ctx.close()
            b.close()
    finally:
        srv.shutdown()
    for f in fails:
        print("FAIL", f)
    print("screenshots:", OUT)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
