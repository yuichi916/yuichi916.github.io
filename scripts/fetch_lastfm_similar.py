#!/usr/bin/env python3
"""Scrape Last.fm /+similar pages to harvest the full canonical similar-artists
graph for the salon collection.

Output: scripts/lastfm_similar.json — { artist_name: [similar1, similar2, ...] }

Strategy:
  - For each artist with album info in salon, fetch /music/<encoded>/+similar
  - Parse top-N similar artist names from URL references (count occurrences;
    artists with >=3 hits are in the similar-artists list)
  - URL-decode and clean names

This builds a foundation for a multi-thousand-artist universe map.
"""
import json, re, sys, io, os, time, random, urllib.parse
import importlib.util
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from collections import Counter

LOG = open("C:/tmp/fetch_lastfm.log", "a", encoding="utf-8")
def plog(*a):
    msg = " ".join(str(x) for x in a)
    LOG.write(msg + "\n"); LOG.flush()
print = plog

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
OUT = HERE / "lastfm_similar.json"
RAW_DIR = Path("C:/tmp/lastfm_raw")  # cache HTML for re-parsing
RAW_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

import requests


def url_artist(name):
    """Last.fm URL-encodes spaces as +."""
    # Last.fm uses + for spaces, %xx for others
    return urllib.parse.quote(name, safe='').replace('%20', '+')


def fetch_similar(artist_name, top_n=20, retries=2, timeout=20):
    """Fetch similar artists from Last.fm /+similar HTML page."""
    enc = url_artist(artist_name)
    url = f"https://www.last.fm/music/{enc}/+similar"
    cache = RAW_DIR / (re.sub(r"[^\w]+", "_", artist_name)[:80] + ".html")
    html = None
    if cache.exists() and cache.stat().st_size > 1000:
        html = cache.read_text(encoding="utf-8", errors="replace")
    else:
        for attempt in range(retries + 1):
            try:
                r = requests.get(url, headers=HEADERS, timeout=timeout)
                if r.status_code == 200:
                    html = r.text
                    cache.write_text(html, encoding="utf-8", errors="replace")
                    break
                elif r.status_code == 404:
                    return []
                else:
                    time.sleep(1.0 + random.random())
            except Exception:
                time.sleep(1.0 + random.random())
        if html is None:
            return []
    # Find references to /music/<name>/ in the body. The similar artists
    # appear ~5 times each; one-off references are not similar.
    refs = re.findall(r'/music/([A-Za-z0-9%+_\-\.]+)(?:"|/)', html)
    counter = Counter(refs)
    self_enc = enc
    self_norm = url_artist(artist_name).lower()
    out = []
    for name_enc, count in counter.most_common(top_n + 5):
        if count < 3:
            continue
        if name_enc == self_enc or name_enc.lower() == self_norm:
            continue
        if name_enc.startswith("+"):  # nav like +free-music
            continue
        if name_enc in ("artist",):
            continue
        try:
            name = urllib.parse.unquote_plus(name_enc)
        except Exception:
            name = name_enc
        out.append(name)
        if len(out) >= top_n:
            break
    return out


def load_collection():
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    out = []
    seen = set()
    for slug, g in data.items():
        displays = g.get("artist_displays") or {}
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                if a in seen: continue
                seen.add(a)
                out.append((a, displays.get(a, a)))
    return out


def load_layer2_targets():
    """For layer-2: take all artists referenced in lastfm_similar.json that
    aren't yet in our results dict. Returns list of (raw, display) tuples
    where raw == display since we only know the canonical name."""
    if not OUT.exists():
        return []
    existing = json.loads(OUT.read_text(encoding="utf-8"))
    # All artists currently keyed (collection set)
    have_keys = set(existing.keys())
    # Discovered names
    referenced = set()
    for sims in existing.values():
        for s in sims:
            referenced.add(s)
    # Targets: referenced names not already keyed
    targets = sorted(referenced - have_keys)
    return [(t, t) for t in targets]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "collection"
    if mode == "layer2":
        arts = load_layer2_targets()
        print(f"layer-2 targets (referenced but unscraped): {len(arts)}")
    else:
        arts = load_collection()
        print(f"collection size: {len(arts)}")

    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
        print(f"resuming: {len(existing)} mapped")

    todo = [t for t in arts if t[0] not in existing or not existing[t[0]]]
    print(f"to fetch: {len(todo)}")

    lock = threading.Lock()
    results = dict(existing)
    counts = {"ok": 0, "fail": 0, "done": 0}

    def worker(tup):
        artist_raw, display = tup
        # Use display name for Last.fm query (canonical name) — fall back to raw
        try:
            sims = fetch_similar(display)
        except Exception:
            sims = []
        if not sims and display != artist_raw:
            try:
                sims = fetch_similar(artist_raw)
            except Exception:
                pass
        time.sleep(random.uniform(0.8, 1.6))  # pace — Last.fm rate-limit friendly
        with lock:
            counts["done"] += 1
            if sims:
                counts["ok"] += 1
                results[artist_raw] = sims
            else:
                counts["fail"] += 1
                results.setdefault(artist_raw, [])
            if counts["done"] % 25 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {display} -> {len(sims)} sims")
        return sims

    # 4 parallel workers (Last.fm rate-limit friendly)
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(worker, t) for t in todo]
        for _ in as_completed(futs):
            pass

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    # stats
    nonempty = [v for v in results.values() if v]
    total_edges = sum(len(v) for v in results.values())
    referenced = set()
    for v in results.values():
        referenced.update(v)
    print(f"done: ok={counts['ok']} fail={counts['fail']}  saved: {OUT}")
    print(f"  artists with similars: {len(nonempty)}/{len(results)}")
    print(f"  total edges: {total_edges}")
    print(f"  unique referenced (incl out-of-collection): {len(referenced)}")


if __name__ == "__main__":
    main()
