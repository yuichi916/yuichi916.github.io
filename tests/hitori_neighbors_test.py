# -*- coding: utf-8 -*-
"""隣接県テーブルの検証。現在地の近傍探索がどこまで広がるかを決める。"""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import neighbors as nb

OUT = ROOT / "data" / "hitori" / "neighbors.json"


def test_build_from_synthetic():
    # 2つの正方形が辺を接している → 隣接。離れた1つ → 非隣接。
    gj = {"features": [
        {"properties": {"id": 1}, "geometry": {"type": "Polygon", "coordinates": [[
            [139.0, 35.0], [139.1, 35.0], [139.1, 35.1], [139.0, 35.1], [139.0, 35.0]]]}},
        {"properties": {"id": 2}, "geometry": {"type": "Polygon", "coordinates": [[
            [139.1, 35.0], [139.2, 35.0], [139.2, 35.1], [139.1, 35.1], [139.1, 35.0]]]}},
        {"properties": {"id": 3}, "geometry": {"type": "Polygon", "coordinates": [[
            [141.0, 38.0], [141.1, 38.0], [141.1, 38.1], [141.0, 38.1], [141.0, 38.0]]]}},
    ]}
    out = nb.build_neighbors(gj)
    assert out[1] == [2] and out[2] == [1], out
    assert out[3] == [], out


def test_is_symmetric():
    gj = json.loads((ROOT / "_local" / "hitori_raw" / "japan.geojson").read_text(encoding="utf-8"))
    out = nb.build_neighbors(gj)
    for a, ns in out.items():
        for b in ns:
            assert a in out[b], f"{a}->{b} はあるが {b}->{a} が無い"


def test_generated_file():
    assert OUT.exists(), f"not found: {OUT} — neighbors.py を実行してください"
    data = {int(k): v for k, v in json.loads(OUT.read_text(encoding="utf-8")).items()}
    assert sorted(data) == list(range(1, 48)), "47県すべてが無い"

    # 既知の隣接関係。ここが崩れたら閾値がおかしい。
    assert set(data[13]) >= {11, 12, 14, 19}, f"東京都の隣接が不足: {data[13]}"   # 埼玉千葉神奈川山梨
    assert set(data[27]) >= {26, 28, 29, 30}, f"大阪府の隣接が不足: {data[27]}"   # 京都兵庫奈良和歌山
    assert 2 in data[1], "北海道の隣接に青森が無い"

    # 北海道は本州と陸続きでないが、津軽海峡は約20kmある。
    # 閾値0.02度(約2km)なら青森だけが拾われるはずがなく、実際は0件になりうる。
    # 0件の県が出た場合は近傍探索が自県だけになるので、把握できるよう明示する。
    isolated = [k for k, v in data.items() if not v]
    assert isolated == [] or isolated == [47], f"隣接0件の県: {isolated}"


def main():
    test_build_from_synthetic()
    test_is_symmetric()
    test_generated_file()
    print("OK: neighbors")


if __name__ == "__main__":
    main()
