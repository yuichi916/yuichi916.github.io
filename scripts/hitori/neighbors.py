# -*- coding: utf-8 -*-
"""県境ポリゴンから隣接県テーブルを作る。

現在地の都道府県を判定したあと、どこまで広げて施設を探すかを決めるために使う。
頂点をグリッドに入れて、異なる県の頂点が閾値以内にある県同士を隣接とみなす。
"""
import json, math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_local" / "hitori_raw" / "japan.geojson"
OUT = ROOT / "data" / "hitori" / "neighbors.json"

THRESHOLD_DEG = 0.02   # 約2km。海峡は跨がず、川や県境の頂点ずれは吸収する


def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def build_neighbors(geojson, threshold_deg=THRESHOLD_DEG):
    """{県コード: [隣接県コード...]} を返す。結果は対称かつ昇順。"""
    pts_by_pref = {}
    for feat in geojson["features"]:
        code = int(feat["properties"]["id"])
        pts = []
        for ring in _rings(feat["geometry"]):
            pts.extend((c[1], c[0]) for c in ring)   # (lat, lon)
        pts_by_pref[code] = pts

    # 頂点を閾値サイズのセルへ入れる。同じセルと隣接セルだけを比べる。
    cell = threshold_deg
    grid = defaultdict(list)
    for code, pts in pts_by_pref.items():
        for lat, lon in pts:
            grid[(int(math.floor(lat / cell)), int(math.floor(lon / cell)))].append((code, lat, lon))

    adj = defaultdict(set)
    for (cy, cx), bucket in grid.items():
        near = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                near.extend(grid.get((cy + dy, cx + dx), ()))
        for code_a, lat_a, lon_a in bucket:
            for code_b, lat_b, lon_b in near:
                if code_a == code_b:
                    continue
                if abs(lat_a - lat_b) <= threshold_deg and abs(lon_a - lon_b) <= threshold_deg:
                    adj[code_a].add(code_b)
                    adj[code_b].add(code_a)

    return {code: sorted(adj.get(code, ())) for code in sorted(pts_by_pref)}


def main():
    gj = json.loads(SRC.read_text(encoding="utf-8"))
    out = build_neighbors(gj)
    # 津軽海峡は閾値を超えるため明示的に繋ぐ（北海道⇔青森、実距離約20km）。
    out[1] = sorted(set(out[1]) | {2})
    out[2] = sorted(set(out[2]) | {1})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({str(k): v for k, v in out.items()},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    isolated = [k for k, v in out.items() if not v]
    print(f"wrote {OUT} ({len(out)} prefectures, "
          f"平均 {sum(len(v) for v in out.values()) / len(out):.1f} 隣接)")
    if isolated:
        print(f"隣接0件: {isolated}（近傍探索は自県のみになる）")


if __name__ == "__main__":
    main()
