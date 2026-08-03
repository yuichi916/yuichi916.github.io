# -*- coding: utf-8 -*-
"""地球地図日本（国土地理院）由来の県境GeoJSONを、軽量なSVGパスへ変換する。

出典: 地球地図日本（国土地理院） https://www.gsi.go.jp/kankyochiri/gm_jpn.html
経由: https://github.com/dataofjapan/land (japan.geojson)
非営利利用のため出典明記のみで足りる。hitori.html にアフィリエイトを置かないこと。
"""
import json, math, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "_local" / "hitori_raw" / "japan.geojson"
OUT = ROOT / "data" / "hitori" / "prefectures_svg.json"
SRC = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"

# 日本列島の中心緯度。経度方向の圧縮率をここで固定する。
LAT0 = 36.0
WIDTH = 1000.0
TOLERANCE = 0.012      # 度。50KB前後に収まる想定値
MIN_RING_POINTS = 6    # これ未満の島は落とす
MIN_RING_SPAN = 0.06   # 度。この幅未満の小島は落とす

# 県の本体からこれ以上離れたリングは落とす（度）。
# 東京都には本体から18.45度（約2,000km）離れた南鳥島まで含まれており、
# 残すと全国のviewBoxが倍近くに広がるうえ、県詳細の散布図が使い物にならなくなる。
# 6.0 なら北海道の北方領土(5.86)・沖縄の八重山(5.32)・鹿児島の奄美(4.98)は残る。
MAX_RING_DISTANCE = 6.0

sys.setrecursionlimit(20000)   # Douglas-Peucker は再帰。海岸線は点数が多い。


def project(lat, lon):
    """正距円筒図法に cos(LAT0) の経度補正をかける。SVG座標系なので y は反転。"""
    x = lon * math.cos(math.radians(LAT0))
    y = -lat
    return (x, y)


def _perp_dist(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def simplify(points, tol):
    """Douglas-Peucker。端点は必ず残す。"""
    if len(points) <= 2:
        return list(points)
    a, b = points[0], points[-1]
    worst_i, worst_d = 0, -1.0
    for i in range(1, len(points) - 1):
        d = _perp_dist(points[i], a, b)
        if d > worst_d:
            worst_i, worst_d = i, d
    if worst_d <= tol:
        return [a, b]
    left = simplify(points[:worst_i + 1], tol)
    right = simplify(points[worst_i:], tol)
    return left[:-1] + right


def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def _ring_span(ring):
    lons = [c[0] for c in ring]
    lats = [c[1] for c in ring]
    return max(max(lons) - min(lons), max(lats) - min(lats))


def _ring_centroid(ring):
    return (sum(c[0] for c in ring) / len(ring), sum(c[1] for c in ring) / len(ring))


def _near_mainland(rings):
    """県の本体（最大リング）から MAX_RING_DISTANCE 以内のリングだけを返す。"""
    if not rings:
        return []
    main = max(rings, key=_ring_span)
    mx, my = _ring_centroid(main)
    kept = []
    for r in rings:
        cx, cy = _ring_centroid(r)
        if math.hypot(cx - mx, cy - my) <= MAX_RING_DISTANCE:
            kept.append(r)
    return kept


def _download():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE.exists():
        print(f"downloading {SRC} ...")
        urllib.request.urlretrieve(SRC, CACHE)
    return json.loads(CACHE.read_text(encoding="utf-8"))


def main():
    gj = _download()
    raw_paths = {}
    all_pts = []

    for feat in gj["features"]:
        code = int(feat["properties"]["id"])
        parts = []
        for ring in _near_mainland(_rings(feat["geometry"])):
            if len(ring) < MIN_RING_POINTS:
                continue
            lons = [c[0] for c in ring]
            lats = [c[1] for c in ring]
            if (max(lons) - min(lons)) < MIN_RING_SPAN and (max(lats) - min(lats)) < MIN_RING_SPAN:
                continue
            pts = [project(c[1], c[0]) for c in ring]
            pts = simplify(pts, TOLERANCE)
            if len(pts) < 3:
                continue
            parts.append(pts)
            all_pts.extend(pts)
        if not parts:
            raise RuntimeError(f"県 {code} のリングが全滅しました。閾値を緩めてください。")
        raw_paths[code] = parts

    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    scale = WIDTH / (maxx - minx)
    height = (maxy - miny) * scale

    def tx(p):
        return (round((p[0] - minx) * scale, 1), round((p[1] - miny) * scale, 1))

    paths = {}
    for code, parts in raw_paths.items():
        d = []
        for pts in parts:
            sx, sy = tx(pts[0])
            d.append(f"M{sx} {sy}")
            for p in pts[1:]:
                px, py = tx(p)
                d.append(f"L{px} {py}")
            d.append("Z")
        paths[str(code)] = "".join(d)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "viewBox": f"0 0 {WIDTH:.0f} {height:.0f}",
        "source": "地球地図日本（国土地理院）",
        # 散布図が同じ座標系で緯度経度を打てるよう、投影パラメータを渡す
        "bounds": {"minx": minx, "miny": miny, "scale": scale, "lat0": LAT0},
        "paths": paths,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f}KB, {len(paths)} prefectures)")


if __name__ == "__main__":
    main()
