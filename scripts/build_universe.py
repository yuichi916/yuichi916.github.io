#!/usr/bin/env python3
"""Build the music-artist universe graph from:
  - Salon collection (1269 artists × genre × album metadata)
  - Last.fm similar map (lastfm_similar.json)
  - Curated similar map (salon_similar.py)

Output: scripts/universe.json — { nodes: [...], edges: [...], stats: {...} }

Each node:
  { id, name, in_collection (bool), genre (slug or 'unknown'),
    album, year, country (TBD), degree (incoming edges) }

Each edge:
  { source: artist_id, target: artist_id, weight }
"""
import json, sys, io, os, importlib.util, unicodedata, re
from pathlib import Path
from collections import Counter, defaultdict

os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
LASTFM = HERE / "lastfm_similar.json"
WIKIPEDIA = HERE / "wikipedia_relations.json"
MUSICBRAINZ = HERE / "musicbrainz_relations.json"
CURATED = HERE / "salon_similar.py"
YT_IDS = HERE / "youtube_ids.json"
ASINS = HERE / "amazon_asins.json"
OUT = HERE / "universe.json"

# Per-source weights — different signals carry different confidence:
#   curated   = hand-picked by maintainer
#   musicbrainz = verified band-membership / explicit collaboration
#   wikipedia = associated-acts as listed by editors
#   lastfm    = collaborative-filter from listening data
SRC_WEIGHTS = {
    "curated": 2.0,
    "musicbrainz": 1.8,
    "wikipedia": 1.4,
    "lastfm": 1.0,
}


def norm(s):
    return unicodedata.normalize("NFC", s or "").strip().lower()


_NOISE_PATTERNS = [
    # Format/encoding markers usually appended to folder names
    r"\s*\[?(FLAC|MP3|APE|WAV|TTA|TAK|DSF|DFF|AIFF|FLAC\+CUE\+LOG\+BK|FLAC\+CUE)\]?\s*$",
    r"\s*\(?(96kHz/24bit|48kHz/24bit|24bit|96kHz|48kHz|44\.1kHz|hi-?res|Hi-Res)\)?\s*$",
    r"\s*\[?(96kHz[／/]24bit|48kHz[／/]24bit|44\.1kHz[／/]16bit)\]?\s*$",
    # Trailing FLAC/CUE/LOG/BK token at end (handles _FLAC, .FLAC etc.)
    r"[\s_\-\.]+(FLAC|MP3|APE|CUE|LOG|BK|ape)$",
    # Folder-style 4-digit year prefix like "[1999] " or "1999 - "
    r"^\s*[\[\(]?\d{4}[\]\)]?\s*[\-\.\s]\s*",
    # Trailing year " (1999)" or " 1999" at end of string when name has more text
    r"\s+\(\d{4}\)\s*$",
    # "1st Album「..」" "2nd Album「..」" Japanese suffixes (just keep up to album marker)
    r"\s*\d+(st|nd|rd|th)\s*Album.*$",
    # "Original Soundtrack" trailing repeat
    r"\s*Original\s+Soundtrack\s*$",
    # "[USA]" "[JP]" region tags
    r"\s*\[(USA|JP|UK|EU|JAP)\]\s*$",
]


def clean_artist_name(name):
    """Strip common folder/format noise from artist names so the visualization
    shows clean canonical names."""
    if not name:
        return name
    s = str(name)
    # Apply patterns repeatedly until stable
    for _ in range(4):
        prev = s
        for p in _NOISE_PATTERNS:
            s = re.sub(p, "", s, flags=re.I).strip()
        if s == prev:
            break
    # Replace underscores with spaces (common folder convention) when string has many
    if s.count("_") >= 2 and " " not in s:
        s = s.replace("_", " ")
    # Collapse repeated whitespace
    s = re.sub(r"\s+", " ", s).strip(" -_.,")
    return s or name  # fall back to original if cleaning emptied it


def main():
    # 1. Load collection
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()

    # 2. Build collection node table
    nodes = {}  # id (canonical lowercase) -> node dict
    name_to_id = {}  # alias -> canonical id

    def canonical_id(name):
        return norm(name)

    def add_node(name, **kwargs):
        nid = canonical_id(name)
        if nid not in nodes:
            nodes[nid] = {
                "id": nid,
                "name": name,
                "in_collection": False,
                "genre": "unknown",
                "subgroup": None,
                "album": None,
                "year": None,
                "degree": 0,
            }
            name_to_id[nid] = nid
        n = nodes[nid]
        for k, v in kwargs.items():
            if v is not None:
                n[k] = v
        return nid

    for slug, g in data.items():
        displays = g.get("artist_displays") or {}
        albums = g.get("artist_albums") or {}
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                disp = displays.get(a, a)
                cleaned = clean_artist_name(disp)
                alb = albums.get(a) or {}
                # Also clean album title (drop format markers) but keep year for tooltip
                clean_album = clean_artist_name(alb.get("title")) if alb.get("title") else None
                add_node(cleaned,
                         in_collection=True,
                         genre=slug,
                         subgroup=sg["name_jp"],
                         album=clean_album,
                         year=alb.get("year"),
                         raw_name=a)  # keep raw for YT id lookup
                # Also alias raw + display so similar lookups resolve
                cid = canonical_id(cleaned)
                for alias in [a, disp]:
                    aid = canonical_id(alias)
                    if aid != cid and aid not in name_to_id:
                        name_to_id[aid] = cid

    print(f"collection nodes: {len(nodes)}")

    # 3-5. Merge edges from every source with provenance tags.
    # edges_src[(a, b)] = {source: weight}
    edges_src = defaultdict(lambda: defaultdict(float))

    def add_edge(src_id, tgt_id, source, w=1.0):
        if src_id == tgt_id:
            return
        a, b = sorted([src_id, tgt_id])
        edges_src[(a, b)][source] += w * SRC_WEIGHTS.get(source, 1.0)

    # Last.fm
    if LASTFM.exists():
        lastfm = json.loads(LASTFM.read_text(encoding="utf-8"))
        ext_added = 0
        for raw_artist, sims in lastfm.items():
            src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
            if src_id not in nodes:
                continue
            for s in sims:
                tgt_id = canonical_id(s)
                if tgt_id not in nodes:
                    add_node(s, in_collection=False)
                    ext_added += 1
                add_edge(src_id, tgt_id, "lastfm")
        print(f"  Last.fm: edges from {len(lastfm)} sources, +{ext_added} external")

    # Wikipedia (associated_acts + members + past_members + influences)
    if WIKIPEDIA.exists():
        wiki = json.loads(WIKIPEDIA.read_text(encoding="utf-8"))
        ext_added_w = 0
        wiki_pairs = 0
        for raw_artist, info in wiki.items():
            if not isinstance(info, dict):
                continue
            src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
            if src_id not in nodes:
                continue
            for key in ("associated_acts", "members", "past_members",
                         "influences", "influenced_by"):
                for s in info.get(key, []) or []:
                    tgt_id = canonical_id(s)
                    if tgt_id not in nodes:
                        add_node(s, in_collection=False)
                        ext_added_w += 1
                    add_edge(src_id, tgt_id, "wikipedia")
                    wiki_pairs += 1
            # Save metadata onto the source node for the UI
            n = nodes[src_id]
            if info.get("origin"):
                n["origin"] = info["origin"]
            if info.get("years_active"):
                n["years_active"] = info["years_active"]
            if info.get("genres"):
                n.setdefault("wiki_genres", info["genres"])
        print(f"  Wikipedia: {wiki_pairs} pairs, +{ext_added_w} external")

    # MusicBrainz (members + member_of + collaborators)
    if MUSICBRAINZ.exists():
        mb = json.loads(MUSICBRAINZ.read_text(encoding="utf-8"))
        ext_added_m = 0
        mb_pairs = 0
        for raw_artist, info in mb.items():
            if not isinstance(info, dict):
                continue
            src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
            if src_id not in nodes:
                continue
            for key in ("members", "member_of", "collaborators"):
                for s in info.get(key, []) or []:
                    tgt_id = canonical_id(s)
                    if tgt_id not in nodes:
                        add_node(s, in_collection=False)
                        ext_added_m += 1
                    add_edge(src_id, tgt_id, "musicbrainz")
                    mb_pairs += 1
            # Metadata
            n = nodes[src_id]
            if info.get("country"):
                n["country"] = info["country"]
            if info.get("type"):
                n["mb_type"] = info["type"]
            if info.get("tags"):
                n["mb_tags"] = [t["name"] for t in info["tags"][:8]]
            if info.get("mbid"):
                n["mbid"] = info["mbid"]
        print(f"  MusicBrainz: {mb_pairs} pairs, +{ext_added_m} external")

    # Curated SIMILAR (highest weight)
    if CURATED.exists():
        try:
            spec2 = importlib.util.spec_from_file_location("salon_similar", CURATED)
            mod2 = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(mod2)
            SIM = getattr(mod2, "SIMILAR", {})
            cur_pairs = 0
            for slug, m in SIM.items():
                for raw_artist, sims in m.items():
                    src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
                    if src_id not in nodes:
                        continue
                    for s in sims:
                        tgt_id = canonical_id(s)
                        if tgt_id not in nodes:
                            add_node(s, in_collection=False)
                        add_edge(src_id, tgt_id, "curated")
                        cur_pairs += 1
            print(f"  Curated: {cur_pairs} pairs")
        except Exception as e:
            print(f"  warn: curated load: {e}")

    # 5. Aggregate weights & sources per edge
    sym = {}
    for pair, src_dict in edges_src.items():
        total = sum(src_dict.values())
        # Bonus: edges supported by multiple sources get a coherence boost
        bonus = max(0, len(src_dict) - 1) * 0.5
        sym[pair] = {
            "weight": total + bonus,
            "sources": sorted(src_dict.keys()),
        }

    # 6. Compute degrees
    for (a, b), info in sym.items():
        w = info["weight"]
        nodes[a]["degree"] += w
        nodes[b]["degree"] += w

    # 7. Genre inference: multi-pass BFS from collection nodes.
    neighbors = defaultdict(list)
    for (a, b), info in sym.items():
        neighbors[a].append((b, info["weight"]))
        neighbors[b].append((a, info["weight"]))

    for nid, node in nodes.items():
        if node["in_collection"]:
            continue
        votes = Counter()
        for nb, w in neighbors[nid]:
            nbn = nodes.get(nb)
            if nbn and nbn["in_collection"]:
                votes[nbn["genre"]] += w
        if votes:
            node["genre"] = votes.most_common(1)[0][0]

    for _ in range(3):
        changes = 0
        for nid, node in nodes.items():
            if node["in_collection"] or node["genre"] != "unknown":
                continue
            votes = Counter()
            for nb, w in neighbors[nid]:
                nbn = nodes.get(nb)
                if nbn and nbn["genre"] != "unknown":
                    votes[nbn["genre"]] += w
            if votes:
                node["genre"] = votes.most_common(1)[0][0]
                changes += 1
        if changes == 0:
            break

    # 7b. Attach YouTube videoId + Amazon ASIN per node (for inline player)
    yt_ids = {}
    if YT_IDS.exists():
        ydata = json.loads(YT_IDS.read_text(encoding="utf-8"))
        for k, v in ydata.items():
            if v:
                yt_ids[canonical_id(k)] = v
    asin_map = {}
    if ASINS.exists():
        adata = json.loads(ASINS.read_text(encoding="utf-8"))
        for k, v in adata.items():
            if isinstance(v, dict) and v.get("asin"):
                asin_map[canonical_id(k)] = v["asin"]

    for nid, node in nodes.items():
        # Try to find YT id by canonical id, then by alias chain (raw_name)
        raw = node.get("raw_name")
        cands = [nid]
        if raw:
            cands.append(canonical_id(raw))
        for c in cands:
            if c in yt_ids:
                node["yt"] = yt_ids[c]
                break
        for c in cands:
            if c in asin_map:
                node["asin"] = asin_map[c]
                break

    # 8. Preserve existing layout coords (x, y, r) if available — so re-running
    # this script doesn't blow away the ForceAtlas2 positions.
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text(encoding="utf-8"))
            for pn in prev.get("nodes", []):
                pid = pn.get("id")
                if pid and pid in nodes and "x" in pn:
                    nodes[pid]["x"] = pn["x"]
                    nodes[pid]["y"] = pn["y"]
                    nodes[pid]["r"] = pn.get("r", 2.5)
        except Exception:
            pass

    edges = [{
        "source": a, "target": b,
        "weight": info["weight"],
        "src": info["sources"],
    } for (a, b), info in sym.items()]
    # Drop helper keys before serializing
    nodes_list = []
    for n in nodes.values():
        n.pop("raw_name", None)
        nodes_list.append(n)

    src_count = Counter()
    multi_src = 0
    for e in edges:
        srcs = e.get("src") or []
        for s in srcs:
            src_count[s] += 1
        if len(srcs) >= 2:
            multi_src += 1

    OUT.write_text(json.dumps({
        "nodes": nodes_list,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes_list),
            "in_collection": sum(1 for n in nodes_list if n["in_collection"]),
            "external": sum(1 for n in nodes_list if not n["in_collection"]),
            "total_edges": len(edges),
            "edges_by_source": dict(src_count),
            "multi_source_edges": multi_src,
        },
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    s = json.loads(OUT.read_text(encoding="utf-8"))["stats"]
    print(f"\nuniverse: {s['total_nodes']} nodes "
          f"({s['in_collection']} in-collection + {s['external']} external), "
          f"{s['total_edges']} edges")
    print(f"  saved: {OUT}")

    # genre breakdown
    by_g = Counter(n["genre"] for n in nodes_list)
    print("  genre breakdown (top):")
    for g, c in by_g.most_common(20):
        print(f"    {g}: {c}")


if __name__ == "__main__":
    main()
