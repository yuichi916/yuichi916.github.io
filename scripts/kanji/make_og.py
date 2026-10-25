"""まぜる漢字: OG 画像（1200x630）を _dev/mazeru-kanji/og.html から作る。

使い方:  python scripts/kanji/make_og.py   → assets/og/mazeru-kanji-1200x630.jpg
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "mazeru-kanji" / "og.html"
OUT = ROOT / "assets" / "og" / "mazeru-kanji-1200x630.jpg"

with sync_playwright() as pw:
    br = pw.chromium.launch(channel="chrome")
    page = br.new_page(viewport={"width": 1200, "height": 630})
    page.goto(SRC.as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT), type="jpeg", quality=90)
    br.close()
print(OUT, OUT.stat().st_size)
