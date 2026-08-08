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
    print("OK: enrich")


if __name__ == "__main__":
    main()
