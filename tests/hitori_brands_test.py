# -*- coding: utf-8 -*-
"""ブランド単位の判定を全施設へ展開する仕組み。

チェーンが丸ごと畳まれると、施設を1軒ずつ調べる方式では取りこぼす。
瀬戸うどん（ゼンショーHD）は2025年10月16日に全店閉店していたのに、
4件が営業中として残っていた。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import brands


def test_expand_covers_every_matching_facility():
    rulings = {"瀬戸うどん": {"checked": "2026-08-08",
                            "facts": [{"k": "status", "v": "closed_permanently",
                                       "urls": ["https://a.example/", "https://b.example/"]}]}}
    by_name = {"瀬戸うどん": ["n1", "n2", "n3"]}
    out = brands.expand(rulings, by_name)
    assert [e["id"] for e in out] == ["n1", "n2", "n3"], out
    assert all(e["facts"][0]["v"] == "closed_permanently" for e in out)


def test_expand_does_not_share_fact_objects():
    """同じ dict を使い回すと、後段の加工が全施設に波及する。"""
    rulings = {"X": {"checked": "2026-08-08",
                     "facts": [{"k": "status", "v": "open", "urls": ["https://a/"]}]}}
    out = brands.expand(rulings, {"X": ["n1", "n2"]})
    out[0]["facts"][0]["v"] = "closed_permanently"
    assert out[1]["facts"][0]["v"] == "open", "事実オブジェクトを共有している"


def test_matching_is_exact_not_partial():
    """部分一致にすると無関係な独立店を巻き込む。

    chains.py が前置き一致を却下したのと同じ理由。「そば処 おかあやん」の
    ような店を「そば」で拾ってはいけない。
    """
    src = brands.facilities_by_name.__doc__ or ""
    assert "完全一致" in src, "完全一致であることが明記されていない"

    got = brands.facilities_by_name({"瀬戸うどん"})
    names = set()
    for f in sorted((ROOT / "data" / "hitori" / "pref").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        ni, idi = d["fields"].index("name"), d["fields"].index("id")
        for r in d["items"]:
            if r[idi] in got["瀬戸うどん"]:
                names.add(r[ni])
    assert names <= {"瀬戸うどん"}, f"完全一致でない施設を拾っている: {names}"


def test_rulings_have_two_sources_for_removal():
    """数百件を一斉に消す判断なので、閉業・改称は出典2件以上を要求する。"""
    p = ROOT / "data" / "hitori" / "brand_rulings.json"
    if not p.exists():
        return
    r = json.loads(p.read_text(encoding="utf-8"))
    for brand, ruling in r.items():
        for f in ruling["facts"]:
            if f["v"] in ("closed_permanently", "residents_only", "members_only"):
                doms = {u.split("/")[2] for u in f["urls"]}
                assert len(doms) >= 2, f"{brand}: {f['v']} の出典が {len(doms)} ドメインしかない"


def main():
    test_expand_covers_every_matching_facility()
    test_expand_does_not_share_fact_objects()
    test_matching_is_exact_not_partial()
    test_rulings_have_two_sources_for_removal()
    print("OK: brands")


if __name__ == "__main__":
    main()
