"""一筆花火 2 を本物のブラウザで通しで動かす: 24 夜・屋台・大一番・完走・タイトル・お守り帳・ひと休み・読みなおし。
python _dev/hanabi-e2e.py <配信フォルダ> <index までの道> <出力> [幅 高さ]"""
import asyncio, json, math, os, subprocess, sys, time
from playwright.async_api import async_playwright

SITE, PATH, OUT = sys.argv[1:4]
VW, VH = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (1280, 720)
PORT = 8799
os.makedirs(OUT, exist_ok=True)
fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "hanabi-serve.py"), str(PORT), SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.5)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(headless=False, channel="chrome", args=["--window-position=-2600,0", "--autoplay-policy=no-user-gesture-required"])
            ctx = await b.new_context(viewport={"width": VW, "height": VH}, locale="en-US")
            await ctx.route("**/sdk.crazygames.com/**", lambda r: r.abort())
            pg = await ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
            pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" and "404" not in m.text and "ERR_FAILED" not in m.text else None)
            t0 = time.time()
            await pg.goto(f"http://127.0.0.1:{PORT}/{PATH}?title=1", wait_until="load")
            await pg.wait_for_function("() => window.HANABI && HANABI.S.booted && HANABI.S.mode === 'title'", timeout=20000)
            check(True, f"読みこみ {time.time()-t0:.1f} 秒")
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f"{OUT}/title.png")
            # タイトルの本物のクリック → すぐ遊べる
            t1 = time.time()
            await pg.click("#playBtn")
            await pg.wait_for_function("() => HANABI.S.mode === 'play'", timeout=5000)
            check(time.time() - t1 < 2, f"PLAY から夜まで {time.time()-t1:.2f} 秒")
            await pg.wait_for_timeout(1400)
            await pg.screenshot(path=f"{OUT}/n1.png")
            # 本物のマウスで 1 本引く
            sh = await pg.evaluate("() => { const s = HANABI.S.st, X = innerWidth / HANABI.W, Y = innerHeight / HANABI.H; return s.shells.filter((x) => x.rise <= 0).map((x) => ({ x: x.x * X, y: x.y * Y })); }")
            sh.sort(key=lambda a: a["x"])
            await pg.mouse.move(sh[0]["x"], sh[0]["y"]); await pg.mouse.down()
            for a, c in zip(sh, sh[1:8]):
                for k in range(1, 11):
                    await pg.mouse.move(a["x"] + (c["x"] - a["x"]) * k / 10, a["y"] + (c["y"] - a["y"]) * k / 10)
                    await asyncio.sleep(0.012)
            await pg.mouse.up()
            await pg.wait_for_function("() => HANABI.S.st.strokesUsed >= 1 || HANABI.S.mode !== 'play'", timeout=30000)
            check(await pg.evaluate("() => HANABI.S.st.totalPops > 0"), "本物のマウスで玉がひらいた")

            # ここからは目標を下げて 24 夜を早回し
            bosses, nights, senkos, encores = [], 0, 0, 0
            for guard in range(240):
                mode = await pg.evaluate("() => HANABI.S.mode")
                if mode == "play":
                    info = await pg.evaluate("""async () => { const H = HANABI, st = H.S.st; st.target = 1; const d = st.level; return { w: d.world, n: d.night, rule: d.rule, phase: st.phase }; }""")
                    if info["rule"] and info["rule"] not in bosses:
                        bosses.append(info["rule"])
                        await pg.wait_for_timeout(800)
                        await pg.screenshot(path=f"{OUT}/boss_{info['rule']}.png")
                    if info["n"] == 1 and info["w"] > 1:
                        await pg.wait_for_timeout(700)
                        await pg.screenshot(path=f"{OUT}/world{info['w']}.png")
                    await pg.wait_for_function("() => HANABI.S.st.phase === 'aim' || HANABI.S.mode !== 'play' || HANABI.S.st.phase === 'settle'", timeout=20000)
                    await pg.evaluate("""() => { const H = HANABI, st = H.S.st, G = H.G; if (st.phase !== 'aim') return; const idle = st.shells.filter((s) => s.state === 'idle'); idle.sort((a, b) => a.x - b.x); if (!idle.length) return;
                        const one = idle.length === 1; G.penDown(st, idle[0].x - (one ? 120 : 0), idle[0].y); for (const s of idle.slice(one ? 0 : 1, 7)) G.penMove(st, s.x, s.y); G.penUp(st); }""")
                    await pg.wait_for_function("() => HANABI.S.mode !== 'play' || (HANABI.S.st.phase !== 'stroke')", timeout=30000)
                    try:
                        await pg.wait_for_function("() => HANABI.S.mode !== 'play' || HANABI.S.st.phase === 'aim'", timeout=15000)
                    except Exception:
                        st = await pg.evaluate("() => { const H = HANABI, st = H.S.st; return { mode: H.S.mode, phase: st && st.phase, w: st && st.level.world, n: st && st.level.night, node: st && st.level.node, seals: st && st.level.seals, cleared: st && st.cleared, failed: st && st.failed, stroke: st && st.stroke && { penDown: st.stroke.penDown, fuseOut: st.stroke.fuseOut, caught: st.stroke.caught, done: st.stroke.done }, pending: st && st.pending.length, sparks: st && st.sparks.length, runners: st && st.runners.length, t: st && st.t, settleAt: st && st.settleAt }; }")
                        print("STUCK", st, flush=True); raise
                elif mode == "inter":
                    nights += 1
                    if nights in (1, 3, 11):
                        await pg.wait_for_timeout(500)
                        await pg.screenshot(path=f"{OUT}/shop{nights}.png")
                    # 大勝負のほうび: 1 枚取る
                    gift = await pg.query_selector("#giftOv .card")
                    if gift:
                        await gift.click(); await pg.wait_for_timeout(120)
                    gov = await pg.query_selector("#giftOv .btn2")
                    if gov:
                        await gov.click(); await pg.wait_for_timeout(120)
                    # 地図: 行ける丸のいちばん下をえらぶ
                    routes = await pg.query_selector_all("#nextInfo .fn.can")
                    if routes:
                        await routes[-1].click()
                        await pg.wait_for_timeout(60)
                    # 全部のカードが画面の中に入る
                    box = await pg.evaluate("() => { const r = document.querySelector('#inter .panel').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight]; }")
                    if box[0] < 0 or box[1] < 0 or box[2] > box[4] or box[3] > box[5]:
                        check(False, f"屋台が画面からはみ出す {box}")
                    await pg.evaluate("() => { HANABI.S.run.coins += 12; }")
                    cards = await pg.query_selector_all("#cards .card:not(.sold):not(.cant)")
                    if cards:
                        await cards[0].click()
                    await pg.wait_for_timeout(120)
                    await pg.click("#nextBtn")
                    await pg.wait_for_timeout(250)
                elif mode == "senko":
                    senkos += 1
                    await pg.wait_for_timeout(300)
                    # 本物の指で押さえて、離す
                    await pg.mouse.move(VW // 2, VH // 2); await pg.mouse.down()
                    await pg.wait_for_timeout(2600)
                    await pg.screenshot(path=f"{OUT}/senko{senkos}.png")
                    await pg.mouse.up()
                    await pg.wait_for_timeout(200)
                    check(await pg.evaluate("() => HANABI.S.sk.done"), "線香花火を離すと終わる")
                    await pg.click("#skNext")
                    await pg.wait_for_timeout(250)
                elif mode == "over":
                    break
                else:
                    await pg.wait_for_timeout(200)
            check(nights == 23 or nights == 24, f"屋台を {nights} 回通った")
            check(len(bosses) == 6, f"妖怪 {bosses}")
            check(senkos == 2, f"線香花火 {senkos} 回")
            check(await pg.evaluate("() => HANABI.S.mode") == "over", "完走の画面")
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f"{OUT}/over.png")
            check(await pg.evaluate("() => HANABI.DB.meta.wins") == 1, "完走が記録された")
            # 周回のあとのタイトル・新しい祭り・お守り帳
            await pg.click("#ovTitleBtn")
            await pg.wait_for_timeout(300)
            labels = await pg.evaluate("() => [...document.querySelectorAll('#titleMenu button')].map((b) => b.textContent)")
            check(any("New Run" in x for x in labels) and any("Daily" in x for x in labels), f"タイトルのメニュー {labels}")
            await pg.click("#titleMenu button:nth-child(1)")
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f"{OUT}/newrun.png")
            await pg.click("#nrBack")
            await pg.click("#titleMenu button:nth-child(3)")
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f"{OUT}/book.png")
            await pg.click("#bkBack")
            # 途中でやめて読みなおすと続きから
            await pg.click("#playBtn")
            await pg.wait_for_timeout(600)
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f"{OUT}/pause.png")
            check(await pg.evaluate("() => HANABI.S.paused === true"), "Esc でひと休み")
            await pg.click("#pzResume")
            await pg.evaluate("() => { HANABI.S.run.night = 5; HANABI.DB.run = HANABI.S.run; localStorage.setItem('hanabi2', JSON.stringify(HANABI.DB)); }")
            await pg.reload(wait_until="load")
            await pg.wait_for_function("() => window.HANABI && HANABI.S.booted && HANABI.S.mode === 'title'", timeout=20000)
            saved = await pg.evaluate("() => { const d = JSON.parse(localStorage.getItem('hanabi2')); return d.run && d.run.night; }")
            check(saved == 5, f"読みなおしても保存が残る ({saved})")
            txt = await pg.inner_text("#playBtn")
            check("CONTINUE" in txt, f"読みなおすと続きから ({txt})")
            await pg.click("#playBtn")
            await pg.wait_for_timeout(400)
            check(await pg.evaluate("() => HANABI.S.st.level.night") == 5, "続きの夜")
            fatal = await pg.evaluate("() => String(HANABI.S.fatal || '')")
            check(not fatal, "描画の例外なし " + fatal[:200])
            check(not errs, f"例外なし {errs[:4]}")
            fps = await pg.evaluate("""() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1500) ok(n / 1.5); else requestAnimationFrame(f); }; requestAnimationFrame(f); })""")
            print(f"fps {fps:.0f}")
            await b.close()
    finally:
        srv.terminate()
    print("E2E:", "ALL PASS" if not fails else f"{len(fails)} FAIL")


asyncio.run(main())
