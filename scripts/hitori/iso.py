# -*- coding: utf-8 -*-
"""孤立度。最寄の同カテゴリ施設までの距離（メートル）。

穴場スコア（周囲のチェーン比率）は湯1.4%・滞在0.2%というチェーン率の低さゆえに
この2カテゴリでは構造的に0件になる。孤立度はそこに発見を出すための指標で、
「最寄りの銭湯まで4.2km — この一帯で唯一」と説明できることを狙っている。
"""
import math
from collections import defaultdict

CELL_DEG = 0.01
MAX_ISO_M = 50000

# セル1辺の最小メートル数。経度方向は高緯度ほど縮み、日本最北（北緯約45.6度）で
# 0.01度 ≒ 780m。リング打ち切りの判定に使うので、安全側に小さく取る。
MIN_CELL_M = 770


def _distance_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cell(rec):
    return (int(math.floor(rec["lat"] / CELL_DEG)), int(math.floor(rec["lon"] / CELL_DEG)))


def _ring_offsets(r):
    """中心から距離 r の正方リング上のセル差分。r=0 は中心のみ。"""
    if r == 0:
        yield (0, 0)
        return
    for d in range(-r, r + 1):
        yield (-r, d)
        yield (r, d)
    for d in range(-r + 1, r):
        yield (d, -r)
        yield (d, r)


def _nearest_same_cat(rec, grid):
    cy, cx = _cell(rec)
    best = None
    max_ring = int(math.ceil(MAX_ISO_M / MIN_CELL_M)) + 1
    ring = 0
    while ring <= max_ring:
        for dy, dx in _ring_offsets(ring):
            for o in grid.get((cy + dy, cx + dx), ()):
                if o is rec or o["cat"] != rec["cat"]:
                    continue
                d = _distance_m(rec["lat"], rec["lon"], o["lat"], o["lon"])
                if best is None or d < best:
                    best = d
        # リング r で見つけても、そこで打ち切ってはいけない。正方グリッドなので
        # リング r の隅より、リング r+1 の辺の中央のほうが近いことがある。
        # リング r より外側の点は必ず r*MIN_CELL_M 以上離れているので、
        # best がそれ以下になった時点で初めて確定できる。
        if best is not None and best <= ring * MIN_CELL_M:
            break
        ring += 1
    if best is None:
        return MAX_ISO_M
    return min(MAX_ISO_M, int(round(best)))


def compute_iso(records):
    """各レコードに iso（整数メートル）を破壊的に付与する。"""
    grid = defaultdict(list)
    for r in records:
        grid[_cell(r)].append(r)
    for r in records:
        r["iso"] = _nearest_same_cat(r, grid)


def iso_thresholds(records, q=0.9):
    """カテゴリ別の iso 分位値。孤立バッジの境界に使う。

    固定値を置かない。穴場で全カテゴリ共通の 0.6 を勘で置き、チェーン率の低い
    湯・滞在が構造的に0件になった失敗を繰り返さないため、実測分布から決める。
    """
    by_cat = defaultdict(list)
    for r in records:
        if "iso" in r:
            by_cat[r["cat"]].append(r["iso"])
    out = {}
    for cat, vals in by_cat.items():
        vals.sort()
        idx = min(len(vals) - 1, max(0, int(round(q * (len(vals) - 1)))))
        out[cat] = int(vals[idx])
    return out
