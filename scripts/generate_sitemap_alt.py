"""Generate two alternative sitemaps for forcing GSC to re-parse:

  - sitemap-v2.xml: indented, one tag per line (more "human readable").
    Some Google internal caching keys off the filename so a fresh name
    bypasses any cached "couldn't read" verdict.

  - sitemap-index.xml: sitemap-index pointing at sitemap-v2.xml.
    Submitting an index sometimes triggers a fresh fetch path.

Run after `generate_sitemap.py` so the URL list is up to date.
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]   # 絶対パス直書きをやめ、スクリプトのあるリポジトリを対象にする
SITE = "https://yuichi916.github.io"
SOURCE = ROOT / "sitemap.xml"
OUT_V2 = ROOT / "sitemap-v2.xml"
OUT_IDX = ROOT / "sitemap-index.xml"


def main() -> int:
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    tree = ET.parse(SOURCE)
    urls = []
    for u in tree.getroot().findall(ns + "url"):
        loc = u.find(ns + "loc").text
        lastmod = u.find(ns + "lastmod")
        freq = u.find(ns + "changefreq")
        prio = u.find(ns + "priority")
        urls.append((
            loc,
            lastmod.text if lastmod is not None else "",
            freq.text if freq is not None else "monthly",
            prio.text if prio is not None else "0.5",
        ))

    # 1. sitemap-v2.xml: indented format
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod, freq, prio in urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    OUT_V2.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote: {OUT_V2}  ({len(urls)} URLs, indented)")

    # 2. sitemap-index.xml
    today = datetime.now(timezone.utc).date().isoformat()
    idx = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <sitemap>",
        f"    <loc>{SITE}/sitemap-v2.xml</loc>",
        f"    <lastmod>{today}</lastmod>",
        "  </sitemap>",
        "  <sitemap>",
        f"    <loc>{SITE}/sitemap.xml</loc>",
        f"    <lastmod>{today}</lastmod>",
        "  </sitemap>",
        "</sitemapindex>",
    ]
    OUT_IDX.write_text("\n".join(idx) + "\n", encoding="utf-8")
    print(f"wrote: {OUT_IDX}  (index pointing to both)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
