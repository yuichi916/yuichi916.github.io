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

# Two nested rings — inner ring fills the central void so the universe
# is dense at the core like a real galactic disk, with the outermost edge
# reserved for the largest / most specialised genres.
#
# Outer ring (R=2400, 7 positions): the big specialty genres that need
# room to breathe. These are the ones with thousands of artists.
GENRE_OUTER = [
    "ambient",       # 北 (top)
    "healing",
    "celt",
    "jazz",
    "indies",
    "metal",
    "progressive",
]
# Inner ring (R=1100, 7 positions, half-slot offset so it interleaves with
# the outer ring): mid-popular genres that benefit from being closer to
# the centre of attention.
GENRE_INNER = [
    "classic",
    "blues-folk",
    "pop-rock",
    "jpop",
    "anime",
    "game",
    "nature",
]
GENRE_NAME_JP = {
    "ambient": "アンビエント銀河", "classic": "クラシカ系", "healing": "ヒーリング星雲",
    "celt": "ケルト群", "blues-folk": "ブルース・フォーク", "jazz": "ジャズ群",
    "pop-rock": "ポップ・ロック", "jpop": "JPOP連星", "anime": "アニソン群",
    "game": "ゲーム音楽星団", "indies": "インディーズ", "metal": "メタル星雲",
    "progressive": "プログ銀河", "nature": "ネイチャー域",
}
GENRE_RING = GENRE_OUTER + GENRE_INNER  # union for iteration

# Outer / inner ring radii
RING_R = 2400      # outer
RING_R_INNER = 1100  # inner — fills the centre
# Per-galaxy target spread: nodes get repositioned in a disk of this radius
# (scaled by sqrt(member_count)) around their genre centroid — so dense
# galaxies grow proportionally instead of stacking on top of each other.
GALAXY_BASE_R = 80
GALAXY_PER_NODE = 5.5
GALAXY_MAX_R = 420
# Light jitter for stability when many nodes share an FA2 position
JITTER = 18.0


def main():
    data = json.loads(UNIV.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    centroids = {}
    n_outer = len(GENRE_OUTER)
    n_inner = len(GENRE_INNER)
    for i, g in enumerate(GENRE_OUTER):
        ang = 2 * math.pi * i / n_outer - math.pi / 2  # start at top
        centroids[g] = (RING_R * math.cos(ang), RING_R * math.sin(ang), ang)
    for i, g in enumerate(GENRE_INNER):
        # Half-slot offset so inner positions sit between outer positions
        ang = 2 * math.pi * i / n_inner - math.pi / 2 + math.pi / n_inner
        centroids[g] = (RING_R_INNER * math.cos(ang), RING_R_INNER * math.sin(ang), ang)

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
        # Compute the FA2 spread of this genre (max distance from old centroid)
        max_d = max(
            (((n.get("x", 0) - cx_old) ** 2 + (n.get("y", 0) - cy_old) ** 2) ** 0.5)
            for n in members
        ) or 1.0
        # Target radius for this galaxy: scales with sqrt of member count
        target_r = min(
            GALAXY_MAX_R,
            GALAXY_BASE_R + GALAXY_PER_NODE * (len(members) ** 0.5),
        )
        # Scale factor maps the genre's FA2 layout (radius max_d) into the
        # target radius — preserves the within-genre topology while fitting
        # a known disk.
        scale = target_r / max_d
        for n in members:
            rx = (n.get("x", 0) - cx_old) * scale
            ry = (n.get("y", 0) - cy_old) * scale
            n["x"] = cx_new + rx + rnd.uniform(-JITTER, JITTER) * 0.5
            n["y"] = cy_new + ry + rnd.uniform(-JITTER, JITTER) * 0.5

    # ── Final noverlap pass: push remaining overlaps apart in-place ──
    # Per-galaxy spatial-hash collision resolution (cheap, deterministic).
    print("running per-galaxy noverlap pass...")
    NUM_ITER = 60
    MARGIN = 1.4  # absolute-pixel margin between node circles
    for g, members in per_g.items():
        if len(members) < 2:
            continue
        positions = [(n["x"], n["y"]) for n in members]
        sizes = [n.get("r", 2.5) for n in members]
        cell = max(sizes) * 4 + MARGIN + 4
        for _it in range(NUM_ITER):
            grid = {}
            for i, (x, y) in enumerate(positions):
                key = (int(x // cell), int(y // cell))
                grid.setdefault(key, []).append(i)
            moved = 0
            for i, (x, y) in enumerate(positions):
                cx_grid, cy_grid = int(x // cell), int(y // cell)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        for j in grid.get((cx_grid + dx, cy_grid + dy), []):
                            if j <= i:
                                continue
                            x2, y2 = positions[j]
                            ddx = x - x2
                            ddy = y - y2
                            d = (ddx * ddx + ddy * ddy) ** 0.5
                            min_d = sizes[i] + sizes[j] + MARGIN
                            if 0.001 < d < min_d:
                                push = (min_d - d) / 2.0
                                ux = ddx / d
                                uy = ddy / d
                                positions[i] = (x + ux * push, y + uy * push)
                                positions[j] = (x2 - ux * push, y2 - uy * push)
                                x, y = positions[i]
                                moved += 1
            if moved == 0:
                break
        for i, n in enumerate(members):
            n["x"], n["y"] = positions[i]

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
