"""物語の 1 章を、章の運転手（bot）に本物のブラウザで遊ばせる。会話は飛ばす設定。
python _dev/hanabi-chapter-e2e.py <出力> <章の id> [幅 高さ]
入力は、人と同じ down / move / up の道を通る（story.js の autoTick）。各面のはじめと途中を撮る。"""
import asyncio, os, subprocess, sys, json
from playwright.async_api import async_playwright

OUT, CH = sys.argv[1], sys.argv[2]
VW, VH = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1280, 720)
os.makedirs(OUT, exist_ok=True)
PORT = int(os.environ.get('PORT', 8794))
BASE = os.environ.get("HANABI_BASE") or f"http://127.0.0.1:{PORT}"


async def main():
    # HANABI_BASE を渡すと、手元のサーバーを立てずに公開先などを通す
    srv = None if os.environ.get("HANABI_BASE") else subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "hanabi-serve.py"), str(PORT), "."], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.2)
    fails = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(headless=False, channel="chrome", args=["--window-position=-2600,0", "--autoplay-policy=no-user-gesture-required"])
            ctx = await b.new_context(viewport={"width": VW, "height": VH}, locale="ja-JP")
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" and "404" not in m.text else None)
            await pg.add_init_script("localStorage.setItem('hanabi2story', JSON.stringify({ done: {}, stars: {}, skipTalk: true }))")
            await pg.goto(f"{BASE}/hanabi/story.html?ch={CH}&auto=1", wait_until="load")
            await pg.wait_for_function("() => window.STORY && STORY.S.booted", timeout=20000, polling=100)
            n = await pg.evaluate(f"() => STORY.CHAPTERS.find((c) => c.mod.CHAPTER.id === '{CH}').mod.LEVELS.length")
            seen = set()
            for g in range(60 * 60 * 4):
                st = await pg.evaluate("() => ({ mode: STORY.S.mode, lv: STORY.S.st && STORY.S.st.lv.id, ph: STORY.S.st && STORY.S.st.phase, t: STORY.S.st && STORY.S.st.t, done: STORY.S.chapterDone, fails: STORY.S.fails || 0, fatal: String(STORY.S.fatal || STORY.S.drawErr || STORY.S.fxErr || '') })")
                if st["fatal"]:
                    fails.append("例外 " + st["fatal"][:200]); break
                if st["done"] == CH:
                    break
                if st["mode"] == "card":
                    await pg.click("#cBtn")
                if st["mode"] == "play" and st["lv"] and (st["lv"], 0) not in seen and st["t"] and st["t"] > 0.3:
                    seen.add((st["lv"], 0)); await pg.screenshot(path=f"{OUT}/{CH}_{len(seen):02d}_{st['lv']}_a.jpg", type="jpeg", quality=78)
                if st["mode"] == "play" and st["lv"] and (st["lv"], 1) not in seen and st["t"] and st["t"] > 3.0:
                    seen.add((st["lv"], 1)); await pg.screenshot(path=f"{OUT}/{CH}_{len(seen):02d}_{st['lv']}_b.jpg", type="jpeg", quality=78)
                await pg.wait_for_timeout(100)
            res = await pg.evaluate(f"() => ({{ done: STORY.S.chapterDone, fails: STORY.S.fails || 0, stars: Object.entries(STORY.DB.stars).filter(([k]) => k.startsWith('{CH}:')) }})")
            print("面", n, "星", json.dumps(res["stars"], ensure_ascii=False), "失敗", res["fails"])
            if res["done"] != CH: fails.append("章を最後まで遊べない")
            if len(res["stars"]) != n: fails.append(f"星のついた面 {len(res['stars'])} / {n}")
            if errs: fails.append(f"例外 {errs[:3]}")
            await b.close()
    finally:
        srv and srv.terminate()
    for f in fails: print("FAIL", f)
    print("CHAPTER E2E", CH, "ALL PASS" if not fails else f"{len(fails)} FAIL")


asyncio.run(main())
