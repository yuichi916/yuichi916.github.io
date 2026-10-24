"""きょうの県: 実ブラウザ（Chrome）での QC。

  - 390x844 と 1280x800 で: 初期 / ヒント3つ / 外れ（距離と矢印）/ 正解後の結果 / 共有テキスト を撮る
  - 各状態で横スクロールが出ていないこと、コンソールエラー・ページエラーがゼロであること
  - localStorage を使えなくしても最後まで遊べること
  - 日付の境目が日本時間 0 時であること（ブラウザの時計を差し替えて確かめる）
  - 過去の問題（?day=）が開けること

使い方:  python scripts/kyou_no_ken/qc_playwright.py [出力フォルダ]
"""
from __future__ import annotations

import http.server
import json
import socketserver
import sys
import threading
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\tmp\kyou-no-ken-qc")
OUT.mkdir(parents=True, exist_ok=True)

# 2026-10-24 12:00 JST（= 03:00 UTC）。#1 の日
T_DAY1 = datetime(2026, 10, 24, 3, 0, 0, tzinfo=timezone.utc)

results: list[tuple[bool, str]] = []


def check(cond: bool, msg: str) -> None:
    results.append((bool(cond), msg))
    print(("  ok   " if cond else "  FAIL ") + msg)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):  # noqa: D401
        pass


def serve() -> tuple[socketserver.TCPServer, int]:
    handler = partial(Quiet, directory=str(ROOT))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def attach_logs(page, bag: list[str]) -> None:
    # GoatCounter は localhost では数えない旨の warning を出す（本番では出ない）。それ以外の error / warning を拾う
    page.on("console", lambda m: bag.append(f"console.{m.type}: {m.text}")
            if m.type in ("error", "warning") and "goatcounter: not counting because of: localhost" not in m.text else None)
    page.on("pageerror", lambda e: bag.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: bag.append(f"requestfailed: {r.url} {r.failure}") if "zgo.at" not in r.url else None)


def no_hscroll(page) -> bool:
    return page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 0.5")


def overflowing(page) -> list[str]:
    """はみ出している要素（右端が画面外）を探す。"""
    return page.evaluate("""() => {
      const W = document.documentElement.clientWidth, out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed') out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.right));
      }
      return out.slice(0, 5);
    }""")


def clipped_text(page) -> list[str]:
    """文字が箱からはみ出して切れている要素（overflow:hidden で隠れている）を探す。省略記号を意図したもの以外。"""
    return page.evaluate("""() => {
      const out = [];
      for (const el of document.querySelectorAll('.hint *, .try *, .bar *, .modal:not([hidden]) *, .ask *')) {
        const cs = getComputedStyle(el);
        if (el.children.length) continue;
        if (cs.textOverflow === 'ellipsis') continue;
        if (el.scrollWidth > el.clientWidth + 1 && (cs.overflow === 'hidden' || cs.overflowX === 'hidden')) out.push(el.className + ':' + el.textContent.slice(0, 20));
      }
      return out.slice(0, 5);
    }""")


def answer_info(page) -> dict:
    return page.evaluate("""async () => {
      const K = window.KyouNoKen;
      const data = await (await fetch('data/kyou-no-ken/data.json')).json();
      const day = K.dayIndexAt(Date.now());
      const ans = K.prefForDay(day);
      const others = data.prefs.map((p, i) => ({ i, name: p.name, kana: p.kana, km: K.clue(data, i, ans).km })).filter(x => x.i !== ans);
      others.sort((a, b) => a.km - b.km);
      return { day, ans, name: data.prefs[ans].name, kana: data.prefs[ans].kana, near: others[0], far: others[others.length - 1] };
    }""")


def type_and_pick(page, kana: str, name: str) -> None:
    page.click("#q")
    page.fill("#q", "")
    page.type("#q", kana, delay=10)
    page.click(f"#sugg button:has-text('{name}')")
    page.click("#btn-go")


def run_viewport(p, base: str, label: str, w: int, h: int) -> None:
    print(f"[{label}] {w}x{h}")
    bag: list[str] = []
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 500 else 1,
                              is_mobile=w < 500, has_touch=w < 500, locale="ja-JP", timezone_id="Asia/Tokyo")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    page = ctx.new_page()
    attach_logs(page, bag)
    page.clock.set_fixed_time(T_DAY1)
    page.goto(base + "/kyou-no-ken.html?nofx=1", wait_until="networkidle")
    page.wait_for_selector(".hint .val")
    page.wait_for_timeout(300)
    check(page.is_visible("#md-help"), f"{label}: 初回は遊び方が開く")
    page.screenshot(path=str(OUT / f"{label}-01-initial-help.png"))
    page.click("#md-help [data-close].btn")
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / f"{label}-02-initial.png"))
    check(page.inner_text("#m-no") == "#1", f"{label}: 2026-10-24 は #1")
    check(page.locator(".hint:not(.closed)").count() == 1, f"{label}: 初期はヒント1つ")
    check(no_hscroll(page), f"{label}: 初期 横スクロールなし {overflowing(page)}")
    check(not clipped_text(page), f"{label}: 初期 文字の切れなし {clipped_text(page)}")

    info = answer_info(page)
    print(f"  答え: {info['name']} / 近い外れ: {info['near']['name']} {info['near']['km']:.0f}km / 遠い外れ: {info['far']['name']} {info['far']['km']:.0f}km")
    # 候補の表示を撮る
    page.click("#q"); page.type("#q", "か", delay=10); page.wait_for_timeout(100)
    page.screenshot(path=str(OUT / f"{label}-03-suggest.png"))
    page.fill("#q", "")
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUT / f"{label}-03b-suggest-all.png"))
    box = page.locator("#sugg").bounding_box()
    check(box and box["y"] >= 52 and box["y"] + box["height"] <= h + 0.5,
          f"{label}: 候補リスト（47県）が上の帯の下・画面の中に収まる {box}")
    page.keyboard.press("Escape")
    # 遠い県 → 近い県 と外す
    type_and_pick(page, info["far"]["kana"], info["far"]["name"])
    page.wait_for_timeout(150)
    type_and_pick(page, info["near"]["kana"], info["near"]["name"])
    page.wait_for_timeout(400)
    page.mouse.click(5, 300)  # 候補を閉じる
    page.wait_for_timeout(100)
    check(page.locator(".hint:not(.closed)").count() == 3, f"{label}: 2回外すとヒント3つ")
    page.evaluate("window.scrollTo(0,0)")
    page.screenshot(path=str(OUT / f"{label}-04-hints3.png"))
    page.screenshot(path=str(OUT / f"{label}-04-hints3-full.png"), full_page=True)
    rows = page.locator(".try").all_inner_texts()
    check(len(rows) == 2 and "km" in rows[0] and "km" in rows[1], f"{label}: 外れに距離が出る {rows}")
    check(page.locator(".try .dir svg").count() == 2, f"{label}: 外れに方角の矢印が出る")
    km_far = int(rows[0].split("km")[0].split()[-1].replace(",", ""))
    check(abs(km_far - round(info["far"]["km"])) <= 1, f"{label}: 表示の距離 {km_far}km = 計算 {info['far']['km']:.1f}km")
    page.locator(".try").last.scroll_into_view_if_needed()
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUT / f"{label}-05-miss.png"))
    check(no_hscroll(page), f"{label}: 外れ表示 横スクロールなし {overflowing(page)}")
    check(not clipped_text(page), f"{label}: 外れ表示 文字の切れなし {clipped_text(page)}")

    # 正解
    type_and_pick(page, info["kana"], info["name"])
    page.wait_for_selector("#md-result:not([hidden])")
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{label}-06-result.png"))
    check(info["name"] in page.inner_text("#res-body"), f"{label}: 結果に答えの県名")
    check("ヒント3つ目で正解" in page.inner_text("#res-body"), f"{label}: ヒント3つ目で正解と出る")
    check(no_hscroll(page), f"{label}: 結果 横スクロールなし {overflowing(page)}")
    check(not clipped_text(page), f"{label}: 結果 文字の切れなし {clipped_text(page)}")
    # 共有テキスト
    page.click("#btn-copy")
    page.wait_for_timeout(300)
    # Windows のクリップボードは読み出すと改行が CRLF になるので LF に戻して比べる
    clip = page.evaluate("navigator.clipboard.readText()").replace(chr(13) + chr(10), chr(10))
    (OUT / f"{label}-share.txt").write_text(clip, encoding="utf-8")
    page.locator("#share-pre").scroll_into_view_if_needed()
    page.locator("#md-result .card").screenshot(path=str(OUT / f"{label}-07-share-card.png"))
    page.screenshot(path=str(OUT / f"{label}-07-share.png"))
    lines = clip.split("\n")
    check(lines[0] == "きょうの県 #1 3/6", f"{label}: 共有 1行目 {lines[0]!r}")
    check(len(lines[1]) >= 3 and lines[1].endswith("🟩"), f"{label}: 共有 マス {lines[1]!r}")
    check(lines[-1] == "https://yuichi916.github.io/kyou-no-ken.html?ref=x", f"{label}: 共有 URL に ?ref=x")
    check(info["name"] not in clip and info["name"][:-1] not in clip, f"{label}: 共有文に答えが出ない")
    check(page.inner_text("#btn-copy").startswith("コピーしました") and not page.is_visible("#toast"), f"{label}: コピーしましたの表示（ボタンの文字。答えの上に重ねない）")
    # 結果を閉じた後の画面（全ヒント公開）
    page.click("#md-result [data-close]")
    page.wait_for_timeout(150)
    check(page.locator(".hint:not(.closed)").count() == 6, f"{label}: 終わると6つ全部見える")
    page.screenshot(path=str(OUT / f"{label}-08-after.png"), full_page=True)
    check(no_hscroll(page), f"{label}: 終了後 横スクロールなし {overflowing(page)}")
    # 再読み込みで状態が残る
    page.reload(wait_until="networkidle")
    page.wait_for_selector("#md-result:not([hidden])")
    check(page.locator(".try").count() == 3, f"{label}: 再読み込みしても答えが残る")
    st = page.evaluate("JSON.parse(localStorage.getItem('kyou-no-ken:v1')).stats")
    check(st["played"] == 1 and st["wins"] == 1 and st["streak"] == 1 and st["dist"][2] == 1, f"{label}: 成績が保存される {st}")
    page.click("#md-result [data-close]")

    # 翌日: 連続正解がつながる
    page.clock.set_fixed_time(datetime(2026, 10, 25, 3, 0, tzinfo=timezone.utc))
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".hint .val")
    check(page.inner_text("#m-no") == "#2", f"{label}: 翌日は #2")
    info2 = answer_info(page)
    type_and_pick(page, info2["kana"], info2["name"])
    page.wait_for_selector("#md-result:not([hidden])")
    st = page.evaluate("JSON.parse(localStorage.getItem('kyou-no-ken:v1')).stats")
    check(st["streak"] == 2 and st["maxStreak"] == 2, f"{label}: 2日続けて正解で連続2 {st['streak']}")
    page.screenshot(path=str(OUT / f"{label}-09-day2-result.png"))
    page.click("#md-result [data-close]")
    # 過去の問題
    page.click("#btn-arch2")
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / f"{label}-10-archive.png"))
    page.click("#arch-list a:has-text('#1')")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".hint .val")
    check(page.inner_text("#m-no") == "#1" and "過去の問題" in page.inner_text("#m-mode"), f"{label}: ?day=1 で過去の問題が開く")
    page.goto(base + "/kyou-no-ken.html?day=99&nofx=1", wait_until="networkidle")
    page.wait_for_selector(".hint .val")
    check(page.inner_text("#m-no") == "#2", f"{label}: 未来の ?day= は今日に戻す")

    check(not bag, f"{label}: コンソールエラー・ページエラーなし {bag[:5]}")
    browser.close()


def run_nostorage(p, base: str) -> None:
    print("[nostorage] localStorage を使えなくする")
    bag: list[str] = []
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("""
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    """)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    page = ctx.new_page()
    attach_logs(page, bag)
    page.clock.set_fixed_time(T_DAY1)
    page.goto(base + "/kyou-no-ken.html?nofx=1", wait_until="networkidle")
    page.wait_for_selector(".hint .val")
    check(page.evaluate("(() => { try { localStorage; return false } catch (e) { return true } })()"), "nostorage: localStorage に触ると例外になる状態")
    check(not page.is_visible("#md-help"), "nostorage: 保存できないときは遊び方を毎回押し付けない")
    info = answer_info(page)
    page.click("#btn-skip")
    page.wait_for_timeout(100)
    type_and_pick(page, info["far"]["kana"], info["far"]["name"])
    page.wait_for_timeout(100)
    type_and_pick(page, info["kana"], info["name"])
    page.wait_for_selector("#md-result:not([hidden])")
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / "nostorage-result.png"))
    txt = page.inner_text("#share-pre")
    check(txt.split("\n")[1].startswith("⬜") and txt.split("\n")[0].endswith("3/6"), f"nostorage: パス→外れ→正解で 3/6 {txt.splitlines()[:2]}")
    check("保存できない" in page.inner_text("#res-note"), "nostorage: 保存できない旨を結果に小さく出す")
    check(not bag, f"nostorage: コンソールエラー・ページエラーなし {bag[:5]}")
    browser.close()


def run_boundary(p, base: str) -> None:
    print("[boundary] 日本時間 0 時の境目")
    browser = p.chromium.launch(channel="chrome")
    out = {}
    for tz in ("Asia/Tokyo", "America/Los_Angeles", "UTC"):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, timezone_id=tz)
        page = ctx.new_page()
        for label, t in (("JST 23:59:59", datetime(2026, 10, 24, 14, 59, 59, tzinfo=timezone.utc)),
                         ("JST 00:00:00", datetime(2026, 10, 24, 15, 0, 0, tzinfo=timezone.utc))):
            page.clock.set_fixed_time(t)
            page.goto(base + "/kyou-no-ken.html?nofx=1", wait_until="networkidle")
            page.wait_for_selector(".hint .val")
            out[(tz, label)] = (page.inner_text("#m-no"), page.inner_text("#m-date"))
        ctx.close()
    for k, v in out.items():
        print("   ", k, v)
    check(all(out[(tz, "JST 23:59:59")] == ("#1", "2026年10月24日（土）") for tz in ("Asia/Tokyo", "America/Los_Angeles", "UTC")),
          "10/24 23:59:59 JST はどの端末のタイムゾーンでも #1（10月24日）")
    check(all(out[(tz, "JST 00:00:00")] == ("#2", "2026年10月25日（日）") for tz in ("Asia/Tokyo", "America/Los_Angeles", "UTC")),
          "10/25 00:00:00 JST でどの端末のタイムゾーンでも #2 に変わる")
    browser.close()


def main() -> None:
    srv, port = serve()
    base = f"http://127.0.0.1:{port}"
    try:
        with sync_playwright() as p:
            run_viewport(p, base, "390", 390, 844)
            run_viewport(p, base, "1280", 1280, 800)
            run_nostorage(p, base)
            run_boundary(p, base)
    finally:
        srv.shutdown()
    bad = [m for ok, m in results if not ok]
    (OUT / "qc-result.json").write_text(json.dumps({"pass": not bad, "checks": [{"ok": ok, "msg": m} for ok, m in results]},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
    print()
    print("ALL PASS" if not bad else f"FAILED {len(bad)}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
