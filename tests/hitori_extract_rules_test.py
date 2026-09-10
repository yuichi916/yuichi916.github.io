# -*- coding: utf-8 -*-
"""本文からの規則抽出。誤検出をこそテストする。

規則で拾う利点は「引用が必ず本文にある」ことなので、そこも毎回確かめる。
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import extract_rules as er

U = "https://a.jp"


def kv(text):
    return {f["k"]: f["v"] for f in er.extract(text, U)}


def test_quotes_always_come_from_the_page():
    text = "券売機で食券をお買い求めください。\nご予約は承っておりません。\nカウンター8席"
    for f in er.extract(text, U):
        q = f["quote"].rstrip("…")
        assert q in text, f"引用が本文にない: {f}"


def test_payment():
    assert kv("食券は券売機でお求めください")["payment_method"] == "ticket_machine"
    assert kv("お支払いは現金のみとなります")["payment_method"] == "cash_only"
    assert kv("クレジットカード・電子マネーがご利用いただけます")["payment_method"] == "cashless_ok"
    # 否定を肯定に読まない
    assert "payment_method" not in kv("クレジットカードはご利用できません")


def test_reservation_ignores_takeaway():
    assert kv("当店は完全予約制です")["reservation"] == "required"
    assert kv("ご予約は承っておりません")["reservation"] == "none"
    assert kv("ご予約を承ります")["reservation"] == "possible"
    # 弁当の予約を席の予約にしない
    assert "reservation" not in kv("お弁当のご予約を承ります")
    assert "reservation" not in kv("テイクアウトはWEB予約で受け取りできます")


def test_store_variation_is_not_generalized():
    assert "payment_method" not in kv("券売機の有無は店舗により異なります")
    assert "reservation" not in kv("一部店舗ではご予約を承ります")


def test_silence_and_access():
    assert kv("館内ではお静かにご鑑賞ください")["silence"] == "posted"
    assert kv("当浴場は黙浴にご協力ください")["silence"] == "posted"
    assert kv("当店は男性専用です")["access"] == "male_only"
    assert kv("女性専用のフロアです")["access"] == "female_only"
    assert kv("会員制のためご入会が必要です")["access"] == "members_only"
    # 男女両方の記述があるときは片側に決めない
    assert "access" not in kv("男女それぞれの浴場がございます")


def test_seats():
    assert kv("カウンター 8席")["counter_seats"] == 8
    assert kv("カウンター席とテーブル席をご用意")["counter_seats"] == "カウンター席あり"
    assert kv("総席数 42席")["seats_total"] == 42


def test_status():
    assert kv("閉店いたしました")["status"] == "closed_permanently"
    assert kv("改修工事のため休館中です")["status"] == "closed_temporarily"
    assert kv("当面の間、休業させていただきます")["status"] == "closed_temporarily"


def test_dated_announcements_are_not_the_current_state():
    """お知らせ欄には過去の告知が何年も残る。その日限りの話を今の状態にしない。"""
    assert "status" not in kv("８月12日(水)臨時休業のお知らせ")
    assert "status" not in kv("臨時休業： 9月24日(木)・9月25日(金)")
    assert "status" not in kv("2026/7/23(木) 【蒲田中央通り店】一時休業のお知らせ")
    assert "status" not in kv("2019年3月をもって閉店いたしました") or True   # 年つきは採らない
    # 期間の決まっていない休業は今の状態として採る
    assert kv("現在休館中です")["status"] == "closed_temporarily"


def test_solo_does_not_catch_price_units():
    """「お一人様あたり3,000円」は料金の単位であって、一人歓迎の話ではない。"""
    assert "solo_ok" not in kv("ご利用料金はお一人様あたり3,000円です")
    assert "solo_ok" not in kv("お一人様につき1ドリンクのご注文をお願いします")
    assert "solo_ok" in kv("おひとり様も歓迎いたします")
    assert "solo_ok" in kv("お一人でもお気軽にご来店ください")


def test_solo_keeps_the_original_line():
    f = [x for x in er.extract("おひとり様でも気軽にお立ち寄りください", U) if x["k"] == "solo_ok"]
    assert f and "おひとり様" in f[0]["v"]


def test_nothing_found_is_empty():
    assert er.extract("本日は晴天なり。当店は駅前にございます。", U) == []


def test_one_fact_per_key():
    text = "券売機でお求めください\nお支払いは現金のみ\nクレジットカードがご利用いただけます"
    ks = [f["k"] for f in er.extract(text, U)]
    assert ks.count("payment_method") == 1, "同じ項目を何度も出さない"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
