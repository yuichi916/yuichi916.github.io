# -*- coding: utf-8 -*-
"""抽出結果の検証とマージ。fixture で固める。

この工程は「LLM が指示を守ったか」を機械で確かめる関所なので、
守らなかった場合をこそテストする。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import merge_extract as me

OK_FACT = {"k": "reservation", "v": "none", "quote": "ご予約は不要です", "url": "https://a.jp/info"}


def test_good_fact_passes():
    assert me.check_fact(OK_FACT) is None


def test_vocabulary_is_enforced():
    f = dict(OK_FACT, v="予約不要")            # 語彙でなく自由文
    assert "語彙外" in me.check_fact(f)
    f = dict(OK_FACT, k="payment_method", v="ticket_machine")
    assert me.check_fact(f) is None
    f = dict(OK_FACT, k="payment_method", v="券売機")
    assert "語彙外" in me.check_fact(f)


def test_quote_is_required():
    assert "quote" in me.check_fact(dict(OK_FACT, quote=""))
    assert "quote" in me.check_fact({k: v for k, v in OK_FACT.items() if k != "quote"})
    assert "quote" in me.check_fact(dict(OK_FACT, quote="要"))


def test_url_and_blocked_domains():
    assert "url" in me.check_fact(dict(OK_FACT, url="a.jp/info"))
    assert "禁じている" in me.check_fact(dict(OK_FACT, url="https://tabelog.com/x"))


def test_types_and_unknown_keys():
    assert "整数" in me.check_fact({"k": "price", "v": "600円", "quote": "料金 600円", "url": "https://a.jp"})
    assert me.check_fact({"k": "price", "v": 600, "quote": "料金 600円", "url": "https://a.jp"}) is None
    assert "未知" in me.check_fact(dict(OK_FACT, k="mood"))


def test_quote_must_exist_on_the_page_when_page_is_known():
    page = "当店はカウンター8席。ご予約は不要です。"
    assert me.check_fact(OK_FACT, page) is None
    assert "見つからない" in me.check_fact(dict(OK_FACT, quote="おひとり様大歓迎"), page)
    # 空白と全角チルダの揺れは同じ引用として通す
    f = {"k": "hours", "v": "9:30〜17:00", "quote": "9:30 ～ 17:00", "url": "https://a.jp"}
    assert me.check_fact(f, "開館 9:30～17:00") is None


def test_merge_adds_only_matching_facilities():
    res = [
        {"id": "n1", "status": "ok", "identity": "match", "facts": [OK_FACT]},
        {"id": "n2", "status": "ok", "identity": "unclear", "facts": [OK_FACT]},
        {"id": "n3", "status": "fetch_failed", "identity": "match", "facts": []},
    ]
    cur = {}
    stat, _, ids = me.merge(res, cur, "2026-09-02")
    assert ids == ["n1"] and stat["facilities"] == 1 and stat["added"] == 1
    assert stat["skipped_facilities"] == 2
    assert cur["n1"]["checked"] == "2026-09-02"
    f = cur["n1"]["facts"][0]
    assert f["k"] == "reservation" and f["src"] == ["a.jp"] and f["official"] is True and f["conflict"] is False


def test_merge_marks_conflicts_on_both_sides_and_keeps_them():
    cur = {"n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 600, "n": 1, "official": True, "conflict": False, "src": ["old.jp"], "urls": ["https://old.jp"]}]}}
    res = [{"id": "n1", "status": "ok", "identity": "match",
            "facts": [{"k": "price", "v": 700, "quote": "料金 700円", "url": "https://a.jp"}]}]
    stat, _, _ = me.merge(res, cur, "2026-09-02")
    vals = sorted(f["v"] for f in cur["n1"]["facts"] if f["k"] == "price")
    assert vals == [600, 700], "どちらかを選んで捨てていない"
    assert all(f["conflict"] for f in cur["n1"]["facts"] if f["k"] == "price")
    assert stat["conflicts"] == 1
    assert cur["n1"]["checked"] == "2026-09-02"


def test_merge_does_not_duplicate_the_same_value():
    cur = {"n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 600, "n": 1, "official": True, "conflict": False, "src": ["a.jp"], "urls": ["https://a.jp"]}]}}
    res = [{"id": "n1", "status": "ok", "identity": "match",
            "facts": [{"k": "price", "v": 600, "quote": "料金 600円", "url": "https://a.jp"}]}]
    stat, _, _ = me.merge(res, cur, "2026-09-02")
    assert len(cur["n1"]["facts"]) == 1 and stat["added"] == 0


def test_merge_rejects_bad_facts_but_keeps_the_good_ones():
    res = [{"id": "n1", "status": "ok", "identity": "match", "facts": [
        OK_FACT,
        {"k": "silence", "v": "静か", "quote": "静かです", "url": "https://a.jp"},   # 語彙外
        {"k": "hours", "v": "10:00-18:00", "quote": "", "url": "https://a.jp"},     # quote 無し
    ]}]
    cur = {}
    stat, reasons, _ = me.merge(res, cur, "2026-09-02")
    assert stat["added"] == 1 and stat["rejected"] == 2
    assert len(cur["n1"]["facts"]) == 1
    assert sum(reasons.values()) == 2


def test_official_flag_is_not_forced_true():
    """OSM タグ由来の根拠を「公式情報」に化けさせない。

    化けると index の checked_count（＝トップの「公式情報で裏を取った N件」）が
    水増しされる。抽出側が official=False と申告したものは False のまま入れる。
    """
    res = [{"id": "n1", "status": "ok", "identity": "match", "facts": [
        dict(OK_FACT, official=False, url="https://www.openstreetmap.org/node/1")]}]
    cur = {}
    me.merge(res, cur, "2026-09-02")
    assert cur["n1"]["facts"][0]["official"] is False
    # 申告が無ければ従来どおり公式扱い（公式サイトからの抽出が既定の使い方）
    cur2 = {}
    me.merge([{"id": "n2", "status": "ok", "identity": "match", "facts": [OK_FACT]}], cur2, "2026-09-02")
    assert cur2["n2"]["facts"][0]["official"] is True


def test_counter_seats_takes_a_number_or_a_description():
    """カウンター席は「8席」とも「カウンター席あり」とも書かれる。

    数を強いると「あり」を捨てることになる。一人客には数より有無が効く。
    """
    q = {"quote": "カウンター席あり", "url": "https://a.jp"}
    assert me.check_fact({"k": "counter_seats", "v": 8} | q) is None
    assert me.check_fact({"k": "counter_seats", "v": "カウンター席あり"} | q) is None
    assert "数でも文でも" in me.check_fact({"k": "counter_seats", "v": ""} | q)
    # 総席数は数のまま（「たくさん」を席数として持たない）
    assert "整数" in me.check_fact({"k": "seats_total", "v": "たくさん"} | q)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
