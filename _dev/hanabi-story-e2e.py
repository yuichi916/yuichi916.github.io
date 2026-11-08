"""物語モードを本物のブラウザとマウスで通す: 序章 → 星の夜 7 面 → 終わり → 送り火。
python _dev/hanabi-story-e2e.py <出力> [幅 高さ]"""
import asyncio, os, subprocess, sys
from playwright.async_api import async_playwright

OUT = sys.argv[1]
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
os.makedirs(OUT, exist_ok=True)
PORT = 8795
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


async def talk(pg):
    # 会話を本物のクリックで送る
    for _ in range(80):
        if not await pg.evaluate("() => !!STORY.S.talking"):
            return
        await pg.click("#dlg")
        await pg.wait_for_timeout(70)


SOL = """() => { const st = STORY.S.st, X = innerWidth / STORY.W, Y = innerHeight / STORY.H; const sol = STORY.CHAPTERS[0].mod.solve(st.lv, st.jumpsLeft);
  return { id: st.lv.id, magpie: !!st.lv.magpie, jumps: st.jumpsLeft, sol: sol.map((s) => ({ x: st.nodes[s.n].x * X, y: st.nodes[s.n].y * Y, jump: s.jump })) }; }"""
# 鵲の面のはじめは、一筆では描けないので、一筆で描けるところまでを描いて止まる
NOJUMP = """() => { const st = STORY.S.st, X = innerWidth / STORY.W, Y = innerHeight / STORY.H; const sol = STORY.CHAPTERS[0].mod.solve(st.lv, 1); const out = [];
  for (const s of sol) { if (s.jump) break; out.push({ x: st.nodes[s.n].x * X, y: st.nodes[s.n].y * Y, jump: false }); } return out; }"""


async def stroke(pg, sol, shot=None):
    await pg.mouse.move(sol[0]["x"], sol[0]["y"])
    await pg.mouse.down()
    for i, (a, c) in enumerate(zip(sol, sol[1:])):
        if c["jump"]:
            await pg.mouse.up()
            await pg.wait_for_timeout(250)
            await pg.mouse.move(c["x"], c["y"])
            await pg.mouse.down()
            continue
        for k in range(1, 10):
            await pg.mouse.move(a["x"] + (c["x"] - a["x"]) * k / 9, a["y"] + (c["y"] - a["y"]) * k / 9)
            await asyncio.sleep(0.016)
        if shot and i == len(sol) // 2:
            await pg.screenshot(path=shot, type="jpeg", quality=80)
    await pg.mouse.up()


async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "hanabi-serve.py"), str(PORT), "."], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(headless=False, channel="chrome", args=["--window-position=-2600,0", "--autoplay-policy=no-user-gesture-required"])
            ctx = await b.new_context(viewport={"width": VW, "height": VH}, locale="ja-JP")
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" and "404" not in m.text else None)
            await pg.goto(f"http://127.0.0.1:{PORT}/hanabi/story.html", wait_until="load")
            await pg.wait_for_function("() => window.STORY && STORY.S.booted", timeout=20000, polling=100)
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=f"{OUT}/menu.jpg", type="jpeg", quality=80)
            await pg.click("#sMenu button:nth-child(1)")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=f"{OUT}/prologue.jpg", type="jpeg", quality=80)
            # 序章の会話は「スキップ」1 回で全部飛ぶ
            await pg.click("#dSkip")
            await pg.wait_for_timeout(200)
            check(await pg.evaluate("() => !STORY.S.talking && document.getElementById('dlg').classList.contains('hidden')"), "スキップで序章の会話が全部飛ぶ")
            magpie_fail = False
            for lvl in range(7):
                for attempt in range(5):
                    for _ in range(300):
                        if await pg.evaluate("() => STORY.S.mode === 'play' && STORY.S.st.phase === 'aim'"):
                            break
                        await talk(pg)
                        await pg.wait_for_timeout(100)
                    info = await pg.evaluate(SOL) if not (await pg.evaluate("() => !!STORY.S.st.lv.magpie && STORY.S.st.jumpsLeft === 0")) else None
                    if info is None:
                        part = await pg.evaluate(NOJUMP)
                        await stroke(pg, part)
                        await pg.wait_for_function("() => STORY.S.st.phase === 'fail'", timeout=8000, polling=100)
                        print("  tanabata 一筆では失敗:", await pg.evaluate("() => STORY.S.st.reason"), flush=True)
                        await pg.wait_for_function("() => STORY.S.talking", timeout=8000, polling=100)
                        await pg.wait_for_timeout(600)
                        await pg.screenshot(path=f"{OUT}/magpie.jpg", type="jpeg", quality=80)
                        magpie_fail = True
                        continue
                    if attempt == 0:
                        await pg.wait_for_timeout(300)
                        await pg.screenshot(path=f"{OUT}/aim_{info['id']}.jpg", type="jpeg", quality=80)
                    await stroke(pg, info["sol"], f"{OUT}/draw_{info['id']}.jpg")
                    await pg.wait_for_timeout(250)
                    ph = await pg.evaluate("() => STORY.S.st.phase")
                    if ph in ("clear", "done"):
                        await pg.wait_for_function("() => STORY.S.st.phase === 'done'", timeout=10000, polling=100)
                        await pg.wait_for_timeout(700)
                        await pg.screenshot(path=f"{OUT}/bloom_{info['id']}.jpg", type="jpeg", quality=80)
                        print(f"  {info['id']} 描けた（{attempt + 1} 回目）星 {await pg.evaluate('() => STORY.CHAPTERS[0].mod.starsFor(STORY.S.st)')}", flush=True)
                        await pg.wait_for_timeout(3600)
                        break
                    print(f"  {info['id']} 失敗 {await pg.evaluate('() => STORY.S.st.reason')}", flush=True)
                else:
                    check(False, f"{lvl + 1} 面を越えられない")
            check(await pg.evaluate("() => STORY.CHAPTERS[0].mod.LEVELS.every((l) => STORY.DB.stars['hoshi:' + l.id] >= 1)"), "7 面すべてに星")
            check(magpie_fail, "織姫と彦星は一筆では描けず、鵲が来る")
            await pg.wait_for_function("() => STORY.S.talking", timeout=20000, polling=100)
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}/ending1.jpg", type="jpeg", quality=80)
            await talk(pg)
            await pg.wait_for_function("() => STORY.S.mode === 'card'", timeout=10000, polling=100)
            await pg.wait_for_timeout(2600)
            await pg.screenshot(path=f"{OUT}/card1.jpg", type="jpeg", quality=80)
            await pg.click("#cBtn")
            await pg.wait_for_timeout(300)
            check(await pg.evaluate("() => STORY.S.ch && STORY.S.ch.mod.CHAPTER.id === 'toro'"), "第一章のあと、第二章へ進む")
            await pg.evaluate("() => STORY.showMenu()")
            await pg.wait_for_timeout(200)
            # 送り火: 尺玉を追い続ける。届かず、火に追いつかれて終わる
            await pg.click("#sMenu button:nth-child(8)")
            await talk(pg)
            await pg.wait_for_function("() => STORY.S.mode === 'finale'", timeout=10000, polling=100)
            await pg.wait_for_timeout(500)
            x, y = VW * 0.3, VH * 0.45
            await pg.mouse.move(x, y)
            await pg.mouse.down()
            nearest = 9999
            for i in range(400):
                s = await pg.evaluate("() => { const F = STORY.S.F, X = innerWidth / STORY.W, Y = innerHeight / STORY.H; return { x: F.shell.x * X, y: F.shell.y * Y, ph: F.phase, d: F.pen ? Math.hypot(F.pen.x - F.shell.x, F.pen.y - F.shell.y) : 9999 }; }")
                if s["ph"] != "run" and i > 3:
                    caught_by = await pg.evaluate("() => STORY.S.F.trigger")
                    break
                nearest = min(nearest, s["d"])
                x += (s["x"] - x) * 0.2
                y += (s["y"] - y) * 0.2
                await pg.mouse.move(x, y)
                await asyncio.sleep(0.03)
                if i == 80:
                    await pg.screenshot(path=f"{OUT}/finale_run.jpg", type="jpeg", quality=80)
            check(await pg.evaluate("() => STORY.S.F.trigger") == "caught", "手を止めなくても、火にかならず追いつかれる: " + str(await pg.evaluate("() => [STORY.S.F.trigger, STORY.S.F.age.toFixed(1)]")))
            await pg.mouse.up()
            check(nearest > 60, f"尺玉には届かない（いちばん近くて {nearest:.0f}）")
            await pg.wait_for_function("() => STORY.S.F.phase === 'end'", timeout=15000, polling=100)
            check(True, "終わり方: " + await pg.evaluate("() => STORY.S.F.trigger"))
            await pg.wait_for_function("() => STORY.S.talking", timeout=10000, polling=100)
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=f"{OUT}/finale_talk.jpg", type="jpeg", quality=80)
            await talk(pg)
            await pg.wait_for_timeout(2300)
            await pg.screenshot(path=f"{OUT}/finale_bloom.jpg", type="jpeg", quality=80)
            await pg.wait_for_function("() => STORY.S.mode === 'card'", timeout=15000, polling=100)
            await pg.wait_for_timeout(2600)
            await pg.screenshot(path=f"{OUT}/card_end.jpg", type="jpeg", quality=80)
            await pg.click("#cBtn")
            await pg.wait_for_timeout(300)
            check(await pg.evaluate("() => STORY.DB.done.finale === 1 && STORY.S.mode === 'menu'"), "結末まで届いて、メニューに戻る")
            # 設定で会話を毎回飛ばす: 送り火の前の会話が出ずに、すぐ遊べる
            await pg.click("#sMenu button:nth-child(9)")
            await pg.wait_for_timeout(200)
            check(await pg.evaluate("() => STORY.DB.skipTalk === true"), "会話を飛ばす設定が入る")
            await pg.click("#sMenu button:nth-child(8)")
            await pg.wait_for_timeout(400)
            check(await pg.evaluate("() => STORY.S.mode === 'finale' && !STORY.S.talking"), "設定ありなら会話なしで始まる")
            await pg.reload(wait_until="load")
            await pg.wait_for_function("() => window.STORY && STORY.S.booted", timeout=20000, polling=100)
            check(await pg.evaluate("() => STORY.DB.skipTalk === true"), "設定は読みなおしても残る")
            fatal = await pg.evaluate("() => String(STORY.S.fatal || '')")
            check(not fatal, "描画の例外なし " + fatal[:200])
            check(not errs, f"例外なし {errs[:3]}")
            await b.close()
    finally:
        srv.terminate()
    print("STORY E2E:", "ALL PASS" if not fails else f"{len(fails)} FAIL")


asyncio.run(main())
