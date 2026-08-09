# -*- coding: utf-8 -*-
"""OSM要素→施設レコードの正規化と重複除去の検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import normalize


def test_element_id():
    assert normalize.element_id({"type": "node", "id": 123}) == "n123"
    assert normalize.element_id({"type": "way", "id": 456}) == "w456"
    assert normalize.element_id({"type": "relation", "id": 789}) == "r789"


def test_distance_m():
    # 東京駅と有楽町駅はおよそ800m
    d = normalize.distance_m(35.6812, 139.7671, 35.6749, 139.7630)
    assert 600 < d < 1000, d
    # 同一点は0
    assert normalize.distance_m(35.0, 139.0, 35.0, 139.0) < 0.001
    # 緯度35度で経度0.00033度はおよそ30m
    d2 = normalize.distance_m(35.0, 139.0, 35.0, 139.00033)
    assert 25 < d2 < 35, d2


def test_to_record_node():
    el = {"type": "node", "id": 1, "lat": 35.65894, "lon": 139.70043,
          "tags": {"amenity": "restaurant", "name": "一蘭 渋谷店", "cuisine": "ramen",
                   "addr:city": "渋谷区", "opening_hours": "11:00-23:00"}}
    r = normalize.to_record(el, {})
    assert r["id"] == "n1"
    assert r["cat"] == "eat" and r["kind"] == "ramen"
    assert r["solo"] == 5 and r["quiet"] == 4 and r["easy"] == 3
    assert r["chain"] == 1 and r["conf"] == 0
    assert r["city"] == "渋谷区" and r["oh"] == "11:00-23:00"
    assert r["hidden"] == 0.0 and r["hidden_n"] == 0
    assert r["iso"] == 0


def test_to_record_way_uses_center():
    el = {"type": "way", "id": 2, "center": {"lat": 35.1, "lon": 139.2},
          "tags": {"amenity": "public_bath", "name": "はやし湯"}}
    r = normalize.to_record(el, {})
    assert r["lat"] == 35.1 and r["lon"] == 139.2
    assert r["cat"] == "bath" and r["kind"] == "sento" and r["solo"] == 4
    assert r["chain"] == 0


def test_to_record_rounds_coords():
    el = {"type": "node", "id": 3, "lat": 35.123456789, "lon": 139.987654321,
          "tags": {"amenity": "library", "name": "○○図書館"}}
    r = normalize.to_record(el, {})
    assert r["lat"] == 35.12346 and r["lon"] == 139.98765


def test_to_record_rejects():
    # 名前なしは収録しない
    assert normalize.to_record(
        {"type": "node", "id": 4, "lat": 35.0, "lon": 139.0,
         "tags": {"amenity": "public_bath"}}, {}) is None
    # 業態が対象外
    assert normalize.to_record(
        {"type": "node", "id": 5, "lat": 35.0, "lon": 139.0,
         "tags": {"amenity": "restaurant", "name": "居酒屋", "cuisine": "izakaya"}}, {}) is None
    # 座標なし
    assert normalize.to_record(
        {"type": "way", "id": 6, "tags": {"amenity": "library", "name": "○○図書館"}}, {}) is None


def test_to_record_drops_low_solo():
    # spec §5 の収録条件。solo が3を割ったら収録しない。
    # v1 ではこの条件が強制されておらず、否定エビデンスの付いた施設が残っていた。
    el = {"type": "node", "id": 8, "lat": 35.0, "lon": 139.0,
          "tags": {"tourism": "hostel", "name": "○○ゲストハウス"}}   # 業態ベース solo=3
    assert normalize.to_record(el, {}) is not None

    neg = {"n8": {"evidence": [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]}}
    assert normalize.to_record(el, neg) is None, "solo=2 の施設が収録されている"

    # curated で明示的に下げた場合も同じ
    assert normalize.to_record(el, {"n8": {"solo": 1}}) is None

    # solo=3 ちょうどは収録する（境界）
    assert normalize.to_record(el, {"n8": {"solo": 3}}) is not None


def test_to_record_curated():
    el = {"type": "node", "id": 7, "lat": 35.0, "lon": 139.0,
          "tags": {"amenity": "public_bath", "name": "はやし湯"}}
    curated = {"n7": {
        "note": "黙浴の掲示あり",
        "chain": 1,
        "evidence": [{"src": "user", "id": "gh-issue-42", "checked": "2026-08-01", "polarity": "+"}],
    }}
    r = normalize.to_record(el, curated)
    assert r["solo"] == 5      # base4 + 肯定エビデンス
    assert r["conf"] == 2       # user 由来
    assert r["chain"] == 1      # curated の明示指定
    assert r["note"] == "黙浴の掲示あり"

    # excluded は収録しない
    assert normalize.to_record(el, {"n7": {"excluded": True}}) is None


def test_dedupe():
    a = {"id": "n1", "name": "はやし湯", "lat": 35.00000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "solo": 4, "quiet": 4, "easy": 3, "conf": 0, "chain": 0, "note": ""}
    b = {"id": "w2", "name": "はやし湯", "lat": 35.00010, "lon": 139.00010,
         "cat": "bath", "kind": "sento", "solo": 4, "quiet": 4, "easy": 3, "conf": 0, "chain": 0, "note": ""}
    c = {"id": "n3", "name": "はやし湯", "lat": 35.50000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "solo": 4, "quiet": 4, "easy": 3, "conf": 0, "chain": 0, "note": ""}
    d = {"id": "n4", "name": "べつの湯", "lat": 35.00000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "solo": 4, "quiet": 4, "easy": 3, "conf": 0, "chain": 0, "note": ""}

    out = normalize.dedupe([a, b, c, d])
    ids = sorted(r["id"] for r in out)
    # a と b は同名30m以内なので統合され、way 側(w2)が残る
    assert ids == ["n3", "n4", "w2"], ids
    # 離れた同名(c)と、同一地点の別名(d)は残る
    assert len(out) == 3



def test_disused_facilities_are_excluded():
    """OSM が「もう無い」と言っている施設を載せない。行っても何も無い。"""
    assert normalize.is_gone({"disused:amenity": "restaurant"})
    assert normalize.is_gone({"abandoned:shop": "yes"})
    assert normalize.is_gone({"removed:amenity": "library"})
    assert normalize.is_gone({"operational_status": "closed"})
    assert normalize.to_record(
        {"type": "node", "id": 1, "lat": 35.0, "lon": 139.0,
         "tags": {"disused:amenity": "restaurant", "name": "元ラーメン屋",
                  "cuisine": "ramen"}}, {}) is None


def test_was_name_is_not_a_closure():
    """was:name は旧店名の記録で、閉業を意味しない。

    実測で was:name が8件あり、これを閉業扱いすると営業中の店が消える。
    disused:phone（使われなくなった番号）も同じ。
    """
    assert not normalize.is_gone({"was:name": "旧スタミナ軒", "amenity": "restaurant"})
    assert not normalize.is_gone({"disused:phone": "000", "amenity": "public_bath"})
    assert not normalize.is_gone({"disused:name:ja": "旧称", "amenity": "restaurant"})
    got = normalize.to_record(
        {"type": "node", "id": 2, "lat": 35.0, "lon": 139.0,
         "tags": {"was:name": "旧スタミナ軒", "amenity": "restaurant",
                  "name": "今の店", "cuisine": "ramen"}}, {})
    assert got is not None and got["name"] == "今の店"

def main():
    test_element_id()
    test_distance_m()
    test_to_record_node()
    test_to_record_way_uses_center()
    test_to_record_rounds_coords()
    test_to_record_rejects()
    test_to_record_drops_low_solo()
    test_to_record_curated()
    test_dedupe()
    test_disused_facilities_are_excluded()
    test_was_name_is_not_a_closure()
    print("OK: normalize")


if __name__ == "__main__":
    main()
