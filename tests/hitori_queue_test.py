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

def _entry(*facts):
    return {"checked": "2026-08-10", "facts": [
        {"k": k, "v": v, "n": len(src), "src": list(src), "urls": [],
         "official": False, "conflict": False} for k, v, src in facts]}


def test_coverage_counts_domains_and_personal_records():
    """公式だけで固めた施設と、個人の記録がある施設を区別できること。"""
    only_official = _entry(("price", 400, ["city.example.jp"]))
    assert research_queue.coverage(only_official) == (1, 0)
    with_blog = _entry(("price", 400, ["city.example.jp", "ameblo.jp"]),
                       ("wash_area", "yes", ["ameblo.jp"]))
    assert research_queue.coverage(with_blog) == (2, 1)


def test_deepen_prefers_the_thinnest():
    """情報源1件の施設が、3件そろっている施設より先に来ること。"""
    docs = _doc(_row("n1", "薄い湯"), _row("n2", "厚い湯"))
    curated = {
        "n1": _entry(("price", 400, ["a.jp"])),
        "n2": _entry(("price", 400, ["a.jp", "b.jp", "ameblo.jp"]),
                     ("payment_method", "ticket_machine", ["ameblo.jp"]),
                     ("wash_area", "yes", ["b.jp"]),
                     ("bring_towel", "required", ["a.jp"]),
                     ("luggage", "locker", ["b.jp"]),
                     ("busy_time", "usually_quiet", ["ameblo.jp"]),
                     ("first_timer", "easy", ["ameblo.jp"])),
    }
    out = research_queue.rank_deepen(docs, curated, limit=10)
    assert [t["id"] for t in out][0] == "n1", out
    assert "情報源1件のみ" in out[0]["reason"]


def test_deepen_flags_missing_personal_record_even_when_domains_suffice():
    """公式3件でも、個人の記録が無ければ掘り下げ対象にすること。

    番台か券売機か、洗い場があるか、常連ばかりかは公式には載らない。
    """
    docs = _doc(_row("n1", "公式だけの湯"))
    curated = {"n1": _entry(("price", 400, ["a.jp", "b.jp", "c.jp"]),
                            ("payment_method", "ticket_machine", ["a.jp"]),
                            ("wash_area", "yes", ["a.jp"]),
                            ("bring_towel", "required", ["a.jp"]),
                            ("luggage", "locker", ["a.jp"]),
                            ("busy_time", "usually_quiet", ["a.jp"]),
                            ("first_timer", "easy", ["a.jp"]))}
    out = research_queue.rank_deepen(docs, curated, limit=10)
    assert len(out) == 1 and "個人の記録なし" in out[0]["reason"], out


def test_deepen_skips_facilities_that_left_the_list():
    """除外された施設を掘り下げても一覧には出ない。対象にしない。"""
    docs = _doc(_row("n1", "残っている湯"))
    curated = {"n1": _entry(("price", 400, ["a.jp"])),
               "n9": _entry(("price", 400, ["a.jp"]))}
    out = research_queue.rank_deepen(docs, curated, limit=10)
    assert [t["id"] for t in out] == ["n1"], out


def test_deepen_leaves_well_covered_facilities_alone():
    """厚い施設だけなら対象は空。空振りの再調査に時間を使わせない。"""
    docs = _doc(_row("n1", "厚い湯", kind="ramen"))
    curated = {"n1": _entry(("price", 400, ["a.jp", "b.jp", "ameblo.jp"]),
                            ("payment_method", "ticket_machine", ["ameblo.jp"]),
                            ("wash_area", "yes", ["b.jp"]),
                            ("bring_towel", "required", ["a.jp"]),
                            ("luggage", "locker", ["b.jp"]),
                            ("busy_time", "usually_quiet", ["ameblo.jp"]),
                            ("first_timer", "easy", ["ameblo.jp"]))}
    assert research_queue.rank_deepen(docs, curated, limit=10) == []


def test_deepen_runs_on_real_data():
    """実データで落ちないこと。fixture だけのテストは前に破綻を見逃した。"""
    pref_dir = ROOT / "data" / "hitori" / "pref"
    if not pref_dir.exists():
        return
    docs = {int(f.stem): json.loads(f.read_text(encoding="utf-8"))
            for f in sorted(pref_dir.glob("*.json"))}
    curated = json.loads((ROOT / "data" / "hitori" / "curated.json").read_text(encoding="utf-8"))
    out = research_queue.rank_deepen(docs, curated, limit=20)
    assert out, "実データで掘り下げ対象が1件も出ない"
    for t in out:
        assert t["id"] in curated
        assert t["weight"] > 0 and t["reason"]


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
    test_coverage_counts_domains_and_personal_records()
    test_deepen_prefers_the_thinnest()
    test_deepen_flags_missing_personal_record_even_when_domains_suffice()
    test_deepen_skips_facilities_that_left_the_list()
    test_deepen_leaves_well_covered_facilities_alone()
    test_deepen_runs_on_real_data()
    print("OK: research_queue")


if __name__ == "__main__":
    main()
