# -*- coding: utf-8 -*-
"""出力スキーマ検証。spec §9 のビルド時チェックがそのまま期待値。"""
import sys, copy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import validate

FIELDS = ["id", "name", "lat", "lon", "cat", "kind",
          "solo", "quiet", "easy", "conf", "chain",
          "hidden", "hidden_n", "iso", "city", "oh", "tel", "web", "note",
          "solo_est", "quiet_est", "easy_est", "checked"]

GOOD_PREF = {
    "pref": 13, "name": "東京都", "updated": "2026-08-04",
    "fields": FIELDS,
    "items": [
        ["n1", "一蘭 渋谷店", 35.65894, 139.70043, "eat", "ramen",
         5, 4, 3, 2, 1, 0.0, 8, 240, "渋谷区", "11:00-23:00",
         "03-0000-0000", "https://ichiran.com/", "仕切りカウンター12席",
         4, 4, 3, "2026-08-01"],
        ["n2", "はやしや", 35.70112, 139.75820, "eat", "soba_udon",
         4, 4, 3, 0, 0, 0.83, 12, 1500, "新宿区", "", "", "", "",
         4, 4, 3, ""],
    ],
}

GOOD_SUMMARY = {
    "updated": "2026-08-02", "total": 2,
    "population_source": "Wikidata (CC0) / 令和2年国勢調査",
    "iso_threshold": {"bath": 3200, "eat": 900, "play": 5400, "stay": 2100},
    "iso_max": validate.iso_mod.MAX_ISO_M,
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


def test_pref_axis_ranges():
    for axis, col in (("solo", 6), ("quiet", 7), ("easy", 8)):
        for bad in (0, 6, 3.5, "4"):
            d = copy.deepcopy(GOOD_PREF)
            d["items"][0][col] = bad
            errs = validate.validate_pref(d)
            assert any(axis in e for e in errs), f"{axis}={bad!r} が通ってしまった"


def test_pref_hidden_range():
    for bad in (-0.1, 1.1, "0.5"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][11] = bad
        assert any("hidden" in e for e in validate.validate_pref(d)), bad
    # hidden_n が3未満なら hidden は0でなければならない
    d = copy.deepcopy(GOOD_PREF)
    d["items"][1][12] = 2
    assert any("hidden" in e for e in validate.validate_pref(d))


def test_pref_chain_flag():
    for bad in (2, -1, "1", None):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][10] = bad
        assert any("chain" in e for e in validate.validate_pref(d)), bad


def test_pref_duplicate_id():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][1][0] = "n1"
    assert any("duplicate" in e for e in validate.validate_pref(d))


def test_pref_fields_mismatch():
    d = copy.deepcopy(GOOD_PREF)
    d["fields"] = FIELDS[:-1]
    assert any("fields" in e for e in validate.validate_pref(d))


def test_pref_iso_range():
    for bad in (-1, 50001, 1.5, "300"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][13] = bad
        assert any("iso" in e for e in validate.validate_pref(d)), bad


def test_pref_checked_format():
    # checked は空文字（未調査）または YYYY-MM-DD（調査日）のみを許す。
    d = copy.deepcopy(GOOD_PREF)
    d["items"][0][22] = "調査済み"
    errs = validate.validate_pref(d)
    assert any("checked" in e for e in errs), errs

    d2 = copy.deepcopy(GOOD_PREF)
    d2["items"][0][22] = "2026-8-1"      # ゼロ埋めされていない
    assert any("checked" in e for e in validate.validate_pref(d2))


def test_summary_needs_iso_threshold():
    d = copy.deepcopy(GOOD_SUMMARY)
    del d["iso_threshold"]
    assert any("iso_threshold" in e for e in validate.validate_summary(d))

    d2 = copy.deepcopy(GOOD_SUMMARY)
    d2["iso_threshold"] = {"bath": 3200}          # カテゴリ不足
    assert any("iso_threshold" in e for e in validate.validate_summary(d2))

    d3 = copy.deepcopy(GOOD_SUMMARY)
    d3["iso_threshold"]["eat"] = -5
    assert any("iso_threshold" in e for e in validate.validate_summary(d3))


def test_summary_needs_iso_max():
    # hitori.html の formatIso が SUMMARY.iso_max を読む。iso.py の値とJS側の
    # 50000 決め打ちが乖離した前例があるため、summary.json に必ず載せる。
    d = copy.deepcopy(GOOD_SUMMARY)
    del d["iso_max"]
    assert any("iso_max" in e for e in validate.validate_summary(d))

    d2 = copy.deepcopy(GOOD_SUMMARY)
    d2["iso_max"] = validate.iso_mod.MAX_ISO_M + 1   # iso.py の値と不一致
    assert any("iso_max" in e for e in validate.validate_summary(d2))


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



def test_exclusion_leak_is_detected():
    """除外すべき施設が県ファイルに残っていたら気づけること。

    「2件以上はビルド時に除外」「1件未満はブラウザで警告」という分担の
    どちらの担当でもない穴があり、出典3件の閉業施設が2件並んでいた。
    """
    docs = {13: {"fields": ["id", "name"], "items": [["n1", "生きてる店"], ["n2", "閉業した店"]]}}
    curated = {"n2": {"checked": "2026-08-09", "facts": [
        {"k": "status", "v": "closed_permanently", "n": 3,
         "src": ["a", "b", "c"], "urls": ["https://a/"], "official": False, "conflict": False}]}}
    errs = validate.validate_exclusions(docs, curated)
    assert len(errs) == 1, errs
    assert "n2" in errs[0] and "閉業" in errs[0], errs


def test_no_leak_when_already_excluded():
    docs = {13: {"fields": ["id", "name"], "items": [["n1", "生きてる店"]]}}
    curated = {"n2": {"checked": "2026-08-09", "facts": [
        {"k": "status", "v": "closed_permanently", "n": 3,
         "src": ["a", "b", "c"], "urls": ["https://a/"], "official": False, "conflict": False}]}}
    assert validate.validate_exclusions(docs, curated) == []


def test_single_source_closure_is_not_a_leak():
    """出典1件は除外の条件を満たさない。残っていて正しい（警告で伝える）。"""
    docs = {13: {"fields": ["id", "name"], "items": [["n2", "閉業かもしれない店"]]}}
    curated = {"n2": {"checked": "2026-08-09", "facts": [
        {"k": "status", "v": "closed_permanently", "n": 1,
         "src": ["a"], "urls": ["https://a/"], "official": False, "conflict": False}]}}
    assert validate.validate_exclusions(docs, curated) == []


def test_real_data_has_no_exclusion_leak():
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    docs = {int(f.stem): json.loads(f.read_text(encoding="utf-8"))
            for f in sorted((root / "data" / "hitori" / "pref").glob("*.json"))}
    cur = json.loads((root / "data" / "hitori" / "curated.json").read_text(encoding="utf-8"))
    errs = validate.validate_exclusions(docs, cur)
    assert not errs, "; ".join(errs[:10])

def main():
    test_pref_ok()
    test_pref_bbox()
    test_pref_empty_name()
    test_pref_axis_ranges()
    test_pref_hidden_range()
    test_pref_chain_flag()
    test_pref_duplicate_id()
    test_pref_fields_mismatch()
    test_pref_iso_range()
    test_pref_checked_format()
    test_summary_needs_iso_threshold()
    test_summary_needs_iso_max()
    test_summary_ok()
    test_summary_indie_not_exceeding()
    test_curated_web_needs_url()
    test_curated_field_shapes()
    test_exclusion_leak_is_detected()
    test_no_leak_when_already_excluded()
    test_single_source_closure_is_not_a_leak()
    test_real_data_has_no_exclusion_leak()
    print("OK: validate")


if __name__ == "__main__":
    main()
