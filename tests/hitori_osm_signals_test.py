# -*- coding: utf-8 -*-
"""OSM タグ → ひとりチェックの信号。書いていないことを言わせない検査。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import osm_signals as os_


def kv(facts):
    return {f["k"]: f["v"] for f in facts}


def test_cashless_only_when_a_cashless_tag_is_yes():
    assert kv(os_.signals_from_tags({"payment:visa": "yes"}))["payment_method"] == "cashless_ok"
    # 現金のタグだけでは「現金のみ」と言えない（カードのタグが無いことは証拠にならない）
    assert "payment_method" not in kv(os_.signals_from_tags({"payment:cash": "yes"}))
    assert "payment_method" not in kv(os_.signals_from_tags({"payment:visa": "no"}))


def test_reservation_vocabulary_is_mapped_not_invented():
    assert kv(os_.signals_from_tags({"reservation": "required"}))["reservation"] == "required"
    assert kv(os_.signals_from_tags({"reservation": "no"}))["reservation"] == "none"
    assert kv(os_.signals_from_tags({"reservation": "recommended"}))["reservation"] == "possible"
    assert "reservation" not in kv(os_.signals_from_tags({"reservation": "maybe"}))


def test_capacity_is_seats_only_where_it_means_seats():
    assert kv(os_.signals_from_tags({"capacity": "39"}, "eat"))["seats_total"] == 39
    # 宿の capacity は部屋数のことが多いので席にしない
    assert "seats_total" not in kv(os_.signals_from_tags({"capacity": "39"}, "stay"))
    assert "seats_total" not in kv(os_.signals_from_tags({"capacity": "たくさん"}, "eat"))
    assert "seats_total" not in kv(os_.signals_from_tags({"capacity": "0"}, "eat"))


def test_gender_restriction_needs_to_be_one_sided():
    assert kv(os_.signals_from_tags({"male": "yes"}))["access"] == "male_only"
    assert kv(os_.signals_from_tags({"female": "yes"}))["access"] == "female_only"
    assert "access" not in kv(os_.signals_from_tags({"male": "yes", "female": "yes"}))


def test_quote_records_the_tag_itself_and_is_not_official():
    f = os_.signals_from_tags({"payment:suica": "yes"})[0]
    assert "payment:suica=yes" in f["quote"]
    assert os_.osm_url({"type": "way", "id": 12}) == "https://www.openstreetmap.org/way/12"


def test_no_tags_no_facts():
    assert os_.signals_from_tags({"name": "そば処", "cuisine": "soba"}) == []


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
