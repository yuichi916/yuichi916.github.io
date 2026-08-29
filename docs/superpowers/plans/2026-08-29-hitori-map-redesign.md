# ひとり歓迎マップ 全面再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hitori.html` を「全面地図＋ボトムシート」の1画面アプリに作り直し、確認済み施設を主役に、現在地／駅名から探す→根拠を確かめる→行きたい・行ったを保存する、がスマホ1画面で完結するようにする。

**Architecture:** 既存の純関数モジュール `assets/hitori/core.js`（距離・opening_hours・駅名検索・県判定）を import し、新しい純関数群を `assets/hitori/map-core.js` に、DOM/Leaflet/fetch を `assets/hitori/app.js` に分ける。データは build スクリプトで `index.json`（軽い索引）と県別 `curated/NN.json` に分割し、必要な県だけ読む。純関数は node テスト、画面は pytest+Playwright で検証する。

**Tech Stack:** 素の ES Modules（ビルド無し）、Leaflet 1.9.4、地理院タイル pale、Python 3（build/テスト）、pytest + playwright（既存 `tests/hitori_render_test.py` と同じ）、GoatCounter。

**Spec:** `docs/superpowers/specs/2026-08-29-hitori-map-redesign-design.md`

## Global Constraints

- リポジトリ: `C:\projects\yuichi916.github.io`（GitHub Pages、バックエンド無し）。コミットは Conventional Commits・lowercase-hyphen。
- `assets/hitori/core.js` と `data/hitori/curated.json`・`data/hitori/pref/*.json` は**変更しない**（旧版と既存スクリプトが参照）。
- 未確認施設に推定スコア（点線・数字）を出さない。根拠のない定型文を出さない。
- 3軸の正式名称は「ひとり度・静けさ・入りやすさ」（確認済み詳細でのみ使う）。
- 地図タイル: `https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png`、出典 `<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>`。施設データ出典 `© OpenStreetMap contributors / ODbL` を常時表示。
- タップ対象 44px 以上。`prefers-reduced-motion` でアニメ無効。ダーク対応なし。
- 保存キー `hitori.saved.v1`。共有クエリ `?saved=14:n123,13:n456`。施設共有 `?pref=14&facility=n123`（現行互換）。
- GoatCounter イベント: `hitori.locate` / `hitori.detail` / `hitori.save` / `hitori.route`。
- Python 実行は `PYTHONUTF8=1`。node テストは `node tests/<file>.mjs`。
- 大型 JS はコミット前に `python C:/tmp/check_dup_const.py assets/hitori/app.js` が exit 0。

---

### Task 1: index.json と県別 curated の生成スクリプト

**Files:**
- Create: `scripts/hitori/build_index.py`
- Create: `tests/hitori_index_test.py`
- Modify: `tests/hitori_all.py`（TESTS に `"hitori_index_test.py"` を `"hitori_build_test.py"` の直後に追加）
- Generate: `data/hitori/index.json`, `data/hitori/curated/NN.json`（47ファイル）

**Interfaces:**
- Produces: `build_index(prefdocs: dict[int, dict], curated: dict, summary: dict) -> tuple[dict, dict[int, dict]]`
  - 返り値 `index` の形:
    ```json
    {"updated":"2026-08-22","total":40615,"checked_count":817,
     "prefectures":[{"code":1,"name":"北海道","count":1904,"checked":258,"center":[43.06,141.35]}],
     "checked":{"n10011494817":[24,7,3,1,0,"2026-08-08"]}}
    ```
    `checked[id] = [prefCode, nFacts, nOfficial, nConflict, hasInsight(0|1), checkedDate]`
  - 返り値 `by_pref[code] = {"<id>": <curated.json のエントリそのまま>}`

- [ ] **Step 1: 失敗するテストを書く**

```python
# tests/hitori_index_test.py
# -*- coding: utf-8 -*-
"""build_index の検証。実データではなく fixture で固める。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import build_index

FIELDS = ["id", "name", "lat", "lon", "cat", "kind"]
PREFDOCS = {
    13: {"pref": 13, "name": "東京都", "fields": FIELDS,
         "items": [["n1", "A", 35.0, 139.0, "eat", "ramen"], ["n2", "B", 36.0, 140.0, "bath", "sento"]]},
    14: {"pref": 14, "name": "神奈川県", "fields": FIELDS,
         "items": [["n3", "C", 35.5, 139.5, "stay", "museum"]]},
}
CURATED = {
    "n1": {"checked": "2026-08-01", "facts": [
        {"k": "price", "v": 600, "official": True, "conflict": True, "src": ["a.jp"], "urls": ["https://a.jp/x"]},
        {"k": "price", "v": 700, "official": False, "conflict": True, "src": ["b.jp"], "urls": ["https://b.jp/y"]},
        {"k": "solo_insight", "v": {"title": "t", "insight": "i", "quality": "grounded",
                                     "policyVersion": "official-provenance-v2"}, "official": True, "conflict": False, "src": ["a.jp"], "urls": []},
    ]},
    "n3": {"checked": "2026-08-02", "facts": [
        {"k": "hours", "v": "10:00-17:00", "official": True, "conflict": False, "src": ["c.jp"], "urls": ["https://c.jp"]}]},
    "orphan": {"checked": "2026-08-03", "facts": []},
}
SUMMARY = {"updated": "2026-08-22", "total": 3, "checked_count": 2}


def test_index_shape():
    index, by_pref = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert index["updated"] == "2026-08-22"
    assert index["total"] == 3
    prefs = {p["code"]: p for p in index["prefectures"]}
    assert prefs[13]["count"] == 2 and prefs[13]["checked"] == 1
    assert prefs[14]["count"] == 1 and prefs[14]["checked"] == 1
    assert abs(prefs[13]["center"][0] - 35.5) < 1e-6
    assert abs(prefs[13]["center"][1] - 139.5) < 1e-6


def test_checked_entry_counts():
    index, _ = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert index["checked"]["n1"] == [13, 3, 2, 2, 1, "2026-08-01"]
    assert index["checked"]["n3"] == [14, 1, 1, 0, 0, "2026-08-02"]


def test_orphans_are_dropped_and_counted():
    index, by_pref = build_index.build_index(PREFDOCS, CURATED, SUMMARY)
    assert "orphan" not in index["checked"]
    assert index["checked_count"] == 2
    assert set(by_pref[13].keys()) == {"n1"}
    assert set(by_pref[14].keys()) == {"n3"}
    assert by_pref[13]["n1"] == CURATED["n1"]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
```

- [ ] **Step 2: 失敗を確認**

Run: `cd C:\projects\yuichi916.github.io && PYTHONUTF8=1 python tests/hitori_index_test.py`
Expected: `ModuleNotFoundError: No module named 'build_index'`

- [ ] **Step 3: 実装**

```python
# scripts/hitori/build_index.py
# -*- coding: utf-8 -*-
"""curated.json と pref/NN.json から、軽い索引 index.json と県別 curated/NN.json を作る。

hitori.html は初回に 2.3MB の curated.json を丸ごと読んでいた。索引だけを先に読み、
事実の本体は必要になった県だけ読むための一方向の派生。curated.json 自体は触らない。
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "hitori"


def _pref_of_ids(prefdocs):
    out = {}
    for code, doc in prefdocs.items():
        i = doc["fields"].index("id")
        for row in doc["items"]:
            out[row[i]] = code
    return out


def _is_grounded_insight(fact):
    v = fact.get("v")
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return False
    return (fact.get("official") is True and isinstance(v, dict)
            and v.get("quality") == "grounded"
            and v.get("policyVersion") == "official-provenance-v2"
            and bool(str(v.get("title", "")).strip()) and bool(str(v.get("insight", "")).strip()))


def build_index(prefdocs, curated, summary):
    pref_of = _pref_of_ids(prefdocs)
    checked, by_pref, orphans = {}, {code: {} for code in prefdocs}, []
    for fid, entry in curated.items():
        code = pref_of.get(fid)
        if code is None:
            orphans.append(fid)
            continue
        facts = entry.get("facts", [])
        checked[fid] = [
            code, len(facts),
            sum(1 for f in facts if f.get("official")),
            sum(1 for f in facts if f.get("conflict")),
            1 if any(f.get("k") == "solo_insight" and _is_grounded_insight(f) for f in facts) else 0,
            entry.get("checked", ""),
        ]
        by_pref[code][fid] = entry
    prefectures = []
    for code, doc in sorted(prefdocs.items()):
        ilat, ilon = doc["fields"].index("lat"), doc["fields"].index("lon")
        n = len(doc["items"])
        lat = sum(r[ilat] for r in doc["items"]) / n if n else 0
        lon = sum(r[ilon] for r in doc["items"]) / n if n else 0
        prefectures.append({"code": code, "name": doc["name"], "count": n,
                            "checked": len(by_pref[code]),
                            "center": [round(lat, 4), round(lon, 4)]})
    index = {"updated": summary["updated"], "total": summary["total"],
             "checked_count": len(checked), "prefectures": prefectures, "checked": checked}
    if orphans:
        print(f"県ファイルに無い curated: {len(orphans)} 件を索引から外した", file=sys.stderr)
    return index, by_pref


def main():
    summary = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    curated = json.loads((DATA / "curated.json").read_text(encoding="utf-8"))
    prefdocs = {}
    for f in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        prefdocs[int(doc["pref"])] = doc
    index, by_pref = build_index(prefdocs, curated, summary)
    (DATA / "curated").mkdir(exist_ok=True)
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for code, entries in by_pref.items():
        (DATA / "curated" / f"{code:02d}.json").write_text(
            json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = (DATA / "index.json").stat().st_size / 1024
    print(f"index.json {kb:.0f}KB / checked {index['checked_count']:,} / curated/ {len(by_pref)} files")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: テスト成功を確認**

Run: `PYTHONUTF8=1 python tests/hitori_index_test.py`
Expected: `ok test_index_shape` `ok test_checked_entry_counts` `ok test_orphans_are_dropped_and_counted`

- [ ] **Step 5: 実データで生成し、件数を突き合わせる**

Run: `PYTHONUTF8=1 python scripts/hitori/build_index.py && PYTHONUTF8=1 python -c "import json;i=json.load(open('data/hitori/index.json',encoding='utf-8'));print(i['checked_count'],len(i['prefectures']),sum(p['count'] for p in i['prefectures']))"`
Expected: `817 47 40615`（checked_count が 817 未満なら stderr の孤児件数と合計が 817 になることを確認する。ならなければ止めて原因を出す）。index.json は 100KB 未満。

- [ ] **Step 6: hitori_all.py に登録してコミット**

`tests/hitori_all.py` の TESTS で `"hitori_build_test.py",` の次の行に `"hitori_index_test.py",` を追加。

```bash
git add scripts/hitori/build_index.py tests/hitori_index_test.py tests/hitori_all.py data/hitori/index.json data/hitori/curated/
git commit -m "feat(hitori): split curated.json into a light index and per-prefecture fact files"
```

---

### Task 2: map-core.js — 表示カテゴリ・kind日本語・業態の見立て

**Files:**
- Create: `assets/hitori/map-core.js`
- Create: `tests/hitori_mapcore_test.mjs`
- Modify: `tests/hitori_all.py`（NODE_TESTS に `"hitori_mapcore_test.mjs"` を追加）

**Interfaces:**
- Produces:
  - `DISPLAY_CATS: Array<{key, label}>` = eat/飲食, bath/温浴, play/体験, quiet/静かに過ごす, stay/宿
  - `displayCat(kind: string, cat: string): string` — kind から表示カテゴリ key。未知 kind は `cat` をそのまま返す
  - `kindJa(kind: string): string` — 未知は kind をそのまま
  - `fitNote(kind: string): string` — 「業態の見立て」1行。未知は `''`

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/hitori_mapcore_test.mjs
// 新マップの純関数テスト。DOM も fetch も使わない。実行: node tests/hitori_mapcore_test.mjs
import * as mc from '../assets/hitori/map-core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function deq(a, b, msg) { eq(JSON.stringify(a), JSON.stringify(b), msg); }

check('displayCat: museum/library は stay ではなく quiet', () => {
  eq(mc.displayCat('museum', 'stay'), 'quiet');
  eq(mc.displayCat('library', 'stay'), 'quiet');
  eq(mc.displayCat('hostel', 'stay'), 'stay');
  eq(mc.displayCat('ramen', 'eat'), 'eat');
  eq(mc.displayCat('private_sauna', 'stay'), 'bath', 'データ側の cat がずれていても kind を信じる');
  eq(mc.displayCat('unknown_kind', 'play'), 'play', '未知 kind は cat のまま');
});

check('kindJa', () => {
  eq(mc.kindJa('soba_udon'), 'そば・うどん');
  eq(mc.kindJa('netcafe'), 'ネットカフェ');
  eq(mc.kindJa('zzz'), 'zzz');
});

check('fitNote', () => {
  eq(mc.fitNote('ramen'), '一人客が普通の業態');
  eq(mc.fitNote('karaoke'), 'ヒトカラ対応は要確認');
  eq(mc.fitNote('zzz'), '');
});

check('DISPLAY_CATS の順', () => {
  deq(mc.DISPLAY_CATS.map(c => c.key), ['eat', 'bath', 'play', 'quiet', 'stay']);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('OK: map-core');
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/hitori_mapcore_test.mjs`
Expected: `Cannot find module '.../assets/hitori/map-core.js'`

- [ ] **Step 3: 実装**

```js
// assets/hitori/map-core.js
// 新しい地図UIの純関数。DOM・fetch・Leaflet に触らない。
// 距離・営業時間・駅名検索・県判定は既存の core.js を使う（再実装しない）。
import { haversineM, openState, parseOpeningHours } from './core.js';

// --- 表示カテゴリ ---
// データ側の cat は stay に museum/library が混ざっている（「宿泊」に博物館が出ていた）。
// 表示は kind から決め直す。データは触らない。
export const DISPLAY_CATS = [
  { key: 'eat', label: '飲食' },
  { key: 'bath', label: '温浴' },
  { key: 'play', label: '体験' },
  { key: 'quiet', label: '静かに過ごす' },
  { key: 'stay', label: '宿' },
];

const KIND_CAT = {
  ramen: 'eat', soba_udon: 'eat', gyudon: 'eat', curry: 'eat', standing: 'eat',
  sento: 'bath', sauna: 'bath', onsen: 'bath', footbath: 'bath', private_sauna: 'bath',
  spa: 'bath', capsule_hotel_sauna: 'bath', private_sauna_hotel: 'bath',
  karaoke: 'play', netcafe: 'play', cinema: 'play',
  library: 'quiet', museum: 'quiet',
  hostel: 'stay',
};

const KIND_JA = {
  ramen: 'ラーメン', soba_udon: 'そば・うどん', gyudon: '牛丼・定食', curry: 'カレー', standing: '立ち食い',
  sento: '銭湯', sauna: 'サウナ', onsen: '温泉', footbath: '足湯', private_sauna: '個室サウナ',
  spa: 'スパ', capsule_hotel_sauna: 'カプセル&サウナ', private_sauna_hotel: '個室サウナ付き宿',
  karaoke: 'カラオケ', netcafe: 'ネットカフェ', cinema: '映画館',
  library: '図書館', museum: '博物館・美術館', hostel: 'ホステル',
};

// 未確認施設に見せる唯一の「見立て」。数字は出さない。業態の性質だけを言う。
const FIT_NOTE = {
  ramen: '一人客が普通の業態', gyudon: '一人客が普通の業態', curry: '一人客が普通の業態',
  standing: '一人客が普通の業態', sento: '一人客が普通の業態', netcafe: '一人客が普通の業態',
  library: '一人客が普通の業態', museum: '一人客が普通の業態', cinema: '一人客が普通の業態',
  soba_udon: '一人客が多い業態', karaoke: 'ヒトカラ対応は要確認',
  hostel: 'ドミトリー中心。個室は要確認', onsen: '一人利用は一般的', sauna: '一人利用は一般的',
  private_sauna: '個室型', private_sauna_hotel: '個室型', footbath: '一人客が普通の業態',
};

export function displayCat(kind, cat) { return KIND_CAT[kind] || cat; }
export function kindJa(kind) { return KIND_JA[kind] || kind; }
export function fitNote(kind) { return FIT_NOTE[kind] || ''; }
```

- [ ] **Step 4: 成功を確認**

Run: `node tests/hitori_mapcore_test.mjs`
Expected: `OK: map-core`

- [ ] **Step 5: 登録してコミット**

`tests/hitori_all.py` の `NODE_TESTS = ["hitori_core_test.mjs"]` を `NODE_TESTS = ["hitori_core_test.mjs", "hitori_mapcore_test.mjs"]` に。

```bash
git add assets/hitori/map-core.js tests/hitori_mapcore_test.mjs tests/hitori_all.py
git commit -m "feat(hitori): recompute display categories from kind so museums leave the lodging tab"
```

---

### Task 3: map-core.js — 営業中ラベル

**Files:**
- Modify: `assets/hitori/map-core.js`
- Modify: `tests/hitori_mapcore_test.mjs`

**Interfaces:**
- Consumes: `openState(str, date)` from core.js（'open' | 'closed' | null）, `parseOpeningHours(str)`
- Produces: `openLabel(item: {oh?: string}, hoursFact: {v: string, official?: boolean} | null, now: Date): {state: 'open'|'closed'|'unknown', text: string, source: string}`
  - 優先: 確認済み `hoursFact.v` が `parseOpeningHours` で解釈できればそれを使い `source='公式サイト'`（official でなければ `'確認済み情報'`）。だめなら `item.oh` を使い `source='OpenStreetMap'`。どちらも無理なら `unknown`。
  - `text`: open → `営業中 〜21:00`（今日の閉店時刻。24:00 超は `〜翌2:00`）、closed → `営業時間外`、unknown → `営業時間は要確認`

- [ ] **Step 1: テストを追加**

```js
check('openLabel: OSM の oh で営業中と閉店時刻', () => {
  const now = new Date(2026, 7, 29, 12, 0);   // 土曜 12:00
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, null, now);
  eq(r.state, 'open'); eq(r.text, '営業中 〜21:00'); eq(r.source, 'OpenStreetMap');
});
check('openLabel: 日をまたぐ閉店は「翌」', () => {
  const now = new Date(2026, 7, 29, 23, 30);
  const r = mc.openLabel({ oh: '18:00-02:00' }, null, now);
  eq(r.state, 'open'); eq(r.text, '営業中 〜翌2:00');
});
check('openLabel: 確認済み hours を OSM より優先', () => {
  const now = new Date(2026, 7, 29, 12, 0);
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, { v: '10:00-15:00', official: true }, now);
  eq(r.text, '営業中 〜15:00'); eq(r.source, '公式サイト');
});
check('openLabel: 解釈できない hours は OSM に落ちる', () => {
  const now = new Date(2026, 7, 29, 12, 0);
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, { v: '午前11時から午後9時まで', official: true }, now);
  eq(r.source, 'OpenStreetMap');
});
check('openLabel: 何も無ければ unknown', () => {
  const r = mc.openLabel({}, null, new Date(2026, 7, 29, 12, 0));
  eq(r.state, 'unknown'); eq(r.text, '営業時間は要確認');
});
check('openLabel: 時間外', () => {
  const r = mc.openLabel({ oh: 'Mo-Su 11:00-21:00' }, null, new Date(2026, 7, 29, 22, 0));
  eq(r.state, 'closed'); eq(r.text, '営業時間外');
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node tests/hitori_mapcore_test.mjs` → `FAIL openLabel...: mc.openLabel is not a function`

- [ ] **Step 3: 実装（map-core.js に追記）**

```js
// --- 営業中ラベル ---
function _closingText(rules, now) {
  const day = now.getDay(), prev = (day + 6) % 7;
  const min = now.getHours() * 60 + now.getMinutes();
  let end = null;
  for (const r of rules) {
    if (r.days.includes(day)) for (const [a, b] of r.spans) if (min >= a && min < b) end = b;
    if (end === null && r.days.includes(prev)) {
      for (const [a, b] of r.spans) if (b > 1440 && min + 1440 >= a && min + 1440 < b) end = b - 1440;
    }
  }
  if (end === null) return '';
  const next = end > 1440;
  const m = next ? end - 1440 : end;
  const hh = Math.floor(m / 60), mm = m % 60;
  return `〜${next ? '翌' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}

export function openLabel(item, hoursFact, now) {
  const candidates = [];
  if (hoursFact && typeof hoursFact.v === 'string') {
    candidates.push([hoursFact.v, hoursFact.official ? '公式サイト' : '確認済み情報']);
  }
  if (item && item.oh) candidates.push([item.oh, 'OpenStreetMap']);
  for (const [str, source] of candidates) {
    const rules = parseOpeningHours(str);
    if (!rules) continue;
    const st = openState(str, now);
    if (st === 'open') return { state: 'open', text: `営業中 ${_closingText(rules, now)}`.trim(), source };
    return { state: 'closed', text: '営業時間外', source };
  }
  return { state: 'unknown', text: '営業時間は要確認', source: '' };
}
```

- [ ] **Step 4: 成功を確認** — Run: `node tests/hitori_mapcore_test.mjs` → `OK: map-core`

- [ ] **Step 5: コミット**

```bash
git add assets/hitori/map-core.js tests/hitori_mapcore_test.mjs
git commit -m "feat(hitori): open-now label that prefers verified hours over osm tags"
```

---

### Task 4: map-core.js — 確認済み事実の整形（食い違いを並べる・ひとり基準・警告）

**Files:**
- Modify: `assets/hitori/map-core.js`
- Modify: `tests/hitori_mapcore_test.mjs`

**Interfaces:**
- Produces:
  - `FACT_LABEL: Record<string,string>`（現行 hitori.html の FACT に seats/cuisine/wash_area/luggage/clientele/facility_identity/open_period/status/renamed_to/silence を追加）
  - `formatFactValue(k, v): string` — 語彙値→日本語（ticket_machine→券売機あり, cash_only→現金のみ, cashless_ok→キャッシュレス可, counter_person→レジで支払い, none→予約不要, possible→予約可, required→要予約, public→制限なし, residents_only→住民限定, members_only→会員制, male_only→男性専用, female_only→女性専用, open→営業中, closed_temporarily→休業中, closed_permanently→閉業, posted→黙浴の掲示あり, observed→静か（訪問記）, local→地元客中心, tourist→観光客中心, solo_common→一人客が多い, easy→初めてでも迷わない, custom_exists→独自の作法あり, yes→あり, no→なし, rental→貸出あり, included→料金に含む）。数値の price は `600円`。object は JSON 文字列。
  - `PERSONAL_DOMAINS: RegExp` = `/zatsu-ke\.blog\.jp|sanukiudon-ranking\.com/`
  - `summarizeCurated(entry): {checked, nFacts, nOfficial, nDomains, nConflict}`
  - `groupFacts(entry, displayCatKey): {rows, solo, warnings, insight}`
    - `rows: Array<{k, label, conflict: boolean, values: Array<{text, domain, url, official, personal}>}>` — 同じ k をまとめ、`solo_insight` と `facility_identity` と `city` は rows に入れない。`displayCatKey` が eat/play/quiet/stay のとき `bring_towel/towel/wash_area/amenities` を除く。順序: hours, opening_hours, closed_days, price, payment_method, counter_seats, seats_total, seats, reservation, access, parking, conditions, open_period, その他はデータ順
    - `solo: Array<{label, text, official}>` — ひとり基準ブロック。solo_ok→「一人利用」, counter_seats/seats_total/seats→「席」, payment_method→「支払い」, reservation→「予約」, silence→「静けさ」, first_timer→「初回」, clientele→「客層」。conflict の事実は使わない
    - `warnings: Array<{level:'danger'|'warn', text}>` — status が closed_temporarily/closed_permanently → danger「休業中／閉業の情報があります」、access が male_only/female_only/members_only/residents_only → warn「男性専用 の情報があります」等、renamed_to → warn「改称: <v>」。件数に関わらず必ず出す
    - `insight: {title, insight} | null` — grounded かつ official-provenance-v2 のときだけ

- [ ] **Step 1: テストを追加**

```js
const ENTRY = { checked: '2026-08-08', facts: [
  { k: 'price', v: 600, official: true, conflict: true, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/a.pdf'] },
  { k: 'price', v: 150, official: false, conflict: true, src: ['yuru-to.net'], urls: ['https://yuru-to.net/d'] },
  { k: 'hours', v: '10:00-21:00', official: true, conflict: false, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/'] },
  { k: 'bring_towel', v: 'rental', official: true, conflict: false, src: ['city.kuwana.lg.jp'], urls: ['https://www.city.kuwana.lg.jp/'] },
  { k: 'solo_ok', v: 'お一人様歓迎と明記', official: true, conflict: false, src: ['x.jp'], urls: ['https://x.jp/'] },
  { k: 'access', v: 'male_only', official: true, conflict: false, src: ['x.jp'], urls: ['https://x.jp/'] },
  { k: 'status', v: 'closed_temporarily', official: false, conflict: false, src: ['zatsu-ke.blog.jp'], urls: ['https://zatsu-ke.blog.jp/p'] },
  { k: 'solo_insight', v: { title: 'T', insight: 'I', quality: 'grounded', policyVersion: 'official-provenance-v2' }, official: true, conflict: false, src: ['x.jp'], urls: [] },
]};

check('summarizeCurated', () => {
  deq(mc.summarizeCurated(ENTRY), { checked: '2026-08-08', nFacts: 8, nOfficial: 6, nDomains: 4, nConflict: 2 });
});
check('groupFacts: 食い違いは両方並ぶ', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  const price = g.rows.find(r => r.k === 'price');
  eq(price.conflict, true); eq(price.values.length, 2);
  eq(price.values[0].text, '600円'); eq(price.values[0].domain, 'city.kuwana.lg.jp'); eq(price.values[0].official, true);
  eq(price.values[1].text, '150円'); eq(price.values[1].official, false);
  eq(g.rows[0].k, 'hours', 'hours が price より先');
});
check('groupFacts: 飲食ではタオル系を出さない', () => {
  eq(mc.groupFacts(ENTRY, 'bath').rows.some(r => r.k === 'bring_towel'), true);
  eq(mc.groupFacts(ENTRY, 'eat').rows.some(r => r.k === 'bring_towel'), false);
});
check('groupFacts: ひとり基準と警告と insight', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  eq(g.solo[0].label, '一人利用'); eq(g.solo[0].text, 'お一人様歓迎と明記');
  eq(g.warnings.some(w => w.level === 'danger' && w.text.includes('休業中')), true);
  eq(g.warnings.some(w => w.level === 'warn' && w.text.includes('男性専用')), true);
  deq(g.insight, { title: 'T', insight: 'I' });
  eq(g.rows.some(r => r.k === 'solo_insight'), false);
});
check('groupFacts: 個人訪問記ラベル', () => {
  const g = mc.groupFacts(ENTRY, 'bath');
  eq(g.rows.find(r => r.k === 'status').values[0].personal, true);
});
check('groupFacts: insight は grounded でなければ null', () => {
  const e = { checked: '', facts: [{ k: 'solo_insight', v: { title: 'T', insight: 'I', quality: 'draft', policyVersion: 'official-provenance-v2' }, official: true }] };
  eq(mc.groupFacts(e, 'eat').insight, null);
});
check('formatFactValue', () => {
  eq(mc.formatFactValue('payment_method', 'ticket_machine'), '券売機あり');
  eq(mc.formatFactValue('price', 600), '600円');
  eq(mc.formatFactValue('hours', '10:00-21:00'), '10:00-21:00');
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node tests/hitori_mapcore_test.mjs` → FAIL（`summarizeCurated is not a function`）

- [ ] **Step 3: 実装（map-core.js に追記）**

```js
// --- 確認済み事実の整形 ---
export const FACT_LABEL = {
  hours: '営業時間', opening_hours: '営業時間', closed_days: '定休日', price: '料金', payment_method: '支払い方法',
  counter_seats: 'カウンター席', counter_seating: 'カウンター席', seats_total: '座席数', seats: '席',
  bring_towel: 'タオル', towel: 'タオル', amenities: 'アメニティ', wash_area: '洗い場', facilities: '設備',
  unstaffed: '無人', access: '利用条件', conditions: '利用条件', solo_ok: '一人利用', silence: '静けさ',
  reservation: '予約', private_room: '個室・利用人数', first_timer: '初回利用', busy_time: '混雑の目安',
  parking: '駐車場', cuisine: '料理', luggage: '荷物', clientele: '客層', open_period: '営業期間',
  status: '営業状態', renamed_to: '改称', facility_identity: '施設名の確認', city: '所在地',
};
const VALUE_JA = {
  ticket_machine: '券売機あり', cash_only: '現金のみ', cashless_ok: 'キャッシュレス可', counter_person: 'レジで支払い',
  none: '予約不要', possible: '予約可', required: '要予約',
  public: '制限なし', residents_only: '住民限定', members_only: '会員制', male_only: '男性専用', female_only: '女性専用',
  open: '営業中', closed_temporarily: '休業中', closed_permanently: '閉業',
  posted: '黙浴の掲示あり', observed: '静か（訪問記）', local: '地元客中心', tourist: '観光客中心', solo_common: '一人客が多い',
  easy: '初めてでも迷わない', custom_exists: '独自の作法あり', yes: 'あり', no: 'なし', rental: '貸出あり', included: '料金に含む',
};
export const PERSONAL_DOMAINS = /zatsu-ke\.blog\.jp|sanukiudon-ranking\.com/;
const ROW_ORDER = ['hours', 'opening_hours', 'closed_days', 'price', 'payment_method', 'counter_seats', 'seats_total', 'seats',
  'reservation', 'access', 'parking', 'conditions', 'open_period'];
const HIDDEN_ROWS = new Set(['solo_insight', 'facility_identity', 'city']);
const BATH_ONLY = new Set(['bring_towel', 'towel', 'wash_area', 'amenities']);
const SOLO_KEYS = [['solo_ok', '一人利用'], ['counter_seats', '席'], ['seats_total', '席'], ['seats', '席'],
  ['payment_method', '支払い'], ['reservation', '予約'], ['silence', '静けさ'], ['first_timer', '初回'], ['clientele', '客層']];

export function formatFactValue(k, v) {
  if (k === 'price' && typeof v === 'number') return `${v.toLocaleString('ja-JP')}円`;
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return VALUE_JA[v] !== undefined ? VALUE_JA[v] : String(v);
}
function _domain(f) {
  const u = (f.urls && f.urls[0]) || '';
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return (f.src && f.src[0]) || ''; }
}
function _insightOf(f) {
  let v = f.v;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
  if (f.official && v && v.quality === 'grounded' && v.policyVersion === 'official-provenance-v2'
      && String(v.title || '').trim() && String(v.insight || '').trim()) return { title: v.title, insight: v.insight };
  return null;
}

export function summarizeCurated(entry) {
  const facts = (entry && entry.facts) || [];
  const domains = new Set();
  for (const f of facts) for (const d of (f.src || [])) domains.add(d);
  return { checked: (entry && entry.checked) || '', nFacts: facts.length,
    nOfficial: facts.filter(f => f.official).length, nDomains: domains.size,
    nConflict: facts.filter(f => f.conflict).length };
}

export function groupFacts(entry, displayCatKey) {
  const facts = (entry && entry.facts) || [];
  const byKey = new Map();
  let insight = null;
  const warnings = [], solo = [];
  for (const f of facts) {
    if (f.k === 'solo_insight') { insight = insight || _insightOf(f); continue; }
    if (HIDDEN_ROWS.has(f.k)) continue;
    if (displayCatKey !== 'bath' && BATH_ONLY.has(f.k)) continue;
    if (!byKey.has(f.k)) byKey.set(f.k, []);
    byKey.get(f.k).push(f);
  }
  const rows = [];
  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = ROW_ORDER.indexOf(a), ib = ROW_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  for (const k of keys) {
    const list = byKey.get(k);
    rows.push({ k, label: FACT_LABEL[k] || k, conflict: list.some(f => f.conflict),
      values: list.map(f => { const domain = _domain(f); return {
        text: formatFactValue(k, f.v), domain, url: (f.urls && f.urls[0]) || '',
        official: !!f.official, personal: PERSONAL_DOMAINS.test(domain) }; }) });
  }
  for (const f of facts) {
    if (f.conflict) continue;
    if (f.k === 'status' && (f.v === 'closed_temporarily' || f.v === 'closed_permanently'))
      warnings.push({ level: 'danger', text: `${VALUE_JA[f.v]}の情報があります（${_domain(f)}）` });
    if (f.k === 'access' && ['male_only', 'female_only', 'members_only', 'residents_only'].includes(f.v))
      warnings.push({ level: 'warn', text: `${VALUE_JA[f.v]} の情報があります（${_domain(f)}）` });
    if (f.k === 'renamed_to') warnings.push({ level: 'warn', text: `改称: ${f.v}` });
  }
  const seenSolo = new Set();
  for (const [k, label] of SOLO_KEYS) {
    const f = facts.find(x => x.k === k && !x.conflict);
    if (!f || seenSolo.has(label)) continue;
    seenSolo.add(label);
    solo.push({ label, text: formatFactValue(k, f.v), official: !!f.official });
  }
  return { rows, solo, warnings, insight };
}
```

- [ ] **Step 4: 成功を確認** — Run: `node tests/hitori_mapcore_test.mjs` → `OK: map-core`

- [ ] **Step 5: コミット**

```bash
git add assets/hitori/map-core.js tests/hitori_mapcore_test.mjs
git commit -m "feat(hitori): group verified facts so conflicting sources are shown side by side"
```

---

### Task 5: map-core.js — 順位付け・半径拡大・最寄り確認済み・場面

**Files:**
- Modify: `assets/hitori/map-core.js`
- Modify: `tests/hitori_mapcore_test.mjs`

**Interfaces:**
- Consumes: `haversineM` from core.js
- Produces:
  - `SCENES: Array<{key, label, cat: string|null, kinds: string[]|null, openNow: boolean}>` = bath_tonight「今夜、ひとりで銭湯」(cat bath, openNow), eat_quick「さっと一人飯」(cat eat, openNow), rain「雨の日に没頭」(cat null, kinds [library,museum,cinema,netcafe]), stay_tonight「今夜の宿」(cat stay)
  - `applyFilters(items, f, ctx): items` — `f = {q, cat, kinds, verifiedOnly, openNow, hideChain, gemOnly, radiusKm}`, `ctx = {checked: (id)=>boolean, now: Date, origin: {lat,lon}|null}`。距離は `it.distM`（呼び出し側で `withDistance` 済み）。`q` は name/city/kindJa(kind) の部分一致（小文字化）。`gemOnly` は `!chain && hidden>=.75 && hidden_n>=3`。`openNow` は `openLabel(it, null, now).state === 'open'` のみ通す（unknown は通さない。閉店確定を除くのが目的で、unknown を残すのは一覧の「営業時間は要確認」表示に任せる… ではなく、**openNow 指定時は open だけ**にする。仕様§4「判定できない施設は除外せず残す」は openNow 未指定時の既定の話）
  - `rankItems(items, ctx): items` — `ctx = {checked, origin}`。確認済み → 未確認の順。同じ層の中は origin があれば `distM` 昇順、無ければ 穴場候補→solo 降順→名前（ja locale）
  - `expandRadius(items, radiusKm, steps=[1,3,10,Infinity]): {items, radiusKm, expanded: boolean}` — `radiusKm` 以内が 0 件なら次の段へ。`Infinity` は無制限
  - `nearestChecked(items, lat, lon, checked): {item, distM} | null`
  - `isGem(it): boolean`

- [ ] **Step 1: テストを追加**

```js
const ITEMS = [
  { id: 'a', name: 'A', city: '横浜市', kind: 'ramen', cat: 'eat', chain: 0, hidden: .9, hidden_n: 4, solo: 5, distM: 900, oh: '24/7' },
  { id: 'b', name: 'B', city: '川崎市', kind: 'sento', cat: 'bath', chain: 0, hidden: 0, hidden_n: 2, solo: 4, distM: 100, oh: 'Mo-Su 11:00-21:00' },
  { id: 'c', name: 'C', city: '横浜市', kind: 'gyudon', cat: 'eat', chain: 1, hidden: 0, hidden_n: 9, solo: 5, distM: 5000, oh: '' },
  { id: 'd', name: 'D', city: '鎌倉市', kind: 'museum', cat: 'stay', chain: 0, hidden: 0, hidden_n: 0, solo: 5, distM: 300, oh: 'Tu-Su 09:00-17:00' },
];
const checked = id => id === 'c';
const NOW = new Date(2026, 7, 29, 12, 0); // 土

check('applyFilters: cat は表示カテゴリで判定', () => {
  deq(mc.applyFilters(ITEMS, { cat: 'quiet' }, { checked, now: NOW }).map(i => i.id), ['d']);
  deq(mc.applyFilters(ITEMS, { cat: 'stay' }, { checked, now: NOW }).map(i => i.id), []);
});
check('applyFilters: q は kind 日本語にも当たる', () => {
  deq(mc.applyFilters(ITEMS, { q: 'そば' }, { checked, now: NOW }).map(i => i.id), []);
  deq(mc.applyFilters(ITEMS, { q: 'ラーメン' }, { checked, now: NOW }).map(i => i.id), ['a']);
  deq(mc.applyFilters(ITEMS, { q: '川崎' }, { checked, now: NOW }).map(i => i.id), ['b']);
});
check('applyFilters: verifiedOnly / hideChain / gemOnly / openNow / radius', () => {
  deq(mc.applyFilters(ITEMS, { verifiedOnly: true }, { checked, now: NOW }).map(i => i.id), ['c']);
  deq(mc.applyFilters(ITEMS, { hideChain: true }, { checked, now: NOW }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { gemOnly: true }, { checked, now: NOW }).map(i => i.id), ['a']);
  deq(mc.applyFilters(ITEMS, { openNow: true }, { checked, now: NOW }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { radiusKm: 1 }, { checked, now: NOW, origin: { lat: 0, lon: 0 } }).map(i => i.id), ['a', 'b', 'd']);
  deq(mc.applyFilters(ITEMS, { kinds: ['museum', 'cinema'] }, { checked, now: NOW }).map(i => i.id), ['d']);
});
check('rankItems: 確認済みが最上位、あとは距離', () => {
  deq(mc.rankItems(ITEMS, { checked, origin: { lat: 0, lon: 0 } }).map(i => i.id), ['c', 'b', 'd', 'a']);
});
check('rankItems: 起点なしは 穴場→solo→名前', () => {
  deq(mc.rankItems(ITEMS, { checked, origin: null }).map(i => i.id), ['c', 'a', 'd', 'b']);
});
check('expandRadius: 0件なら次の段へ', () => {
  const far = [{ id: 'x', distM: 8000 }];
  const r = mc.expandRadius(far, 1);
  eq(r.radiusKm, 10); eq(r.expanded, true); eq(r.items.length, 1);
  const r2 = mc.expandRadius([{ id: 'y', distM: 500 }], 1);
  eq(r2.radiusKm, 1); eq(r2.expanded, false);
  eq(mc.expandRadius([], 1).radiusKm, Infinity);
});
check('nearestChecked', () => {
  const rows = [{ id: 'p', lat: 35.0, lon: 139.0 }, { id: 'q', lat: 35.1, lon: 139.0 }, { id: 'r', lat: 36.0, lon: 139.0 }];
  const r = mc.nearestChecked(rows, 35.09, 139.0, id => id === 'p' || id === 'r');
  eq(r.item.id, 'p');
  eq(mc.nearestChecked(rows, 35, 139, () => false), null);
});
check('SCENES', () => {
  eq(mc.SCENES.length, 4);
  eq(mc.SCENES.find(s => s.key === 'rain').kinds.includes('library'), true);
  eq(mc.SCENES.find(s => s.key === 'bath_tonight').openNow, true);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node tests/hitori_mapcore_test.mjs` → FAIL

- [ ] **Step 3: 実装（map-core.js に追記）**

```js
// --- 絞り込み・順位 ---
export const SCENES = [
  { key: 'bath_tonight', label: '今夜、ひとりで銭湯', cat: 'bath', kinds: null, openNow: true },
  { key: 'eat_quick', label: 'さっと一人飯', cat: 'eat', kinds: null, openNow: true },
  { key: 'rain', label: '雨の日に没頭', cat: null, kinds: ['library', 'museum', 'cinema', 'netcafe'], openNow: false },
  { key: 'stay_tonight', label: '今夜の宿', cat: 'stay', kinds: null, openNow: false },
];
export function isGem(it) { return !it.chain && Number(it.hidden) >= .75 && Number(it.hidden_n) >= 3; }

export function applyFilters(items, f, ctx) {
  const o = f || {}, c = ctx || {};
  const q = String(o.q || '').trim().toLowerCase();
  const kinds = o.kinds && o.kinds.length ? new Set(o.kinds) : null;
  return items.filter(it => {
    if (q && !`${it.name} ${it.city || ''} ${kindJa(it.kind)}`.toLowerCase().includes(q)) return false;
    if (o.cat && displayCat(it.kind, it.cat) !== o.cat) return false;
    if (kinds && !kinds.has(it.kind)) return false;
    if (o.verifiedOnly && !(c.checked && c.checked(it.id))) return false;
    if (o.hideChain && it.chain) return false;
    if (o.gemOnly && !isGem(it)) return false;
    if (o.openNow && openLabel(it, null, c.now || new Date()).state !== 'open') return false;
    if (o.radiusKm && c.origin && Number.isFinite(o.radiusKm) && it.distM > o.radiusKm * 1000) return false;
    return true;
  });
}

export function rankItems(items, ctx) {
  const c = ctx || {};
  const ck = it => (c.checked && c.checked(it.id)) ? 0 : 1;
  const byArea = (a, b) => (Number(isGem(b)) - Number(isGem(a))) || (Number(b.solo) - Number(a.solo))
    || String(a.name).localeCompare(String(b.name), 'ja');
  const byDist = (a, b) => (a.distM - b.distM) || byArea(a, b);
  return items.slice().sort((a, b) => (ck(a) - ck(b)) || (c.origin ? byDist(a, b) : byArea(a, b)));
}

export function expandRadius(items, radiusKm, steps = [1, 3, 10, Infinity]) {
  let i = Math.max(0, steps.indexOf(radiusKm));
  for (; i < steps.length; i++) {
    const r = steps[i];
    const hit = items.filter(it => !Number.isFinite(r) || it.distM <= r * 1000);
    if (hit.length || i === steps.length - 1) return { items: hit, radiusKm: r, expanded: r !== radiusKm };
  }
  return { items: [], radiusKm: Infinity, expanded: true };
}

export function nearestChecked(items, lat, lon, checked) {
  let best = null;
  for (const it of items) {
    if (!checked(it.id)) continue;
    const d = haversineM(lat, lon, Number(it.lat), Number(it.lon));
    if (!best || d < best.distM) best = { item: it, distM: d };
  }
  return best;
}
```

- [ ] **Step 4: 成功を確認** — Run: `node tests/hitori_mapcore_test.mjs` → `OK: map-core`

- [ ] **Step 5: コミット**

```bash
git add assets/hitori/map-core.js tests/hitori_mapcore_test.mjs
git commit -m "feat(hitori): rank verified places first and widen the radius instead of showing nothing"
```

---

### Task 6: map-core.js — 保存ストア v1 と共有URL

**Files:**
- Modify: `assets/hitori/map-core.js`
- Modify: `tests/hitori_mapcore_test.mjs`

**Interfaces:**
- Produces:
  - `SAVED_KEY = 'hitori.saved.v1'`
  - `loadSaved(storage): {want:{}, went:{}} | null`（getItem が throw → null。壊れた値 → 空）
  - `saveSaved(storage, data): boolean`
  - `toggleWant(data, item, pref): data`（新オブジェクトを返す。`{t, pref, name, lat, lon, kind}` を保存。lat/lon は保存ピン用）
  - `setWent(data, item, pref, {date, memo}): data` / `removeWent(data, id): data`
  - `savedCount(data): number`（want と went の和集合の件数）
  - `encodeSavedParam(data): string` → `14:n1,13:n2`（pref:id をカンマ区切り、want→went の順、重複なし）
  - `parseSavedParam(str): Array<{pref:number, id:string}>`（不正な要素は捨てる）
  - `facilityShareUrl(base, pref, id): string` → `${base}?pref=14&facility=n1`

- [ ] **Step 1: テストを追加**

```js
function memStorage(init) { const m = new Map(Object.entries(init || {})); return {
  getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
const IT = { id: 'n1', name: '浜虎', lat: 35.4, lon: 139.6, kind: 'ramen' };

check('loadSaved: 空・壊れ・throw', () => {
  deq(mc.loadSaved(memStorage()), { want: {}, went: {} });
  deq(mc.loadSaved(memStorage({ 'hitori.saved.v1': '{oops' })), { want: {}, went: {} });
  eq(mc.loadSaved({ getItem() { throw new Error('private'); } }), null);
});
check('toggleWant / setWent / removeWent / savedCount', () => {
  let d = { want: {}, went: {} };
  d = mc.toggleWant(d, IT, 14);
  eq(d.want.n1.pref, 14); eq(d.want.n1.name, '浜虎'); eq(d.want.n1.lat, 35.4);
  eq(mc.savedCount(d), 1);
  d = mc.setWent(d, IT, 14, { date: '2026-08-30', memo: '朝ラー' });
  eq(d.went.n1.memo, '朝ラー'); eq(mc.savedCount(d), 1, '同じ施設は1件と数える');
  d = mc.toggleWant(d, IT, 14);
  eq(d.want.n1, undefined); eq(mc.savedCount(d), 1);
  d = mc.removeWent(d, 'n1');
  eq(mc.savedCount(d), 0);
});
check('saveSaved は失敗を false で返す', () => {
  const s = memStorage();
  eq(mc.saveSaved(s, { want: {}, went: {} }), true);
  eq(mc.saveSaved({ setItem() { throw new Error('full'); } }, {}), false);
  deq(JSON.parse(s.getItem('hitori.saved.v1')), { want: {}, went: {} });
});
check('encode/parse saved param', () => {
  const d = { want: { n1: { pref: 14 }, n2: { pref: 13 } }, went: { n1: { pref: 14 }, n3: { pref: 1 } } };
  eq(mc.encodeSavedParam(d), '14:n1,13:n2,1:n3');
  deq(mc.parseSavedParam('14:n1,13:n2,bad,:x,7:'), [{ pref: 14, id: 'n1' }, { pref: 13, id: 'n2' }]);
  deq(mc.parseSavedParam(''), []);
});
check('facilityShareUrl', () => {
  eq(mc.facilityShareUrl('https://x.test/hitori.html', 14, 'n1'), 'https://x.test/hitori.html?pref=14&facility=n1');
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node tests/hitori_mapcore_test.mjs` → FAIL

- [ ] **Step 3: 実装（map-core.js に追記）**

```js
// --- 保存（行きたい／行った）。サーバーもアカウントも持たない ---
export const SAVED_KEY = 'hitori.saved.v1';
const EMPTY = () => ({ want: {}, went: {} });

export function loadSaved(storage) {
  let raw;
  try { raw = storage.getItem(SAVED_KEY); } catch (e) { return null; }
  if (!raw) return EMPTY();
  try {
    const v = JSON.parse(raw);
    return { want: (v && v.want) || {}, went: (v && v.went) || {} };
  } catch (e) { return EMPTY(); }
}
export function saveSaved(storage, data) {
  try { storage.setItem(SAVED_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
function _snap(item, pref) {
  return { t: Date.now(), pref: Number(pref), name: item.name, lat: Number(item.lat), lon: Number(item.lon), kind: item.kind };
}
export function toggleWant(data, item, pref) {
  const want = { ...data.want };
  if (want[item.id]) delete want[item.id]; else want[item.id] = _snap(item, pref);
  return { want, went: { ...data.went } };
}
export function setWent(data, item, pref, extra) {
  const went = { ...data.went, [item.id]: { ..._snap(item, pref), date: (extra && extra.date) || '', memo: (extra && extra.memo) || '' } };
  return { want: { ...data.want }, went };
}
export function removeWent(data, id) {
  const went = { ...data.went }; delete went[id];
  return { want: { ...data.want }, went };
}
export function savedCount(data) {
  return new Set([...Object.keys(data.want || {}), ...Object.keys(data.went || {})]).size;
}
export function encodeSavedParam(data) {
  const seen = new Set(), parts = [];
  for (const bucket of [data.want || {}, data.went || {}]) {
    for (const [id, v] of Object.entries(bucket)) {
      if (seen.has(id)) continue;
      seen.add(id); parts.push(`${v.pref}:${id}`);
    }
  }
  return parts.join(',');
}
export function parseSavedParam(str) {
  const out = [];
  for (const part of String(str || '').split(',')) {
    const m = part.match(/^(\d{1,2}):([A-Za-z]\d+)$/);
    if (m) out.push({ pref: Number(m[1]), id: m[2] });
  }
  return out;
}
export function facilityShareUrl(base, pref, id) {
  return `${base}?pref=${encodeURIComponent(pref)}&facility=${encodeURIComponent(id)}`;
}
```

- [ ] **Step 4: 成功を確認** — Run: `node tests/hitori_mapcore_test.mjs` → `OK: map-core`

- [ ] **Step 5: コミット**

```bash
git add assets/hitori/map-core.js tests/hitori_mapcore_test.mjs
git commit -m "feat(hitori): want/went store in localstorage with a shareable query form"
```

---

### Task 7: 旅記事リンク表と旧テストの向き直し

**Files:**
- Create: `data/hitori/journal_links.json`
- Modify: `tests/hitori_render_test.py:13`（`BASE = f"http://127.0.0.1:{PORT}/hitori.html"` → `hitori-legacy.html`）

**Interfaces:**
- Produces: `journal_links.json` = `{ "<prefCode>": [{"title": "...", "url": "hitoritabi/journey-xxx.html"}] }`

- [ ] **Step 1: 旅記事の都道府県を本文で確かめて表を書く**

各 journey ページの本文を読んで都道府県を確定した結果（2026-08-29 に本文の地名頻度で判定。`zoo`・`keiryu` は県が特定できないので入れない）:

```json
{
  "2":  [{"title": "雨の北東北、緑の余韻", "url": "hitoritabi/journey-tohoku.html"}],
  "4":  [{"title": "松島、半日の海", "url": "hitoritabi/journey-matsushima.html"}],
  "10": [{"title": "湯畑の音、夜と朝のあいだ", "url": "hitoritabi/journey-kusatsu.html"}],
  "13": [{"title": "東京近郊、海辺と夜景の散歩", "url": "hitoritabi/journey-tokyo.html"}],
  "14": [{"title": "冬の海、光のさざなみ", "url": "hitoritabi/journey-kamakura.html"},
         {"title": "年末の三崎、海をひとつ", "url": "hitoritabi/journey-miura.html"},
         {"title": "東京近郊、海辺と夜景の散歩", "url": "hitoritabi/journey-tokyo.html"}],
  "22": [{"title": "二月、いちばん早い春へ", "url": "hitoritabi/journey-izu.html"}],
  "29": [{"title": "祈りと庭、年の瀬の山陽", "url": "hitoritabi/journey-hiroshima.html"}],
  "33": [{"title": "祈りと庭、年の瀬の山陽", "url": "hitoritabi/journey-hiroshima.html"}],
  "34": [{"title": "祈りと庭、年の瀬の山陽", "url": "hitoritabi/journey-hiroshima.html"}],
  "36": [{"title": "渦と藍、四国の余白", "url": "hitoritabi/journey-shikoku.html"}],
  "37": [{"title": "渦と藍、四国の余白", "url": "hitoritabi/journey-shikoku.html"}],
  "43": [{"title": "湯けむりと阿蘇、湯布院の朝", "url": "hitoritabi/journey-beppu.html"}],
  "44": [{"title": "湯けむりと阿蘇、湯布院の朝", "url": "hitoritabi/journey-beppu.html"}],
  "46": [{"title": "緑のなかで呼吸を忘れる", "url": "hitoritabi/journey-yakushima.html"}]
}
```

- [ ] **Step 2: URL が実在することを機械で確認**

Run: `PYTHONUTF8=1 python -c "import json,os;d=json.load(open('data/hitori/journal_links.json',encoding='utf-8'));miss=[e['url'] for v in d.values() for e in v if not os.path.exists(e['url'])];print('missing',miss);assert not miss"`
Expected: `missing []`

- [ ] **Step 3: 旧テストを旧版に向ける**

`tests/hitori_render_test.py` の `BASE` を `f"http://127.0.0.1:{PORT}/hitori-legacy.html"` に変更。docstring 1行目も `hitori-legacy.html の描画検証。` に。

- [ ] **Step 4: コミット**

```bash
git add data/hitori/journal_links.json tests/hitori_render_test.py
git commit -m "chore(hitori): map prefectures to solo-travel journal pages; point legacy render test at legacy page"
```

---

### Task 8: hitori.html の骨格・シート・エリアモード（一覧まで）

**Files:**
- Rewrite: `hitori.html`（現行を全面置換。head の title/description/canonical/og:url/fonts/GoatCounter は維持）
- Create: `assets/hitori/app.js`
- Create: `tests/hitori_map_test.py`
- Modify: `tests/hitori_all.py`（TESTS の末尾 `"hitori_render_test.py"` の直後に `"hitori_map_test.py"` を追加）

**Interfaces:**
- Consumes: `data/hitori/index.json`（Task 1）、`data/hitori/pref/NN.json`（既存）、`core.rowsToObjects`、map-core（Task 2〜6）
- Produces（app.js 内の状態。後続タスクが触る名前）:
  - `state = { index, rows, prefLoaded:Set<number>, curatedByPref:Map<number,object>, origin:{lat,lon,label}|null, filters:{q,cat,kinds,verifiedOnly,openNow,hideChain,gemOnly,radiusKm}, current:item|null, saved, sheet:'home'|'list'|'detail'|'saved'|'about', snap:'peek'|'half'|'full' }`
  - 関数: `setSheet(mode)`, `setSnap(snap)`, `loadPref(code): Promise<void>`（rows に追加、重複 id は入れない）, `loadCurated(code): Promise<object>`, `isChecked(id): boolean`（index.checked にあるか）, `render()`（一覧＋地図）, `renderMarkers(view)`, `track(name)`（GoatCounter）, `window.__ready = true`（初期描画後に立てる。テストが待つ）
  - DOM id: `#map`, `#sheet`, `#sheet-handle`, `#sheet-body`, `#q`, `#pref`, `#btn-locate`, `#btn-area`, `#chips`（カテゴリ）, `#tog-open`, `#tog-verified`, `#tog-chain`, `#list`, `#count`, `#btn-saved`, `#btn-menu`, `#scenes`, `#btn-research`（この範囲で再検索）

- [ ] **Step 1: E2E テスト（先に書く）**

```python
# tests/hitori_map_test.py
# -*- coding: utf-8 -*-
"""新 hitori.html の描画検証。ローカルHTTPで配信して Playwright で確認する。
file:// では ES Modules と fetch が落ちるので必ず HTTP。
pytest-playwright は入っていないので、hitori_render_test.py と同じく main() が順に呼ぶ。
実行: PYTHONUTF8=1 python tests/hitori_map_test.py
"""
import sys, threading, functools, http.server, socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8898
BASE = f"http://127.0.0.1:{PORT}/hitori.html"
SHOTS = ROOT / "tests" / "screens"
SHOTS.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


MOBILE = {"width": 390, "height": 844}
DESKTOP = {"width": 1400, "height": 900}


def _ready(page):
    page.wait_for_function("window.__ready === true", timeout=30000)


def test_home_states_the_claim_and_two_ways_in(page):
    page.set_viewport_size(MOBILE)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    _ready(page)
    body = page.inner_text("#sheet")
    assert "ひとりで入れるか、根拠つきで。" in body
    assert "確認済み" in body and "817" in body.replace(",", "")
    assert page.is_visible("#btn-locate") and page.is_visible("#btn-area")
    assert page.locator("#scenes button").count() == 4
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"横スクロール {overflow}px"
    assert not errors, errors
    page.screenshot(path=str(SHOTS / "hitori-mobile-home.png"))


def test_area_mode_lists_verified_first_without_score_dots(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.click("#btn-area")
    page.select_option("#pref", "14")
    page.wait_for_selector("#list .card", timeout=30000)
    cards = page.locator("#list .card")
    assert cards.count() >= 10
    first = cards.nth(0).inner_text()
    assert "確認済み" in first, f"先頭が確認済みでない: {first}"
    assert page.locator("#list .dots").count() == 0, "未確認に推定スコアの点線が出ている"
    assert page.locator("#list .card.unverified").count() > 0
    assert "候補" in page.locator("#list .card.unverified").first.inner_text()
    page.screenshot(path=str(SHOTS / "hitori-mobile-list.png"))


def test_category_chip_quiet_shows_museums_not_hostels(page):
    page.set_viewport_size(DESKTOP)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.click("#chips [data-cat='quiet']")
    page.wait_for_timeout(300)
    kinds = page.eval_on_selector_all("#list .card .kind", "els => els.map(e => e.textContent)")
    assert kinds and all(k in ("図書館", "博物館・美術館") for k in kinds), kinds
    page.click("#chips [data-cat='stay']")
    page.wait_for_timeout(300)
    kinds = page.eval_on_selector_all("#list .card .kind", "els => els.map(e => e.textContent)")
    assert kinds and all(k == "ホステル" for k in kinds), kinds
    page.screenshot(path=str(SHOTS / "hitori-desktop-list.png"))


def test_sheet_snaps(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    h_half = page.evaluate("document.getElementById('sheet').getBoundingClientRect().top")
    page.click("#sheet-handle")
    page.wait_for_timeout(400)
    h_full = page.evaluate("document.getElementById('sheet').getBoundingClientRect().top")
    assert h_full < h_half, "ハンドルを押してもシートが上がらない"


# テストごとに新しい context を作る（localStorage と位置情報の許可を持ち越さない）。
# 後続タスクでテスト関数を足したら、このリストにも足す。
TESTS = [
    test_home_states_the_claim_and_two_ways_in,
    test_area_mode_lists_verified_first_without_score_dots,
    test_category_chip_quiet_shows_museums_not_hostels,
    test_sheet_snaps,
]


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    failed = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for fn in TESTS:
                context = browser.new_context(viewport=MOBILE)
                page = context.new_page()
                try:
                    params = fn.__code__.co_varnames[:fn.__code__.co_argcount]
                    fn(**{k: {"page": page, "context": context, "browser": browser}[k] for k in params})
                    print("ok", fn.__name__)
                except Exception as e:  # 1件落ちても残りを回す
                    failed.append(fn.__name__)
                    print("FAIL", fn.__name__, repr(e))
                finally:
                    context.close()
            browser.close()
    finally:
        httpd.shutdown()
    if failed:
        print(f"{len(failed)} failed: {failed}")
        sys.exit(1)
    print(f"OK: hitori map ({len(TESTS)} tests) -> {SHOTS}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_map_test.py`
Expected: FAIL（`window.__ready` のタイムアウト。現行ページには無い）

- [ ] **Step 3: hitori.html を書く**

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="description" content="ひとりで入れるかを、根拠つきで。全国40,615施設から、公式情報で確認済みの店・銭湯・図書館を現在地や駅名から探せる一人歓迎マップ。" />
  <link rel="canonical" href="https://yuichi916.github.io/hitori.html">
  <meta property="og:url" content="https://yuichi916.github.io/hitori.html">
  <meta property="og:title" content="ひとり歓迎マップ | ひとりで入れるか、根拠つきで。">
  <title>ひとり歓迎マップ | 全国のソロ活スポット検索</title>
  <link rel="icon" href="favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="//gc.zgo.at/count.js" integrity="sha384-2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi" crossorigin="anonymous"></script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"ひとり歓迎マップ","url":"https://yuichi916.github.io/hitori.html","applicationCategory":"TravelApplication","operatingSystem":"Web","description":"ひとりで入れるかを根拠つきで示す、全国のソロ活スポット地図","offers":{"@type":"Offer","price":"0","priceCurrency":"JPY"}}</script>
  <style>
    :root { --paper:#faf7f1; --white:#fffdfa; --ink:#2c2723; --muted:#756b64; --line:#e8ded4; --accent:#ad5039; --accent-pale:#f4e7dd; --sage:#276b60; --sage-pale:#e8f3ef; --gold:#f5c24a; --danger:#b3261e; --header:52px; --ease:cubic-bezier(.2,.7,.3,1); }
    * { box-sizing:border-box; } html,body { height:100%; margin:0; overflow:hidden; background:var(--paper); color:var(--ink); font-family:"Noto Sans JP",system-ui,sans-serif; font-size:14px; line-height:1.6; }
    button,input,select,textarea { font:inherit; color:inherit; } button { cursor:pointer; }
    :focus-visible { outline:3px solid #f7e4dc; outline-offset:2px; }
    @media (prefers-reduced-motion:reduce) { * { transition:none !important; animation:none !important; } }
    header { position:fixed; inset:0 0 auto 0; height:var(--header); z-index:30; display:flex; align-items:center; gap:10px; padding:0 10px 0 12px; background:rgba(255,253,250,.94); border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    .brand { display:flex; align-items:center; gap:8px; text-decoration:none; color:inherit; min-width:0; flex:1; }
    .brand .mark { display:grid; place-items:center; width:30px; height:30px; border-radius:9px; background:var(--accent); color:#fff; font-family:"Noto Serif JP",serif; font-size:16px; }
    .brand strong { font-family:"Noto Serif JP",serif; font-size:15px; letter-spacing:-.02em; white-space:nowrap; }
    .brand small { display:block; color:var(--muted); font-size:10px; line-height:1.2; }
    .hbtn { min-width:44px; height:40px; padding:0 10px; border:1px solid var(--line); border-radius:999px; background:#fff; font-weight:700; font-size:13px; }
    .hbtn[aria-pressed="true"] { border-color:#d39c88; background:#fff3ed; }
    #map { position:fixed; inset:var(--header) 0 0 0; z-index:1; background:#e9ecef; }
    .leaflet-container { font-family:inherit; }
    .leaflet-control-attribution { font-size:10px; }
    .pin { display:grid; place-items:center; width:26px; height:26px; border:3px solid #fffdfa; border-radius:50%; color:#fff; background:var(--accent); box-shadow:0 3px 10px rgba(57,36,24,.3); font-size:11px; font-weight:700; }
    .pin.selected { width:38px; height:38px; background:#713422; outline:4px solid var(--gold); font-size:13px; }
    .pin.saved { background:var(--sage); }
    .origin-dot { width:16px; height:16px; border:3px solid #fff; border-radius:50%; background:#1f6feb; box-shadow:0 0 0 6px rgba(31,111,235,.2); }
    /* ボトムシート */
    #sheet { position:fixed; left:0; right:0; bottom:0; z-index:20; height:calc(100% - var(--header)); background:var(--white); border-radius:18px 18px 0 0; box-shadow:0 -8px 30px rgba(76,47,28,.16); transform:translateY(72%); transition:transform .28s var(--ease); display:flex; flex-direction:column; touch-action:none; }
    #sheet[data-snap="peek"] { transform:translateY(72%); } #sheet[data-snap="half"] { transform:translateY(45%); } #sheet[data-snap="full"] { transform:translateY(0); }
    #sheet-handle { flex:none; height:28px; display:grid; place-items:center; border:0; background:none; width:100%; }
    #sheet-handle i { width:40px; height:5px; border-radius:5px; background:#d9cfc4; }
    #sheet-body { flex:1; overflow:auto; padding:0 14px 90px; touch-action:pan-y; -webkit-overflow-scrolling:touch; }
    .rebtn { position:absolute; top:-46px; left:50%; transform:translateX(-50%); height:36px; padding:0 14px; border:1px solid var(--line); border-radius:999px; background:#fff; font-weight:700; font-size:12px; box-shadow:0 4px 14px rgba(57,36,24,.15); display:none; }
    .rebtn.show { display:block; }
    /* home */
    .claim { margin:6px 0 2px; font-family:"Noto Serif JP",serif; font-size:24px; line-height:1.3; letter-spacing:-.03em; }
    .claim em { font-style:normal; color:var(--accent); }
    .lede { margin:0 0 12px; color:var(--muted); font-size:12.5px; }
    .lede b { color:var(--sage); }
    .ways { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .way { min-height:56px; border:1px solid var(--line); border-radius:14px; background:#fff; font-weight:700; font-size:14px; }
    .way.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .scenes { display:flex; flex-wrap:wrap; gap:7px; margin:14px 0 6px; }
    .scenes button { min-height:40px; padding:0 12px; border:1px solid #ead8cc; border-radius:999px; background:#fffaf4; color:#8d4734; font-weight:700; font-size:12.5px; }
    .sec-label { margin:16px 0 6px; color:#9b4934; font-size:10.5px; font-weight:700; letter-spacing:.14em; }
    /* list */
    .search { position:relative; margin:4px 0 8px; }
    .search input { width:100%; min-height:44px; padding:0 12px 0 36px; border:1px solid var(--line); border-radius:12px; background:#fff; outline:none; }
    .search input:focus { border-color:#c98d79; box-shadow:0 0 0 3px #f7e4dc; }
    .search .icon { position:absolute; left:12px; top:11px; color:#9b928b; }
    .suggest { position:absolute; left:0; right:0; top:46px; z-index:5; margin:0; padding:4px; list-style:none; background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 25px rgba(57,36,24,.14); display:none; }
    .suggest.show { display:block; } .suggest li button { width:100%; min-height:44px; text-align:left; padding:0 10px; border:0; background:none; border-radius:8px; } .suggest li button:hover { background:#f7f2ec; }
    .suggest small { color:var(--muted); margin-left:6px; }
    .row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px; }
    .tog { min-height:36px; padding:0 11px; border:1px solid var(--line); border-radius:999px; background:#fff; font-size:12px; font-weight:700; color:#625955; }
    .tog[aria-pressed="true"] { border-color:#b85b43; color:#8f4938; background:#fff3ed; }
    select.tog { padding:0 8px; }
    .chips { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none; } .chips::-webkit-scrollbar { display:none; }
    .chip { flex:none; min-height:36px; padding:0 12px; border:0; border-radius:999px; background:#f5f0ea; color:#6f655f; font-size:12.5px; font-weight:700; }
    .chip[aria-pressed="true"] { background:var(--accent); color:#fff; }
    .origin-line { margin:6px 0 4px; color:var(--muted); font-size:12px; } .origin-line b { color:var(--ink); }
    .count { margin:8px 0; color:var(--muted); font-size:12px; } .count b { color:var(--ink); }
    .notice { margin:8px 0; padding:10px 12px; border:1px dashed #d9cec4; border-radius:12px; color:#6f655f; font-size:12.5px; }
    .notice.err { color:var(--danger); border-color:#e7b7b3; }
    .card { display:block; width:100%; margin-bottom:8px; padding:12px; border:1px solid var(--line); border-radius:14px; background:#fff; text-align:left; transition:border-color .15s, transform .15s; }
    .card:hover,.card.selected { border-color:#d39c88; transform:translateY(-1px); }
    .card.unverified { background:#fcfaf6; border-style:dashed; }
    .card .top { display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:11px; }
    .card .vmark { color:var(--sage); font-weight:700; } .card .cand { color:#9a8f86; font-weight:700; }
    .card h3 { margin:4px 0 2px; font-family:"Noto Serif JP",serif; font-size:16px; line-height:1.3; display:flex; gap:8px; align-items:baseline; }
    .card h3 .num { flex:none; display:inline-grid; place-items:center; min-width:22px; height:22px; border-radius:50%; background:var(--accent); color:#fff; font-size:11px; font-family:"Noto Sans JP",sans-serif; }
    .card.unverified h3 .num { background:#b9ada3; }
    .card .meta { color:var(--muted); font-size:12px; display:flex; flex-wrap:wrap; gap:4px 10px; }
    .card .meta .open { color:var(--sage); font-weight:700; } .card .meta .closed { color:#9a6b1d; }
    .card .facts { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
    .card .facts span { padding:3px 8px; border-radius:999px; background:var(--sage-pale); color:var(--sage); font-size:11px; font-weight:700; }
    .card .facts span.chain { background:#efefee; color:#65615d; } .card .facts span.gem { background:var(--accent-pale); color:#954631; }
    .card .fit { margin-top:6px; color:#8a7f77; font-size:11.5px; }
    .heart { flex:none; width:40px; height:40px; border:1px solid var(--line); border-radius:50%; background:#fff; font-size:16px; color:#b08a7c; }
    .heart[aria-pressed="true"] { background:#fff3ed; border-color:#d39c88; color:var(--accent); }
    .more { width:100%; min-height:44px; border:1px dashed #d9cec4; border-radius:12px; background:none; color:var(--muted); }
    .skel { height:84px; margin-bottom:8px; border-radius:14px; background:linear-gradient(90deg,#f3ede6,#faf7f1,#f3ede6); background-size:200% 100%; animation:sk 1.2s infinite; } @keyframes sk { to { background-position:-200% 0; } }
    /* desktop */
    @media (min-width:900px) {
      #map { inset:var(--header) 0 0 420px; }
      #sheet { top:var(--header); bottom:0; left:0; right:auto; width:420px; height:auto; border-radius:0; box-shadow:4px 0 24px rgba(76,47,28,.08); transform:none !important; border-right:1px solid var(--line); }
      #sheet-handle { display:none; } #sheet-body { padding:12px 16px 40px; }
      .rebtn { top:auto; bottom:18px; left:calc(420px + (100% - 420px) / 2); }
    }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="./hitori.html"><span class="mark">ひ</span><span><strong>ひとり歓迎マップ</strong><small>ひとりで入れるか、根拠つきで</small></span></a>
    <button class="hbtn" id="btn-saved" type="button" aria-label="保存した施設">♡ <span id="saved-count">0</span></button>
    <button class="hbtn" id="btn-menu" type="button" aria-label="このマップについて">≡</button>
  </header>
  <div id="map" role="region" aria-label="地図"></div>
  <button class="rebtn" id="btn-research" type="button">この範囲で再検索</button>
  <section id="sheet" data-snap="peek" aria-label="検索と一覧">
    <button id="sheet-handle" type="button" aria-label="シートを広げる"><i></i></button>
    <div id="sheet-body"></div>
  </section>
  <noscript><p style="position:fixed;inset:60px 16px auto;z-index:50;padding:12px;background:#fff;border:1px solid #e8ded4;border-radius:12px">この地図は JavaScript で動きます。<a href="./hitori-legacy.html">旧版</a>もご利用ください。</p></noscript>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script type="module" src="assets/hitori/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: app.js を書く（このタスク分: 読み込み・home・エリア一覧・地図・シート）**

```js
// assets/hitori/app.js
// 画面の状態と DOM・Leaflet・fetch。判断（順位・営業中・事実の整形）は map-core.js に置き、ここでは呼ぶだけ。
import * as core from './core.js';
import * as mc from './map-core.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GSI_TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a> | 施設: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>';
const PAGE = 100;

export const state = {
  index: null, rows: [], prefLoaded: new Set(), curatedByPref: new Map(), byId: new Map(),
  origin: null, filters: { q: '', cat: '', kinds: null, verifiedOnly: false, openNow: false, hideChain: false, gemOnly: false, radiusKm: 3 },
  current: null, saved: null, sheet: 'home', snap: 'peek', shown: PAGE, pref: 14, notice: '', loading: false,
};
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
state.saved = storage ? mc.loadSaved(storage) : null;

export function track(name) {
  try { window.goatcounter && window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) {}
}

// --- 地図 ---
let map = null, canvas = null, layerCand = null, layerPin = null, originMarker = null, moved = false;
function initMap() {
  if (!window.L) { $('map').innerHTML = '<p style="padding:20px;color:#756b64">地図を読み込めませんでした。一覧からお探しください。</p>'; return; }
  map = L.map('map', { zoomControl: false, attributionControl: true }).setView([35.45, 139.63], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(GSI_TILE, { maxZoom: 18, attribution: ATTR }).addTo(map);
  canvas = L.canvas({ padding: .5 });
  layerCand = L.layerGroup().addTo(map);
  layerPin = L.layerGroup().addTo(map);
  map.on('movestart', () => { if (state.sheet === 'list') { moved = true; $('btn-research').classList.add('show'); } });
}
export function renderMarkers(view) {
  if (!map) return;
  layerCand.clearLayers(); layerPin.clearLayers();
  const bounds = [];
  view.forEach((r, i) => {
    const ll = [Number(r.lat), Number(r.lon)];
    if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return;
    bounds.push(ll);
    const checked = isChecked(r.id), selected = state.current && state.current.id === r.id;
    const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
    if (!checked && !selected && !saved) {
      L.circleMarker(ll, { renderer: canvas, radius: 5, color: '#fff', weight: 1.5, fillColor: '#b9ada3', fillOpacity: .85 })
        .on('click', () => select(r)).addTo(layerCand);
      return;
    }
    const icon = L.divIcon({ className: '', html: `<div class="pin ${selected ? 'selected' : ''} ${saved && !selected ? 'saved' : ''}">${i + 1}</div>`,
      iconSize: selected ? [38, 38] : [26, 26], iconAnchor: selected ? [19, 19] : [13, 13] });
    L.marker(ll, { icon, zIndexOffset: selected ? 1000 : checked ? 500 : 0 }).bindTooltip(esc(r.name), { direction: 'top', offset: [0, -14] })
      .on('click', () => select(r)).addTo(layerPin);
  });
  if (originMarker) originMarker.remove();
  if (state.origin) originMarker = L.marker([state.origin.lat, state.origin.lon], { icon: L.divIcon({ className: '', html: '<div class="origin-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
  if (state.current) map.setView([Number(state.current.lat), Number(state.current.lon)], Math.max(map.getZoom(), 15), { animate: true });
  else if (!moved && bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  else if (!moved && bounds.length === 1) map.setView(bounds[0], 14);
}

// --- データ ---
const rev = `${Date.now().toString(36)}`;
const loadJson = path => fetch(`${path}?v=${rev}`).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
export function isChecked(id) { return !!(state.index && state.index.checked[id]); }
export async function loadPref(code) {
  code = Number(code);
  if (state.prefLoaded.has(code)) return;
  const doc = await loadJson(`data/hitori/pref/${String(code).padStart(2, '0')}.json`);
  for (const r of core.rowsToObjects(doc)) { if (!state.byId.has(r.id)) { r.pref = code; state.byId.set(r.id, r); state.rows.push(r); } }
  state.prefLoaded.add(code);
}
export async function loadCurated(code) {
  code = Number(code);
  if (!state.curatedByPref.has(code)) state.curatedByPref.set(code, await loadJson(`data/hitori/curated/${String(code).padStart(2, '0')}.json`));
  return state.curatedByPref.get(code);
}
function resetRows() { state.rows = []; state.byId = new Map(); state.prefLoaded = new Set(); state.current = null; state.shown = PAGE; moved = false; }

// --- シート ---
export function setSnap(snap) { state.snap = snap; $('sheet').dataset.snap = snap; }
export function setSheet(mode) { state.sheet = mode; render(); }
function bindSheetDrag() {
  const sheet = $('sheet'), handle = $('sheet-handle');
  let startY = null, startSnap = null;
  handle.addEventListener('click', () => setSnap(state.snap === 'full' ? 'half' : 'full'));
  sheet.addEventListener('pointerdown', e => { if (e.target.closest('#sheet-body') && $('sheet-body').scrollTop > 0) return; startY = e.clientY; startSnap = state.snap; });
  sheet.addEventListener('pointerup', e => {
    if (startY === null) return;
    const dy = e.clientY - startY; startY = null;
    if (Math.abs(dy) < 40) return;
    const order = ['peek', 'half', 'full']; let i = order.indexOf(startSnap);
    i = dy < 0 ? Math.min(2, i + 1) : Math.max(0, i - 1);
    setSnap(order[i]);
  });
}

// --- 描画 ---
function viewRows() {
  const ctx = { checked: isChecked, now: new Date(), origin: state.origin };
  let rows = state.rows;
  if (state.origin) rows = core.withDistance(rows, state.origin.lat, state.origin.lon);
  let list = mc.applyFilters(rows, { ...state.filters, radiusKm: 0 }, ctx);
  let radiusNote = '';
  if (state.origin) {
    const ex = mc.expandRadius(list, state.filters.radiusKm);
    list = ex.items;
    if (ex.expanded) radiusNote = Number.isFinite(ex.radiusKm) ? `${state.filters.radiusKm}km 以内に該当がないため ${ex.radiusKm}km に広げました` : `半径を制限せずに表示しています`;
  }
  return { list: mc.rankItems(list, ctx), radiusNote };
}
function cardHtml(r, i) {
  const checked = isChecked(r.id), meta = checked ? state.index.checked[r.id] : null;
  const cur = checked ? (state.curatedByPref.get(meta[0]) || {})[r.id] : null;
  const g = cur ? mc.groupFacts(cur, mc.displayCat(r.kind, r.cat)) : null;
  const hoursFact = cur ? (cur.facts || []).find(f => (f.k === 'hours' || f.k === 'opening_hours') && !f.conflict) : null;
  const open = mc.openLabel(r, hoursFact, new Date());
  const dist = state.origin && Number.isFinite(r.distM) ? (r.distM < 1000 ? `${Math.max(10, Math.round(r.distM / 10) * 10)}m` : `${(r.distM / 1000).toFixed(r.distM < 10000 ? 1 : 0)}km`) : '';
  const chips = [];
  if (g) for (const s of g.solo.slice(0, 3)) chips.push(`<span>${esc(s.text)}</span>`);
  if (g) { const cd = g.rows.find(x => x.k === 'closed_days'); if (cd && chips.length < 4) chips.push(`<span>${esc(cd.values[0].text)}</span>`); }
  if (mc.isGem(r)) chips.push('<span class="gem">穴場候補</span>');
  if (r.chain) chips.push('<span class="chain">チェーン</span>');
  const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
  return `<article class="card ${checked ? '' : 'unverified'} ${state.current && state.current.id === r.id ? 'selected' : ''}" data-id="${esc(r.id)}">
    <div class="top">${checked ? `<span class="vmark">✓ 確認済み ${esc(meta[5])} · 公式${meta[2]}</span>` : '<span class="cand">候補 · OSM由来</span>'}
      <button class="heart" type="button" data-want="${esc(r.id)}" aria-pressed="${saved ? 'true' : 'false'}" aria-label="行きたい">♡</button></div>
    <h3><span class="num">${i + 1}</span><button type="button" class="open-detail" data-id="${esc(r.id)}" style="all:unset;cursor:pointer">${esc(r.name)}</button></h3>
    <div class="meta"><span class="kind">${esc(mc.kindJa(r.kind))}</span>${r.city ? `<span>${esc(r.city)}</span>` : ''}${dist ? `<span>${dist}</span>` : ''}<span class="${open.state}">${esc(open.text)}</span></div>
    ${chips.length ? `<div class="facts">${chips.join('')}</div>` : ''}
    ${!checked && mc.fitNote(r.kind) ? `<div class="fit">業態の見立て: ${esc(mc.fitNote(r.kind))}</div>` : ''}
  </article>`;
}
function homeHtml() {
  const idx = state.index;
  return `<h1 class="claim">ひとりで入れるか、<br><em>根拠つきで。</em></h1>
    <p class="lede"><b>確認済み ${idx.checked_count.toLocaleString()}件</b>は公式情報で裏を取り、出典URLを添えています。全国 ${idx.total.toLocaleString()}施設。</p>
    <div class="ways"><button class="way primary" id="btn-locate" type="button">◎ 現在地から探す</button><button class="way" id="btn-area" type="button">エリアを選んで探す</button></div>
    <p class="sec-label">いまの気分から</p>
    <div class="scenes" id="scenes">${mc.SCENES.map(s => `<button type="button" data-scene="${s.key}">${esc(s.label)}</button>`).join('')}</div>
    <p class="notice" id="home-notice" style="display:${state.notice ? 'block' : 'none'}">${esc(state.notice)}</p>`;
}
function listHtml() {
  const { list, radiusNote } = viewRows();
  const f = state.filters, idx = state.index;
  const prefOpts = idx.prefectures.map(p => `<option value="${p.code}" ${p.code === state.pref ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const nVerified = list.filter(r => isChecked(r.id)).length;
  const view = list.slice(0, state.shown);
  let empty = '';
  if (!state.loading && !list.length) {
    const near = state.origin ? mc.nearestChecked(state.rows, state.origin.lat, state.origin.lon, isChecked) : null;
    empty = `<p class="notice">条件に合う施設がありません。${near ? `このエリアはまだ調査前です。最寄りの確認済み: <button type="button" class="open-detail" data-id="${esc(near.item.id)}" style="all:unset;cursor:pointer;color:#8d4734;font-weight:700">${esc(near.item.name)}</button>（約${(near.distM / 1000).toFixed(1)}km）` : '条件を緩めてお試しください。'}</p>`;
  }
  return `<div class="search"><span class="icon">⌕</span><input id="q" type="search" placeholder="施設名・駅名・地名" value="${esc(f.q)}" autocomplete="off"><ul class="suggest" id="suggest"></ul></div>
    <div class="row"><button class="tog" id="btn-locate" type="button" aria-pressed="${state.origin && state.origin.kind === 'geo' ? 'true' : 'false'}">◎ 現在地</button>
      <select class="tog" id="pref" aria-label="都道府県">${prefOpts}</select>
      <button class="tog" id="tog-open" type="button" aria-pressed="${f.openNow}">いま営業中</button>
      <button class="tog" id="tog-verified" type="button" aria-pressed="${f.verifiedOnly}">確認済みのみ</button>
      <button class="tog" id="tog-chain" type="button" aria-pressed="${f.hideChain}">チェーンを隠す</button>
      ${state.origin ? `<select class="tog" id="radius" aria-label="半径"><option value="1" ${f.radiusKm === 1 ? 'selected' : ''}>1km</option><option value="3" ${f.radiusKm === 3 ? 'selected' : ''}>3km</option><option value="10" ${f.radiusKm === 10 ? 'selected' : ''}>10km</option><option value="Infinity" ${!Number.isFinite(f.radiusKm) ? 'selected' : ''}>制限なし</option></select>` : ''}
      <button class="tog" id="btn-reset" type="button">リセット</button></div>
    <div class="chips" id="chips"><button class="chip" data-cat="" aria-pressed="${!f.cat && !f.kinds}">すべて</button>${mc.DISPLAY_CATS.map(c => `<button class="chip" data-cat="${c.key}" aria-pressed="${f.cat === c.key}">${c.label}</button>`).join('')}</div>
    ${state.origin ? `<p class="origin-line"><b>${esc(state.origin.label)}</b> から近い順</p>` : ''}
    ${radiusNote ? `<p class="notice">${esc(radiusNote)}</p>` : ''}
    ${state.notice ? `<p class="notice err">${esc(state.notice)}</p>` : ''}
    <p class="count" id="count">確認済み <b>${nVerified}</b>件 · 候補 <b>${list.length - nVerified}</b>件</p>
    <div id="list">${state.loading ? '<div class="skel"></div><div class="skel"></div><div class="skel"></div>' : (view.map(cardHtml).join('') + empty)}</div>
    ${list.length > state.shown ? '<button class="more" id="btn-more" type="button">もっと見る</button>' : ''}`;
}
export function render() {
  const body = $('sheet-body');
  if (!state.index) { body.innerHTML = '<div class="skel"></div>'; return; }
  if (state.sheet === 'home') body.innerHTML = homeHtml();
  else if (state.sheet === 'list') body.innerHTML = listHtml();
  else if (state.sheet === 'detail') body.innerHTML = detailHtml();
  else if (state.sheet === 'saved') body.innerHTML = savedHtml();
  else if (state.sheet === 'about') body.innerHTML = aboutHtml();
  $('saved-count').textContent = state.saved ? mc.savedCount(state.saved) : 0;
  bindBody();
  if (state.sheet === 'list' || state.sheet === 'detail') renderMarkers(viewRows().list.slice(0, state.shown));
  else if (state.sheet === 'saved') renderMarkers(savedRows());
  else renderMarkers([]);
}
// Task 9/10/11 で実装する。ここでは空を返しておく。
let detailHtml = () => '', savedHtml = () => '', aboutHtml = () => '', savedRows = () => [];
export function setRenderers(r) { if (r.detailHtml) detailHtml = r.detailHtml; if (r.savedHtml) savedHtml = r.savedHtml; if (r.aboutHtml) aboutHtml = r.aboutHtml; if (r.savedRows) savedRows = r.savedRows; }

// --- 操作 ---
export async function useArea(code) {
  state.pref = Number(code); state.origin = null; state.notice = ''; resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try { await loadPref(state.pref); await loadCurated(state.pref); } catch (e) { state.notice = `データを読み込めませんでした（${e.message}）`; }
  state.loading = false; moved = false; render();
  location.hash = `pref=${state.pref}`;
}
export async function useOrigin(lat, lon, label, kind) {
  state.origin = { lat, lon, label, kind }; state.notice = ''; resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try {
    const geo = await loadJson('data/hitori/prefectures_svg.json');
    const code = core.prefectureAt(lat, lon, geo);
    state.pref = code;
    await loadPref(code); await loadCurated(code);
    state.loading = false; render();
    const nb = await loadJson('data/hitori/neighbors.json');
    await Promise.all((nb[String(code)] || []).map(async c => { await loadPref(c); await loadCurated(c); }));
  } catch (e) { state.notice = `データを読み込めませんでした（${e.message}）`; }
  state.loading = false; render();
}
function locate() {
  if (!navigator.geolocation) { state.notice = 'このブラウザーでは現在地を取得できません。エリアを選んでお探しください。'; render(); return; }
  state.notice = '現在地を取得しています…'; render();
  navigator.geolocation.getCurrentPosition(p => { track('hitori.locate'); useOrigin(p.coords.latitude, p.coords.longitude, '現在地', 'geo'); },
    err => { const m = { 1: '現在地の利用が許可されませんでした。エリアか駅名でお探しください。', 2: '現在地を取得できませんでした。', 3: '現在地の取得が時間切れになりました。' }; state.notice = m[err.code] || '現在地を取得できませんでした。'; render(); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}
export function select(r) { if (!r) return; state.current = r; state.sheet = 'detail'; track('hitori.detail'); render(); setSnap('half'); }
let places = null;
async function suggest(q) {
  const ul = $('suggest'); if (!ul) return;
  if (!q || q.length < 1) { ul.classList.remove('show'); return; }
  if (!places) { try { places = core.rowsToObjects(await loadJson('data/hitori/places.json')); } catch (e) { return; } }
  const hits = core.searchPlaces(places, q, 6);
  ul.innerHTML = hits.map((p, i) => `<li><button type="button" data-place="${i}">${esc(p.name)}<small>${p.type === 's' ? '駅' : '市区町村'}</small></button></li>`).join('');
  ul.classList.toggle('show', hits.length > 0);
  ul.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { const p = hits[Number(b.dataset.place)]; state.filters.q = ''; useOrigin(p.lat, p.lon, `${p.name}${p.type === 's' ? '駅' : ''}`, 'place'); }));
}
function bindBody() {
  const body = $('sheet-body');
  const on = (sel, ev, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
  on('#btn-locate', 'click', locate);
  on('#btn-area', 'click', () => useArea(state.pref));
  on('#pref', 'change', e => useArea(e.target.value));
  on('[data-scene]', 'click', e => { const s = mc.SCENES.find(x => x.key === e.currentTarget.dataset.scene); state.filters.cat = s.cat || ''; state.filters.kinds = s.kinds; state.filters.openNow = s.openNow; if (navigator.geolocation) locate(); else useArea(state.pref); });
  on('#q', 'input', e => { state.filters.q = e.target.value; suggest(e.target.value.trim()); refreshList(); });
  on('#tog-open', 'click', () => { state.filters.openNow = !state.filters.openNow; render(); });
  on('#tog-verified', 'click', () => { state.filters.verifiedOnly = !state.filters.verifiedOnly; render(); });
  on('#tog-chain', 'click', () => { state.filters.hideChain = !state.filters.hideChain; render(); });
  on('#radius', 'change', e => { state.filters.radiusKm = Number(e.target.value); render(); });
  on('#btn-reset', 'click', () => { state.filters = { q: '', cat: '', kinds: null, verifiedOnly: false, openNow: false, hideChain: false, gemOnly: false, radiusKm: 3 }; state.current = null; render(); });
  on('#chips [data-cat]', 'click', e => { state.filters.cat = e.currentTarget.dataset.cat; state.filters.kinds = null; state.shown = PAGE; render(); });
  on('#btn-more', 'click', () => { state.shown += PAGE; render(); });
  // 距離つきの複製（viewRows）を優先して渡す。byId の元オブジェクトには distM が無い。
  on('.open-detail', 'click', e => { const id = e.currentTarget.dataset.id; select(viewRows().list.find(x => x.id === id) || state.byId.get(id)); });
  on('[data-want]', 'click', e => { e.stopPropagation(); toggleWant(state.byId.get(e.currentTarget.dataset.want)); });
}
function refreshList() {
  // 入力のたびにシート全体を作り直すと input のフォーカスが飛ぶ。一覧と件数だけ差し替える。
  const { list } = viewRows(); const nV = list.filter(r => isChecked(r.id)).length;
  $('count').innerHTML = `確認済み <b>${nV}</b>件 · 候補 <b>${list.length - nV}</b>件`;
  $('list').innerHTML = list.slice(0, state.shown).map(cardHtml).join('');
  bindBody(); renderMarkers(list.slice(0, state.shown));
}
export function toggleWant(r) {
  if (!r || !state.saved || !storage) { state.notice = 'この端末では保存できません。'; render(); return; }
  state.saved = mc.toggleWant(state.saved, r, r.pref); mc.saveSaved(storage, state.saved); track('hitori.save'); render();
}

// --- 起動 ---
async function boot() {
  initMap(); bindSheetDrag();
  $('btn-saved').addEventListener('click', () => { state.sheet = 'saved'; render(); setSnap('half'); });
  $('btn-menu').addEventListener('click', () => { state.sheet = 'about'; render(); setSnap('full'); });
  $('btn-research').addEventListener('click', () => { moved = false; $('btn-research').classList.remove('show'); const b = map.getBounds(); const c = b.getCenter(); useOrigin(c.lat, c.lng, '地図の中心', 'map'); });
  try { state.index = await loadJson('data/hitori/index.json'); } catch (e) { $('sheet-body').innerHTML = `<p class="notice err">データを読み込めませんでした（${esc(e.message)}）<br><button class="tog" type="button" onclick="location.reload()">再読み込み</button></p>`; return; }
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('facility') && params.get('pref')) { await useArea(params.get('pref')); const r = state.byId.get(params.get('facility')); if (r) select(r); else { state.notice = 'この施設は現在掲載していません。'; render(); } }
  else if (params.get('saved')) { await restoreShared(params.get('saved')); }
  else if (hash.get('pref')) await useArea(hash.get('pref'));
  else render();
  window.__ready = true;
}
let restoreShared = async () => {};   // Task 10 で差し替える
export function setRestoreShared(fn) { restoreShared = fn; }
// boot() は必ずファイルの最後の行に置く。Task 9〜11 の追記はこの行より前に挿入する
// （setRenderers が初回 render より先に走ることを、評価順で保証するため）。
boot();
```

- [ ] **Step 5: テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_map_test.py`
Expected: `OK: hitori map (4 tests)`。`tests/screens/hitori-mobile-home.png` / `hitori-mobile-list.png` / `hitori-desktop-list.png` を Read で目視し、①ヘッダーと地図とシートが重ならず ②カードに点線スコアが無く ③先頭が確認済み であることを確認する。

- [ ] **Step 6: 重複宣言チェックとコミット**

Run: `python C:/tmp/check_dup_const.py assets/hitori/app.js` → exit 0

```bash
git add hitori.html assets/hitori/app.js tests/hitori_map_test.py tests/hitori_all.py
git commit -m "feat(hitori): rebuild the map as a full-screen map with a bottom sheet, verified places first"
```

---

### Task 9: 詳細シート（確認のしるし・ひとり基準・食い違い・アクション・旅記事）

**Files:**
- Modify: `assets/hitori/app.js`（`detailHtml` を実装し `setRenderers` で差し込む。同ファイル末尾に追記）
- Modify: `tests/hitori_map_test.py`

**Interfaces:**
- Consumes: `mc.groupFacts`, `mc.summarizeCurated`, `mc.openLabel`, `mc.facilityShareUrl`, `data/hitori/journal_links.json`
- Produces: DOM: `#detail`, `.verified-box`, `.solo-box`, `.fact-row`, `.conflict`, `#btn-back`, `#btn-route`, `#btn-went`, `#went-form`, `#btn-share`, `#btn-report`, `.journal`

- [ ] **Step 1: テストを追加**

```python
def test_detail_shows_provenance_and_conflicts(page):
    page.set_viewport_size(DESKTOP)
    # 桑名の銭湯: 料金が公式200円と非公式150円で食い違う既知の例
    page.goto(BASE + "?pref=24&facility=n10011494817")
    _ready(page)
    page.wait_for_selector("#detail", timeout=30000)
    txt = page.inner_text("#detail")
    assert "確認済み" in txt and "公式" in txt and "食い違い" in txt
    assert page.locator("#detail .fact-row.conflict").count() >= 1
    assert page.locator("#detail .fact-row.conflict .val").count() >= 2, "食い違いの値が両方出ていない"
    assert "city.kuwana.lg.jp" in txt
    href = page.get_attribute("#btn-route", "href")
    assert href.startswith("https://www.google.com/maps/dir/?api=1&destination=")
    assert page.is_visible("#btn-back")
    page.screenshot(path=str(SHOTS / "hitori-desktop-detail.png"), full_page=False)


def test_detail_of_unverified_says_so_and_has_no_scores(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card.unverified", timeout=30000)
    page.locator("#list .card.unverified .open-detail").first.click()
    page.wait_for_selector("#detail", timeout=10000)
    txt = page.inner_text("#detail")
    assert "未確認" in txt and "OpenStreetMap" in txt
    assert "ひとり度" not in txt
    assert page.locator("#detail .journal").count() == 1, "神奈川には旅記事があるはず"
    page.screenshot(path=str(SHOTS / "hitori-mobile-detail.png"))
```

追加した2関数を `TESTS` リストの末尾にも足す。

- [ ] **Step 2: 失敗を確認** — Run: `PYTHONUTF8=1 python tests/hitori_map_test.py` → `FAIL test_detail_shows_provenance_and_conflicts`（`#detail` が無い）

- [ ] **Step 3: 実装（app.js 末尾に追記）**

```js
// --- 詳細 ---
let journal = null;
loadJson('data/hitori/journal_links.json').then(j => { journal = j; }).catch(() => { journal = {}; });

function detailHtmlImpl() {
  const r = state.current; if (!r) return '';
  const meta = isChecked(r.id) ? state.index.checked[r.id] : null;
  const cur = meta ? (state.curatedByPref.get(meta[0]) || {})[r.id] : null;
  const cat = mc.displayCat(r.kind, r.cat);
  const g = cur ? mc.groupFacts(cur, cat) : null;
  const s = cur ? mc.summarizeCurated(cur) : null;
  const hoursFact = cur ? (cur.facts || []).find(f => (f.k === 'hours' || f.k === 'opening_hours') && !f.conflict) : null;
  const open = mc.openLabel(r, hoursFact, new Date());
  const base = `${location.origin}${location.pathname}`;
  const url = mc.facilityShareUrl(base, r.pref, r.id);
  const saved = state.saved || { want: {}, went: {} };
  const went = saved.went[r.id];
  const dist = state.origin && Number.isFinite(r.distM) ? `${(r.distM / 1000).toFixed(1)}km` : '';
  const jl = journal && journal[String(r.pref)];
  const reportText = `@ViewsEngineer ひとり歓迎マップの「${r.name}」の情報が違います：\n（何がどう違うか）\n${url}`;
  return `<div id="detail">
    <button class="tog" id="btn-back" type="button">‹ 一覧へ</button>
    ${g && g.warnings.length ? g.warnings.map(w => `<p class="notice ${w.level === 'danger' ? 'err' : ''}">${w.level === 'danger' ? '⚠ ' : ''}${esc(w.text)}</p>`).join('') : ''}
    <h2 style="margin:10px 0 2px;font-family:'Noto Serif JP',serif;font-size:22px;line-height:1.3">${esc(r.name)}</h2>
    <div class="meta" style="color:var(--muted);font-size:12.5px">${esc(mc.kindJa(r.kind))}${r.city ? ` · ${esc(r.city)}` : ''}${dist ? ` · ${dist}` : ''} · <span class="${open.state}">${esc(open.text)}</span>${open.source ? `<small>（${esc(open.source)}）</small>` : ''}</div>
    ${s ? `<section class="verified-box" style="margin:12px 0;padding:10px 12px;border-radius:12px;background:var(--sage-pale);color:var(--sage);font-size:12.5px"><b>✓ 確認済み ${esc(s.checked)}</b> · 事実 ${s.nFacts}件 · 公式ソース ${s.nOfficial} · 出典ドメイン ${s.nDomains} · 食い違い ${s.nConflict}</section>`
        : `<section class="verified-box" style="margin:12px 0;padding:10px 12px;border-radius:12px;background:#f5f0ea;color:#6f655f;font-size:12.5px"><b>未確認</b> — OpenStreetMap の登録情報のみです。利用前に公式情報をご確認ください。${mc.fitNote(r.kind) ? `<br>業態の見立て: ${esc(mc.fitNote(r.kind))}` : ''}</section>`}
    ${g && g.solo.length ? `<section class="solo-box" style="margin:12px 0;padding:12px;border:1px solid #ead8cc;border-radius:12px;background:#fffaf4"><p class="sec-label" style="margin:0 0 6px">ひとり基準</p>${g.solo.map(x => `<div style="display:flex;gap:8px;font-size:13px;margin:3px 0"><b style="flex:none;width:64px;color:#8d4734">${esc(x.label)}</b><span>${esc(x.text)}${x.official ? ' <small style="color:var(--sage)">公式</small>' : ''}</span></div>`).join('')}</section>` : ''}
    ${g && g.insight ? `<section style="margin:12px 0;padding:12px;border-radius:12px;background:#fffaf4;border:1px solid #ead8cc"><p class="sec-label" style="margin:0 0 4px">一人マップのひとこと</p><b style="font-size:13px">${esc(g.insight.title)}</b><p style="margin:4px 0 0;font-size:12.5px;color:#675c55">${esc(g.insight.insight)}</p></section>` : ''}
    ${g && g.rows.length ? `<section style="margin:12px 0"><p class="sec-label">確認した事実</p>${g.rows.map(row => `<div class="fact-row ${row.conflict ? 'conflict' : ''}" style="padding:8px 10px;margin-bottom:6px;border-radius:10px;background:#f8f5ef;font-size:12.5px"><b style="display:block;color:#635a54;font-size:11px">${esc(row.label)}${row.conflict ? ' <span style="color:#9a6b1d">⚠ 出典で食い違い</span>' : ''}</b>${row.values.map(v => `<div class="val">${esc(v.text)} <small style="color:var(--muted)">← ${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noreferrer" style="color:#8d4734">${esc(v.domain)}</a>` : esc(v.domain)}${v.official ? '（公式）' : ''}${v.personal ? '（個人訪問記）' : ''}</small></div>`).join('')}</div>`).join('')}</section>` : ''}
    <div class="row" style="margin-top:14px">
      <button class="tog" type="button" data-want="${esc(r.id)}" aria-pressed="${saved.want[r.id] ? 'true' : 'false'}">♡ 行きたい</button>
      <button class="tog" id="btn-went" type="button" aria-pressed="${went ? 'true' : 'false'}">✓ 行った${went && went.date ? ` ${esc(went.date)}` : ''}</button>
      <a class="tog" id="btn-route" href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">経路</a>
      ${r.web ? `<a class="tog" href="${esc(r.web)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">公式サイト</a>` : ''}
      <button class="tog" id="btn-share" type="button">共有</button>
      <a class="tog" id="btn-report" href="https://x.com/intent/post?text=${encodeURIComponent(reportText)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">情報が違う</a>
    </div>
    <form id="went-form" style="display:none;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff">
      <label style="font-size:12px">日付 <input type="date" name="date" value="${esc(went ? went.date : new Date().toISOString().slice(0, 10))}" style="min-height:40px;border:1px solid var(--line);border-radius:8px;padding:0 8px"></label>
      <label style="display:block;font-size:12px;margin-top:6px">ひとこと <input type="text" name="memo" maxlength="80" value="${esc(went ? went.memo : '')}" placeholder="任意" style="width:100%;min-height:40px;border:1px solid var(--line);border-radius:8px;padding:0 8px"></label>
      <div class="row" style="margin-top:8px"><button class="tog" type="submit">保存</button>${went ? '<button class="tog" type="button" id="btn-unwent">記録を消す</button>' : ''}</div>
    </form>
    ${jl && jl.length ? `<section class="journal" style="margin:16px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff"><p class="sec-label" style="margin:0 0 4px">この土地の一人旅</p>${jl.map(j => `<a href="${esc(j.url)}" style="display:block;color:#8d4734;font-weight:700;font-size:13px;text-decoration:none;margin:4px 0">${esc(j.title)} →</a>`).join('')}</section>` : ''}
  </div>`;
}
function bindDetail() {
  const body = $('sheet-body'); const r = state.current; if (!r || !$('detail')) return;
  $('btn-back').addEventListener('click', () => { state.current = null; state.sheet = 'list'; render(); });
  $('btn-route').addEventListener('click', () => track('hitori.route'));
  $('btn-went').addEventListener('click', () => { const f = $('went-form'); f.style.display = f.style.display === 'none' ? 'block' : 'none'; });
  $('went-form').addEventListener('submit', e => {
    e.preventDefault(); if (!state.saved || !storage) { state.notice = 'この端末では保存できません。'; render(); return; }
    const fd = new FormData(e.target);
    state.saved = mc.setWent(state.saved, r, r.pref, { date: fd.get('date'), memo: fd.get('memo') }); mc.saveSaved(storage, state.saved); track('hitori.save'); render();
  });
  const un = $('btn-unwent'); if (un) un.addEventListener('click', () => { state.saved = mc.removeWent(state.saved, r.id); mc.saveSaved(storage, state.saved); render(); });
  $('btn-share').addEventListener('click', async e => {
    const url = mc.facilityShareUrl(`${location.origin}${location.pathname}`, r.pref, r.id);
    const text = `ひとりで行きやすい行き先: 「${r.name}」${r.city ? `（${r.city}）` : ''} — 根拠つきの利用情報はこちら`;
    if (navigator.share) { try { await navigator.share({ title: `${r.name} | ひとり歓迎マップ`, text, url }); return; } catch (err) {} }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); e.currentTarget.textContent = 'コピーしました'; } catch (err) { window.prompt('リンクをコピーしてください', url); }
  });
}
setRenderers({ detailHtml: detailHtmlImpl });
```

`render()` の `bindBody()` の直後に `if (state.sheet === 'detail') bindDetail();` を追加する。

- [ ] **Step 4: テスト実行** — Run: `PYTHONUTF8=1 python tests/hitori_map_test.py` → `OK: hitori map (6 tests)`。`hitori-desktop-detail.png`・`hitori-mobile-detail.png` を目視。

- [ ] **Step 5: コミット**

Run: `python C:/tmp/check_dup_const.py assets/hitori/app.js` → exit 0

```bash
git add assets/hitori/app.js tests/hitori_map_test.py
git commit -m "feat(hitori): detail sheet with provenance, solo criteria, side-by-side conflicting sources"
```

---

### Task 10: 保存シートと共有URLの復元

**Files:**
- Modify: `assets/hitori/app.js`（`savedHtml` / `savedRows` / `restoreShared` を実装）
- Modify: `tests/hitori_map_test.py`

**Interfaces:**
- Consumes: `mc.encodeSavedParam`, `mc.parseSavedParam`, `loadPref`
- Produces: DOM `#saved`, `#saved-tabs [data-tab=want|went]`, `#btn-share-saved`, `#btn-back`

- [ ] **Step 1: テストを追加**

```python
def test_save_want_then_share_and_restore_on_fresh_context(browser):
    ctx = browser.new_context(viewport=MOBILE)
    page = ctx.new_page()
    page.goto(BASE + "#pref=14")
    _ready(page)
    page.wait_for_selector("#list .card", timeout=30000)
    page.locator("#list .card [data-want]").first.click()
    assert page.inner_text("#saved-count") == "1"
    page.click("#btn-saved")
    page.wait_for_selector("#saved", timeout=5000)
    assert page.locator("#saved .card").count() == 1
    share_url = page.evaluate("document.getElementById('btn-share-saved').dataset.url")
    assert "?saved=14:" in share_url
    page.screenshot(path=str(SHOTS / "hitori-mobile-saved.png"))
    ctx.close()
    # 別端末を模す: 新しいコンテキスト（localStorage 空）で共有URLを開く
    ctx2 = browser.new_context(viewport=MOBILE)
    p2 = ctx2.new_page()
    p2.goto(share_url)
    _ready(p2)
    p2.wait_for_selector("#saved .card", timeout=30000)
    assert p2.locator("#saved .card").count() == 1
    assert "共有されたリスト" in p2.inner_text("#saved")
    ctx2.close()
```

追加した関数を `TESTS` リストの末尾にも足す（`browser` 引数は main() が渡す）。

- [ ] **Step 2: 失敗を確認** — Run: `PYTHONUTF8=1 python tests/hitori_map_test.py` → `FAIL test_save_want_then_share_and_restore_on_fresh_context`

- [ ] **Step 3: 実装（app.js 末尾に追記）**

```js
// --- 保存シート ---
let savedTab = 'want', sharedList = null;   // sharedList: 共有URLで開いたときの [{pref,id}]
function savedRowsImpl() {
  const s = state.saved || { want: {}, went: {} };
  const src = sharedList ? sharedList.map(x => x.id) : Object.keys(savedTab === 'want' ? s.want : s.went);
  return src.map(id => state.byId.get(id) || (s.want[id] || s.went[id] ? { id, ...(s.want[id] || s.went[id]) } : null)).filter(Boolean);
}
function savedHtmlImpl() {
  const s = state.saved || { want: {}, went: {} };
  const rows = savedRowsImpl();
  const base = `${location.origin}${location.pathname}`;
  const shareUrl = `${base}?saved=${mc.encodeSavedParam(s)}`;
  return `<div id="saved">
    <div class="row"><button class="tog" id="btn-back" type="button">‹ 戻る</button>
      ${sharedList ? '<b style="font-size:13px">共有されたリスト</b>' : `<div id="saved-tabs" class="row" style="margin:0"><button class="tog" data-tab="want" aria-pressed="${savedTab === 'want'}">行きたい ${Object.keys(s.want).length}</button><button class="tog" data-tab="went" aria-pressed="${savedTab === 'went'}">行った ${Object.keys(s.went).length}</button></div>`}</div>
    ${!state.saved ? '<p class="notice err">この端末では保存できません（ブラウザーの設定で保存領域が使えません）。</p>' : ''}
    ${rows.length ? rows.map((r, i) => cardHtml(r, i)).join('') : '<p class="notice">まだありません。施設の ♡ で「行きたい」に追加できます。</p>'}
    ${!sharedList && mc.savedCount(s) ? `<button class="tog" id="btn-share-saved" type="button" data-url="${esc(shareUrl)}">このリストの共有URLをコピー</button>` : ''}
    ${sharedList ? `<button class="tog" id="btn-adopt" type="button">自分の「行きたい」に取り込む</button>` : ''}
  </div>`;
}
function bindSaved() {
  if (!$('saved')) return;
  $('btn-back').addEventListener('click', () => { sharedList = null; state.sheet = state.rows.length ? 'list' : 'home'; render(); });
  document.querySelectorAll('#saved-tabs [data-tab]').forEach(b => b.addEventListener('click', () => { savedTab = b.dataset.tab; render(); }));
  const sh = $('btn-share-saved'); if (sh) sh.addEventListener('click', async e => { try { await navigator.clipboard.writeText(sh.dataset.url); e.currentTarget.textContent = 'コピーしました'; } catch (err) { window.prompt('URLをコピーしてください', sh.dataset.url); } });
  const ad = $('btn-adopt'); if (ad) ad.addEventListener('click', () => { if (!state.saved || !storage) return; for (const r of savedRowsImpl()) if (!state.saved.want[r.id]) state.saved = mc.toggleWant(state.saved, r, r.pref); mc.saveSaved(storage, state.saved); sharedList = null; render(); });
}
async function restoreSharedImpl(param) {
  const list = mc.parseSavedParam(param);
  sharedList = list; state.sheet = 'saved'; state.loading = true; render(); setSnap('half');
  try { await Promise.all([...new Set(list.map(x => x.pref))].map(loadPref)); } catch (e) { state.notice = `データを読み込めませんでした（${e.message}）`; }
  sharedList = list.filter(x => state.byId.has(x.id));
  if (sharedList.length < list.length) state.notice = `${list.length - sharedList.length}件は現在掲載していません。`;
  state.loading = false; render();
}
setRenderers({ savedHtml: savedHtmlImpl, savedRows: savedRowsImpl });
setRestoreShared(restoreSharedImpl);
```

`render()` の `bindBody()` の直後に `if (state.sheet === 'saved') bindSaved();` を追加する。

- [ ] **Step 4: テスト実行** — Run: `PYTHONUTF8=1 python tests/hitori_map_test.py` → `OK: hitori map (7 tests)`

- [ ] **Step 5: コミット**

```bash
git add assets/hitori/app.js tests/hitori_map_test.py
git commit -m "feat(hitori): want/went lists with a shareable url that restores on another device"
```

---

### Task 11: about シート・メニュー・現在地E2E・最終検証

**Files:**
- Modify: `assets/hitori/app.js`（`aboutHtml`）
- Modify: `tests/hitori_map_test.py`
- Modify: `sitemap.xml`（`hitori.html` の `<lastmod>` を今日に。無ければ追加しない）

**Interfaces:**
- Consumes: `state.index.prefectures[].checked` / `.count`
- Produces: DOM `#about`, `.roadmap`, `#btn-request`（X intent）, 「ひとりぶんの棚」「作り方」「一人旅ジャーナル」「森の小屋」へのリンク

- [ ] **Step 1: テストを追加**

```python
TOKYO = {"latitude": 35.6812, "longitude": 139.7671}


def test_locate_sorts_by_distance_and_tracks(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.evaluate("window.__events=[]; window.goatcounter={count:e=>window.__events.push(e.path)}")
    page.click("#btn-locate")
    page.wait_for_selector("#list .card", timeout=40000)
    assert "現在地" in page.inner_text(".origin-line")
    dists = page.eval_on_selector_all("#list .card:not(.unverified) .meta", "els => els.map(e => e.textContent)")
    assert dists, "確認済みが先頭に無い"
    assert "hitori.locate" in page.evaluate("window.__events")
    page.locator("#list .card .open-detail").first.click()
    page.wait_for_selector("#detail")
    assert "hitori.detail" in page.evaluate("window.__events")
    page.screenshot(path=str(SHOTS / "hitori-mobile-locate.png"))


def test_about_sheet_keeps_provenance_and_site_links(page):
    page.set_viewport_size(MOBILE)
    page.goto(BASE)
    _ready(page)
    page.click("#btn-menu")
    page.wait_for_selector("#about")
    txt = page.inner_text("#about")
    for needle in ["OpenStreetMap", "国土地理院", "食い違い", "ひとりぶんの棚", "この地図の作り方", "一人旅ジャーナル", "載せてほしい"]:
        assert needle in txt, needle
    assert page.locator("#about .roadmap li").count() == 47
    assert page.locator(".homeback").count() == 0 and page.locator(".nextstrip").count() == 0
    page.screenshot(path=str(SHOTS / "hitori-mobile-about.png"), full_page=False)
```

追加した2関数を `TESTS` リストの末尾にも足す。

- [ ] **Step 2: 失敗を確認** — Run: `PYTHONUTF8=1 python tests/hitori_map_test.py` → `FAIL test_about_sheet_keeps_provenance_and_site_links`（`#about` が無い）

- [ ] **Step 3: 実装（app.js 末尾に追記）**

```js
// --- このマップについて ---
const REQ_TEXT = '@ViewsEngineer ひとり歓迎マップに載せてほしい店があります：\n店名・エリア：\nひとりで入りやすいと思う理由：';
function aboutHtmlImpl() {
  const idx = state.index;
  const prefs = idx.prefectures.slice().sort((a, b) => b.checked - a.checked);
  return `<div id="about">
    <button class="tog" id="btn-back" type="button">‹ 戻る</button>
    <h2 style="margin:12px 0 4px;font-family:'Noto Serif JP',serif;font-size:20px">情報を、曖昧なままおすすめしない。</h2>
    <p style="font-size:13px;color:#655b55">「ひとりで入れるか」を一本の軸にして、全国 ${idx.total.toLocaleString()} 施設を並べ直した地図です。${idx.checked_count.toLocaleString()} 件は公式情報などで裏を取り、出典URLを添えています。</p>
    <p class="sec-label">三つの決めごと</p>
    <ol style="padding-left:18px;font-size:13px;color:#655b55"><li>店の自己申告に頼らず、観測できる属性（業態・席・営業形態・チェーンか）から組み立てる</li><li>混雑は測れないので、周辺に同業が少ない独立店を「穴場候補」として代理指標にする</li><li>事実には出典・URL・公式かどうかを必ず添え、出典同士の<b>食い違いは消さずに両方見せる</b></li></ol>
    <p><a href="method/hitori-kijun.html" style="color:#8d4734;font-weight:700">この地図の作り方（ひとり基準）→</a></p>
    <p class="sec-label">載っていない店を見つけたら</p>
    <a class="tog" id="btn-request" href="https://x.com/intent/post?text=${encodeURIComponent(REQ_TEXT)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none;background:var(--accent);color:#fff;border-color:var(--accent)">この店を載せてほしい（Xで送る）</a>
    <p style="font-size:12px;color:var(--muted)">確認できたものから、根拠つきで追加していきます。</p>
    <p class="sec-label">都道府県別の確認済み件数</p>
    <ul class="roadmap" style="columns:2;padding-left:18px;font-size:12px;color:#655b55">${prefs.map(p => `<li>${esc(p.name)} <b>${p.checked}</b> / ${p.count.toLocaleString()}</li>`).join('')}</ul>
    <p class="sec-label">出典</p>
    <p style="font-size:12px;color:var(--muted)">施設データ: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors / ODbL</a> ／ 地図タイル: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a> ／ 人口: Wikidata (CC0)・令和2年国勢調査 ／ 確認済み情報は各施設に個別出典を表示 ／ <a href="./hitori-legacy.html">旧版</a></p>
    <p class="sec-label">次はこちら</p>
    <a href="hitoritabi/" style="display:block;color:#8d4734;font-weight:700;text-decoration:none;margin:4px 0">一人旅ジャーナル — 実際に行った32本 →</a>
    <a href="cabin.html" style="display:block;color:#8d4734;font-weight:700;text-decoration:none;margin:4px 0">森の小屋 — 出かけられない日のための、行かなくていい場所 →</a>
    <a href="./" style="display:block;color:#8d4734;font-weight:700;text-decoration:none;margin:12px 0">← ひとりぶんの棚（ほかの作品を見る）</a>
  </div>`;
}
function bindAbout() { if ($('about')) $('btn-back').addEventListener('click', () => { state.sheet = state.rows.length ? 'list' : 'home'; render(); }); }
setRenderers({ aboutHtml: aboutHtmlImpl });
```

`render()` の `bindBody()` の直後に `if (state.sheet === 'about') bindAbout();` を追加する。

- [ ] **Step 4: 全テストと重複チェック**

Run:
```
node tests/hitori_core_test.mjs && node tests/hitori_mapcore_test.mjs
PYTHONUTF8=1 python tests/hitori_index_test.py
PYTHONUTF8=1 python tests/hitori_map_test.py
python C:/tmp/check_dup_const.py assets/hitori/app.js
```
Expected: すべて OK / `OK: hitori map (9 tests)` / exit 0。

- [ ] **Step 5: スクリーンショットを目視（公開前ゲート）**

`tests/screens/hitori-mobile-home.png`, `hitori-mobile-list.png`, `hitori-mobile-detail.png`, `hitori-mobile-locate.png`, `hitori-mobile-saved.png`, `hitori-mobile-about.png`, `hitori-desktop-list.png`, `hitori-desktop-detail.png` を Read し、次を確認する: ヘッダーがシートや地図コントロールに重ならない／44px 未満のボタンが無い／文字が切れていない／未確認カードに点線・数字スコアが無い／食い違いが2値並んでいる。崩れがあれば CSS を直してから次へ。

- [ ] **Step 6: sitemap の lastmod とコミット**

`sitemap.xml` 内の `<loc>https://yuichi916.github.io/hitori.html</loc>` に続く `<lastmod>` を `2026-08-29` に更新（存在する場合のみ）。

```bash
git add assets/hitori/app.js tests/hitori_map_test.py sitemap.xml
git commit -m "feat(hitori): about sheet with provenance, per-prefecture progress and site links; drop floating home bar"
```

---

### Task 12: 公開と翌日確認

- [ ] **Step 1: push**（ユーザーの指示で実施）

```bash
git push origin main
```

- [ ] **Step 2: 公開ページを実機幅で確認**

Run（scratchpad で）: Playwright で `https://yuichi916.github.io/hitori.html` を 390×844 と 1400×900 で開き `window.__ready` を待ってスクショ。JS エラー 0 件、`data/hitori/index.json` が 200 で返ることを network で確認。

- [ ] **Step 3: 翌日、GoatCounter に `hitori.locate` / `hitori.detail` / `hitori.save` / `hitori.route` が届いていることを確認**

`C:\projects\brand-strategy\metrics\collect.py` の出力、または GoatCounter の管理画面で確認。届いていなければ `track()` の呼び出し箇所を疑う。
