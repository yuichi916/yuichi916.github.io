"""一筆花火 2（hanabi/）を、外を読まない 1 つのフォルダと zip に固める。

    python scripts/build_hanabi_package.py portal   # ゲームサイト用（CrazyGames の SDK を読む）
    python scripts/build_hanabi_package.py itch     # SDK なし・物語（story.html と ch/）も入れる
    python scripts/build_hanabi_package.py playgama # Playgama Bridge（YouTube Playables・MSN 等）。物語・外リンクなし、保存は Bridge

字は使う字の切れはしだけを入れる（build_itch_package.py と同じ道具）。
"""
from __future__ import annotations
import json

import re
import shutil
import sys
import zipfile
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).parent))
from build_itch_package import _fetch  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "hanabi"
OUT = ROOT / "_dist" / "hanabi"
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
# Playgama Bridge は <head> の最初の script（async なし）。設定ファイルは index.html の隣
BRIDGE = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>'
# Playgama Bridge の設定。ランキングは Bridge SaaS（開発者画面 → Bridge SaaS → Leaderboards で best_score を作成。publicToken は同じ画面）。
# YouTube では isMain の 1 つだけが YouTube 側のランキングに送られる
BRIDGE_CONFIG = json.dumps({"platforms": {}, "saas": {"publicToken": "cmwgmpcsa1ktklz0hv2d9fuy2", "leaderboards": {"platforms": ["playgama", "qa_tool"]}}, "leaderboards": [{"id": "best_score", "isMain": True}]})


FONTS = [("Yuji Boku", [400]), ("Shippori Mincho B1", [500, 800])]


FONT_TTF = {("Yuji Boku", 400): "yujiboku/YujiBoku-Regular.ttf", ("Shippori Mincho B1", 500): "shipporiminchob1/ShipporiMinchoB1-Medium.ttf", ("Shippori Mincho B1", 800): "shipporiminchob1/ShipporiMinchoB1-ExtraBold.ttf"}


def _ttf(rel: str) -> Path:
    """元の字形（OFL）を Google Fonts の倉庫から 1 度だけ落とす"""
    import urllib.request
    d = Path.home() / ".cache" / "hanabi_fonts"
    d.mkdir(parents=True, exist_ok=True)
    p = d / rel.replace("/", "_")
    if not p.exists() or p.stat().st_size < 100000:
        with urllib.request.urlopen("https://github.com/google/fonts/raw/main/ofl/" + rel, timeout=180) as r:
            p.write_bytes(r.read())
    return p


def _ranges(cps: list[int]) -> str:
    out, i = [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f"U+{cps[i]:X}" + (f"-{cps[j]:X}" if j > i else ""))
        i = j + 1
    return ",".join(out)


def embed_fonts(stage: Path, text: str) -> str:
    """使う字だけの字形を、元の TTF から自分で切り出す（外を読まない）。<style> を返す。
    2026-11-25: 前は Google Fonts の text= で 1 枚だけ取っていたが、字が 1,000 を越えると別の断片が返り、必要な字が 1 つも入っていなかった
    （Playgama では筆文字も明朝も、端末の代わりの字で出ていた）。字は 英数・かな・題名と玉・漢字（よく使う順に 200 字ずつ）に分け、使う所だけ読む"""
    from collections import Counter

    from fontTools import subset
    from fontTools.ttLib import TTFont

    cnt = Counter(c for c in text if ord(c) >= 0x20 and c != "\ufe0e" and c != "\ufe0f")
    title = set("一筆花火弐") | set(re.findall(r"\bC[(]'[^']+', '[^']+', '[^']+', '([^'])", text)) | set("金大千灯雫氷鬼尺鼠飛親夫魚逃止？")
    def kind(c):
        o = ord(c)
        return "lat" if o < 0x3000 else "kana" if o < 0x3100 or o >= 0xFF00 else "kan"
    kan = [c for c, _ in cnt.most_common() if kind(c) == "kan"]
    groups = {"lat": sorted(c for c in cnt if kind(c) == "lat"), "kana": sorted(c for c in cnt if kind(c) == "kana"), "ttl": sorted(c for c in title if c in cnt and kind(c) == "kan")}
    rest = [c for c in kan if c not in title]
    for i in range(0, len(rest), 200):
        groups[f"k{i // 200}"] = sorted(rest[i:i + 200])
    faces, total, have = [], 0, {}
    (stage / "fonts").mkdir(exist_ok=True)
    for fam, weights in FONTS:
        for w in weights:
            src = _ttf(FONT_TTF[(fam, w)])
            cmap = set(TTFont(src, lazy=True).getBestCmap())
            got = set()
            for g, chars in groups.items():
                cps = sorted(ord(c) for c in chars if ord(c) in cmap)
                if not cps:
                    continue
                opt = subset.Options(flavor="woff2", layout_features=["kern", "liga", "palt", "vert"], hinting=False, desubroutinize=True, notdef_outline=True, name_IDs=[0, 1, 2, 13, 14])
                font = subset.load_font(str(src), opt)
                sub = subset.Subsetter(opt)
                sub.populate(unicodes=cps)
                sub.subset(font)
                name = f"{fam.split()[0].lower()}{w}-{g}.woff2"
                subset.save_font(font, str(stage / "fonts" / name), opt)
                total += (stage / "fonts" / name).stat().st_size
                got |= set(cps)
                faces.append(f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:swap;src:url(fonts/{name}) format('woff2');unicode-range:{_ranges(cps)}}}")
            have[(fam, w)] = got
    # 確かめ: かな・漢字・英数が本当に入っているか（1 字も入らない事故を、二度と通さない）
    for (fam, w), got in have.items():
        miss = [c for c in cnt if kind(c) != "lat" and ord(c) not in got]
        assert len(miss) <= len(cnt) * 0.03, (fam, w, len(miss), "".join(miss)[:40])
        assert all(ord(c) in got for c in "一筆花火HANBIabc0129あアの"), (fam, w)
    print(f"  字形 {len(faces)} 個 {total/1e6:.2f}MB（{len(cnt)} 字）")
    return "<style>" + "".join(faces) + "</style>"


def localize_fonts(html: str, style: str) -> str:
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+"[^>]*>\s*', "", html)
    return html.replace("</head>", style + "</head>", 1)


def playgama_js(s: str) -> str:
    """Playgama: 保存は Bridge だけ（3.2.1）・外は読まない（1.2.5）。どちらも実行はされないが、審査が中を見るので文字ごと取り除く"""
    s = s.replace("localStorage", "HANABI_NOSTORE").replace("sessionStorage", "HANABI_NOSTORE")
    for u in ("https://hanabi2-rank.yuichi916.workers.dev", "https://yuichi916.github.io/hitofude.html", "https://yuichi916.github.io/hanabi/", "https://x.com/intent/tweet?text="):
        s = s.replace(u, "")
    return s


def playgama_boot(html: str) -> str:
    """Playgama: Bridge が起き終わってから、ゲームのプログラムと絵を読みはじめる（必須項目 2）。
    前は modulepreload と <script src=main.js> が、Bridge を待たずに並んで読みに行っていた。sessionStorage も使わない（3.2.1）"""
    pre = re.findall(r'<link rel="(modulepreload|preload)" href="([^"]+)"([^>]*)>', html)
    html = re.sub(r'<link rel="(?:modulepreload|preload)"[^>]*>\s*', "", html)
    html = re.sub(r'<!-- 起動を速く[^>]*-->\s*', "", html)
    # 枠の中では使わない物（アプリ化・共有の札・外のアドレス）
    html = re.sub(r'<link rel="(?:manifest|apple-touch-icon|canonical)"[^>]*>\s*', "", html)
    html = re.sub(r'<meta (?:property="og:|name="twitter:)[^>]*>\s*', "", html)
    html = re.sub(r"<title>[^<]*</title>", "<title>Hitofude Hanabi 2</title>", html, count=1)
    html = re.sub(r'<meta name="description"[^>]*>', '<meta name="description" content="Draw one line through the fireworks, and outrun the flame chasing it.">', html, count=1)
    # 字の形も、Bridge が起き終わってから
    m = re.search(r"<style>(@font-face.*?)</style>", html, re.S)
    faces = m.group(1) if m else ""
    html = html.replace(m.group(0), "", 1) if m else html
    html, k = re.subn(r"<script>/\* 題名の形.*?</script>", "<script>document.body.classList.add('en')</script>", html, count=1, flags=re.S)
    assert k == 1, "題名の形の script"
    links = json.dumps([[r, h, "fetch" if "fetch" in x else ("image" if "image" in x else "")] for r, h, x in pre], ensure_ascii=False)
    boot = ("<script>(function(){var L=" + links + ";function go(ok){try{if(ok)document.body.classList.toggle('en',!/^ja/i.test(String(bridge.platform.language||'')));}catch(e){}var st=document.createElement('style');st.textContent=" + json.dumps(faces, ensure_ascii=False) + ";document.head.appendChild(st);L.forEach(function(x){var l=document.createElement('link');l.rel=x[0];l.href=x[1];if(x[2]){l.as=x[2];if(x[2]==='fetch')l.crossOrigin='anonymous';}document.head.appendChild(l);});"
            "var n=0;(function add(){var s=document.createElement('script');s.type='module';s.src='main.js'+(n?'?r='+n:'');s.onerror=function(){if(n++<3)setTimeout(add,500);};document.body.appendChild(s);})();}"
            "window.HANABI_BRIDGE=(window.bridge&&bridge.initialize)?bridge.initialize().then(function(){return true},function(e){console.warn('bridge',e);return false}):Promise.resolve(false);window.HANABI_BRIDGE.then(go);})();</script>")
    html, n = re.subn(r'<script type="module" src="main\.js"[^>]*></script>', lambda m: boot, html)
    assert n == 1, "main.js の script"
    return html


def main() -> int:
    kind = sys.argv[1] if len(sys.argv) > 1 else "portal"
    # portal = CrazyGames（SDK・物語なし・外へのリンクなし）。itch = itch.io・PLiCy・Game Jolt・ふりーむ 等（物語あり・SDK なし）
    story = kind not in ("portal", "playgama")
    stage = OUT / kind
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    text = ""
    for p in SRC.iterdir():
        if p.suffix in {".js", ".css"}:
            if not story and p.name in {"story.js", "story.css", "story-art.js", "script.js", "stars.js"}:
                continue
            s = p.read_text(encoding="utf-8")
            text += s
            s = s.replace("../assets/hitofude/", "./assets/hitofude/")
            if kind == "playgama" and p.suffix == ".js":
                s = playgama_js(s)
            (stage / p.name).write_text(s, encoding="utf-8")
    if story:
        (stage / "ch").mkdir()
        for p in (SRC / "ch").glob("*.js"):
            s = p.read_text(encoding="utf-8")
            text += s
            (stage / "ch" / p.name).write_text(s, encoding="utf-8")
    if (SRC / "art").is_dir():
        shutil.copytree(SRC / "art", stage / "art")
    if (SRC / "sfx").is_dir():  # 効果音（録音を 1 本にまとめたもの）
        shutil.copytree(SRC / "sfx", stage / "sfx")
    if (SRC / "tale").is_dir():  # 夜明けの頁: 灯の顔絵・立ち絵・声
        shutil.copytree(SRC / "tale", stage / "tale")

    # 使うものだけ（絵と音）
    (stage / "assets" / "hitofude" / "bgm").mkdir(parents=True)
    for f in ("cast.js", "hinoko.js", "names.js"):  # names.js はランキングの名前の確かめ（main.js が読む）
        s = (ROOT / "assets" / "hitofude" / f).read_text(encoding="utf-8")
        text += s
        (stage / "assets" / "hitofude" / f).write_text(s, encoding="utf-8")
    for f in (ROOT / "assets" / "hitofude" / "bgm").glob("*.mp3"):
        shutil.copy2(f, stage / "assets" / "hitofude" / "bgm" / f.name)
    if (SRC / "bgm").is_dir():
        shutil.copytree(SRC / "bgm", stage / "bgm")

    pages = ["index.html"] + (["story.html"] if story else [])
    htmls = {n: (SRC / n).read_text(encoding="utf-8") for n in pages}
    text += "".join(htmls.values())
    style = embed_fonts(stage, text)
    # 書き出しの印: HANABI_PKG（サイトの外で動く）、HANABI_NO_STORY（物語を入れない）、HANABI_NO_LINKS（外へのリンクを出さない）
    flags = "window.HANABI_PKG=1;" + ("" if story else "window.HANABI_NO_STORY=1;window.HANABI_NO_LINKS=1;") + ("window.HANABI_PG=1;window.HANABI_NOSTORE={getItem:function(){return null},setItem:function(){},removeItem:function(){}};" if kind == "playgama" else "")
    for n, html in htmls.items():
        html = localize_fonts(html, style)
        html = html.replace("../assets/hitofude/", "./assets/hitofude/")  # 先読みの印（modulepreload）も書き出し先の場所に
        # 計測（GoatCounter）は自分のサイトだけ。ゲームサイトの中では数えない
        html = re.sub(r'<script data-goatcounter[^>]*></script>\s*', '', html)
        html = html.replace("</head>", f"<script>{flags}</script></head>", 1)
        if kind == "portal":
            html = html.replace("</head>", SDK + "</head>", 1)
        if kind == "playgama":
            html = re.sub(r"(<meta charset=[^>]*>)", r"\1\n" + BRIDGE, html, count=1)
            html = playgama_boot(html)
    if kind == "playgama":
        (stage / "playgama-bridge-config.json").write_text(BRIDGE_CONFIG, encoding="utf-8")
        (stage / n).write_text(html, encoding="utf-8")

    zpath = OUT / f"hanabi-{kind}.zip"
    if zpath.exists():
        zpath.unlink()
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in sorted(stage.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(stage))
    n = sum(1 for p in stage.rglob("*") if p.is_file())
    print(f"{kind}: {n} files / zip {zpath.stat().st_size/1e6:.1f}MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
