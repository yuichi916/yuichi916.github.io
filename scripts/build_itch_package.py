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
# .nextstage と [data-noportal] は「次のステージは準備中」の知らせ。ゲームサイトでは未完成に見えるので出さない
PORTAL_CSS = ("<style id=\"portal-build\">.endnext,.sharebox,pre.share,[data-feel],.world,.nextstage,[data-noportal]{display:none!important}</style>"
              "<script>/* ポータル用: 外への問い合わせ (アクセス解析の数え) をしない */"
              "(()=>{const f=window.fetch;window.fetch=(u,...a)=>/goatcounter|docs\.google/.test(String(u&&u.url||u))"
              "?Promise.reject(new Error('portal build')):f(u,...a);})();</script>")


def portal_strip(html: str) -> str:
    html = re.sub(r'<script[^>]*gc\.zgo\.at[^>]*></script>\s*', "", html)          # アクセス解析
    html = re.sub(r'<script[^>]*assets/feel/feel\.js[^>]*></script>\s*', "", html)  # 気持ちスタンプ
    html = re.sub(r'<div class="endnext">.*?</div>\s*', "", html, flags=re.S)        # 他の作品・研究ノートへの誘導（隠すだけでなく外す）
    html = re.sub(r'<div data-feel="[^"]*"[^>]*></div>\s*', "", html)                  # 気持ちスタンプの置き場所
    # サイトを指す頭の情報（正規 URL・SNS のカード・検索用の構造化データ）。ゲームサイトでは、外のサイトへの導線になるので外す
    html = re.sub(r'<link rel="canonical"[^>]*>\s*', "", html)
    html = re.sub(r'<meta (?:property="og:|name="twitter:)[^>]*>\s*', "", html)
    html = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', "", html, flags=re.S)
    # 画面の側で「ゲームサイト用」と分かるように（結果を 1 列にする など）
    # CrazyGames の SDK v3（遊んでいる/止めた の合図・広告・クラウド保存）。ほかのサイトでは SDK が動かず、画面の側で何もしない
    # タブの名前は短く（言葉は画面の側で、ゲームサイトが知らせる言葉に合わせて付けなおす）
    html = re.sub(r"<title>[^<]*</title>", "<title>Hitofude Hanabi</title>", html, count=1)
    # SDK は読みこんだらすぐ起こし、読みこみの始めの合図を出す（画面の側は window.__cgInit を待って、終わりの合図を出す）
    return html.replace("</head>", PORTAL_CSS + "<script>window.HITO_PORTAL=1</script>"
                        "<script src=\"https://sdk.crazygames.com/crazygames-sdk-v3.js\"></script>"
                        "<script>(()=>{try{const s=window.CrazyGames&&window.CrazyGames.SDK;if(!s)return;"
                        "window.__cgInit=s.init().then(()=>{try{if(s.environment!=='disabled')s.game.loadingStart();}catch(e){}});"
                        "}catch(e){}})();</script></head>", 1)


FONT_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
FONT_CACHE = OUT.parent / "fontcache"


def _ranges(spec: str) -> list[tuple[int, int]]:
    """unicode-range: U+0000-00FF, U+0131, U+4E?? を (はじめ, おわり) の並びにする。"""
    out = []
    for part in spec.split(","):
        part = part.strip().upper().removeprefix("U+")
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.append((int(a, 16), int(b, 16)))
        elif "?" in part:
            out.append((int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)))
        else:
            out.append((int(part, 16), int(part, 16)))
    return out


def _fetch(url: str, binary: bool = False):
    import hashlib
    import urllib.request
    FONT_CACHE.mkdir(parents=True, exist_ok=True)
    key = FONT_CACHE / hashlib.sha1(url.encode()).hexdigest()
    if key.exists():
        data = key.read_bytes()
    else:
        req = urllib.request.Request(url, headers={"User-Agent": FONT_UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        key.write_bytes(data)
    return data if binary else data.decode("utf-8")


def self_host_fonts(html: str, stage: Path, text: str) -> str:
    """Google Fonts の読みこみを、zip の中の字形ファイルに置きかえる（ゲームサイトでは外のサイトを読まない）。
    使う字（ページと JS の文字）にかかる切れはしだけを入れる。取れなければ元のまま。"""
    links = re.findall(r'<link href="(https://fonts\.googleapis\.com/css2\?[^"]+)"[^>]*>', html)
    if not links:
        return html
    used = {ord(c) for c in text} | set(range(0x20, 0x7F))
    faces, n = [], 0
    try:
        for href in links:
            css = _fetch(href.replace("&amp;", "&"))
            for block in re.findall(r"@font-face\s*{[^}]*}", css):
                m = re.search(r"unicode-range:\s*([^;]+);", block)
                if m and not any(a <= c <= b for a, b in _ranges(m.group(1)) for c in used):
                    continue
                url = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", block)
                if not url:
                    continue
                name = f"f{n:03d}.woff2"
                n += 1
                (stage / "assets" / "fonts").mkdir(parents=True, exist_ok=True)
                (stage / "assets" / "fonts" / name).write_bytes(_fetch(url.group(1), binary=True))
                faces.append(block.replace(url.group(1), f"assets/fonts/{name}"))
    except Exception as e:  # ネットにつながらないときは、元のまま（字は端末の字で出る）
        print(f"  ※ 字形を取れなかったので Google Fonts のまま: {e}")
        return html
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.(?:googleapis|gstatic)\.com"[^>]*>\s*', "", html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]+"[^>]*>\s*', "", html)
    size = sum(p.stat().st_size for p in (stage / "assets" / "fonts").glob("*.woff2"))
    print(f"  字形 {n} 個 ({size/1e6:.1f}MB) を zip に入れた")
    return html.replace("</head>", "<style id=\"portal-fonts\">" + "".join(faces) + "</style></head>", 1)


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
        text = src.read_text(encoding="utf-8") + "".join(p.read_text(encoding="utf-8") for d in dirs for p in (ROOT / d).rglob("*.js"))
        html = self_host_fonts(html, stage, text)
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
