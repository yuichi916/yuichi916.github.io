# -*- coding: utf-8 -*-
"""事実の語彙と、軸への反映。

軸は上書きせず推定値からの差分にする。1つの事実で3から5へ飛ぶのは
根拠に対して主張が強すぎるので、軸ごとに±2で頭打ちにする。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import enrich


def test_normalize_domain():
    assert enrich.normalize_domain("https://www.city.beppu.oita.jp/sisetu/x.html") == "city.beppu.oita.jp"
    assert enrich.normalize_domain("http://danish.hateblo.jp/entry/1") == "danish.hateblo.jp"
    assert enrich.normalize_domain("https://NOTE.com/abc") == "note.com"


def test_blocked_domains():
    for u in ("https://tabelog.com/oita/x", "https://sauna-ikitai.com/y", "https://retty.me/z"):
        assert enrich.is_blocked(u), u
    assert not enrich.is_blocked("https://city.beppu.oita.jp/x")


def test_vocab_rejects_unknown():
    assert enrich.valid_fact("payment_method", "ticket_machine")
    assert not enrich.valid_fact("payment_method", "なんとなく親切")
    assert not enrich.valid_fact("親切さ", "high")
    assert enrich.valid_fact("counter_seats", 6)
    assert not enrich.valid_fact("counter_seats", "6席")
    assert not enrich.valid_fact("counter_seats", -1)


def test_adjust_direction():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    tm = [{"k": "payment_method", "v": "ticket_machine", "n": 2}]
    assert enrich.apply_adjust(est, tm)["easy"] == 4
    cp = [{"k": "payment_method", "v": "counter_person", "n": 2}]
    assert enrich.apply_adjust(est, cp)["easy"] == 2


def test_support_below_two_does_not_move():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    one = [{"k": "payment_method", "v": "ticket_machine", "n": 1}]
    assert enrich.apply_adjust(est, one) == est


def test_official_counts_for_factual_fields_only():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    # price は軸に効かないが、公式1件で採用されること自体は curate 側の話。
    # 軸に効く事実は公式1件でも動かさない（主観を含むため）。
    f = [{"k": "clientele", "v": "local", "n": 1, "official": True}]
    assert enrich.apply_adjust(est, f) == est


def test_adjust_is_capped():
    est = {"solo": 4, "quiet": 3, "easy": 3}
    many = [
        {"k": "payment_method", "v": "ticket_machine", "n": 3},
        {"k": "reservation", "v": "none", "n": 3},
        {"k": "first_timer", "v": "easy", "n": 3},
    ]
    out = enrich.apply_adjust(est, many)
    assert out["easy"] == 5, out          # 3 + 2（上限）
    assert out["easy"] - est["easy"] <= enrich.MAX_ADJUST


def test_adjust_stays_in_range():
    est = {"solo": 3, "quiet": 5, "easy": 2}
    f = [{"k": "payment_method", "v": "counter_person", "n": 2},
         {"k": "clientele", "v": "local", "n": 2},
         {"k": "silence", "v": "posted", "n": 2}]
    out = enrich.apply_adjust(est, f)
    assert out["easy"] == 1, out          # 2 - 2 だが1で下限
    assert out["quiet"] == 5, out         # 5 が上限
    for k, v in out.items():
        assert 1 <= v <= 5, (k, v)


def test_conflict_freezes_the_axis():
    """相反する事実があるとその軸を動かさない。どちらかを選ばない。"""
    est = {"solo": 4, "quiet": 4, "easy": 3}
    f = [{"k": "payment_method", "v": "ticket_machine", "n": 2},
         {"k": "payment_method", "v": "counter_person", "n": 2}]
    assert enrich.apply_adjust(est, f)["easy"] == 3


def test_does_not_mutate_input():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    before = dict(est)
    enrich.apply_adjust(est, [{"k": "payment_method", "v": "ticket_machine", "n": 2}])
    assert est == before


def test_exclusion_needs_support():
    """一覧から外すのは重い判断なので、裏付け1件では外さない。"""
    assert enrich.exclusion_reason([{"k": "access", "v": "residents_only", "n": 2}]) == "地元住民専用"
    assert enrich.exclusion_reason([{"k": "access", "v": "residents_only", "n": 1}]) is None
    assert enrich.exclusion_reason([{"k": "access", "v": "members_only", "n": 2}]) == "会員専用"
    assert enrich.exclusion_reason([{"k": "status", "v": "closed_permanently", "n": 3}]) == "閉業"


def test_temporary_closure_does_not_exclude():
    """一時休業は外さない。再開するので、消すのではなく出して伝える。"""
    assert enrich.exclusion_reason([{"k": "status", "v": "closed_temporarily", "n": 3}]) is None


def test_conflict_does_not_exclude():
    """情報が分かれているときは外さない。判断を保留する側に倒す。"""
    f = [{"k": "access", "v": "residents_only", "n": 2},
         {"k": "access", "v": "public", "n": 2}]
    assert enrich.exclusion_reason(f) is None


def test_normal_facility_is_not_excluded():
    assert enrich.exclusion_reason([{"k": "payment_method", "v": "ticket_machine", "n": 3}]) is None
    assert enrich.exclusion_reason([]) is None


def test_new_vocab_is_validated():
    assert enrich.valid_fact("access", "residents_only")
    assert not enrich.valid_fact("access", "だれでも")
    assert enrich.valid_fact("status", "closed_temporarily")
    assert enrich.valid_fact("renamed_to", "喜楽来の湯")
    assert not enrich.valid_fact("renamed_to", "")


def test_open_period_is_recorded_but_never_excludes():
    """「不定期営業」は閉業ではない。一覧から外してはならない。

    後生掛温泉 湯治部は公式が「期間限定・不定期での営業」と書いている。
    閉業でも休業でもないので status では表せず、これまで捨てていた。
    """
    assert enrich.valid_fact("open_period", "irregular")
    assert enrich.valid_fact("open_period", "seasonal")
    assert enrich.valid_fact("open_period", "by_appointment")
    assert enrich.valid_fact("open_period", "year_round")
    assert not enrich.valid_fact("open_period", "sometimes")

    facts = [{"k": "open_period", "v": "irregular", "n": 3,
              "src": ["a", "b", "c"], "urls": [], "official": True, "conflict": False}]
    assert enrich.exclusion_reason(facts) is None, "不定期営業で一覧から外してはならない"


def test_open_period_does_not_move_the_axes():
    """営業日の話は「一人で行きやすいか」とは別。軸を動かさない。"""
    est = {"solo": 4, "quiet": 4, "easy": 3}
    facts = [{"k": "open_period", "v": "seasonal", "n": 2,
              "src": ["a", "b"], "urls": [], "official": True, "conflict": False}]
    assert enrich.apply_adjust(est, facts) == est


def main():
    test_normalize_domain()
    test_blocked_domains()
    test_vocab_rejects_unknown()
    test_adjust_direction()
    test_support_below_two_does_not_move()
    test_official_counts_for_factual_fields_only()
    test_adjust_is_capped()
    test_adjust_stays_in_range()
    test_conflict_freezes_the_axis()
    test_does_not_mutate_input()
    test_exclusion_needs_support()
    test_temporary_closure_does_not_exclude()
    test_conflict_does_not_exclude()
    test_normal_facility_is_not_excluded()
    test_new_vocab_is_validated()
    test_open_period_is_recorded_but_never_excludes()
    test_open_period_does_not_move_the_axes()
    print("OK: enrich")


if __name__ == "__main__":
    main()
