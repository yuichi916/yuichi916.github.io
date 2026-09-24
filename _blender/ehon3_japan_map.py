# -*- coding: utf-8 -*-
"""ひとり歓迎マップの日本地図 (47 都道府県の輪郭) と県ごとの件数を、絵本の飛び出し用の軽いデータにする。
元: data/hitori/prefectures_svg.json (地球地図日本・国土地理院、M/L/Z のみのパス) と data/hitori/index.json
出力: _ehon_assets/ehon/popup/japan_v1.json
  size: [W, H] (地図の座標)、total / checked: 全体の件数、
  prefs: [{name, count, checked, c: [x, y] (県の中心), rings: [[x0, y0, x1, y1, ...], ...]}]
usage: python _blender/ehon3_japan_map.py
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = json.load(open(os.path.join(ROOT, 'data', 'hitori', 'prefectures_svg.json'), encoding='utf-8'))
IDX = json.load(open(os.path.join(ROOT, 'data', 'hitori', 'index.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, '_ehon_assets', 'ehon', 'popup', 'japan_v1.json')
TOL = 1.6          # 地図の座標 (幅 1000) での間引きの許容
MIN_AREA = 12.0    # これより小さい島は落とす (立体にすると粒になるだけ)


def rings_of(d):
    rings, cur = [], []
    for cmd, xs, ys in re.findall(r'([MLZ])\s*(?:(-?[\d.]+)[ ,](-?[\d.]+))?', d):
        if cmd == 'M':
            if cur:
                rings.append(cur)
            cur = [(float(xs), float(ys))]
        elif cmd == 'L':
            cur.append((float(xs), float(ys)))
        else:
            if cur:
                rings.append(cur)
            cur = []
    if cur:
        rings.append(cur)
    return rings


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dmax, k = 0.0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
        d = math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
        if d > dmax:
            dmax, k = d, i
    if dmax <= tol:
        return [a, b]
    return simplify(pts[:k + 1], tol)[:-1] + simplify(pts[k:], tol)


def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


B = SVG['bounds']
def project(lat, lon):
    return ((lon * math.cos(math.radians(B['lat0'])) - B['minx']) * B['scale'], (-lat - B['miny']) * B['scale'])


prefs, npts = [], 0
by_code = {p['code']: p for p in IDX['prefectures']}
for code in range(1, 48):
    rings = []
    for r in rings_of(SVG['paths'][str(code)]):
        if r[0] == r[-1]:
            r = r[:-1]
        if len(r) < 3 or area(r) < MIN_AREA:
            continue
        s = simplify(r + [r[0]], TOL)[:-1]
        if len(s) >= 3:
            rings.append([round(v, 1) for pt in s for v in pt])
            npts += len(s)
    p = by_code[code]
    cx, cy = project(*p['center'])
    prefs.append({'name': p['name'], 'count': p['count'], 'checked': p['checked'], 'c': [round(cx, 1), round(cy, 1)], 'rings': rings})
vb = [float(v) for v in SVG['viewBox'].split()]
data = {'size': [vb[2], vb[3]], 'total': IDX['total'], 'checked': IDX['checked_count'], 'prefs': prefs}
assert sum(p['count'] for p in prefs) == IDX['total'], (sum(p['count'] for p in prefs), IDX['total'])
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('prefs', len(prefs), 'points', npts, 'total', data['total'], 'checked', data['checked'], os.path.getsize(OUT) // 1024, 'KB')
tokyo = next(p for p in prefs if p['name'] == '東京都')
print('東京都', tokyo['count'], tokyo['c'], 'rings', len(tokyo['rings']))
