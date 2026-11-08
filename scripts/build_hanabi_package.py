"""一筆花火 2（hanabi/）を、外を読まない 1 つのフォルダと zip に固める。

    python scripts/build_hanabi_package.py portal   # ゲームサイト用（CrazyGames の SDK を読む）
    python scripts/build_hanabi_package.py itch     # SDK なし

字は使う字の切れはしだけを入れる（build_itch_package.py と同じ道具）。
"""
from __future__ import annotations

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


FONTS = [("Yuji Boku", [400]), ("Shippori Mincho B1", [500, 800])]


def embed_fonts(html: str, stage: Path, text: str) -> str:
    """Google Fonts の text= で、使う字だけの字形ファイルを作って入れる（外を読まない）。"""
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
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+"[^>]*>\s*', "", html)
    return html.replace("</head>", "<style>" + "".join(faces) + "</style></head>", 1)


def main() -> int:
    kind = sys.argv[1] if len(sys.argv) > 1 else "portal"
    stage = OUT / kind
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    text = ""
    for p in SRC.iterdir():
        if p.suffix in {".js", ".css"}:
            s = p.read_text(encoding="utf-8")
            text += s
            s = s.replace("../assets/hitofude/", "./assets/hitofude/")
            (stage / p.name).write_text(s, encoding="utf-8")
    if (SRC / "art").is_dir():
        shutil.copytree(SRC / "art", stage / "art")

    # 使うものだけ（絵と音）
    (stage / "assets" / "hitofude" / "bgm").mkdir(parents=True)
    for f in ("cast.js", "hinoko.js"):
        s = (ROOT / "assets" / "hitofude" / f).read_text(encoding="utf-8")
        text += s
        (stage / "assets" / "hitofude" / f).write_text(s, encoding="utf-8")
    for f in (ROOT / "assets" / "hitofude" / "bgm").glob("*.mp3"):
        shutil.copy2(f, stage / "assets" / "hitofude" / "bgm" / f.name)
    if (SRC / "bgm").is_dir():
        shutil.copytree(SRC / "bgm", stage / "bgm")

    html = (SRC / "index.html").read_text(encoding="utf-8")
    text += html
    html = embed_fonts(html, stage, text)
    # 書き出しには物語（story.html・ch/）を入れないので、タイトルの「物語」を出さない
    html = html.replace("</head>", "<script>window.HANABI_NO_STORY=1</script></head>", 1)
    if kind == "portal":
        html = html.replace("</head>", SDK + "</head>", 1)
    (stage / "index.html").write_text(html, encoding="utf-8")

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
