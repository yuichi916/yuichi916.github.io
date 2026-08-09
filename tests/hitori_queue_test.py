# -*- coding: utf-8 -*-
"""次に調べる施設の優先順位。

score 列を削除したときに、このテストが架空データを使っていたせいで
research_queue.py の破綻（KeyError: 'score'）を検出できなかった。
実データで動かすテストを必ず含める。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import research_queue

FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "solo", "quiet", "easy",
          "conf", "chain", "hidden", "hidden_n", "iso", "city"]


def _doc(*rows):
    return {44: {"fields": FIELDS, "items": list(rows)}}


def _row(id_, name, cat="bath", kind="sento", solo=4, quiet=4, easy=3,
         chain=0, hidden=0.0, hidden_n=2, iso=300, city="別府市"):
    return [id_, name, 33.28, 131.5, cat, kind, solo, quiet, easy,
            0, chain, hidden, hidden_n, iso, city]


def test_public_baths_rank_high():
    """公営の入浴施設は自治体が施設ページを持つので必ず当たる。先に調べる。"""
    docs = _doc(_row("n1", "市営 田の湯温泉"), _row("n2", "適当なラーメン", cat="eat", kind="ramen"))
    got = [t["id"] for t in research_queue.rank_targets(docs, {}, limit=2)]
    assert got[0] == "n1", got


def test_checked_are_excluded():
    docs = _doc(_row("n1", "市営 田の湯温泉"))
    assert research_queue.rank_targets(docs, {"n1": {"checked": "2026-08-08"}}, limit=5) == []


def test_isolated_gets_bonus():
    """しきい値はモジュールに書かず summary.json から渡す。"""
    docs = _doc(_row("n1", "ふつうの銭湯", iso=9999), _row("n2", "ふつうの銭湯2", iso=10))
    got = research_queue.rank_targets(docs, {}, limit=2, iso_threshold={"bath": 7215})
    by = {t["id"]: t["weight"] for t in got}
    assert by["n1"] > by["n2"], by
    assert "孤立" in next(t["reason"] for t in got if t["id"] == "n1")


def test_guessed_city_is_kept_separate():
    """推定した地名を所在地として出さない。

    OSMに市区町村があるのは12.2%だけで、残りは重心距離からの推定になる。
    秋保温泉共同浴場（仙台市太白区）に川崎町を当てるなど実際に外れるため、
    検索の手掛かりとしてだけ渡し、事実と混ぜない。
    """
    docs = _doc(_row("n1", "町営公衆浴場", city=""))
    munis = [("網走市", 44.02, 144.27, 44), ("別府市", 33.28, 131.49, 44)]
    got = research_queue.rank_targets(docs, {}, limit=1, munis=munis)
    assert got[0]["city"] == "", got[0]
    assert got[0]["city_guess"] == "別府市", got[0]


def test_real_city_is_not_overwritten_by_guess():
    docs = _doc(_row("n1", "田の湯温泉", city="別府市"))
    got = research_queue.rank_targets(docs, {}, limit=1, munis=[("網走市", 44.02, 144.27, 1)])
    assert got[0]["city"] == "別府市"
    assert got[0]["city_guess"] == ""


def test_axes_are_reported_not_score():
    docs = _doc(_row("n1", "市営 田の湯温泉", solo=4, quiet=4, easy=3))
    t = research_queue.rank_targets(docs, {}, limit=1)[0]
    assert t["axes"] == [4, 4, 3], t
    assert "score" not in t


def test_runs_on_real_data():
    """架空データだけだと列名の変更に気づけない（score 削除時に実際に見逃した）。"""
    docs = {}
    for f in sorted((ROOT / "data" / "hitori" / "pref").glob("*.json"))[:3]:
        docs[int(f.stem)] = json.loads(f.read_text(encoding="utf-8"))
    summary = json.loads((ROOT / "data" / "hitori" / "summary.json").read_text(encoding="utf-8"))
    got = research_queue.rank_targets(docs, {}, limit=10,
                                      iso_threshold=summary.get("iso_threshold"),
                                      munis=research_queue._load_municipalities())
    assert len(got) == 10, len(got)
    assert all(t["id"] and (t["city"] or t["city_guess"]) for t in got)



def test_yield_bonus_prefers_kinds_that_actually_hit():
    """当たらない対象に時間を使わない。

    実測で温泉91%・ゲストハウス93%に対し、そば55%・ラーメン51%だった。
    田舎の小規模飲食店は食べログ以外に情報源がほとんど無く、そこは
    自動アクセスが禁止されている。
    """
    docs = _doc(_row("n1", "どこかの温泉", cat="bath", kind="onsen"),
                _row("n2", "どこかのラーメン", cat="eat", kind="ramen"))
    got = research_queue.rank_targets(docs, {}, limit=2)
    by = {t["id"]: t["weight"] for t in got}
    assert by["n1"] > by["n2"], by
    assert got[0]["id"] == "n1", [t["id"] for t in got]


def test_yield_bonus_does_not_erase_other_signals():
    """当たりやすさだけで並べない。孤立や公営のほうが重い。"""
    docs = _doc(_row("n1", "ふつうの温泉", cat="bath", kind="onsen", iso=10),
                _row("n2", "市営 どこかの湯", cat="bath", kind="sento", iso=9999))
    got = research_queue.rank_targets(docs, {}, limit=2, iso_threshold={"bath": 7215})
    assert got[0]["id"] == "n2", [(t["id"], t["weight"], t["reason"]) for t in got]

def main():
    test_public_baths_rank_high()
    test_checked_are_excluded()
    test_isolated_gets_bonus()
    test_guessed_city_is_kept_separate()
    test_real_city_is_not_overwritten_by_guess()
    test_axes_are_reported_not_score()
    test_runs_on_real_data()
    test_yield_bonus_prefers_kinds_that_actually_hit()
    test_yield_bonus_does_not_erase_other_signals()
    print("OK: research_queue")


if __name__ == "__main__":
    main()
