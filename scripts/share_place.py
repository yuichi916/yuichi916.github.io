# -*- coding: utf-8 -*-
"""研究ノートと AI アトラスの気持ちスタンプの直前に、X とはてなブックマークの共有リンクを置く。
何度実行してもよい（<!-- share --> で囲んだ部分を作り直す）。研究ノートを足したら feel_place.py のあとに再実行する。
  set PYTHONUTF8=1 && python scripts/share_place.py
外部の JS は読まない（リンクだけ）。X に渡す URL には ?ref=x-share を付けて GoatCounter で数える。
はてブはブックマークが URL ごとに数えられるので、正規 URL のまま渡す。
"""
import html
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
BEGIN, END = "<!-- share -->", "<!-- /share -->"
STYLE = ("display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:40px auto 0;padding:0 16px;"
         "font-size:14px;line-height:1.4")
LINK = ("display:inline-block;padding:8px 16px;border:1px solid currentColor;border-radius:999px;"
        "color:inherit;text-decoration:none;opacity:.85")


def pages():
    yield "ai-map.html"
    for sub in ("method", "method/en"):
        for p in sorted((ROOT / sub).glob("*.html")):
            if p.name != "index.html":
                yield p.relative_to(ROOT).as_posix()


def block(src, en):
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', src).group(1)
    title = html.unescape(re.search(r"<title>(.*?)</title>", src, re.S).group(1)).strip()
    x = "https://x.com/intent/post?text=" + quote(title) + "&url=" + quote(canon + "?ref=x-share", safe="")
    hb = "https://b.hatena.ne.jp/entry/s/" + canon.split("://", 1)[1]
    lx, lh, lab = ("Share on X", "Hatena Bookmark", "Share") if en else ("X で共有", "はてなブックマーク", "共有")
    return (f'{BEGIN}<nav class="share-row" aria-label="{lab}" style="{STYLE}">'
            f'<a href="{html.escape(x)}" target="_blank" rel="noopener" style="{LINK}">{lx}</a>'
            f'<a href="{html.escape(hb)}" target="_blank" rel="noopener" style="{LINK}">{lh}</a>'
            f'</nav>{END}')


def main():
    for rel in pages():
        path = ROOT / rel
        src = path.read_bytes().decode("utf-8")
        nl = "\r\n" if "\r\n" in src else "\n"
        src = re.sub(re.escape(BEGIN) + ".*?" + re.escape(END) + r"\r?\n", "", src, flags=re.S)
        i = src.find("<div data-feel=")
        if i < 0:
            print("skip (no feel):", rel)
            continue
        start = src.rfind("\n", 0, i) + 1
        new = src[:start] + block(src, rel.startswith("method/en/")) + nl + src[start:]
        path.write_bytes(new.encode("utf-8"))
        print("placed:", rel)


if __name__ == "__main__":
    main()
