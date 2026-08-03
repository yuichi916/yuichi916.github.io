# -*- coding: utf-8 -*-
"""出力スキーマ検証。spec §9 のビルド時チェックがそのまま期待値。"""
import sys, copy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import validate

FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]

GOOD_PREF = {
    "pref": 13, "name": "東京都", "updated": "2026-08-02",
    "fields": FIELDS,
    "items": [
        ["n1", "一蘭 渋谷店", 35.65894, 139.70043, "eat", "ramen", 5, 2, 1, "仕切りカウンター12席"],
        ["n2", "はやしや", 35.70112, 139.75820, "eat", "soba_udon", 4, 0, 0, ""],
    ],
}

GOOD_SUMMARY = {
    "updated": "2026-08-02", "total": 2,
    "population_source": "Wikidata (CC0) / 令和2年国勢調査",
    "prefectures": [
        {"code": 13, "name": "東京都", "pop": 14047594,
         "counts": {"all": 2, "bath": 0, "eat": 2, "play": 0, "stay": 0},
         "counts_indie": {"all": 1, "bath": 0, "eat": 1, "play": 0, "stay": 0},
         "density": {"all": 0.01, "bath": 0.0, "eat": 0.01, "play": 0.0, "stay": 0.0},
         "density_indie": {"all": 0.01, "bath": 0.0, "eat": 0.01, "play": 0.0, "stay": 0.0}},
    ],
}


def test_pref_ok():
    assert validate.validate_pref(GOOD_PREF) == []


def test_pref_bbox():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][0][2] = 51.0      # 日本の北端より北
    errs = validate.validate_pref(d)
    assert any("bbox" in e for e in errs), errs

    d2 = copy.deepcopy(GOOD_PREF)
    d2["items"][0][3] = 100.0    # 日本の西端より西
    assert any("bbox" in e for e in validate.validate_pref(d2))


def test_pref_empty_name():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][0][1] = ""
    assert any("name" in e for e in validate.validate_pref(d))


def test_pref_score_range():
    for bad in (0, 6, 3.5, "4"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][6] = bad
        assert any("score" in e for e in validate.validate_pref(d)), bad


def test_pref_chain_flag():
    for bad in (2, -1, "1", None):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][8] = bad
        assert any("chain" in e for e in validate.validate_pref(d)), bad


def test_pref_duplicate_id():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][1][0] = "n1"
    assert any("duplicate" in e for e in validate.validate_pref(d))


def test_pref_fields_mismatch():
    d = copy.deepcopy(GOOD_PREF)
    d["fields"] = FIELDS[:-1]
    assert any("fields" in e for e in validate.validate_pref(d))


def test_summary_ok():
    assert validate.validate_summary(GOOD_SUMMARY) == []


def test_summary_indie_not_exceeding():
    d = copy.deepcopy(GOOD_SUMMARY)
    d["prefectures"][0]["counts_indie"]["eat"] = 5   # counts.eat=2 を超える
    assert any("counts_indie" in e for e in validate.validate_summary(d))


def test_curated_web_needs_url():
    # spec §6.2「出典URLが取れないものは採用しない」を機械的に強制する
    bad = {"n1": {"evidence": [{"src": "web", "checked": "2026-08-01", "polarity": "+"}]}}
    assert any("url" in e for e in validate.validate_curated(bad))

    bad2 = {"n1": {"evidence": [{"src": "web", "url": "", "checked": "2026-08-01", "polarity": "+"}]}}
    assert any("url" in e for e in validate.validate_curated(bad2))

    ok = {"n1": {"evidence": [{"src": "web", "url": "https://x", "checked": "2026-08-01", "polarity": "+"}]}}
    assert validate.validate_curated(ok) == []

    # user / visit は url 不要
    ok2 = {"n1": {"evidence": [{"src": "user", "id": "gh-issue-1", "checked": "2026-08-01", "polarity": "+"}]}}
    assert validate.validate_curated(ok2) == []


def test_curated_field_shapes():
    assert any("src" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "twitter", "checked": "2026-08-01", "polarity": "+"}]}}))
    assert any("polarity" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "visit", "checked": "2026-08-01", "polarity": "?"}]}}))
    assert any("checked" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "visit", "polarity": "+"}]}}))
    assert any("chain" in e for e in validate.validate_curated({"n1": {"chain": 2}}))

    # 手動追加エントリ(c-)は座標とカテゴリを自前で持つ必要がある
    assert any("c-0001" in e for e in validate.validate_curated({"c-0001": {"name": "○○"}}))
    assert validate.validate_curated({"c-0001": {
        "name": "カプセルホテル○○", "lat": 35.6, "lon": 139.7, "pref": 13,
        "cat": "stay", "kind": "capsule", "base": 5}}) == []


def main():
    test_pref_ok()
    test_pref_bbox()
    test_pref_empty_name()
    test_pref_score_range()
    test_pref_chain_flag()
    test_pref_duplicate_id()
    test_pref_fields_mismatch()
    test_summary_ok()
    test_summary_indie_not_exceeding()
    test_curated_web_needs_url()
    test_curated_field_shapes()
    print("OK: validate")


if __name__ == "__main__":
    main()
