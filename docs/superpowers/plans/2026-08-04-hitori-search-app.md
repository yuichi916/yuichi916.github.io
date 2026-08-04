# ひとり歓迎マップ 検索アプリ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現行の県別ヒートマップを「全国で見る」タブへ退避させ、現在地から近い順に一人向け施設を探せる検索アプリへ作り替える。

**Architecture:** ビルド時に3軸スコア（ひとり耐性/静けさ/入りやすさ）と穴場スコアを全国の点集合に対して計算し、県別JSONへ固める。ランタイムは現在地を県境ポリゴンへ投影して都道府県を判定し、自県を先に描画してから隣接県を差し込む段階取得で近い順を出す。地図は地理院タイル。

**Tech Stack:** Python 3.10 標準ライブラリのみ、素の HTML+CSS+JS（ESモジュール）、MapLibre GL JS、地理院タイル、Playwright（描画テスト）、Node（純関数テスト）

## Global Constraints

- Python は **標準ライブラリのみ**。HTTP は `urllib.request`
- Python テストは `tests/hitori_*_test.py`、`main()` を持つ素のスクリプト。**pytest は使わない**
- JS の純関数テストは `tests/hitori_core_test.mjs`（Node、`node tests/hitori_core_test.mjs` で実行）
- テスト実行は必ず `PYTHONUTF8=1` を付ける。Windows のため UTF-8 強制が必須
- すべて UTF-8（BOMなし）。Python ファイル冒頭に `# -*- coding: utf-8 -*-`
- commit は Conventional Commits、scope は `hitori`
- `hitori.html` を commit する前に `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html` が exit 0
- **`hitori.html` にアフィリエイトリンクを置かない**（地球地図日本の非営利条件）
- 出典表記は以下を逐語で使う:
  - `地図データ: 地球地図日本（国土地理院）`
  - `地図タイル: 地理院タイル（国土地理院）`
  - `施設データ: © OpenStreetMap contributors (ODbL)`
  - `人口: Wikidata (CC0) / 令和2年国勢調査`
- 免責文も逐語: `この分類は OpenStreetMap のタグと業態から機械的に推定したものです。実際の座席形態や黙浴の有無を保証するものではありません。`
- チェーンフィルタのラベルは `チェーンを隠す`、補助は `判明しているチェーンのみ。地域チェーンは残る場合があります`。**「個人店だけ」と書かない**
- 営業時間が不明な施設は `営業時間不明` と出す。**営業中と偽らない**
- 距離は直線距離。徒歩分は 80m/分。画面には `徒歩5分（直線400m）` の形で両方出す

## Spec からの逸脱

spec §10 は `tests/hitori_hours_test.py` を挙げていたが、`opening_hours` の解釈はクライアント側の純関数であり、Playwright を起動せず Node で直接テストできる。**`assets/hitori/core.js` へ切り出し、`tests/hitori_core_test.mjs` でまとめてテストする**。距離・方角・県判定・絞り込みも同じファイルに入る。

`hitori.html` は現状700行あり、今回の追加で倍増する。DOM とフェッチを持たない純粋なロジックを `core.js` へ出すのは、テスト速度とファイルの見通しの両方で正当化できる。この repo には既に `assets/koe/koe-ep1.js` があり、複数ファイル構成は前例がある。

---

### Task 1: 3軸スコアへの拡張

**Files:**
- Modify: `scripts/hitori/scoring.py`
- Modify: `tests/hitori_scoring_test.py`

**Interfaces:**
- Consumes: 既存の `classify(tags) -> (cat, kind, base)`
- Produces:
  - `AXES: dict[str, tuple[int, int, int]]` — kind → (solo, quiet, easy)
  - `axes(kind, name, evidence, curated) -> dict` — `{"solo":int, "quiet":int, "easy":int}`
  - 既存の `score()` は削除し `axes()` に置き換える

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_scoring_test.py` の `test_score()` を丸ごと以下で置き換え、`main()` の `test_score()` を `test_axes()` に変える:

```python
def test_axes():
    # 業態ベース値。spec §5 の表がそのまま期待値。
    assert scoring.axes("library", "○○図書館", [], {}) == {"solo": 4, "quiet": 5, "easy": 5}
    assert scoring.axes("standing", "立ち食いそば まる", [], {}) == {"solo": 5, "quiet": 2, "easy": 2}
    assert scoring.axes("netcafe", "快活CLUB", [], {}) == {"solo": 5, "quiet": 5, "easy": 5}
    assert scoring.axes("sauna", "サウナ○○", [], {}) == {"solo": 5, "quiet": 5, "easy": 3}
    assert scoring.axes("karaoke", "○○カラオケ", [], {}) == {"solo": 4, "quiet": 2, "easy": 4}
    assert scoring.axes("sento", "はやし湯", [], {}) == {"solo": 4, "quiet": 4, "easy": 3}
    assert scoring.axes("onsen", "○○温泉", [], {}) == {"solo": 3, "quiet": 4, "easy": 3}
    assert scoring.axes("museum", "○○美術館", [], {}) == {"solo": 3, "quiet": 5, "easy": 5}

    # チェーン加点は solo にだけ効く。チェーンかどうかは静けさや作法と無関係。
    a = scoring.axes("ramen", "一蘭 渋谷店", [], {})
    assert a == {"solo": 5, "quiet": 4, "easy": 3}
    b = scoring.axes("ramen", "はやしや", [], {})
    assert b == {"solo": 4, "quiet": 4, "easy": 3}

    # エビデンスも solo にだけ効く
    pos = [{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]
    assert scoring.axes("onsen", "○○温泉", pos, {}) == {"solo": 4, "quiet": 4, "easy": 3}
    neg = [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]
    assert scoring.axes("sento", "はやし湯", neg, {}) == {"solo": 3, "quiet": 4, "easy": 3}

    # クランプ
    assert scoring.axes("standing", "焼肉ライク", pos, {})["solo"] == 5

    # curated は軸ごとに上書きできる
    assert scoring.axes("sento", "はやし湯", [], {"quiet": 2})["quiet"] == 2
    assert scoring.axes("library", "○○図書館", [], {"easy": 3, "solo": 5}) == \
        {"solo": 5, "quiet": 5, "easy": 3}

    # 未知の kind は例外にする（表の追加漏れを黙って通さない）
    try:
        scoring.axes("unknown_kind", "○○", [], {})
    except KeyError:
        pass
    else:
        raise AssertionError("未知のkindが素通りした")


def test_axes_table_covers_all_kinds():
    # classify が返しうる kind はすべて AXES に載っていること
    kinds = {
        "standing", "yakiniku_solo", "ramen", "soba_udon", "gyudon", "curry",
        "sauna", "onsen", "sento", "netcafe", "karaoke", "cinema",
        "library", "hostel", "museum",
    }
    assert kinds <= set(scoring.AXES), kinds - set(scoring.AXES)
    for k, v in scoring.AXES.items():
        assert len(v) == 3, k
        assert all(1 <= x <= 5 for x in v), k
```

`main()` を以下に差し替える:

```python
def main():
    test_classify()
    test_axes()
    test_axes_table_covers_all_kinds()
    test_confidence()
    test_is_chain()
    print("OK: scoring")
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: FAIL with `AttributeError: module 'scoring' has no attribute 'axes'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/scoring.py` の `score()` 関数を丸ごと以下で置き換える:

```python
# 業態 → (solo, quiet, easy)。spec §5 の表。
#   solo  5=一人が標準 / 4=一人が多数 / 3=一人でも浮かない
#   quiet 5=会話が発生しない / 4=静か寄り / 2=声を出す場
#   easy  5=作法不要 / 4=ほぼ不要 / 3=軽い作法 / 2=常連文化
# 日本では業態が静けさと作法をかなり正確に予測する。図書館は静かで作法不要、
# 立ち飲みは声を出す場で常連文化がある、一蘭は静かだが食券と記入用紙の作法がある。
AXES = {
    "standing":      (5, 2, 2),
    "yakiniku_solo": (5, 4, 4),
    "netcafe":       (5, 5, 5),
    "sauna":         (5, 5, 3),
    "ramen":         (4, 4, 3),
    "gyudon":        (4, 4, 4),
    "soba_udon":     (4, 4, 3),
    "curry":         (4, 4, 4),
    "sento":         (4, 4, 3),
    "onsen":         (3, 4, 3),
    "karaoke":       (4, 2, 4),
    "library":       (4, 5, 5),
    "cinema":        (3, 5, 5),
    "museum":        (3, 5, 5),
    "hostel":        (3, 3, 3),
}


def axes(kind, name, evidence, curated=None):
    """業態 → 3軸スコア。curated で軸ごとに上書きできる。

    チェーン加点とエビデンス加減は solo にだけ効く。
    チェーンかどうかは静けさや作法とは無関係だからである。
    表に無い kind は KeyError を上げる。追加漏れを黙って通さないため。
    """
    solo, quiet, easy = AXES[kind]

    if _SOLO_RE.search(name or ""):
        solo += 1
    pol = _decisive_polarity(evidence)
    if pol == "+":
        solo += 1
    elif pol == "-":
        solo -= 1

    out = {
        "solo": max(1, min(5, solo)),
        "quiet": max(1, min(5, quiet)),
        "easy": max(1, min(5, easy)),
    }
    for k in ("solo", "quiet", "easy"):
        if curated and k in curated:
            out[k] = max(1, min(5, int(curated[k])))
    return out
```

`classify()` の戻り値から `base` は使わなくなるが、シグネチャは変えない。`build_data.py` が `kind` を使う。

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: `OK: scoring`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/scoring.py tests/hitori_scoring_test.py
git commit -m "feat(hitori): スコアを3軸（ひとり耐性/静けさ/入りやすさ）へ拡張"
```

---

### Task 2: 穴場スコア

周囲のチェーン比率を全国の点集合に対して計算する。県別にやると県境で500m圏が切れる。

**Files:**
- Create: `scripts/hitori/hidden.py`
- Test: `tests/hitori_hidden_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `RADIUS_M = 500.0` / `MIN_NEIGHBORS = 3` / `HIDDEN_THRESHOLD = 0.6`
  - `compute_hidden(records) -> None` — 各レコードに `hidden`(float) と `hidden_n`(int) を破壊的に付与する

レコードは `{"id","lat","lon","cat","chain",...}` を持つ辞書。

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_hidden_test.py`:

```python
# -*- coding: utf-8 -*-
"""穴場スコアの検証。周囲のチェーン比率が高い場所の非チェーン店を拾う。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import hidden


def rec(i, lat, lon, chain, cat="eat"):
    return {"id": f"n{i}", "lat": lat, "lon": lon, "cat": cat, "chain": chain}


def test_chain_sea_gives_high_hidden():
    # 同じ地点近傍に チェーン4 + 独立1。独立店の周囲は4/4=100%チェーン。
    recs = [rec(1, 35.0000, 139.0000, 0)]
    for k in range(4):
        recs.append(rec(10 + k, 35.0000 + 0.0005 * k, 139.0000, 1))
    hidden.compute_hidden(recs)
    indie = recs[0]
    assert indie["hidden_n"] == 4
    assert abs(indie["hidden"] - 1.0) < 1e-6


def test_chain_itself_gets_zero():
    # チェーン店自身は穴場ではない
    recs = [rec(1, 35.0, 139.0, 1)] + [rec(10 + k, 35.0 + 0.0005 * k, 139.0, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden"] == 0.0


def test_too_few_neighbors_is_zero():
    # 周辺2件では「100%チェーン」と言っても意味がない
    recs = [rec(1, 35.0, 139.0, 0), rec(2, 35.0005, 139.0, 1), rec(3, 35.0010, 139.0, 1)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 2
    assert recs[0]["hidden"] == 0.0


def test_only_same_category_counts():
    # 半径内にいても別カテゴリは数えない
    recs = [rec(1, 35.0, 139.0, 0, "eat")]
    recs += [rec(10 + k, 35.0 + 0.0005 * k, 139.0, 1, "bath") for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 0
    assert recs[0]["hidden"] == 0.0


def test_outside_radius_not_counted():
    # 500m の外は数えない。緯度0.01度は約1.1km。
    recs = [rec(1, 35.0, 139.0, 0)] + [rec(10 + k, 35.0 + 0.01 * (k + 1), 139.0, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 0


def test_crosses_prefecture_boundary():
    # 県境をまたいだ近傍も数える（全国の点集合に対して計算するため）
    recs = [rec(1, 35.0, 139.0, 0)]
    recs += [rec(10 + k, 35.0 + 0.001 * k, 139.001, 1) for k in range(4)]
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 4


def test_mixed_ratio():
    # 周辺6件中3件チェーン → 0.5
    recs = [rec(1, 35.0, 139.0, 0)]
    for k in range(3):
        recs.append(rec(10 + k, 35.0 + 0.0005 * (k + 1), 139.0, 1))
    for k in range(3):
        recs.append(rec(20 + k, 35.0 - 0.0005 * (k + 1), 139.0, 0))
    hidden.compute_hidden(recs)
    assert recs[0]["hidden_n"] == 6
    assert abs(recs[0]["hidden"] - 0.5) < 1e-6


def test_is_hidden_gem():
    assert hidden.is_hidden_gem({"chain": 0, "hidden": 0.8, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 1, "hidden": 0.8, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 0, "hidden": 0.5, "hidden_n": 5})
    assert not hidden.is_hidden_gem({"chain": 0, "hidden": 0.8, "hidden_n": 2})


def test_scales_to_many_records():
    # 全件総当たりだと 37,000^2 で終わらない。グリッドが効いていることの確認。
    import time
    recs = [rec(i, 35.0 + (i % 200) * 0.002, 139.0 + (i // 200) * 0.002, i % 3 == 0)
            for i in range(20000)]
    t = time.time()
    hidden.compute_hidden(recs)
    elapsed = time.time() - t
    assert elapsed < 20, f"20,000件に {elapsed:.1f}秒かかった。グリッドが効いていない"


def main():
    test_chain_sea_gives_high_hidden()
    test_chain_itself_gets_zero()
    test_too_few_neighbors_is_zero()
    test_only_same_category_counts()
    test_outside_radius_not_counted()
    test_crosses_prefecture_boundary()
    test_mixed_ratio()
    test_is_hidden_gem()
    test_scales_to_many_records()
    print("OK: hidden")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_hidden_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'hidden'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/hidden.py`:

```python
# -*- coding: utf-8 -*-
"""穴場スコア。周囲のチェーン比率が高い場所に立つ非チェーン店を拾う。

駅前が牛丼屋とチェーン居酒屋で埋まっている中に1軒だけ残っている
立ち食いそば、を上位に出すための指標。

計算は県別ではなく全国の点集合に対して行う。県別にやると県境で
半径500mの円が切れてしまう。
"""
import math
from collections import defaultdict

RADIUS_M = 500.0
MIN_NEIGHBORS = 3      # これ未満なら比率に意味がないので0とする
HIDDEN_THRESHOLD = 0.6

# グリッドのセル幅。半径500mを見るので、緯度0.01度（約1.1km）なら
# 隣接3x3セルの走査で取りこぼしが出ない。
CELL_DEG = 0.01


def _distance_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cell(rec):
    return (int(math.floor(rec["lat"] / CELL_DEG)), int(math.floor(rec["lon"] / CELL_DEG)))


def compute_hidden(records):
    """各レコードに hidden(0.0-1.0) と hidden_n(int) を破壊的に付与する。"""
    grid = defaultdict(list)
    for r in records:
        grid[_cell(r)].append(r)

    for r in records:
        cy, cx = _cell(r)
        total = 0
        chains = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for o in grid.get((cy + dy, cx + dx), ()):
                    if o is r or o["cat"] != r["cat"]:
                        continue
                    if _distance_m(r["lat"], r["lon"], o["lat"], o["lon"]) > RADIUS_M:
                        continue
                    total += 1
                    if o["chain"] == 1:
                        chains += 1

        r["hidden_n"] = total
        if r["chain"] == 1 or total < MIN_NEIGHBORS:
            r["hidden"] = 0.0
        else:
            r["hidden"] = round(chains / total, 2)


def is_hidden_gem(rec):
    """画面で「穴場」と呼んでよいか。"""
    return (rec.get("chain") == 0
            and rec.get("hidden_n", 0) >= MIN_NEIGHBORS
            and rec.get("hidden", 0.0) >= HIDDEN_THRESHOLD)
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_hidden_test.py`
Expected: `OK: hidden`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/hidden.py tests/hitori_hidden_test.py
git commit -m "feat(hitori): 周囲のチェーン比率による穴場スコアを追加"
```

---

### Task 3: 隣接県の生成

**Files:**
- Create: `scripts/hitori/neighbors.py`
- Create: `data/hitori/neighbors.json`（スクリプトが生成、commit する）
- Test: `tests/hitori_neighbors_test.py`

**Interfaces:**
- Consumes: `_local/hitori_raw/japan.geojson`（Task 9 の `build_map_svg.py` がダウンロード済み）
- Produces:
  - `build_neighbors(geojson, threshold_deg=0.02) -> dict[int, list[int]]`
  - `data/hitori/neighbors.json` — `{"13": [11,12,14,19], ...}`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_neighbors_test.py`:

```python
# -*- coding: utf-8 -*-
"""隣接県テーブルの検証。現在地の近傍探索がどこまで広がるかを決める。"""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import neighbors as nb

OUT = ROOT / "data" / "hitori" / "neighbors.json"


def test_build_from_synthetic():
    # 2つの正方形が辺を接している → 隣接。離れた1つ → 非隣接。
    gj = {"features": [
        {"properties": {"id": 1}, "geometry": {"type": "Polygon", "coordinates": [[
            [139.0, 35.0], [139.1, 35.0], [139.1, 35.1], [139.0, 35.1], [139.0, 35.0]]]}},
        {"properties": {"id": 2}, "geometry": {"type": "Polygon", "coordinates": [[
            [139.1, 35.0], [139.2, 35.0], [139.2, 35.1], [139.1, 35.1], [139.1, 35.0]]]}},
        {"properties": {"id": 3}, "geometry": {"type": "Polygon", "coordinates": [[
            [141.0, 38.0], [141.1, 38.0], [141.1, 38.1], [141.0, 38.1], [141.0, 38.0]]]}},
    ]}
    out = nb.build_neighbors(gj)
    assert out[1] == [2] and out[2] == [1], out
    assert out[3] == [], out


def test_is_symmetric():
    gj = json.loads((ROOT / "_local" / "hitori_raw" / "japan.geojson").read_text(encoding="utf-8"))
    out = nb.build_neighbors(gj)
    for a, ns in out.items():
        for b in ns:
            assert a in out[b], f"{a}->{b} はあるが {b}->{a} が無い"


def test_generated_file():
    assert OUT.exists(), f"not found: {OUT} — neighbors.py を実行してください"
    data = {int(k): v for k, v in json.loads(OUT.read_text(encoding="utf-8")).items()}
    assert sorted(data) == list(range(1, 48)), "47県すべてが無い"

    # 既知の隣接関係。ここが崩れたら閾値がおかしい。
    assert set(data[13]) >= {11, 12, 14, 19}, f"東京都の隣接が不足: {data[13]}"   # 埼玉千葉神奈川山梨
    assert set(data[27]) >= {26, 28, 29, 30}, f"大阪府の隣接が不足: {data[27]}"   # 京都兵庫奈良和歌山
    assert 2 in data[1], "北海道の隣接に青森が無い"

    # 北海道は本州と陸続きでないが、津軽海峡は約20kmある。
    # 閾値0.02度(約2km)なら青森だけが拾われるはずがなく、実際は0件になりうる。
    # 0件の県が出た場合は近傍探索が自県だけになるので、把握できるよう明示する。
    isolated = [k for k, v in data.items() if not v]
    assert isolated == [] or isolated == [47], f"隣接0件の県: {isolated}"


def main():
    test_build_from_synthetic()
    test_is_symmetric()
    test_generated_file()
    print("OK: neighbors")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_neighbors_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'neighbors'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/neighbors.py`:

```python
# -*- coding: utf-8 -*-
"""県境ポリゴンから隣接県テーブルを作る。

現在地の都道府県を判定したあと、どこまで広げて施設を探すかを決めるために使う。
頂点をグリッドに入れて、異なる県の頂点が閾値以内にある県同士を隣接とみなす。
"""
import json, math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_local" / "hitori_raw" / "japan.geojson"
OUT = ROOT / "data" / "hitori" / "neighbors.json"

THRESHOLD_DEG = 0.02   # 約2km。海峡は跨がず、川や県境の頂点ずれは吸収する


def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def build_neighbors(geojson, threshold_deg=THRESHOLD_DEG):
    """{県コード: [隣接県コード...]} を返す。結果は対称かつ昇順。"""
    pts_by_pref = {}
    for feat in geojson["features"]:
        code = int(feat["properties"]["id"])
        pts = []
        for ring in _rings(feat["geometry"]):
            pts.extend((c[1], c[0]) for c in ring)   # (lat, lon)
        pts_by_pref[code] = pts

    # 頂点を閾値サイズのセルへ入れる。同じセルと隣接セルだけを比べる。
    cell = threshold_deg
    grid = defaultdict(list)
    for code, pts in pts_by_pref.items():
        for lat, lon in pts:
            grid[(int(math.floor(lat / cell)), int(math.floor(lon / cell)))].append((code, lat, lon))

    adj = defaultdict(set)
    for (cy, cx), bucket in grid.items():
        near = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                near.extend(grid.get((cy + dy, cx + dx), ()))
        for code_a, lat_a, lon_a in bucket:
            for code_b, lat_b, lon_b in near:
                if code_a == code_b:
                    continue
                if abs(lat_a - lat_b) <= threshold_deg and abs(lon_a - lon_b) <= threshold_deg:
                    adj[code_a].add(code_b)
                    adj[code_b].add(code_a)

    return {code: sorted(adj.get(code, ())) for code in sorted(pts_by_pref)}


def main():
    gj = json.loads(SRC.read_text(encoding="utf-8"))
    out = build_neighbors(gj)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({str(k): v for k, v in out.items()},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    isolated = [k for k, v in out.items() if not v]
    print(f"wrote {OUT} ({len(out)} prefectures, "
          f"平均 {sum(len(v) for v in out.values()) / len(out):.1f} 隣接)")
    if isolated:
        print(f"隣接0件: {isolated}（近傍探索は自県のみになる）")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 生成してテストを通す**

Run: `PYTHONUTF8=1 python scripts/hitori/neighbors.py && PYTHONUTF8=1 python tests/hitori_neighbors_test.py`
Expected: `wrote ...neighbors.json (47 prefectures, 平均 N.N 隣接)` に続いて `OK: neighbors`

東京都の隣接が4件未満になる場合は `THRESHOLD_DEG` を 0.03 まで上げる。北海道と青森が繋がらない場合は、津軽海峡が約20kmあるため閾値では届かない。その場合は `main()` の書き出し直前に `out[1] = sorted(set(out[1]) | {2}); out[2] = sorted(set(out[2]) | {1})` を足し、コメントで「津軽海峡は閾値を超えるため明示的に繋ぐ」と書く。

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/neighbors.py data/hitori/neighbors.json tests/hitori_neighbors_test.py
git commit -m "feat(hitori): 県境ポリゴンから隣接県テーブルを生成"
```

---

### Task 4: ビルドの新スキーマ対応

**Files:**
- Modify: `scripts/hitori/validate.py`
- Modify: `scripts/hitori/normalize.py`
- Modify: `scripts/hitori/build_data.py`
- Modify: `tests/hitori_validate_test.py`
- Modify: `tests/hitori_normalize_test.py`
- Modify: `tests/hitori_build_test.py`

**Interfaces:**
- Consumes: Task 1 の `scoring.axes()`、Task 2 の `hidden.compute_hidden()`
- Produces: 新しい `EXPECTED_FIELDS`

```python
EXPECTED_FIELDS = ["id", "name", "lat", "lon", "cat", "kind",
                   "solo", "quiet", "easy", "conf", "chain",
                   "hidden", "hidden_n", "city", "oh", "tel", "web", "note"]
```

- [ ] **Step 1: validate.py のテストを更新**

`tests/hitori_validate_test.py` の `FIELDS` と `GOOD_PREF` を差し替える:

```python
FIELDS = ["id", "name", "lat", "lon", "cat", "kind",
          "solo", "quiet", "easy", "conf", "chain",
          "hidden", "hidden_n", "city", "oh", "tel", "web", "note"]

GOOD_PREF = {
    "pref": 13, "name": "東京都", "updated": "2026-08-04",
    "fields": FIELDS,
    "items": [
        ["n1", "一蘭 渋谷店", 35.65894, 139.70043, "eat", "ramen",
         5, 4, 3, 2, 1, 0.0, 8, "渋谷区", "11:00-23:00", "03-0000-0000", "https://ichiran.com/", "仕切りカウンター12席"],
        ["n2", "はやしや", 35.70112, 139.75820, "eat", "soba_udon",
         4, 4, 3, 0, 0, 0.83, 12, "新宿区", "", "", "", ""],
    ],
}
```

`test_pref_score_range()` を以下で置き換える:

```python
def test_pref_axis_ranges():
    for axis, col in (("solo", 6), ("quiet", 7), ("easy", 8)):
        for bad in (0, 6, 3.5, "4"):
            d = copy.deepcopy(GOOD_PREF)
            d["items"][0][col] = bad
            errs = validate.validate_pref(d)
            assert any(axis in e for e in errs), f"{axis}={bad!r} が通ってしまった"


def test_pref_hidden_range():
    for bad in (-0.1, 1.1, "0.5"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][11] = bad
        assert any("hidden" in e for e in validate.validate_pref(d)), bad
    # hidden_n が3未満なら hidden は0でなければならない
    d = copy.deepcopy(GOOD_PREF)
    d["items"][1][12] = 2
    assert any("hidden" in e for e in validate.validate_pref(d))
```

`test_pref_chain_flag()` の列番号を 8 から 10 へ、`test_pref_duplicate_id` はそのまま。`main()` に `test_pref_axis_ranges()` と `test_pref_hidden_range()` を入れ、`test_pref_score_range()` を消す。

- [ ] **Step 2: validate.py を更新**

`scripts/hitori/validate.py` の `EXPECTED_FIELDS` を差し替え、`validate_pref` のスコア検証部分を以下で置き換える:

```python
        for axis in ("solo", "quiet", "easy"):
            v = row[idx[axis]]
            if not isinstance(v, int) or isinstance(v, bool) or not (1 <= v <= 5):
                errs.append(f"{axis} が不正: {fid} -> {v!r}")

        hv, hn = row[idx["hidden"]], row[idx["hidden_n"]]
        if not isinstance(hv, (int, float)) or isinstance(hv, bool) or not (0.0 <= hv <= 1.0):
            errs.append(f"hidden が不正: {fid} -> {hv!r}")
        if not isinstance(hn, int) or isinstance(hn, bool) or hn < 0:
            errs.append(f"hidden_n が不正: {fid} -> {hn!r}")
        elif hn < 3 and hv != 0.0:
            errs.append(f"hidden_n が3未満なのに hidden が0でない: {fid}")
```

`validate_curated` の `MANUAL_REQUIRED` から `base` を外し `kind` を必須のままにする:

```python
MANUAL_REQUIRED = ("name", "lat", "lon", "cat", "kind", "pref")
```

- [ ] **Step 3: normalize.py を更新**

`to_record()` の戻り値を差し替える。`city` は `addr:city` があれば採用（被覆率13%なので大半は空）。`oh` は `opening_hours` の生値。

```python
    evidence = cur.get("evidence") or []
    ax = scoring.axes(kind, name, evidence, cur)
    # spec §5 の収録条件。否定エビデンスや curated で solo が2以下に落ちた施設は収録しない。
    # v1 ではこの条件が仕様に書かれていながら一度も強制されていなかった。
    if ax["solo"] < 3:
        return None
    return {
        "id": fid,
        "name": name,
        "lat": round(lat, COORD_DIGITS),
        "lon": round(lon, COORD_DIGITS),
        "cat": cat,
        "kind": kind,
        "solo": ax["solo"],
        "quiet": ax["quiet"],
        "easy": ax["easy"],
        "conf": scoring.confidence(evidence),
        "chain": scoring.is_chain(tags, cur),
        "hidden": 0.0,      # compute_hidden が全国計算のあとに上書きする
        "hidden_n": 0,
        "city": (tags.get("addr:city") or "").strip(),
        "oh": (tags.get("opening_hours") or "").strip(),
        "tel": (tags.get("phone") or tags.get("contact:phone") or "").strip(),
        "web": (tags.get("website") or tags.get("contact:website") or "").strip(),
        "note": cur.get("note", ""),
    }
```

`to_record` の中で `cls` を展開している行を `cat, kind, _base = cls` に変える（`base` は使わなくなる）。

`tests/hitori_normalize_test.py` の期待値を更新する。`test_to_record_node()`:

```python
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
```

`test_to_record_way_uses_center()` の `r["score"] == 4` を `r["solo"] == 4` に、`test_to_record_curated()` の `r["score"] == 5` を `r["solo"] == 5` に変える。`test_dedupe()` のダミーレコードは `score` キーを `solo/quiet/easy` に置き換える（`dedupe` は名前と座標しか見ないので値は何でもよい）。

収録条件のテストを追加する。`test_to_record_curated()` の直前に置き、`main()` の `test_to_record_rejects()` の直後で呼ぶ:

```python
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
```

- [ ] **Step 4: build_data.py を更新**

`import hidden` を足し、`build()` を以下のように変える。**穴場計算は県ループの外で全国に対して行う**。

```python
def build(raw_by_pref, prefs, curated, updated):
    """(summary, {code: pref_doc}) を返す。ファイルI/Oはしない。"""
    by_pref = {}
    all_records = []

    for p in prefs:
        code = p["code"]
        elements = (raw_by_pref.get(code) or {}).get("elements", [])
        records = [r for r in (normalize.to_record(el, curated) for el in elements) if r]
        records += manual_records(curated, code)
        records = normalize.dedupe(records)
        by_pref[code] = records
        all_records.extend(records)

    # 穴場は全国の点集合に対して計算する。県別にやると県境で半径500mが切れる。
    hidden.compute_hidden(all_records)

    summary_prefs = []
    prefdocs = {}
    total = 0
    for p in prefs:
        code, pop = p["code"], p["pop"]
        records = by_pref[code]
        records.sort(key=lambda r: (-r["solo"], r["name"]))
        total += len(records)

        counts = {c: 0 for c in CATS}
        counts_indie = {c: 0 for c in CATS}
        for r in records:
            counts[r["cat"]] += 1
            if r["chain"] == 0:
                counts_indie[r["cat"]] += 1
        counts["all"] = sum(counts[c] for c in CATS)
        counts_indie["all"] = sum(counts_indie[c] for c in CATS)

        summary_prefs.append({
            "code": code, "name": p["name"], "pop": pop,
            "counts": counts, "counts_indie": counts_indie,
            "density": {k: _density(v, pop) for k, v in counts.items()},
            "density_indie": {k: _density(v, pop) for k, v in counts_indie.items()},
        })

        fields = validate.EXPECTED_FIELDS
        prefdocs[code] = {
            "pref": code, "name": p["name"], "updated": updated,
            "fields": fields,
            "items": [[r[f] for f in fields] for r in records],
        }

    summary = {
        "updated": updated,
        "total": total,
        "population_source": "Wikidata (CC0) / 令和2年国勢調査",
        "prefectures": summary_prefs,
    }
    return summary, prefdocs
```

`manual_records()` の中の `scoring.score(rec["base"], ...)` を `scoring.axes(rec["kind"], rec["name"], evidence, rec)` に置き換え、返す辞書を `to_record` と同じ16列にそろえる:

```python
        ax = scoring.axes(rec["kind"], rec["name"], evidence, rec)
        out.append({
            "id": fid, "name": rec["name"],
            "lat": round(rec["lat"], normalize.COORD_DIGITS),
            "lon": round(rec["lon"], normalize.COORD_DIGITS),
            "cat": rec["cat"], "kind": rec["kind"],
            "solo": ax["solo"], "quiet": ax["quiet"], "easy": ax["easy"],
            "conf": scoring.confidence(evidence),
            "chain": int(rec.get("chain", 0)),
            "hidden": 0.0, "hidden_n": 0,
            "city": rec.get("city", ""), "oh": rec.get("oh", ""),
            "tel": rec.get("tel", ""), "web": rec.get("web", ""),
            "note": rec.get("note", ""),
        })
```

- [ ] **Step 5: build のテストを更新**

`tests/hitori_build_test.py` の `test_build_applies_curated()` と `test_build_sorts_by_score_desc()` の `idx["score"]` を `idx["solo"]` に変え、`test_build_includes_manual_entries()` の curated から `"base": 5` を消す。以下のテストを足し、`main()` に入れる:

```python
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
git commit -m "feat(hitori): 3軸スコア・穴場・市区町村・営業時間を出力スキーマへ追加"
```

---

### Task 5: 本番データの再生成

**Files:**
- Modify: `data/hitori/summary.json`、`data/hitori/pref/*.json`

**Interfaces:**
- Consumes: Task 4 のビルド
- Produces: 新スキーマの全国データ

- [ ] **Step 1: ビルド**

Run: `PYTHONUTF8=1 python scripts/hitori/build_data.py`
Expected: `total 37,xxx 件 / 最大 13 = 5,9xx 件 xxxKB`

`_local/hitori_raw/` は Task 1〜4 で触っていないので再取得は不要。

- [ ] **Step 2: 穴場が実際に出ているか確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib,sys
sys.path.insert(0,'scripts/hitori'); import hidden
tot=gem=0; samples=[]
for f in sorted(pathlib.Path('data/hitori/pref').glob('*.json')):
    d=json.loads(f.read_text(encoding='utf-8'))
    idx={k:i for i,k in enumerate(d['fields'])}
    for r in d['items']:
        rec={k:r[i] for k,i in idx.items()}
        tot+=1
        if hidden.is_hidden_gem(rec):
            gem+=1
            if len(samples)<8: samples.append((rec['name'],d['name'],rec['hidden'],rec['hidden_n']))
print(f'全{tot:,}件中 穴場 {gem:,}件 ({gem/tot:.1%})')
for n,p,h,k in samples: print(f'  {n[:24]:26} {p:6} 穴場度{h:.0%} 周辺{k}件')
"
```
Expected: 穴場が全体の 2〜15% の範囲に入り、店名が実在しそうな独立店であること。0% なら `HIDDEN_THRESHOLD` か `RADIUS_M` を疑う。50% を超えるならチェーン判定が緩すぎる。

- [ ] **Step 3: 3軸の分布を確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib
from collections import Counter
c={'solo':Counter(),'quiet':Counter(),'easy':Counter()}
for f in sorted(pathlib.Path('data/hitori/pref').glob('*.json')):
    d=json.loads(f.read_text(encoding='utf-8'))
    idx={k:i for i,k in enumerate(d['fields'])}
    for r in d['items']:
        for a in c: c[a][r[idx[a]]]+=1
for a,cnt in c.items():
    print(a.ljust(6), ' '.join(f'{k}:{v:,}' for k,v in sorted(cnt.items())))
"
```
Expected: 3軸それぞれで値が2種類以上に分かれていること。1種類に潰れていたら `AXES` の表が反映されていない。

- [ ] **Step 4: Commit**

```bash
git add data/hitori/summary.json data/hitori/pref/
git commit -m "chore(hitori): 3軸スコアと穴場を含む全国データを再生成"
```

---

### Task 6: core.js — 距離・方角・徒歩分

**Files:**
- Create: `assets/hitori/core.js`
- Test: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `haversineM(lat1, lon1, lat2, lon2) -> number`
  - `bearing8(lat1, lon1, lat2, lon2) -> string` — `"北"|"北東"|"東"|"南東"|"南"|"南西"|"西"|"北西"`
  - `walkMinutes(meters) -> number` — 80m/分、切り上げ、最低1

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_core_test.mjs`:

```javascript
// ひとり歓迎マップの純関数テスト。DOM も fetch も使わない。
// 実行: node tests/hitori_core_test.mjs
import * as core from '../assets/hitori/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || ''} expected ~${b}, got ${a}`);
}

check('haversineM', () => {
  // 東京駅と有楽町駅はおよそ800m
  near(core.haversineM(35.6812, 139.7671, 35.6749, 139.7630), 800, 250);
  near(core.haversineM(35.0, 139.0, 35.0, 139.0), 0, 0.001);
  // 緯度35度で経度0.00033度はおよそ30m
  near(core.haversineM(35.0, 139.0, 35.0, 139.00033), 30, 5);
});

check('bearing8', () => {
  eq(core.bearing8(35.0, 139.0, 36.0, 139.0), '北');
  eq(core.bearing8(35.0, 139.0, 34.0, 139.0), '南');
  eq(core.bearing8(35.0, 139.0, 35.0, 140.0), '東');
  eq(core.bearing8(35.0, 139.0, 35.0, 138.0), '西');
  eq(core.bearing8(35.0, 139.0, 35.5, 139.5), '北東');
  eq(core.bearing8(35.0, 139.0, 34.5, 138.5), '南西');
});

check('walkMinutes', () => {
  eq(core.walkMinutes(400), 5);
  eq(core.walkMinutes(800), 10);
  eq(core.walkMinutes(10), 1, '極近でも0分にしない');
  eq(core.walkMinutes(401), 6, '切り上げ');
});

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('OK: core');
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `Cannot find module ...assets/hitori/core.js`

- [ ] **Step 3: 実装を書く**

`assets/hitori/core.js`:

```javascript
// ひとり歓迎マップの純粋なロジック。DOM も fetch も持たない。
// hitori.html から ESモジュールとして読み込み、Node からテストする。

const R_EARTH = 6371000;
const WALK_M_PER_MIN = 80;
const DIRS8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

export function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

export function bearing8(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return DIRS8[Math.round(deg / 45) % 8];
}

export function walkMinutes(meters) {
  return Math.max(1, Math.ceil(meters / WALK_M_PER_MIN));
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 距離・方角・徒歩分の純関数を追加"
```

---

### Task 7: core.js — opening_hours の解釈

被覆率は16.6%しかない。**分からないものを分からないと言う**のがこの関数の仕事である。

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `parseOpeningHours(str) -> Array<{days:number[], spans:number[][]}> | null` — 解釈できなければ `null`
  - `openState(str, date) -> 'open' | 'closed' | null` — `null` は不明

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_core_test.mjs` の末尾（`if (failures)` の直前）に追加:

```javascript
check('parseOpeningHours: 基本形', () => {
  const r = core.parseOpeningHours('11:00-23:00');
  eq(r.length, 1);
  eq(r[0].days.length, 7, '曜日指定なしは毎日');
  eq(r[0].spans[0][0], 660);
  eq(r[0].spans[0][1], 1380);
});

check('parseOpeningHours: 曜日範囲と複数区間', () => {
  const r = core.parseOpeningHours('Mo-Fr 11:00-14:00,17:00-22:00');
  eq(r.length, 1);
  eq(JSON.stringify(r[0].days), JSON.stringify([1, 2, 3, 4, 5]));
  eq(r[0].spans.length, 2);
  eq(r[0].spans[1][0], 1020);
});

check('parseOpeningHours: 複数ルール', () => {
  const r = core.parseOpeningHours('Mo-Fr 09:00-18:00; Sa 09:00-12:00');
  eq(r.length, 2);
  eq(JSON.stringify(r[1].days), JSON.stringify([6]));
});

check('parseOpeningHours: 24/7', () => {
  const r = core.parseOpeningHours('24/7');
  eq(r[0].days.length, 7);
  eq(r[0].spans[0][1], 1440);
});

check('parseOpeningHours: 日をまたぐ', () => {
  const r = core.parseOpeningHours('18:00-02:00');
  eq(r[0].spans[0][0], 1080);
  eq(r[0].spans[0][1], 1560, '翌日02:00は1440+120');
});

check('parseOpeningHours: off は休みとして無視してよい', () => {
  // ルールが無い曜日は休みなので、off を落としても結果は同じ
  const r = core.parseOpeningHours('Mo-Fr 09:00-18:00; Sa,Su off');
  eq(r.length, 1);
  eq(JSON.stringify(r[0].days), JSON.stringify([1, 2, 3, 4, 5]));
});

check('parseOpeningHours: 解釈できないものは null', () => {
  for (const s of ['', null, undefined, 'sunrise-sunset', 'Mo-Fr 09:00-18:00; PH off',
                   'Jan-Mar 10:00-17:00', 'week 1-53 10:00-17:00', 'なんか変な文字列']) {
    eq(core.parseOpeningHours(s), null, `${JSON.stringify(s)} が null にならない`);
  }
});

check('openState', () => {
  // 2026-08-04 は火曜日
  const tue14 = new Date(2026, 7, 4, 14, 0);
  const tue23 = new Date(2026, 7, 4, 23, 0);
  const sat14 = new Date(2026, 7, 8, 14, 0);

  eq(core.openState('11:00-23:00', tue14), 'open');
  eq(core.openState('11:00-23:00', tue23), 'closed', '23:00ちょうどは閉店');
  eq(core.openState('Mo-Fr 09:00-18:00', sat14), 'closed');
  eq(core.openState('Mo-Fr 09:00-18:00', tue14), 'open');
  eq(core.openState('24/7', tue23), 'open');

  // 日をまたぐ営業。水曜01:00は火曜18:00-02:00の営業中。
  const wed01 = new Date(2026, 7, 5, 1, 0);
  eq(core.openState('Mo-Fr 18:00-02:00', wed01), 'open');

  // 不明は null。営業中と偽らない。
  eq(core.openState('', tue14), null);
  eq(core.openState('sunrise-sunset', tue14), null);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.parseOpeningHours is not a function`

- [ ] **Step 3: 実装を追加**

`assets/hitori/core.js` の末尾に追加:

```javascript
// --- opening_hours ---
// OSM の書式に完全対応はしない。基本形だけを扱い、解釈できないものは null を返す。
// 誤って「営業中」と出すより、分からないと言うほうがましである。

const _DAY_IDX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const _ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const _UNSUPPORTED = /(PH|SH|sunrise|sunset|dawn|dusk|easter|week\s|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\[|\||"|=|<|>)/i;
const _RULE_RE = /^([A-Za-z][A-Za-z,\- ]*?)?\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/;

function _parseDays(part) {
  if (!part || !part.trim()) return _ALL_DAYS.slice();
  const days = new Set();
  for (const token of part.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const range = t.match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/);
    if (range) {
      const a = _DAY_IDX[range[1].toLowerCase()], b = _DAY_IDX[range[2].toLowerCase()];
      if (a === undefined || b === undefined) return null;
      for (let i = 0; i < 7; i++) {
        const d = (a + i) % 7;
        days.add(d);
        if (d === b) break;
      }
      continue;
    }
    const one = _DAY_IDX[t.toLowerCase()];
    if (one === undefined) return null;
    days.add(one);
  }
  return days.size ? [...days].sort((x, y) => x - y) : null;
}

function _parseSpans(part) {
  const out = [];
  for (const chunk of part.split(',')) {
    const m = chunk.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const a = (+m[1]) * 60 + (+m[2]);
    let b = (+m[3]) * 60 + (+m[4]);
    if (b <= a) b += 1440;      // 日をまたぐ営業
    out.push([a, b]);
  }
  return out.length ? out : null;
}

export function parseOpeningHours(str) {
  if (!str) return null;
  const src = String(str).trim();
  if (!src) return null;
  if (src === '24/7') return [{ days: _ALL_DAYS.slice(), spans: [[0, 1440]] }];
  if (_UNSUPPORTED.test(src)) return null;

  const rules = [];
  for (const chunk of src.split(';')) {
    const rule = chunk.trim();
    if (!rule) continue;
    const m = rule.match(_RULE_RE);
    if (!m) {
      // 「その曜日は休み」はルール不在と同義なので落としてよい
      if (/\boff\b/i.test(rule)) continue;
      return null;
    }
    const days = _parseDays(m[1]);
    const spans = _parseSpans(m[2]);
    if (!days || !spans) return null;
    rules.push({ days, spans });
  }
  return rules.length ? rules : null;
}

export function openState(str, date) {
  const rules = parseOpeningHours(str);
  if (!rules) return null;
  const day = date.getDay();
  const prev = (day + 6) % 7;
  const min = date.getHours() * 60 + date.getMinutes();

  for (const r of rules) {
    if (r.days.includes(day)) {
      for (const [a, b] of r.spans) if (min >= a && min < b) return 'open';
    }
    // 前日から日をまたいで継続している営業
    if (r.days.includes(prev)) {
      for (const [a, b] of r.spans) {
        if (b > 1440 && min + 1440 >= a && min + 1440 < b) return 'open';
      }
    }
  }
  return 'closed';
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: 実データで被覆率を確認**

Run:
```bash
node -e "
import('./assets/hitori/core.js').then(async core => {
  const fs = await import('fs');
  let tot=0, ok=0, unknown=0;
  for (const f of fs.readdirSync('data/hitori/pref')) {
    const d = JSON.parse(fs.readFileSync('data/hitori/pref/'+f,'utf8'));
    const i = d.fields.indexOf('oh');
    for (const r of d.items) { if (!r[i]) continue; tot++; core.parseOpeningHours(r[i]) ? ok++ : unknown++; }
  }
  console.log('oh あり', tot, '/ 解釈できた', ok, ('('+(100*ok/tot).toFixed(1)+'%)'), '/ 諦めた', unknown);
});
"
```
Expected: 解釈できた割合が 70% 以上。50%を下回るなら `_UNSUPPORTED` が厳しすぎるので、落ちている実例を数件出して見直す。

- [ ] **Step 6: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): opening_hours の解釈を追加（不明を不明と言う）"
```

---

### Task 8: core.js — 現在地から都道府県を判定

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: `data/hitori/prefectures_svg.json` の `bounds` と `paths`
- Produces:
  - `projectToSvg(lat, lon, bounds) -> [number, number]`
  - `parseSvgPath(d) -> number[][][]` — サブパスごとの点列
  - `pointInRing(x, y, ring) -> boolean`
  - `prefectureAt(lat, lon, geo) -> number` — 内包する県コード。無ければ最寄り県

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_core_test.mjs` に追加:

```javascript
// 100x100 の正方形を2つ持つ疑似 geo。左=県1、右=県2。
const FAKE_GEO = {
  bounds: { minx: 0, miny: 0, scale: 1, lat0: 0 },
  paths: {
    1: 'M0 0L100 0L100 100L0 100Z',
    2: 'M200 0L300 0L300 100L200 100Z',
  },
};

check('projectToSvg は可逆な向き', () => {
  const b = { minx: 100, miny: -40, scale: 2, lat0: 36 };
  const [x1, y1] = core.projectToSvg(35, 139, b);
  const [x2, y2] = core.projectToSvg(36, 139, b);
  if (!(y2 < y1)) throw new Error('北にあるほど y が小さくない');
  const [x3] = core.projectToSvg(35, 140, b);
  if (!(x3 > x1)) throw new Error('東にあるほど x が大きくない');
});

check('parseSvgPath', () => {
  const rings = core.parseSvgPath('M0 0L10 0L10 10Z M20 20L30 20L30 30Z');
  eq(rings.length, 2);
  eq(rings[0].length, 3);
  eq(rings[1][0][0], 20);
});

check('pointInRing', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  eq(core.pointInRing(5, 5, sq), true);
  eq(core.pointInRing(15, 5, sq), false);
  eq(core.pointInRing(-1, 5, sq), false);
});

check('prefectureAt: 内包', () => {
  // bounds が恒等変換なので lat/lon はそのまま x,y になる（y は符号反転）
  eq(core.prefectureAt(-50, 50, FAKE_GEO), 1);
  eq(core.prefectureAt(-50, 250, FAKE_GEO), 2);
});

check('prefectureAt: どこにも入らなければ最寄り', () => {
  // x=160 は県1(0-100)より県2(200-300)に近い…わけではないので県1が返る
  eq(core.prefectureAt(-50, 140, FAKE_GEO), 1);
  eq(core.prefectureAt(-50, 260, FAKE_GEO), 2);
  // 遥か遠方でも必ず何かを返す（null を返さない）
  const far = core.prefectureAt(-9999, 9999, FAKE_GEO);
  if (far !== 1 && far !== 2) throw new Error('遠方で県が返らない: ' + far);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.projectToSvg is not a function`

- [ ] **Step 3: 実装を追加**

`assets/hitori/core.js` の末尾に追加:

```javascript
// --- 現在地 → 都道府県 ---
// 県境ポリゴンは簡略化されている（許容誤差0.012度≒1.3km）ため、県境付近では
// 1km程度ずれうる。隣接県も読むので実害はない。

export function projectToSvg(lat, lon, bounds) {
  return [
    (lon * Math.cos(bounds.lat0 * Math.PI / 180) - bounds.minx) * bounds.scale,
    (-lat - bounds.miny) * bounds.scale,
  ];
}

export function parseSvgPath(d) {
  const rings = [];
  for (const seg of String(d).split('M').slice(1)) {
    const nums = seg.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) continue;
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([+nums[i], +nums[i + 1]]);
    if (pts.length >= 3) rings.push(pts);
  }
  return rings;
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let _ringCache = null;

function _ringsOf(geo) {
  if (_ringCache && _ringCache.geo === geo) return _ringCache.rings;
  const rings = {};
  for (const [code, d] of Object.entries(geo.paths)) rings[code] = parseSvgPath(d);
  _ringCache = { geo, rings };
  return rings;
}

export function prefectureAt(lat, lon, geo) {
  const [x, y] = projectToSvg(lat, lon, geo.bounds);
  const rings = _ringsOf(geo);

  for (const [code, subpaths] of Object.entries(rings)) {
    for (const ring of subpaths) if (pointInRing(x, y, ring)) return +code;
  }

  // 海上・国外。最寄りの県へ寄せる。null を返すと呼び出し側が詰む。
  let best = null, bestD = Infinity;
  for (const [code, subpaths] of Object.entries(rings)) {
    for (const ring of subpaths) {
      for (const [px, py] of ring) {
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) { bestD = d; best = +code; }
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: 実データで有名地点を確認**

Run:
```bash
node -e "
import('./assets/hitori/core.js').then(async core => {
  const fs = await import('fs');
  const geo = JSON.parse(fs.readFileSync('data/hitori/prefectures_svg.json','utf8'));
  const cases = [['東京駅',35.6812,139.7671,13],['大阪駅',34.7024,135.4959,27],
                 ['札幌駅',43.0687,141.3508,1],['那覇市役所',26.2124,127.6809,47],
                 ['仙台駅',38.2601,140.8819,4],['博多駅',33.5897,130.4207,40]];
  let bad=0;
  for (const [n,la,lo,want] of cases) {
    const got = core.prefectureAt(la,lo,geo);
    const ok = got===want;
    if (!ok) bad++;
    console.log((ok?'ok  ':'NG  ')+n.padEnd(12), 'want',want,'got',got);
  }
  process.exit(bad?1:0);
});
"
```
Expected: 6件すべて `ok`。外れる場合は `bounds` の使い方か `parseSvgPath` を疑う。

- [ ] **Step 6: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 現在地から都道府県を判定する関数を追加"
```

---

### Task 9: core.js — 絞り込みと並べ替え

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: Task 6 の `haversineM`
- Produces:
  - `rowsToObjects(doc) -> object[]` — 列指向JSON → オブジェクト配列
  - `withDistance(items, lat, lon) -> object[]` — 各要素に `distM` を付けて返す
  - `filterItems(items, opts) -> object[]` — `opts = {cats:Set, maxDistM:number|null, minSolo, minQuiet, minEasy, nochain:boolean, minConf:number, requireHours:boolean}`
  - `sortByDistance(items) -> object[]`

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_core_test.mjs` に追加:

```javascript
const DOC = {
  fields: ['id', 'name', 'lat', 'lon', 'cat', 'kind', 'solo', 'quiet', 'easy',
           'conf', 'chain', 'hidden', 'hidden_n', 'city', 'oh', 'tel', 'web', 'note'],
  items: [
    ['n1', '近いチェーン', 35.0010, 139.0, 'eat', 'gyudon', 5, 4, 4, 0, 1, 0.0, 8, '', '11:00-23:00', '', '', ''],
    ['n2', '遠い独立店', 35.0500, 139.0, 'eat', 'soba_udon', 4, 4, 3, 0, 0, 0.83, 12, '', '', '', '', ''],
    ['n3', '近い図書館', 35.0005, 139.0, 'stay', 'library', 4, 5, 5, 1, 0, 0.0, 2, '', '', '', '', ''],
    ['n4', '近い立ち飲み', 35.0008, 139.0, 'eat', 'standing', 5, 2, 2, 0, 0, 0.7, 6, '', '', '', '', ''],
  ],
};

check('rowsToObjects', () => {
  const o = core.rowsToObjects(DOC);
  eq(o.length, 4);
  eq(o[0].id, 'n1');
  eq(o[0].solo, 5);
  eq(o[1].hidden, 0.83);
});

check('withDistance', () => {
  const o = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  near(o[0].distM, 111, 30);
  if (!(o[1].distM > o[0].distM)) throw new Error('遠い店の距離が近い店以下');
});

check('sortByDistance', () => {
  const o = core.sortByDistance(core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0));
  eq(JSON.stringify(o.map(x => x.id)), JSON.stringify(['n3', 'n4', 'n1', 'n2']));
});

check('filterItems: カテゴリ', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  const r = core.filterItems(all, { cats: new Set(['stay']) });
  eq(r.length, 1);
  eq(r[0].id, 'n3');
});

check('filterItems: 距離', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { maxDistM: 400 }).length, 3, '400m以内は3件');
  eq(core.filterItems(all, { maxDistM: null }).length, 4, 'null は無制限');
});

check('filterItems: 3軸の下限', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { minSolo: 5 }).length, 2, 'solo>=5 は n1,n4');
  eq(core.filterItems(all, { minQuiet: 5 }).length, 1, 'quiet>=5 は図書館だけ');
  eq(core.filterItems(all, { minEasy: 4 }).length, 2, 'easy>=4 は n1,n3');
});

check('filterItems: チェーンと信頼度と営業時間', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { nochain: true }).length, 3);
  eq(core.filterItems(all, { minConf: 1 }).length, 1);
  eq(core.filterItems(all, { requireHours: true }).length, 1, 'oh があるのは n1 だけ');
});

check('filterItems: 条件は積で効く', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  const r = core.filterItems(all, { cats: new Set(['eat']), nochain: true, minQuiet: 4 });
  eq(r.length, 1);
  eq(r[0].id, 'n2');
});

check('filterItems: 空の opts は素通し', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, {}).length, 4);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.rowsToObjects is not a function`

- [ ] **Step 3: 実装を追加**

`assets/hitori/core.js` の末尾に追加:

```javascript
// --- 絞り込みと並べ替え ---

export function rowsToObjects(doc) {
  const f = doc.fields;
  return doc.items.map(row => {
    const o = {};
    for (let i = 0; i < f.length; i++) o[f[i]] = row[i];
    return o;
  });
}

export function withDistance(items, lat, lon) {
  return items.map(it => ({ ...it, distM: haversineM(lat, lon, it.lat, it.lon) }));
}

export function sortByDistance(items) {
  return items.slice().sort((a, b) => a.distM - b.distM);
}

export function filterItems(items, opts) {
  const o = opts || {};
  return items.filter(it => {
    if (o.cats && !o.cats.has(it.cat)) return false;
    if (o.maxDistM != null && it.distM > o.maxDistM) return false;
    if (o.minSolo && it.solo < o.minSolo) return false;
    if (o.minQuiet && it.quiet < o.minQuiet) return false;
    if (o.minEasy && it.easy < o.minEasy) return false;
    if (o.nochain && it.chain === 1) return false;
    if (o.minConf && it.conf < o.minConf) return false;
    if (o.requireHours && !it.oh) return false;
    return true;
  });
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 絞り込みと距離順の並べ替えを追加"
```

---

### Task 10: hitori.html — タブ構造と既存画面の退避

既存の俯瞰画面を壊さずに「全国で見る」タブへ移す。この時点では「探す」タブは空でよい。

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: 既存の `state` / `applyFilters()` / `openPrefecture()`
- Produces:
  - `switchTab(name)` — `'search'` | `'nation'`
  - `state.tab` — 現在のタブ
  - URLハッシュ `tab=nation`

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_render_test.py` の `test_detail(page)` の直前に追加し、`main()` の `test_url_restore(page)` の直後で呼ぶ:

```python
def test_tabs(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)

    # 既定は「探す」
    assert page.evaluate("state.tab") == "search"
    assert page.is_visible("#panel-search")
    assert page.is_hidden("#panel-nation")

    # 「全国で見る」へ切り替えると地図が出る
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.evaluate("state.tab") == "nation"
    assert page.is_hidden("#panel-search")
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, f"県パスが {n} 件"
    assert "tab=nation" in page.evaluate("location.hash")

    # 戻れる
    page.click("#tab-search")
    page.wait_for_timeout(200)
    assert page.evaluate("state.tab") == "search"
    assert page.is_visible("#panel-search")


def test_nation_tab_restores_from_url(page):
    page.goto(BASE + "#tab=nation&cat=bath")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.evaluate("state.tab") == "nation"
    assert page.evaluate("document.querySelector('#f-cat-bath').checked") is True
```

既存のテストは「全国で見る」タブの機能になった。**ハッシュ指定の有無で直し方が違う**ので両方を書く。

`page.goto(BASE)` だけのもの（`test_overview` / `test_chain_toggle_changes_map` / `test_category_filter_changes_map` / `test_detail` / `test_detail_fetch_failure_is_contained`）は、`goto` の直後に2行を挿入する:

```python
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
```

ハッシュ付きのもの（`test_detail_caps_are_disclosed` / `test_scatter_frames_the_items` / `test_detail_chain_filter` / `test_mobile` の `BASE + "#pref=13"`、`test_url_restore` の `BASE + "#cat=bath&nochain=1"`、`test_hashchange_resets_absent_params` の `BASE + "#cat=stay"`）は、**ハッシュの先頭に `tab=nation&` を足す**。クリックは不要になる。

```python
    page.goto(BASE + "#tab=nation&pref=13")
```

`test_file_protocol_explains_itself` はタブに関係しないので変更しない。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#tab-nation` が見つからない

- [ ] **Step 3: HTML にタブを足す**

`<main>` 直下、`<header>` の直後に挿入:

```html
  <nav class="tabs" role="tablist">
    <button type="button" id="tab-search" role="tab" aria-selected="true">探す</button>
    <button type="button" id="tab-nation" role="tab" aria-selected="false">全国で見る</button>
  </nav>

  <section id="panel-search" role="tabpanel">
    <p class="placeholder">（Task 11 で実装）</p>
  </section>

  <section id="panel-nation" role="tabpanel" hidden>
```

既存の `.filters` から `footer` の直前までを `#panel-nation` の中へ入れる。`footer` はタブの外に残す。

CSS を追加:

```css
.tabs { display: flex; gap: .5rem; margin: 1.2rem 0 0; border-bottom: 1px solid var(--line); }
.tabs button { background: none; border: none; border-bottom: 2px solid transparent;
               color: var(--muted); cursor: pointer; font: inherit; padding: .5rem 1rem; }
.tabs button[aria-selected="true"] { color: var(--fg); border-bottom-color: var(--accent); }
```

- [ ] **Step 4: JS にタブ切り替えを足す**

`state` に `tab` を追加する:

```javascript
const state = { tab: 'search', cats: new Set(CATS), nochain: false, minConf: 0, pref: null };
```

`switchTab` を追加し、`bindFilters()` の末尾で配線する:

```javascript
function switchTab(name) {
  state.tab = name === 'nation' ? 'nation' : 'search';
  for (const t of ['search', 'nation']) {
    const on = state.tab === t;
    document.getElementById('tab-' + t).setAttribute('aria-selected', String(on));
    document.getElementById('panel-' + t).hidden = !on;
  }
  syncUrl();
}
```

```javascript
  document.getElementById('tab-search').addEventListener('click', () => switchTab('search'));
  document.getElementById('tab-nation').addEventListener('click', () => switchTab('nation'));
```

`syncUrl()` の先頭に追加:

```javascript
  if (state.tab === 'nation') parts.push('tab=nation');
```

`restoreFromUrl()` に追加（`cat` の処理の前）:

```javascript
  state.tab = h.get('tab') === 'nation' ? 'nation' : 'search';
```

`init()` の `applyFilters()` の直後に `switchTab(state.tab)` を足す。

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): タブ構造を導入し俯瞰画面を「全国で見る」へ退避"
```

---

### Task 11: hitori.html — 近傍探索と一覧

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 6-9 の `core.js`、Task 3 の `neighbors.json`
- Produces:
  - `state.here` — `{lat, lon} | null`
  - `state.search` — `{cats:Set, maxDistM, minSolo, minQuiet, minEasy, requireHours}`
  - `locateAndSearch()` — 位置情報取得から一覧描画まで
  - `renderSearchList(items)` — 一覧描画
  - `window.__searchReady` — 一覧描画完了フラグ（テスト同期用）

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_render_test.py` に追加し、`main()` で呼ぶ:

```python
TOKYO = {"latitude": 35.6812, "longitude": 139.7671}


def test_search_with_location(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    assert not errors, f"JSエラー: {errors}"

    n = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert n > 0, "現在地の一覧が空"

    # 近い順に並んでいる
    d = page.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.dist)")
    assert d == sorted(d), d[:20]

    # 各行に徒歩分と直線距離の両方が出ている
    first = page.inner_text("#search-list li.item")
    assert "徒歩" in first and "直線" in first, first

    # 東京にいるので東京都が読まれている
    assert 13 in page.evaluate("Object.keys(PREF_CACHE).map(Number)")


def test_search_distance_filter(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    before = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    page.select_option("#f-dist", "400")
    page.wait_for_timeout(400)
    after = page.eval_on_selector_all("#search-list li.item", "els => els.length")
    assert after < before, f"距離を絞っても減らない ({before} -> {after})"
    maxd = page.eval_on_selector_all("#search-list li.item", "els => Math.max(...els.map(e => +e.dataset.dist))")
    assert maxd <= 400, maxd


def test_search_quiet_filter(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    page.check("#f-quiet")
    page.wait_for_timeout(400)
    quiets = page.eval_on_selector_all("#search-list li.item", "els => els.map(e => +e.dataset.quiet)")
    assert quiets, "静かフィルタで0件になった"
    assert min(quiets) >= 4, quiets[:20]


def test_search_without_location(context, page):
    # 権限を与えない → 拒否系統
    context.clear_permissions()
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    body = page.inner_text("#panel-search")
    assert "位置情報" in body, body[:200]
    # 全国で見るへの導線が出ている
    assert page.eval_on_selector_all("#panel-search a[href*='tab=nation'], #panel-search button.to-nation",
                                     "els => els.length") >= 1
    # 地図と一覧が壊れていない
    page.click("#tab-nation")
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    assert page.eval_on_selector_all("#map path[data-code]", "els => els.length") == 47
```

`main()` を、`browser.new_context()` を明示的に作る形へ変える:

```python
def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            test_overview(page)
            test_chain_toggle_changes_map(page)
            test_category_filter_changes_map(page)
            test_url_restore(page)
            test_hashchange_resets_absent_params(page)
            test_tabs(page)
            test_nation_tab_restores_from_url(page)
            test_detail(page)
            test_detail_caps_are_disclosed(page)
            test_scatter_frames_the_items(page)
            test_detail_chain_filter(page)
            test_detail_fetch_failure_is_contained(page)
            test_file_protocol_explains_itself(page)
            test_search_with_location(context, page)
            test_search_distance_filter(context, page)
            test_search_quiet_filter(context, page)
            test_search_without_location(context, page)
            page.goto(BASE)
            page.wait_for_function("window.__ready === true", timeout=15000)
            page.screenshot(path="C:/tmp/hitori_overview.png", full_page=True)
            test_mobile(page)
            browser.close()
    finally:
        httpd.shutdown()
    print("OK: render -> C:/tmp/hitori_overview.png, C:/tmp/hitori_mobile.png")
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `window.__searchReady` がタイムアウト

- [ ] **Step 3: HTML を書く**

`#panel-search` の中身を置き換える:

```html
  <section id="panel-search" role="tabpanel">
    <div class="filters">
      <fieldset><legend>カテゴリ</legend>
        <label><input type="checkbox" id="s-cat-bath" checked> 湯・サウナ</label>
        <label><input type="checkbox" id="s-cat-eat"  checked> カウンター飲食</label>
        <label><input type="checkbox" id="s-cat-play" checked> ひとり娯楽</label>
        <label><input type="checkbox" id="s-cat-stay" checked> ひとり滞在</label>
      </fieldset>
      <fieldset><legend>距離</legend>
        <select id="f-dist">
          <option value="400">徒歩5分（直線400m）</option>
          <option value="800" selected>徒歩10分（直線800m）</option>
          <option value="1600">徒歩20分（直線1.6km）</option>
          <option value="">指定なし</option>
        </select>
      </fieldset>
      <fieldset><legend>ひとり条件</legend>
        <label><input type="checkbox" id="f-solo"> 一人が標準のみ</label>
        <label><input type="checkbox" id="f-quiet"> 静かなところ</label>
        <label><input type="checkbox" id="f-easy"> 作法不要</label>
      </fieldset>
    </div>
    <details class="more-filters">
      <summary>その他の条件</summary>
      <label><input type="checkbox" id="f-hours"> 営業時間が分かる店だけ</label>
      <small id="hours-note"></small>
      <label><input type="checkbox" id="f-verified"> 出典で確認済みの店だけ</label>
      <small>現状ほぼすべてが業態からの推定です</small>
    </details>
    <p id="search-status" class="counts"></p>
    <ol id="search-list" class="items"></ol>
  </section>
```

CSS を追加:

```css
#search-list { list-style: none; padding: 0; margin: .8rem 0 0; }
#search-list .item { display: grid; grid-template-columns: 1fr auto; gap: .2rem .8rem;
                     padding: .7rem 0; border-bottom: 1px solid var(--line); cursor: pointer; }
#search-list .item:hover { background: rgba(127,127,127,.06); }
#search-list .nm { font-weight: 600; }
#search-list .meta, #search-list .dist { color: var(--muted); font-size: .82rem; }
#search-list .dist { text-align: right; white-space: nowrap; }
#search-list .badges { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .35rem; }
.badge-ax { font-size: .72rem; border: 1px solid var(--line); border-radius: 999px;
            padding: 0 .5rem; color: var(--muted); }
.badge-gem { border-color: #c05621; color: #c05621; }
.badge-open { border-color: #2f855a; color: #2f855a; }
.badge-shut { border-color: var(--line); }
.more-filters { margin: .6rem 0; font-size: .85rem; color: var(--muted); }
.placeholder { color: var(--muted); }
```

`<script>` タグを `type="module"` に変え、先頭に import を足す:

```html
<script type="module">
import * as core from './assets/hitori/core.js';
```

- [ ] **Step 4: JS を書く**

`state` を拡張する:

```javascript
const state = {
  tab: 'search', pref: null,
  cats: new Set(CATS), nochain: false, minConf: 0,   // 全国タブ用
  here: null,
  search: { cats: new Set(CATS), maxDistM: 800, minSolo: 0, minQuiet: 0, minEasy: 0,
            minConf: 0, requireHours: false },
};
let NEIGHBORS = null;
```

以下を追加する:

```javascript
const GEM_MIN_HIDDEN = 0.6;
const GEM_MIN_N = 3;

function isGem(it) {
  return it.chain === 0 && it.hidden_n >= GEM_MIN_N && it.hidden >= GEM_MIN_HIDDEN;
}

function collectItems(codes) {
  const out = [];
  for (const c of codes) {
    const doc = PREF_CACHE[c];
    if (doc) out.push(...core.rowsToObjects(doc));
  }
  return out;
}

function currentSearchResults() {
  if (!state.here) return [];
  const loaded = Object.keys(PREF_CACHE).map(Number);
  const withD = core.withDistance(collectItems(loaded), state.here.lat, state.here.lon);
  return core.sortByDistance(core.filterItems(withD, state.search));
}

function renderSearchList() {
  const items = currentSearchResults();
  const list = document.getElementById('search-list');
  const status = document.getElementById('search-status');

  if (!items.length) {
    list.innerHTML = '';
    status.innerHTML = state.search.maxDistM
      ? `この条件に該当する施設はありませんでした。<button type="button" class="widen">距離を広げる</button>`
      : 'この条件に該当する施設はありませんでした。';
    const w = status.querySelector('.widen');
    if (w) w.addEventListener('click', () => {
      document.getElementById('f-dist').value = '';
      state.search.maxDistM = null;
      renderSearchList();
    });
    return;
  }

  const failed = [...FAILED_PREFS].map(c => BY_CODE[c] && BY_CODE[c].name).filter(Boolean);
  status.textContent = `${items.length.toLocaleString()} 件`
    + (failed.length ? `（${failed.join('・')}のデータを読み込めませんでした）` : '');
  const now = new Date();
  list.innerHTML = items.slice(0, 200).map(it => {
    const st = core.openState(it.oh, now);
    const openBadge = st === 'open' ? '<span class="badge-ax badge-open">営業中</span>'
      : st === 'closed' ? '<span class="badge-ax badge-shut">営業時間外</span>'
      : '<span class="badge-ax">営業時間不明</span>';
    const m = core.walkMinutes(it.distM);
    const dist = it.distM >= 1000 ? `直線${(it.distM / 1000).toFixed(1)}km` : `直線${Math.round(it.distM)}m`;
    return `<li class="item" data-id="${it.id}" data-dist="${Math.round(it.distM)}"
              data-quiet="${it.quiet}" data-solo="${it.solo}" tabindex="0">
      <span class="nm">${escapeHtml(it.name)}</span>
      <span class="dist">徒歩${m}分<br><small>${dist} ${core.bearing8(state.here.lat, state.here.lon, it.lat, it.lon)}</small></span>
      <span class="meta">${KIND_JA[it.kind] || it.kind}</span>
      <span class="badges">
        <span class="badge-ax">ひとり度${it.solo}</span>
        <span class="badge-ax">静けさ${it.quiet}</span>
        <span class="badge-ax">入りやすさ${it.easy}</span>
        ${openBadge}
        ${it.chain ? '<span class="badge-ax">チェーン</span>' : ''}
        ${isGem(it) ? `<span class="badge-ax badge-gem">穴場 ${Math.round(it.hidden * 100)}%</span>` : ''}
      </span>
    </li>`;
  }).join('');
}

const FAILED_PREFS = new Set();

async function loadPrefIntoCache(code) {
  try {
    await loadPrefecture(code);
    FAILED_PREFS.delete(code);
    return true;
  } catch (err) {
    // spec §9: その県だけエラー表示し、取得できた県の結果は出す。
    // 黙って落とすと「その県には何も無い」と読めてしまう。
    FAILED_PREFS.add(code);
    return false;
  }
}

async function locateAndSearch() {
  const status = document.getElementById('search-status');
  if (!navigator.geolocation) {
    showLocationFallback('この端末では位置情報を利用できません。');
    return;
  }
  status.textContent = '現在地を取得しています…';

  let pos;
  try {
    pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });
  } catch (err) {
    showLocationFallback('位置情報が取得できませんでした。');
    return;
  }

  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  if (lat < 20 || lat > 46 || lon < 122 || lon > 154) {
    showLocationFallback('日本国内のみ対応しています。');
    return;
  }
  state.here = { lat, lon };

  const code = core.prefectureAt(lat, lon, GEO);
  status.textContent = `${BY_CODE[code].name} の施設を読み込んでいます…`;

  // 自県を先に描画する。隣接県は後から差し込む。
  await loadPrefIntoCache(code);
  renderSearchList();
  window.__searchReady = true;

  const neighbors = (NEIGHBORS && NEIGHBORS[String(code)]) || [];
  for (const n of neighbors) {
    if (await loadPrefIntoCache(n)) renderSearchList();
  }
}

function showLocationFallback(reason) {
  document.getElementById('search-list').innerHTML = '';
  document.getElementById('search-status').innerHTML =
    `${escapeHtml(reason)}位置情報を許可すると、現在地から近い順に探せます。<br>
     <button type="button" class="to-nation">全国で見る</button>`;
  document.querySelector('#search-status .to-nation')
    .addEventListener('click', () => switchTab('nation'));
  window.__searchReady = true;
}

function bindSearchFilters() {
  for (const c of CATS) {
    document.getElementById('s-cat-' + c).addEventListener('change', e => {
      if (e.target.checked) state.search.cats.add(c); else state.search.cats.delete(c);
      renderSearchList();
    });
  }
  document.getElementById('f-dist').addEventListener('change', e => {
    state.search.maxDistM = e.target.value ? +e.target.value : null;
    renderSearchList();
  });
  document.getElementById('f-solo').addEventListener('change', e => {
    state.search.minSolo = e.target.checked ? 5 : 0; renderSearchList();
  });
  document.getElementById('f-quiet').addEventListener('change', e => {
    state.search.minQuiet = e.target.checked ? 4 : 0; renderSearchList();
  });
  document.getElementById('f-easy').addEventListener('change', e => {
    state.search.minEasy = e.target.checked ? 4 : 0; renderSearchList();
  });
  document.getElementById('f-verified').addEventListener('change', e => {
    state.search.minConf = e.target.checked ? 1 : 0; renderSearchList();
  });
  document.getElementById('f-hours').addEventListener('change', e => {
    state.search.requireHours = e.target.checked;
    document.getElementById('hours-note').textContent = e.target.checked
      ? '営業時間が登録されているのは全体の約17%です' : '';
    renderSearchList();
  });
}
```

`init()` を変える。`neighbors.json` の取得を足し、`switchTab` の後で `locateAndSearch()` を呼ぶ:

```javascript
  const [s, g, nb] = await Promise.all([
    fetch('data/hitori/summary.json').then(r => r.json()),
    fetch('data/hitori/prefectures_svg.json').then(r => r.json()),
    fetch('data/hitori/neighbors.json').then(r => r.json()),
  ]);
  SUMMARY = s; GEO = g; NEIGHBORS = nb;
```

`init()` の末尾（`window.__ready = true;` の直前）に:

```javascript
  bindSearchFilters();
  if (state.tab === 'search') locateAndSearch();
```

`init().catch(...)` のエラーハンドラにも `window.__searchReady = true;` を足す。

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 現在地から近い順の検索一覧を実装"
```

---

### Task 12: hitori.html — 施設詳細シート

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 11 の `currentSearchResults()`
- Produces:
  - `openFacility(id)` — シートを開く
  - `closeFacility()`
  - `mapsUrl(item) -> string` — 店名＋市区町村で Google マップを検索する URL

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_facility_sheet(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)

    page.click("#search-list li.item")
    page.wait_for_selector("#facility[open], #facility:not([hidden])", timeout=10000)

    body = page.inner_text("#facility")
    assert "徒歩" in body and "直線" in body
    for label in ("ひとり度", "静けさ", "入りやすさ"):
        assert label in body, f"{label} が詳細に無い: {body[:300]}"

    # Google マップのリンクは座標ではなく店名で検索する
    href = page.get_attribute("#facility a.to-maps", "href")
    assert "google.com/maps" in href
    name = page.inner_text("#facility h3")
    from urllib.parse import unquote
    assert name.split()[0] in unquote(href), f"店名がクエリに入っていない: {href}"
    import re
    assert not re.search(r"query=3[0-9]\.\d+,1[0-9]{2}\.\d+", href), f"座標クエリのまま: {href}"

    # 閉じられる
    page.click("#facility .close")
    page.wait_for_timeout(200)
    assert page.eval_on_selector("#facility", "el => el.hidden") is True


def test_facility_shows_gem_reason(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE + "#tab=search")
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    # 穴場が1件でもあれば、その理由が数字で出ていること
    gem = page.evaluate("""
      () => { const r = currentSearchResults().find(isGem); return r ? r.id : null; }
    """)
    if not gem:
        return   # この地点に穴場が無いのは異常ではない
    page.evaluate(f"openFacility({gem!r})")
    page.wait_for_selector("#facility .gem-reason", timeout=10000)
    reason = page.inner_text("#facility .gem-reason")
    assert "周辺" in reason and "チェーン" in reason, reason
```

`main()` に `test_facility_sheet(context, page)` と `test_facility_shows_gem_reason(context, page)` を `test_search_quiet_filter` の後に足す。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#facility` が見つからない

- [ ] **Step 3: HTML を足す**

`</main>` の直前に:

```html
  <section id="facility" hidden aria-live="polite"></section>
```

CSS を追加:

```css
#facility { position: fixed; inset: auto 0 0 0; max-height: 80vh; overflow-y: auto;
            background: var(--bg); border-top: 2px solid var(--line);
            border-radius: 12px 12px 0 0; padding: 1.2rem 1rem 2rem;
            box-shadow: 0 -4px 24px rgba(0,0,0,.2); z-index: 40; }
#facility h3 { margin: 0 .5rem 0 0; font-size: 1.2rem; }
#facility .close { position: absolute; right: 1rem; top: 1rem; background: none;
                   border: 1px solid var(--line); border-radius: 6px; color: var(--fg);
                   cursor: pointer; font-size: 1.1rem; line-height: 1; padding: .2rem .5rem; }
#facility dl { display: grid; grid-template-columns: auto 1fr; gap: .3rem .9rem; margin: .8rem 0; }
#facility dt { color: var(--muted); font-size: .85rem; }
#facility dd { margin: 0; }
#facility .gem-reason { color: #c05621; font-size: .85rem; }
#facility .to-maps { display: inline-block; margin-top: .8rem; }
@media (min-width: 721px) {
  #facility { inset: auto auto 1.5rem 50%; transform: translateX(-50%);
              width: min(560px, 92vw); border-radius: 12px; border: 1px solid var(--line); }
}
```

- [ ] **Step 4: JS を足す**

```javascript
const AX_LABEL = {
  solo: ['', '', '一人でも浮かない', '一人でも浮かない', '一人が多数', '一人が標準'],
  quiet: ['', '', '声を出す場', '', '静か寄り', '会話が発生しない'],
  easy: ['', '', '常連文化・暗黙の作法', '軽い作法あり', 'ほぼ作法不要', '作法不要'],
};

function mapsUrl(it) {
  // 座標だけを渡すと無名のピンが立つだけで店の情報に着かない。店名で検索させる。
  // 市区町村を足すのは同名店の誤爆を減らすため。無ければ都道府県名で代用する。
  const where = it.city || (BY_CODE[it.prefCode] && BY_CODE[it.prefCode].name) || '';
  const q = [it.name, where].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function openFacility(id) {
  const it = currentSearchResults().find(x => x.id === id);
  if (!it) return;
  const el = document.getElementById('facility');
  const st = core.openState(it.oh, new Date());
  const hours = it.oh
    ? `${escapeHtml(it.oh)}（${st === 'open' ? '営業中' : st === 'closed' ? '営業時間外' : '解釈できない書式'}）`
    : '営業時間不明';
  const dist = it.distM >= 1000 ? `${(it.distM / 1000).toFixed(1)}km` : `${Math.round(it.distM)}m`;

  el.hidden = false;
  el.innerHTML = `
    <button type="button" class="close" aria-label="閉じる">×</button>
    <h3>${escapeHtml(it.name)}</h3>
    <p class="meta">${KIND_JA[it.kind] || it.kind}${it.city ? ' · ' + escapeHtml(it.city) : ''}</p>
    <dl>
      <dt>距離</dt><dd>徒歩${core.walkMinutes(it.distM)}分（直線${dist} ${core.bearing8(state.here.lat, state.here.lon, it.lat, it.lon)}）</dd>
      <dt>ひとり度</dt><dd>${it.solo} — ${AX_LABEL.solo[it.solo]}</dd>
      <dt>静けさ</dt><dd>${it.quiet} — ${AX_LABEL.quiet[it.quiet]}</dd>
      <dt>入りやすさ</dt><dd>${it.easy} — ${AX_LABEL.easy[it.easy]}</dd>
      <dt>営業時間</dt><dd>${hours}</dd>
      ${it.tel ? `<dt>電話</dt><dd><a href="tel:${escapeHtml(it.tel)}">${escapeHtml(it.tel)}</a></dd>` : ''}
      ${it.web ? `<dt>サイト</dt><dd><a href="${escapeHtml(it.web)}" target="_blank" rel="noopener">公式サイト</a></dd>` : ''}
    </dl>
    ${isGem(it) ? `<p class="gem-reason">穴場度 ${Math.round(it.hidden * 100)}%（周辺${it.hidden_n}件中${Math.round(it.hidden * it.hidden_n)}件がチェーン）</p>` : ''}
    ${it.note ? `<p class="note">${escapeHtml(it.note)}</p>` : ''}
    <div id="facility-map"></div>
    <a class="to-maps" href="${mapsUrl(it)}" target="_blank" rel="noopener">経路を調べる（Googleマップ）</a>`;
  el.querySelector('.close').addEventListener('click', closeFacility);
  renderFacilityMap(it);   // Task 13 で実装。ここでは空関数でよい。
}

function closeFacility() {
  document.getElementById('facility').hidden = true;
}

function renderFacilityMap(it) { /* Task 13 で実装 */ }
```

`renderSearchList()` の直後に一覧のクリック配線を足す（`init()` 内で1回だけ）:

```javascript
  document.getElementById('search-list').addEventListener('click', e => {
    const li = e.target.closest('li.item');
    if (li) openFacility(li.dataset.id);
  });
  document.getElementById('search-list').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('li.item');
    if (li) { e.preventDefault(); openFacility(li.dataset.id); }
  });
```

`collectItems()` で `prefCode` を付ける（`mapsUrl` が使う）:

```javascript
function collectItems(codes) {
  const out = [];
  for (const c of codes) {
    const doc = PREF_CACHE[c];
    if (doc) for (const o of core.rowsToObjects(doc)) out.push({ ...o, prefCode: c });
  }
  return out;
}
```

テストが `page.evaluate("currentSearchResults()")` と `openFacility(...)` を呼ぶため、モジュールスコープの関数を window へ出す。`init()` の末尾に:

```javascript
  // 描画テストから触るために公開する
  Object.assign(window, { state, core, PREF_CACHE, currentSearchResults, isGem, openFacility });
```

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 施設詳細シートを実装しGoogleマップを店名検索に変更"
```

---

### Task 13: hitori.html — 地理院タイルの地図

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 12 の `renderFacilityMap(it)`
- Produces: 詳細シート内の地図。MapLibre GL JS ＋ 地理院タイル

MapLibre GL JS は CDN から読む。バージョンを固定する。

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
```

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_facility_map(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.goto(BASE)
    page.wait_for_function("window.__searchReady === true", timeout=30000)
    page.click("#search-list li.item")
    page.wait_for_selector("#facility-map canvas", timeout=20000)

    # 地理院タイルを実際に取りに行っていること
    reqs = page.evaluate("window.__tileHosts || []")
    assert any("cyberjapandata.gsi.go.jp" in h for h in reqs), reqs

    # 出典が出ている
    body = page.inner_text("#facility")
    assert "地理院タイル" in body, body[:300]

    # 施設と現在地の2つのマーカー
    n = page.eval_on_selector_all("#facility-map .maplibregl-marker", "els => els.length")
    assert n == 2, f"マーカーが {n} 個"
```

`main()` の `test_facility_shows_gem_reason` の後に足す。タイル取得を記録するため、`test_facility_map` の `page.goto` の前に以下を入れる:

```python
    page.add_init_script("""
      window.__tileHosts = [];
      const _f = window.fetch;
      window.fetch = function (u, ...rest) {
        try { window.__tileHosts.push(new URL(u, location.href).host); } catch (e) {}
        return _f.call(this, u, ...rest);
      };
      const _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (m, u, ...rest) {
        try { window.__tileHosts.push(new URL(u, location.href).host); } catch (e) {}
        return _open.call(this, m, u, ...rest);
      };
    """)
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#facility-map canvas` がタイムアウト

- [ ] **Step 3: 実装を書く**

`<head>` に MapLibre の CSS と JS を足す（`<script type="module">` より前に置く）。

CSS を追加:

```css
#facility-map { width: 100%; height: 220px; border-radius: 8px; overflow: hidden;
                margin: .8rem 0; background: #eef2f6; }
#facility-map .maplibregl-ctrl-attrib { font-size: 10px; }
.map-credit { font-size: .75rem; color: var(--muted); margin: -.4rem 0 .4rem; }
```

`renderFacilityMap` を実装で置き換える:

```javascript
let _facilityMap = null;

// 地理院タイル（国土地理院）。APIキー不要・無料。出典明記のみで利用できる。
// 淡色地図を使う。標準地図は色が強く、施設ピンが埋もれる。
const GSI_TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル（国土地理院）</a>';

function renderFacilityMap(it) {
  const el = document.getElementById('facility-map');
  if (!el || typeof maplibregl === 'undefined') {
    if (el) el.innerHTML = `<p class="map-credit">地図を表示できませんでした。${GSI_ATTR}</p>`;
    return;
  }

  if (_facilityMap) { _facilityMap.remove(); _facilityMap = null; }

  _facilityMap = new maplibregl.Map({
    container: el,
    style: {
      version: 8,
      sources: { gsi: { type: 'raster', tiles: [GSI_TILE], tileSize: 256, attribution: GSI_ATTR } },
      layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
    },
    center: [it.lon, it.lat],
    zoom: 16,
    attributionControl: { compact: false },
  });
  _facilityMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  new maplibregl.Marker({ color: '#c05621' }).setLngLat([it.lon, it.lat]).addTo(_facilityMap);
  if (state.here) {
    new maplibregl.Marker({ color: '#2b5f96' })
      .setLngLat([state.here.lon, state.here.lat]).addTo(_facilityMap);
    // 現在地と施設の両方が入るように寄せる
    const b = new maplibregl.LngLatBounds([it.lon, it.lat], [it.lon, it.lat]);
    b.extend([state.here.lon, state.here.lat]);
    _facilityMap.fitBounds(b, { padding: 48, maxZoom: 17, duration: 0 });
  }
}
```

`closeFacility()` で地図を破棄する:

```javascript
function closeFacility() {
  if (_facilityMap) { _facilityMap.remove(); _facilityMap = null; }
  document.getElementById('facility').hidden = true;
}
```

フッターの出典に1行足す:

```html
    <p class="credits">地図データ: 地球地図日本（国土地理院） / 地図タイル: 地理院タイル（国土地理院） / 施設データ: © OpenStreetMap contributors (ODbL) / 人口: Wikidata (CC0) / 令和2年国勢調査</p>
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 5: 目視**

Run:
```bash
PYTHONUTF8=1 python - <<'PYEOF'
import threading, functools, http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path.cwd(); PORT = 8903
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844},
                        geolocation={"latitude": 35.6812, "longitude": 139.7671},
                        permissions=["geolocation"])
    pg = ctx.new_page()
    pg.goto(f"http://127.0.0.1:{PORT}/hitori.html")
    pg.wait_for_function("window.__searchReady === true", timeout=30000)
    pg.screenshot(path="C:/tmp/hitori_search.png", full_page=True)
    pg.click("#search-list li.item")
    pg.wait_for_selector("#facility-map canvas", timeout=20000)
    pg.wait_for_timeout(1500)
    pg.screenshot(path="C:/tmp/hitori_facility.png")
    b.close()
httpd.shutdown()
print("wrote C:/tmp/hitori_search.png, C:/tmp/hitori_facility.png")
PYEOF
```
Expected: `C:/tmp/hitori_facility.png` に地理院タイルの地図が描かれ、オレンジ（施設）と青（現在地）の2つのピンが見えること。地図がグレーのままならタイルURLかスタイル定義を疑う。

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 詳細シートに地理院タイルの地図を追加"
```

---

### Task 14: 全体検証とサイト反映

**Files:**
- Modify: `tests/hitori_all.py`
- Modify: `index.html`

**Interfaces:**
- Consumes: これまでの全成果物
- Produces: 全テストの一括実行

- [ ] **Step 1: テストランナーを更新**

`tests/hitori_all.py` の `TESTS` に新しいスイートを足し、Node のテストも実行するようにする:

```python
TESTS = [
    "hitori_master_test.py",
    "hitori_scoring_test.py",
    "hitori_hidden_test.py",
    "hitori_neighbors_test.py",
    "hitori_osm_query_test.py",
    "hitori_normalize_test.py",
    "hitori_validate_test.py",
    "hitori_build_test.py",
    "hitori_mapsvg_test.py",
    "hitori_ingest_test.py",
    "hitori_queue_test.py",
    "hitori_render_test.py",   # Playwright を使うので最後
]
NODE_TESTS = ["hitori_core_test.mjs"]
```

`main()` の Python ループの前に Node のループを足す:

```python
    for t in NODE_TESTS:
        print(f"\n=== {t} ===", flush=True)
        r = subprocess.run(["node", str(ROOT / "tests" / t)], cwd=str(ROOT), env=env)
        if r.returncode != 0:
            failed.append(t)
```

`print(f"ALL PASS ({len(TESTS)} suites)")` を `print(f"ALL PASS ({len(TESTS) + len(NODE_TESTS)} suites)")` に変える。

- [ ] **Step 2: 全テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_all.py`
Expected: `ALL PASS (13 suites)`

落ちたスイートがあれば、そのタスクに戻って直す。

- [ ] **Step 3: index.html の説明文を更新**

カードの `dsc` を検索アプリの説明に変える。

```html
        <div class="dsc">現在地から近い順に、ひとりが標準の店だけを探せる。静けさと入りやすさで絞り込み、穴場も見つかる。</div>
```

- [ ] **Step 4: sitemap を再生成**

Run: `PYTHONUTF8=1 python scripts/generate_sitemap.py && PYTHONUTF8=1 python scripts/generate_sitemap_alt.py`
Expected: `wrote C:\projects\yuichi916.github.io\sitemap.xml (76 URLs)` — 件数は変わらない（新規ページを足していないため）

- [ ] **Step 5: 最終目視**

`C:/tmp/hitori_search.png` と `C:/tmp/hitori_facility.png` を開き、以下を確認する。

- 一覧が近い順で、各行に徒歩分と直線距離の両方が出ている
- 3軸バッジと営業状態バッジが読める
- 穴場バッジが付いている店がある
- 詳細シートに地図が描かれ、ピンが2つある
- 「経路を調べる」のリンクが店名検索になっている（リンクを右クリックしてURLを確認）
- モバイル幅で横スクロールが出ていない

- [ ] **Step 6: Commit**

```bash
git add tests/hitori_all.py index.html sitemap.xml sitemap-v2.xml sitemap-index.xml
git commit -m "feat(hitori): テストランナーを更新しサイトの説明文を検索アプリ向けに変更"
```

---

## 実行後の運用

データ更新は4コマンド。

```bash
PYTHONUTF8=1 python scripts/hitori/fetch_osm.py       # Overpass から取り直す（30〜60分）
PYTHONUTF8=1 python scripts/hitori/neighbors.py       # 隣接県（県境データが変わったときだけ）
PYTHONUTF8=1 python scripts/hitori/build_data.py      # 3軸スコア・穴場・分割出力
PYTHONUTF8=1 python tests/hitori_all.py               # 全テスト
```

投稿の取り込みは Overpass を叩き直す必要がない。

```bash
PYTHONUTF8=1 python scripts/hitori/ingest_issues.py --close
PYTHONUTF8=1 python scripts/hitori/build_data.py
```

## フェーズ2（この計画には含まない）

- HotPepper グルメAPI の取り込み（要APIキー登録）。緯度経度＋半径検索、予算、営業時間、席数が取れる。「カウンター席あり」はAPIに無いため自由文メモからの抽出になる
- Yahoo!ローカルサーチAPI の取り込み（要Client ID）
- 複数ソースの名寄せ（同じ店を1件にまとめる）
- Google Places API（有料・キャッシュ30日制限・表示要件あり）
