# -*- coding: utf-8 -*-
"""集めた事実の検証。禁止ドメイン・語彙・重複はコードで弾く。

運用の約束にすると守られなくなる。気づかないまま集め続けるのが一番悪い
ので、拒否は黙って捨てるのではなく例外にする。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import curate


def _raw(**kw):
    base = {
        "id": "n1", "checked": "2026-08-08",
        "facts": [{"k": "payment_method", "v": "ticket_machine",
                   "urls": ["https://a.example/1", "https://b.example/2"]}],
    }
    base.update(kw)
    return base


def test_blocked_domain_raises():
    raw = _raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                       "urls": ["https://tabelog.com/x", "https://b.example/2"]}])
    try:
        curate.build_entry(raw)
    except curate.RejectedError as e:
        assert "tabelog.com" in str(e), str(e)
    else:
        raise AssertionError("禁止ドメインが通ってしまった")


def test_unknown_fact_raises():
    for bad in ({"k": "親切さ", "v": "high", "urls": ["https://a.example/1"]},
                {"k": "payment_method", "v": "なんとなく", "urls": ["https://a.example/1"]}):
        try:
            curate.build_entry(_raw(facts=[bad]))
        except curate.RejectedError:
            pass
        else:
            raise AssertionError(f"語彙にない事実が通った: {bad}")


def test_same_domain_counts_once():
    raw = _raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                       "urls": ["https://a.example/1", "https://a.example/2",
                                "https://www.a.example/3"]}])
    e = curate.build_entry(raw)
    assert e["facts"][0]["n"] == 1, e["facts"][0]
    assert e["facts"][0]["src"] == ["a.example"], e["facts"][0]


def test_support_counts_distinct_domains():
    e = curate.build_entry(_raw())
    assert e["facts"][0]["n"] == 2
    assert sorted(e["facts"][0]["src"]) == ["a.example", "b.example"]


def test_official_flag():
    raw = _raw(facts=[{"k": "price", "v": 200,
                       "urls": ["https://www.city.beppu.oita.jp/x"]}])
    e = curate.build_entry(raw)
    assert e["facts"][0]["official"] is True
    # 公式でない1件は official にならない
    raw2 = _raw(facts=[{"k": "price", "v": 200, "urls": ["https://blog.example/x"]}])
    assert curate.build_entry(raw2)["facts"][0]["official"] is False


def test_conflict_is_marked_not_dropped():
    raw = _raw(facts=[
        {"k": "payment_method", "v": "ticket_machine", "urls": ["https://a.example/1", "https://b.example/1"]},
        {"k": "payment_method", "v": "counter_person", "urls": ["https://c.example/1", "https://d.example/1"]},
    ])
    e = curate.build_entry(raw)
    assert len(e["facts"]) == 2, "矛盾する主張が捨てられている"
    assert all(f["conflict"] for f in e["facts"])


def test_no_free_text_is_stored():
    """自由記述の欄を持ち込めないこと。"""
    raw = _raw()
    raw["facts"][0]["note"] = "店員さんがとても親切でした"
    e = curate.build_entry(raw)
    assert "note" not in e["facts"][0], e["facts"][0]
    allowed = {"k", "v", "n", "src", "urls", "official", "conflict"}
    assert set(e["facts"][0]) <= allowed, set(e["facts"][0])


def test_urls_without_scheme_raise():
    try:
        curate.build_entry(_raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                                        "urls": ["a.example/1"]}]))
    except curate.RejectedError:
        pass
    else:
        raise AssertionError("スキームの無いURLが通った")


def test_empty_urls_raise():
    try:
        curate.build_entry(_raw(facts=[{"k": "payment_method", "v": "ticket_machine", "urls": []}]))
    except curate.RejectedError:
        pass
    else:
        raise AssertionError("出典の無い事実が通った")


def test_merge_replaces_by_id():
    a = {"n1": {"checked": "2026-01-01", "facts": []}}
    b = curate.merge(a, [curate.build_entry(_raw())])
    assert b["n1"]["checked"] == "2026-08-08"
    assert len(b["n1"]["facts"]) == 1
    assert a["n1"]["checked"] == "2026-01-01", "入力を破壊している"



def test_merge_keeps_previously_collected_facts():
    """ブランド単位の判定で、個別に集めた事実を消さないこと。

    以前は entry 全体を差し替えていたため、閉業の判定をブランド単位で
    流すと料金・支払い方法などが黙って消えていた。
    """
    prev = {"n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 200, "n": 2, "src": ["a", "b"],
         "urls": ["https://a/", "https://b/"], "official": False, "conflict": False}]}}
    brand = curate.build_entry({"id": "n1", "checked": "2026-08-09", "facts": [
        {"k": "status", "v": "closed_permanently",
         "urls": ["https://c.example/", "https://d.example/"]}]})
    brand["id"] = "n1"
    got = curate.merge(prev, [brand])
    keys = {f["k"] for f in got["n1"]["facts"]}
    assert keys == {"price", "status"}, keys
    assert prev["n1"]["facts"][0]["k"] == "price", "入力を破壊している"


def test_merge_overwrites_the_same_fact():
    prev = {"n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 200, "n": 1, "src": ["a"], "urls": ["https://a/"],
         "official": False, "conflict": False}]}}
    e = curate.build_entry({"id": "n1", "checked": "2026-08-09", "facts": [
        {"k": "price", "v": 200, "urls": ["https://a.example/", "https://b.example/"]}]})
    e["id"] = "n1"
    got = curate.merge(prev, [e])
    assert len(got["n1"]["facts"]) == 1
    assert got["n1"]["facts"][0]["n"] == 2, "新しい裏付けで上書きされていない"

def main():
    test_blocked_domain_raises()
    test_unknown_fact_raises()
    test_same_domain_counts_once()
    test_support_counts_distinct_domains()
    test_official_flag()
    test_conflict_is_marked_not_dropped()
    test_no_free_text_is_stored()
    test_urls_without_scheme_raise()
    test_empty_urls_raise()
    test_merge_replaces_by_id()
    test_merge_keeps_previously_collected_facts()
    test_merge_overwrites_the_same_fact()
    print("OK: curate")


if __name__ == "__main__":
    main()
