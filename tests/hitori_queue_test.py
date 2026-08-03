# -*- coding: utf-8 -*-
"""調査キューの優先度付け検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import research_queue as rq

FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]

PREFDOCS = {
    13: {"pref": 13, "name": "東京都", "fields": FIELDS, "items": [
        ["n1", "投稿あり店", 35.6, 139.7, "eat", "ramen", 4, 2, 0, ""],
        ["n2", "境界スコア店", 35.6, 139.7, "bath", "onsen", 3, 0, 0, ""],
        ["n3", "高スコア店", 35.6, 139.7, "eat", "standing", 5, 0, 0, ""],
        ["n4", "少数カテゴリ店", 35.6, 139.7, "play", "cinema", 3, 0, 0, ""],
    ]},
}
CURATED = {"n1": {"evidence": [{"src": "user", "id": "gh-issue-9",
                                "checked": "2026-08-01", "polarity": "+"}]}}


def test_investigated_are_excluded():
    # 既に conf>=1 のものは調査済みなので出さない
    out = rq.rank_targets(PREFDOCS, CURATED)
    assert all(t["id"] != "n1" for t in out), "調査済みが混ざっている"


def test_boundary_score_first():
    out = rq.rank_targets(PREFDOCS, CURATED)
    assert out[0]["id"] in ("n2", "n4"), f"境界スコアが先頭でない: {out[0]}"


def test_reason_is_present():
    for t in rq.rank_targets(PREFDOCS, CURATED):
        assert t["reason"], f"reason が空: {t}"
        assert t["maps"].startswith("https://"), t


def test_limit():
    out = rq.rank_targets(PREFDOCS, CURATED, limit=2)
    assert len(out) == 2


def test_sorted_by_weight_desc():
    out = rq.rank_targets(PREFDOCS, CURATED)
    weights = [t["weight"] for t in out]
    assert weights == sorted(weights, reverse=True), weights


def main():
    test_investigated_are_excluded()
    test_boundary_score_first()
    test_reason_is_present()
    test_limit()
    test_sorted_by_weight_desc()
    print("OK: research_queue")


if __name__ == "__main__":
    main()
