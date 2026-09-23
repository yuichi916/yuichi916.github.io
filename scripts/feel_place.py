# -*- coding: utf-8 -*-
"""気持ちスタンプのはがき（assets/feel/feel.js）を、ページ末尾の footer の直前に差し込む。

何度実行してもよい（data-feel がすでにあるページは飛ばす）。研究ノートを足したら再実行する。

  set PYTHONUTF8=1 && python scripts/feel_place.py

物語・ゲーム・トップの置き場所は画面ごとに位置が違うので、ここでは扱わない（手で置いてある）。
作業ツリーの HTML は CRLF なので、改行コードはファイルに合わせて保つ。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = '<script type="module" src="/assets/feel/feel.js"></script>'

# (ファイル, 作品ID, 組, この文字列がある行の直前に差し込む)
FOOTER_PAGES = [
    ("ai-map.html", "ai-map", "tool", '<footer><div class="wrap">'),
    ("salon.html", "salon", "tool", '<footer class="foot">'),
    ("ai-english.html", "ai-english", "tool", "<footer>"),
    ("toeic.html", "toeic", "tool", '<footer class="foot">'),
    ("novel-bench.html", "novel-bench", "tool", '<div class="foot">'),
    ("hitoritabi/index.html", "hitoritabi", "tool", "<footer>"),
]


def method_pages():
    for sub in ("method", "method/en"):
        for p in sorted((ROOT / sub).glob("*.html")):
            if p.name == "index.html":
                continue
            rel = p.relative_to(ROOT).as_posix()
            yield rel, rel[: -len(".html")], "note", "<footer"


def place(rel, work, set_, anchor):
    path = ROOT / rel
    html = path.read_bytes().decode("utf-8")
    if "data-feel=" in html:
        return "skip"
    i = html.find(anchor)
    if i < 0:
        raise SystemExit(f"{rel}: 目印 {anchor!r} が見つからない")
    nl = "\r\n" if "\r\n" in html else "\n"
    start = html.rfind("\n", 0, i) + 1  # 目印のある行の頭に差し込む
    snippet = f'<div data-feel="{work}" data-feel-set="{set_}"></div>{nl}{SCRIPT}{nl}'
    path.write_bytes((html[:start] + snippet + html[start:]).encode("utf-8"))
    return "placed"


def main():
    for rel, work, set_, anchor in FOOTER_PAGES + list(method_pages()):
        print(f"{place(rel, work, set_, anchor):6}  {rel}")


if __name__ == "__main__":
    main()
