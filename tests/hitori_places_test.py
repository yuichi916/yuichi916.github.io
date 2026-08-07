# -*- coding: utf-8 -*-
"""駅・市区町村の検索インデックス。外部ジオコーディングに依存しないための同梱データ。"""
import sys, json, gzip, math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "hitori" / "places.json"
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import places

# 上限は初期ロードではなく遅延取得されるファイルに対するもの。検索欄に触れて
# 初めて取得され、以後はメモリとHTTPキャッシュに載る。実測 449.6KB / gzip 141.4KB
# に対し、将来の駅・市区町村の増加ぶんの余裕を見た値。
MAX_RAW = 520 * 1024
MAX_GZIP = 165 * 1024
FIELDS = ["name", "lat", "lon", "type", "pref"]

# 従来の重複排除件数（500m判定を入れる前）。修正が実際に取りこぼしを
# 回収したことを、この数より増えたことで検証する。
PREV_STATION_COUNT = 9105


def _row(name, lat, lon, kind, pref):
    return [name, lat, lon, kind, pref]


def _north(lat, lon, meters):
    """(lat, lon) から真北へ meters だけ移動した点。

    経度を固定した南北移動なら、places._distance_m のhaversine式は
    dlon=0 のとき a = sin(dphi/2)^2 に簡約され、
    distance = 2R*asin(|sin(dphi/2)|) = R*dphi（dphi/2 が主値域内なら厳密に
    一致）になる。よって dphi = meters / R とすれば、生成した2点間の距離は
    近似ではなく指定した meters に厳密に一致する。閾値ぎりぎりのテストで
    「本当にその距離になっているか」を実測(assert)できるのはこのため。
    """
    r = 6371000.0
    dphi = meters / r
    return lat + math.degrees(dphi), lon


def test_dedupe_merges_same_point():
    # 和田岬駅: Wikidata側で同一実体が重複登録されている実測ケース（0m）
    rows = [_row("和田岬駅", 34.6569, 135.175, "s", 28),
            _row("和田岬駅", 34.6569, 135.175, "s", 28)]
    out = places.dedupe(rows)
    assert len(out) == 1, out


def test_dedupe_keeps_stations_1_1km_apart():
    # 御影駅: 阪神本線と阪急神戸線で別施設。実測で約1,135m離れている
    # （DEDUPE_RADIUS_M=500mを超えるので別物として残る）
    rows = [_row("御影駅", 34.72472, 135.2525, "s", 28),
            _row("御影駅", 34.71484, 135.25563, "s", 28)]
    out = places.dedupe(rows)
    assert len(out) == 2, out


def test_dedupe_keeps_same_name_different_prefecture():
    # 座標が同一でも県が違えば別物（そもそもキーが分かれる）
    rows = [_row("中央駅", 35.0, 135.0, "s", 1),
            _row("中央駅", 35.0, 135.0, "s", 2)]
    out = places.dedupe(rows)
    assert len(out) == 2, out


def test_dedupe_chain_does_not_transitively_merge():
    # A-B ≈ 400m（統合対象）、B-C ≈ 400m（統合対象）、しかし A-C ≈ 800m
    # （統合不可）。単連結（誰か1人が近ければクラスタに加える）だとBを
    # 介してA-B-Cが全部1件に潰れてしまうが、完全連結（クラスタ全員が
    # 閾値以内のときだけ加える）ではA-Cが500mを超えるため別クラスタに
    # 分かれ、2件残るのが正しい。
    lat0, lon0 = 35.0, 139.0
    a = _row("連結駅", lat0, lon0, "s", 1)
    blat, blon = _north(lat0, lon0, 400.0)
    b = _row("連結駅", blat, blon, "s", 1)
    clat, clon = _north(lat0, lon0, 800.0)
    c = _row("連結駅", clat, clon, "s", 1)

    d_ab = places._distance_m(a[1], a[2], b[1], b[2])
    d_bc = places._distance_m(b[1], b[2], c[1], c[2])
    d_ac = places._distance_m(a[1], a[2], c[1], c[2])
    assert d_ab <= places.DEDUPE_RADIUS_M, d_ab
    assert d_bc <= places.DEDUPE_RADIUS_M, d_bc
    assert d_ac > places.DEDUPE_RADIUS_M, d_ac

    out = places.dedupe([a, b, c])
    assert len(out) == 2, (
        f"A-C が {d_ac:.0f}m離れている（B経由の連鎖で誤って1件に潰れた）: {out}")


def test_dedupe_merges_just_under_threshold():
    # 500m閾値のすぐ内側（約480m）。統合されるべき。
    lat0, lon0 = 35.0, 139.0
    a = _row("境界駅", lat0, lon0, "s", 1)
    blat, blon = _north(lat0, lon0, 480.0)
    b = _row("境界駅", blat, blon, "s", 1)
    d = places._distance_m(a[1], a[2], b[1], b[2])
    assert d < places.DEDUPE_RADIUS_M, d

    out = places.dedupe([a, b])
    assert len(out) == 1, f"{d:.0f}m は閾値未満なのに統合されていない: {out}"


def test_dedupe_keeps_just_over_threshold():
    # 500m閾値のすぐ外側（約520m）。別物として残るべき。
    lat0, lon0 = 35.0, 139.0
    a = _row("境界駅", lat0, lon0, "s", 1)
    blat, blon = _north(lat0, lon0, 520.0)
    b = _row("境界駅", blat, blon, "s", 1)
    d = places._distance_m(a[1], a[2], b[1], b[2])
    assert d > places.DEDUPE_RADIUS_M, d

    out = places.dedupe([a, b])
    assert len(out) == 2, f"{d:.0f}m は閾値超なのに統合されている: {out}"


def test_generated_file():
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
    # 500m以内の重複だけをまとめる修正で回収した分、従来件数より増えているはず。
    assert len(stations) > PREV_STATION_COUNT, (
        f"重複排除の500m修正が効いていない: 駅 {len(stations)} 件"
        f"（修正前 {PREV_STATION_COUNT} 件から増えていない）")
    # 日本の市区町村は約1,741。政令市の区を含めても2,000を大きく超えない。
    assert 1700 <= len(cities) <= 2100, f"市区町村が {len(cities)} 件"

    for r in doc["items"]:
        assert len(r) == len(FIELDS), r
        assert str(r[idx["name"]]).strip(), r
        lat, lon = r[idx["lat"]], r[idx["lon"]]
        assert 20.0 <= lat <= 46.0 and 122.0 <= lon <= 154.0, f"bbox外: {r}"
        assert r[idx["type"]] in ("s", "c"), r
        assert 1 <= r[idx["pref"]] <= 47, r

    # (名前, 種別, 県) が同じ行が複数残っていてもよいが、その場合は
    # DEDUPE_RADIUS_M より離れていること（統合すべきなのに統合されて
    # いない「統合漏れ」の検出）。
    # 注意: これは片方向のチェックでしかない。過剰統合（本来別物の駅が
    # 誤って1件に潰された）は、その時点で行が1件しか残らないため比較対象が
    # 無く、このループでは検出できない。過剰統合（単連結の連鎖バグなど）は
    # test_dedupe_chain_does_not_transitively_merge のような dedupe() への
    # 直接的なユニットテストで別途検証する。
    by_key = defaultdict(list)
    for r in doc["items"]:
        by_key[(r[idx["name"]], r[idx["type"]], r[idx["pref"]])].append(r)
    for key, group in by_key.items():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                d = places._distance_m(group[i][idx["lat"]], group[i][idx["lon"]],
                                        group[j][idx["lat"]], group[j][idx["lon"]])
                assert d > places.DEDUPE_RADIUS_M, (
                    f"{key} が {d:.0f}m しか離れておらず統合漏れ: "
                    f"{group[i]} / {group[j]}")

    names = [r[idx["name"]] for r in doc["items"]]
    # 主要駅が引けること
    for want in ("渋谷駅", "梅田駅", "札幌駅"):
        assert any(want in n for n in names), f"{want} が見つからない"

    print(f"OK: places（駅 {len(stations):,} / 市区町村 {len(cities):,} / "
          f"生 {len(raw)/1024:.0f}KB gzip {gz/1024:.0f}KB）")


def main():
    test_dedupe_merges_same_point()
    test_dedupe_keeps_stations_1_1km_apart()
    test_dedupe_keeps_same_name_different_prefecture()
    test_dedupe_chain_does_not_transitively_merge()
    test_dedupe_merges_just_under_threshold()
    test_dedupe_keeps_just_over_threshold()
    test_generated_file()


if __name__ == "__main__":
    main()
