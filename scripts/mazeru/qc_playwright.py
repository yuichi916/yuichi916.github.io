"""まぜる日本: 画面の検査（Python Playwright, channel="chrome"）。

使い方:  python scripts/mazeru/qc_playwright.py [出力先=C:/tmp/mazeru-qc]
  - 390x844（タッチ）と 1280x800 で、初期・まぜた直後・図鑑・共有・ヒント・説明欄を撮る
  - マウスのドラッグ（一覧→盤、盤の札→盤の札）、タップ2回、スマホの長押しドラッグ（CDP のタッチ）でまぜられること
  - コンソールのエラーと横スクロールがないこと
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
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/mazeru-qc")
OUT.mkdir(parents=True, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def chip(page, name):
    return page.locator(f'.chip:has-text("{name}")').first


def center(box):
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def state(page):
    return page.evaluate("window.__mazeru.state()")


def mouse_drag(page, src, dst_xy, steps=12):
    x, y = center(src.bounding_box())
    page.mouse.move(x, y)
    page.mouse.down()
    tx, ty = dst_xy
    page.mouse.move(x + 8, y - 8, steps=2)
    page.mouse.move(tx, ty, steps=steps)
    page.mouse.up()
    page.wait_for_timeout(250)


def touch_drag(page, cdp, src_xy, dst_xy, hold_ms=320, steps=10):
    x, y = src_xy
    tp = lambda px, py: [{"x": px, "y": py, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp(x, y)})
    page.wait_for_timeout(hold_ms)
    tx, ty = dst_xy
    for i in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": tp(x + (tx - x) * i / steps, y + (ty - y) * i / steps)})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(250)


def run_case(p, base, name, vp, mobile):
    res = {"case": name, "errors": [], "checks": {}}
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, locale="ja-JP")
    page = ctx.new_page()
    page.on("console", lambda m: res["errors"].append("console: " + m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: res["errors"].append("pageerror: " + str(e)))
    page.goto(base + "/mazeru.html?nofx=1", wait_until="networkidle")
    page.wait_for_function("window.__mazeru && window.__mazeru.state().ready")
    page.wait_for_function("window.__mazeru.state().loaded > 0")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{name}-01-initial.png"))
    st0 = state(page)
    res["checks"]["initial_found"] = st0["found"]

    board = page.locator("#board").bounding_box()
    bc = (board["x"] + board["width"] * 0.45, board["y"] + board["height"] * 0.5)
    # 1) マウスのドラッグ: 一覧の「水」を盤へ、続けて「火」をその上へ
    mouse_drag(page, chip(page, "水"), bc)
    res["checks"]["mouse_drop_places_item"] = state(page)["items"] == 1
    item = page.locator(".it:not(.ghost)").first
    mouse_drag(page, chip(page, "火"), center(item.bounding_box()))
    page.wait_for_timeout(300)
    st1 = state(page)
    res["checks"]["mouse_drag_mix"] = st1["mixes"] == st0["mixes"] + 1
    res["checks"]["after_mouse_mix"] = st1
    page.screenshot(path=str(OUT / f"{name}-02-mixed.png"))

    # 2) 盤の札どうしのドラッグ: 「土」を置いて、盤の上の札をそこへ重ねる
    page.click("#btn-clear")
    mouse_drag(page, chip(page, "土"), (board["x"] + board["width"] * 0.3, board["y"] + board["height"] * 0.5))
    mouse_drag(page, chip(page, "水"), (board["x"] + board["width"] * 0.7, board["y"] + board["height"] * 0.5))
    its = page.locator(".it:not(.ghost)")
    before = state(page)
    mouse_drag(page, its.nth(1), center(its.nth(0).bounding_box()))
    page.wait_for_timeout(300)
    after = state(page)
    res["checks"]["board_item_drag_mix"] = {"before": before, "after": after, "ok": after["mixes"] == before["mixes"] + 1}

    # 3) タップ2回: 「米」→「水」
    page.click("#btn-clear")
    before = state(page)
    if mobile:
        chip(page, "米").tap(); chip(page, "水").tap()
    else:
        chip(page, "米").click(); chip(page, "水").click()
    page.wait_for_timeout(400)
    after = state(page)
    res["checks"]["tap_twice_mix"] = {"before": before, "after": after, "ok": after["mixes"] == before["mixes"] + 1}

    # 4) スマホ: 長押しドラッグ（CDP のタッチ）で一覧→盤に置ける
    if mobile:
        page.click("#btn-clear")
        cdp = ctx.new_cdp_session(page)
        before = state(page)
        touch_drag(page, cdp, center(chip(page, "木").bounding_box()), bc)
        mid = state(page)
        it = page.locator(".it:not(.ghost)").first
        touch_drag(page, cdp, center(chip(page, "風").bounding_box()), center(it.bounding_box()))
        page.wait_for_timeout(300)
        after = state(page)
        res["checks"]["touch_longpress_drag"] = {"before": before, "placed": mid, "after": after,
                                                 "ok": mid["items"] == 1 and after["mixes"] == mid["mixes"] + 1}
        # 長押しせずに縦に動かすと、ドラッグにならない（スクロール扱い）
        page.click("#btn-clear")
        c = center(chip(page, "人").bounding_box())
        tp = lambda px, py: [{"x": px, "y": py, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp(*c)})
        for i in range(1, 8):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": tp(c[0], c[1] - 12 * i)})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(200)
        res["checks"]["quick_swipe_is_not_drag"] = state(page)["items"] == 0

    # 5) 発見を増やす（表から、手元の要素でできる未発見の組をタップで10回まぜる）
    page.click("#btn-clear")
    page.evaluate("Promise.all(Array.from({length: 16}, (_, i) => fetch('data/mazeru/r/' + String(i).padStart(2,'0') + '.txt')))")
    page.click("#btn-hint"); page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / f"{name}-05-hint.png"))
    page.click("#md-hint [data-close]")
    for _ in range(12):
        r = page.evaluate("window.__mazeru.recipeFor()")
        if not r:
            break
        a, bb, _r = r
        page.locator(f'.chip[data-e="{a}"]').first.click()
        page.locator(f'.chip[data-e="{bb}"]').first.click()
        page.wait_for_timeout(250)
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / f"{name}-03-after-discoveries.png"))
    res["checks"]["found_after_loop"] = state(page)["found"]

    # 6) 図鑑・詳細
    page.click("#btn-zukan"); page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{name}-04-zukan.png"))
    page.locator(".zk[data-e]").first.click(); page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{name}-04b-zukan-detail.png"))
    page.click("#md-zukan [data-close]")

    # 7) 共有
    page.click("#btn-share"); page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{name}-06-share.png"))
    res["checks"]["share_text"] = page.locator("#share-pre").inner_text()
    page.click("#md-share [data-close]")

    # 8) 説明欄
    page.locator("#about").scroll_into_view_if_needed(); page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / f"{name}-07-about.png"), full_page=False)
    res["checks"]["no_hscroll"] = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    # 再読み込みで記録が残る
    n = state(page)["found"]
    page.reload(wait_until="networkidle")
    page.wait_for_function("window.__mazeru && window.__mazeru.state().ready")
    res["checks"]["persist_after_reload"] = state(page)["found"] == n
    b.close()
    return res


def main():
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    out = []
    try:
        with sync_playwright() as p:
            out.append(run_case(p, base, "m390", {"width": 390, "height": 844}, True))
            out.append(run_case(p, base, "d1280", {"width": 1280, "height": 800}, False))
    finally:
        srv.shutdown()
    (OUT / "qc_result.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
