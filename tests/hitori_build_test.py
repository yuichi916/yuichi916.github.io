# -*- coding: utf-8 -*-
"""ビルド本体の検証。実データではなく手作りのfixtureで固める。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import build_data
import pref_of
import hidden
import iso
import validate

PREFS = [
    {"code": 13, "name": "東京都", "pop": 1_000_000},
    {"code": 26, "name": "京都府", "pop": 500_000},
]

RAW = {
    13: {"elements": [
        {"type": "node", "id": 1, "lat": 35.65894, "lon": 139.70043,
         "tags": {"amenity": "restaurant", "name": "一蘭 渋谷店", "cuisine": "ramen"}},
        {"type": "node", "id": 2, "lat": 35.70112, "lon": 139.75820,
         "tags": {"amenity": "restaurant", "name": "はやしや", "cuisine": "soba"}},
        {"type": "node", "id": 3, "lat": 35.71000, "lon": 139.76000,
         "tags": {"amenity": "public_bath", "name": "はやし湯"}},
        # 名前なし → 除外
        {"type": "node", "id": 4, "lat": 35.72, "lon": 139.77, "tags": {"amenity": "public_bath"}},
    ]},
    26: {"elements": [
        {"type": "node", "id": 10, "lat": 35.01167, "lon": 135.76806,
         "tags": {"amenity": "library", "name": "京都府立図書館"}},
    ]},
}


def test_build_shapes():
    summary, prefdocs = build_data.build(RAW, PREFS, {}, "2026-08-02")

    assert set(prefdocs.keys()) == {13, 26}
    assert summary["updated"] == "2026-08-02"
    assert summary["total"] == 4          # 名前なし1件を除いた実数

    tokyo = [p for p in summary["prefectures"] if p["code"] == 13][0]
    assert tokyo["counts"] == {"all": 3, "bath": 1, "eat": 2, "play": 0, "stay": 0}
    # 一蘭はチェーン、はやしや・はやし湯は独立店
    assert tokyo["counts_indie"] == {"all": 2, "bath": 1, "eat": 1, "play": 0, "stay": 0}

    # density = counts / pop * 100000。3件 / 100万人 = 0.3件/10万人
    assert abs(tokyo["density"]["all"] - 0.3) < 0.005
    assert abs(tokyo["density_indie"]["all"] - 0.2) < 0.005

    kyoto = [p for p in summary["prefectures"] if p["code"] == 26][0]
    assert kyoto["counts"]["stay"] == 1
    assert abs(kyoto["density"]["stay"] - 0.2) < 0.005   # 1件 / 50万人


def test_build_output_passes_validation():
    # RAW単体には play カテゴリの施設がないため、iso_threshold が全カテゴリ分
    # 揃わない。ここだけ play を1件足した別データで検証する（RAW自体を変えると
    # 他テストの件数アサーションが崩れるため）。
    raw = {**RAW, 26: {"elements": RAW[26]["elements"] + [
        {"type": "node", "id": 11, "lat": 35.02, "lon": 135.77,
         "tags": {"amenity": "internet_cafe", "name": "○○ネットカフェ"}},
    ]}}
    summary, prefdocs = build_data.build(raw, PREFS, {}, "2026-08-02")
    assert validate.validate_summary(summary) == []
    for code, doc in prefdocs.items():
        errs = validate.validate_pref(doc)
        assert errs == [], f"pref {code}: {errs}"


def test_build_applies_curated():
    curated = {"n3": {"note": "黙浴の掲示あり",
                      "evidence": [{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]}}
    _, prefdocs = build_data.build(RAW, PREFS, curated, "2026-08-02")
    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = [r for r in prefdocs[13]["items"] if r[idx["id"]] == "n3"][0]
    assert row[idx["solo"]] == 5      # base4 + 肯定エビデンス
    assert row[idx["conf"]] == 2
    assert row[idx["note"]] == "黙浴の掲示あり"


def test_build_sorts_by_score_desc():
    _, prefdocs = build_data.build(RAW, PREFS, {}, "2026-08-02")
    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    scores = [r[idx["solo"]] for r in prefdocs[13]["items"]]
    assert scores == sorted(scores, reverse=True), scores


def test_build_includes_manual_entries():
    # OSM に存在しない施設（カプセルホテルは全国で1件しかタグ付けされていない）
    curated = {"c-0001": {
        "name": "カプセルホテル○○", "lat": 35.69, "lon": 139.70, "pref": 13,
        "cat": "stay", "kind": "capsule", "note": "OSM未登録のため手動追加",
        "evidence": [{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]}}
    summary, prefdocs = build_data.build(RAW, PREFS, curated, "2026-08-02")

    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = [r for r in prefdocs[13]["items"] if r[idx["id"]] == "c-0001"]
    assert row, "手動追加エントリが出力に含まれていない"
    assert row[0][idx["solo"]] == 5 and row[0][idx["conf"]] == 2

    tokyo = [p for p in summary["prefectures"] if p["code"] == 13][0]
    assert tokyo["counts"]["stay"] == 1, "手動追加が集計に反映されていない"

    # 別県の集計には入らない
    kyoto = [p for p in summary["prefectures"] if p["code"] == 26][0]
    assert kyoto["counts"]["stay"] == 1   # 京都は元々の図書館1件のみ

    # excluded なら出ない
    curated["c-0001"]["excluded"] = True
    _, prefdocs2 = build_data.build(RAW, PREFS, curated, "2026-08-02")
    assert not [r for r in prefdocs2[13]["items"] if r[idx["id"]] == "c-0001"]


def test_build_computes_hidden_across_prefectures():
    # 県をまたいで500m以内に並ぶチェーン店。独立店の穴場度が上がること。
    prefs = [{"code": 13, "name": "東京都", "pop": 1_000_000},
             {"code": 14, "name": "神奈川県", "pop": 1_000_000}]
    raw = {
        13: {"elements": [
            {"type": "node", "id": 1, "lat": 35.5000, "lon": 139.5000,
             "tags": {"amenity": "restaurant", "name": "はやしや", "cuisine": "soba"}},
        ]},
        14: {"elements": [
            {"type": "node", "id": 100 + k, "lat": 35.5000 + 0.0005 * (k + 1), "lon": 139.5000,
             "tags": {"amenity": "restaurant", "name": f"松屋 {k}号店", "cuisine": "gyudon"}}
            for k in range(4)
        ]},
    }
    _, prefdocs = build_data.build(raw, prefs, {}, "2026-08-04")
    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = prefdocs[13]["items"][0]
    assert row[idx["hidden_n"]] == 4, "県をまたいだ近傍が数えられていない"
    assert row[idx["hidden"]] == 1.0


def test_chain_detection_runs_before_hidden_score():
    # 「来来亭」はハードコードのチェーン一覧にもbrandタグにも無い名前。
    # 3県にまたがって出現して初めてchainへ昇格する。この昇格が
    # compute_hidden より先に走らないと、はやしやの周囲チェーン比率は
    # 0のままで穴場判定を通らない。
    prefs = [{"code": 13, "name": "東京都", "pop": 1_000_000},
             {"code": 14, "name": "神奈川県", "pop": 1_000_000},
             {"code": 15, "name": "新潟県", "pop": 1_000_000},
             {"code": 16, "name": "富山県", "pop": 1_000_000}]
    raw = {
        13: {"elements": [
            {"type": "node", "id": 1, "lat": 35.5000, "lon": 139.5000,
             "tags": {"amenity": "restaurant", "name": "はやしや", "cuisine": "soba"}},
        ]},
        14: {"elements": [
            {"type": "node", "id": 101, "lat": 35.5003, "lon": 139.5000,
             "tags": {"amenity": "restaurant", "name": "来来亭", "cuisine": "ramen"}},
        ]},
        15: {"elements": [
            {"type": "node", "id": 102, "lat": 35.4997, "lon": 139.5000,
             "tags": {"amenity": "restaurant", "name": "来来亭", "cuisine": "ramen"}},
        ]},
        16: {"elements": [
            {"type": "node", "id": 103, "lat": 35.5000, "lon": 139.5005,
             "tags": {"amenity": "restaurant", "name": "来来亭", "cuisine": "ramen"}},
        ]},
    }
    _, prefdocs = build_data.build(raw, prefs, {}, "2026-08-04")

    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = prefdocs[13]["items"][0]
    rec = {f: row[i] for f, i in idx.items()}
    assert rec["hidden_n"] == 3, "県をまたいだ近傍3件が数えられていない"
    assert rec["hidden"] == 1.0, "近傍3件が全てchain昇格していないと1.0にならない"
    assert hidden.is_hidden_gem(rec), "chain昇格がhidden計算より先に走っていないと穴場にならない"

    # 昇格された側(来来亭)もchain=1になっていること
    for code in (14, 15, 16):
        idx2 = {k: i for i, k in enumerate(prefdocs[code]["fields"])}
        crow = prefdocs[code]["items"][0]
        assert crow[idx2["chain"]] == 1, f"pref{code}の来来亭が昇格していない"


def test_build_computes_iso_and_threshold():
    prefs = [{"code": 13, "name": "東京都", "pop": 1_000_000},
             {"code": 14, "name": "神奈川県", "pop": 1_000_000}]
    raw = {
        13: {"elements": [
            {"type": "node", "id": 1, "lat": 35.5000, "lon": 139.5000,
             "tags": {"amenity": "public_bath", "name": "はやし湯"}},
        ]},
        14: {"elements": [
            {"type": "node", "id": 2, "lat": 35.5010, "lon": 139.5000,
             "tags": {"amenity": "public_bath", "name": "べつの湯"}},
        ]},
    }
    summary, prefdocs = build_data.build(raw, prefs, {}, "2026-08-07")
    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = prefdocs[13]["items"][0]
    # 県をまたいで約111m先に同業態がある
    assert 90 <= row[idx["iso"]] <= 130, row[idx["iso"]]

    assert "iso_threshold" in summary
    assert "bath" in summary["iso_threshold"]
    assert isinstance(summary["iso_threshold"]["bath"], int)


def test_build_publishes_iso_max():
    # hitori.html の formatIso はこの値をブラウザ側の 50km 判定に使う。
    # iso.py と二重管理にならないよう、summary.json 経由の一本化を検証する。
    summary, _ = build_data.build(RAW, PREFS, {}, "2026-08-02")
    assert summary["iso_max"] == iso.MAX_ISO_M


def test_enriched_axes_keep_the_estimate():
    """実効値と推定値の両方が出ること。何を根拠に変えたか隠さないため。"""
    import enrich
    rec = {"id": "n1", "cat": "bath", "kind": "sento", "solo": 4, "quiet": 4, "easy": 3}
    facts = [{"k": "payment_method", "v": "counter_person", "n": 2},
             {"k": "clientele", "v": "local", "n": 2}]
    eff = enrich.apply_adjust({"solo": 4, "quiet": 4, "easy": 3}, facts)
    assert eff["easy"] == 1, eff       # 3 - 2（上限）
    assert rec["easy"] == 3, "推定値が壊されている"


def test_unchecked_facility_has_empty_checked():
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    d = json.loads((root / "data" / "hitori" / "pref" / "44.json").read_text(encoding="utf-8"))
    for f in ("solo_est", "quiet_est", "easy_est", "checked"):
        assert f in d["fields"], f"{f} が列に無い"
    i = {k: n for n, k in enumerate(d["fields"])}
    unchecked = [r for r in d["items"] if not r[i["checked"]]]
    assert unchecked, "未調査の施設が1件も無いのはおかしい"
    for r in unchecked[:50]:
        assert r[i["solo"]] == r[i["solo_est"]], "未調査なのに実効値が推定値と違う"



def test_excluded_facilities_leave_the_output():
    """除外は県別リストにも届くこと。

    出力は by_pref から作られるので、all_records だけを絞っても
    ファイルには残ってしまう（実際にそのバグを出した）。
    """
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    curated = json.loads((root / "data" / "hitori" / "curated.json").read_text(encoding="utf-8"))

    import enrich
    should_go = {i for i, e in curated.items() if enrich.exclusion_reason(e["facts"])}
    assert should_go, "除外対象が1件も無いとこのテストは何も検証しない"

    ids = set()
    for f in sorted((root / "data" / "hitori" / "pref").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        i = d["fields"].index("id")
        ids |= {r[i] for r in d["items"]}
    left = should_go & ids
    assert not left, f"除外されるはずの施設が残っている: {left}"


def test_total_reflects_exclusions():
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    summary = json.loads((root / "data" / "hitori" / "summary.json").read_text(encoding="utf-8"))
    n = 0
    for f in sorted((root / "data" / "hitori" / "pref").glob("*.json")):
        n += len(json.loads(f.read_text(encoding="utf-8"))["items"])
    assert summary["total"] == n, (summary["total"], n)

def test_cross_pref_duplicate_goes_to_the_prefecture_that_contains_it():
    """県境で両県に入った施設は、座標が示す県だけに残ること。

    Overpass の area クエリは県境の施設を両隣に返す。normalize.dedupe は
    県単位なので落とせず、同じ施設が一覧に二度出ていた（実データで5件）。
    横手山頂ヒュッテ(36.6842, 138.4966)は長野県。若い県コードを採る規則
    だと群馬県(10)の一覧に出てしまう。
    """
    yokote = {"id": "w522077073", "name": "横手山頂ヒュッテ", "lat": 36.6842, "lon": 138.4966}
    by_pref = {10: [dict(yokote), {"id": "w2", "name": "群馬の店", "lat": 36.39, "lon": 139.06}],
               20: [dict(yokote), {"id": "w3", "name": "長野の店", "lat": 36.65, "lon": 138.18}]}
    report = build_data._drop_cross_pref_duplicates(by_pref)
    if not pref_of.pref_of(36.6842, 138.4966):
        return   # 県境ポリゴンが無い環境。決め打ち規則の側は下のテストで見る
    assert [r["id"] for r in by_pref[20]] == ["w522077073", "w3"], by_pref[20]
    assert [r["id"] for r in by_pref[10]] == ["w2"], by_pref[10]
    assert report == [("w522077073", "横手山頂ヒュッテ", 20, 10)], report


def test_cross_pref_falls_back_to_the_lowest_code_at_sea():
    """ポリゴンがどの県も指さないときは、若い県コードへ落として消えないこと。

    黙って両方から消すのが最悪。どちらかには必ず残す。
    """
    off = {"id": "w9", "name": "沖合の何か", "lat": 30.0, "lon": 140.0}
    by_pref = {13: [dict(off)], 47: [dict(off)]}
    report = build_data._drop_cross_pref_duplicates(by_pref)
    assert [r["id"] for r in by_pref[13]] == ["w9"]
    assert by_pref[47] == []
    assert len(report) == 1 and report[0][2] == 13


def test_cross_pref_dedupe_leaves_clean_data_alone():
    by_pref = {13: [{"id": "w1", "name": "a", "lat": 35.68, "lon": 139.76}],
               14: [{"id": "w2", "name": "b", "lat": 35.44, "lon": 139.63}]}
    assert build_data._drop_cross_pref_duplicates(by_pref) == []
    assert len(by_pref[13]) == 1 and len(by_pref[14]) == 1


def test_cross_pref_dedupe_is_reported_not_silent():
    """黙って消さないこと。報告が空なら、件数が減った理由が誰にも分からない。"""
    tokyo = {"id": "w1", "name": "都内の店", "lat": 35.6812, "lon": 139.7671}
    by_pref = {13: [dict(tokyo)], 47: [dict(tokyo)]}
    report = build_data._drop_cross_pref_duplicates(by_pref)
    assert len(report) == 1 and report[0][0] == "w1"
    assert by_pref[47] == []


PREFS_FOR_ADDR = [{"code": 10, "name": "群馬県", "pop": 1}, {"code": 20, "name": "長野県", "pop": 1}]


def test_cross_pref_prefers_the_address_over_the_polygon():
    """住所タグがあれば、それがポリゴンより優先されること。

    横手山頂ヒュッテ(36.67111, 138.52417)は addr に Nagano とあるが、
    簡略化された県境ポリゴンは群馬県側と判定する。稜線上の施設で実際に
    起きた。人が書いた所在地のほうが強い。
    """
    yokote = {"id": "w522077073", "name": "横手山頂ヒュッテ",
              "lat": 36.67111, "lon": 138.52417,
              "_addr": "7149-17 Hirao, Yamanochi, Shimotakai District, Nagano 381-0401 Japan"}
    by_pref = {10: [dict(yokote)], 20: [dict(yokote)]}
    report = build_data._drop_cross_pref_duplicates(by_pref, PREFS_FOR_ADDR)
    assert [r["id"] for r in by_pref[20]] == ["w522077073"], by_pref[20]
    assert by_pref[10] == []
    assert report == [("w522077073", "横手山頂ヒュッテ", 20, 10)], report


def test_polygon_alone_would_have_got_it_wrong():
    """上のテストが空振りでないこと。住所を外すと群馬県側に落ちる。"""
    if not pref_of.pref_of(36.67111, 138.52417):
        return   # 県境ポリゴンが無い環境
    yokote = {"id": "w1", "name": "横手山頂ヒュッテ", "lat": 36.67111, "lon": 138.52417}
    by_pref = {10: [dict(yokote)], 20: [dict(yokote)]}
    build_data._drop_cross_pref_duplicates(by_pref, PREFS_FOR_ADDR)
    assert [r["id"] for r in by_pref[10]] == ["w1"], "住所なしでも長野に入るならテストが無意味"


def test_ambiguous_address_falls_through_to_the_polygon():
    """住所に2県が出てきたら決めない。ポリゴンへ落とす。"""
    assert pref_of.pref_from_address("群馬県と長野県の境", PREFS_FOR_ADDR) is None
    assert pref_of.pref_from_address("", PREFS_FOR_ADDR) is None
    assert pref_of.pref_from_address("長野県山ノ内町", PREFS_FOR_ADDR) == 20


def main():
    test_build_shapes()
    test_build_output_passes_validation()
    test_build_applies_curated()
    test_build_sorts_by_score_desc()
    test_build_includes_manual_entries()
    test_build_computes_hidden_across_prefectures()
    test_chain_detection_runs_before_hidden_score()
    test_build_computes_iso_and_threshold()
    test_build_publishes_iso_max()
    test_enriched_axes_keep_the_estimate()
    test_unchecked_facility_has_empty_checked()
    test_excluded_facilities_leave_the_output()
    test_total_reflects_exclusions()
    test_cross_pref_duplicate_goes_to_the_prefecture_that_contains_it()
    test_cross_pref_falls_back_to_the_lowest_code_at_sea()
    test_cross_pref_prefers_the_address_over_the_polygon()
    test_polygon_alone_would_have_got_it_wrong()
    test_ambiguous_address_falls_through_to_the_polygon()
    test_cross_pref_dedupe_leaves_clean_data_alone()
    test_cross_pref_dedupe_is_reported_not_silent()
    print("OK: build_data")


if __name__ == "__main__":
    main()
