# -*- coding: utf-8 -*-
"""穴場スコア。周囲のチェーン比率が高い場所に立つ非チェーン店を拾う。

駅前が牛丼屋とチェーン居酒屋で埋まっている中に1軒だけ残っている
立ち食いそば、を上位に出すための指標。

計算は県別ではなく全国の点集合に対して行う。県別にやると県境で
半径500mの円が切れてしまう。
"""
import math
from collections import defaultdict

RADIUS_M = 500.0
MIN_NEIGHBORS = 3      # これ未満なら比率に意味がないので0とする
# 全国のeatカテゴリのチェーン率は約25%（chains.pyの複数県判定込み）。
# 0.4はその約1.6倍チェーンが密集した場所を指す。0.6は実データではなく
# 想定分布に対して決めた値で、実際にかけると穴場が全体の1.2%しか
# 残らず使いものにならなかった。
HIDDEN_THRESHOLD = 0.4

# グリッドのセル幅。半径500mを見るので、緯度0.01度（約1.1km）なら
# 隣接3x3セルの走査で取りこぼしが出ない。
CELL_DEG = 0.01


def _distance_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cell(rec):
    return (int(math.floor(rec["lat"] / CELL_DEG)), int(math.floor(rec["lon"] / CELL_DEG)))


def compute_hidden(records):
    """各レコードに hidden(0.0-1.0) と hidden_n(int) を破壊的に付与する。"""
    grid = defaultdict(list)
    for r in records:
        grid[_cell(r)].append(r)

    for r in records:
        cy, cx = _cell(r)
        total = 0
        chains = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for o in grid.get((cy + dy, cx + dx), ()):
                    if o is r or o["cat"] != r["cat"]:
                        continue
                    if _distance_m(r["lat"], r["lon"], o["lat"], o["lon"]) > RADIUS_M:
                        continue
                    total += 1
                    if o["chain"] == 1:
                        chains += 1

        r["hidden_n"] = total
        if r["chain"] == 1 or total < MIN_NEIGHBORS:
            r["hidden"] = 0.0
        else:
            r["hidden"] = round(chains / total, 2)


def is_hidden_gem(rec):
    """画面で「穴場」と呼んでよいか。"""
    return (rec.get("chain") == 0
            and rec.get("hidden_n", 0) >= MIN_NEIGHBORS
            and rec.get("hidden", 0.0) >= HIDDEN_THRESHOLD)
