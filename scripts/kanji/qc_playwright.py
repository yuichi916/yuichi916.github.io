"""まぜる漢字: 画面の検査（Python Playwright, channel="chrome"）。

使い方:  python scripts/kanji/qc_playwright.py [出力先=C:/tmp/mazeru-kanji-qc]
  - 1280x800 と 390x844（タッチ）で: はじめの画面、遊び方、きょうの7字の途中、正解の瞬間、段位が上がったとき、
    辞書にはある言葉、ヒント、結果と共有文、きのうの答え（翌日に時計を進めて）、れんしゅう、答え合わせ、プリントの画面
  - プリントは page.pdf で A4 の PDF を出し、1枚目と2枚目を PNG にする（和同開珎・7字でつくる・大きい文字）
  - きょうの7字を最後まで解いて「漢字王」と共有文を確かめる
  - ページのエラー・コンソールのエラー・横スクロールが 0 であること
"""
from __future__ import annotations

import http.server
import json
import socketserver
import sys
import threading
from datetime import datetime, timedelta, timezone
from functools import partial
from pathlib import Path

import fitz  # PyMuPDF
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/mazeru-kanji-qc")
OUT.mkdir(parents=True, exist_ok=True)
JST = timezone(timedelta(hours=9))
DAY1 = datetime(2026, 10, 25, 12, 0, tzinfo=JST)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class TS(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


srv = TS(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/mazeru.html"

errors: list[str] = []
results: dict = {}


def watch(page, tag):
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror {e}"))
    page.on("console", lambda m: m.type == "error" and "goatcounter" not in m.text and "gc.zgo.at" not in m.text
            and errors.append(f"[{tag}] console {m.text}"))


def ready(page):
    page.wait_for_function("window.__mk && window.__mk.ready === true", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)


def no_hscroll(page, tag):
    w = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    if w[0] > w[1] + 1:
        errors.append(f"[{tag}] 横スクロール {w}")


def shot(page, name, full=False):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def play_word(page, word, root="#d-game"):
    """タイルを順にタップして「まぜる」。"""
    for ch in word:
        page.locator(f'{root} .hive .tile[data-ch="{ch}"]').first.click()
    page.locator(f'{root} [data-a="mix"]').click()


def extra_word(page, letters):
    return page.evaluate("""async (L) => {
        const t = await (await fetch('data/kanji/extra.txt')).text();
        return t.split('\\n').find(w => w.length >= 2 && [...w].every(c => L.includes(c))) || null; }""", letters)


def run(pw, mobile: bool):
    tag = "m" if mobile else "d"
    vp = {"width": 390, "height": 844} if mobile else {"width": 1280, "height": 800}
    br = pw.chromium.launch(channel="chrome")
    ctx = br.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, locale="ja-JP")
    page = ctx.new_page()
    watch(page, tag)
    page.clock.set_fixed_time(DAY1)
    page.goto(BASE)
    ready(page)
    shot(page, f"{tag}01_home")
    no_hscroll(page, tag + " home")

    page.locator(".go-main").click()
    page.wait_for_timeout(400)
    shot(page, f"{tag}02_help")
    page.locator("#md-help [data-close]").first.click()

    d = page.evaluate("__mk.daily()")
    ans = d["answers"]
    results[f"{tag}_daily_answers"] = ans
    # 3字以上を後に回して、途中の画面を作る
    order = sorted(ans, key=len)
    rank_shot = False
    for i, w in enumerate(order[: max(4, len(order) // 2)]):
        before = page.evaluate("__mk.daily().rank")
        play_word(page, w)
        if i == 1:
            page.wait_for_timeout(260)
            shot(page, f"{tag}04_correct")
        after = page.evaluate("__mk.daily().rank")
        if after != before and not rank_shot:
            page.wait_for_timeout(350)
            shot(page, f"{tag}05_rankup")
            rank_shot = True
        page.wait_for_timeout(450)
    page.wait_for_timeout(1500)
    shot(page, f"{tag}03_daily_mid")
    no_hscroll(page, tag + " daily")
    # 辞書にはある言葉・辞書にない
    letters = page.evaluate("[...document.querySelectorAll('#d-game .hive .tile')].map(t => t.dataset.ch).join('')")
    ex = extra_word(page, letters)
    if ex:
        page.locator('#d-game [data-r="kbin"]').fill(ex)
        page.locator('#d-game [data-r="kb"] button').click()
        page.wait_for_timeout(500)
        results[f"{tag}_extra_msg"] = page.locator('#d-game [data-r="msg"]').inner_text()
        shot(page, f"{tag}06_extra")
    page.locator('#d-game [data-r="kbin"]').fill("かざん")
    page.locator('#d-game [data-r="kb"] button').click()
    page.wait_for_timeout(300)
    results[f"{tag}_kana_msg"] = page.locator('#d-game [data-r="msg"]').inner_text()
    # ヒント
    page.locator('#d-game [data-b="hint"]').click()
    page.wait_for_timeout(300)
    shot(page, f"{tag}07_hint")
    page.keyboard.press("Escape")
    # 結果と共有
    page.locator('#d-game [data-b="result"]').click()
    page.wait_for_timeout(400)
    shot(page, f"{tag}08_result")
    results[f"{tag}_share"] = page.locator("#res-pre").inner_text()
    page.keyboard.press("Escape")

    # 翌日: 時計を進めて、きのうの答え
    page.clock.set_fixed_time(DAY1 + timedelta(days=1))
    page.goto(BASE)
    ready(page)
    shot(page, f"{tag}09_nextday")
    page.locator('#d-game [data-b="yday"]').click()
    page.wait_for_timeout(400)
    shot(page, f"{tag}10_yesterday")
    results[f"{tag}_yday_hits"] = page.locator("#yday-body .word.hit").count()
    results[f"{tag}_yday_miss"] = page.locator("#yday-body .word.miss").count()
    page.keyboard.press("Escape")

    # れんしゅう
    page.goto(BASE + "?mode=practice")
    ready(page)
    page.locator('#p-grades button[data-g="4"]').click()
    page.wait_for_timeout(300)
    p = page.evaluate("__mk.practice()")
    results[f"{tag}_practice_answers"] = p["answers"]
    for w in sorted(p["answers"], key=len)[:3]:
        play_word(page, w, "#p-game")
        page.wait_for_timeout(450)
    page.wait_for_timeout(1300)
    shot(page, f"{tag}11_practice")
    page.locator('#p-game [data-b="end"]').click()
    page.wait_for_timeout(700)
    shot(page, f"{tag}12_practice_result")
    no_hscroll(page, tag + " practice")
    for g in ["2", "6", "8"]:
        page.locator(f'#p-grades button[data-g="{g}"]').click()
        page.wait_for_timeout(200)
        results[f"{tag}_practice_g{g}"] = page.evaluate("__mk.practice()")["answers"]

    # プリント
    page.goto(BASE + "?mode=print&fmt=a&lv=high&n=9&size=n&seed=qc01")
    ready(page)
    page.wait_for_timeout(400)
    shot(page, f"{tag}13_print")
    no_hscroll(page, tag + " print")
    if not mobile:
        shot(page, f"{tag}13_print_full", full=True)
        for name, q in [("a9", "fmt=a&lv=high&n=9&size=n&seed=qc01"), ("a12big", "fmt=a&lv=adult&n=12&size=l&seed=qc02"),
                        ("a6low", "fmt=a&lv=low&n=6&size=l&seed=qc03"), ("b4", "fmt=b&lv=mid&n=4&size=n&seed=qc04"),
                        ("b2big", "fmt=b&lv=low&n=2&size=l&seed=qc05"), ("b1", "fmt=b&lv=adult&n=1&size=n&seed=qc06")]:
            page.goto(BASE + "?mode=print&" + q)
            ready(page)
            page.wait_for_timeout(300)
            info = page.evaluate("__mk.print()")
            results[f"print_{name}"] = info
            pdf = OUT / f"print_{name}.pdf"
            page.pdf(path=str(pdf), format="A4", print_background=True, prefer_css_page_size=True)
            doc = fitz.open(str(pdf))
            results[f"print_{name}_pages"] = doc.page_count
            for i, pg in enumerate(doc):
                pg.get_pixmap(dpi=110).save(str(OUT / f"print_{name}_p{i + 1}.png"))
            doc.close()
    ctx.close()
    br.close()


def full_solve(pw):
    """きょうの7字を最後まで解いて、漢字王と共有文を確かめる（スマホ）。"""
    br = pw.chromium.launch(channel="chrome")
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ja-JP")
    page = ctx.new_page()
    watch(page, "solve")
    page.clock.set_fixed_time(DAY1 + timedelta(days=2))
    page.goto(BASE + "?mode=daily&nofx=1")
    ready(page)
    page.locator("#md-help [data-close]").first.click()
    ans = page.evaluate("__mk.daily().answers")
    # ドラッグで2字を重ねる操作も1回確かめる
    two = next(w for w in ans if len(w) == 2)
    a = page.locator(f'#d-game .tile[data-ch="{two[0]}"]').bounding_box()
    b = page.locator(f'#d-game .tile[data-ch="{two[1]}"]').bounding_box()
    page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
    page.mouse.down()
    page.mouse.move(a["x"] + 30, a["y"] + 30, steps=4)
    page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    results["drag_found"] = page.evaluate("__mk.daily().found")
    for w in ans:
        if w in results["drag_found"]:
            continue
        page.locator('#d-game [data-r="kbin"]').fill(w)
        page.locator('#d-game [data-r="kb"] button').click()
        page.wait_for_timeout(60)
    page.wait_for_timeout(900)
    d = page.evaluate("__mk.daily()")
    results["solve"] = {"found": len(d["found"]), "total": len(d["answers"]), "rank": d["rank"], "score": d["score"], "max": d["max"], "share": d["share"]}
    results["solve_result_open"] = page.locator("#md-result").is_visible()
    shot(page, "m14_solved_result")
    ctx.close()
    br.close()


with sync_playwright() as pw:
    run(pw, mobile=False)
    run(pw, mobile=True)
    full_solve(pw)

srv.shutdown()
results["errors"] = errors
(OUT / "qc_result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: v for k, v in results.items() if not k.endswith("answers") and not k.startswith("m_practice_g") and not k.startswith("d_practice_g")}, ensure_ascii=False, indent=1))
print("errors:", len(errors))
sys.exit(1 if errors else 0)
