#!/usr/bin/env python3
"""Fetch MusicBrainz artist relationships for collection artists.

For each artist:
  1. Search by name → take best-scored match's MBID
  2. Fetch /artist/<MBID>?inc=artist-rels+tags → parse:
       - "member of band" links
       - "collaboration" / "co-producer" / "performer" rels
       - tag list (genre signals)

MusicBrainz allows ~1 req/s with a User-Agent identifying you.

Output: scripts/musicbrainz_relations.json
  { artist_name: {
      "mbid": "...",
      "mb_name": "...",         # canonical name on MB
      "country": "DE",
      "type": "Group" | "Person",
      "tags": [{name, count}],
      "members": [name, ...],   # band members
      "member_of": [name, ...], # bands the person is in
      "collaborators": [name, ...],
    } }
"""
import json, sys, io, os, time, importlib.util
from pathlib import Path
import threading

LOG = open("C:/tmp/fetch_musicbrainz.log", "a", encoding="utf-8")
def plog(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()
print = plog

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
OUT = HERE / "musicbrainz_relations.json"

import requests

UA = "ViewsEngineerSalonBot/1.0 (https://yuichi916.github.io/; yuichi916@gmail.com)"
BASE = "https://musicbrainz.org/ws/2"
HEADERS = {"User-Agent": UA, "Accept": "application/json"}

# MusicBrainz hard rate limit is 1 req/s per UA. We use a global lock + sleep.
_rate_lock = threading.Lock()
_last_call = [0.0]


def mb_get(path, params, timeout=20, retries=2):
    params = dict(params)
    params["fmt"] = "json"
    for attempt in range(retries + 1):
        with _rate_lock:
            now = time.time()
            wait = 1.05 - (now - _last_call[0])
            if wait > 0:
                time.sleep(wait)
            _last_call[0] = time.time()
        try:
            r = requests.get(f"{BASE}/{path}", params=params, headers=HEADERS, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 503:
                time.sleep(2 + attempt * 2)
                continue
            return None
        except Exception:
            time.sleep(1.5)
    return None


def search_artist(name):
    d = mb_get("artist", {"query": f'artist:"{name}"', "limit": 3})
    if not d:
        return None
    arts = d.get("artists") or []
    if not arts:
        return None
    # Best match (MB returns by relevance)
    return arts[0]


def get_relations(mbid):
    return mb_get(f"artist/{mbid}", {"inc": "artist-rels+tags"})


def parse_relations(rels_data):
    rels = rels_data.get("relations", []) if rels_data else []
    members, member_of, collabs = [], [], []
    for r in rels:
        t = r.get("type", "")
        ar = r.get("artist") or {}
        nm = ar.get("name")
        if not nm:
            continue
        if t == "member of band":
            # direction-target gives membership direction
            if r.get("direction") == "backward":
                # this artist *has* member nm
                members.append(nm)
            else:
                member_of.append(nm)
        elif t in ("collaboration", "supporting musician", "performance"):
            collabs.append(nm)
    return members, member_of, collabs


def fetch_one(name):
    art = search_artist(name)
    if not art:
        return None
    mbid = art.get("id")
    if not mbid:
        return None
    rels = get_relations(mbid)
    if not rels:
        return None
    members, member_of, collabs = parse_relations(rels)
    tags = [{"name": t.get("name"), "count": t.get("count", 0)}
            for t in (rels.get("tags") or [])][:15]
    return {
        "mbid": mbid,
        "mb_name": rels.get("name") or art.get("name"),
        "country": rels.get("country") or art.get("country"),
        "type": rels.get("type") or art.get("type"),
        "tags": tags,
        "members": members,
        "member_of": member_of,
        "collaborators": collabs,
    }


def load_collection():
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    out, seen = [], set()
    for slug, g in data.items():
        displays = g.get("artist_displays") or {}
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                if a in seen: continue
                seen.add(a)
                out.append((a, displays.get(a, a)))
    return out


def main():
    arts = load_collection()
    print(f"collection: {len(arts)}")

    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    todo = [t for t in arts if t[0] not in existing]
    print(f"to fetch: {len(todo)}")

    counts = {"ok": 0, "fail": 0, "done": 0}
    results = dict(existing)
    for raw, display in todo:
        # Skip clear non-artist entries
        skip_keywords = ["FLAC", "[Hi-Res]", "Various Artists", "Compilation",
                          "Best Album", "ピアノコレクション", "ヴォーカル"]
        if any(k.lower() in display.lower() for k in skip_keywords):
            results[raw] = {}
            counts["done"] += 1
            counts["fail"] += 1
            continue
        try:
            res = fetch_one(display)
        except Exception:
            res = None
        counts["done"] += 1
        if res:
            counts["ok"] += 1
            results[raw] = res
        else:
            counts["fail"] += 1
            results.setdefault(raw, {})
        if counts["done"] % 20 == 0:
            OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {display} -> {(res or {}).get('mbid')}")

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: ok={counts['ok']} fail={counts['fail']}")


if __name__ == "__main__":
    main()
