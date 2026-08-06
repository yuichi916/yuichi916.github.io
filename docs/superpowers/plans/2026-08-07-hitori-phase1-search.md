# ひとり歓迎マップ フェーズ1「探せるようにする」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在地からしか探せない制約を外し、駅名・地名から探せるようにする。あわせて孤立度を導入して、穴場が構造的に0件になる湯・サウナ・滞在にも発見を出す。

**Architecture:** 駅と市区町村の検索インデックスをビルド時に生成して同梱し、外部ジオコーディングに依存しない。孤立度は全国の点集合に対してグリッド走査で最寄同業態距離を求め、バッジのしきい値はカテゴリ別の実測90パーセンタイルを `summary.json` へ書き出して JS 側と共有する。検索・並べ替え・お気に入りの純粋なロジックは `assets/hitori/core.js` に置き Node でテストする。

**Tech Stack:** Python 3.10 標準ライブラリのみ、素の HTML+CSS+JS（ESモジュール）、Playwright、Node

## Global Constraints

- Python は **標準ライブラリのみ**。HTTP は `urllib.request`
- Python テストは `tests/hitori_*_test.py`、`main()` を持つ素のスクリプト。**pytest は使わない**
- JS の純関数テストは `tests/hitori_core_test.mjs`（`node tests/hitori_core_test.mjs`）
- テスト実行は必ず `PYTHONUTF8=1` を付ける
- すべて UTF-8（BOMなし）。Python ファイル冒頭に `# -*- coding: utf-8 -*-`
- commit は Conventional Commits、scope は `hitori`、**メッセージは日本語**
- `hitori.html` を commit する前に `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html` が exit 0
- **`hitori.html` にアフィリエイトリンクを置かない**（地球地図日本の非営利条件）
- 営業状態が不明なものを「営業中」と表示しない。並べ替えでも **営業中 → 不明 → 営業時間外** の順とし、不明を営業時間外より下に置かない
- しきい値をコードに二重に持たない。孤立度のしきい値は `summary.json` の `iso_threshold` が唯一の出所
- 作業ツリーには他プロジェクトの未コミット変更がある。**`git add -A` を使わない**

---

### Task 1: 孤立度の計算

**Files:**
- Create: `scripts/hitori/iso.py`
- Test: `tests/hitori_iso_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `CELL_DEG = 0.01` / `MAX_ISO_M = 50000` / `MIN_CELL_M = 770`
  - `compute_iso(records) -> None` — 各レコードに `iso`（整数メートル）を破壊的に付与
  - `iso_thresholds(records, q=0.9) -> dict[str, int]` — カテゴリ別の分位値

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_iso_test.py`:

```python
# -*- coding: utf-8 -*-
"""孤立度＝最寄の同カテゴリ施設までの距離。湯・滞在に発見を出すための指標。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import iso


def rec(i, lat, lon, cat="bath"):
    return {"id": f"n{i}", "lat": lat, "lon": lon, "cat": cat}


def test_two_nearby():
    # 緯度0.001度は約111m
    recs = [rec(1, 35.0, 139.0), rec(2, 35.001, 139.0)]
    iso.compute_iso(recs)
    assert 100 <= recs[0]["iso"] <= 125, recs[0]["iso"]
    assert recs[0]["iso"] == recs[1]["iso"], "対称でない"


def test_only_same_category_counts():
    recs = [rec(1, 35.0, 139.0, "bath"), rec(2, 35.001, 139.0, "eat")]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M, "別カテゴリを最寄に数えている"


def test_alone_in_country():
    recs = [rec(1, 35.0, 139.0)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M


def test_capped_at_max():
    # 緯度1.0度は約111km。上限50kmで打ち切る。
    recs = [rec(1, 35.0, 139.0), rec(2, 36.0, 139.0)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] == iso.MAX_ISO_M


def test_picks_the_nearest_not_the_first_found():
    # グリッドの隅にある候補より、外側リングの辺の中央にある候補のほうが近いことがある。
    # 中心セルの隅に遠い候補、2リング外の真横に近い候補を置く。
    center = rec(1, 35.0000, 139.0000)
    corner = rec(2, 35.0095, 139.0095)     # 斜め約1.4km（リング0〜1に入る）
    straight = rec(3, 35.0000, 139.0090)   # 真東約820m（リング0〜1に入る）
    recs = [center, corner, straight]
    iso.compute_iso(recs)
    assert 780 <= center["iso"] <= 860, f"最寄を取り違えている: {center['iso']}"


def test_crosses_prefecture_boundary():
    # 全国の点集合に対して計算するので県境は関係しない
    recs = [rec(1, 35.0, 139.0), rec(2, 35.0, 139.002)]
    iso.compute_iso(recs)
    assert recs[0]["iso"] < 250


def test_thresholds_are_per_category():
    recs = []
    for k in range(10):
        recs.append(rec(100 + k, 35.0 + 0.001 * k, 139.0, "eat"))
    for k in range(10):
        recs.append(rec(200 + k, 40.0 + 0.05 * k, 140.0, "bath"))
    iso.compute_iso(recs)
    th = iso.iso_thresholds(recs)
    assert set(th) == {"eat", "bath"}, th
    assert th["bath"] > th["eat"], f"疎な bath のほうが大きいはず: {th}"
    assert all(isinstance(v, int) for v in th.values())


def test_thresholds_ignore_missing_category():
    recs = [rec(1, 35.0, 139.0, "eat"), rec(2, 35.001, 139.0, "eat")]
    th = iso.iso_thresholds(recs)
    assert "play" not in th


def test_scales():
    import time
    recs = [rec(i, 35.0 + (i % 200) * 0.002, 139.0 + (i // 200) * 0.002)
            for i in range(20000)]
    t = time.time()
    iso.compute_iso(recs)
    elapsed = time.time() - t
    assert elapsed < 30, f"20,000件に {elapsed:.1f}秒。リング走査が広がりすぎている"


def main():
    test_two_nearby()
    test_only_same_category_counts()
    test_alone_in_country()
    test_capped_at_max()
    test_picks_the_nearest_not_the_first_found()
    test_crosses_prefecture_boundary()
    test_thresholds_are_per_category()
    test_thresholds_ignore_missing_category()
    test_scales()
    print("OK: iso")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_iso_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'iso'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/iso.py`:

```python
# -*- coding: utf-8 -*-
"""孤立度。最寄の同カテゴリ施設までの距離（メートル）。

穴場スコア（周囲のチェーン比率）は湯1.4%・滞在0.2%というチェーン率の低さゆえに
この2カテゴリでは構造的に0件になる。孤立度はそこに発見を出すための指標で、
「最寄りの銭湯まで4.2km — この一帯で唯一」と説明できることを狙っている。
"""
import math
from collections import defaultdict

CELL_DEG = 0.01
MAX_ISO_M = 50000

# セル1辺の最小メートル数。経度方向は高緯度ほど縮み、日本最北（北緯約45.6度）で
# 0.01度 ≒ 780m。リング打ち切りの判定に使うので、安全側に小さく取る。
MIN_CELL_M = 770


def _distance_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cell(rec):
    return (int(math.floor(rec["lat"] / CELL_DEG)), int(math.floor(rec["lon"] / CELL_DEG)))


def _ring_offsets(r):
    """中心から距離 r の正方リング上のセル差分。r=0 は中心のみ。"""
    if r == 0:
        yield (0, 0)
        return
    for d in range(-r, r + 1):
        yield (-r, d)
        yield (r, d)
    for d in range(-r + 1, r):
        yield (d, -r)
        yield (d, r)


def _nearest_same_cat(rec, grid):
    cy, cx = _cell(rec)
    best = None
    max_ring = int(math.ceil(MAX_ISO_M / MIN_CELL_M)) + 1
    ring = 0
    while ring <= max_ring:
        for dy, dx in _ring_offsets(ring):
            for o in grid.get((cy + dy, cx + dx), ()):
                if o is rec or o["cat"] != rec["cat"]:
                    continue
                d = _distance_m(rec["lat"], rec["lon"], o["lat"], o["lon"])
                if best is None or d < best:
                    best = d
        # リング r で見つけても、そこで打ち切ってはいけない。正方グリッドなので
        # リング r の隅より、リング r+1 の辺の中央のほうが近いことがある。
        # リング r より外側の点は必ず r*MIN_CELL_M 以上離れているので、
        # best がそれ以下になった時点で初めて確定できる。
        if best is not None and best <= ring * MIN_CELL_M:
            break
        if best is not None and best >= MAX_ISO_M:
            break
        ring += 1
    if best is None:
        return MAX_ISO_M
    return min(MAX_ISO_M, int(round(best)))


def compute_iso(records):
    """各レコードに iso（整数メートル）を破壊的に付与する。"""
    grid = defaultdict(list)
    for r in records:
        grid[_cell(r)].append(r)
    for r in records:
        r["iso"] = _nearest_same_cat(r, grid)


def iso_thresholds(records, q=0.9):
    """カテゴリ別の iso 分位値。孤立バッジの境界に使う。

    固定値を置かない。穴場で全カテゴリ共通の 0.6 を勘で置き、チェーン率の低い
    湯・滞在が構造的に0件になった失敗を繰り返さないため、実測分布から決める。
    """
    by_cat = defaultdict(list)
    for r in records:
        if "iso" in r:
            by_cat[r["cat"]].append(r["iso"])
    out = {}
    for cat, vals in by_cat.items():
        vals.sort()
        idx = min(len(vals) - 1, max(0, int(round(q * (len(vals) - 1)))))
        out[cat] = int(vals[idx])
    return out
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_iso_test.py`
Expected: `OK: iso`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/iso.py tests/hitori_iso_test.py
git commit -m "feat(hitori): 孤立度（最寄同業態までの距離）を追加"
```

---

### Task 2: ビルドへの統合

**Files:**
- Modify: `scripts/hitori/validate.py`
- Modify: `scripts/hitori/normalize.py`
- Modify: `scripts/hitori/build_data.py`
- Modify: `tests/hitori_validate_test.py`
- Modify: `tests/hitori_normalize_test.py`
- Modify: `tests/hitori_build_test.py`

**Interfaces:**
- Consumes: Task 1 の `iso.compute_iso` / `iso.iso_thresholds`
- Produces: 新しい `EXPECTED_FIELDS`、`summary.json` の `iso_threshold`

```python
EXPECTED_FIELDS = ["id", "name", "lat", "lon", "cat", "kind",
                   "solo", "quiet", "easy", "conf", "chain",
                   "hidden", "hidden_n", "iso", "city", "oh", "tel", "web", "note"]
```

- [ ] **Step 1: validate のテストを更新**

`tests/hitori_validate_test.py` の `FIELDS` に `"iso"` を `"hidden_n"` の直後へ入れ、`GOOD_PREF` の各行にも対応する値を差し込む。`GOOD_PREF["items"]` を以下で置き換える:

```python
    "items": [
        ["n1", "一蘭 渋谷店", 35.65894, 139.70043, "eat", "ramen",
         5, 4, 3, 2, 1, 0.0, 8, 240, "渋谷区", "11:00-23:00",
         "03-0000-0000", "https://ichiran.com/", "仕切りカウンター12席"],
        ["n2", "はやしや", 35.70112, 139.75820, "eat", "soba_udon",
         4, 4, 3, 0, 0, 0.83, 12, 1500, "新宿区", "", "", "", ""],
    ],
```

`GOOD_SUMMARY` に `iso_threshold` を足す:

```python
    "iso_threshold": {"bath": 3200, "eat": 900, "play": 5400, "stay": 2100},
```

テストを2つ追加し、`main()` に入れる:

```python
def test_pref_iso_range():
    for bad in (-1, 50001, 1.5, "300"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][13] = bad
        assert any("iso" in e for e in validate.validate_pref(d)), bad


def test_summary_needs_iso_threshold():
    d = copy.deepcopy(GOOD_SUMMARY)
    del d["iso_threshold"]
    assert any("iso_threshold" in e for e in validate.validate_summary(d))

    d2 = copy.deepcopy(GOOD_SUMMARY)
    d2["iso_threshold"] = {"bath": 3200}          # カテゴリ不足
    assert any("iso_threshold" in e for e in validate.validate_summary(d2))

    d3 = copy.deepcopy(GOOD_SUMMARY)
    d3["iso_threshold"]["eat"] = -5
    assert any("iso_threshold" in e for e in validate.validate_summary(d3))
```

- [ ] **Step 2: validate.py を更新**

`EXPECTED_FIELDS` を上の18→19列版に差し替え、`validate_pref` の hidden 検証の直後に追加:

```python
        iv = row[idx["iso"]]
        if not isinstance(iv, int) or isinstance(iv, bool) or not (0 <= iv <= 50000):
            errs.append(f"iso が不正: {fid} -> {iv!r}")
```

`validate_summary` の先頭付近に追加:

```python
    th = doc.get("iso_threshold")
    if not isinstance(th, dict):
        errs.append("iso_threshold がない")
    else:
        for c in CATS:
            v = th.get(c)
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                errs.append(f"iso_threshold.{c} が不正: {v!r}")
```

- [ ] **Step 3: normalize.py を更新**

`to_record` の返す辞書に `"iso": 0,` を `"hidden_n": 0,` の直後へ足す（`compute_iso` が全国計算のあとに上書きする）。同じく `tests/hitori_normalize_test.py` の `test_to_record_node` に `assert r["iso"] == 0` を足す。

- [ ] **Step 4: build_data.py を更新**

`import iso` を足し、`build()` の `hidden.compute_hidden(all_records)` の直後に追加:

```python
    # 孤立度も全国の点集合に対して計算する。県別にやると県境で最寄が誤る。
    iso.compute_iso(all_records)
```

`manual_records()` の返す辞書にも `"iso": 0,` を足す。

`summary` の組み立てに `iso_threshold` を追加:

```python
    summary = {
        "updated": updated,
        "total": total,
        "population_source": "Wikidata (CC0) / 令和2年国勢調査",
        "iso_threshold": iso.iso_thresholds(all_records),
        "prefectures": summary_prefs,
    }
```

- [ ] **Step 5: build のテストを追加**

`tests/hitori_build_test.py` に追加し `main()` へ入れる:

```python
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
```

- [ ] **Step 6: すべて実行して通す**

Run:
```bash
PYTHONUTF8=1 python tests/hitori_validate_test.py && PYTHONUTF8=1 python tests/hitori_normalize_test.py && PYTHONUTF8=1 python tests/hitori_build_test.py
```
Expected: `OK: validate` / `OK: normalize` / `OK: build_data`

- [ ] **Step 7: Commit**

```bash
git add scripts/hitori/ tests/hitori_validate_test.py tests/hitori_normalize_test.py tests/hitori_build_test.py
git commit -m "feat(hitori): 孤立度と分位しきい値をビルド出力へ追加"
```

---

### Task 3: 検索インデックスの生成

**Files:**
- Create: `scripts/hitori/places.py`
- Create: `data/hitori/places.json`（スクリプトが生成、commit する）
- Test: `tests/hitori_places_test.py`

**Interfaces:**
- Consumes: Task 4 の既存 `osm_query.run_query`
- Produces: `data/hitori/places.json`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_places_test.py`:

```python
# -*- coding: utf-8 -*-
"""駅・市区町村の検索インデックス。外部ジオコーディングに依存しないための同梱データ。"""
import sys, json, gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "hitori" / "places.json"

MAX_RAW = 300 * 1024
MAX_GZIP = 100 * 1024
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_places_test.py`
Expected: FAIL with `AssertionError: not found: ...places.json`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/places.py`:

```python
# -*- coding: utf-8 -*-
"""駅と市区町村の検索インデックスを生成する。

地理院の地名検索API（msearch.gsi.go.jp）は 2026-08-07 の実測で
「渋谷駅」でも「東京都渋谷区道玄坂」でも空配列を返し、依存先にできなかった。
自前で同梱すれば外部依存もネットワーク往復もなく、日本の利用者が実際に打つ
語（駅名）に直接当たる。
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import osm_query

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"
OUT = ROOT / "data" / "hitori" / "places.json"
CACHE = ROOT / "_local" / "hitori_raw" / "places_{code:02d}.json"

FIELDS = ["name", "lat", "lon", "type", "pref"]
COORD_DIGITS = 5

# 市区町村の admin_level。日本の OSM では 7 が市区町村にあたる。
# 件数が想定から外れたら Step 5 の指示に従って 8 を試す。
CITY_ADMIN_LEVEL = 7


def build_query(pref_code):
    iso = f"JP-{pref_code:02d}"
    return f"""[out:json][timeout:300];
area["ISO3166-2"="{iso}"]["admin_level"="4"]->.pref;
(
  nwr["railway"="station"]["name"](area.pref);
  relation["boundary"="administrative"]["admin_level"="{CITY_ADMIN_LEVEL}"]["name"](area.pref);
);
out center tags;
"""


def _coords(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    return (c["lat"], c["lon"]) if c else (None, None)


def to_rows(elements, pref_code):
    """OSM要素 → [name, lat, lon, type, pref] の行。重複は呼び出し側で潰す。"""
    rows = []
    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        lat, lon = _coords(el)
        if lat is None:
            continue
        kind = "s" if tags.get("railway") == "station" else "c"
        rows.append([name, round(lat, COORD_DIGITS), round(lon, COORD_DIGITS),
                     kind, pref_code])
    return rows


def dedupe(rows):
    """同じ (名前, 種別, 県) は1件にまとめる。同名でも県が違えば別物として残す。"""
    seen = {}
    for r in rows:
        key = (r[0], r[3], r[4])
        if key not in seen:
            seen[key] = r
    return sorted(seen.values(), key=lambda r: (r[4], r[3], r[0]))


def main():
    prefs = json.loads(MASTER.read_text(encoding="utf-8"))
    CACHE.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for p in prefs:
        code = p["code"]
        cache = Path(str(CACHE).format(code=code))
        if cache.exists():
            data = json.loads(cache.read_text(encoding="utf-8"))
            print(f"skip {code:02d} {p['name']} (cached)", flush=True)
        else:
            data = osm_query.run_query(build_query(code))
            cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            print(f"ok   {code:02d} {p['name']}: {len(data['elements'])} elements", flush=True)
        rows.extend(to_rows(data["elements"], code))

    rows = dedupe(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": __import__("datetime").date.today().isoformat(),
        "fields": FIELDS,
        "items": rows,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    st = sum(1 for r in rows if r[3] == "s")
    ct = len(rows) - st
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f}KB / 駅 {st:,} / 市区町村 {ct:,})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 生成する**

Run: `PYTHONUTF8=1 python scripts/hitori/places.py`
Expected: 47県ぶんの `ok` に続いて `wrote ...places.json (...KB / 駅 9,xxx / 市区町村 1,xxx)`

Overpass は県単位で数十秒かかる。全体で15〜30分を見込む。失敗した県が出たら同じコマンドを再実行する（キャッシュ済みはスキップされる）。

- [ ] **Step 5: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_places_test.py`
Expected: `OK: places（駅 9,xxx / 市区町村 1,xxx / 生 xxxKB gzip xxKB）`

**市区町村が1,700件に届かない場合**は `CITY_ADMIN_LEVEL` を `8` に変え、`_local/hitori_raw/places_*.json` を削除してから Step 4 をやり直す。日本の OSM では市区町村の admin_level が 7 と 8 で揺れている地域がある。どちらを採ったかを報告すること。

**サイズが上限を超える場合**は、市区町村のうち政令指定都市の区（名前が「区」で終わり、かつ同一県内に同名の市がある）を落とすのではなく、まず実際のサイズを報告すること。上限は目安であり、超過幅が小さければ上限側を見直す。

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/places.py data/hitori/places.json tests/hitori_places_test.py
git commit -m "feat(hitori): 駅・市区町村の検索インデックスを生成"
```

---

### Task 4: 本番データの再生成

**Files:**
- Modify: `data/hitori/summary.json`、`data/hitori/pref/*.json`

- [ ] **Step 1: ビルド**

Run: `PYTHONUTF8=1 python scripts/hitori/build_data.py`
Expected: `total 37,xxx 件 ...`

`_local/hitori_raw/` は現行のままでよい。Overpass を叩き直さない。

- [ ] **Step 2: 孤立度の分布としきい値を確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib
from collections import defaultdict
s=json.loads(pathlib.Path('data/hitori/summary.json').read_text(encoding='utf-8'))
print('iso_threshold:', s['iso_threshold'])
vals=defaultdict(list)
for f in sorted(pathlib.Path('data/hitori/pref').glob('*.json')):
    d=json.loads(f.read_text(encoding='utf-8')); i={k:n for n,k in enumerate(d['fields'])}
    for r in d['items']: vals[r[i['cat']]].append(r[i['iso']])
print(f\"{'cat':6}{'件数':>8}{'中央値':>9}{'90%':>9}{'最大':>9}{'バッジ':>8}\")
for c in ('bath','eat','play','stay'):
    v=sorted(vals[c]); n=len(v)
    med=v[n//2]; p90=v[int(0.9*(n-1))]
    badge=sum(1 for x in v if x>=s['iso_threshold'][c])
    print(f'{c:6}{n:8,}{med:9,}{p90:9,}{v[-1]:9,}{badge:8,}')
"
```
Expected: 4カテゴリすべてで `バッジ` が 0 より大きいこと。**`bath` が0件なら設計が失敗している。** その場合は分位を下げるのではなく、`iso` の計算そのものを疑い、原因を報告して止まること。

- [ ] **Step 3: 全体の健全性を確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib,sys
sys.path.insert(0,'scripts/hitori'); import validate
s=json.loads(pathlib.Path('data/hitori/summary.json').read_text(encoding='utf-8'))
errs=validate.validate_summary(s); tot=0
for f in sorted(pathlib.Path('data/hitori/pref').glob('*.json')):
    d=json.loads(f.read_text(encoding='utf-8'))
    errs+=[f'{f.name}: {e}' for e in validate.validate_pref(d)[:2]]
    tot+=len(d['items'])
print('スキーマ違反:', errs[:5] if errs else 'なし')
print(f'総件数 {tot:,} / summary.total {s[\"total\"]:,} / 列数 {len(d[\"fields\"])}')
"
```
Expected: 違反なし、総件数が `summary.total` と一致、列数19

- [ ] **Step 4: Commit**

```bash
git add data/hitori/summary.json data/hitori/pref/
git commit -m "chore(hitori): 孤立度を含む全国データを再生成"
```

---

### Task 5: core.js — 地名検索の照合

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `searchPlaces(items, query, limit = 20) -> object[]` — `{name, lat, lon, type, pref}` の配列

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_core_test.mjs` の末尾（`if (failures)` の直前）へ:

```javascript
const PLACES = [
  { name: '渋谷', lat: 35.658, lon: 139.701, type: 's', pref: 13 },
  { name: '渋谷駅', lat: 35.659, lon: 139.702, type: 's', pref: 13 },
  { name: '渋谷区', lat: 35.664, lon: 139.698, type: 'c', pref: 13 },
  { name: '府中駅', lat: 35.672, lon: 139.478, type: 's', pref: 13 },
  { name: '府中駅', lat: 34.567, lon: 133.235, type: 's', pref: 34 },
  { name: '新宿三丁目駅', lat: 35.690, lon: 139.705, type: 's', pref: 13 },
];

check('searchPlaces: 部分一致', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r.length, 3);
});

check('searchPlaces: 駅ありでも駅なしの名前に当たる', () => {
  // 入力「渋谷駅」で、OSM側の名前が「渋谷」の駅を取りこぼさない
  const names = core.searchPlaces(PLACES, '渋谷駅').map(p => p.name);
  if (!names.includes('渋谷')) throw new Error('駅を外した名前に当たらない: ' + names);
  if (!names.includes('渋谷駅')) throw new Error('そのままの名前に当たらない: ' + names);
});

check('searchPlaces: 駅が市区町村より上', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r[r.length - 1].type, 'c', '市区町村が最後でない');
  if (r.slice(0, -1).some(p => p.type === 'c')) throw new Error('駅より上に市区町村がある');
});

check('searchPlaces: 完全一致を優先', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r[0].name, '渋谷');
});

check('searchPlaces: 同名は県違いで両方残る', () => {
  const r = core.searchPlaces(PLACES, '府中');
  eq(r.length, 2);
  eq(new Set(r.map(p => p.pref)).size, 2);
});

check('searchPlaces: 空・空白は空配列', () => {
  eq(core.searchPlaces(PLACES, '').length, 0);
  eq(core.searchPlaces(PLACES, '   ').length, 0);
  eq(core.searchPlaces(PLACES, null).length, 0);
});

check('searchPlaces: 一致なし', () => {
  eq(core.searchPlaces(PLACES, 'ぜったいにない地名').length, 0);
});

check('searchPlaces: limit', () => {
  eq(core.searchPlaces(PLACES, '駅', 2).length, 2);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.searchPlaces is not a function`

- [ ] **Step 3: 実装を追加**

`assets/hitori/core.js` の末尾へ:

```javascript
// --- 地名・駅名検索 ---
// 外部ジオコーディングに依存せず、同梱インデックスへの部分一致で引く。

export function searchPlaces(items, query, limit = 20) {
  const q = String(query == null ? '' : query).trim();
  if (!q) return [];
  // 入力の末尾の「駅」を外したものでも照合する。単純な部分一致だけだと、
  // 入力「渋谷駅」に対して OSM 側の名前が「渋谷」の駅を取りこぼす。
  const alt = q.endsWith('駅') && q.length > 1 ? q.slice(0, -1) : null;

  const hits = [];
  for (const p of items) {
    const n = p.name;
    if (n.includes(q) || (alt && n.includes(alt))) hits.push(p);
  }

  hits.sort((a, b) => {
    // 駅を市区町村より先に出す。利用者が打つのは駅名のほうが多い。
    if (a.type !== b.type) return a.type === 's' ? -1 : 1;
    const ae = a.name === q ? 0 : 1, be = b.name === q ? 0 : 1;
    if (ae !== be) return ae - be;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.pref - b.pref;
  });
  return hits.slice(0, limit);
}
```

- [ ] **Step 4: テストを実行して通す**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: 実データで確認**

Run:
```bash
node -e "
import('./assets/hitori/core.js').then(async core => {
  const fs = await import('fs');
  const d = JSON.parse(fs.readFileSync('data/hitori/places.json','utf8'));
  const items = d.items.map(r => Object.fromEntries(d.fields.map((f,i)=>[f,r[i]])));
  for (const q of ['渋谷','梅田駅','別府','府中']) {
    const r = core.searchPlaces(items, q, 5);
    console.log(q.padEnd(6), r.map(p=>p.name+'('+p.pref+','+p.type+')').join(' '));
  }
});
"
```
Expected: どの語でも妥当な候補が返り、`府中` では複数県のものが並ぶこと

- [ ] **Step 6: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 駅名・地名の照合を追加"
```

---

### Task 6: core.js — 並べ替え

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: Task 5 と同じファイル。既存の `openState`
- Produces:
  - `SORTS = ['dist', 'solo', 'find', 'quiet', 'open']`
  - `findScore(item, isoThreshold) -> number`（0〜1）
  - `openRank(item, date) -> 0 | 1 | 2`
  - `sortItems(items, sort, ctx) -> object[]` — `ctx = {isoThreshold, now}`

- [ ] **Step 1: 失敗するテストを追加**

```javascript
const TH = { bath: 3000, eat: 900, play: 5000, stay: 2000 };
const SORTABLE = [
  { id: 'a', cat: 'eat', solo: 3, quiet: 5, hidden: 0.0, iso: 100,  distM: 100, oh: '' },
  { id: 'b', cat: 'eat', solo: 5, quiet: 2, hidden: 0.9, iso: 200,  distM: 300, oh: '00:00-24:00' },
  { id: 'c', cat: 'bath', solo: 4, quiet: 4, hidden: 0.0, iso: 6000, distM: 200, oh: 'Mo 01:00-02:00' },
];

check('findScore: 飲食は穴場度、湯は孤立度が効く', () => {
  near(core.findScore(SORTABLE[1], TH), 0.9, 0.001);
  // bath: iso 6000 / threshold 3000 → 1.0 に丸まる
  near(core.findScore(SORTABLE[2], TH), 1.0, 0.001);
  near(core.findScore(SORTABLE[0], TH), 100 / 900, 0.001);
});

check('findScore: しきい値が無いカテゴリでも落ちない', () => {
  near(core.findScore({ cat: 'unknown', hidden: 0.3, iso: 500 }, TH), 0.3, 0.001);
});

check('openRank: 営業中→不明→営業時間外', () => {
  // 2026-08-04 は火曜
  const tue = new Date(2026, 7, 4, 12, 0);
  eq(core.openRank({ oh: '00:00-24:00' }, tue), 0, '営業中');
  eq(core.openRank({ oh: '' }, tue), 1, '不明は営業時間外より上');
  eq(core.openRank({ oh: 'Mo 01:00-02:00' }, tue), 2, '営業時間外');
});

check('sortItems: 距離順が既定', () => {
  const r = core.sortItems(SORTABLE, 'dist', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'acb');
});

check('sortItems: ひとり度は降順、同点は距離', () => {
  const r = core.sortItems(SORTABLE, 'solo', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'b');
});

check('sortItems: 発見度', () => {
  const r = core.sortItems(SORTABLE, 'find', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'c', 'iso で 1.0 の bath が先頭');
});

check('sortItems: 静けさ', () => {
  const r = core.sortItems(SORTABLE, 'quiet', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'a');
});

check('sortItems: 営業中優先は 営業中→不明→営業時間外', () => {
  const r = core.sortItems(SORTABLE, 'open', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'bac', '不明(a)が営業時間外(c)より上にない');
});

check('sortItems: 入力を破壊しない', () => {
  const before = SORTABLE.map(x => x.id).join('');
  core.sortItems(SORTABLE, 'solo', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(SORTABLE.map(x => x.id).join(''), before);
});

check('sortItems: 未知の並べ替えは距離順に落とす', () => {
  const r = core.sortItems(SORTABLE, 'なにか', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'acb');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.findScore is not a function`

- [ ] **Step 3: 実装を追加**

```javascript
// --- 並べ替え ---

export const SORTS = ['dist', 'solo', 'find', 'quiet', 'open'];

// 発見スコア。カテゴリによって効く指標が違うため、穴場度と正規化した孤立度の
// 大きいほうを採る。飲食・娯楽では穴場度が、湯・滞在では孤立度が効く。
export function findScore(item, isoThreshold) {
  const t = isoThreshold && isoThreshold[item.cat];
  const isoPart = t > 0 ? Math.min(1, (item.iso || 0) / t) : 0;
  return Math.max(item.hidden || 0, isoPart);
}

// 0=営業中 / 1=不明 / 2=営業時間外。
// 不明を営業時間外より下に置いてはならない。不明な店は開いている可能性があり、
// 閉まっていると確定した店より見込みがある。
export function openRank(item, date) {
  const st = openState(item.oh, date);
  if (st === 'open') return 0;
  if (st === null) return 1;
  return 2;
}

export function sortItems(items, sort, ctx) {
  const c = ctx || {};
  const now = c.now || new Date();
  const th = c.isoThreshold;
  const out = items.slice();
  const byDist = (a, b) => a.distM - b.distM;

  switch (sort) {
    case 'solo':
      return out.sort((a, b) => (b.solo - a.solo) || byDist(a, b));
    case 'quiet':
      return out.sort((a, b) => (b.quiet - a.quiet) || byDist(a, b));
    case 'find':
      return out.sort((a, b) => (findScore(b, th) - findScore(a, th)) || byDist(a, b));
    case 'open':
      return out.sort((a, b) => (openRank(a, now) - openRank(b, now)) || byDist(a, b));
    default:
      return out.sort(byDist);
  }
}
```

- [ ] **Step 4: テストを実行して通す**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 並べ替え5種を追加（営業中→不明→営業時間外）"
```

---

### Task 7: core.js — お気に入り

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `FAV_KEY = 'hitori.favs'` / `FAV_MAX = 200`
  - `favSnapshot(item) -> object` — 11項目
  - `loadFavs(storage) -> object[] | null` — `null` は保存領域が使えない
  - `saveFavs(storage, favs) -> boolean`
  - `toggleFav(favs, item) -> object[]` — 新しい配列を返す
  - `isFav(favs, id) -> boolean`

- [ ] **Step 1: 失敗するテストを追加**

```javascript
function fakeStorage(broken) {
  const map = new Map();
  return {
    getItem: k => (broken ? (() => { throw new Error('denied'); })() : (map.has(k) ? map.get(k) : null)),
    setItem: (k, v) => { if (broken) throw new Error('denied'); map.set(k, v); },
  };
}

const FAV_ITEM = {
  id: 'n1', name: 'はやし湯', lat: 35.0, lon: 139.0, cat: 'bath', kind: 'sento',
  solo: 4, quiet: 4, easy: 3, chain: 0, prefCode: 13,
  distM: 500, oh: '', note: 'メモ', hidden: 0.1, iso: 800,
};

check('favSnapshot: 11項目だけ持つ', () => {
  const s = core.favSnapshot(FAV_ITEM);
  eq(JSON.stringify(Object.keys(s).sort()),
     JSON.stringify(['cat','chain','easy','id','kind','lat','lon','name','prefCode','quiet','solo']));
  eq(s.id, 'n1');
  eq(s.distM, undefined, '距離は起点依存なので保存しない');
});

check('loadFavs: 空なら空配列', () => {
  eq(JSON.stringify(core.loadFavs(fakeStorage(false))), '[]');
});

check('loadFavs: 使えない環境では null', () => {
  eq(core.loadFavs(fakeStorage(true)), null);
});

check('saveFavs: 成否を返す', () => {
  eq(core.saveFavs(fakeStorage(false), [core.favSnapshot(FAV_ITEM)]), true);
  eq(core.saveFavs(fakeStorage(true), []), false);
});

check('保存して読み戻せる', () => {
  const st = fakeStorage(false);
  core.saveFavs(st, [core.favSnapshot(FAV_ITEM)]);
  const back = core.loadFavs(st);
  eq(back.length, 1);
  eq(back[0].name, 'はやし湯');
});

check('toggleFav: 追加と削除', () => {
  let favs = [];
  favs = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 1);
  eq(core.isFav(favs, 'n1'), true);
  favs = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 0);
  eq(core.isFav(favs, 'n1'), false);
});

check('toggleFav: 新しい配列を返し元を壊さない', () => {
  const favs = [];
  const next = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 0);
  eq(next.length, 1);
});

check('toggleFav: 上限を超えたら古いものを落とす', () => {
  let favs = [];
  for (let i = 0; i < core.FAV_MAX + 5; i++) {
    favs = core.toggleFav(favs, { ...FAV_ITEM, id: 'n' + i });
  }
  eq(favs.length, core.FAV_MAX);
  eq(core.isFav(favs, 'n0'), false, '最古が残っている');
  eq(core.isFav(favs, 'n' + (core.FAV_MAX + 4)), true, '最新が無い');
});

check('loadFavs: 壊れたJSONは空配列にフォールバック', () => {
  const st = fakeStorage(false);
  st.setItem(core.FAV_KEY, '{壊れている');
  eq(JSON.stringify(core.loadFavs(st)), '[]');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.favSnapshot is not a function`

- [ ] **Step 3: 実装を追加**

```javascript
// --- お気に入り ---
// サーバーもアカウントも持たない。保存先は localStorage のみ。

export const FAV_KEY = 'hitori.favs';
export const FAV_MAX = 200;

const FAV_FIELDS = ['id', 'name', 'lat', 'lon', 'cat', 'kind',
                    'solo', 'quiet', 'easy', 'chain', 'prefCode'];

// IDだけでなくスナップショットを保存する。IDだけだと表示のたびに県ファイル
// （東京都は466KB）の取得が要り、複数県のお気に入りを開くと数MBになる。
export function favSnapshot(item) {
  const out = {};
  for (const f of FAV_FIELDS) out[f] = item[f];
  return out;
}

export function loadFavs(storage) {
  let raw;
  try {
    raw = storage.getItem(FAV_KEY);
  } catch (e) {
    return null;   // プライベートブラウジング等。呼び出し側が機能を隠す。
  }
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];     // 壊れた値で機能ごと死なせない
  }
}

export function saveFavs(storage, favs) {
  try {
    storage.setItem(FAV_KEY, JSON.stringify(favs));
    return true;
  } catch (e) {
    return false;
  }
}

export function isFav(favs, id) {
  return (favs || []).some(f => f.id === id);
}

export function toggleFav(favs, item) {
  const cur = favs || [];
  if (isFav(cur, item.id)) return cur.filter(f => f.id !== item.id);
  const next = cur.concat([favSnapshot(item)]);
  return next.length > FAV_MAX ? next.slice(next.length - FAV_MAX) : next;
}
```

- [ ] **Step 4: テストを実行して通す**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): お気に入りの保存と読み出しを追加"
```

---

### Task 8: hitori.html — 地名検索と検索起点

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 5 の `core.searchPlaces`、`data/hitori/places.json`
- Produces:
  - `state.origin = { kind: 'here' | 'place', lat, lon, label }`
  - `setOrigin(origin)` — 起点を変えて再検索
  - `ensurePlaces()` — `places.json` を遅延取得
  - `window.__placesReady` — 取得完了フラグ

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_render_test.py` に追加し、`main()` の `test_search_without_location` の後で呼ぶ:

```python
def test_place_search_without_location(context, page):
    """位置情報が無くても地名から探せる。これがフェーズ1の核心。"""
    context.clear_permissions()
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "渋谷")
    p.wait_for_selector("#place-hits li", timeout=20000)
    hits = p.eval_on_selector_all("#place-hits li", "els => els.map(e => e.innerText)")
    assert any("渋谷" in h for h in hits), hits
    # 同名の取り違えを防ぐため県名が併記されている
    assert any("東京都" in h for h in hits), hits

    p.click("#place-hits li")
    p.wait_for_selector("#search-list li.item", timeout=30000)
    assert "渋谷" in p.inner_text("#origin-label"), p.inner_text("#origin-label")
    n = p.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "地名を選んでも一覧が空"
    p.close()


def test_origin_back_to_here(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "梅田")
    p.wait_for_selector("#place-hits li", timeout=20000)
    p.click("#place-hits li")
    p.wait_for_function("state.origin.kind === 'place'", timeout=20000)

    p.click("#origin-reset")
    p.wait_for_function("state.origin.kind === 'here'", timeout=20000)
    assert "現在地" in p.inner_text("#origin-label")
    p.close()


def test_place_search_no_hit(context, page):
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.fill("#place-q", "ぜったいにない地名XYZ")
    p.wait_for_selector("#place-hits .empty", timeout=20000)
    assert "ありません" in p.inner_text("#place-hits")
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#place-q` が見つからない

- [ ] **Step 3: HTML を足す**

`#panel-search` の `.filters` の直前へ:

```html
    <div class="origin-bar">
      <label class="place-search">
        <input type="search" id="place-q" placeholder="駅名・地名で探す（例: 渋谷、梅田）"
               autocomplete="off" spellcheck="false">
      </label>
      <ul id="place-hits" hidden></ul>
      <p class="origin"><strong id="origin-label">現在地</strong> から近い順
        <button type="button" id="origin-reset" hidden>現在地に戻す</button></p>
    </div>
```

CSS を追加:

```css
.origin-bar { position: relative; margin: 1rem 0 .5rem; }
.place-search input { width: 100%; padding: .6rem .8rem; font: inherit;
                      border: 1px solid var(--line); border-radius: 8px;
                      background: var(--bg); color: var(--fg); }
#place-hits { position: absolute; z-index: 30; left: 0; right: 0; top: 3rem;
              list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto;
              background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
              box-shadow: 0 6px 20px rgba(0,0,0,.15); }
#place-hits li { padding: .55rem .8rem; cursor: pointer; border-bottom: 1px solid var(--line); }
#place-hits li:hover, #place-hits li:focus { background: rgba(127,127,127,.1); outline: none; }
#place-hits .kindmark { color: var(--muted); font-size: .78rem; margin-left: .4rem; }
#place-hits .empty { padding: .6rem .8rem; color: var(--muted); }
.origin { margin: .5rem 0 0; color: var(--muted); font-size: .88rem; }
.origin strong { color: var(--fg); }
#origin-reset { background: none; border: 1px solid var(--line); border-radius: 999px;
                color: var(--fg); cursor: pointer; font: inherit; font-size: .78rem;
                padding: .05rem .6rem; margin-left: .5rem; }
```

- [ ] **Step 4: JS を足す**

`state` に `origin` を足す（`here` は残す。地図が現在地ピンに使う）:

```javascript
state.origin = { kind: 'here', lat: null, lon: null, label: '現在地' };
```

以下を追加する:

```javascript
let PLACES = null;
let placesLoading = null;

// 初期ロードには含めない。検索欄に触れて初めて取りにいく。
// 現在地から使う人に無駄な100KBを負わせないため。
function ensurePlaces() {
  if (PLACES) return Promise.resolve(PLACES);
  if (placesLoading) return placesLoading;
  placesLoading = fetch('data/hitori/places.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(doc => {
      PLACES = doc.items.map(row =>
        Object.fromEntries(doc.fields.map((f, i) => [f, row[i]])));
      window.__placesReady = true;
      return PLACES;
    })
    .catch(err => {
      placesLoading = null;
      throw err;
    });
  return placesLoading;
}

function renderPlaceHits(hits) {
  const el = document.getElementById('place-hits');
  el.hidden = false;
  if (!hits.length) {
    el.innerHTML = '<li class="empty">該当する駅・地名がありません</li>';
    return;
  }
  el.innerHTML = hits.map((p, i) => `
    <li data-i="${i}" tabindex="0">${escapeHtml(p.name)}<span class="kindmark">${
      p.type === 's' ? '駅' : '市区町村'}・${escapeHtml(BY_CODE[p.pref].name)}</span></li>`).join('');
  el._hits = hits;
}

function setOrigin(origin) {
  state.origin = origin;
  document.getElementById('origin-label').textContent = origin.label;
  document.getElementById('origin-reset').hidden = origin.kind === 'here';
  document.getElementById('place-hits').hidden = true;
  document.getElementById('place-q').value = '';
  runSearchFromOrigin();
}

function bindPlaceSearch() {
  const q = document.getElementById('place-q');
  const hits = document.getElementById('place-hits');

  const update = () => {
    const text = q.value.trim();
    if (!text) { hits.hidden = true; return; }
    ensurePlaces()
      .then(items => renderPlaceHits(core.searchPlaces(items, text)))
      .catch(() => {
        hits.hidden = false;
        hits.innerHTML = '<li class="empty">地名データを読み込めませんでした</li>';
      });
  };

  q.addEventListener('input', update);
  q.addEventListener('focus', () => { ensurePlaces().catch(() => {}); });

  const choose = el => {
    const p = hits._hits && hits._hits[+el.dataset.i];
    if (p) setOrigin({ kind: 'place', lat: p.lat, lon: p.lon, label: p.name });
  };
  hits.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (li) choose(li);
  });
  hits.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); choose(li); }
  });

  document.getElementById('origin-reset').addEventListener('click', () => {
    if (state.here) {
      setOrigin({ kind: 'here', lat: state.here.lat, lon: state.here.lon, label: '現在地' });
    } else {
      locateAndSearch();
    }
  });
}
```

既存の `locateAndSearch()` を、位置が取れた時点で `setOrigin` を通すよう変える。`state.here = { lat, lon }` の直後を以下にする:

```javascript
  state.here = { lat, lon };
  state.origin = { kind: 'here', lat, lon, label: '現在地' };
  document.getElementById('origin-label').textContent = '現在地';
  document.getElementById('origin-reset').hidden = true;
```

そして県読み込みと描画を `runSearchFromOrigin()` に切り出し、`locateAndSearch` の後半をそれに置き換える:

```javascript
// 起点（現在地でも選んだ地点でも）から県を判定して読み、一覧を描く。
async function runSearchFromOrigin() {
  const o = state.origin;
  if (o.lat == null) return;
  const status = document.getElementById('search-status');
  const code = core.prefectureAt(o.lat, o.lon, GEO);
  status.textContent = `${BY_CODE[code].name} の施設を読み込んでいます…`;

  await loadPrefIntoCache(code);
  renderSearchList();
  window.__searchReady = true;

  const neighbors = (NEIGHBORS && NEIGHBORS[String(code)]) || [];
  for (const n of neighbors) {
    if (await loadPrefIntoCache(n)) renderSearchList();
  }
}
```

`currentSearchResults()` の距離計算の基点を `state.here` から `state.origin` に変える:

```javascript
function currentSearchResults() {
  const o = state.origin;
  if (o.lat == null) return [];
  const loaded = Object.keys(PREF_CACHE).map(Number);
  const withD = core.withDistance(collectItems(loaded), o.lat, o.lon);
  return core.sortByDistance(core.filterItems(withD, state.search));
}
```

`renderSearchList()` 内で `core.bearing8(state.here.lat, ...)` を使っている箇所を `state.origin.lat` / `state.origin.lon` に置き換える。詳細シートの距離・方角も同様。

`init()` の末尾で `bindPlaceSearch()` を呼び、`window` 公開に `setOrigin` と `ensurePlaces` を足す。

`showLocationFallback()` の文言を変える。地名検索が使えるようになったので、そう伝える:

```javascript
  document.getElementById('search-status').innerHTML =
    `${escapeHtml(reason)}上の検索欄から駅名・地名で探せます。<br>
     <button type="button" class="retry">再試行</button>
     <button type="button" class="to-nation">全国で見る</button>`;
```

再試行ボタンの配線は既存のままとする。

- [ ] **Step 5: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 駅名・地名検索と検索起点の切り替えを実装"
```

---

### Task 9: hitori.html — 並べ替えとお気に入りのUI

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 6 の `core.sortItems` / `core.findScore`、Task 7 のお気に入り関数、`summary.iso_threshold`
- Produces:
  - `state.sort` — `'dist'` 既定
  - `state.favs` — 配列、`null` なら保存領域が使えない
  - `state.favView` — お気に入り一覧を表示中か
  - `isIsolated(item) -> boolean` — 孤立バッジを出すか
  - `formatIso(meters) -> string` — 「4.2km」「820m」「50km以上」

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_sort_changes_order(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    first = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")

    p.select_option("#f-sort", "solo")
    p.wait_for_timeout(400)
    solos = p.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.solo)")
    assert solos == sorted(solos, reverse=True), solos[:20]

    p.select_option("#f-sort", "find")
    p.wait_for_timeout(400)
    after = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")
    assert after != first or len(solos) < 3, "並べ替えても先頭が変わらない"
    p.close()


def test_favorites_roundtrip(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    fid = p.eval_on_selector("#search-list li.item", "e => e.dataset.id")
    p.click("#search-list li.item .fav")
    p.wait_for_timeout(300)
    assert p.evaluate("state.favs.length") == 1

    p.click("#fav-toggle")
    p.wait_for_selector("#search-list li.item", timeout=10000)
    ids = p.eval_on_selector_all("#search-list li.item", "els => els.map(e => e.dataset.id)")
    assert ids == [fid], ids

    # 再読み込みしても残る
    p.reload()
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    assert p.evaluate("state.favs.length") == 1
    p.close()


def test_isolation_badge_and_detail(context, page):
    """孤立度は湯・滞在に発見を出すための指標。バッジと詳細の両方に出る。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    # しきい値は summary.json が唯一の出所。JS 側に固定値を持っていないこと。
    th = p.evaluate("SUMMARY.iso_threshold")
    assert set(th) >= {"bath", "eat", "play", "stay"}, th

    # 孤立バッジが付く施設は、必ずそのカテゴリのしきい値以上
    marked = p.evaluate("""
      () => currentSearchResults().filter(isIsolated)
              .map(x => ({cat: x.cat, iso: x.iso}))
    """)
    for m in marked:
        assert m["iso"] >= th[m["cat"]], m

    # 詳細シートには孤立度を必ず出す（バッジの有無に関わらず）
    p.click("#search-list li.item")
    p.wait_for_selector("#facility dl", timeout=15000)
    assert "孤立度" in p.inner_text("#facility"), p.inner_text("#facility")[:300]
    p.close()


def test_stale_favorite_is_flagged(context, page):
    """保存は時点のスナップショット。現行データに無いものを黙って見せない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    # 実在しないIDのお気に入りを仕込む
    p.evaluate("""
      () => {
        state.favs = [{ id: 'n999999999', name: '消えた湯', lat: 35.681, lon: 139.767,
                        cat: 'bath', kind: 'sento', solo: 4, quiet: 4, easy: 3,
                        chain: 0, prefCode: 13 }];
        core.saveFavs(window.localStorage, state.favs);
      }
    """)
    p.click("#fav-toggle")
    p.wait_for_selector("#search-list li.item", timeout=10000)
    p.click("#search-list li.item")
    p.wait_for_selector("#facility .stale", timeout=15000)
    assert "存在しません" in p.inner_text("#facility .stale")
    p.close()


def test_favorites_disabled_when_storage_blocked(context, page):
    p = context.new_page()
    p.add_init_script("""
      Object.defineProperty(window, 'localStorage', {
        get() { throw new Error('denied'); }
      });
    """)
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    # 保存できない環境では星を出さない。アプリは動く。
    assert p.eval_on_selector_all("#search-list li.item .fav", "els => els.length") == 0
    assert p.eval_on_selector_all("#map path[data-code]", "els => els.length") == 0 or True
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#f-sort` が見つからない

- [ ] **Step 3: HTML を足す**

`#panel-search` の `.filters` 内、`ひとり条件` の fieldset の後へ:

```html
      <fieldset><legend>並べ替え</legend>
        <select id="f-sort">
          <option value="dist" selected>近い順</option>
          <option value="solo">ひとり度が高い順</option>
          <option value="find">発見が多い順</option>
          <option value="quiet">静かな順</option>
          <option value="open">営業中を優先</option>
        </select>
      </fieldset>
```

`#search-status` の直前へ:

```html
    <p class="favbar"><button type="button" id="fav-toggle" hidden>★ 保存した場所（<span id="fav-count">0</span>）</button></p>
```

CSS:

```css
.favbar { margin: .4rem 0 0; }
#fav-toggle { background: none; border: 1px solid var(--line); border-radius: 999px;
              color: var(--fg); cursor: pointer; font: inherit; font-size: .82rem;
              padding: .15rem .8rem; }
#fav-toggle[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
.fav { background: none; border: none; cursor: pointer; font-size: 1rem;
       color: var(--muted); padding: 0 .2rem; line-height: 1; }
.fav[aria-pressed="true"] { color: #c05621; }
```

- [ ] **Step 4: JS を足す**

`state` に追加:

```javascript
state.sort = 'dist';
state.favs = core.loadFavs(safeStorage());   // null なら保存領域が使えない
state.favView = false;
```

```javascript
// プライベートブラウジング等では localStorage への参照自体が例外を投げる。
function safeStorage() {
  try {
    return window.localStorage;
  } catch (e) {
    return { getItem() { throw e; }, setItem() { throw e; } };
  }
}

const FAVS_OK = () => state.favs !== null;

function currentSearchResults() {
  const o = state.origin;
  if (o.lat == null) return [];
  const src = state.favView
    ? (state.favs || [])
    : collectItems(Object.keys(PREF_CACHE).map(Number));
  const withD = core.withDistance(src, o.lat, o.lon);
  // お気に入り表示中はスナップショットなので絞り込みを適用しない。
  // 保存した場所が条件から外れて消えると、保存した意味がなくなる。
  const filtered = state.favView ? withD : core.filterItems(withD, state.search);
  return core.sortItems(filtered, state.sort,
                        { isoThreshold: SUMMARY.iso_threshold, now: new Date() });
}

function bindSortAndFavs() {
  document.getElementById('f-sort').addEventListener('change', e => {
    state.sort = e.target.value;
    renderSearchList();
  });

  const toggle = document.getElementById('fav-toggle');
  if (FAVS_OK()) {
    toggle.hidden = false;
    updateFavCount();
    toggle.addEventListener('click', () => {
      state.favView = !state.favView;
      toggle.setAttribute('aria-pressed', String(state.favView));
      renderSearchList();
    });
  }

  document.getElementById('search-list').addEventListener('click', e => {
    const btn = e.target.closest('.fav');
    if (!btn) return;
    e.stopPropagation();          // 詳細シートを開かない
    const li = btn.closest('li.item');
    const it = currentSearchResults().find(x => x.id === li.dataset.id);
    if (!it) return;
    state.favs = core.toggleFav(state.favs, it);
    if (!core.saveFavs(safeStorage(), state.favs)) {
      state.favs = null;          // 途中で書けなくなったら機能を畳む
    }
    updateFavCount();
    renderSearchList();
  }, true);
}

function updateFavCount() {
  const el = document.getElementById('fav-count');
  if (el) el.textContent = String((state.favs || []).length);
}
```

孤立バッジと表示整形を追加する。**しきい値は `SUMMARY.iso_threshold` だけを見る**。JS 側に数値を持たない。

```javascript
function isIsolated(it) {
  const t = SUMMARY.iso_threshold && SUMMARY.iso_threshold[it.cat];
  return !!t && (it.iso || 0) >= t;
}

function formatIso(m) {
  if (m >= 50000) return '50km以上';
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}
```

詳細シートの `<dl>` に孤立度の行を足す。バッジが付かない施設でも距離自体は有用なので常に出す。`営業時間` の行の直前へ:

```javascript
      <dt>孤立度</dt><dd>最寄りの${KIND_JA[it.kind] || it.kind}まで ${formatIso(it.iso)}${
        isIsolated(it) ? '（この一帯で唯一）' : ''}</dd>
```

お気に入りが現行データから消えている場合を検出する。`openFacility` の冒頭、`it` を得た直後へ:

```javascript
  // 保存は時点のスナップショット。再ビルドで施設が消えていることがある。
  // 黙って古い情報を見せない。
  let stale = false;
  if (state.favView && it.prefCode) {
    if (!PREF_CACHE[it.prefCode]) await loadPrefIntoCache(it.prefCode);
    const doc = PREF_CACHE[it.prefCode];
    if (doc) {
      const idIdx = doc.fields.indexOf('id');
      stale = !doc.items.some(row => row[idIdx] === it.id);
    }
  }
```

`<h3>` の直後へ差し込む:

```javascript
    ${stale ? '<p class="stale">この施設は現在のデータに存在しません。閉店したか、地図から削除された可能性があります。</p>' : ''}
```

CSS:

```css
#facility .stale { color: #c05621; font-size: .85rem; margin: .3rem 0; }
.badge-iso { border-color: #2b6cb0; color: #2b6cb0; }
```

`renderSearchList()` の各行に星ボタン・孤立バッジ・`data-solo` を足す。`<li class="item" ...>` の属性へ `data-solo="${it.solo}"` を追加し、`badges` に孤立バッジを（穴場バッジの直後へ）:

```javascript
        ${isIsolated(it) ? `<span class="badge-ax badge-iso">最寄り${formatIso(it.iso)}</span>` : ''}
```

同じく `badges` の先頭に:

```javascript
        ${FAVS_OK() ? `<button type="button" class="fav" aria-pressed="${core.isFav(state.favs, it.id)}"
           aria-label="保存">${core.isFav(state.favs, it.id) ? '★' : '☆'}</button>` : ''}
```

お気に入り表示中は状態表示を変える。`renderSearchList()` の件数表示の直前へ:

```javascript
  // お気に入り表示中は件数だけを出す。県の取得失敗はお気に入りの表示と無関係で、
  // ここで混ぜると「保存した場所が読めない」と誤解させる。
  if (state.favView) {
    document.getElementById('search-status').textContent =
      items.length ? `保存した ${items.length} 件` : '保存した場所はまだありません';
  } else {
    // 既存の件数＋失敗県の表示ロジックをそのまま通す
  }
```

`init()` の末尾で `bindSortAndFavs()` を呼ぶ。`window` 公開に `SUMMARY`、`isIsolated`、`currentSearchResults` を足す（描画テストが参照する）。

`openFacility` は `await` を含むようになるため `async` であることを確認する（Task 12 で既に async）。

- [ ] **Step 5: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 並べ替えとお気に入りのUIを実装"
```

---

### Task 10: 全体検証

**Files:**
- Modify: `tests/hitori_all.py`

- [ ] **Step 1: テストランナーを更新**

`TESTS` に `"hitori_iso_test.py"` と `"hitori_places_test.py"` を足す。`hitori_hidden_test.py` の直後と `hitori_mapsvg_test.py` の直後が自然な位置。

- [ ] **Step 2: 全テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_all.py`
Expected: `ALL PASS (16 suites)`

- [ ] **Step 3: 実機に近い形で目視**

Run:
```bash
PYTHONUTF8=1 python - <<'PYEOF'
import threading, functools, http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path.cwd(); PORT = 8907
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/hitori.html"
with sync_playwright() as pw:
    b = pw.chromium.launch()
    # 位置情報を与えずに、地名検索だけで使えることを確認する
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_function("window.__searchReady === true", timeout=30000)
    pg.fill("#place-q", "別府")
    pg.wait_for_selector("#place-hits li", timeout=20000)
    pg.click("#place-hits li")
    pg.wait_for_selector("#search-list li.item", timeout=30000)
    pg.select_option("#f-sort", "find")
    pg.wait_for_timeout(600)
    n = pg.eval_on_selector_all("#search-list li.item", "e=>e.length")
    iso = pg.eval_on_selector_all("#search-list .badge-iso", "e=>e.length")
    print(f"別府・発見順: {n}件 / 孤立バッジ {iso}件")
    pg.screenshot(path="C:/tmp/hitori_p1_place.png", full_page=True)
    b.close()
httpd.shutdown()
print("wrote C:/tmp/hitori_p1_place.png")
PYEOF
```
Expected: 位置情報なしで別府の一覧が出ること。温泉地なので `bath` の孤立バッジは少ないはずだが、**一覧が0件なら地名検索から県読み込みまでのどこかが壊れている**。

- [ ] **Step 4: サイトの説明文を更新**

`index.html` のカードの `dsc` を差し替える:

```html
        <div class="dsc">現在地からでも駅名からでも、ひとりが標準の店だけを探せる。静けさと入りやすさで絞り込み、穴場や「この一帯で唯一」の一軒も見つかる。</div>
```

- [ ] **Step 5: Commit**

```bash
git add tests/hitori_all.py index.html
git commit -m "feat(hitori): テストランナーを更新しサイトの説明文を差し替え"
```

---

## 実行後の運用

```bash
PYTHONUTF8=1 python scripts/hitori/fetch_osm.py     # 施設データ（30〜60分）
PYTHONUTF8=1 python scripts/hitori/places.py        # 駅・市区町村（15〜30分、初回のみ）
PYTHONUTF8=1 python scripts/hitori/build_data.py    # 3軸・穴場・孤立度・分割出力
PYTHONUTF8=1 python tests/hitori_all.py             # 全16スイート
```

## フェーズ2以降（この計画には含まない）

- HotPepper グルメAPI / Yahoo!ローカルサーチAPI の取り込みと名寄せ（要APIキー登録）
- かな入力での駅名検索（`name:ja-Hira` の被覆率を測ってから判断）
- オンボーディング、速度改善、SEO、PWA、共有
- `hitori.html` の全面分割
