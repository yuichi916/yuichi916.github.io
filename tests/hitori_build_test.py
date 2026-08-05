# -*- coding: utf-8 -*-
"""ビルド本体の検証。実データではなく手作りのfixtureで固める。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import build_data
import hidden
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
    summary, prefdocs = build_data.build(RAW, PREFS, {}, "2026-08-02")
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


def main():
    test_build_shapes()
    test_build_output_passes_validation()
    test_build_applies_curated()
    test_build_sorts_by_score_desc()
    test_build_includes_manual_entries()
    test_build_computes_hidden_across_prefectures()
    test_chain_detection_runs_before_hidden_score()
    print("OK: build_data")


if __name__ == "__main__":
    main()
