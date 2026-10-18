"""紹介動画に重ねる字幕と終わりのカードを、透明な PNG（1920x1080）で作る。
使い方: python overlays.py <出力フォルダ>
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parents[3]
LOGO = "data:image/png;base64," + __import__("base64").b64encode((ROOT / "_dev/tsunagu-naraberu/brand/out/logo.png").read_bytes()).decode()  # set_content のページは file:// を読めない

CSS = """
@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800;900&display=swap');
html,body{margin:0;width:1920px;height:1080px;background:transparent;overflow:hidden;font-family:'M PLUS Rounded 1c',sans-serif}
.cap{position:absolute;display:flex;flex-direction:column;align-items:center;gap:6px}
.pill{padding:14px 34px 16px;border-radius:999px;background:rgba(12,10,30,.86);border:4px solid var(--c);box-shadow:0 8px 30px rgba(0,0,0,.45);
  color:#fff;font-weight:900;font-size:58px;letter-spacing:.02em;white-space:nowrap;line-height:1.15}
.pill em{font-style:normal;color:var(--c)}
.sub{padding:6px 22px 8px;border-radius:14px;background:rgba(12,10,30,.8);color:#f3f0ff;font-weight:800;font-size:29px;white-space:nowrap}
"""

# 名前 → 本文（盤の位置は 1920x1080 の実画面に合わせて置く）
CAPS = {
    "cap_tsunagu": ("--c:#ff9a5c;left:612px;top:92px;transform:translateX(-50%)",
                    '<div class="pill"><em>ぷよぷよ風</em></div><div class="sub">つなぐ派：同じ色を4つつなげて消す</div>'),
    "cap_naraberu": ("--c:#6fe0ef;left:1306px;top:92px;transform:translateX(-50%)",
                     '<div class="pill"><em>パネルでポン風</em></div><div class="sub">ならべる派：入れ替えて3つ並べる</div>'),
    "cap_chain": ("--c:#ffe27a;left:960px;top:92px;transform:translateX(-50%)",
                  '<div class="pill">連鎖で、相手の盤に<em>おじゃま</em>を送る</div>'),
    "cap_offset": ("--c:#9ff3ff;left:960px;top:92px;transform:translateX(-50%)",
                   '<div class="pill">予告の3秒で消し返せば <em>相殺</em></div>'),
    "cap_active": ("--c:#6fe0ef;left:960px;top:92px;transform:translateX(-50%)",
                   '<div class="pill">消えている間に次をつなぐ <em>アクティブ連鎖</em></div>'),
}

END = f"""
<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#2a1f4a 0%,#0d0b1f 70%)"></div>
<div style="position:absolute;left:0;right:0;top:120px;display:flex;flex-direction:column;align-items:center;gap:26px">
  <img src="{LOGO}" style="width:1000px">
  <div style="color:#fff;font-weight:900;font-size:56px"><span style="color:#ffab76">ぷよぷよ風</span> vs <span style="color:#7fe3f0">パネルでポン風</span></div>
  <div style="color:#e9e4ff;font-weight:800;font-size:40px">CPU戦 5段階 ／ ふたりで対戦 ／ ブラウザで無料（PC・スマホ）</div>
  <div style="margin-top:18px;padding:16px 40px;border-radius:999px;background:linear-gradient(90deg,#ff9a5c,#6fe0ef);color:#14102a;font-weight:900;font-size:44px">yuichi916.github.io/tsunagu-naraberu.html</div>
  <div style="color:#a9a3c9;font-weight:800;font-size:22px;margin-top:10px">「ぷよぷよ」は株式会社セガの、「パネルでポン」は任天堂株式会社の商標です。本作は各社とは関係のない非公式の作品です。</div>
</div>"""

INTRO = f"""
<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#2a1f4a 0%,#0d0b1f 72%)"></div>
<div style="position:absolute;left:0;right:0;top:170px;display:flex;flex-direction:column;align-items:center;gap:34px">
  <img src="{LOGO}" style="width:1180px">
  <div style="color:#fff;font-weight:900;font-size:84px;letter-spacing:.02em"><span style="color:#ffab76">ぷよぷよ風</span> vs <span style="color:#7fe3f0">パネルでポン風</span></div>
  <div style="color:#e9e4ff;font-weight:800;font-size:46px">ルールのちがうパズルどうしで、直接対戦</div>
</div>"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    page = b.new_page(viewport={"width": 1920, "height": 1080})
    for name, (style, body) in CAPS.items():
        page.set_content(f"<style>{CSS}</style><div class='cap' style='{style}'>{body}</div>")
        page.wait_for_load_state("networkidle")
        page.evaluate("() => document.fonts.ready")
        page.screenshot(path=str(OUT / f"{name}.png"), omit_background=True)
    page.set_content(f"<style>{CSS}</style>{INTRO}")
    page.wait_for_load_state("networkidle")
    page.evaluate("() => document.fonts.ready")
    page.screenshot(path=str(OUT / "intro.png"))
    page.set_content(f"<style>{CSS}</style>{END}")
    page.wait_for_load_state("networkidle")
    page.evaluate("() => document.fonts.ready")
    page.screenshot(path=str(OUT / "end.png"))
    b.close()
print("ok", sorted(os.listdir(OUT)))
