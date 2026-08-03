# -*- coding: utf-8 -*-
"""県境SVGの簡略化アルゴリズムと生成物の検証。"""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import build_map_svg as m

SVG = ROOT / "data" / "hitori" / "prefectures_svg.json"
MAX_BYTES = 120 * 1024   # 目標50KB、上限120KB


def test_simplify_keeps_endpoints():
    pts = [(0, 0), (1, 0.001), (2, 0), (3, 0.002), (4, 0)]
    out = m.simplify(pts, 0.01)
    assert out[0] == (0, 0) and out[-1] == (4, 0)
    assert len(out) == 2, out          # ほぼ直線なので両端だけ残る


def test_simplify_keeps_corner():
    pts = [(0, 0), (1, 0), (2, 0), (2, 2), (2, 4)]
    out = m.simplify(pts, 0.1)
    assert (2, 0) in out, out          # 角は残る
    assert len(out) == 3, out


def test_simplify_short_input():
    assert m.simplify([(0, 0), (1, 1)], 0.5) == [(0, 0), (1, 1)]
    assert m.simplify([(0, 0)], 0.5) == [(0, 0)]
    assert m.simplify([], 0.5) == []


def test_project_orientation():
    # 北にあるほど y が小さい（SVG は上が y=0）
    _, y1 = m.project(45.0, 140.0)   # 北海道あたり
    _, y2 = m.project(26.0, 128.0)   # 沖縄あたり
    assert y1 < y2, (y1, y2)
    # 東にあるほど x が大きい
    x3, _ = m.project(35.0, 130.0)
    x4, _ = m.project(35.0, 140.0)
    assert x3 < x4


def test_generated_svg():
    assert SVG.exists(), f"not found: {SVG} — build_map_svg.py を実行してください"
    size = SVG.stat().st_size
    assert size <= MAX_BYTES, f"{size/1024:.0f}KB は上限 {MAX_BYTES/1024:.0f}KB を超えている"

    doc = json.loads(SVG.read_text(encoding="utf-8"))
    assert "viewBox" in doc
    paths = doc["paths"]
    assert len(paths) == 47, f"47県あるはずが {len(paths)} 件"
    assert sorted(int(k) for k in paths) == list(range(1, 48))
    for code, d in paths.items():
        assert d.startswith("M"), f"{code}: パスが M で始まっていない"
        assert d.rstrip().endswith("Z"), f"{code}: パスが Z で閉じていない"
        assert len(d) > 50, f"{code}: パスが短すぎる（島を落としすぎ）"


def test_bounds_roundtrip():
    """散布図が県ポリゴンと同じ座標系を使えるよう、投影パラメータを出力に含める。"""
    doc = json.loads(SVG.read_text(encoding="utf-8"))
    b = doc["bounds"]
    for k in ("minx", "miny", "scale", "lat0"):
        assert k in b, f"bounds に {k} がない"

    # bounds を使った再投影が、build_map_svg.py の内部変換と一致すること。
    # 東京駅の座標が東京都(13)のパスの範囲内に落ちれば座標系が合っている。
    import math
    lat, lon = 35.6812, 139.7671
    x = (lon * math.cos(math.radians(b["lat0"])) - b["minx"]) * b["scale"]
    y = (-lat - b["miny"]) * b["scale"]

    nums = [float(v) for v in __import__("re").findall(r"-?\d+(?:\.\d+)?", doc["paths"]["13"])]
    xs, ys = nums[0::2], nums[1::2]
    assert min(xs) <= x <= max(xs), f"東京駅のx={x:.1f} が東京都の範囲 [{min(xs):.1f}, {max(xs):.1f}] 外"
    assert min(ys) <= y <= max(ys), f"東京駅のy={y:.1f} が東京都の範囲 [{min(ys):.1f}, {max(ys):.1f}] 外"


def main():
    test_simplify_keeps_endpoints()
    test_simplify_keeps_corner()
    test_simplify_short_input()
    test_project_orientation()
    test_generated_svg()
    test_bounds_roundtrip()
    print("OK: map svg")


if __name__ == "__main__":
    main()
