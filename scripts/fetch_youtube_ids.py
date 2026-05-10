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
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    seen = set()
    artists = []
    for slug, g in data.items():
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                if a in seen: continue
                seen.add(a); artists.append(a)
    return artists


def fetch_one(artist):
    """Use yt-dlp ytsearch1 to get the first videoId for the artist."""
    q = f"ytsearch1:{artist} full album"
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

    todo = [a for a in artists if a not in existing or not existing.get(a)]
    print(f"to fetch: {len(todo)}")

    lock = threading.Lock()
    results = dict(existing)
    counts = {"ok": 0, "fail": 0, "done": 0}

    def worker(a):
        vid = fetch_one(a)
        with lock:
            counts["done"] += 1
            if vid:
                counts["ok"] += 1
                results[a] = vid
            else:
                counts["fail"] += 1
                results.setdefault(a, None)
            if counts["done"] % 25 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {a} -> {vid}")
        return vid

    # 6 parallel workers — yt-dlp + ytsearch is network bound
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(worker, a) for a in todo]
        for _ in as_completed(futs):
            pass

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: ok={counts['ok']} fail={counts['fail']}  saved: {OUT}")


if __name__ == "__main__":
    main()
