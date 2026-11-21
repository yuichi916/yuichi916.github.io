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


def embed_fonts(stage: Path, text: str) -> str:
    """Google Fonts の text= で、使う字だけの字形ファイルを作る（外を読まない）。<style> を返す。"""
    chars = "".join(sorted({c for c in text if ord(c) >= 0x20}))
    faces, total = [], 0
    (stage / "fonts").mkdir(exist_ok=True)
    for fam, weights in FONTS:
        for w in weights:
            url = "https://fonts.googleapis.com/css2?family=" + quote(fam) + f":wght@{w}&text=" + quote(chars)
            css = _fetch(url)
            m = re.search(r"url\((https://[^)]+)\)", css)
            name = f"{fam.split()[0].lower()}{w}.woff2"
            data = _fetch(m.group(1), binary=True)
            (stage / "fonts" / name).write_bytes(data)
            total += len(data)
            faces.append(f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:swap;src:url(fonts/{name}) format('woff2')}}")
    print(f"  字形 {len(faces)} 個 {total/1e6:.2f}MB（{len(chars)} 字）")
    return "<style>" + "".join(faces) + "</style>"


def localize_fonts(html: str, style: str) -> str:
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+"[^>]*>\s*', "", html)
    return html.replace("</head>", style + "</head>", 1)


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
            (stage / p.name).write_text(s, encoding="utf-8")
    if story:
        (stage / "ch").mkdir()
        for p in (SRC / "ch").glob("*.js"):
            s = p.read_text(encoding="utf-8")
            text += s
            (stage / "ch" / p.name).write_text(s, encoding="utf-8")
    if (SRC / "art").is_dir():
        shutil.copytree(SRC / "art", stage / "art")
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
    flags = "window.HANABI_PKG=1;" + ("" if story else "window.HANABI_NO_STORY=1;window.HANABI_NO_LINKS=1;") + ("window.HANABI_PG=1;" if kind == "playgama" else "")
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
