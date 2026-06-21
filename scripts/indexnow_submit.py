#!/usr/bin/env python3
"""Submit all sitemap URLs to IndexNow (Bing/Yandex/DuckDuckGo/Seznam).

IndexNow is an open protocol Microsoft/Yandex pushed in 2021 that lets
publishers notify search engines of new/updated URLs in near-real time.
Google does NOT support it, but Bing's index also feeds DuckDuckGo and
Ecosia, so this still drives meaningful traffic.

Usage:
  python scripts/indexnow_submit.py              # submit all sitemap URLs
  python scripts/indexnow_submit.py --once URL   # submit one URL
"""
from __future__ import annotations

import argparse
import json
import re
import secrets
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(r"C:\Users\yuich\yuichi916.github.io")
HOST = "yuichi916.github.io"
SITE = f"https://{HOST}"
SITEMAP = f"{SITE}/sitemap.xml"
# IndexNow accepts any 8-128 hex/dash char key. We use 32 hex chars.
KEY_FILE = ROOT / "indexnow-key.txt"


def get_or_create_key() -> str:
    """Generate a stable 32-hex key and store it at /<key>.txt so search
    engines can verify ownership."""
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    key = secrets.token_hex(16)  # 32 hex chars
    KEY_FILE.write_text(key, encoding="utf-8")
    # also publish key file at site root so the engine can verify it
    public = ROOT / f"{key}.txt"
    public.write_text(key, encoding="utf-8")
    print(f"[init] new key: {key}")
    print(f"[init] commit + push: {KEY_FILE.name}, {public.name}")
    return key


def fetch_sitemap_urls() -> list[str]:
    raw = urllib.request.urlopen(SITEMAP).read()
    root = ET.fromstring(raw)
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    return [u.find(ns + "loc").text for u in root.findall(ns + "url")]


def submit(urls: list[str], key: str) -> None:
    """POST a single batch (up to 10000 URLs) to IndexNow."""
    body = {
        "host": HOST,
        "key": key,
        "keyLocation": f"{SITE}/{key}.txt",
        "urlList": urls,
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        "https://api.indexnow.org/IndexNow",
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "yuichi916-indexnow/1.0",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        print(f"[indexnow] HTTP {resp.status} — submitted {len(urls)} URL(s)")
    except urllib.error.HTTPError as e:
        print(f"[indexnow] HTTP {e.code} — {e.reason}")
        print(f"  body: {e.read().decode('utf-8', errors='replace')[:300]}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--once", help="submit a single URL", default=None)
    args = p.parse_args()

    key = get_or_create_key()
    if args.once:
        submit([args.once], key)
    else:
        urls = fetch_sitemap_urls()
        print(f"submitting {len(urls)} URLs from {SITEMAP}\n")
        # max 10000 per request; we have ~54
        submit(urls, key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
