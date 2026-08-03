# -*- coding: utf-8 -*-
"""県マスタの健全性検証。転記ミス・取りこぼしを機械的に検出する。"""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"

# 令和2年国勢調査の全国人口。Wikidata の P1082 はほぼこの値の集合になる。
CENSUS_2020_TOTAL = 126_146_099


def main():
    assert MASTER.exists(), f"not found: {MASTER}"
    rows = json.loads(MASTER.read_text(encoding="utf-8"))

    assert len(rows) == 47, f"47県あるはずが {len(rows)} 件"
    codes = [r["code"] for r in rows]
    assert codes == list(range(1, 48)), "code が 1..47 の昇順になっていない"

    for r in rows:
        assert r["name"], f"name が空: {r}"
        assert r["name"].endswith(("都", "道", "府", "県")), f"県名が不正: {r['name']}"
        assert 500_000 <= r["pop"] <= 15_000_000, f"人口が範囲外: {r}"

    total = sum(r["pop"] for r in rows)
    diff = abs(total - CENSUS_2020_TOTAL) / CENSUS_2020_TOTAL
    assert diff < 0.01, f"人口合計 {total} が国勢調査値から {diff:.1%} 乖離"

    # 転記ずれ検出。上位5県の顔ぶれは国勢調査で確定している。
    top5 = [r["name"] for r in sorted(rows, key=lambda x: -x["pop"])[:5]]
    assert top5 == ["東京都", "神奈川県", "大阪府", "愛知県", "埼玉県"], f"上位5県が異常: {top5}"

    assert rows[0]["name"] == "北海道" and rows[46]["name"] == "沖縄県"

    print(f"OK: 47県 / 合計 {total:,} 人 / 上位 {top5}")


if __name__ == "__main__":
    main()
