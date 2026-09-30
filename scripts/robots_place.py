# -*- coding: utf-8 -*-
"""sitemap に載っているページのうち、robots メタが無いものに max-image-preview:large を足す。
Google Discover や検索結果で大きい画像を出してよいという指定（noindex のページは sitemap に載らないので触らない）。
何度実行してもよい（robots メタがすでにあるページは飛ばす）。ページを足したら generate_sitemap.py のあとに再実行する。
  set PYTHONUTF8=1 && python scripts/robots_place.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAG = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'


def main():
    urls = re.findall(r"<loc>https://yuichi916\.github\.io/([^<]*)</loc>", (ROOT / "sitemap.xml").read_text(encoding="utf-8"))
    for u in urls:
        rel = u + "index.html" if (u == "" or u.endswith("/")) else u
        path = ROOT / rel
        src = path.read_bytes().decode("utf-8")
        if re.search(r'<meta\s+name=["\']robots["\']', src, re.I):
            continue
        m = re.search(r"<meta\s+name=[\"']viewport[\"'][^>]*>", src, re.I) or re.search(r"<meta\s+charset=[^>]*>", src, re.I)
        if not m:
            print("skip (no anchor):", rel)
            continue
        nl = "\r\n" if "\r\n" in src else "\n"
        line_start = src.rfind("\n", 0, m.start()) + 1
        indent = re.match(r"[ \t]*", src[line_start:]).group(0)
        src = src[:m.end()] + nl + indent + TAG + src[m.end():]
        path.write_bytes(src.encode("utf-8"))
        print("placed:", rel)


if __name__ == "__main__":
    main()
