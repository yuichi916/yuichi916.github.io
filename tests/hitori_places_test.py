# -*- coding: utf-8 -*-
"""駅・市区町村の検索インデックス。外部ジオコーディングに依存しないための同梱データ。"""
import sys, json, gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "hitori" / "places.json"

# 上限は初期ロードではなく遅延取得されるファイルに対するもの。検索欄に触れて
# 初めて取得され、以後はメモリとHTTPキャッシュに載る。実測 449.6KB / gzip 141.4KB
# に対し、将来の駅・市区町村の増加ぶんの余裕を見た値。
MAX_RAW = 520 * 1024
MAX_GZIP = 165 * 1024
FIELDS = ["name", "lat", "lon", "type", "pref"]


def main():
    assert OUT.exists(), f"not found: {OUT} — places.py を実行してください"

    raw = OUT.read_bytes()
    assert len(raw) <= MAX_RAW, f"生 {len(raw)/1024:.0f}KB が上限 {MAX_RAW/1024:.0f}KB 超過"
    gz = len(gzip.compress(raw, 9))
    assert gz <= MAX_GZIP, f"gzip {gz/1024:.0f}KB が上限 {MAX_GZIP/1024:.0f}KB 超過"

    doc = json.loads(raw.decode("utf-8"))
    assert doc["fields"] == FIELDS, doc["fields"]

    idx = {k: i for i, k in enumerate(FIELDS)}
    stations = [r for r in doc["items"] if r[idx["type"]] == "s"]
    cities = [r for r in doc["items"] if r[idx["type"]] == "c"]

    # 2026-08-07 実測: OSM の name 付き鉄道駅は 9,128 件。取りこぼしを検出する。
    assert len(stations) >= 9000, f"駅が {len(stations)} 件しかない"
    # 日本の市区町村は約1,741。政令市の区を含めても2,000を大きく超えない。
    assert 1700 <= len(cities) <= 2100, f"市区町村が {len(cities)} 件"

    for r in doc["items"]:
        assert len(r) == len(FIELDS), r
        assert str(r[idx["name"]]).strip(), r
        lat, lon = r[idx["lat"]], r[idx["lon"]]
        assert 20.0 <= lat <= 46.0 and 122.0 <= lon <= 154.0, f"bbox外: {r}"
        assert r[idx["type"]] in ("s", "c"), r
        assert 1 <= r[idx["pref"]] <= 47, r

    # (名前, 種別, 県) の重複が無いこと
    keys = [(r[idx["name"]], r[idx["type"]], r[idx["pref"]]) for r in doc["items"]]
    assert len(keys) == len(set(keys)), f"重複が {len(keys) - len(set(keys))} 件"

    names = [r[idx["name"]] for r in doc["items"]]
    # 主要駅が引けること
    for want in ("渋谷駅", "梅田駅", "札幌駅"):
        assert any(want in n for n in names), f"{want} が見つからない"

    print(f"OK: places（駅 {len(stations):,} / 市区町村 {len(cities):,} / "
          f"生 {len(raw)/1024:.0f}KB gzip {gz/1024:.0f}KB）")


if __name__ == "__main__":
    main()
