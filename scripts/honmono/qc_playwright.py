"""どっちが本物？: 実ブラウザ（Chrome）での QC。

  - 390x844 と 1280x800 で: はじめ / 問題 / 答えたあと / 結果 / 作り方 を撮る
  - 各状態で横スクロールが出ていないこと、コンソールエラー・ページエラー・読み込み失敗がゼロであること
  - 1回の10問で同じ作家が続かないこと、正解数の表示が実際の正誤と合うこと
  - 全50問を 390x844 で1問ずつ撮る（問題の部分だけを all/ に保存。崩れ・文字化けを目で見るため）
  - ?nofx=1 で動きが止まること

使い方:  python scripts/honmono/qc_playwright.py [出力フォルダ]
"""
from __future__ import annotations

import http.server
import json
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\tmp\honmono-qc")
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "all").mkdir(exist_ok=True)

results: list[tuple[bool, str]] = []


def check(cond: bool, msg: str) -> None:
    results.append((bool(cond), msg))
    print(("  ok   " if cond else "  FAIL ") + msg)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def attach_logs(page, bag: list[str]) -> None:
    page.on("console", lambda m: bag.append(f"console.{m.type}: {m.text}")
            if m.type in ("error", "warning") and "goatcounter: not counting because of: localhost" not in m.text else None)
    page.on("pageerror", lambda e: bag.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: bag.append(f"requestfailed: {r.url} {r.failure}") if "zgo.at" not in r.url else None)


def no_hscroll(page) -> bool:
    return page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 0.5")


# 乱数を固定（mulberry32）。左右と出題が毎回同じになる
SEED_JS = """
(() => { let s = %d; Math.random = function () { s |= 0; s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
"""


def play_round(page, shots: str | None, answer_rule) -> tuple[list[dict], int]:
    """10問を答える。answer_rule(i) → 0/1 を選ぶ。各問の作家・正誤を返す"""
    log = []
    for i in range(10):
        page.wait_for_selector("#quiz:not([hidden])")
        work = page.inner_text("#q-work")
        if shots and i == 0:
            page.screenshot(path=str(OUT / f"{shots}-2-question.png"), full_page=True)
        pick = answer_rule(i)
        page.click(f"#cand-{pick}")
        page.wait_for_selector("#reveal:not([hidden])")
        ok = "正解" in page.inner_text("#r-v")
        orig_idx = page.evaluate("document.querySelector('#cand-0').classList.contains('is-orig') ? 0 : 1")
        log.append({"work": work, "ok": ok, "orig": orig_idx, "pick": pick,
                    "tell": page.inner_text("#r-tell"), "hs": no_hscroll(page)})
        if shots and i == 0:
            page.screenshot(path=str(OUT / f"{shots}-3-answered.png"), full_page=True)
        page.click("#btn-next")
    page.wait_for_selector("#result:not([hidden])")
    big = page.inner_text("#s-big")
    return log, int(big.split("問中")[1].split("問")[0].strip())


def main() -> None:
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/honmono.html"
    data = json.loads((ROOT / "data/honmono/pairs.json").read_text(encoding="utf-8"))
    author_of = {f"{p['author']}『{p['title']}" : p["author"] for p in data["pairs"]}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for name, vw, vh in (("m390", 390, 844), ("d1280", 1280, 800)):
                print(f"== {name}")
                ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 500 else 1)
                ctx.add_init_script(SEED_JS % (7 if vw < 500 else 11))
                page = ctx.new_page()
                bag: list[str] = []
                attach_logs(page, bag)
                page.goto(base + "?nofx=1", wait_until="networkidle")
                page.wait_for_selector("#btn-start:not([disabled])")
                page.evaluate("document.fonts.ready")
                check(no_hscroll(page), f"{name} はじめ: 横スクロールなし")
                page.screenshot(path=str(OUT / f"{name}-1-start.png"))
                page.click("#btn-start")
                log, shown = play_round(page, name, lambda i: i % 2)
                actual = sum(1 for x in log if x["ok"])
                check(shown == actual, f"{name} 正解数の表示 {shown} = 実際 {actual}")
                check(all(x["ok"] == (x["pick"] == x["orig"]) for x in log), f"{name} 正誤の判定が原文の位置と合う")
                check(all(x["hs"] for x in log), f"{name} 問題: 横スクロールなし（10問）")
                check(all(x["tell"].startswith("AIの文のくせ：") and len(x["tell"]) > 12 for x in log), f"{name} 解説が出る")
                auths = [next(v for k, v in author_of.items() if x["work"].startswith(k)) for x in log]
                check(all(a != c for a, c in zip(auths, auths[1:])), f"{name} 同じ作家が続かない")
                lefts = sum(1 for x in log if x["orig"] == 0)
                print(f"     原文が A（左）: {lefts}/10、正解 {actual}/10")
                check(no_hscroll(page), f"{name} 結果: 横スクロールなし")
                page.screenshot(path=str(OUT / f"{name}-4-result.png"), full_page=False)
                page.click("#rlist li details summary")
                page.screenshot(path=str(OUT / f"{name}-5-result-full.png"), full_page=True)
                # 作り方（details を全部開く）
                page.evaluate("document.querySelectorAll('#how details').forEach(d => d.open = true)")
                check(no_hscroll(page), f"{name} 作り方: 横スクロールなし")
                page.locator("#how").screenshot(path=str(OUT / f"{name}-6-how.png"))
                rows = page.locator("#wtbody tr").count()
                check(rows == len(data["pairs"]), f"{name} 作品一覧 {rows} 行")
                # nofx の確認
                anim = page.evaluate("getComputedStyle(document.querySelector('.reveal')).animationName")
                check(anim == "none", f"{name} ?nofx=1 で動きが止まる（{anim}）")
                check(not bag, f"{name} コンソール・ページエラーなし {bag[:3]}")
                ctx.close()

            # 全問を 390x844 で撮る（乱数の種を変えて、全作品が出るまで回す）
            print("== all 50 (390x844)")
            seen: set[str] = set()
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            seed = 100
            bag = []
            while len(seen) < len(data["pairs"]) and seed < 400:
                ctx.clear_cookies()
                page = ctx.new_page()
                page.add_init_script(SEED_JS % seed)
                attach_logs(page, bag)
                page.goto(base + "?nofx=1", wait_until="networkidle")
                page.wait_for_selector("#btn-start:not([disabled])")
                page.click("#btn-start")
                for i in range(10):
                    work = page.inner_text("#q-work")
                    key = next(p["id"] for p in data["pairs"] if work.startswith(f"{p['author']}『{p['title']}"))
                    if key not in seen:
                        seen.add(key)
                        page.locator("#quiz").screenshot(path=str(OUT / "all" / f"{len(seen):02d}-{key}.png"))
                    page.click("#cand-0")
                    page.click("#btn-next")
                page.close()
                seed += 1
            check(len(seen) == len(data["pairs"]), f"全 {len(seen)} 問を撮った")
            check(not bag, f"全問: コンソール・ページエラーなし {bag[:3]}")
            b.close()
    finally:
        srv.shutdown()
    bad = [m for ok, m in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} ok")
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
