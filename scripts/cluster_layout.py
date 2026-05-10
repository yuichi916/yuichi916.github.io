#!/usr/bin/env python3
"""Post-process universe.json: pull each node toward its genre centroid so the
14 genres become 14 distinct galaxies arranged on a ring.

Reads:
  scripts/universe.json (with FA2 x/y already set)
Writes:
  scripts/universe.json (with clustered x/y)
  scripts/universe.json.galaxies = [{slug, name_jp, x, y, count, radius}]
    — the metadata used to render galaxy labels in universe.html
"""
import json, math, sys, io, os, random
from pathlib import Path
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = Path(__file__).parent
UNIV = HERE / "universe.json"

# Order of genres around the ring — clockwise starting from "north"
# (top of canvas). Grouped by sonic affinity so neighbours blend nicely.
GENRE_RING = [
    "ambient",       # 北
    "classic",
    "healing",
    "celt",
    "blues-folk",
    "jazz",
    "pop-rock",
    "jpop",          # 南
    "anime",
    "game",
    "indies",
    "metal",
    "progressive",
    "nature",
]
GENRE_NAME_JP = {
    "ambient": "アンビエント銀河", "classic": "クラシカ銀河", "healing": "ヒーリング星雲",
    "celt": "ケルト系", "blues-folk": "ブルース・フォーク", "jazz": "ジャズ群",
    "pop-rock": "ポップ・ロック", "jpop": "JPOP連星", "anime": "アニソン群",
    "game": "ゲーム音楽星団", "indies": "インディーズ", "metal": "メタル星雲",
    "progressive": "プログ銀河", "nature": "ネイチャー域",
}

# Ring radius — how far apart the galaxy centres sit.
RING_R = 1700
# How strongly to pull each node toward its genre centroid.
# 0.0 = no pull (pure FA2),  1.0 = collapse to centroid.
PULL = 0.55
# Soft jitter so nodes don't perfectly stack at the centroid
JITTER = 24.0


def main():
    data = json.loads(UNIV.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    centroids = {}
    for i, g in enumerate(GENRE_RING):
        ang = 2 * math.pi * i / len(GENRE_RING) - math.pi / 2  # start at top
        centroids[g] = (RING_R * math.cos(ang), RING_R * math.sin(ang), ang)

    # Compute current pre-cluster centroid of each genre so we can normalize.
    # We'll subtract the current per-genre centroid before applying pull, so
    # the cluster shape (FA2 layout within genre) is preserved.
    per_g = {g: [] for g in GENRE_RING}
    for n in nodes:
        g = n.get("genre")
        if g in per_g:
            per_g[g].append(n)

    rnd = random.Random(42)
    for g, members in per_g.items():
        if not members:
            continue
        cx_old = sum(n.get("x", 0) for n in members) / len(members)
        cy_old = sum(n.get("y", 0) for n in members) / len(members)
        cx_new, cy_new, _ang = centroids[g]
        for n in members:
            x = n.get("x", 0) - cx_old
            y = n.get("y", 0) - cy_old
            # Apply pull: blend toward new centroid
            n["x"] = cx_new * PULL + (cx_new + x) * (1 - PULL)
            n["y"] = cy_new * PULL + (cy_new + y) * (1 - PULL)
            # Tiny jitter only for nodes very close to the centroid
            n["x"] += rnd.uniform(-JITTER, JITTER) * 0.3
            n["y"] += rnd.uniform(-JITTER, JITTER) * 0.3

    # Compute galaxy metadata for label rendering
    galaxies = []
    for g in GENRE_RING:
        members = per_g[g]
        if not members:
            continue
        cx, cy, ang = centroids[g]
        # Estimate radius: 95th-percentile distance from new centroid
        dists = sorted(
            ((n["x"] - cx) ** 2 + (n["y"] - cy) ** 2) ** 0.5
            for n in members
        )
        r95 = dists[int(len(dists) * 0.95)] if dists else 0
        galaxies.append({
            "slug": g,
            "name_jp": GENRE_NAME_JP.get(g, g),
            "x": cx, "y": cy,
            "count": len(members),
            "radius": r95,
            "angle": ang,
        })

    data["galaxies"] = galaxies

    UNIV.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )
    print(f"clustered {len(nodes)} nodes into {len(galaxies)} galaxies")
    for gx in galaxies:
        print(f"  {gx['slug']:14s}  ({gx['x']:7.0f}, {gx['y']:7.0f})  "
              f"n={gx['count']:5d}  r95={gx['radius']:.0f}")


if __name__ == "__main__":
    main()
