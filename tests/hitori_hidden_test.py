# -*- coding: utf-8 -*-
"""穴場スコアの検証。周囲のチェーン比率が高い場所の非チェーン店を拾う。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import hidden


def rec(i, lat, lon, chain, cat="eat"):
    return {"id": f"n{i}", "lat": lat, "lon": lon, "cat": cat, "chain": chain}


def test_chain_sea_gives_high_hidden():
    # 同じ地点近傍に チェーン4 + 独立1。独立店の周囲は4/4=100%チェーン。
    recs = [rec(1, 35.0000, 139.0000, 0)]
    for k in range(4):
        recs.append(rec(10 + k, 35.0000 + 0.0005 * k, 139.0000, 1))
    hidden.compute_hidden(recs)
    indie = recs[0]
    assert indie["hidden_n"] == 4
    assert abs(indie["hidden"] - 1.0) < 1e-6


def test_chain_itself_gets_zero():
    # チェーン店自身は穴場ではない
    recs = [rec(1, 35.0, 139.0, 1)] + [rec(10 + k, 35.0 + 0.0005 * k, 139.0, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden"] == 0.0


def test_too_few_neighbors_is_zero():
    # 周辺2件では「100%チェーン」と言っても意味がない
    recs = [rec(1, 35.0, 139.0, 0), rec(2, 35.0005, 139.0, 1), rec(3, 35.0010, 139.0, 1)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 2
    assert recs[0]["hidden"] == 0.0


def test_only_same_category_counts():
    # 半径内にいても別カテゴリは数えない
    recs = [rec(1, 35.0, 139.0, 0, "eat")]
    recs += [rec(10 + k, 35.0 + 0.0005 * k, 139.0, 1, "bath") for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 0
    assert recs[0]["hidden"] == 0.0


def test_outside_radius_not_counted():
    # 500m の外は数えない。緯度0.01度は約1.1km。
    recs = [rec(1, 35.0, 139.0, 0)] + [rec(10 + k, 35.0 + 0.01 * (k + 1), 139.0, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 0


def test_crosses_prefecture_boundary():
    # 県境をまたいだ近傍も数える（全国の点集合に対して計算するため）
    recs = [rec(1, 35.0, 139.0, 0)]
    recs += [rec(10 + k, 35.0 + 0.001 * k, 139.001, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 4


def test_mixed_ratio():
    # 周辺6件中3件チェーン → 0.5
    recs = [rec(1, 35.0, 139.0, 0)]
    for k in range(3):
        recs.append(rec(10 + k, 35.0 + 0.0005 * (k + 1), 139.0, 1))
    for k in range(3):
        recs.append(rec(20 + k, 35.0 - 0.0005 * (k + 1), 139.0, 0))
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 6
    assert abs(recs[0]["hidden"] - 0.5) < 1e-6


def test_is_hidden_gem():
    assert hidden.is_hidden_gem({"chain": 0, "hidden": 0.8, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 1, "hidden": 0.8, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 0, "hidden": 0.5, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 0, "hidden": 0.8, "hidden_n": 2})


def test_scales_to_many_records():
    # 全件総当たりだと 37,000^2 で終わらない。グリッドが効いていることの確認。
    import time
    recs = [rec(i, 35.0 + (i % 200) * 0.002, 139.0 + (i // 200) * 0.002, i % 3 == 0)
            for i in range(20000)]
    t = time.time()
    hidden.compute_hidden(recs)
    elapsed = time.time() - t
    assert elapsed < 20, f"20,000件に {elapsed:.1f}秒かかった。グリッドが効いていない"


def main():
    test_chain_sea_gives_high_hidden()
    test_chain_itself_gets_zero()
    test_too_few_neighbors_is_zero()
    test_only_same_category_counts()
    test_outside_radius_not_counted()
    test_crosses_prefecture_boundary()
    test_mixed_ratio()
    test_is_hidden_gem()
    test_scales_to_many_records()
    print("OK: hidden")


if __name__ == "__main__":
    main()
