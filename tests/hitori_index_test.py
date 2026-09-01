# -*- coding: utf-8 -*-
"""build_index の検証。実データではなく fixture で固める。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import build_index

FIELDS = ["id", "name", "lat", "lon", "cat", "kind"]
PREFDOCS = {
    13: {"pref": 13, "name": "東京都", "fields": FIELDS,
         "items": [["n1", "A", 35.0, 139.0, "eat", "ramen"], ["n2", "B", 36.0, 140.0, "bath", "sento"]]},
    14: {"pref": 14, "name": "神奈川県", "fields": FIELDS,
         "items": [["n3", "C", 35.5, 139.5, "stay", "museum"]]},
}
CURATED = {
    "n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 600, "official": True, "conflict": True, "src": ["a.jp"], "urls": ["https://a.jp/x"]},
        {"k": "price", "v": 700, "official": False, "conflict": True, "src": ["b.jp"], "urls": ["https://b.jp/y"]},
        {"k": "solo_insight", "v": {"title": "t", "insight": "i", "quality": "grounded",
                                     "policyVersion": "official-provenance-v2"}, "official": True, "conflict": False, "src": ["a.jp"], "urls": []},
    ]},
    "n3": {"checked": "2026-08-02", "facts": [
        {"k": "hours", "v": "10:00-17:00", "official": True, "conflict": False, "src": ["c.jp"], "urls": ["https://c.jp"]}]},
    "orphan": {"checked": "2026-08-03", "facts": []},
}
SUMMARY = {"updated": "2026-08-22", "total": 3, "checked_count": 2}


def test_index_shape():
    index, by_pref = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert index["updated"] == "2026-08-22"
    assert index["total"] == 3
    prefs = {p["code"]: p for p in index["prefectures"]}
    assert prefs[13]["count"] == 2 and prefs[13]["checked"] == 1
    assert prefs[14]["count"] == 1 and prefs[14]["checked"] == 1
    assert abs(prefs[13]["center"][0] - 35.5) < 1e-6
    assert abs(prefs[13]["center"][1] - 139.5) < 1e-6


def test_checked_entry_counts():
    index, _ = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert index["checked"]["n1"] == [13, 3, 2, 2, 1, "2026-08-01"]
    assert index["checked"]["n3"] == [14, 1, 1, 0, 0, "2026-08-02"]


def test_checked_count_only_counts_official_evidence():
    """OSM タグしか根拠が無い施設を「確認済み」に数えない。

    数えると、トップの「確認済み N件は公式情報で裏を取り」が嘘になる。
    信号は出すが、確認済みの数には入れない。
    """
    curated = dict(CURATED)
    curated["n2"] = {"checked": "2026-09-02", "facts": [
        {"k": "reservation", "v": "possible", "official": False, "conflict": False,
         "src": ["openstreetmap.org"], "urls": ["https://www.openstreetmap.org/node/2"]}]}
    index, by_pref = build_index.build_index(PREFDOCS, curated, SUMMARY)
    assert "n2" in index["checked"], "根拠として索引には載せる"
    assert index["checked"]["n2"][2] == 0, "公式ソースは0件"
    assert index["checked_count"] == 2, "公式の裏付けがある2件だけを確認済みと数える"
    assert index["sourced_count"] == 3, "根拠を持つ施設の総数は別に持つ"
    prefs = {p["code"]: p for p in index["prefectures"]}
    assert prefs[13]["checked"] == 1, "県別の確認済みも公式ぶんだけ"


def test_orphans_are_dropped_and_counted():
    index, by_pref = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert "orphan" not in index["checked"]
    assert index["checked_count"] == 2
    assert set(by_pref[13].keys()) == {"n1"}
    assert set(by_pref[14].keys()) == {"n3"}
    assert by_pref[13]["n1"] == CURATED["n1"]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
