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
import json, sys, io, os, importlib.util, unicodedata
from pathlib import Path
from collections import Counter, defaultdict

os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = Path(__file__).parent
GENERATOR = HERE / "generate_salon_map.py"
LASTFM = HERE / "lastfm_similar.json"
CURATED = HERE / "salon_similar.py"
OUT = HERE / "universe.json"


def norm(s):
    return unicodedata.normalize("NFC", s or "").strip().lower()


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
                alb = albums.get(a) or {}
                add_node(disp,
                         in_collection=True,
                         genre=slug,
                         subgroup=sg["name_jp"],
                         album=alb.get("title"),
                         year=alb.get("year"))
                # Also alias the raw name to the same canonical id when different
                rid = canonical_id(a)
                did = canonical_id(disp)
                if rid != did:
                    name_to_id[rid] = did

    print(f"collection nodes: {len(nodes)}")

    # 3. Merge Last.fm similar edges
    edges_dict = defaultdict(float)  # (src_id, tgt_id) -> weight (sum)
    if LASTFM.exists():
        lastfm = json.loads(LASTFM.read_text(encoding="utf-8"))
        ext_added = 0
        for raw_artist, sims in lastfm.items():
            src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
            if src_id not in nodes:
                # Source artist isn't even in collection by canonical id;
                # skip (or could add as external)
                continue
            for s in sims:
                tgt_id = canonical_id(s)
                if tgt_id not in nodes:
                    add_node(s, in_collection=False)
                    ext_added += 1
                if src_id != tgt_id:
                    edges_dict[(src_id, tgt_id)] += 1.0
        print(f"  added {ext_added} external (Last.fm-only) artists")

    # 4. Merge curated similar
    if CURATED.exists():
        try:
            spec2 = importlib.util.spec_from_file_location("salon_similar", CURATED)
            mod2 = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(mod2)
            SIM = getattr(mod2, "SIMILAR", {})
            for slug, m in SIM.items():
                for raw_artist, sims in m.items():
                    src_id = name_to_id.get(canonical_id(raw_artist)) or canonical_id(raw_artist)
                    if src_id not in nodes:
                        continue
                    for s in sims:
                        tgt_id = canonical_id(s)
                        if tgt_id not in nodes:
                            add_node(s, in_collection=False)
                        if src_id != tgt_id:
                            edges_dict[(src_id, tgt_id)] += 1.5  # curated weight slightly higher
        except Exception as e:
            print(f"  warn: curated load: {e}")

    # 5. Symmetrize edges (undirected graph) — sum bidirectional
    sym = defaultdict(float)
    for (s, t), w in edges_dict.items():
        a, b = sorted([s, t])
        sym[(a, b)] += w

    # 6. Compute degrees
    for (a, b), w in sym.items():
        nodes[a]["degree"] += w
        nodes[b]["degree"] += w

    # 7. Genre inference: multi-pass BFS from collection nodes.
    # Each external node inherits the genre of the closest collection ancestor;
    # ties broken by weighted vote.
    neighbors = defaultdict(list)
    for (a, b), w in sym.items():
        neighbors[a].append((b, w))
        neighbors[b].append((a, w))

    # Pass 1: external nodes with at least one in-collection neighbor
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

    # Passes 2-4: propagate from already-labeled neighbors (ignoring 'unknown')
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

    edges = [{"source": a, "target": b, "weight": w}
             for (a, b), w in sym.items()]
    nodes_list = list(nodes.values())

    OUT.write_text(json.dumps({
        "nodes": nodes_list,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes_list),
            "in_collection": sum(1 for n in nodes_list if n["in_collection"]),
            "external": sum(1 for n in nodes_list if not n["in_collection"]),
            "total_edges": len(edges),
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
