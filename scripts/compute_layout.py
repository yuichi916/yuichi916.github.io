#!/usr/bin/env python3
"""Compute force-directed layout for the universe graph.

Reads scripts/universe.json, computes ForceAtlas2 positions, writes back
each node with x, y coordinates. Designed to handle 50K+ nodes.
"""
import json, sys, io, os
from pathlib import Path
import numpy as np

os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = Path(__file__).parent
UNIV = HERE / "universe.json"


def main():
    data = json.loads(UNIV.read_text(encoding="utf-8"))
    nodes = data["nodes"]
    edges = data["edges"]
    print(f"layout for {len(nodes)} nodes, {len(edges)} edges")

    # Build networkx graph
    import networkx as nx
    G = nx.Graph()
    id_to_idx = {}
    for i, n in enumerate(nodes):
        id_to_idx[n["id"]] = i
        G.add_node(i, **n)
    for e in edges:
        si = id_to_idx.get(e["source"])
        ti = id_to_idx.get(e["target"])
        if si is not None and ti is not None:
            G.add_edge(si, ti, weight=e.get("weight", 1.0))

    # ForceAtlas2 layout
    print("running ForceAtlas2...")
    try:
        from fa2_modified import ForceAtlas2
        fa = ForceAtlas2(
            outboundAttractionDistribution=False,
            edgeWeightInfluence=1.0,
            jitterTolerance=1.0,
            barnesHutOptimize=True,
            barnesHutTheta=1.2,
            multiThreaded=False,
            scalingRatio=2.0,
            strongGravityMode=False,
            gravity=1.0,
            verbose=False,
        )
        positions = fa.forceatlas2_networkx_layout(G, pos=None, iterations=200)
    except Exception as e:
        print(f"  fa2 failed: {e}; falling back to spring_layout")
        positions = nx.spring_layout(G, iterations=50, seed=42)

    # Normalize to a canvas-friendly range [-1000, 1000]
    coords = np.array([positions[i] for i in range(len(nodes))])
    cx, cy = coords.mean(axis=0)
    coords = coords - [cx, cy]
    rmax = max(np.linalg.norm(coords, axis=1)) or 1.0
    coords = coords / rmax * 1000.0

    for i, n in enumerate(nodes):
        n["x"] = float(coords[i][0])
        n["y"] = float(coords[i][1])

    # Compute size from sqrt(degree+1) so high-degree hubs are larger
    for n in nodes:
        n["r"] = float(2.0 + 1.5 * (n.get("degree", 0) ** 0.5))

    # Write back
    UNIV.write_text(json.dumps({
        "nodes": nodes,
        "edges": edges,
        "stats": data.get("stats", {}),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  saved positions to {UNIV}")
    print(f"  x range: {coords[:,0].min():.0f} → {coords[:,0].max():.0f}")
    print(f"  y range: {coords[:,1].min():.0f} → {coords[:,1].max():.0f}")


if __name__ == "__main__":
    main()
