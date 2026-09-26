"""itch.io 用に、1 作品を自己完結した zip に固める。

itch.io の HTML5 ゲームは zip の直下に index.html が必要なので、
seikai.html / hyaku.html などを index.html にリネームして入れる。

サイト上のアセットを実行時に読むため、静的な参照だけでは取りこぼす。
そこで「その作品が使うディレクトリを丸ごと入れる」方式にしている。

使い方:
    python scripts/build_itch_package.py hyaku
    python scripts/build_itch_package.py --list
"""
from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_dist" / "itch"

# name -> (エントリ HTML, 丸ごと入れるディレクトリ, 追加で入れる単体ファイル)
WORKS: dict[str, tuple[str, list[str], list[str]]] = {
    "hyaku":     ("hyaku.html",     ["assets/hyaku"],      ["favicon.svg"]),
    # cabin は BGM を assets/bgm/<file> と実行時に組み立てるのでディレクトリごと入れる
    "cabin":     ("cabin.html",     ["assets/bgm", "assets/voice"], ["favicon.svg"]),
    "ehon":      ("ehon.html",      ["_ehon_assets"],      ["favicon.svg"]),
    "stopwatch": ("stopwatch.html", [],                    ["favicon.svg"]),
    # hitofude は './assets/...' の import と BGM の fetch で読むのでディレクトリごと入れる
    "hitofude":  ("hitofude.html",  ["assets/hitofude", "assets/feel"], ["favicon.svg"]),
    # ゲームポータル (CrazyGames・Y8・Game Jolt など) 用: 他作品・他サイトへの誘導と、外への通信を外す (PORTAL_STRIP)
    "hitofude-portal": ("hitofude.html", ["assets/hitofude", "assets/feel"], ["favicon.svg"]),
}

# ポータル用の版だけに入れる変更。サイトの HTML は変えない
PORTAL_CSS = ("<style id=\"portal-build\">.endnext,.sharebox,pre.share,[data-feel],.world{display:none!important}</style>"
              "<script>/* ポータル用: 外への問い合わせ (アクセス解析の数え) をしない */"
              "(()=>{const f=window.fetch;window.fetch=(u,...a)=>/goatcounter|docs\.google/.test(String(u&&u.url||u))"
              "?Promise.reject(new Error('portal build')):f(u,...a);})();</script>")


def portal_strip(html: str) -> str:
    html = re.sub(r'<script[^>]*gc\.zgo\.at[^>]*></script>\s*', "", html)          # アクセス解析
    html = re.sub(r'<script[^>]*assets/feel/feel\.js[^>]*></script>\s*', "", html)  # 気持ちスタンプ
    return html.replace("</head>", PORTAL_CSS + "</head>", 1)


def local_refs(html: str) -> set[str]:
    """HTML 内の、自サイト内を指す参照を拾う。"""
    refs: set[str] = set()
    for m in re.finditer(r'(?:src|href)="((?!https?:|//|data:|#|mailto:|javascript:)[^"]+)"', html):
        refs.add(m.group(1).split("?")[0].split("#")[0])
    for m in re.finditer(r"""['"]((?:assets|_ehon_assets)/[^'"]+)['"]""", html):
        refs.add(m.group(1))
    return {r for r in refs if r}


def build(name: str) -> int:
    if name not in WORKS:
        print(f"未知の作品: {name}（{', '.join(WORKS)}）")
        return 1
    entry, dirs, extras = WORKS[name]
    src = ROOT / entry
    if not src.exists():
        print(f"見つからない: {entry}")
        return 1

    stage = OUT / name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    html = src.read_text(encoding="utf-8")
    if name.endswith("-portal"):
        html = portal_strip(html)
    # サイトの一番上を起点にした /assets/... は、itch.io ではサイトの外を指すので相対にする
    html = re.sub(r'((?:src|href)=")/(assets/)', r"\1\2", html)
    # itch.io は zip 直下の index.html を開く
    (stage / "index.html").write_text(html, encoding="utf-8")

    copied, missing = 0, []
    for d in dirs:
        s = ROOT / d
        if not s.is_dir():
            missing.append(d)
            continue
        shutil.copytree(s, stage / d)
        copied += sum(1 for _ in (stage / d).rglob("*") if _.is_file())

    for f in extras + [r for r in local_refs(html) if not r.endswith(".html")]:
        s = ROOT / f
        if not s.is_file():
            continue
        t = stage / f
        if t.exists():
            continue
        t.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(s, t)
        copied += 1

    # 他ページへのリンクは zip の中では開けないので、サイトの URL に向け直す
    site = "https://yuichi916.github.io/"
    fixed = re.sub(r'href="((?!https?:|//|#|mailto:)[^"]*\.html)"',
                   lambda m: f'href="{site}{m.group(1)}" target="_blank"', html)
    fixed = fixed.replace('href="./"', f'href="{site}" target="_blank"')
    (stage / "index.html").write_text(fixed, encoding="utf-8")

    zpath = OUT / f"{name}-itch.zip"
    if zpath.exists():
        zpath.unlink()
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in sorted(stage.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(stage).as_posix())

    size = zpath.stat().st_size
    print(f"{name}: {copied} ファイル / zip {size/1e6:.1f}MB -> {zpath}")
    if missing:
        print(f"  ※ 見つからなかったディレクトリ: {missing}")
    if size > 1_000_000_000:
        print("  ※ itch.io の 1GB 制限を超えています")
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] == "--list":
        for k, (e, d, _) in WORKS.items():
            print(f"  {k:<10} {e:<16} dirs={d}")
        return 0
    return build(sys.argv[1])


if __name__ == "__main__":
    raise SystemExit(main())
