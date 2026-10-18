"""紹介動画の素材を撮る: ゲームを仮想の時計で1コマずつ進めて画面を撮り、音は同じ時計で OfflineAudioContext に描き出す。
映像と音がずれない（撮影の遅さに関係なく 30fps ちょうど）。

使い方（サイトを http://127.0.0.1:18983/ で配っておく）:
    python capture.py --seed 123 --level つよい --out <dir> [--title 3] [--tail 2.5] [--a hinata --b rin]
出力: <dir>/f_00000.jpg … 、<dir>/audio.wav、<dir>/events.json（コマ番号つきの出来事）
"""
import argparse
import base64
import json
import os
import struct
import time

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--seed", type=int, required=True)
ap.add_argument("--level", default="つよい")
ap.add_argument("--a", default="hinata")
ap.add_argument("--b", default="rin")
ap.add_argument("--out", required=True)
ap.add_argument("--title", type=float, default=3.0)   # タイトル画面の秒数
ap.add_argument("--tail", type=float, default=2.5)    # 決着のあとの秒数
ap.add_argument("--max", type=float, default=80.0)    # 試合の上限（秒）
ap.add_argument("--w", type=int, default=1920)
ap.add_argument("--h", type=int, default=1080)
ap.add_argument("--url", default="http://127.0.0.1:18983/tsunagu-naraberu.html")
ap.add_argument("--reserve", type=int, default=150)  # 盤の上に空ける高さ（字幕の置き場所。ゲームの見出しや盤に字幕が乗らない）
ap.add_argument("--bgm", type=int, default=145)  # 曲の音量（ゲームの設定の 0〜100 と同じ目盛り。動画では効果音の合間が静かすぎるので上げる）
a = ap.parse_args()
FPS, SR = 30, 48000
DUR = a.title + a.max + a.tail + 2
os.makedirs(a.out, exist_ok=True)

INIT = """(() => {
  let vt = 0; window.__vt = v => { vt = v; };
  performance.now = () => vt * 1000;
  window.requestAnimationFrame = () => 0;
  const Off = window.OfflineAudioContext;
  window.AudioContext = function () {
    const c = new Off(2, Math.ceil(%d * %d), %d);
    Object.defineProperty(c, 'currentTime', { get: () => vt });
    Object.defineProperty(c, 'state', { get: () => 'running' });
    c.resume = () => Promise.resolve();
    window.__ac = c; return c;
  };
  window.webkitAudioContext = window.AudioContext;
})()""" % (DUR, SR, SR)

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    page = b.new_page(viewport={"width": a.w, "height": a.h}, device_scale_factor=1)
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(INIT)
    page.goto(a.url)
    page.wait_for_function("() => window.__tn && __tn.screen === 'title'", timeout=180000, polling=200)
    # 結果画面（実時間の setTimeout で出る）は撮らない。終わりのカードは別に重ねる
    page.add_style_tag(content="#result{display:none!important}")
    page.evaluate(f"""() => {{ __tn.audio.ensure(); __tn.audio.setVolumes({{ bgm: {a.bgm} }}); __tn.audio.loadVoices([{json.dumps(a.a)}, {json.dumps(a.b)}]);
        __tn.settings.chars[0] = {json.dumps(a.a)}; __tn.settings.chars[1] = {json.dumps(a.b)}; __tn.settings.level = {json.dumps(a.level)}; }}""")
    page.wait_for_function("() => __tn.audio.loaded.length >= 12 + 22", timeout=120000, polling=300)
    page.wait_for_timeout(1500)  # 字の読み込み・タイトルの動き

    k = 0

    def shot():
        global k
        page.screenshot(path=os.path.join(a.out, f"f_{k:05d}.jpg"), type="jpeg", quality=92)
        k += 1

    t0 = time.time()
    for i in range(round(a.title * FPS)):
        page.evaluate(f"() => __vt({k / FPS})")
        shot()
    page.evaluate(f"""() => {{ __vt({k / FPS}); __tn.demo({a.seed});
        const m = __tn.match, orig = m.step.bind(m); window.__log = [];
        m.step = inp => {{ const ev = orig(inp); for (const e of ev) if (['pop', 'attack', 'garbage'].includes(e.type))
          window.__log.push({{ f: m.frame, type: e.type, p: e.p, chain: e.chain, offset: e.offset, sent: e.sent, n: e.n }}); return ev; }}; }}""")
    start_k = k
    end_k = None
    while True:
        page.evaluate(f"() => {{ __vt({(k + 1) / FPS}); __tn.advance(2, {a.reserve}); }}")
        shot()
        res = page.evaluate("() => !!__tn.match.result")
        if res and end_k is None:
            end_k = k + round(a.tail * FPS)
        if end_k is not None and k >= end_k:
            break
        if (k - start_k) / FPS > a.max:
            break
        if k % 150 == 0:
            print(f"  {k} コマ / {time.time() - t0:.0f}秒", flush=True)
    log = page.evaluate("() => window.__log")
    result = page.evaluate("() => __tn.match.result")
    # 音を描き出して 16bit の WAV に
    n = page.evaluate(f"""async () => {{ const buf = await __ac.startRendering(); const L = Math.min(buf.length, Math.ceil({k / FPS + 0.5} * {SR}));
        const a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Int16Array(L * 2);
        for (let i = 0; i < L; i++) {{ out[2 * i] = Math.max(-1, Math.min(1, a[i])) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, b[i])) * 32767; }}
        const u8 = new Uint8Array(out.buffer); window.__pcm = []; for (let i = 0; i < u8.length; i += 1 << 20) {{
          let s = ''; const c = u8.subarray(i, i + (1 << 20)); for (let j = 0; j < c.length; j += 8192) s += String.fromCharCode.apply(null, c.subarray(j, j + 8192));
          window.__pcm.push(btoa(s)); }} return window.__pcm.length; }}""")
    pcm = b"".join(base64.b64decode(page.evaluate(f"() => window.__pcm[{i}]")) for i in range(n))
    with open(os.path.join(a.out, "audio.wav"), "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 2, SR, SR * 4, 4, 16)
                + b"data" + struct.pack("<I", len(pcm)) + pcm)
    with open(os.path.join(a.out, "events.json"), "w", encoding="utf-8") as f:
        json.dump({"fps": FPS, "frames": k, "battle_start": start_k, "result": result, "events": log, "errors": errs}, f, ensure_ascii=False)
    b.close()
print(json.dumps({"frames": k, "battle_start": start_k, "secs": round(k / FPS, 1), "result": result, "errors": errs[:3]}, ensure_ascii=False))
