# -*- coding: utf-8 -*-
"""収集した事実の正規化。機械的に直せるものだけを直し、他は落とす。

推測で埋めないことが要。「そば定食850円、親子丼セット750円」から
どちらかを選ぶと、根拠のない値が事実として載る。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import normalize_facts as nf


def test_passes_valid_facts_untouched():
    f = {"k": "price", "v": 200, "urls": ["https://a/"]}
    got, why = nf.normalize_fact(f)
    assert got == f and why is None


def test_extracts_single_number():
    got, why = nf.normalize_fact({"k": "price", "v": "大人450円", "urls": []})
    assert got["v"] == 450, got
    assert why is None


def test_refuses_when_several_numbers():
    """どれが何の料金か決められないものは落とす。推測で選ばない。"""
    got, why = nf.normalize_fact(
        {"k": "price", "v": "そば定食850円、親子丼セット750円", "urls": []})
    assert got is None
    assert "決められない" in why, why


def test_strips_annotation_from_vocab_value():
    got, why = nf.normalize_fact(
        {"k": "first_timer", "v": "easy（カウンター中心で入りやすい）", "urls": []})
    assert got["v"] == "easy", got


def test_refuses_unknown_value():
    got, why = nf.normalize_fact({"k": "bring_towel", "v": "not required（販売あり）", "urls": []})
    assert got is None, got
    assert "語彙に無い値" in why, why


def test_refuses_unknown_key():
    got, why = nf.normalize_fact({"k": "親切さ", "v": "high", "urls": []})
    assert got is None
    assert "語彙にない事実名" in why, why


def test_record_with_no_valid_fact_is_dropped():
    out, dropped = nf.normalize([{"id": "n1", "checked": "2026-08-09",
                                  "facts": [{"k": "親切さ", "v": "high", "urls": []}]}])
    assert out == []
    assert len(dropped) == 1


def test_partially_valid_record_keeps_the_good_facts():
    out, dropped = nf.normalize([{"id": "n1", "checked": "2026-08-09", "facts": [
        {"k": "price", "v": 200, "urls": ["https://a/"]},
        {"k": "親切さ", "v": "high", "urls": []}]}])
    assert len(out) == 1 and len(out[0]["facts"]) == 1
    assert len(dropped) == 1


def main():
    test_passes_valid_facts_untouched()
    test_extracts_single_number()
    test_refuses_when_several_numbers()
    test_strips_annotation_from_vocab_value()
    test_refuses_unknown_value()
    test_refuses_unknown_key()
    test_record_with_no_valid_fact_is_dropped()
    test_partially_valid_record_keeps_the_good_facts()
    print("OK: normalize_facts")


if __name__ == "__main__":
    main()
