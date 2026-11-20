"""国土数値情報 行政区域（N03, 2025年1月1日時点）の都道府県ポリゴンから、
画面用の軽い SVG パス（47都道府県）を作る。

使い方（ダウンロード物を読むので -I を付ける）:
  python -I scripts/kyou_no_ken/build_map.py <N03-20250101_prefecture.shp> <data.json> <出力 map.json>

やること:
  1. 面積の小さい島（MIN_KM2 未満）と、小笠原・大東など遠い島を外す
  2. ランベルト正角円錐図法（標準緯線 33度・44度）で平面に移す
  3. 沖縄県（と奄美群島）は左上の囲みに移す
  4. shapely.coverage_simplify で県境を共有したまま簡略化する（隣の県とすき間が出ない）
  5. 県庁の位置（data.json の経緯度）も同じ投影で出す
"""
import json
import math
import sys

import numpy as np
import shapefile
import shapely
from shapely.geometry import MultiPolygon, Polygon, shape

MIN_KM2 = 30.0
TOL = 1.2          # 簡略化の許容（出力座標の単位。地図の幅はおよそ 1000）
W_OUT = 1000.0
INSET_K = 1.3     # 沖縄の囲みは本土より 1.3 倍に拡大（スマホで押しやすく）

# ランベルト正角円錐図法
PHI1, PHI2, PHI0, LAM0 = 33.0, 44.0, 36.0, 137.0


def lcc_params():
    r = math.radians
    n = math.log(math.cos(r(PHI1)) / math.cos(r(PHI2))) / math.log(
        math.tan(math.pi / 4 + r(PHI2) / 2) / math.tan(math.pi / 4 + r(PHI1) / 2))
    F = math.cos(r(PHI1)) * math.tan(math.pi / 4 + r(PHI1) / 2) ** n / n
    rho0 = F / math.tan(math.pi / 4 + r(PHI0) / 2) ** n
    return n, F, rho0


N, F, RHO0 = lcc_params()
R_EARTH_KM = 6371.0


def lcc(lon, lat):
    """度 → km（地球半径 6371km の球）"""
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    rho = F / np.tan(np.pi / 4 + np.radians(lat) / 2) ** N
    th = N * np.radians(lon - LAM0)
    x = rho * np.sin(th) * R_EARTH_KM
    y = (RHO0 - rho * np.cos(th)) * R_EARTH_KM
    return x, y


def poly_km2(p):
    """経緯度ポリゴンのおおよその面積（km²）"""
    lat = p.centroid.y
    return abs(p.area) * (111.32 ** 2) * math.cos(math.radians(lat))


def in_inset(lon, lat):
    return lat < 28.7 and lon < 130.6


def keep(name, lon, lat):
    if lon > 145.9 and name != '北海道':
        return False
    if name == '東京都' and lat < 32.0:          # 小笠原・沖ノ鳥島・南鳥島
        return False
    if name == '沖縄県' and lon > 130.6:          # 大東諸島
        return False
    if name == '鹿児島県' and 28.7 <= lat < 29.9:  # トカラ列島（小さい）
        return False
    return True


def main(shp_path, data_path, out_path):
    data = json.load(open(data_path, encoding='utf-8'))
    names = [p['name'] for p in data['prefs']]
    idx = {n: i for i, n in enumerate(names)}

    parts = [[] for _ in names]
    inset_flags = [[] for _ in names]
    r = shapefile.Reader(shp_path, encoding='utf-8')
    for sr in r.iterShapeRecords():
        name = sr.record[0]
        g = shape(sr.shape.__geo_interface__)
        polys = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
        for p in polys:
            if p.is_empty or poly_km2(p) < MIN_KM2:
                continue
            c = p.centroid
            if not keep(name, c.x, c.y):
                continue
            parts[idx[name]].append(p)
            inset_flags[idx[name]].append(in_inset(c.x, c.y))

    # 平面へ（本土枠とは別に、囲み用の平行移動を後で足す）
    def proj(geom):
        return shapely.transform(geom, lambda xy: np.column_stack(lcc(xy[:, 0], xy[:, 1])))

    main_geoms, inset_geoms = [], []
    for i in range(len(names)):
        mp = [proj(p) for p, f in zip(parts[i], inset_flags[i]) if not f]
        ip = [proj(p) for p, f in zip(parts[i], inset_flags[i]) if f]
        main_geoms.append(shapely.make_valid(shapely.union_all(mp)) if mp else None)
        inset_geoms.append(shapely.make_valid(shapely.union_all(ip)) if ip else None)
        print(names[i], len(mp), len(ip), file=sys.stderr)

    allmain = shapely.union_all([g for g in main_geoms if g is not None])
    mx0, my0, mx1, my1 = allmain.bounds
    allinset = shapely.union_all([g for g in inset_geoms if g is not None])
    ix0, iy0, ix1, iy1 = allinset.bounds

    # 出力座標: x 右向き、y 下向き、幅 W_OUT
    pad = 14.0
    s = (W_OUT - 2 * pad) / (mx1 - mx0)
    H_OUT = (my1 - my0) * s + 2 * pad

    def to_out(x, y):
        return (x - mx0) * s + pad, (my1 - y) * s + pad

    # 囲み: 左上。囲みの中の地図の左上を (pad+10, pad+10) に置く
    ipad = 10.0
    inset_left, inset_top = pad + ipad, pad + ipad

    def to_out_inset(x, y):
        return (x - ix0) * s * INSET_K + inset_left, (iy1 - y) * s * INSET_K + inset_top

    out_geoms = []
    for i in range(len(names)):
        gs = []
        if main_geoms[i] is not None:
            gs.append(shapely.transform(main_geoms[i], lambda xy: np.column_stack(to_out(xy[:, 0], xy[:, 1]))))
        if inset_geoms[i] is not None:
            gs.append(shapely.transform(inset_geoms[i], lambda xy: np.column_stack(to_out_inset(xy[:, 0], xy[:, 1]))))
        g = shapely.union_all(gs)
        out_geoms.append(g)

    simp = shapely.coverage_simplify(np.array(out_geoms, dtype=object), TOL)

    def ring_d(coords):
        pts = [f'{x:.1f},{y:.1f}' for x, y in coords[:-1]]
        out, prev = [], None
        for p in pts:
            if p != prev:
                out.append(p)
            prev = p
        if len(out) < 3:
            return ''
        return 'M' + 'L'.join(out) + 'Z'

    def geom_d(g):
        polys = list(g.geoms) if g.geom_type in ('MultiPolygon', 'GeometryCollection') else [g]
        d = []
        for p in polys:
            if p.geom_type != 'Polygon' or p.is_empty:
                continue
            d.append(ring_d(list(p.exterior.coords)))
            for h in p.interiors:
                d.append(ring_d(list(h.coords)))
        return ''.join(d)

    prefs_out = []
    for i, p in enumerate(data['prefs']):
        g = simp[i]
        x, y = lcc(p['lon'], p['lat'])
        if in_inset(p['lon'], p['lat']):
            cx, cy = to_out_inset(float(x), float(y))
        else:
            cx, cy = to_out(float(x), float(y))
        polys = list(g.geoms) if g.geom_type in ('MultiPolygon', 'GeometryCollection') else [g]
        big = max((q for q in polys if q.geom_type == 'Polygon'), key=lambda q: q.area)
        lp = big.representative_point() if not big.contains(shapely.Point(cx, cy)) else shapely.Point(cx, cy)
        prefs_out.append({
            'code': p['code'], 'name': p['name'],
            'd': geom_d(g),
            'cap': [round(cx, 1), round(cy, 1)],
            'label': [round(lp.x, 1), round(lp.y, 1)],
            'inset': bool(in_inset(p['lon'], p['lat'])),
        })

    iw = (ix1 - ix0) * s * INSET_K + 2 * ipad
    ih = (iy1 - iy0) * s * INSET_K + 2 * ipad
    out = {
        'source': {
            'name': '国土数値情報（行政区域データ）N03 2025年（令和7年）1月1日時点',
            'publisher': '国土交通省',
            'url': 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html',
            'license': 'CC BY 4.0',
            'survey_act': '測量法に基づく国土地理院長承認（複製）R 6JHf 503',
            'processing': f'面積{MIN_KM2:.0f}km²未満の島と小笠原・大東・トカラを省略、ランベルト正角円錐図法で投影、県境を共有したまま簡略化（許容{TOL}）、沖縄県と奄美群島は左上の囲みに1.3倍で移動',
        },
        'viewBox': [0, 0, W_OUT, round(H_OUT, 1)],
        'inset': {'x': round(pad, 1), 'y': round(pad, 1), 'w': round(iw, 1), 'h': round(ih, 1)},
        'proj': {
            'type': 'lcc', 'phi1': PHI1, 'phi2': PHI2, 'phi0': PHI0, 'lam0': LAM0, 'R': R_EARTH_KM,
            'main': {'x0': mx0, 'y1': my1, 's': s, 'left': pad, 'top': pad},
            'inset': {'x0': ix0, 'y1': iy1, 's': s * INSET_K, 'left': inset_left, 'top': inset_top},
        },
        'prefs': prefs_out,
    }
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(len(p['d']) for p in prefs_out)
    print('viewBox', out['viewBox'], 'inset', out['inset'], 'path chars', total, file=sys.stderr)


if __name__ == '__main__':
    main(*sys.argv[1:4])
