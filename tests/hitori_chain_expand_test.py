# -*- coding: utf-8 -*-
"""チェーンの事実を全店に展開するときの当て方。巻き込みをこそテストする。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import chain_expand as ce


def test_store_suffix_is_matched():
    assert ce.belongs("快活CLUB函館昭和店", "快活CLUB")
    assert ce.belongs("快活CLUB", "快活CLUB")
    assert ce.belongs("ラーメン大桜 横浜店", "ラーメン大桜")


def test_space_differences_are_absorbed():
    assert ce.belongs("カラオケまねきねこ", "カラオケ まねきねこ")
    assert ce.belongs("カラオケ まねきねこ苫小牧駅前店", "カラオケまねきねこ")


def test_unrelated_shops_are_not_swept_in():
    # 前方一致だけにすると「金太郎」が「金太郎寿司」を巻き込む
    assert not ce.belongs("金太郎寿司", "金太郎")
    assert not ce.belongs("味噌ラーメン山岡家", "ラーメン山岡家")
    assert not ce.belongs("快活", "快活CLUB")
    assert not ce.belongs("すき焼き まる", "すき家")


def test_only_spreadable_keys_go_out():
    chain = [{"chain": "A", "stores": 2, "facts": [
        {"k": "payment_method", "v": "ticket_machine", "quote": "券売機", "url": "https://a.jp"},
        {"k": "hours", "v": "10:00-20:00", "quote": "10:00-20:00", "url": "https://a.jp"},
    ]}]
    res, spread, _ = ce.expand(chain, [("A 東京店", "n1"), ("A", "n2"), ("B", "n3")])
    assert {r["id"] for r in res} == {"n1", "n2"}
    ks = {f["k"] for r in res for f in r["facts"]}
    assert ks == {"payment_method"}, "営業時間は店舗差が出るので広げない"
    assert spread == 2


def test_spread_facts_are_marked_as_chain_wide():
    chain = [{"chain": "A", "facts": [
        {"k": "access", "v": "members_only", "quote": "全店会員制", "url": "https://a.jp"}]}]
    res, _, _ = ce.expand(chain, [("A 大阪店", "n9")])
    f = res[0]["facts"][0]
    assert f["scope"] == "chain", "その店舗を確かめたことにはならない"
    assert f["official"] is False, "店舗単位の公式確認と同じ扱いにしない"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
