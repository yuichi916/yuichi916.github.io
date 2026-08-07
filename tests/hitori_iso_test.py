# -*- coding: utf-8 -*-
"""孤立度＝最寄の同カテゴリ施設までの距離。湯・滞在に発見を出すための指標。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import iso


def rec(i, lat, lon, cat="bath"):
    return {"id": f"n{i}", "lat": lat, "lon": lon, "cat": cat}


def test_two_nearby():
    # 緯度0.001度は約111m
    recs = [rec(1, 35.0, 139.0), rec(2, 35.001, 139.0)]
    iso.compute_iso(recs)
    assert 100 <= recs[0]["iso"] <= 125, recs[0]["iso"]
    assert recs[0]["iso"] == recs[1]["iso"], "対称でない"


def test_only_same_category_counts():
    recs = [rec(1, 35.0, 139.0, "bath"), rec(2, 35.001, 139.0, "eat")]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M, "別カテゴリを最寄に数えている"


def test_alone_in_country():
    recs = [rec(1, 35.0, 139.0)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M


def test_capped_at_max():
    # 緯度1.0度は約111km。上限50kmで打ち切る。
    recs = [rec(1, 35.0, 139.0), rec(2, 36.0, 139.0)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M


def test_picks_the_nearest_not_the_first_found():
    # リング1の隅にある遠い候補（約2860m）より、リング2の辺上にある近い候補
    # （約1867m）のほうが近い。両者が別リングに落ちるよう座標を選んである
    # （同じセルに落ちると ring0 で両方まとめて見つかり、打ち切り条件を
    # 検証できないテストになってしまう＝過去のレビュー指摘）。
    # best <= ring * MIN_CELL_M の判定を「最初に見つかったリングで打ち切る」に
    # 弱めると、この期待値では通らない。
    center = rec(1, 35.0000, 139.0000)
    far_inner = rec(2, 35.0199, 139.0199)   # ring1の隅、約2860m
    near_outer = rec(3, 35.0000, 139.0205)  # ring2の辺、約1867m
    recs = [center, far_inner, near_outer]
    iso.compute_iso(recs)
    assert 1860 <= center["iso"] <= 1875, f"最寄を取り違えている: {center['iso']}"


def test_far_candidate_does_not_shortcut_the_cap():
    # 50kmを超える候補（ring34、約50251m）を先に見つけても、そこで打ち切っては
    # いけない。さらに外側の ring40 に約45034m（50km未満）の候補があり、これが
    # 正しい最寄り。「best が MAX_ISO_M 以上になったら打ち切る」という条件を
    # 入れると、ring34時点で誤って MAX_ISO_M を返してしまう回帰を検出する。
    center = rec(1, 35.0000, 139.0000)
    far_over_cap = rec(2, 35.3499, 139.3499)    # ring34、約50251m（50km超）
    near_under_cap = rec(3, 35.4050, 139.0000)  # ring40、約45034m（50km未満）
    recs = [center, far_over_cap, near_under_cap]
    iso.compute_iso(recs)
    assert 45025 <= center["iso"] <= 45045, f"上限打ち切りで丸めている: {center['iso']}"


def test_crosses_prefecture_boundary():
    # 全国の点集合に対して計算するので県境は関係しない
    recs = [rec(1, 35.0, 139.0), rec(2, 35.0, 139.002)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] < 250


def test_thresholds_are_per_category():
    recs = []
    for k in range(10):
        recs.append(rec(100 + k, 35.0 + 0.001 * k, 139.0, "eat"))
    for k in range(10):
        recs.append(rec(200 + k, 40.0 + 0.05 * k, 140.0, "bath"))
    iso.compute_iso(recs)
    th = iso.iso_thresholds(recs)
    assert set(th) == {"eat", "bath"}, th
    assert th["bath"] > th["eat"], f"疎な bath のほうが大きいはず: {th}"
    assert all(isinstance(v, int) for v in th.values())


def test_thresholds_ignore_missing_category():
    recs = [rec(1, 35.0, 139.0, "eat"), rec(2, 35.001, 139.0, "eat")]
    th = iso.iso_thresholds(recs)
    assert "play" not in th


def test_scales():
    import time
    recs = [rec(i, 35.0 + (i % 200) * 0.002, 139.0 + (i // 200) * 0.002)
            for i in range(20000)]
    t = time.time()
    iso.compute_iso(recs)
    elapsed = time.time() - t
    assert elapsed < 30, f"20,000件に {elapsed:.1f}秒。リング走査が広がりすぎている"


def main():
    test_two_nearby()
    test_only_same_category_counts()
    test_alone_in_country()
    test_capped_at_max()
    test_picks_the_nearest_not_the_first_found()
    test_far_candidate_does_not_shortcut_the_cap()
    test_crosses_prefecture_boundary()
    test_thresholds_are_per_category()
    test_thresholds_ignore_missing_category()
    test_scales()
    print("OK: iso")


if __name__ == "__main__":
    main()
