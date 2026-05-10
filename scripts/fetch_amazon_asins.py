#!/usr/bin/env python3
"""Pre-bake Amazon JP product ASIN per (artist, album) pair.

For each artist with a recommended album in salon_albums.py, search
amazon.co.jp/s?i=digital-music for "<artist> <album>" and parse the first
result's ASIN. With the ASIN we can build direct product-page URLs:
  - amazon.co.jp/dp/<ASIN>?tag=viewsengineer-22 — MP3 album page
  - music.amazon.co.jp/albums/<ASIN>?tag=...    — Amazon Music album page

Output: scripts/amazon_asins.json — { artist_name: {"asin": ..., "title": ...} }

We also fetch a CD/physical-media ASIN as a separate entry where available
(distinct department: i=popular for music CDs).
"""
import json, re, sys, io, os, time, random
import urllib.parse
import importlib.util
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

LOG = open("C:/tmp/fetch_amazon_asins.log", "a", encoding="utf-8")
def plog(*a):
    msg = " ".join(str(x) for x in a)
    LOG.write(msg + "\n"); LOG.flush()
print = plog

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
ALBUMS_FILE = HERE / "salon_albums.py"
OUT = HERE / "amazon_asins.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "ja,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

import requests


def search_first_asin(query, dept="digital-music", timeout=20):
    """Search amazon.co.jp and return the first result's ASIN + title.

    dept: "digital-music" for MP3 albums, "popular" or "" for physical/all.
    """
    q = urllib.parse.quote(query)
    url = f"https://www.amazon.co.jp/s?k={q}"
    if dept:
        url += f"&i={dept}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
    except Exception as e:
        return None, None
    if r.status_code != 200:
        return None, None
    html = r.text
    # Look for first data-asin in search result rows (search results have
    # data-component-type="s-search-result"). The first such row's data-asin
    # is the top product.
    m = re.search(r'data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]{10})"', html)
    if not m:
        # alt order
        m = re.search(r'data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"', html)
    if not m:
        return None, None
    asin = m.group(1)
    # Try to find title for the matched ASIN
    title = None
    t_m = re.search(rf'data-asin="{asin}".*?<h2[^>]*>(.*?)</h2>', html, re.S)
    if t_m:
        # strip HTML tags
        title = re.sub(r"<[^>]+>", "", t_m.group(1))
        title = re.sub(r"\s+", " ", title).strip()
    return asin, title


def load_artists_with_albums():
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    out = []
    seen = set()
    for slug, g in data.items():
        displays = g.get("artist_displays") or {}
        albums = g.get("artist_albums") or {}
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                if a in seen: continue
                seen.add(a)
                alb = albums.get(a)
                if not alb: continue  # skip artists without album info
                out.append((a, displays.get(a, a), alb["title"]))
    return out


def main():
    arts = load_artists_with_albums()
    print(f"artists with album info: {len(arts)}")

    existing = {}
    if OUT.exists():
        existing = json.loads(OUT.read_text(encoding="utf-8"))
        print(f"resuming: {len(existing)} mapped")

    todo = [t for t in arts if t[0] not in existing or not existing[t[0]].get("asin")]
    print(f"to fetch: {len(todo)}")

    lock = threading.Lock()
    results = dict(existing)
    counts = {"ok": 0, "fail": 0, "done": 0}

    def worker(tup):
        artist_raw, display, album = tup
        query = f"{display} {album}"
        # Small jitter to avoid synchronized hits
        time.sleep(random.uniform(0.4, 1.0))
        asin, title = search_first_asin(query, dept="digital-music")
        with lock:
            counts["done"] += 1
            if asin:
                counts["ok"] += 1
                results[artist_raw] = {"asin": asin, "title": title or "", "query": query}
            else:
                counts["fail"] += 1
                results.setdefault(artist_raw, {"asin": None, "query": query})
            if counts["done"] % 25 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {artist_raw} -> {asin}")
        return asin

    # 4 parallel workers, modest pace to be a polite client
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(worker, t) for t in todo]
        for _ in as_completed(futs):
            pass

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: ok={counts['ok']} fail={counts['fail']}  saved: {OUT}")


if __name__ == "__main__":
    main()
