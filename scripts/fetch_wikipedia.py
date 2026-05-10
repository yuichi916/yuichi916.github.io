#!/usr/bin/env python3
"""Fetch Wikipedia infobox / article relations for collection artists.

For each artist, query the Wikipedia API for the article text and parse:
  - Associated acts (Wikipedia infobox field)
  - Past members
  - Members
  - Influenced by / Influences
  - Genres
  - Origin country / Years active

Output: scripts/wikipedia_relations.json
  { artist_name: {
      "title": canonical Wikipedia title,
      "associated_acts": [name, ...],
      "members": [...],
      "past_members": [...],
      "genres": [...],
      "origin": "...",
      "years_active": "...",
    } }
"""
import json, re, sys, io, os, time, random, urllib.parse, importlib.util
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

LOG = open("C:/tmp/fetch_wikipedia.log", "a", encoding="utf-8")
def plog(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()
print = plog

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
OUT = HERE / "wikipedia_relations.json"

import requests

UA = "ViewsEngineerSalonBot/1.0 (https://yuichi916.github.io/; yuichi916@gmail.com)"
HEADERS = {"User-Agent": UA, "Accept": "application/json"}


def search_title(name, timeout=15):
    """Resolve an artist name to the best Wikipedia article title via search."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f'"{name}"',
        "srlimit": "3",
        "format": "json",
        "srprop": "snippet",
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        if r.status_code != 200:
            return None
        d = r.json()
        hits = d.get("query", {}).get("search", [])
        # Filter to the most likely musician/band page
        for h in hits:
            t = h.get("title", "")
            sn = (h.get("snippet") or "").lower()
            # Heuristic: prefer pages that look band/artist
            if any(k in sn for k in ("band", "musician", "singer", "composer",
                                     "guitarist", "drummer", "rapper", "duo",
                                     "ensemble", "group", "songwriter", "album")):
                return t
        return hits[0]["title"] if hits else None
    except Exception:
        return None


def fetch_html(title, timeout=20):
    """Get rendered HTML for a Wikipedia article."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "parse",
        "page": title,
        "prop": "text",
        "format": "json",
        "redirects": "1",
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        if r.status_code != 200:
            return None, None
        d = r.json()
        if "error" in d:
            return None, None
        return d["parse"]["title"], d["parse"]["text"]["*"]
    except Exception:
        return None, None


_INFOBOX_LABEL_PATTERNS = {
    "associated_acts": r"associated[\s_]?acts?",
    "members": r"^\s*members\s*$",
    "past_members": r"(past|former)\s+members",
    "genres": r"^\s*genres?\s*$",
    "origin": r"^\s*origin\s*$",
    "years_active": r"years[\s_]?active",
    "influences": r"^\s*influences\s*$",
    "influenced_by": r"influence[ds]?[\s_]by",
}


def parse_infobox(html):
    """Return a dict of label → list of artist names (or string for origin/years)."""
    out = {}
    if not html:
        return out
    # Find the main infobox table
    inf_m = re.search(
        r'<table[^>]*class="[^"]*infobox[^"]*"[^>]*>(.*?)</table>',
        html, re.S | re.I,
    )
    if not inf_m:
        return out
    box = inf_m.group(1)
    # Iterate rows
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", box, re.S | re.I)
    for row in rows:
        th_m = re.search(r"<th[^>]*>(.*?)</th>", row, re.S | re.I)
        td_m = re.search(r"<td[^>]*>(.*?)</td>", row, re.S | re.I)
        if not th_m or not td_m:
            continue
        label_raw = re.sub(r"<[^>]+>", "", th_m.group(1)).strip().lower()
        td_html = td_m.group(1)
        for key, pat in _INFOBOX_LABEL_PATTERNS.items():
            if re.search(pat, label_raw, re.I):
                if key in ("origin", "years_active"):
                    text = re.sub(r"<[^>]+>", " ", td_html)
                    text = re.sub(r"\s+", " ", text).strip()
                    out[key] = text
                else:
                    # Extract anchor texts
                    anchors = re.findall(r'<a[^>]*href="/wiki/[^"#]+"[^>]*>(.*?)</a>',
                                          td_html, re.S)
                    names = []
                    for a in anchors:
                        n = re.sub(r"<[^>]+>", "", a).strip()
                        n = re.sub(r"\s+", " ", n)
                        if n and n not in names and not n.startswith("[") and len(n) > 1:
                            names.append(n)
                    out[key] = names
                break
    return out


def fetch_one(name):
    title = search_title(name)
    if not title:
        return None
    canonical, html = fetch_html(title)
    if not html:
        return None
    info = parse_infobox(html)
    info["title"] = canonical or title
    return info


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

    lock = threading.Lock()
    results = dict(existing)
    counts = {"ok": 0, "fail": 0, "done": 0}

    def worker(tup):
        raw, display = tup
        # Skip names that are clearly compilations / folder-ish
        skip_keywords = ["FLAC", "[Hi-Res]", "compilation", "アニソン",
                         "アニメ", "Original Soundtrack", "Best Album",
                         "Vocal Collection", "Soundtrack Collection",
                         "ベスト", "ピアノコレクション", "ヴォーカル"]
        if any(k.lower() in display.lower() for k in skip_keywords):
            time.sleep(0.05)
            return None
        try:
            res = fetch_one(display)
        except Exception:
            res = None
        time.sleep(random.uniform(0.4, 0.8))
        with lock:
            counts["done"] += 1
            if res:
                counts["ok"] += 1
                results[raw] = res
            else:
                counts["fail"] += 1
                results.setdefault(raw, {})
            if counts["done"] % 25 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
                aas = (res or {}).get("associated_acts", [])
                print(f"  [{counts['done']}/{len(todo)}] ok={counts['ok']} fail={counts['fail']}  last: {display} -> {len(aas)} associated_acts")
        return res

    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(worker, t) for t in todo]
        for _ in as_completed(futs):
            pass

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    aa_total = sum(len((v or {}).get("associated_acts", [])) for v in results.values())
    members_total = sum(len((v or {}).get("members", [])) for v in results.values())
    print(f"done: ok={counts['ok']} fail={counts['fail']}")
    print(f"  associated_acts links total: {aa_total}")
    print(f"  members links total: {members_total}")


if __name__ == "__main__":
    main()
