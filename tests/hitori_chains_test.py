# -*- coding: utf-8 -*-
"""複数県チェーン検出の検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import chains


def rec(name, pref, chain=0, cat="eat"):
    return {"id": f"{name}-{pref}", "name": name, "cat": cat, "chain": chain, "_pref": pref}


def test_promotes_at_exactly_min_prefs():
    recs = [rec("来来亭", p) for p in (1, 2, 3)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 3
    assert all(r["chain"] == 1 for r in recs)


def test_no_promotion_below_min_prefs():
    recs = [rec("来来亭", p) for p in (1, 2)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0
    assert all(r["chain"] == 0 for r in recs)


def test_bath_and_stay_never_promoted():
    recs = [rec("中央図書館", p, cat="bath") for p in (1, 2, 3, 4, 5)]
    recs += [rec("〇〇温泉", p, cat="stay") for p in (1, 2, 3, 4, 5)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0
    assert all(r["chain"] == 0 for r in recs)


def test_already_chain_stays_chain():
    recs = [rec("松屋", p, chain=1) for p in (1, 2, 3)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0          # 既にchainなので昇格件数には数えない
    assert all(r["chain"] == 1 for r in recs)


def test_mixed_already_chain_and_not():
    recs = [rec("松屋", 1, chain=1), rec("松屋", 2, chain=0), rec("松屋", 3, chain=0)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 2           # 既にchainの1件は数えない、残り2件を昇格
    assert all(r["chain"] == 1 for r in recs)


def test_same_pref_repeated_is_not_promoted():
    # 同じ県内に何店舗あっても、県をまたいでいないなら個人店の可能性がある
    recs = [rec("はやしや", 1) for _ in range(10)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0
    assert all(r["chain"] == 0 for r in recs)


def test_returns_promoted_count():
    recs = [rec("来来亭", p) for p in (1, 2, 3, 4)]  # 4件とも昇格対象
    recs += [rec("はやしや", 1)]                      # 対象外(1県のみ)
    n = chains.detect_multi_pref_chains(recs)
    assert n == 4


def test_unrelated_cat_and_name_untouched():
    recs = [rec("来来亭", p) for p in (1, 2, 3)]
    other = rec("はやしや", 1)
    recs.append(other)
    chains.detect_multi_pref_chains(recs)
    assert other["chain"] == 0


def main():
    test_promotes_at_exactly_min_prefs()
    test_no_promotion_below_min_prefs()
    test_bath_and_stay_never_promoted()
    test_already_chain_stays_chain()
    test_mixed_already_chain_and_not()
    test_same_pref_repeated_is_not_promoted()
    test_returns_promoted_count()
    test_unrelated_cat_and_name_untouched()
    print("OK: chains")


if __name__ == "__main__":
    main()
