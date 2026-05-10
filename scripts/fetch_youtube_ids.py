#!/usr/bin/env python3
"""Pre-bake one YouTube videoId per artist via yt-dlp ytsearch.

Output: scripts/youtube_ids.json — { artist_name: videoId, ... }
Loaded by generate_salon_map.py and embedded into AUDIO data so the
salon popover can play tracks via youtube.com/embed/<id>?autoplay=1.
"""
import json, subprocess, sys, io, importlib.util, os, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

LOG = open("C:/tmp/fetch_youtube_ids.log", "a", encoding="utf-8")
def plog(*a):
    msg = " ".join(str(x) for x in a)
    LOG.write(msg + "\n"); LOG.flush()
print = plog

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
OUT = HERE / "youtube_ids.json"


def load_artists():
    """Load all artists with their (display_name, album_title) when available."""
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    seen = set()
    artists = []
    for slug, g in data.items():
        displays = g.get("artist_displays") or {}
        albums = g.get("artist_albums") or {}
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                if a in seen: continue
                seen.add(a)
                display = displays.get(a, a)
                alb = albums.get(a)
                album_title = alb["title"] if alb else None
                artists.append((a, display, album_title))
    return artists


def fetch_one(artist, display=None, album=None):
    """Use yt-dlp ytsearch1 to get the first videoId for the artist+album.

    When album is given, prefer "<display> <album>" — much more accurate.
    Otherwise fall back to "<display> full album".
    """
    name = display or artist
    if album:
        q = f"ytsearch1:{name} {album}"
    else:
        q = f"ytsearch1:{name} full album"
    try:
        r = subprocess.run(
            ["yt-dlp", "--quiet", "--no-warnings", "--get-id",
             "--default-search", "ytsearch", q],
            capture_output=True, text=True, timeout=30,
            encoding="utf-8", errors="replace"
        )
        out = (r.stdout or "").strip().splitlines()
        if out and len(out[0]) == 11:
            return out[0]
    except Exception as e:
        return None
    return None


def main():
    artists = load_artists()
    print(f"total artists: {len(artists)}")

    existing = {}
    if OUT.exists():
        existing = json.loads(OUT.read_text(encoding="utf-8"))
        print(f"resuming: {len(existing)} already mapped")

    # When an album is now known but the existing id was fetched with artist-only,
    # we want to RE-FETCH for better accuracy. Track per-artist last query type.
    QUERIES = Path(__file__).parent / "youtube_query_log.json"
    queries_used = {}
    if QUERIES.exists():
        queries_used = json.loads(QUERIES.read_text(encoding="utf-8"))

    # Decide what to fetch:
    # - artists with no current id: fetch
    # - artists with current id but album available now and previous query had no album: re-fetch
    todo = []
    for tup in artists:
        a, display, album = tup
        last_q = queries_used.get(a, "")
        has_album_query = album and ("|" in last_q and last_q.split("|", 1)[1])
        if a not in existing or not existing.get(a):
            todo.append(tup)
        elif album and not has_album_query:
            todo.append(tup)
    print(f"to fetch (incl. album re-fetches): {len(todo)}")

    lock = threading.Lock()
    results = dict(existing)
    counts = {"ok": 0, "fail": 0, "done": 0}

    def worker(tup):
        a, display, album = tup
        vid = fetch_one(a, display, album)
        q_used = f"{display or a}|{album or ''}"
        with lock:
            counts["done"] += 1
            queries_used[a] = q_used
            if vid:
                counts["ok"] += 1
                results[a] = vid
            else:
                counts["fail"] += 1
                results.setdefault(a, None)
            if counts["done"] % 25 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
                QUERIES.write_text(json.dumps(queries_used, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {a} -> {vid}")
        return vid

    # 6 parallel workers — yt-dlp + ytsearch is network bound
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(worker, t) for t in todo]
        for _ in as_completed(futs):
            pass

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    QUERIES.write_text(json.dumps(queries_used, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: ok={counts['ok']} fail={counts['fail']}  saved: {OUT}")


if __name__ == "__main__":
    main()
