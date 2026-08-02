# ひとり歓迎マップ（hitori.html）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「ひとりが標準の施設」約4万件を、人口あたり密度の県別ヒートマップ＋ドリルダウンで見せる単一HTMLページを yuichi916.github.io に追加する。

**Architecture:** ビルド時に Overpass API から県単位でデータを取得し、業態ベースのスコアリングとチェーン判定を通して静的JSONへ固める。ランタイムは `summary.json`（数KB）を先読みして日本地図を塗り、県クリック時にだけ `pref/{code}.json` を fetch する二段配信。外部タイルサーバーへの依存はゼロ。

**Tech Stack:** Python 3.10 標準ライブラリのみ（urllib / json / re / math / pathlib）、素の HTML+CSS+JS（フレームワークなし）、Playwright（描画テストのみ）

## Global Constraints

- Python は **標準ライブラリのみ**。`requests` など追加パッケージを import しない。HTTP は `urllib.request` を使う
- テストは repo 慣例に従い `tests/hitori_*_test.py` に置き、`main()` を持つ素の Python スクリプトとして書く。**pytest は使わない**（この repo に pytest 設定は存在しない）
- テスト実行は必ず `PYTHONUTF8=1 python tests/hitori_xxx_test.py`。Windows のため UTF-8 強制が必須
- すべてのファイルは UTF-8（BOMなし）。Python ファイル冒頭に `# -*- coding: utf-8 -*-` を置く
- ファイルパスは repo ルート（`C:\projects\yuichi916.github.io`）からの相対で扱い、スクリプト内では `Path(__file__).resolve().parents[2]` で ROOT を求める
- commit は Conventional Commits。scope は `hitori`
- `hitori.html` を commit する前に `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html` が exit 0 であること
- **`hitori.html` にアフィリエイトリンクを置かない。** 県境データの出典である地球地図日本は非営利利用なら出典明記のみで足りるが、営利利用は著作権者への利用報告が必要になるため
- ページ下部に出典を常設表示する。文言は以下を逐語で使う:
  - `地図データ: 地球地図日本（国土地理院）`
  - `施設データ: © OpenStreetMap contributors (ODbL)`
  - `人口: Wikidata (CC0) / 令和2年国勢調査`
- 免責文も逐語で使う: `この分類は OpenStreetMap のタグと業態から機械的に推定したものです。実際の座席形態や黙浴の有無を保証するものではありません。`
- チェーンフィルタのラベルは `チェーンを隠す`、補助テキストは `判明しているチェーンのみ。地域チェーンは残る場合があります`。**「個人店だけ」と書かない**（独立店判定は不在証明であり言い切れない）

## Spec からの逸脱

spec §4 のファイル構成はテストを `tests\hitori\test_*.py` としていたが、この repo の既存テストは `tests/<name>_test.py` のフラット配置・pytest不使用である。**repo 慣例を優先**し、`tests/hitori_scoring_test.py` 等に変更する。

spec §8 は県境データを Natural Earth としていたが、調査の結果 dataofjapan/land 経由の**地球地図日本（国土地理院）**を使う。47都道府県が `id`（県コード）と `nam_ja` 付きで揃っており、日本の県境として Natural Earth より正確。ライセンスは出典明記で足りる。

spec §4 は県コード・名称と人口を `scripts/hitori/prefecture_population.json` に分けていたが、どちらも Wikidata の同一クエリで同時に取れるため `data/hitori/prefectures.json` 1本に統合する。

---

### Task 1: 県マスタと人口データ

Wikidata から47都道府県のコード・名称・人口を取得する。手打ち転記を避け、再取得可能にする。

**Files:**
- Create: `scripts/hitori/fetch_master.py`
- Create: `data/hitori/prefectures.json`（スクリプトが生成、commit する）
- Test: `tests/hitori_master_test.py`

**Interfaces:**
- Consumes: なし
- Produces: `data/hitori/prefectures.json` — `[{"code":1,"name":"北海道","pop":5432200}, ...]` の47要素配列（code昇順）。以降のすべてのタスクがこのファイルを読む

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_master_test.py`:

```python
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_master_test.py`
Expected: FAIL with `AssertionError: not found: ...prefectures.json`

- [ ] **Step 3: 取得スクリプトを書く**

`scripts/hitori/fetch_master.py`:

```python
# -*- coding: utf-8 -*-
"""Wikidata SPARQL から47都道府県のコード・名称・人口を取得する。

人口(P1082)はほぼ令和2年国勢調査の値。全国地方公共団体コード(P429)は
6桁のチェックディジット付きなので上2桁を県コードとして使う。
"""
import json, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "hitori" / "prefectures.json"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "hitori-map/1.0 (https://yuichi916.github.io/hitori.html)"

QUERY = """
SELECT ?pref ?prefLabel ?code ?pop WHERE {
  ?pref wdt:P31 wd:Q50337 ; wdt:P429 ?code ; wdt:P1082 ?pop .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja" }
} ORDER BY xsd:integer(?code)
"""


def fetch():
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": QUERY, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["results"]["bindings"]


def main():
    rows = []
    for b in fetch():
        rows.append({
            "code": int(b["code"]["value"][:2]),
            "name": b["prefLabel"]["value"],
            "pop": int(float(b["pop"]["value"])),
        })
    rows.sort(key=lambda r: r["code"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} prefectures, total {sum(r['pop'] for r in rows):,})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 実行してテストを通す**

Run: `PYTHONUTF8=1 python scripts/hitori/fetch_master.py && PYTHONUTF8=1 python tests/hitori_master_test.py`
Expected: `wrote ...prefectures.json (47 prefectures, total 126,219,035)` に続いて `OK: 47県 / 合計 126,219,035 人 / 上位 ['東京都', '神奈川県', '大阪府', '愛知県', '埼玉県']`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/fetch_master.py data/hitori/prefectures.json tests/hitori_master_test.py
git commit -m "feat(hitori): 県マスタと人口をWikidataから取得"
```

---

### Task 2: 業態分類とスコアリング

spec §5 の判定表を副作用のない純関数にする。**ここが仕様の本体**なので実装より先にテストを書く。

**Files:**
- Create: `scripts/hitori/scoring.py`
- Test: `tests/hitori_scoring_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `classify(tags: dict) -> tuple[str, str, int] | None` — `(cat, kind, base)`。収録対象外なら `None`
  - `score(base: int, name: str, evidence: list[dict]) -> int` — 1〜5
  - `confidence(evidence: list[dict]) -> int` — 0/1/2
  - `SOLO_BRANDS: list[str]`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_scoring_test.py`:

```python
# -*- coding: utf-8 -*-
"""スコアリングの純関数テスト。spec §5 の判定表がそのまま期待値になっている。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import scoring


def test_classify():
    # eat: 名前ルールが cuisine ルターより優先される
    assert scoring.classify({"amenity": "restaurant", "name": "立ち食いそば まる", "cuisine": "soba"}) == ("eat", "standing", 5)
    assert scoring.classify({"amenity": "fast_food", "name": "角打ち よしだ"}) == ("eat", "standing", 5)
    assert scoring.classify({"amenity": "restaurant", "name": "焼肉ライク 新宿店"}) == ("eat", "yakiniku_solo", 5)
    assert scoring.classify({"amenity": "restaurant", "name": "一蘭 渋谷店", "cuisine": "ramen"}) == ("eat", "ramen", 4)
    assert scoring.classify({"amenity": "fast_food", "name": "富士そば", "cuisine": "soba;udon"}) == ("eat", "soba_udon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "松屋", "cuisine": "gyudon"}) == ("eat", "gyudon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "CoCo壱番屋", "cuisine": "curry"}) == ("eat", "curry", 4)

    # eat: 対象外の業態は収録しない
    assert scoring.classify({"amenity": "restaurant", "name": "居酒屋 とり", "cuisine": "izakaya"}) is None
    assert scoring.classify({"amenity": "cafe", "name": "喫茶 のんびり"}) is None

    # bath
    assert scoring.classify({"leisure": "sauna", "name": "サウナ○○"}) == ("bath", "sauna", 5)
    assert scoring.classify({"amenity": "public_bath", "bath:type": "onsen", "name": "○○温泉"}) == ("bath", "onsen", 3)
    assert scoring.classify({"amenity": "public_bath", "name": "○○湯"}) == ("bath", "sento", 4)

    # play / stay
    assert scoring.classify({"amenity": "internet_cafe", "name": "快活CLUB"}) == ("play", "netcafe", 5)
    assert scoring.classify({"amenity": "karaoke_box", "name": "まねきねこ"}) == ("play", "karaoke", 4)
    assert scoring.classify({"amenity": "cinema", "name": "○○シネマ"}) == ("play", "cinema", 3)
    assert scoring.classify({"amenity": "library", "name": "○○図書館"}) == ("stay", "library", 4)
    assert scoring.classify({"tourism": "hostel", "name": "○○ゲストハウス"}) == ("stay", "hostel", 3)
    assert scoring.classify({"tourism": "museum", "name": "○○美術館"}) == ("stay", "museum", 3)

    # 該当なし
    assert scoring.classify({"shop": "convenience", "name": "○○ストア"}) is None
    assert scoring.classify({}) is None

    # restaurant タグと public_bath タグが同居しても bath に落ちる（早期 None にしない）
    assert scoring.classify({"amenity": "public_bath", "cuisine": "izakaya"}) == ("bath", "sento", 4)


def test_score():
    # チェーン加点なし・エビデンスなし
    assert scoring.score(4, "はやしや", []) == 4
    # SOLO_BRANDS 一致で +1
    assert scoring.score(4, "一蘭 渋谷店", []) == 5
    # 上限5でクランプ（base5 + ブランド加点）
    assert scoring.score(5, "焼肉ライク 新宿店", []) == 5
    # 肯定エビデンスで +1
    assert scoring.score(3, "○○温泉", [{"src": "web", "checked": "2026-08-01", "polarity": "+"}]) == 4
    # 否定エビデンスで -1
    assert scoring.score(4, "はやしや", [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]) == 3
    # 賛否が混在したら確認日が新しいほうが勝つ
    mixed = [
        {"src": "web", "checked": "2026-01-01", "polarity": "+"},
        {"src": "user", "checked": "2026-08-01", "polarity": "-"},
    ]
    assert scoring.score(4, "はやしや", mixed) == 3
    mixed2 = [
        {"src": "user", "checked": "2026-08-01", "polarity": "+"},
        {"src": "web", "checked": "2026-01-01", "polarity": "-"},
    ]
    assert scoring.score(4, "はやしや", mixed2) == 5
    # 下限1でクランプ
    assert scoring.score(1, "はやしや", [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]) == 1


def test_confidence():
    assert scoring.confidence([]) == 0
    assert scoring.confidence([{"src": "web", "checked": "2026-08-01", "polarity": "+"}]) == 1
    assert scoring.confidence([{"src": "user", "checked": "2026-08-01", "polarity": "+"}]) == 2
    assert scoring.confidence([{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]) == 2
    # web と user が混在したら高いほうを採る
    assert scoring.confidence([
        {"src": "web", "checked": "2026-01-01", "polarity": "+"},
        {"src": "user", "checked": "2026-08-01", "polarity": "+"},
    ]) == 2


def main():
    test_classify()
    test_score()
    test_confidence()
    print("OK: scoring")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'scoring'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/scoring.py`:

```python
# -*- coding: utf-8 -*-
"""ひとり歓迎マップのスコアリング。純関数のみ。I/O も副作用も持たない。

OSM には「黙浴」「カウンター席」というタグが存在しないため、
「業態としてひとりが標準かどうか」を代理指標にしている。これは推定であり、
画面上でもそう明示する。詳細は spec §5 を参照。
"""
import re

# ひとり歓迎チェーン。一致すると score に +1。実測で飲食7,849件が該当する。
SOLO_BRANDS = [
    "一蘭", "焼肉ライク", "いきなりステーキ", "てんや", "富士そば",
    "日高屋", "大戸屋", "やよい軒", "CoCo壱番屋", "ゆで太郎",
    "松屋", "吉野家", "すき家", "なか卯", "丸亀製麺",
    "はなまるうどん", "かつや", "餃子の王将", "リンガーハット", "天下一品",
]

_SOLO_RE = re.compile("|".join(re.escape(b) for b in SOLO_BRANDS))
_STANDING = re.compile(r"立ち食い|立ち飲み|立喰|立呑|角打ち")
_YAKINIKU_SOLO = re.compile(r"焼肉ライク|一人焼肉|ひとり焼肉|ひとり焼き肉")
_EAT_AMENITY = {"restaurant", "fast_food"}


def classify(tags):
    """OSMタグ辞書 → (cat, kind, base) または None（収録対象外）。

    複数条件に該当する場合は先に書いた行が勝つ（spec §5 の表の順序）。
    eat 判定が外れても bath/play/stay の判定へ落ちるよう、途中で None を返さない。
    """
    amenity = tags.get("amenity", "")
    name = tags.get("name", "")
    cuisine = tags.get("cuisine", "")

    if amenity in _EAT_AMENITY:
        if _STANDING.search(name):
            return ("eat", "standing", 5)
        if _YAKINIKU_SOLO.search(name):
            return ("eat", "yakiniku_solo", 5)
        if "ramen" in cuisine:
            return ("eat", "ramen", 4)
        if any(k in cuisine for k in ("soba", "udon", "noodle")):
            return ("eat", "soba_udon", 4)
        if any(k in cuisine for k in ("gyudon", "donburi")):
            return ("eat", "gyudon", 4)
        if "curry" in cuisine:
            return ("eat", "curry", 4)

    if tags.get("leisure") == "sauna":
        return ("bath", "sauna", 5)
    if amenity == "public_bath":
        if tags.get("bath:type") == "onsen":
            return ("bath", "onsen", 3)
        return ("bath", "sento", 4)

    if amenity == "internet_cafe":
        return ("play", "netcafe", 5)
    if amenity == "karaoke_box":
        return ("play", "karaoke", 4)
    if amenity == "cinema":
        return ("play", "cinema", 3)

    if amenity == "library":
        return ("stay", "library", 4)
    if tags.get("tourism") == "hostel":
        return ("stay", "hostel", 3)
    if tags.get("tourism") == "museum":
        return ("stay", "museum", 3)

    return None


def _decisive_polarity(evidence):
    """賛否が混在する場合は確認日が新しいほうが勝つ。同日なら否定を優先（保守的）。"""
    if not evidence:
        return None
    pols = {e.get("polarity", "+") for e in evidence}
    if len(pols) == 1:
        return pols.pop()
    newest = max(e.get("checked", "") for e in evidence)
    same_day = {e.get("polarity", "+") for e in evidence if e.get("checked", "") == newest}
    return "-" if "-" in same_day else "+"


def score(base, name, evidence):
    """業態ベース点 + チェーン加点 + エビデンス加減 を 1〜5 にクランプして返す。"""
    s = base
    if _SOLO_RE.search(name or ""):
        s += 1
    pol = _decisive_polarity(evidence)
    if pol == "+":
        s += 1
    elif pol == "-":
        s -= 1
    return max(1, min(5, s))


def confidence(evidence):
    """0=推定 / 1=出典あり / 2=現地確認。複数あれば高いほうを採る。"""
    if not evidence:
        return 0
    srcs = {e.get("src") for e in evidence}
    if srcs & {"user", "visit"}:
        return 2
    return 1
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: `OK: scoring`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/scoring.py tests/hitori_scoring_test.py
git commit -m "feat(hitori): 業態分類とスコアリングの純関数を追加"
```

---

### Task 3: チェーン判定

spec §5「チェーン判定」を実装する。`brand` タグの被覆率が飲食14.8%・銭湯0.07%しかないことを実測済みなので、**名称リストが主役で `brand` タグは補助**という優先順位が要点。

**Files:**
- Modify: `scripts/hitori/scoring.py`（`CHAIN_BRANDS` と `is_chain()` を追加）
- Modify: `tests/hitori_scoring_test.py`（`test_is_chain()` を追加）

**Interfaces:**
- Consumes: Task 2 の `SOLO_BRANDS`
- Produces: `is_chain(tags: dict, curated: dict | None = None) -> int` — 0=独立店 / 1=チェーン、`CHAIN_BRANDS: list[str]`

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_scoring_test.py` の `test_confidence()` の直後に追加し、`main()` にも呼び出しを足す:

```python
def test_is_chain():
    # 優先順位1: curated の明示指定がすべてに勝つ
    assert scoring.is_chain({"brand": "一蘭", "name": "一蘭 渋谷店"}, {"chain": 0}) == 0
    assert scoring.is_chain({"name": "個人の店"}, {"chain": 1}) == 1
    # curated はあるが chain キーがなければ無視
    assert scoring.is_chain({"name": "個人の店"}, {"note": "メモだけ"}) == 0

    # 優先順位2: brand / brand:wikidata タグ
    assert scoring.is_chain({"name": "無名の店", "brand": "なにか"}) == 1
    assert scoring.is_chain({"name": "無名の店", "brand:wikidata": "Q123"}) == 1

    # 優先順位3: 名称リスト。SOLO_BRANDS は CHAIN_BRANDS に含まれる
    assert scoring.is_chain({"name": "松屋 渋谷店"}) == 1
    assert scoring.is_chain({"name": "極楽湯 多摩センター店"}) == 1
    assert scoring.is_chain({"name": "快活CLUB 池袋店"}) == 1
    assert scoring.is_chain({"name": "スーパーホテル大阪"}) == 1

    # 優先順位4: 非該当
    assert scoring.is_chain({"name": "はやしや"}) == 0
    assert scoring.is_chain({}) == 0

    # SOLO_BRANDS ⊂ CHAIN_BRANDS であること
    for b in scoring.SOLO_BRANDS:
        assert b in scoring.CHAIN_BRANDS, f"{b} が CHAIN_BRANDS にない"
```

`main()` を以下に差し替える:

```python
def main():
    test_classify()
    test_score()
    test_confidence()
    test_is_chain()
    print("OK: scoring")
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: FAIL with `AttributeError: module 'scoring' has no attribute 'is_chain'`

- [ ] **Step 3: 実装を追加**

`scripts/hitori/scoring.py` の `SOLO_BRANDS` / `_SOLO_RE` 定義の直後に追加:

```python
# チェーン判定用。SOLO_BRANDS を包含する上位集合。
# 「チェーンを隠す」フィルタのためだけに使い、スコアには影響しない。
CHAIN_BRANDS = SOLO_BRANDS + [
    # 飲食
    "幸楽苑", "一風堂", "丸源ラーメン", "山田うどん", "小諸そば",
    "ばんどう太郎", "王将", "らあめん花月嵐", "スシロー", "はま寿司",
    # 湯
    "極楽湯", "万葉倶楽部", "おふろの王様", "湯けむりの里", "スパリゾート",
    "竜泉寺の湯", "野天風呂", "コナミスポーツ",
    # 娯楽
    "ビッグエコー", "カラオケ館", "まねきねこ", "ジョイサウンド", "シダックス",
    "快活CLUB", "自遊空間", "アプレシオ", "マンボー", "イオンシネマ",
    "TOHOシネマズ", "ユナイテッド・シネマ", "MOVIX",
    # 滞在
    "東横INN", "東横イン", "スーパーホテル", "ドーミーイン", "APAホテル",
    "アパホテル", "ルートイン", "コンフォートホテル",
]

_CHAIN_RE = re.compile("|".join(re.escape(b) for b in CHAIN_BRANDS))
```

ファイル末尾に追加:

```python
def is_chain(tags, curated=None):
    """0=独立店 / 1=チェーン。判定順は spec §5「チェーン判定」に従う。

    0 は「チェーンだと分からなかった」という不在証明にすぎず、
    リストに載っていない地域チェーンは独立店として残る。
    画面では「個人店だけ」ではなく「チェーンを隠す」と表現すること。
    """
    if curated and "chain" in curated:
        return int(curated["chain"])
    if tags.get("brand") or tags.get("brand:wikidata"):
        return 1
    if _CHAIN_RE.search(tags.get("name", "") or ""):
        return 1
    return 0
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_scoring_test.py`
Expected: `OK: scoring`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/scoring.py tests/hitori_scoring_test.py
git commit -m "feat(hitori): チェーン判定を追加（名称リスト主体・brandタグ補助）"
```

---

### Task 4: Overpass クエリ生成と HTTP 層

タイムアウトは調査中に実際に発生した（exit 28）。リトライとミラーフォールバックをここに閉じ込める。

**Files:**
- Create: `scripts/hitori/osm_query.py`
- Test: `tests/hitori_osm_query_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `build_query(pref_code: int) -> str` — 指定県の全カテゴリを取る Overpass QL
  - `run_query(ql: str, opener=None) -> dict` — 実行。リトライ3回＋ミラー順次。`opener` はテスト差し替え用
  - `MIRRORS: list[str]`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_osm_query_test.py`:

```python
# -*- coding: utf-8 -*-
"""Overpass クエリ生成とリトライ・ミラーフォールバックの検証。実ネットワークは叩かない。"""
import sys, json, io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import osm_query


def test_build_query():
    ql = osm_query.build_query(13)

    # 県単位の area 指定（全国一括はタイムアウトするため必須）
    assert 'admin_level"="4' in ql
    assert "3600000013" not in ql, "OSM area id を直書きしない"
    assert "13" in ql

    # spec §3 の全タグが含まれること
    for needle in ['"amenity"="public_bath"', '"leisure"="sauna"',
                   '"amenity"="karaoke_box"', '"amenity"="cinema"',
                   '"amenity"="internet_cafe"', '"tourism"="hostel"',
                   '"amenity"="library"', '"tourism"="museum"']:
        assert needle in ql, f"{needle} がクエリにない"
    assert "ramen" in ql and "gyudon" in ql and "curry" in ql

    # タグ本体が必要なので out count ではなく out center
    assert "out center" in ql
    assert "out count" not in ql


class FakeOpener:
    """呼び出し回数と URL を記録し、指定回数だけ失敗させる偽の opener。"""

    def __init__(self, fail_times, payload=None):
        self.fail_times = fail_times
        self.calls = []
        self.payload = payload if payload is not None else {"elements": [{"id": 1}]}

    def __call__(self, req, timeout=None):
        self.calls.append(req.full_url)
        if len(self.calls) <= self.fail_times:
            raise TimeoutError("simulated timeout")
        return io.BytesIO(json.dumps(self.payload).encode("utf-8"))


def test_retry_then_success():
    op = FakeOpener(fail_times=2)
    result = osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    assert result == {"elements": [{"id": 1}]}
    assert len(op.calls) == 3, f"3回目で成功するはずが {len(op.calls)} 回"


def test_mirror_fallback():
    # 1ミラーあたり3回まで試すので、4回目は次のミラーに移る
    op = FakeOpener(fail_times=3)
    osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    assert op.calls[0].startswith(osm_query.MIRRORS[0])
    assert op.calls[3].startswith(osm_query.MIRRORS[1]), f"4回目がミラー2でない: {op.calls[3]}"


def test_all_mirrors_fail():
    op = FakeOpener(fail_times=999)
    try:
        osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    except osm_query.OverpassError as e:
        assert len(op.calls) == 3 * len(osm_query.MIRRORS)
        return
    raise AssertionError("全ミラー失敗時に OverpassError が上がらなかった")


def main():
    test_build_query()
    test_retry_then_success()
    test_mirror_fallback()
    test_all_mirrors_fail()
    print("OK: osm_query")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_osm_query_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'osm_query'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/osm_query.py`:

```python
# -*- coding: utf-8 -*-
"""Overpass API のクエリ生成と実行。

全国一括クエリはタイムアウトするため、必ず県単位で投げる。
これは同時に「各施設がどの県に属するか」を点内包判定なしで確定させる。
"""
import json, time, urllib.request
from pathlib import Path

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]
ATTEMPTS_PER_MIRROR = 3
UA = "hitori-map/1.0 (https://yuichi916.github.io/hitori.html)"

# ひとりが標準の業態のみ。cafe は件数過大かつ「ひとりが標準」と言い切れないため除外。
SOLO_CUISINE = "ramen|noodle|soba|udon|gyudon|curry|donburi"


class OverpassError(RuntimeError):
    pass


def build_query(pref_code):
    """指定県の全カテゴリを1クエリで取る Overpass QL を返す。

    admin_level=4 の area を ref:JIS 相当のコードではなく都道府県名で引くと
    表記ゆれに弱いため、ISO3166-2 コード（JP-01 形式）で指定する。
    """
    iso = f"JP-{pref_code:02d}"
    return f"""[out:json][timeout:300];
area["ISO3166-2"="{iso}"]["admin_level"="4"]->.pref;
(
  nwr["amenity"="public_bath"](area.pref);
  nwr["leisure"="sauna"](area.pref);
  nwr["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"{SOLO_CUISINE}"](area.pref);
  nwr["amenity"="karaoke_box"](area.pref);
  nwr["amenity"="cinema"](area.pref);
  nwr["amenity"="internet_cafe"](area.pref);
  nwr["tourism"="hostel"](area.pref);
  nwr["amenity"="library"](area.pref);
  nwr["tourism"="museum"](area.pref);
);
out center tags;
"""


def run_query(ql, opener=None, sleep=time.sleep):
    """リトライ3回×ミラー3件。全滅したら OverpassError を上げる。"""
    opener = opener or urllib.request.urlopen
    last = None
    for mirror in MIRRORS:
        for attempt in range(ATTEMPTS_PER_MIRROR):
            req = urllib.request.Request(
                mirror, data=ql.encode("utf-8"), headers={"User-Agent": UA}
            )
            try:
                with opener(req, timeout=400) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001 - ネットワーク例外は種類を問わず退避
                last = e
                sleep(2 ** attempt)
    raise OverpassError(f"全ミラーで失敗しました: {last}")
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_osm_query_test.py`
Expected: `OK: osm_query`

- [ ] **Step 5: 実ネットワークで1県だけ手動確認**

Run:
```bash
PYTHONUTF8=1 python -c "import sys; sys.path.insert(0,'scripts/hitori'); import osm_query; d=osm_query.run_query(osm_query.build_query(13)); print('elements:', len(d['elements']))"
```
Expected: `elements:` に数千件（東京都）。0件なら `ISO3166-2` の指定が効いていないので `build_query` を見直す。

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/osm_query.py tests/hitori_osm_query_test.py
git commit -m "feat(hitori): Overpassクエリ生成とリトライ・ミラーフォールバック"
```

---

### Task 5: 県単位の取得 CLI

**Files:**
- Create: `scripts/hitori/fetch_osm.py`
- Modify: `.gitignore`（`_local/hitori_raw/` を追加。`_local/` 自体は既に追跡されているため配下だけを無視する）

**Interfaces:**
- Consumes: Task 1 の `data/hitori/prefectures.json`、Task 4 の `osm_query`
- Produces: `_local/hitori_raw/{code:02d}.json` — Overpass の生レスポンスをそのまま保存

- [ ] **Step 1: .gitignore に追記**

`.gitignore` 末尾に追加:

```
# ひとり歓迎マップの Overpass 生レスポンス。再取得可能なので追跡しない。
# _local/ 自体は追跡対象（_local/populate.mjs がある）なので配下のみ無視する。
_local/hitori_raw/
```

- [ ] **Step 2: 取得スクリプトを書く**

`scripts/hitori/fetch_osm.py`:

```python
# -*- coding: utf-8 -*-
"""Overpass から県単位でデータを取得し、_local/hitori_raw/ にキャッシュする。

途中で失敗しても再実行すれば未取得の県だけを埋める。47県すべてが揃うまで
build_data.py は走らせないこと。
"""
import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import osm_query

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"
RAW_DIR = ROOT / "_local" / "hitori_raw"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=int, default=None, help="この県コードだけ取得する")
    ap.add_argument("--force", action="store_true", help="キャッシュがあっても取り直す")
    args = ap.parse_args()

    prefs = json.loads(MASTER.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    failed = []
    for p in prefs:
        code = p["code"]
        if args.only and code != args.only:
            continue
        out = RAW_DIR / f"{code:02d}.json"
        if out.exists() and not args.force:
            print(f"skip {code:02d} {p['name']} (cached)")
            continue
        try:
            data = osm_query.run_query(osm_query.build_query(code))
        except osm_query.OverpassError as e:
            print(f"FAIL {code:02d} {p['name']}: {e}")
            failed.append(code)
            continue
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"ok   {code:02d} {p['name']}: {len(data['elements'])} elements")
        time.sleep(3)  # Overpass への礼儀。連続投げでレート制限に当たらないように

    have = sorted(int(f.stem) for f in RAW_DIR.glob("*.json"))
    print(f"\ncached: {len(have)}/47 prefectures")
    if failed:
        print(f"failed: {failed} — 再実行すれば未取得分だけ取りにいきます")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 1県だけで動作確認**

Run: `PYTHONUTF8=1 python scripts/hitori/fetch_osm.py --only 13`
Expected: `ok   13 東京都: NNNN elements` と `cached: 1/47 prefectures`

- [ ] **Step 4: キャッシュが効くことを確認**

Run: `PYTHONUTF8=1 python scripts/hitori/fetch_osm.py --only 13`
Expected: `skip 13 東京都 (cached)`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/fetch_osm.py .gitignore
git commit -m "feat(hitori): 県単位のOverpass取得CLIを追加"
```

---

### Task 6: 正規化と重複除去

**Files:**
- Create: `scripts/hitori/normalize.py`
- Test: `tests/hitori_normalize_test.py`

**Interfaces:**
- Consumes: Task 2/3 の `scoring`
- Produces:
  - `element_id(el: dict) -> str` — `"n123"` / `"w456"` / `"r789"`
  - `to_record(el: dict, curated: dict) -> dict | None` — 施設1件のレコード
  - `dedupe(records: list[dict]) -> list[dict]` — 同名かつ30m以内を統合
  - `distance_m(lat1, lon1, lat2, lon2) -> float`

レコード形式: `{"id","name","lat","lon","cat","kind","score","conf","chain","note"}`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_normalize_test.py`:

```python
# -*- coding: utf-8 -*-
"""OSM要素→施設レコードの正規化と重複除去の検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import normalize


def test_element_id():
    assert normalize.element_id({"type": "node", "id": 123}) == "n123"
    assert normalize.element_id({"type": "way", "id": 456}) == "w456"
    assert normalize.element_id({"type": "relation", "id": 789}) == "r789"


def test_distance_m():
    # 東京駅と有楽町駅はおよそ800m
    d = normalize.distance_m(35.6812, 139.7671, 35.6749, 139.7630)
    assert 600 < d < 1000, d
    # 同一点は0
    assert normalize.distance_m(35.0, 139.0, 35.0, 139.0) < 0.001
    # 緯度35度で経度0.00033度はおよそ30m
    d2 = normalize.distance_m(35.0, 139.0, 35.0, 139.00033)
    assert 25 < d2 < 35, d2


def test_to_record_node():
    el = {"type": "node", "id": 1, "lat": 35.65894, "lon": 139.70043,
          "tags": {"amenity": "restaurant", "name": "一蘭 渋谷店", "cuisine": "ramen"}}
    r = normalize.to_record(el, {})
    assert r["id"] == "n1"
    assert r["name"] == "一蘭 渋谷店"
    assert r["cat"] == "eat" and r["kind"] == "ramen"
    assert r["score"] == 5           # base4 + SOLO_BRANDS加点
    assert r["chain"] == 1           # CHAIN_BRANDS一致
    assert r["conf"] == 0
    assert r["note"] == ""
    assert r["lat"] == 35.65894 and r["lon"] == 139.70043


def test_to_record_way_uses_center():
    el = {"type": "way", "id": 2, "center": {"lat": 35.1, "lon": 139.2},
          "tags": {"amenity": "public_bath", "name": "はやし湯"}}
    r = normalize.to_record(el, {})
    assert r["lat"] == 35.1 and r["lon"] == 139.2
    assert r["cat"] == "bath" and r["kind"] == "sento" and r["score"] == 4
    assert r["chain"] == 0


def test_to_record_rounds_coords():
    el = {"type": "node", "id": 3, "lat": 35.123456789, "lon": 139.987654321,
          "tags": {"amenity": "library", "name": "○○図書館"}}
    r = normalize.to_record(el, {})
    assert r["lat"] == 35.12346 and r["lon"] == 139.98765


def test_to_record_rejects():
    # 名前なしは収録しない
    assert normalize.to_record(
        {"type": "node", "id": 4, "lat": 35.0, "lon": 139.0,
         "tags": {"amenity": "public_bath"}}, {}) is None
    # 業態が対象外
    assert normalize.to_record(
        {"type": "node", "id": 5, "lat": 35.0, "lon": 139.0,
         "tags": {"amenity": "restaurant", "name": "居酒屋", "cuisine": "izakaya"}}, {}) is None
    # 座標なし
    assert normalize.to_record(
        {"type": "way", "id": 6, "tags": {"amenity": "library", "name": "○○図書館"}}, {}) is None


def test_to_record_curated():
    el = {"type": "node", "id": 7, "lat": 35.0, "lon": 139.0,
          "tags": {"amenity": "public_bath", "name": "はやし湯"}}
    curated = {"n7": {
        "note": "黙浴の掲示あり",
        "chain": 1,
        "evidence": [{"src": "user", "id": "gh-issue-42", "checked": "2026-08-01", "polarity": "+"}],
    }}
    r = normalize.to_record(el, curated)
    assert r["score"] == 5      # base4 + 肯定エビデンス
    assert r["conf"] == 2       # user 由来
    assert r["chain"] == 1      # curated の明示指定
    assert r["note"] == "黙浴の掲示あり"

    # excluded は収録しない
    assert normalize.to_record(el, {"n7": {"excluded": True}}) is None


def test_dedupe():
    a = {"id": "n1", "name": "はやし湯", "lat": 35.00000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "score": 4, "conf": 0, "chain": 0, "note": ""}
    b = {"id": "w2", "name": "はやし湯", "lat": 35.00010, "lon": 139.00010,
         "cat": "bath", "kind": "sento", "score": 4, "conf": 0, "chain": 0, "note": ""}
    c = {"id": "n3", "name": "はやし湯", "lat": 35.50000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "score": 4, "conf": 0, "chain": 0, "note": ""}
    d = {"id": "n4", "name": "べつの湯", "lat": 35.00000, "lon": 139.00000,
         "cat": "bath", "kind": "sento", "score": 4, "conf": 0, "chain": 0, "note": ""}

    out = normalize.dedupe([a, b, c, d])
    ids = sorted(r["id"] for r in out)
    # a と b は同名30m以内なので統合され、way 側(w2)が残る
    assert ids == ["n3", "n4", "w2"], ids
    # 離れた同名(c)と、同一地点の別名(d)は残る
    assert len(out) == 3


def main():
    test_element_id()
    test_distance_m()
    test_to_record_node()
    test_to_record_way_uses_center()
    test_to_record_rounds_coords()
    test_to_record_rejects()
    test_to_record_curated()
    test_dedupe()
    print("OK: normalize")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_normalize_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'normalize'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/normalize.py`:

```python
# -*- coding: utf-8 -*-
"""OSM要素を施設レコードへ正規化し、重複を除去する。"""
import math

import scoring

_TYPE_PREFIX = {"node": "n", "way": "w", "relation": "r"}
DEDUPE_RADIUS_M = 30.0
COORD_DIGITS = 5  # 約1m精度


def element_id(el):
    return _TYPE_PREFIX[el["type"]] + str(el["id"])


def distance_m(lat1, lon1, lat2, lon2):
    """ハーバサイン距離（メートル）。"""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _coords(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None, None


def to_record(el, curated):
    """OSM要素 → 施設レコード。収録対象外なら None。"""
    tags = el.get("tags") or {}
    name = (tags.get("name") or "").strip()
    if not name:
        return None

    lat, lon = _coords(el)
    if lat is None:
        return None

    cls = scoring.classify(tags)
    if cls is None:
        return None
    cat, kind, base = cls

    fid = element_id(el)
    cur = curated.get(fid) or {}
    if cur.get("excluded"):
        return None

    evidence = cur.get("evidence") or []
    return {
        "id": fid,
        "name": name,
        "lat": round(lat, COORD_DIGITS),
        "lon": round(lon, COORD_DIGITS),
        "cat": cat,
        "kind": kind,
        "score": scoring.score(base, name, evidence),
        "conf": scoring.confidence(evidence),
        "chain": scoring.is_chain(tags, cur),
        "note": cur.get("note", ""),
    }


def _rank(rec):
    """統合時にどちらを残すかの優先度。面情報(way/relation)のほうが確度が高い。"""
    return {"r": 2, "w": 1, "n": 0}[rec["id"][0]]


def dedupe(records):
    """同名かつ DEDUPE_RADIUS_M 以内のレコードを1件に統合する。

    node と way の両方でタグ付けされたケースを吸収するのが目的。
    同名でまとめてから距離判定するので、全件総当たりにはならない。
    """
    by_name = {}
    for r in records:
        by_name.setdefault(r["name"], []).append(r)

    out = []
    for group in by_name.values():
        kept = []
        for r in group:
            for i, k in enumerate(kept):
                if distance_m(r["lat"], r["lon"], k["lat"], k["lon"]) <= DEDUPE_RADIUS_M:
                    if _rank(r) > _rank(k):
                        kept[i] = r
                    break
            else:
                kept.append(r)
        out.extend(kept)
    return out
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_normalize_test.py`
Expected: `OK: normalize`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/normalize.py tests/hitori_normalize_test.py
git commit -m "feat(hitori): OSM要素の正規化と30m重複除去を追加"
```

---

### Task 7: 出力スキーマ検証

spec §9「ビルド時」の検証を、ビルドからもテストからも呼べる形にする。

**Files:**
- Create: `scripts/hitori/validate.py`
- Test: `tests/hitori_validate_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `validate_pref(doc: dict) -> list[str]` — 違反メッセージの配列。空なら合格
  - `validate_summary(doc: dict) -> list[str]`
  - `validate_curated(curated: dict) -> list[str]`
  - `JAPAN_BBOX: tuple` — `(20.0, 46.0, 122.0, 154.0)`（南, 北, 西, 東）

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_validate_test.py`:

```python
# -*- coding: utf-8 -*-
"""出力スキーマ検証。spec §9 のビルド時チェックがそのまま期待値。"""
import sys, copy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import validate

FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]

GOOD_PREF = {
    "pref": 13, "name": "東京都", "updated": "2026-08-02",
    "fields": FIELDS,
    "items": [
        ["n1", "一蘭 渋谷店", 35.65894, 139.70043, "eat", "ramen", 5, 2, 1, "仕切りカウンター12席"],
        ["n2", "はやしや", 35.70112, 139.75820, "eat", "soba_udon", 4, 0, 0, ""],
    ],
}

GOOD_SUMMARY = {
    "updated": "2026-08-02", "total": 2,
    "population_source": "Wikidata (CC0) / 令和2年国勢調査",
    "prefectures": [
        {"code": 13, "name": "東京都", "pop": 14047594,
         "counts": {"all": 2, "bath": 0, "eat": 2, "play": 0, "stay": 0},
         "counts_indie": {"all": 1, "bath": 0, "eat": 1, "play": 0, "stay": 0},
         "density": {"all": 0.01, "bath": 0.0, "eat": 0.01, "play": 0.0, "stay": 0.0},
         "density_indie": {"all": 0.01, "bath": 0.0, "eat": 0.01, "play": 0.0, "stay": 0.0}},
    ],
}


def test_pref_ok():
    assert validate.validate_pref(GOOD_PREF) == []


def test_pref_bbox():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][0][2] = 51.0      # 日本の北端より北
    errs = validate.validate_pref(d)
    assert any("bbox" in e for e in errs), errs

    d2 = copy.deepcopy(GOOD_PREF)
    d2["items"][0][3] = 100.0    # 日本の西端より西
    assert any("bbox" in e for e in validate.validate_pref(d2))


def test_pref_empty_name():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][0][1] = ""
    assert any("name" in e for e in validate.validate_pref(d))


def test_pref_score_range():
    for bad in (0, 6, 3.5, "4"):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][6] = bad
        assert any("score" in e for e in validate.validate_pref(d)), bad


def test_pref_chain_flag():
    for bad in (2, -1, "1", None):
        d = copy.deepcopy(GOOD_PREF)
        d["items"][0][8] = bad
        assert any("chain" in e for e in validate.validate_pref(d)), bad


def test_pref_duplicate_id():
    d = copy.deepcopy(GOOD_PREF)
    d["items"][1][0] = "n1"
    assert any("duplicate" in e for e in validate.validate_pref(d))


def test_pref_fields_mismatch():
    d = copy.deepcopy(GOOD_PREF)
    d["fields"] = FIELDS[:-1]
    assert any("fields" in e for e in validate.validate_pref(d))


def test_summary_ok():
    assert validate.validate_summary(GOOD_SUMMARY) == []


def test_summary_indie_not_exceeding():
    d = copy.deepcopy(GOOD_SUMMARY)
    d["prefectures"][0]["counts_indie"]["eat"] = 5   # counts.eat=2 を超える
    assert any("counts_indie" in e for e in validate.validate_summary(d))


def test_curated_web_needs_url():
    # spec §6.2「出典URLが取れないものは採用しない」を機械的に強制する
    bad = {"n1": {"evidence": [{"src": "web", "checked": "2026-08-01", "polarity": "+"}]}}
    assert any("url" in e for e in validate.validate_curated(bad))

    bad2 = {"n1": {"evidence": [{"src": "web", "url": "", "checked": "2026-08-01", "polarity": "+"}]}}
    assert any("url" in e for e in validate.validate_curated(bad2))

    ok = {"n1": {"evidence": [{"src": "web", "url": "https://x", "checked": "2026-08-01", "polarity": "+"}]}}
    assert validate.validate_curated(ok) == []

    # user / visit は url 不要
    ok2 = {"n1": {"evidence": [{"src": "user", "id": "gh-issue-1", "checked": "2026-08-01", "polarity": "+"}]}}
    assert validate.validate_curated(ok2) == []


def test_curated_field_shapes():
    assert any("src" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "twitter", "checked": "2026-08-01", "polarity": "+"}]}}))
    assert any("polarity" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "visit", "checked": "2026-08-01", "polarity": "?"}]}}))
    assert any("checked" in e for e in validate.validate_curated(
        {"n1": {"evidence": [{"src": "visit", "polarity": "+"}]}}))
    assert any("chain" in e for e in validate.validate_curated({"n1": {"chain": 2}}))

    # 手動追加エントリ(c-)は座標とカテゴリを自前で持つ必要がある
    assert any("c-0001" in e for e in validate.validate_curated({"c-0001": {"name": "○○"}}))
    assert validate.validate_curated({"c-0001": {
        "name": "カプセルホテル○○", "lat": 35.6, "lon": 139.7, "pref": 13,
        "cat": "stay", "kind": "capsule", "base": 5}}) == []


def main():
    test_pref_ok()
    test_pref_bbox()
    test_pref_empty_name()
    test_pref_score_range()
    test_pref_chain_flag()
    test_pref_duplicate_id()
    test_pref_fields_mismatch()
    test_summary_ok()
    test_summary_indie_not_exceeding()
    test_curated_web_needs_url()
    test_curated_field_shapes()
    print("OK: validate")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_validate_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'validate'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/validate.py`:

```python
# -*- coding: utf-8 -*-
"""出力JSONのスキーマ検証。ビルドからもテストからも同じ関数を呼ぶ。"""

JAPAN_BBOX = (20.0, 46.0, 122.0, 154.0)  # 南, 北, 西, 東
EXPECTED_FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]
CATS = ("bath", "eat", "play", "stay")


def validate_pref(doc):
    errs = []
    if doc.get("fields") != EXPECTED_FIELDS:
        errs.append(f"fields が期待と異なる: {doc.get('fields')}")
        return errs  # 列位置が信用できないので以降は見ない

    idx = {k: i for i, k in enumerate(EXPECTED_FIELDS)}
    s, n, w, e = JAPAN_BBOX
    seen = set()

    for row in doc.get("items", []):
        if len(row) != len(EXPECTED_FIELDS):
            errs.append(f"列数が不正: {row}")
            continue
        fid = row[idx["id"]]
        if fid in seen:
            errs.append(f"duplicate id: {fid}")
        seen.add(fid)

        if not str(row[idx["name"]]).strip():
            errs.append(f"name が空: {fid}")

        lat, lon = row[idx["lat"]], row[idx["lon"]]
        if not (s <= lat <= n and w <= lon <= e):
            errs.append(f"bbox 外の座標: {fid} ({lat}, {lon})")

        sc = row[idx["score"]]
        if not isinstance(sc, int) or isinstance(sc, bool) or not (1 <= sc <= 5):
            errs.append(f"score が不正: {fid} -> {sc!r}")

        cf = row[idx["conf"]]
        if cf not in (0, 1, 2) or isinstance(cf, bool):
            errs.append(f"conf が不正: {fid} -> {cf!r}")

        ch = row[idx["chain"]]
        if ch not in (0, 1) or isinstance(ch, bool):
            errs.append(f"chain が不正: {fid} -> {ch!r}")

        if row[idx["cat"]] not in CATS:
            errs.append(f"cat が不正: {fid} -> {row[idx['cat']]!r}")

    return errs


def validate_summary(doc):
    errs = []
    prefs = doc.get("prefectures", [])
    for p in prefs:
        c, ci = p.get("counts", {}), p.get("counts_indie", {})
        for k in ("all",) + CATS:
            if k not in c:
                errs.append(f"counts に {k} がない: {p.get('code')}")
                continue
            if ci.get(k, 0) > c[k]:
                errs.append(f"counts_indie.{k} が counts.{k} を超えている: {p.get('code')}")
        if c.get("all", 0) != sum(c.get(k, 0) for k in CATS):
            errs.append(f"counts.all がカテゴリ合計と一致しない: {p.get('code')}")
    return errs


VALID_SRC = ("web", "user", "visit", "review")
MANUAL_REQUIRED = ("name", "lat", "lon", "cat", "kind", "base", "pref")


def validate_curated(curated):
    """curated.json の健全性。ビルドの入口で弾く。

    spec §6.2「出典URLが取れないものは採用しない」をここで機械的に強制する。
    """
    errs = []
    for fid, rec in curated.items():
        if "chain" in rec and rec["chain"] not in (0, 1):
            errs.append(f"{fid}: chain が不正 -> {rec['chain']!r}")

        # c- 始まりは OSM に存在しない手動追加。座標とカテゴリを自前で持つ必要がある。
        if fid.startswith("c-") and not rec.get("excluded"):
            missing = [k for k in MANUAL_REQUIRED if k not in rec]
            if missing:
                errs.append(f"{fid}: 手動追加エントリに {missing} がありません")

        for ev in rec.get("evidence", []):
            src = ev.get("src")
            if src not in VALID_SRC:
                errs.append(f"{fid}: src が不正 -> {src!r}")
            if src == "web" and not (ev.get("url") or "").strip():
                errs.append(f"{fid}: src=web に url がありません")
            if ev.get("polarity") not in ("+", "-"):
                errs.append(f"{fid}: polarity が不正 -> {ev.get('polarity')!r}")
            if not ev.get("checked"):
                errs.append(f"{fid}: checked がありません")
    return errs
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_validate_test.py`
Expected: `OK: validate`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/validate.py tests/hitori_validate_test.py
git commit -m "feat(hitori): 出力スキーマ検証を追加"
```

---

### Task 8: ビルド本体

**Files:**
- Create: `scripts/hitori/build_data.py`
- Create: `data/hitori/curated.json`（初期値は `{}`）
- Test: `tests/hitori_build_test.py`

**Interfaces:**
- Consumes: Task 1 のマスタ、Task 6 の `normalize`、Task 7 の `validate`、`_local/hitori_raw/*.json`
- Produces:
  - `build(raw_by_pref: dict, prefs: list, curated: dict, updated: str) -> tuple[dict, dict]` — `(summary, {code: pref_doc})`
  - CLI 実行で `data/hitori/summary.json` と `data/hitori/pref/{code:02d}.json` を書き出す

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_build_test.py`:

```python
# -*- coding: utf-8 -*-
"""ビルド本体の検証。実データではなく手作りのfixtureで固める。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import build_data
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

    # density = counts / pop * 100000
    assert abs(tokyo["density"]["all"] - 300.0) < 0.05
    assert abs(tokyo["density_indie"]["all"] - 200.0) < 0.05

    kyoto = [p for p in summary["prefectures"] if p["code"] == 26][0]
    assert kyoto["counts"]["stay"] == 1
    assert abs(kyoto["density"]["stay"] - 200.0) < 0.05


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
    assert row[idx["score"]] == 5      # base4 + 肯定エビデンス
    assert row[idx["conf"]] == 2
    assert row[idx["note"]] == "黙浴の掲示あり"


def test_build_sorts_by_score_desc():
    _, prefdocs = build_data.build(RAW, PREFS, {}, "2026-08-02")
    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    scores = [r[idx["score"]] for r in prefdocs[13]["items"]]
    assert scores == sorted(scores, reverse=True), scores


def test_build_includes_manual_entries():
    # OSM に存在しない施設（カプセルホテルは全国で1件しかタグ付けされていない）
    curated = {"c-0001": {
        "name": "カプセルホテル○○", "lat": 35.69, "lon": 139.70, "pref": 13,
        "cat": "stay", "kind": "capsule", "base": 5, "note": "OSM未登録のため手動追加",
        "evidence": [{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]}}
    summary, prefdocs = build_data.build(RAW, PREFS, curated, "2026-08-02")

    idx = {k: i for i, k in enumerate(prefdocs[13]["fields"])}
    row = [r for r in prefdocs[13]["items"] if r[idx["id"]] == "c-0001"]
    assert row, "手動追加エントリが出力に含まれていない"
    assert row[0][idx["score"]] == 5 and row[0][idx["conf"]] == 2

    tokyo = [p for p in summary["prefectures"] if p["code"] == 13][0]
    assert tokyo["counts"]["stay"] == 1, "手動追加が集計に反映されていない"

    # 別県の集計には入らない
    kyoto = [p for p in summary["prefectures"] if p["code"] == 26][0]
    assert kyoto["counts"]["stay"] == 1   # 京都は元々の図書館1件のみ

    # excluded なら出ない
    curated["c-0001"]["excluded"] = True
    _, prefdocs2 = build_data.build(RAW, PREFS, curated, "2026-08-02")
    assert not [r for r in prefdocs2[13]["items"] if r[idx["id"]] == "c-0001"]


def main():
    test_build_shapes()
    test_build_output_passes_validation()
    test_build_applies_curated()
    test_build_sorts_by_score_desc()
    test_build_includes_manual_entries()
    print("OK: build_data")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_build_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'build_data'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/build_data.py`:

```python
# -*- coding: utf-8 -*-
"""raw + curated → data/hitori/ を全生成する。冪等。

取得(fetch_osm.py)と加工(このスクリプト)を分けてあるので、
スコアリングを直すのに Overpass を叩き直す必要はない。
"""
import argparse, json, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize
import scoring
import validate

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"
CURATED = ROOT / "data" / "hitori" / "curated.json"
RAW_DIR = ROOT / "_local" / "hitori_raw"
OUT_DIR = ROOT / "data" / "hitori"

CATS = ("bath", "eat", "play", "stay")


def _density(count, pop):
    return round(count / pop * 100000, 2) if pop else 0.0


def manual_records(curated, code):
    """curated の 'c-' エントリのうち、指定県のものをレコード化する。

    OSM に存在しない施設（カプセルホテルなど。全国で1件しかタグ付けされていない）を
    手で足すための経路。OSM 由来と同じスコアリングを通す。
    """
    out = []
    for fid, rec in curated.items():
        if not fid.startswith("c-") or rec.get("excluded"):
            continue
        if rec.get("pref") != code:
            continue
        evidence = rec.get("evidence") or []
        out.append({
            "id": fid,
            "name": rec["name"],
            "lat": round(rec["lat"], normalize.COORD_DIGITS),
            "lon": round(rec["lon"], normalize.COORD_DIGITS),
            "cat": rec["cat"],
            "kind": rec["kind"],
            "score": scoring.score(rec["base"], rec["name"], evidence),
            "conf": scoring.confidence(evidence),
            "chain": int(rec.get("chain", 0)),
            "note": rec.get("note", ""),
        })
    return out


def build(raw_by_pref, prefs, curated, updated):
    """(summary, {code: pref_doc}) を返す。ファイルI/Oはしない。"""
    summary_prefs = []
    prefdocs = {}
    total = 0

    for p in prefs:
        code, pop = p["code"], p["pop"]
        elements = (raw_by_pref.get(code) or {}).get("elements", [])

        records = [r for r in (normalize.to_record(el, curated) for el in elements) if r]
        records += manual_records(curated, code)
        records = normalize.dedupe(records)
        records.sort(key=lambda r: (-r["score"], r["name"]))
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--allow-partial", action="store_true",
                    help="47県揃っていなくてもビルドする")
    args = ap.parse_args()

    prefs = json.loads(MASTER.read_text(encoding="utf-8"))
    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}

    cur_errs = validate.validate_curated(curated)
    if cur_errs:
        print(f"curated.json に {len(cur_errs)} 件の問題があります:")
        for e in cur_errs[:30]:
            print("  " + e)
        sys.exit(1)

    raw_by_pref = {}
    for p in prefs:
        f = RAW_DIR / f"{p['code']:02d}.json"
        if f.exists():
            raw_by_pref[p["code"]] = json.loads(f.read_text(encoding="utf-8"))

    if len(raw_by_pref) < 47 and not args.allow_partial:
        missing = [p["code"] for p in prefs if p["code"] not in raw_by_pref]
        print(f"raw が {len(raw_by_pref)}/47 件しかありません。未取得: {missing}")
        print("fetch_osm.py を再実行するか、--allow-partial を付けてください。")
        sys.exit(1)

    summary, prefdocs = build(raw_by_pref, prefs, curated, date.today().isoformat())

    errs = validate.validate_summary(summary)
    for code, doc in prefdocs.items():
        errs += [f"pref{code}: {e}" for e in validate.validate_pref(doc)]
    if errs:
        print(f"検証エラー {len(errs)} 件:")
        for e in errs[:30]:
            print("  " + e)
        sys.exit(1)

    (OUT_DIR / "pref").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for code, doc in prefdocs.items():
        (OUT_DIR / "pref" / f"{code:02d}.json").write_text(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    biggest = max(prefdocs, key=lambda c: len(prefdocs[c]["items"]))
    size_kb = (OUT_DIR / "pref" / f"{biggest:02d}.json").stat().st_size / 1024
    print(f"total {summary['total']:,} 件 / 最大 {biggest:02d} = "
          f"{len(prefdocs[biggest]['items']):,} 件 {size_kb:.0f}KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: curated.json の初期ファイルを作る**

`data/hitori/curated.json`:

```json
{}
```

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_build_test.py`
Expected: `OK: build_data`

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/build_data.py data/hitori/curated.json tests/hitori_build_test.py
git commit -m "feat(hitori): ビルド本体（正規化・集計・分割出力）を追加"
```

---

### Task 9: 県境SVGパスの生成

12.4MB の GeoJSON を 50KB 程度の SVG パスまで削る。

**Files:**
- Create: `scripts/hitori/build_map_svg.py`
- Create: `data/hitori/prefectures_svg.json`（スクリプトが生成、commit する）
- Test: `tests/hitori_mapsvg_test.py`

**Interfaces:**
- Consumes: Task 1 の `data/hitori/prefectures.json`
- Produces:
  - `simplify(points: list[tuple], tol: float) -> list[tuple]` — Douglas-Peucker
  - `project(lat: float, lon: float) -> tuple[float, float]` — 正距円筒＋緯度補正
  - `data/hitori/prefectures_svg.json` — `{"viewBox":"0 0 W H","paths":{"1":"M...Z", ...}}`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_mapsvg_test.py`:

```python
# -*- coding: utf-8 -*-
"""県境SVGの簡略化アルゴリズムと生成物の検証。"""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import build_map_svg as m

SVG = ROOT / "data" / "hitori" / "prefectures_svg.json"
MAX_BYTES = 120 * 1024   # 目標50KB、上限120KB


def test_simplify_keeps_endpoints():
    pts = [(0, 0), (1, 0.001), (2, 0), (3, 0.002), (4, 0)]
    out = m.simplify(pts, 0.01)
    assert out[0] == (0, 0) and out[-1] == (4, 0)
    assert len(out) == 2, out          # ほぼ直線なので両端だけ残る


def test_simplify_keeps_corner():
    pts = [(0, 0), (1, 0), (2, 0), (2, 2), (2, 4)]
    out = m.simplify(pts, 0.1)
    assert (2, 0) in out, out          # 角は残る
    assert len(out) == 3, out


def test_simplify_short_input():
    assert m.simplify([(0, 0), (1, 1)], 0.5) == [(0, 0), (1, 1)]
    assert m.simplify([(0, 0)], 0.5) == [(0, 0)]
    assert m.simplify([], 0.5) == []


def test_project_orientation():
    # 北にあるほど y が小さい（SVG は上が y=0）
    x1, y1 = m.project(45.0, 140.0)   # 北海道あたり
    x2, y2 = m.project(26.0, 128.0)   # 沖縄あたり
    assert y1 < y2, (y1, y2)
    # 東にあるほど x が大きい
    x3, _ = m.project(35.0, 130.0)
    x4, _ = m.project(35.0, 140.0)
    assert x3 < x4


def test_generated_svg():
    assert SVG.exists(), f"not found: {SVG} — build_map_svg.py を実行してください"
    size = SVG.stat().st_size
    assert size <= MAX_BYTES, f"{size/1024:.0f}KB は上限 {MAX_BYTES/1024:.0f}KB を超えている"

    doc = json.loads(SVG.read_text(encoding="utf-8"))
    assert "viewBox" in doc
    paths = doc["paths"]
    assert len(paths) == 47, f"47県あるはずが {len(paths)} 件"
    assert sorted(int(k) for k in paths) == list(range(1, 48))
    for code, d in paths.items():
        assert d.startswith("M"), f"{code}: パスが M で始まっていない"
        assert d.rstrip().endswith("Z"), f"{code}: パスが Z で閉じていない"
        assert len(d) > 50, f"{code}: パスが短すぎる（島を落としすぎ）"


def main():
    test_simplify_keeps_endpoints()
    test_simplify_keeps_corner()
    test_simplify_short_input()
    test_project_orientation()
    test_generated_svg()
    print("OK: map svg")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_mapsvg_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'build_map_svg'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/build_map_svg.py`:

```python
# -*- coding: utf-8 -*-
"""地球地図日本（国土地理院）由来の県境GeoJSONを、軽量なSVGパスへ変換する。

出典: 地球地図日本（国土地理院） https://www.gsi.go.jp/kankyochiri/gm_jpn.html
経由: https://github.com/dataofjapan/land (japan.geojson)
非営利利用のため出典明記のみで足りる。hitori.html にアフィリエイトを置かないこと。
"""
import json, math, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "_local" / "hitori_raw" / "japan.geojson"
OUT = ROOT / "data" / "hitori" / "prefectures_svg.json"
SRC = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"

# 日本列島の中心緯度。経度方向の圧縮率をここで固定する。
LAT0 = 36.0
WIDTH = 1000.0
TOLERANCE = 0.012      # 度。50KB前後に収まる実測値
MIN_RING_POINTS = 6    # これ未満の島は落とす
MIN_RING_SPAN = 0.06   # 度。この幅未満の小島は落とす


def project(lat, lon):
    """正距円筒図法に cos(LAT0) の経度補正をかける。SVG座標系なので y は反転。"""
    x = lon * math.cos(math.radians(LAT0))
    y = -lat
    return (x, y)


def _perp_dist(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def simplify(points, tol):
    """Douglas-Peucker。端点は必ず残す。"""
    if len(points) <= 2:
        return list(points)
    a, b = points[0], points[-1]
    worst_i, worst_d = 0, -1.0
    for i in range(1, len(points) - 1):
        d = _perp_dist(points[i], a, b)
        if d > worst_d:
            worst_i, worst_d = i, d
    if worst_d <= tol:
        return [a, b]
    left = simplify(points[:worst_i + 1], tol)
    right = simplify(points[worst_i:], tol)
    return left[:-1] + right


def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def _download():
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE.exists():
        print(f"downloading {SRC} ...")
        urllib.request.urlretrieve(SRC, CACHE)
    return json.loads(CACHE.read_text(encoding="utf-8"))


def main():
    gj = _download()
    raw_paths = {}
    all_pts = []

    for feat in gj["features"]:
        code = int(feat["properties"]["id"])
        parts = []
        for ring in _rings(feat["geometry"]):
            lons = [c[0] for c in ring]
            lats = [c[1] for c in ring]
            if len(ring) < MIN_RING_POINTS:
                continue
            if (max(lons) - min(lons)) < MIN_RING_SPAN and (max(lats) - min(lats)) < MIN_RING_SPAN:
                continue
            pts = [project(c[1], c[0]) for c in ring]
            pts = simplify(pts, TOLERANCE)
            if len(pts) < 3:
                continue
            parts.append(pts)
            all_pts.extend(pts)
        if not parts:
            raise RuntimeError(f"県 {code} のリングが全滅しました。閾値を緩めてください。")
        raw_paths[code] = parts

    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    scale = WIDTH / (maxx - minx)
    height = (maxy - miny) * scale

    def tx(p):
        return (round((p[0] - minx) * scale, 1), round((p[1] - miny) * scale, 1))

    paths = {}
    for code, parts in raw_paths.items():
        d = []
        for pts in parts:
            sx, sy = tx(pts[0])
            d.append(f"M{sx} {sy}")
            for p in pts[1:]:
                px, py = tx(p)
                d.append(f"L{px} {py}")
            d.append("Z")
        paths[str(code)] = "".join(d)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "viewBox": f"0 0 {WIDTH:.0f} {height:.0f}",
        "source": "地球地図日本（国土地理院）",
        "paths": paths,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f}KB, {len(paths)} prefectures)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 生成してテストを通す**

Run: `PYTHONUTF8=1 python scripts/hitori/build_map_svg.py && PYTHONUTF8=1 python tests/hitori_mapsvg_test.py`
Expected: `wrote ...prefectures_svg.json (NNKB, 47 prefectures)` に続いて `OK: map svg`

120KB を超えたら `TOLERANCE` を 0.02、0.03 と上げて再実行する。逆に県の形が崩れて判別できない場合は 0.008 まで下げる。テストの `len(d) > 50` が落ちるようなら `MIN_RING_SPAN` を下げる。

- [ ] **Step 5: 目視確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib
d=json.loads(pathlib.Path('data/hitori/prefectures_svg.json').read_text(encoding='utf-8'))
svg='<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"%s\" width=\"700\">'%d['viewBox']
for c,p in d['paths'].items(): svg+='<path d=\"%s\" fill=\"#cbd5e1\" stroke=\"#334155\" stroke-width=\"0.7\"/>'%p
pathlib.Path('C:/tmp/hitori_map_check.svg').write_text(svg+'</svg>',encoding='utf-8')
print('wrote C:/tmp/hitori_map_check.svg')
"
```
Expected: `C:/tmp/hitori_map_check.svg` をブラウザで開き、北海道から沖縄まで47県が日本列島の形に並んでいること。沖縄が離れた位置に描かれるのは正常（本土からの実距離どおり）。

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/build_map_svg.py data/hitori/prefectures_svg.json tests/hitori_mapsvg_test.py
git commit -m "feat(hitori): 県境GeoJSONを軽量SVGパスへ変換"
```

---

### Task 10: 本番データの生成

ここで初めて全国分を取りにいく。47県×3秒待機で15〜30分かかる。

**Files:**
- Create: `data/hitori/summary.json`（生成物、commit する）
- Create: `data/hitori/pref/01.json` 〜 `47.json`（生成物、commit する）

**Interfaces:**
- Consumes: Task 5 の `fetch_osm.py`、Task 8 の `build_data.py`
- Produces: ランタイムが読む全データ

- [ ] **Step 1: 全県を取得**

Run: `PYTHONUTF8=1 python scripts/hitori/fetch_osm.py`
Expected: 47行の `ok` と `cached: 47/47 prefectures`

失敗した県が出たら、同じコマンドをもう一度実行する（キャッシュ済みはスキップされ、未取得だけを取りにいく）。3回繰り返しても埋まらない県があれば、`--only <code>` で個別に再試行する。

- [ ] **Step 2: ビルド**

Run: `PYTHONUTF8=1 python scripts/hitori/build_data.py`
Expected: `total 3X,XXX 件 / 最大 13 = X,XXX 件 XXXKB`

検証エラーが出たらビルドは中断される。表示された違反を潰してから再実行する。

- [ ] **Step 3: 実データで健全性を確認**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib
s=json.loads(pathlib.Path('data/hitori/summary.json').read_text(encoding='utf-8'))
print('total:', s['total'])
for key in ('all','bath','eat','play','stay'):
    top=sorted(s['prefectures'], key=lambda p:-p['density'][key])[:5]
    print(key.ljust(5), ' '.join(f\"{p['name']}{p['density'][key]:.1f}\" for p in top))
top=sorted(s['prefectures'], key=lambda p:-p['density_indie']['all'])[:5]
print('indie', ' '.join(f\"{p['name']}{p['density_indie']['all']:.1f}\" for p in top))
print('summary.json:', pathlib.Path('data/hitori/summary.json').stat().st_size/1024, 'KB')
"
```
Expected: `total` が 30,000〜45,000 の範囲。カテゴリごとに上位5県の顔ぶれが**互いに異なる**こと（全部同じなら density の計算がカテゴリ別になっていない）。`summary.json` は 20KB 未満。

- [ ] **Step 4: Commit**

```bash
git add data/hitori/summary.json data/hitori/pref/
git commit -m "chore(hitori): 全国データを生成（OSM 2026-08-02 時点）"
```

---

### Task 11: 全国俯瞰画面

**Files:**
- Create: `hitori.html`
- Test: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: `data/hitori/summary.json`、`data/hitori/prefectures_svg.json`
- Produces（後続タスクが呼ぶ JS 関数。名前と引数はここで確定する）:
  - `const state = {cats: Set<string>, nochain: boolean, minConf: number, pref: number|null}`
  - `getDensity(prefEntry) -> number` — 現在の state に応じた密度
  - `renderMap()` — 塗り分けを再計算して SVG に反映
  - `renderRanking()` — トップ10県
  - `applyFilters()` — `renderMap()` + `renderRanking()` + `syncUrl()`
  - `syncUrl()` / `restoreFromUrl()`
  - `openPrefecture(code)` — Task 12 で実装。このタスクでは空関数として置く

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_render_test.py`:

```python
# -*- coding: utf-8 -*-
"""hitori.html の描画検証。ローカルHTTPサーバを立てて Playwright で確認する。

file:// では fetch が CORS で落ちるため、必ず HTTP で配信すること。
"""
import sys, threading, functools, http.server, socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8899
BASE = f"http://127.0.0.1:{PORT}/hitori.html"


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def test_overview(page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_selector("#map path[data-code='13']", timeout=15000)
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert not errors, f"JSエラー: {errors}"

    # 47県すべてが描かれている
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, f"県パスが {n} 件"

    # 塗り分けが効いている（全部同じ色ではない）
    fills = page.eval_on_selector_all(
        "#map path[data-code]", "els => [...new Set(els.map(e => e.getAttribute('fill')))]")
    assert len(fills) >= 3, f"塗り色が {len(fills)} 種しかない: {fills}"

    # ランキングが10件
    rank = page.eval_on_selector_all("#ranking li", "els => els.length")
    assert rank == 10, f"ランキングが {rank} 件"

    # 出典と免責が出ている
    body = page.inner_text("body")
    for needle in ["地球地図日本", "OpenStreetMap", "機械的に推定"]:
        assert needle in body, f"'{needle}' が表示されていない"

    # チェーンフィルタの文言。「個人店だけ」と書いてはいけない
    assert "チェーンを隠す" in body
    assert "個人店だけ" not in body


def test_chain_toggle_changes_map(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    before = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    page.click("#f-nochain")
    page.wait_for_timeout(300)
    after = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    assert before != after, "チェーンを隠しても塗り分けが変わらない"
    assert "nochain=1" in page.evaluate("location.hash")


def test_category_filter_changes_map(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    before = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    page.click("#f-cat-bath")   # 湯だけ外す
    page.wait_for_timeout(300)
    after = page.eval_on_selector_all(
        "#map path[data-code]", "els => els.map(e => e.getAttribute('fill')).join(',')")
    assert before != after, "カテゴリを外しても塗り分けが変わらない"


def test_url_restore(page):
    page.goto(BASE + "#cat=bath&nochain=1")
    page.wait_for_function("window.__ready === true", timeout=15000)
    assert page.evaluate("document.querySelector('#f-nochain').checked") is True
    assert page.evaluate("document.querySelector('#f-cat-eat').checked") is False
    assert page.evaluate("document.querySelector('#f-cat-bath').checked") is True


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            test_overview(page)
            test_chain_toggle_changes_map(page)
            test_category_filter_changes_map(page)
            test_url_restore(page)
            page.screenshot(path="C:/tmp/hitori_overview.png", full_page=True)
            browser.close()
    finally:
        httpd.shutdown()
    print("OK: render (overview) -> C:/tmp/hitori_overview.png")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `hitori.html` が404になり `page.wait_for_selector` がタイムアウト

- [ ] **Step 3: hitori.html を書く**

以下の骨格で作る。`<style>` は既存の `styles.css` を読み込まず単一ファイルで完結させる（他ページと独立に配色を管理するため）。

必須の DOM 構造:

```html
<main>
  <header>
    <h1>ひとり歓迎マップ</h1>
    <p class="lede">ひとりで行ける店ではなく、ひとりが標準の店だけを集めた日本地図。</p>
  </header>

  <div class="filters">
    <fieldset><legend>カテゴリ</legend>
      <label><input type="checkbox" id="f-cat-bath" checked> 湯・サウナ</label>
      <label><input type="checkbox" id="f-cat-eat"  checked> カウンター飲食</label>
      <label><input type="checkbox" id="f-cat-play" checked> ひとり娯楽</label>
      <label><input type="checkbox" id="f-cat-stay" checked> ひとり滞在</label>
    </fieldset>
    <fieldset><legend>チェーン</legend>
      <label><input type="checkbox" id="f-nochain"> チェーンを隠す</label>
      <small>判明しているチェーンのみ。地域チェーンは残る場合があります</small>
    </fieldset>
    <fieldset><legend>信頼度</legend>
      <label><input type="radio" name="conf" value="0" checked> すべて</label>
      <label><input type="radio" name="conf" value="1"> ◍出典あり以上</label>
      <label><input type="radio" name="conf" value="2"> ◉現地確認のみ</label>
    </fieldset>
  </div>

  <div class="board">
    <svg id="map" role="img" aria-label="都道府県別ひとり歓迎度マップ"></svg>
    <aside><h2>ひとり度ランキング</h2><ol id="ranking"></ol></aside>
  </div>

  <section id="detail" hidden></section>

  <footer>
    <p class="disclaimer">この分類は OpenStreetMap のタグと業態から機械的に推定したものです。実際の座席形態や黙浴の有無を保証するものではありません。</p>
    <p class="credits">地図データ: 地球地図日本（国土地理院） / 施設データ: © OpenStreetMap contributors (ODbL) / 人口: Wikidata (CC0) / 令和2年国勢調査</p>
  </footer>
</main>
```

CSS の土台。**Task 12 が `--line` `--bg` `--fg` を参照するので、この変数名は変えない**:

```css
:root {
  --bg: #ffffff; --fg: #1a202c; --line: #cbd5e1; --muted: #64748b;
  --accent: #2b5f96;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f172a; --fg: #e2e8f0; --line: #334155; --muted: #94a3b8;
          --accent: #8fb3d4; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg);
       font-family: system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif;
       line-height: 1.7; }
main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem 6rem; }
.filters { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1.5rem 0; }
.filters fieldset { border: 1px solid var(--line); border-radius: 8px; padding: .6rem .9rem; }
.filters label { display: inline-flex; align-items: center; gap: .3rem; margin-right: .8rem; }
.filters small { display: block; color: var(--muted); font-size: .78rem; }
.board { display: grid; grid-template-columns: 1fr 260px; gap: 1.5rem; align-items: start; }
#map { width: 100%; height: auto; }
#map path { cursor: pointer; transition: opacity .15s; }
#map path:hover, #map path:focus { opacity: .75; outline: none; stroke: var(--fg); stroke-width: 1.5; }
#ranking { padding-left: 1.2rem; }
#ranking li { display: flex; justify-content: space-between; gap: .5rem; }
#ranking button { background: none; border: none; color: var(--accent);
                  cursor: pointer; padding: 0; font: inherit; text-align: left; }
footer { margin-top: 3rem; border-top: 1px solid var(--line); padding-top: 1rem;
         color: var(--muted); font-size: .8rem; }
.error { color: #c53030; }
@media (max-width: 720px) { .board { grid-template-columns: 1fr; } }
```

必須の JS。**関数名と `state` の形は後続タスクが依存するので変更しない**:

```js
const CATS = ['bath', 'eat', 'play', 'stay'];
const state = { cats: new Set(CATS), nochain: false, minConf: 0, pref: null };
let SUMMARY = null, GEO = null, BY_CODE = {};

// 単一色相のシーケンシャルスケール。5分位ビン。light/dark 両対応は CSS 変数側で吸収する。
const RAMP = ['#e7edf3', '#c3d4e6', '#8fb3d4', '#5688bd', '#2b5f96'];
const NODATA = '#f1f5f9';

function getDensity(p) {
  const src = state.nochain ? p.density_indie : p.density;
  // 選択カテゴリの密度を合算する。all をそのまま使わないのは部分選択に対応するため。
  let sum = 0;
  for (const c of state.cats) sum += src[c] || 0;
  return sum;
}

function quantileBins(values) {
  const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0, 0];
  return [0.2, 0.4, 0.6, 0.8].map(q => sorted[Math.floor(q * (sorted.length - 1))]);
}

function renderMap() {
  const vals = SUMMARY.prefectures.map(getDensity);
  const bins = quantileBins(vals);
  for (const p of SUMMARY.prefectures) {
    const el = document.querySelector(`#map path[data-code='${p.code}']`);
    if (!el) continue;
    const v = getDensity(p);
    let i = 0; while (i < bins.length && v > bins[i]) i++;
    el.setAttribute('fill', v > 0 ? RAMP[i] : NODATA);
    el.setAttribute('aria-label', `${p.name} ${v.toFixed(1)}件/10万人`);
    el.querySelector('title').textContent = `${p.name}　${v.toFixed(1)} 件/10万人`;
  }
}

function renderRanking() {
  const rows = SUMMARY.prefectures.map(p => ({ p, v: getDensity(p) }))
    .sort((a, b) => b.v - a.v).slice(0, 10);
  document.getElementById('ranking').innerHTML = rows.map(({ p, v }, i) =>
    `<li><button type="button" data-code="${p.code}">${p.name}</button>
     <span>${v.toFixed(1)}</span></li>`).join('');
}

function syncUrl() {
  const parts = [];
  if (state.pref) parts.push(`pref=${state.pref}`);
  if (state.cats.size !== CATS.length) parts.push(`cat=${[...state.cats].join('.')}`);
  if (state.nochain) parts.push('nochain=1');
  if (state.minConf) parts.push(`conf=${state.minConf}`);
  history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname);
}

function restoreFromUrl() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('cat')) {
    state.cats = new Set(h.get('cat').split('.').filter(c => CATS.includes(c)));
    if (!state.cats.size) state.cats = new Set(CATS);
  }
  state.nochain = h.get('nochain') === '1';
  state.minConf = parseInt(h.get('conf') || '0', 10) || 0;
  state.pref = h.has('pref') ? parseInt(h.get('pref'), 10) : null;
  for (const c of CATS) document.getElementById('f-cat-' + c).checked = state.cats.has(c);
  document.getElementById('f-nochain').checked = state.nochain;
  document.querySelector(`input[name=conf][value='${state.minConf}']`).checked = true;
}

function applyFilters() { renderMap(); renderRanking(); syncUrl(); }

function openPrefecture(code) { /* Task 12 で実装 */ }

function buildMapSvg() {
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', GEO.viewBox);
  svg.innerHTML = Object.entries(GEO.paths).map(([code, d]) =>
    `<path data-code="${code}" d="${d}" stroke="#94a3b8" stroke-width="0.8"
      tabindex="0" role="button"><title></title></path>`).join('');
  svg.addEventListener('click', e => {
    const p = e.target.closest('path[data-code]');
    if (p) openPrefecture(parseInt(p.dataset.code, 10));
  });
  svg.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const p = e.target.closest('path[data-code]');
    if (p) { e.preventDefault(); openPrefecture(parseInt(p.dataset.code, 10)); }
  });
}

function bindFilters() {
  for (const c of CATS) {
    document.getElementById('f-cat-' + c).addEventListener('change', e => {
      e.target.checked ? state.cats.add(c) : state.cats.delete(c);
      applyFilters();
    });
  }
  document.getElementById('f-nochain').addEventListener('change', e => {
    state.nochain = e.target.checked; applyFilters();
  });
  for (const r of document.querySelectorAll('input[name=conf]')) {
    r.addEventListener('change', e => { state.minConf = parseInt(e.target.value, 10); applyFilters(); });
  }
  document.getElementById('ranking').addEventListener('click', e => {
    const b = e.target.closest('button[data-code]');
    if (b) openPrefecture(parseInt(b.dataset.code, 10));
  });
}

async function init() {
  const [s, g] = await Promise.all([
    fetch('data/hitori/summary.json').then(r => r.json()),
    fetch('data/hitori/prefectures_svg.json').then(r => r.json()),
  ]);
  SUMMARY = s; GEO = g;
  for (const p of SUMMARY.prefectures) BY_CODE[p.code] = p;
  buildMapSvg();
  bindFilters();
  restoreFromUrl();
  applyFilters();
  if (state.pref) openPrefecture(state.pref);
  window.__ready = true;   // 描画テストの同期ポイント
}

init().catch(err => {
  document.getElementById('map').outerHTML =
    `<p class="error">データの読み込みに失敗しました: ${err.message}</p>`;
  window.__ready = true;
});
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render (overview) -> C:/tmp/hitori_overview.png`

- [ ] **Step 5: スクリーンショットを目視**

`C:/tmp/hitori_overview.png` を開き、日本列島が県ごとに濃淡で塗り分けられ、ランキングが10件出ていることを確認する。全県が同じ色なら `getDensity` か `quantileBins` を疑う。

- [ ] **Step 6: 重複const宣言チェック**

Run: `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 全国俯瞰マップとフィルタを実装"
```

---

### Task 12: 県詳細パネル

**Files:**
- Modify: `hitori.html`（`openPrefecture()` の実装と `#detail` の中身、CSS追加）
- Modify: `tests/hitori_render_test.py`（`test_detail()` と `test_mobile()` を追加）

**Interfaces:**
- Consumes: Task 11 の `state` / `BY_CODE` / `applyFilters()`
- Produces:
  - `loadPrefecture(code) -> Promise<object>` — `data/hitori/pref/NN.json` を取得。失敗時は例外
  - `visibleItems(doc) -> Array<object>` — state のフィルタを適用した施設配列（オブジェクト化済み）
  - `renderDetail(code, doc)` — `#detail` を描画

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_render_test.py` の `test_url_restore()` の後に追加し、`main()` にも足す:

```python
def test_detail(page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)

    page.click("#map path[data-code='13']")
    page.wait_for_selector("#detail li.item", timeout=15000)
    assert not errors, f"JSエラー: {errors}"

    assert "東京都" in page.inner_text("#detail h2")
    n = page.eval_on_selector_all("#detail li.item", "els => els.length")
    assert n > 0, "施設が1件も出ていない"

    # スコア降順
    scores = page.eval_on_selector_all(
        "#detail li.item", "els => els.map(e => +e.dataset.score)")
    assert scores == sorted(scores, reverse=True), scores[:20]

    # 各件に Google Maps リンクがある
    links = page.eval_on_selector_all(
        "#detail li.item a[href*='google.com/maps']", "els => els.length")
    assert links == n, f"Google Mapsリンクが {links}/{n} 件"

    # 散布図のピンが出ている
    pins = page.eval_on_selector_all("#scatter circle", "els => els.length")
    assert pins > 0, "散布図のピンがない"

    assert "pref=13" in page.evaluate("location.hash")


def test_detail_chain_filter(page):
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    before = page.eval_on_selector_all("#detail li.item", "els => els.length")
    page.click("#f-nochain")
    page.wait_for_timeout(400)
    after = page.eval_on_selector_all("#detail li.item", "els => els.length")
    assert after < before, f"チェーンを隠しても件数が減らない ({before} -> {after})"


def test_detail_fetch_failure_is_contained(page):
    page.goto(BASE)
    page.wait_for_function("window.__ready === true", timeout=15000)
    page.route("**/data/hitori/pref/*.json", lambda route: route.abort())
    page.click("#map path[data-code='13']")
    page.wait_for_selector("#detail .error", timeout=10000)
    # 地図本体は生きている
    n = page.eval_on_selector_all("#map path[data-code]", "els => els.length")
    assert n == 47, "県データの取得失敗で地図が壊れた"
    assert page.eval_on_selector_all("#detail button.retry", "els => els.length") == 1


def test_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "#pref=13")
    page.wait_for_selector("#detail li.item", timeout=15000)
    # 横スクロールが発生していないこと
    overflow = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"横スクロールが {overflow}px 発生している"
    page.screenshot(path="C:/tmp/hitori_mobile.png", full_page=True)
```

`main()` を以下に差し替える:

```python
def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            test_overview(page)
            test_chain_toggle_changes_map(page)
            test_category_filter_changes_map(page)
            test_url_restore(page)
            test_detail(page)
            test_detail_chain_filter(page)
            test_detail_fetch_failure_is_contained(page)
            page.screenshot(path="C:/tmp/hitori_overview.png", full_page=True)
            test_mobile(page)
            browser.close()
    finally:
        httpd.shutdown()
    print("OK: render -> C:/tmp/hitori_overview.png, C:/tmp/hitori_mobile.png")
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `test_detail` で `#detail li.item` がタイムアウト

- [ ] **Step 3: 実装を書く**

`hitori.html` の `openPrefecture()` を以下で置き換え、周辺関数を追加する:

```js
const PREF_CACHE = {};
const CONF_MARK = ['◌', '◍', '◉'];
const CONF_LABEL = ['推定', '出典あり', '現地確認'];
const KIND_JA = {
  standing: '立ち食い・立ち飲み', yakiniku_solo: 'ひとり焼肉', ramen: 'ラーメン',
  soba_udon: 'そば・うどん', gyudon: '牛丼・丼', curry: 'カレー',
  sauna: 'サウナ', onsen: '日帰り温泉', sento: '銭湯',
  netcafe: 'ネットカフェ', karaoke: 'カラオケ', cinema: '映画館',
  library: '図書館', hostel: 'ゲストハウス', museum: '美術館・博物館',
};

async function loadPrefecture(code) {
  if (PREF_CACHE[code]) return PREF_CACHE[code];
  const res = await fetch(`data/hitori/pref/${String(code).padStart(2, '0')}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = await res.json();
  PREF_CACHE[code] = doc;
  return doc;
}

function visibleItems(doc) {
  return doc.items
    .map(row => Object.fromEntries(doc.fields.map((f, i) => [f, row[i]])))
    .filter(it => state.cats.has(it.cat))
    .filter(it => !(state.nochain && it.chain === 1))
    .filter(it => it.conf >= state.minConf);
}

function renderScatter(items, code) {
  const d = GEO.paths[String(code)];
  if (!d) return '';
  // 県ポリゴンの実座標範囲を求め、そこにピンを重ねる
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  const pad = Math.max(maxx - minx, maxy - miny) * 0.05;
  const vb = `${minx - pad} ${miny - pad} ${maxx - minx + pad * 2} ${maxy - miny + pad * 2}`;

  // 施設の緯度経度を SVG 座標へ。build_map_svg.py の project() と同じ式を使う。
  // 定数はハードコードせず GEO.bounds から読む（Step 4 で出力に追加する）。
  const g = GEO.bounds;
  const toXY = (lat, lon) => [
    (lon * Math.cos(g.lat0 * Math.PI / 180) - g.minx) * g.scale,
    (-lat - g.miny) * g.scale,
  ];
  const r = Math.max(maxx - minx, maxy - miny) * 0.012;
  const pins = items.map(it => {
    const [x, y] = toXY(it.lat, it.lon);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"
      class="pin cat-${it.cat} conf-${it.conf}"><title>${escapeHtml(it.name)}</title></circle>`;
  }).join('');
  return `<svg id="scatter" viewBox="${vb}" role="img" aria-label="県内の分布">
    <path d="${d}" fill="none" stroke="#94a3b8" stroke-width="1"/>${pins}</svg>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDetail(code, doc) {
  const p = BY_CODE[code];
  const items = visibleItems(doc);
  const rank = SUMMARY.prefectures.map(x => ({ c: x.code, v: getDensity(x) }))
    .sort((a, b) => b.v - a.v).findIndex(x => x.c === code) + 1;

  const breakdown = CATS.filter(c => state.cats.has(c))
    .map(c => `${CAT_JA[c]} ${items.filter(i => i.cat === c).length}`).join(' / ');

  const list = items.map(it => `
    <li class="item" data-score="${it.score}">
      <span class="conf" title="${CONF_LABEL[it.conf]}">${CONF_MARK[it.conf]}</span>
      <a href="https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lon}"
         target="_blank" rel="noopener">${escapeHtml(it.name)}</a>
      <span class="kind">${KIND_JA[it.kind] || it.kind}</span>
      <span class="score">ひとり度 ${it.score}</span>
      ${it.chain ? '<span class="chip">チェーン</span>' : ''}
      ${it.note ? `<span class="note">${escapeHtml(it.note)}</span>` : ''}
    </li>`).join('');

  const el = document.getElementById('detail');
  el.hidden = false;
  el.innerHTML = `
    <button type="button" class="close" aria-label="閉じる">×</button>
    <h2>${p.name}</h2>
    <p class="stat">${getDensity(p).toFixed(1)} 件/10万人（全国 ${rank} 位）　${breakdown}</p>
    ${renderScatter(items, code)}
    <ol class="items">${list}</ol>
    <p class="submit"><a href="${issueUrl(code, p.name)}" target="_blank" rel="noopener">
      この県の情報を送る</a></p>`;
  el.querySelector('.close').addEventListener('click', closePrefecture);
}

function renderDetailError(code, err) {
  const el = document.getElementById('detail');
  el.hidden = false;
  el.innerHTML = `<button type="button" class="close" aria-label="閉じる">×</button>
    <h2>${BY_CODE[code].name}</h2>
    <p class="error">データの取得に失敗しました（${escapeHtml(err.message)}）</p>
    <button type="button" class="retry">再試行</button>`;
  el.querySelector('.close').addEventListener('click', closePrefecture);
  el.querySelector('.retry').addEventListener('click', () => openPrefecture(code));
}

function closePrefecture() {
  state.pref = null;
  document.getElementById('detail').hidden = true;
  syncUrl();
}

async function openPrefecture(code) {
  state.pref = code;
  syncUrl();
  const el = document.getElementById('detail');
  el.hidden = false;
  el.innerHTML = `<p class="loading">${BY_CODE[code].name} を読み込み中…</p>`;
  try {
    renderDetail(code, await loadPrefecture(code));
  } catch (err) {
    renderDetailError(code, err);
  }
}
```

`CAT_JA` を `CATS` の定義直後に追加する:

```js
const CAT_JA = { bath: '湯・サウナ', eat: 'カウンター飲食', play: 'ひとり娯楽', stay: 'ひとり滞在' };
```

`applyFilters()` を差し替え、フィルタ変更が開いている県詳細にも反映されるようにする:

```js
function applyFilters() {
  renderMap();
  renderRanking();
  syncUrl();
  if (state.pref && PREF_CACHE[state.pref]) renderDetail(state.pref, PREF_CACHE[state.pref]);
}
```

CSS に以下を足す（モバイルでボトムシート化し、横スクロールを防ぐ）:

```css
#detail { position: relative; margin-top: 1.5rem; }
#detail .items { list-style: none; padding: 0; max-height: 60vh; overflow-y: auto; }
#detail .item { display: flex; flex-wrap: wrap; gap: .5rem; align-items: baseline;
                padding: .4rem 0; border-bottom: 1px solid var(--line); }
#scatter { width: 100%; max-width: 420px; height: auto; }
.pin { opacity: .85; }
.pin.cat-bath { fill: #2b6cb0; } .pin.cat-eat { fill: #c05621; }
.pin.cat-play { fill: #6b46c1; } .pin.cat-stay { fill: #2f855a; }
.pin.conf-0 { fill-opacity: .35; } .pin.conf-1 { fill-opacity: .7; }
.pin.conf-2 { stroke: #1a202c; stroke-width: .5; }
img, svg, table { max-width: 100%; }
@media (max-width: 720px) {
  .board { display: block; }
  #detail { position: fixed; inset: auto 0 0 0; max-height: 72vh; overflow-y: auto;
            background: var(--bg); border-top: 2px solid var(--line);
            border-radius: 12px 12px 0 0; padding: 1rem; z-index: 20; }
}
```

- [ ] **Step 4: `prefectures_svg.json` に投影パラメータを足す**

散布図が県ポリゴンと同じ座標系を使うために、`build_map_svg.py` の出力へ `bounds` を追加する。`OUT.write_text(...)` の辞書に1行足す:

```python
    OUT.write_text(json.dumps({
        "viewBox": f"0 0 {WIDTH:.0f} {height:.0f}",
        "source": "地球地図日本（国土地理院）",
        "bounds": {"minx": minx, "miny": miny, "scale": scale, "lat0": LAT0},
        "paths": paths,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
```

再生成する。

Run: `PYTHONUTF8=1 python scripts/hitori/build_map_svg.py && PYTHONUTF8=1 python tests/hitori_mapsvg_test.py`
Expected: `OK: map svg`

- [ ] **Step 5: 投稿リンクを仮実装**

`issueUrl()` は Task 13 で本実装する。このタスクでは以下を置く:

```js
function issueUrl(code, name) {
  const base = 'https://github.com/yuichi916/yuichi916.github.io/issues/new';
  const q = new URLSearchParams({
    template: 'hitori-submission.yml',
    labels: 'hitori-submission',
    title: `[ひとり歓迎マップ] ${name}`,
    pref: String(code),
  });
  return `${base}?${q}`;
}
```

- [ ] **Step 6: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> C:/tmp/hitori_overview.png, C:/tmp/hitori_mobile.png`

- [ ] **Step 7: スクリーンショットを目視**

`C:/tmp/hitori_mobile.png` を開き、ボトムシートが画面下に固定され、施設リストが読めることを確認する。散布図のピンが県の形の内側に収まっていることも確認する。**ピンが県の外に散らばっていたら `renderScatter` の `toXY` と `build_map_svg.py` の `project()` が食い違っている。**

- [ ] **Step 8: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py scripts/hitori/build_map_svg.py data/hitori/prefectures_svg.json
git commit -m "feat(hitori): 県詳細パネルと散布図を実装"
```

---

### Task 13: 投稿受け口と取り込み

**Files:**
- Create: `.github/ISSUE_TEMPLATE/hitori-submission.yml`
- Create: `scripts/hitori/ingest_issues.py`
- Test: `tests/hitori_ingest_test.py`

**Interfaces:**
- Consumes: `data/hitori/curated.json`
- Produces:
  - `parse_issue_body(body: str) -> dict | None` — issue本文 → `{"id","polarity","claim","note"}`
  - `merge(curated: dict, entries: list[dict]) -> tuple[dict, list[str]]` — `(新curated, 変更サマリ)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_ingest_test.py`:

```python
# -*- coding: utf-8 -*-
"""GitHub Issue 本文のパースと curated.json へのマージ検証。gh CLI は叩かない。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import ingest_issues as ing

BODY_OK = """### 施設ID

n1234567890

### この施設はひとり向きですか

ひとり向き（黙浴・カウンターなど）

### 根拠

黙浴の掲示あり。21時は自分ひとりだった。

### 補足

_No response_
"""

BODY_NEGATIVE = """### 施設ID

w987

### この施設はひとり向きですか

ひとり向きではなかった

### 根拠

2名以上でないと入店不可だった

### 補足

_No response_
"""


def test_parse_ok():
    r = ing.parse_issue_body(BODY_OK)
    assert r["id"] == "n1234567890"
    assert r["polarity"] == "+"
    assert "黙浴の掲示あり" in r["claim"]


def test_parse_negative():
    r = ing.parse_issue_body(BODY_NEGATIVE)
    assert r["id"] == "w987"
    assert r["polarity"] == "-"


def test_parse_rejects_garbage():
    assert ing.parse_issue_body("") is None
    assert ing.parse_issue_body("### 施設ID\n\n_No response_\n") is None
    # ID の形式が不正
    assert ing.parse_issue_body("### 施設ID\n\nDROP TABLE\n\n### 根拠\n\nx\n") is None


def test_merge_adds_evidence():
    curated = {}
    entries = [{"id": "n1", "polarity": "+", "claim": "黙浴の掲示あり",
                "issue": 42, "checked": "2026-08-02"}]
    out, changes = ing.merge(curated, entries)
    ev = out["n1"]["evidence"]
    assert len(ev) == 1
    assert ev[0]["src"] == "user" and ev[0]["id"] == "gh-issue-42"
    assert ev[0]["polarity"] == "+" and ev[0]["checked"] == "2026-08-02"
    assert len(changes) == 1


def test_merge_is_idempotent():
    entries = [{"id": "n1", "polarity": "+", "claim": "黙浴の掲示あり",
                "issue": 42, "checked": "2026-08-02"}]
    out, _ = ing.merge({}, entries)
    out2, changes = ing.merge(out, entries)
    assert len(out2["n1"]["evidence"]) == 1, "同じissueを二重に取り込んでいる"
    assert changes == []


def test_merge_preserves_existing():
    curated = {"n1": {"note": "手書きメモ", "chain": 0,
                      "evidence": [{"src": "web", "url": "https://x", "checked": "2026-01-01",
                                    "polarity": "+"}]}}
    entries = [{"id": "n1", "polarity": "-", "claim": "入りにくかった",
                "issue": 99, "checked": "2026-08-02"}]
    out, _ = ing.merge(curated, entries)
    assert out["n1"]["note"] == "手書きメモ"
    assert out["n1"]["chain"] == 0
    assert len(out["n1"]["evidence"]) == 2


def main():
    test_parse_ok()
    test_parse_negative()
    test_parse_rejects_garbage()
    test_merge_adds_evidence()
    test_merge_is_idempotent()
    test_merge_preserves_existing()
    print("OK: ingest_issues")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_ingest_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'ingest_issues'`

- [ ] **Step 3: Issue テンプレートを作る**

`.github/ISSUE_TEMPLATE/hitori-submission.yml`:

```yaml
name: ひとり歓迎マップへの情報提供
description: 施設が「ひとり向き」かどうかの実地情報を送る
title: "[ひとり歓迎マップ] "
labels: ["hitori-submission"]
body:
  - type: markdown
    attributes:
      value: |
        マップの「この県の情報を送る」から来た場合、施設IDは施設一覧のリンクから確認できます。
        いただいた情報は出典として公開されます。
  - type: input
    id: facility
    attributes:
      label: 施設ID
      description: n / w / r で始まるID（例 n1234567890）
      placeholder: n1234567890
    validations:
      required: true
  - type: dropdown
    id: verdict
    attributes:
      label: この施設はひとり向きですか
      options:
        - ひとり向き（黙浴・カウンターなど）
        - ひとり向きではなかった
    validations:
      required: true
  - type: textarea
    id: claim
    attributes:
      label: 根拠
      description: 見たままを書いてください（掲示、席の形、実際の様子など）
    validations:
      required: true
  - type: textarea
    id: extra
    attributes:
      label: 補足
    validations:
      required: false
```

- [ ] **Step 4: 取り込みスクリプトを書く**

`scripts/hitori/ingest_issues.py`:

```python
# -*- coding: utf-8 -*-
"""hitori-submission ラベルの GitHub Issue を curated.json に取り込む。

マージは自動だが無条件ではない。差分を表示して人が確認してから書き込む。
--yes を付けると確認を飛ばす。
"""
import argparse, json, re, subprocess, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "hitori" / "curated.json"

_ID_RE = re.compile(r"^[nwr]\d+$")
_SECTION_RE = re.compile(r"^###\s+(.+?)\s*$", re.M)
_NEGATIVE = "ひとり向きではなかった"


def _sections(body):
    """'### 見出し' で区切られた本文を {見出し: 中身} にする。"""
    out, parts = {}, _SECTION_RE.split(body or "")
    for i in range(1, len(parts) - 1, 2):
        out[parts[i].strip()] = parts[i + 1].strip()
    return out


def parse_issue_body(body):
    """issue本文 → {"id","polarity","claim"}。不正なら None。"""
    sec = _sections(body)
    fid = sec.get("施設ID", "").strip()
    if not fid or fid == "_No response_" or not _ID_RE.match(fid):
        return None
    claim = sec.get("根拠", "").strip()
    if not claim or claim == "_No response_":
        return None
    verdict = sec.get("この施設はひとり向きですか", "").strip()
    return {
        "id": fid,
        "polarity": "-" if _NEGATIVE in verdict else "+",
        "claim": claim,
    }


def merge(curated, entries):
    """curated に evidence を追記する。同じ issue 番号は二重に入れない。"""
    out = json.loads(json.dumps(curated))  # 深いコピー
    changes = []
    for e in entries:
        rec = out.setdefault(e["id"], {})
        ev = rec.setdefault("evidence", [])
        eid = f"gh-issue-{e['issue']}"
        if any(x.get("id") == eid for x in ev):
            continue
        ev.append({
            "src": "user", "id": eid, "claim": e["claim"],
            "checked": e["checked"], "polarity": e["polarity"],
        })
        changes.append(f"{e['id']}  {e['polarity']}  {e['claim'][:40]}  (#{e['issue']})")
    return out, changes


def _fetch_issues():
    cmd = ["gh", "issue", "list", "--label", "hitori-submission",
           "--state", "open", "--limit", "200",
           "--json", "number,body"]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print(f"gh の実行に失敗しました: {res.stderr}")
        sys.exit(1)
    return json.loads(res.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="確認せずに書き込む")
    ap.add_argument("--close", action="store_true", help="取り込んだ issue をクローズする")
    args = ap.parse_args()

    today = date.today().isoformat()
    entries, skipped = [], []
    for it in _fetch_issues():
        parsed = parse_issue_body(it.get("body"))
        if not parsed:
            skipped.append(it["number"])
            continue
        parsed.update(issue=it["number"], checked=today)
        entries.append(parsed)

    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}
    new, changes = merge(curated, entries)

    if skipped:
        print(f"形式不正でスキップ: {skipped}")
    if not changes:
        print("取り込む変更はありません。")
        return

    print(f"\n{len(changes)} 件の変更:")
    for c in changes:
        print("  " + c)

    if not args.yes and input("\n書き込みますか [y/N]: ").strip().lower() != "y":
        print("中止しました。")
        return

    CURATED.write_text(json.dumps(new, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {CURATED}")

    if args.close:
        for e in entries:
            subprocess.run(["gh", "issue", "close", str(e["issue"]),
                            "--comment", "取り込みました。ありがとうございます。"],
                           capture_output=True, text=True)
            subprocess.run(["gh", "issue", "edit", str(e["issue"]),
                            "--add-label", "ingested"], capture_output=True, text=True)
    print("build_data.py を再実行してデータへ反映してください。")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_ingest_test.py`
Expected: `OK: ingest_issues`

- [ ] **Step 6: Commit**

```bash
git add .github/ISSUE_TEMPLATE/hitori-submission.yml scripts/hitori/ingest_issues.py tests/hitori_ingest_test.py
git commit -m "feat(hitori): GitHub Issue投稿の受け口と取り込みを追加"
```

---

### Task 14: 調査キュー

**Files:**
- Create: `scripts/hitori/research_queue.py`
- Test: `tests/hitori_queue_test.py`

**Interfaces:**
- Consumes: `data/hitori/summary.json`、`data/hitori/pref/*.json`、`data/hitori/curated.json`
- Produces: `rank_targets(prefdocs: dict, curated: dict) -> list[dict]` — 優先度降順の調査対象

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_queue_test.py`:

```python
# -*- coding: utf-8 -*-
"""調査キューの優先度付け検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import research_queue as rq

FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]

PREFDOCS = {
    13: {"pref": 13, "name": "東京都", "fields": FIELDS, "items": [
        ["n1", "投稿あり店", 35.6, 139.7, "eat", "ramen", 4, 2, 0, ""],
        ["n2", "境界スコア店", 35.6, 139.7, "bath", "onsen", 3, 0, 0, ""],
        ["n3", "高スコア店", 35.6, 139.7, "eat", "standing", 5, 0, 0, ""],
        ["n4", "少数カテゴリ店", 35.6, 139.7, "play", "cinema", 3, 0, 0, ""],
    ]},
}
CURATED = {"n1": {"evidence": [{"src": "user", "id": "gh-issue-9",
                                "checked": "2026-08-01", "polarity": "+"}]}}


def test_investigated_are_excluded():
    # 既に conf>=1 のものは調査済みなので出さない
    out = rq.rank_targets(PREFDOCS, CURATED)
    assert all(t["id"] != "n1" for t in out), "調査済みが混ざっている"


def test_boundary_score_first():
    out = rq.rank_targets(PREFDOCS, CURATED)
    assert out[0]["id"] in ("n2", "n4"), f"境界スコアが先頭でない: {out[0]}"


def test_reason_is_present():
    for t in rq.rank_targets(PREFDOCS, CURATED):
        assert t["reason"], f"reason が空: {t}"


def test_limit():
    out = rq.rank_targets(PREFDOCS, CURATED, limit=2)
    assert len(out) == 2


def main():
    test_investigated_are_excluded()
    test_boundary_score_first()
    test_reason_is_present()
    test_limit()
    print("OK: research_queue")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_queue_test.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'research_queue'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/research_queue.py`:

```python
# -*- coding: utf-8 -*-
"""次に調べるべき施設を優先度順に出す。

調査結果は必ず出典URLと確認日つきで curated.json に入れること。
URLが取れないものは採用しない（build_data.py 側でも検証している）。
"""
import argparse, json, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "hitori"

BOUNDARY_SCORE = 3   # スコア境界。ここが一番判定を間違えやすい
RARE_CAT_THRESHOLD = 5


def rank_targets(prefdocs, curated, limit=50):
    """優先度降順の調査対象。conf>=1 の施設は調査済みなので除外する。"""
    targets = []
    for code, doc in prefdocs.items():
        idx = {f: i for i, f in enumerate(doc["fields"])}
        rows = [dict(zip(doc["fields"], r)) for r in doc["items"]]
        cat_counts = Counter(r["cat"] for r in rows)

        for r in rows:
            if r["conf"] >= 1:
                continue
            weight, reasons = 0, []
            if r["score"] == BOUNDARY_SCORE:
                weight += 10
                reasons.append("スコア境界")
            if cat_counts[r["cat"]] <= RARE_CAT_THRESHOLD:
                weight += 5
                reasons.append(f"県内で{r['cat']}が{cat_counts[r['cat']]}件のみ")
            if r["chain"] == 0:
                weight += 2
                reasons.append("独立店")
            if weight == 0:
                continue
            targets.append({
                "id": r["id"], "name": r["name"], "pref": code,
                "cat": r["cat"], "kind": r["kind"], "score": r["score"],
                "weight": weight, "reason": " / ".join(reasons),
                "maps": f"https://www.google.com/maps/search/?api=1&query={r['lat']},{r['lon']}",
            })

    targets.sort(key=lambda t: (-t["weight"], t["pref"], t["id"]))
    return targets[:limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--pref", type=int, default=None, help="この県だけ")
    args = ap.parse_args()

    curated_path = OUT_DIR / "curated.json"
    curated = json.loads(curated_path.read_text(encoding="utf-8")) if curated_path.exists() else {}

    prefdocs = {}
    for f in sorted((OUT_DIR / "pref").glob("*.json")):
        code = int(f.stem)
        if args.pref and code != args.pref:
            continue
        prefdocs[code] = json.loads(f.read_text(encoding="utf-8"))

    if not prefdocs:
        print("pref/*.json がありません。build_data.py を先に実行してください。")
        sys.exit(1)

    for t in rank_targets(prefdocs, curated, args.limit):
        print(f"[{t['weight']:>2}] {t['id']:<12} {t['name']:<24} "
              f"{t['cat']}/{t['kind']:<12} {t['reason']}")
        print(f"     {t['maps']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `PYTHONUTF8=1 python tests/hitori_queue_test.py`
Expected: `OK: research_queue`

- [ ] **Step 5: 実データで動作確認**

Run: `PYTHONUTF8=1 python scripts/hitori/research_queue.py --pref 13 --limit 10`
Expected: 10件が優先度つきで並ぶ

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/research_queue.py tests/hitori_queue_test.py
git commit -m "feat(hitori): 調査優先度キューを追加"
```

---

### Task 15: サイト統合と全体検証

**Files:**
- Modify: `index.html`（作品一覧に hitori.html を追加）
- Modify: `sitemap.xml` / `sitemap-v2.xml`（`scripts/generate_sitemap.py` で再生成）
- Create: `tests/hitori_all.py`（全テストのランナー）

**Interfaces:**
- Consumes: これまでの全成果物
- Produces: `tests/hitori_all.py` — 全テストを順に実行し、1つでも落ちたら非ゼロで終了

- [ ] **Step 1: テストランナーを書く**

`tests/hitori_all.py`:

```python
# -*- coding: utf-8 -*-
"""ひとり歓迎マップの全テストを順に実行する。"""
import subprocess, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = [
    "hitori_master_test.py",
    "hitori_scoring_test.py",
    "hitori_osm_query_test.py",
    "hitori_normalize_test.py",
    "hitori_validate_test.py",
    "hitori_build_test.py",
    "hitori_mapsvg_test.py",
    "hitori_ingest_test.py",
    "hitori_queue_test.py",
    "hitori_render_test.py",   # Playwright を使うので最後
]


def main():
    env = dict(os.environ, PYTHONUTF8="1")
    failed = []
    for t in TESTS:
        print(f"\n=== {t} ===")
        r = subprocess.run([sys.executable, str(ROOT / "tests" / t)], env=env)
        if r.returncode != 0:
            failed.append(t)
    print("\n" + "=" * 40)
    if failed:
        print(f"FAILED: {failed}")
        sys.exit(1)
    print(f"ALL PASS ({len(TESTS)} suites)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 全テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_all.py`
Expected: `ALL PASS (10 suites)`

落ちたスイートがあれば、そのタスクに戻って直す。

- [ ] **Step 3: index.html に導線を追加**

`index.html` の作品一覧に、既存カードと同じマークアップでエントリを足す。既存カードの構造を読んでから、同じクラス・同じ属性順で追加すること。タイトルは `ひとり歓迎マップ`、説明は `ひとりで行ける店ではなく、ひとりが標準の店だけを集めた日本地図。`、リンク先は `hitori.html`。

- [ ] **Step 4: sitemap を再生成**

Run: `PYTHONUTF8=1 python scripts/generate_sitemap.py`
Expected: `sitemap.xml` に `hitori.html` の行が入る

Run: `PYTHONUTF8=1 python scripts/audit_sitemap.py`
Expected: エラーなし

- [ ] **Step 5: 重複const宣言チェック**

Run: `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html`
Expected: exit 0

- [ ] **Step 6: 最終目視**

`C:/tmp/hitori_overview.png` と `C:/tmp/hitori_mobile.png` を開き、以下を確認する。

- 4つのカテゴリを1つずつ切り替えると、**上位に来る県の顔ぶれが変わる**（全部同じなら density がカテゴリ別になっていない）
- 「チェーンを隠す」をONにすると塗り分けが変わり、湯の比重が上がる
- 出典3行と免責文が読める位置に出ている
- モバイルで横スクロールが発生しない

- [ ] **Step 7: Commit**

```bash
git add index.html sitemap.xml sitemap-v2.xml tests/hitori_all.py
git commit -m "feat(hitori): サイトへ統合しテストランナーを追加"
```

---

## 実行後の運用

データ更新は3コマンド。

```bash
PYTHONUTF8=1 python scripts/hitori/fetch_osm.py      # Overpass から取り直す
PYTHONUTF8=1 python scripts/hitori/build_data.py     # 正規化・スコア付与・分割
PYTHONUTF8=1 python tests/hitori_all.py              # 全テスト
```

投稿の取り込みは Overpass を叩き直す必要がない。

```bash
PYTHONUTF8=1 python scripts/hitori/ingest_issues.py --close
PYTHONUTF8=1 python scripts/hitori/build_data.py
```

次に調べるべき施設は `research_queue.py` が出す。調査結果は出典URLと確認日つきで `curated.json` に手で書く。
