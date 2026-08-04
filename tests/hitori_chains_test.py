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
    # 3県ちょうど・件数はmin_records(5)を満たす
    recs = [rec("来来亭", p) for p in (1, 1, 2, 2, 3)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 5
    assert all(r["chain"] == 1 for r in recs)


def test_no_promotion_below_min_prefs():
    # 件数は5件あるが2県にしかまたがっていない
    recs = [rec("来来亭", p) for p in (1, 1, 1, 2, 2)]
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
    recs = [rec("松屋", 1, chain=1), rec("松屋", 2, chain=0),
            rec("松屋", 3, chain=0), rec("松屋", 3, chain=0), rec("松屋", 3, chain=0)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 4           # 既にchainの1件は数えない、残り4件を昇格
    assert all(r["chain"] == 1 for r in recs)


def test_same_pref_repeated_is_not_promoted():
    # 同じ県内に何店舗あっても、県をまたいでいないなら個人店の可能性がある
    recs = [rec("はやしや", 1) for _ in range(10)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0
    assert all(r["chain"] == 0 for r in recs)


def test_returns_promoted_count():
    recs = [rec("来来亭", p) for p in (1, 2, 3, 4, 5)]  # 5件とも昇格対象
    recs += [rec("はやしや", 1)]                          # 対象外(1県のみ)
    n = chains.detect_multi_pref_chains(recs)
    assert n == 5


def test_unrelated_cat_and_name_untouched():
    recs = [rec("来来亭", p) for p in (1, 2, 3, 4, 5)]
    other = rec("はやしや", 1)
    recs.append(other)
    chains.detect_multi_pref_chains(recs)
    assert other["chain"] == 0


def test_below_min_records_not_promoted():
    # 3県にまたがるが総件数4件。ありふれた店名の個人店3〜4軒が偶然
    # 同名なだけの可能性があるため、県数だけでは昇格させない。
    recs = [rec("庵", 1), rec("庵", 2), rec("庵", 3), rec("庵", 3)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 0
    assert all(r["chain"] == 0 for r in recs)


def test_at_min_records_is_promoted():
    # 同じ3県のまま5件目が増えると、展開規模とみなして昇格する
    recs = [rec("庵", 1), rec("庵", 2), rec("庵", 3), rec("庵", 3), rec("庵", 3)]
    n = chains.detect_multi_pref_chains(recs)
    assert n == 5
    assert all(r["chain"] == 1 for r in recs)


def test_different_categories_stay_separate():
    # 同名の飲食店(5件/5県)と娯楽施設(2件/2県)が偶然重なっても合算しない。
    # name だけでグルーピングするバグがあれば、件数・県数ともに条件を
    # 満たしてしまい play 側も誤って昇格する。
    eat_recs = [rec("三浦屋", p, cat="eat") for p in (1, 2, 3, 4, 5)]
    play_recs = [rec("三浦屋", p, cat="play") for p in (1, 2)]
    n = chains.detect_multi_pref_chains(eat_recs + play_recs)
    assert n == 5
    assert all(r["chain"] == 1 for r in eat_recs)
    assert all(r["chain"] == 0 for r in play_recs)


def main():
    test_promotes_at_exactly_min_prefs()
    test_no_promotion_below_min_prefs()
    test_bath_and_stay_never_promoted()
    test_already_chain_stays_chain()
    test_mixed_already_chain_and_not()
    test_same_pref_repeated_is_not_promoted()
    test_returns_promoted_count()
    test_unrelated_cat_and_name_untouched()
    test_below_min_records_not_promoted()
    test_at_min_records_is_promoted()
    test_different_categories_stay_separate()
    print("OK: chains")


if __name__ == "__main__":
    main()
