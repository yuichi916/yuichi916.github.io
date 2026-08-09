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


def test_free_price_becomes_zero():
    """「無料」は 0 円として残る。

    数字が0個なので「どれを指すか決められない」で落ちていた。無料の施設は
    実在し（七ヶ宿町水と歴史の館ほか）、料金が分かるかどうかは一人で行く
    ときに効く。落とす理由の文言も実態と合っていなかった。
    """
    got, why = nf.normalize_fact({"k": "price", "v": "無料", "urls": ["https://a/"]})
    assert why is None, why
    assert got["v"] == 0


def test_free_price_variants():
    for v in ("無料 ", "0円", "free", "Free"):
        got, why = nf.normalize_fact({"k": "price", "v": v, "urls": ["https://a/"]})
        assert why is None and got["v"] == 0, (v, why)


def test_conditionally_free_is_still_dropped():
    """但し書き付きは 0 と決めつけない。「無料開放日あり」は通常有料。"""
    got, why = nf.normalize_fact(
        {"k": "price", "v": "無料開放日あり", "urls": ["https://a/"]})
    assert got is None and why


def test_blocked_source_is_stripped_not_fatal():
    """禁止サイトの出典は外す。1本混ざっただけで取り込み全体を止めない。

    curate.py は見つけると例外で止める設計だが、それは「黙って通さない」
    ためであって、収集の取りこぼし1件で数百施設の取り込みを落とすためでは
    ない。実際に s.tabelog.com が1本混ざって取り込みが止まった。
    """
    f, n = nf.strip_blocked_urls({"k": "price", "v": 400,
                                  "urls": ["https://a.jp/", "https://s.tabelog.com/x/"]})
    assert n == 1 and f["urls"] == ["https://a.jp/"]


def test_record_with_only_blocked_sources_is_dropped():
    """禁止サイトしか出典が無い事実は残さない。出典なしで載せてはならない。"""
    recs = [{"id": "n1", "checked": "2026-08-10", "facts": [
        {"k": "price", "v": 400, "urls": ["https://tabelog.com/x/"]}]}]
    out, dropped = nf.normalize(recs)
    assert out == [], out
    assert any("禁止サイト" in why for _, why in dropped), dropped
    assert any("出典URLが無い" in why for _, why in dropped), dropped


def test_fact_without_urls_is_dropped():
    recs = [{"id": "n1", "checked": "2026-08-10",
             "facts": [{"k": "price", "v": 400, "urls": []},
                       {"k": "wash_area", "v": "yes", "urls": ["https://a.jp/"]}]}]
    out, dropped = nf.normalize(recs)
    assert [f["k"] for f in out[0]["facts"]] == ["wash_area"], out
    assert any("出典URLが無い" in why for _, why in dropped), dropped


def main():
    test_passes_valid_facts_untouched()
    test_extracts_single_number()
    test_refuses_when_several_numbers()
    test_strips_annotation_from_vocab_value()
    test_refuses_unknown_value()
    test_refuses_unknown_key()
    test_record_with_no_valid_fact_is_dropped()
    test_partially_valid_record_keeps_the_good_facts()
    test_free_price_becomes_zero()
    test_free_price_variants()
    test_conditionally_free_is_still_dropped()
    test_blocked_source_is_stripped_not_fatal()
    test_record_with_only_blocked_sources_is_dropped()
    test_fact_without_urls_is_dropped()
    print("OK: normalize_facts")


if __name__ == "__main__":
    main()
