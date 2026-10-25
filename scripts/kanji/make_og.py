"""まぜる漢字: OG 画像（1200x630）を _dev/mazeru-kanji/ の HTML から作る。

使い方:  python scripts/kanji/make_og.py [og|og_yaku|og_print]
  og      → assets/og/mazeru-kanji-1200x630.jpg（きょうの7字）
  og_yaku → assets/og/mazeru-yaku-1200x630.jpg（役札。mazeru.html の og:image）
  og_print → assets/og/kanji-print-1200x630.jpg（kanji-print.html の og:image）
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
NAME = sys.argv[1] if len(sys.argv) > 1 else "og"
SRC = ROOT / "_dev" / "mazeru-kanji" / (NAME + ".html")
OUT = ROOT / "assets" / "og" / {"og_yaku": "mazeru-yaku-1200x630.jpg", "og_print": "kanji-print-1200x630.jpg"}.get(NAME, "mazeru-kanji-1200x630.jpg")

with sync_playwright() as pw:
    br = pw.chromium.launch(channel="chrome")
    page = br.new_page(viewport={"width": 1200, "height": 630})
    page.goto(SRC.as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT), type="jpeg", quality=90)
    br.close()
print(OUT, OUT.stat().st_size)
