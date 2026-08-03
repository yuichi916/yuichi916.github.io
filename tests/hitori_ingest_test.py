# -*- coding: utf-8 -*-
"""GitHub Issue 本文のパースと curated.json へのマージ検証。gh CLI は叩かない。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import ingest_issues as ing

BODY_OK = """### 施設ID

n1234567890

### この施設はひとり向きですか

ひとり向き（黙浴・カウンターなど）

### 根拠

黙浴の掲示あり。21時は自分ひとりだった。

### 補足

_No response_
"""

BODY_NEGATIVE = """### 施設ID

w987

### この施設はひとり向きですか

ひとり向きではなかった

### 根拠

2名以上でないと入店不可だった

### 補足

_No response_
"""


def test_parse_ok():
    r = ing.parse_issue_body(BODY_OK)
    assert r["id"] == "n1234567890"
    assert r["polarity"] == "+"
    assert "黙浴の掲示あり" in r["claim"]


def test_parse_negative():
    r = ing.parse_issue_body(BODY_NEGATIVE)
    assert r["id"] == "w987"
    assert r["polarity"] == "-"


def test_parse_rejects_garbage():
    assert ing.parse_issue_body("") is None
    assert ing.parse_issue_body(None) is None
    assert ing.parse_issue_body("### 施設ID\n\n_No response_\n") is None
    # ID の形式が不正
    assert ing.parse_issue_body("### 施設ID\n\nDROP TABLE\n\n### 根拠\n\nx\n") is None
    # 根拠なし
    assert ing.parse_issue_body("### 施設ID\n\nn1\n\n### 根拠\n\n_No response_\n") is None


def test_merge_adds_evidence():
    curated = {}
    entries = [{"id": "n1", "polarity": "+", "claim": "黙浴の掲示あり",
                "issue": 42, "checked": "2026-08-02"}]
    out, changes = ing.merge(curated, entries)
    ev = out["n1"]["evidence"]
    assert len(ev) == 1
    assert ev[0]["src"] == "user" and ev[0]["id"] == "gh-issue-42"
    assert ev[0]["polarity"] == "+" and ev[0]["checked"] == "2026-08-02"
    assert len(changes) == 1


def test_merge_is_idempotent():
    entries = [{"id": "n1", "polarity": "+", "claim": "黙浴の掲示あり",
                "issue": 42, "checked": "2026-08-02"}]
    out, _ = ing.merge({}, entries)
    out2, changes = ing.merge(out, entries)
    assert len(out2["n1"]["evidence"]) == 1, "同じissueを二重に取り込んでいる"
    assert changes == []


def test_merge_preserves_existing():
    curated = {"n1": {"note": "手書きメモ", "chain": 0,
                      "evidence": [{"src": "web", "url": "https://x", "checked": "2026-01-01",
                                    "polarity": "+"}]}}
    entries = [{"id": "n1", "polarity": "-", "claim": "入りにくかった",
                "issue": 99, "checked": "2026-08-02"}]
    out, _ = ing.merge(curated, entries)
    assert out["n1"]["note"] == "手書きメモ"
    assert out["n1"]["chain"] == 0
    assert len(out["n1"]["evidence"]) == 2
    # 元の辞書を破壊しない
    assert len(curated["n1"]["evidence"]) == 1


def test_merge_output_passes_validation():
    sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
    import validate
    entries = [{"id": "n1", "polarity": "+", "claim": "黙浴の掲示あり",
                "issue": 42, "checked": "2026-08-02"}]
    out, _ = ing.merge({}, entries)
    assert validate.validate_curated(out) == [], validate.validate_curated(out)


def main():
    test_parse_ok()
    test_parse_negative()
    test_parse_rejects_garbage()
    test_merge_adds_evidence()
    test_merge_is_idempotent()
    test_merge_preserves_existing()
    test_merge_output_passes_validation()
    print("OK: ingest_issues")


if __name__ == "__main__":
    main()
