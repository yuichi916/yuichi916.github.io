# ひとり歓迎マップ フェーズ2A 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「探す」タブを全画面1軒の縦スワイプデッキへ作り替え、施設名でも探せるようにする。

**Architecture:** 純粋なロジック（生成文・星座図の座標・施設名照合）は `assets/hitori/core.js` に置き Node でテストする。`hitori.html` にはDOMだけを残す。全国の施設名インデックスは「探すためだけ」の軽量ファイルとし、選択後に既存の県ファイルから実体を引く。

**Tech Stack:** Python 3.10 標準ライブラリのみ、素の HTML+CSS+JS（ESモジュール）、Playwright、Node

## Global Constraints

- Python は **標準ライブラリのみ**
- Python テストは `tests/hitori_*_test.py`、`main()` を持つ素のスクリプト。**pytest は使わない**
- JS の純関数テストは `tests/hitori_core_test.mjs`（`node tests/hitori_core_test.mjs`）
- テスト実行は必ず `PYTHONUTF8=1` を付ける
- すべて UTF-8（BOMなし）。Python ファイル冒頭に `# -*- coding: utf-8 -*-`
- commit は Conventional Commits、scope は `hitori`、**メッセージは日本語**
- コメントとドキストリングは**日本語**
- `hitori.html` を commit する前に `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html` が exit 0
- **`hitori.html` にアフィリエイトリンクを置かない**（地球地図日本の非営利条件）
- **しきい値をコードに二重に持たない。** `iso_threshold` と `iso_max` は `summary.json` が唯一の出所
- **営業状態が不明なものを「営業中」と表示しない**
- **生成文で断定しない。** 3軸は業態からの推定であり、「静かです」ではなく「会話が発生しない」という業態の性質として書く
- 作業ツリーには他プロジェクトの未コミット変更がある。**`git add -A` を使わない**

---

### Task 1: core.js — 生成する一文

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし（呼び出し側が既存の `isIsolated` / `formatIso` / `isGem` を使って ctx を組む）
- Produces: `leadSentence(item, ctx) -> string`
  - `ctx = { kindJa, isolated, isoText, gem, sameKindNearby }`
  - 空文字は返さない

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_core_test.mjs` の末尾（`if (failures)` の直前）へ:

```javascript
const LEAD_BASE = { cat: 'bath', kind: 'sento', solo: 4, quiet: 4, easy: 3, hidden: 0.0, hidden_n: 2, iso: 400 };

check('leadSentence: 孤立が最優先', () => {
  const s = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', isolated: true, isoText: '4.2km' });
  eq(s.startsWith('最寄りの銭湯まで4.2km。この一帯で唯一。'), true, s);
});

check('leadSentence: 密集は孤立でないときだけ', () => {
  const s = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', isolated: false, sameKindNearby: 4 });
  eq(s.startsWith('半径500mに同じ銭湯が4軒。'), true, s);
  const t = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', isolated: true, isoText: '4.2km', sameKindNearby: 4 });
  eq(t.includes('半径500m'), false, '孤立と密集が同時に出ている: ' + t);
});

check('leadSentence: 穴場は件数を出す', () => {
  const it = { ...LEAD_BASE, hidden: 0.83, hidden_n: 12 };
  const s = core.leadSentence(it, { kindJa: '銭湯', gem: true });
  eq(s.includes('周辺12軒中10軒がチェーン。'), true, s);
});

check('leadSentence: 静けさと入りやすさ', () => {
  eq(core.leadSentence({ ...LEAD_BASE, quiet: 5 }, { kindJa: '図書館' }).includes('会話が発生しない。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, quiet: 2 }, { kindJa: '立ち飲み' }).includes('声を出す場。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, easy: 2 }, { kindJa: '角打ち' }).includes('常連の作法がある。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, easy: 5 }, { kindJa: '映画館' }).includes('作法は要らない。'), true);
});

check('leadSentence: 最大2節', () => {
  const it = { ...LEAD_BASE, quiet: 5, easy: 5, solo: 5, hidden: 0.9, hidden_n: 10 };
  const s = core.leadSentence(it, { kindJa: '銭湯', isolated: true, isoText: '4.2km', gem: true });
  eq(s.split('。').filter(Boolean).length <= 3, true, '節が多すぎる: ' + s);
  eq(s.includes('この一帯で唯一。'), true, '最優先の節が落ちている: ' + s);
});

check('leadSentence: どれにも当たらなくても空にしない', () => {
  const it = { ...LEAD_BASE, solo: 3, quiet: 3, easy: 3, hidden: 0, hidden_n: 0 };
  const s = core.leadSentence(it, { kindJa: 'ゲストハウス' });
  eq(s.length > 0, true);
  eq(s, 'ゲストハウス。ひとり度3。');
});

check('leadSentence: 断定しない語を使わない', () => {
  // 「静かです」「空いています」のような断定は3軸が推定である以上使えない
  const bad = ['静かです', '空いて', '必ず', 'おすすめです'];
  for (const q of [5, 4, 2]) for (const e of [5, 3, 2]) {
    const s = core.leadSentence({ ...LEAD_BASE, quiet: q, easy: e }, { kindJa: '銭湯' });
    for (const b of bad) eq(s.includes(b), false, `${b} が含まれる: ${s}`);
  }
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.leadSentence is not a function`

- [ ] **Step 3: 実装を追加**

`assets/hitori/core.js` の末尾へ:

```javascript
// --- 紹介文の生成 ---
// 37,193件すべてに付けるため、手書きではなくデータから決定的に生成する。
// 3軸は業態からの推定なので「静かです」とは断定せず、「会話が発生しない」という
// 業態の性質として書く。既存の免責文と整合させるための制約。

const LEAD_MAX_CLAUSES = 2;

export function leadSentence(item, ctx) {
  const c = ctx || {};
  const kind = c.kindJa || item.kind;
  const out = [];

  if (c.isolated && c.isoText) {
    out.push(`最寄りの${kind}まで${c.isoText}。この一帯で唯一。`);
  } else if (c.sameKindNearby >= 3) {
    out.push(`半径500mに同じ${kind}が${c.sameKindNearby}軒。`);
  }
  if (c.gem) {
    const chains = Math.round((item.hidden || 0) * (item.hidden_n || 0));
    out.push(`周辺${item.hidden_n}軒中${chains}軒がチェーン。その中の一軒。`);
  }
  if (item.quiet >= 5) out.push('会話が発生しない。');
  else if (item.quiet <= 2) out.push('声を出す場。');
  if (item.easy <= 2) out.push('常連の作法がある。');
  else if (item.easy >= 5) out.push('作法は要らない。');
  if (item.solo === 5) out.push('ひとりが標準。');

  // 空欄を出すくらいなら素っ気ない事実のほうがまし
  if (!out.length) return `${kind}。ひとり度${item.solo}。`;
  return out.slice(0, LEAD_MAX_CLAUSES).join('');
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
  const s = JSON.parse(fs.readFileSync('data/hitori/summary.json','utf8'));
  const d = JSON.parse(fs.readFileSync('data/hitori/pref/44.json','utf8'));
  const KJ={sento:'銭湯',onsen:'日帰り温泉',ramen:'ラーメン',soba_udon:'そば・うどん',cinema:'映画館',karaoke:'カラオケ',library:'図書館',museum:'美術館',hostel:'ゲストハウス',netcafe:'ネットカフェ',standing:'立ち飲み',gyudon:'牛丼',curry:'カレー',sauna:'サウナ',yakiniku_solo:'ひとり焼肉',capsule:'カプセルホテル'};
  const items = d.items.map(r=>Object.fromEntries(d.fields.map((f,i)=>[f,r[i]])));
  for (const it of items.slice(0,10)) {
    const th = s.iso_threshold[it.cat];
    const iso = it.iso >= s.iso_max ? '50km以上' : (it.iso>=1000?(it.iso/1000).toFixed(1)+'km':it.iso+'m');
    console.log((it.name+'                    ').slice(0,20),
      core.leadSentence(it, {kindJa:KJ[it.kind]||it.kind, isolated: it.iso>=th, isoText: iso,
                             gem: it.chain===0&&it.hidden_n>=3&&it.hidden>=0.4}));
  }
});
"
```
Expected: 10件すべてに文が出て、**同じ文が10件並ばないこと**。全部同じなら条件分岐が効いていない。

- [ ] **Step 6: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): データから紹介文を生成する純関数を追加"
```

---

### Task 2: core.js — 星座図の座標計算

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `constellation(center, items, opts) -> {points, r, rings}`
  - `points` は `{x, y, cat, distM, self}` の配列、中心に近い順
  - `opts = {radiusM = 1500, r = 130, maxPoints = 120}`

- [ ] **Step 1: 失敗するテストを追加**

```javascript
const CEN = { id: 'n1', lat: 35.0, lon: 139.0, cat: 'bath' };

check('constellation: 中心は原点', () => {
  const c = core.constellation(CEN, [CEN], {});
  eq(c.points.length, 1);
  near(c.points[0].x, 0, 0.01);
  near(c.points[0].y, 0, 0.01);
  eq(c.points[0].self, true);
});

check('constellation: 北が上（yが負）', () => {
  const north = { id: 'n2', lat: 35.009, lon: 139.0, cat: 'eat' };   // 約1km北
  const c = core.constellation(CEN, [CEN, north], {});
  const p = c.points.find(x => !x.self);
  eq(p.y < 0, true, '北の点が下にある: ' + p.y);
  near(p.x, 0, 1);
});

check('constellation: 東が右（xが正）', () => {
  const east = { id: 'n3', lat: 35.0, lon: 139.011, cat: 'eat' };    // 約1km東
  const c = core.constellation(CEN, [CEN, east], {});
  const p = c.points.find(x => !x.self);
  eq(p.x > 0, true, '東の点が左にある: ' + p.x);
});

check('constellation: 半径外は落とす', () => {
  const far = { id: 'n4', lat: 35.03, lon: 139.0, cat: 'eat' };      // 約3.3km
  const c = core.constellation(CEN, [CEN, far], {});
  eq(c.points.length, 1);
});

check('constellation: 距離が線形に写像される', () => {
  const half = { id: 'n5', lat: 35.00674, lon: 139.0, cat: 'eat' };  // 約750m = 半径の半分
  const c = core.constellation(CEN, [CEN, half], { r: 130, radiusM: 1500 });
  const p = c.points.find(x => !x.self);
  near(Math.abs(p.y), 65, 6);
});

check('constellation: 中心に近い順に上限で切る', () => {
  const many = [CEN];
  for (let i = 0; i < 300; i++) {
    many.push({ id: 'x' + i, lat: 35.0 + 0.00004 * (i + 1), lon: 139.0, cat: 'eat' });
  }
  const c = core.constellation(CEN, many, { maxPoints: 120 });
  eq(c.points.length, 120);
  // 中心に近い順
  const ds = c.points.map(p => p.distM);
  eq(JSON.stringify(ds), JSON.stringify(ds.slice().sort((a, b) => a - b)));
  eq(c.points[0].self, true, '中心が落ちている');
});

check('constellation: 周辺0件でも落ちない', () => {
  const c = core.constellation(CEN, [], {});
  eq(c.points.length, 0);
  eq(c.rings.length, 3);
  eq(c.r > 0, true);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.constellation is not a function`

- [ ] **Step 3: 実装を追加**

```javascript
// --- 星座図 ---
// 写真が1枚も無いので、周辺施設の分布そのものを絵にする。
// 「密集」も「孤立」も同じ絵で語れ、他所から持ってこられない絵になる。

const CONST_RADIUS_M = 1500;
const CONST_R = 130;
const CONST_MAX_POINTS = 120;   // 都心では1.5km圏に数百件あり、全部打つと黒い塊になる

export function constellation(center, items, opts) {
  const o = opts || {};
  const radiusM = o.radiusM || CONST_RADIUS_M;
  const R = o.r || CONST_R;
  const maxPoints = o.maxPoints || CONST_MAX_POINTS;
  const cos = Math.cos(center.lat * Math.PI / 180);

  const pts = [];
  for (const it of items) {
    const dx = (it.lon - center.lon) * cos * 111320;
    const dy = -(it.lat - center.lat) * 111320;   // SVGは下が正なので反転
    const distM = Math.sqrt(dx * dx + dy * dy);
    if (distM > radiusM) continue;
    pts.push({
      x: (dx / radiusM) * R,
      y: (dy / radiusM) * R,
      cat: it.cat,
      distM,
      self: it.id === center.id,
    });
  }
  pts.sort((a, b) => a.distM - b.distM);
  return { points: pts.slice(0, maxPoints), r: R, rings: [R / 3, (R * 2) / 3, R] };
}
```

- [ ] **Step 4: テストを実行して通す**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 星座図の座標計算を追加"
```

---

### Task 3: core.js — 施設名の照合

**Files:**
- Modify: `assets/hitori/core.js`
- Modify: `tests/hitori_core_test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `searchFacilities(items, query, limit = 20) -> object[]`

- [ ] **Step 1: 失敗するテストを追加**

```javascript
const FAC = [
  { id: 'a', name: '駅前高等温泉', cat: 'bath', kind: 'onsen', distM: 135 },
  { id: 'b', name: '高等温泉', cat: 'bath', kind: 'onsen', distM: 900 },
  { id: 'c', name: '別府ブルーバード劇場', cat: 'play', kind: 'cinema', distM: 207 },
  { id: 'd', name: '温泉たまご屋', cat: 'eat', kind: 'ramen', distM: 50 },
];

check('searchFacilities: 部分一致', () => {
  eq(core.searchFacilities(FAC, '温泉').length, 3);
});

check('searchFacilities: 完全一致を先頭に', () => {
  eq(core.searchFacilities(FAC, '高等温泉')[0].id, 'b');
});

check('searchFacilities: 同点なら短い名前が先', () => {
  const r = core.searchFacilities(FAC, '温泉');
  eq(r[0].name.length <= r[1].name.length, true, r.map(x => x.name).join(','));
});

check('searchFacilities: 空・空白・nullは空配列', () => {
  eq(core.searchFacilities(FAC, '').length, 0);
  eq(core.searchFacilities(FAC, '  ').length, 0);
  eq(core.searchFacilities(FAC, null).length, 0);
});

check('searchFacilities: 一致なし', () => {
  eq(core.searchFacilities(FAC, 'ぜったいにない').length, 0);
});

check('searchFacilities: limit', () => {
  eq(core.searchFacilities(FAC, '温泉', 2).length, 2);
});

check('searchFacilities: 入力を破壊しない', () => {
  const before = FAC.map(x => x.id).join('');
  core.searchFacilities(FAC, '温泉');
  eq(FAC.map(x => x.id).join(''), before);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node tests/hitori_core_test.mjs`
Expected: FAIL — `core.searchFacilities is not a function`

- [ ] **Step 3: 実装を追加**

```javascript
// --- 施設名の照合 ---
// 読み込み済みの県に対して使う。全国検索は別ファイルを取得したうえで
// 同じ関数を使う（items の中身が違うだけ）。

export function searchFacilities(items, query, limit = 20) {
  const q = String(query == null ? '' : query).trim();
  if (!q) return [];
  const hits = items.filter(it => it.name.includes(q));
  hits.sort((a, b) => {
    const ae = a.name === q ? 0 : 1, be = b.name === q ? 0 : 1;
    if (ae !== be) return ae - be;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return (a.distM || 0) - (b.distM || 0);
  });
  return hits.slice(0, limit);
}
```

- [ ] **Step 4: テストを実行して通す**

Run: `node tests/hitori_core_test.mjs`
Expected: `OK: core`

- [ ] **Step 5: Commit**

```bash
git add assets/hitori/core.js tests/hitori_core_test.mjs
git commit -m "feat(hitori): 施設名の照合を追加"
```

---

### Task 4: 全国の施設名インデックス

**Files:**
- Create: `scripts/hitori/facilities.py`
- Create: `data/hitori/facilities.json`（スクリプトが生成、commit する）
- Test: `tests/hitori_facilities_test.py`

**Interfaces:**
- Consumes: `data/hitori/pref/*.json`
- Produces:
  - `build_index(pref_docs) -> list` — `[name, prefCode, rowIndex]` の配列
  - `data/hitori/facilities.json`

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_facilities_test.py`:

```python
# -*- coding: utf-8 -*-
"""全国の施設名インデックス。「探すためだけ」の軽量ファイル。

施設IDではなく県ファイル内の行番号を持つ（実測 gzip 534KB → 378KB）。
選択後にその県のファイルを読めば実体は取れるため、索引に実体は要らない。
"""
import sys, json, gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import facilities

OUT = ROOT / "data" / "hitori" / "facilities.json"
PREF = ROOT / "data" / "hitori" / "pref"
MAX_GZIP = 460 * 1024   # 実測378KBに将来の増加ぶんの余裕


def test_build_index_shape():
    docs = {
        13: {"fields": ["id", "name"], "items": [["n1", "あ"], ["n2", "い"]]},
        14: {"fields": ["id", "name"], "items": [["n3", "う"]]},
    }
    rows = facilities.build_index(docs)
    assert rows == [["あ", 13, 0], ["い", 13, 1], ["う", 14, 0]], rows


def test_build_index_is_sorted_by_pref():
    docs = {
        14: {"fields": ["name"], "items": [["う"]]},
        13: {"fields": ["name"], "items": [["あ"]]},
    }
    rows = facilities.build_index(docs)
    assert [r[1] for r in rows] == [13, 14], rows


def main():
    test_build_index_shape()
    test_build_index_is_sorted_by_pref()

    assert OUT.exists(), f"not found: {OUT} — facilities.py を実行してください"
    raw = OUT.read_bytes()
    gz = len(gzip.compress(raw, 9))
    assert gz <= MAX_GZIP, f"gzip {gz/1024:.0f}KB が上限 {MAX_GZIP/1024:.0f}KB 超過"

    doc = json.loads(raw.decode("utf-8"))
    assert doc["fields"] == ["name", "pref", "i"], doc["fields"]
    assert doc.get("updated"), "updated がない"

    # 添字が県ファイルの実体を指していること。ずれると別の施設を開く。
    by_pref = {}
    for name, pref, i in doc["items"]:
        by_pref.setdefault(pref, []).append((name, i))
    total = 0
    for pref, entries in by_pref.items():
        d = json.loads((PREF / f"{pref:02d}.json").read_text(encoding="utf-8"))
        assert d["updated"] == doc["updated"], \
            f"pref{pref:02d} の updated がインデックスと不一致: {d['updated']} vs {doc['updated']}"
        ni = d["fields"].index("name")
        for name, i in entries:
            assert 0 <= i < len(d["items"]), f"添字が範囲外: pref{pref} i={i}"
            assert d["items"][i][ni] == name, \
                f"添字が別の施設を指している: pref{pref} i={i} 索引={name} 実体={d['items'][i][ni]}"
        total += len(entries)

    assert total == len(doc["items"])
    assert total > 35000, f"件数が少なすぎる: {total}"
    assert sorted(by_pref) == list(range(1, 48)), "47県そろっていない"

    print(f"OK: facilities（{total:,}件 / 生 {len(raw)/1024:.0f}KB gzip {gz/1024:.0f}KB）")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_facilities_test.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'facilities'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/facilities.py`:

```python
# -*- coding: utf-8 -*-
"""全国の施設名インデックスを生成する。

これは「探すためだけ」の索引であり、表示用のデータは持たない。
名前・県コード・県ファイル内の行番号だけを持つ。施設IDを持つ方式より
軽く（実測 gzip 534KB → 378KB）、選択後にその県のファイルを読めば
実体は取れる。

添字は生成時点の県ファイルに対応する。片方だけ古いと別の施設を開くという
静かな誤りになるため、updated を両方に持たせてランタイムで突き合わせる。
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREF_DIR = ROOT / "data" / "hitori" / "pref"
OUT = ROOT / "data" / "hitori" / "facilities.json"

FIELDS = ["name", "pref", "i"]
MIN_PREF_FILES = 47


class MissingPrefDataError(RuntimeError):
    pass


def build_index(pref_docs):
    """{県コード: 県ドキュメント} → [[name, prefCode, rowIndex], ...]

    県コード昇順、県内は元の並び順のまま。
    """
    rows = []
    for code in sorted(pref_docs):
        doc = pref_docs[code]
        ni = doc["fields"].index("name")
        for i, row in enumerate(doc["items"]):
            rows.append([row[ni], code, i])
    return rows


def load_pref_docs():
    if not PREF_DIR.is_dir():
        raise MissingPrefDataError(f"{PREF_DIR} がありません")
    files = sorted(PREF_DIR.glob("*.json"))
    if len(files) < MIN_PREF_FILES:
        raise MissingPrefDataError(
            f"{PREF_DIR} に県データが {len(files)} 件しかありません（{MIN_PREF_FILES}件必要）")
    docs = {}
    for f in files:
        docs[int(f.stem)] = json.loads(f.read_text(encoding="utf-8"))
    return docs


def main():
    try:
        docs = load_pref_docs()
    except MissingPrefDataError as e:
        print(f"{e}\n先に build_data.py を実行してください。", file=sys.stderr)
        sys.exit(1)

    updates = {d["updated"] for d in docs.values()}
    if len(updates) != 1:
        print(f"県ファイルの updated が揃っていません: {sorted(updates)}\n"
              f"build_data.py を実行し直してください。", file=sys.stderr)
        sys.exit(1)
    updated = updates.pop()

    rows = build_index(docs)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated": updated, "fields": FIELDS, "items": rows},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows):,}件 / {OUT.stat().st_size/1024:.0f}KB / updated={updated})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 生成してテストを通す**

Run: `PYTHONUTF8=1 python scripts/hitori/facilities.py && PYTHONUTF8=1 python tests/hitori_facilities_test.py`
Expected: `wrote ...facilities.json (37,193件 / ...)` に続いて `OK: facilities（37,193件 / 生 1171KB gzip 378KB）`

gzip が上限を超えた場合は**件数を削らず**、実測値を報告して止まること。

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/facilities.py data/hitori/facilities.json tests/hitori_facilities_test.py
git commit -m "feat(hitori): 全国の施設名インデックスを生成"
```

---

### Task 5: hitori.html — デッキ構造

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: 既存の `currentSearchResults()` / `state.search` / `state.sort`
- Produces:
  - `state.view` — `'deck'`（既定）| `'list'`
  - `state.deckIndex` — 表示中の位置
  - `renderDeck()` / `deckNext()` / `deckPrev()` / `setView(v)`

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_render_test.py` に追加し、`main()` の `test_search_with_location` の後で呼ぶ:

```python
def test_deck_is_default_and_swipes(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    assert p.evaluate("state.view") == "deck"
    p.wait_for_selector("#deck .card", timeout=15000)
    first = p.eval_on_selector("#deck .card", "e => e.dataset.id")

    p.click("#deck-next")
    p.wait_for_timeout(300)
    second = p.eval_on_selector("#deck .card", "e => e.dataset.id")
    assert second != first, "次へ押しても変わらない"

    p.click("#deck-prev")
    p.wait_for_timeout(300)
    assert p.eval_on_selector("#deck .card", "e => e.dataset.id") == first
    p.close()


def test_deck_and_list_share_results(context, page):
    """絞り込みと並べ替えはデッキと一覧で同じ結果集合を返す。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.evaluate("state.sort = 'find'; renderDeck()")
    deck_ids = p.evaluate("currentSearchResults().slice(0,5).map(x => x.id)")

    p.click("#view-list")
    p.wait_for_selector("#search-list li.item", timeout=15000)
    list_ids = p.eval_on_selector_all("#search-list li.item", "els => els.slice(0,5).map(e => e.dataset.id)")
    assert deck_ids == list_ids, f"デッキと一覧で結果が違う\n{deck_ids}\n{list_ids}"

    p.click("#view-deck")
    p.wait_for_selector("#deck .card", timeout=15000)
    assert p.eval_on_selector("#deck .card", "e => e.dataset.id") == deck_ids[0]
    p.close()


def test_deck_empty_state(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    # 絶対に0件になる条件
    p.evaluate("state.search.maxDistM = 1; renderDeck()")
    p.wait_for_selector("#deck .empty", timeout=10000)
    body = p.inner_text("#deck")
    assert "該当" in body
    assert p.eval_on_selector_all("#deck .open-filters", "els => els.length") == 1
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#deck .card` が見つからない

- [ ] **Step 3: HTML を足す**

`#panel-search` の中、`#search-status` の直前へ:

```html
    <div class="viewbar">
      <button type="button" id="view-deck" aria-pressed="true">1軒ずつ</button>
      <button type="button" id="view-list" aria-pressed="false">一覧で見る</button>
      <button type="button" id="open-filters">絞り込み</button>
    </div>
    <section id="deck" aria-live="polite"></section>
    <div class="deck-nav">
      <button type="button" id="deck-prev" aria-label="前の施設">↑</button>
      <span id="deck-pos"></span>
      <button type="button" id="deck-next" aria-label="次の施設">↓</button>
    </div>
```

CSS を追加:

```css
.viewbar { display:flex; gap:.5rem; margin:.6rem 0; flex-wrap:wrap; }
.viewbar button { background:none; border:1px solid var(--line); border-radius:999px;
                  color:var(--fg); cursor:pointer; font:inherit; font-size:.82rem;
                  padding:.2rem .9rem; }
.viewbar button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); }
#deck { min-height:60vh; }
#deck .empty { color:var(--muted); padding:2rem 0; text-align:center; }
.deck-nav { display:flex; align-items:center; justify-content:center; gap:1rem;
            margin:.6rem 0 0; color:var(--muted); font-size:.82rem; }
.deck-nav button { background:none; border:1px solid var(--line); border-radius:50%;
                   color:var(--fg); cursor:pointer; width:2.2rem; height:2.2rem; font-size:1rem; }
```

- [ ] **Step 4: JS を足す**

`hitori.html` の `const state = { ... }` リテラル（`search:` の行の直後）へ2つ足す:

```javascript
  view: 'deck', deckIndex: 0,
```

```javascript
function setView(v) {
  state.view = v === 'list' ? 'list' : 'deck';
  const deckOn = state.view === 'deck';
  document.getElementById('view-deck').setAttribute('aria-pressed', String(deckOn));
  document.getElementById('view-list').setAttribute('aria-pressed', String(!deckOn));
  document.getElementById('deck').hidden = !deckOn;
  document.querySelector('.deck-nav').hidden = !deckOn;
  document.getElementById('search-list').hidden = deckOn;
  if (deckOn) renderDeck(); else renderSearchList();
}

function deckMove(step) {
  const items = currentSearchResults();
  if (!items.length) return;
  state.deckIndex = Math.max(0, Math.min(items.length - 1, state.deckIndex + step));
  renderDeck();
}

function deckNext() { deckMove(1); }
function deckPrev() { deckMove(-1); }

function renderDeck() {
  const el = document.getElementById('deck');
  const items = currentSearchResults();
  const pos = document.getElementById('deck-pos');

  if (!items.length) {
    state.deckIndex = 0;
    pos.textContent = '';
    el.innerHTML = `<div class="empty">該当する施設はありません。
      <button type="button" class="open-filters">絞り込みを見直す</button></div>`;
    el.querySelector('.open-filters').addEventListener('click', openFilterSheet);
    return;
  }
  state.deckIndex = Math.max(0, Math.min(items.length - 1, state.deckIndex));
  const it = items[state.deckIndex];
  pos.textContent = `${state.deckIndex + 1} / ${items.length}`;
  el.innerHTML = renderCard(it);       // Task 6 で中身を実装する
  const card = el.querySelector('.card');
  if (card) card.addEventListener('click', () => openFacility(it.id));
}

// Task 6 で本実装する。ここでは最小の骨格だけ置く。
function renderCard(it) {
  return `<article class="card" data-id="${it.id}"><h3>${escapeHtml(it.name)}</h3></article>`;
}

function openFilterSheet() {
  document.querySelector('#panel-search .filters').hidden = false;
  document.getElementById('open-filters').setAttribute('aria-expanded', 'true');
}

function bindDeck() {
  document.getElementById('view-deck').addEventListener('click', () => setView('deck'));
  document.getElementById('view-list').addEventListener('click', () => setView('list'));
  document.getElementById('deck-next').addEventListener('click', deckNext);
  document.getElementById('deck-prev').addEventListener('click', deckPrev);
  document.getElementById('open-filters').addEventListener('click', openFilterSheet);
  document.addEventListener('keydown', e => {
    if (state.tab !== 'search' || state.view !== 'deck') return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); deckNext(); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); deckPrev(); }
  });
}
```

**絞り込みが変わったらデッキの位置を先頭に戻す。** `renderSearchList()` を呼んでいる各フィルタのハンドラで、`state.deckIndex = 0;` を先に実行し、`renderSearchList()` の代わりに以下を呼ぶ:

```javascript
// 表示だけ描き直す（保存の星を押したときなど）。デッキの位置は保つ。
function rerenderView() {
  if (state.view === 'deck') renderDeck(); else renderSearchList();
}

// 結果集合そのものが変わったとき（絞り込み・並べ替え・起点）。先頭に戻す。
function refreshResults() {
  state.deckIndex = 0;
  rerenderView();
}
```

`bindSearchFilters()` と `bindSortAndFavs()` の中の `renderSearchList()` 呼び出しをすべて `refreshResults()` に置き換える。`runSearchFromOrigin()` の中の `renderSearchList()` も同様。

`init()` の末尾で `bindDeck()` を呼び、`setView(state.view)` を実行する。`window` 公開に `renderDeck`、`setView`、`currentSearchResults` を足す。

- [ ] **Step 5: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 探すタブを1軒ずつのデッキ表示にする"
```

---

### Task 6: hitori.html — カードの中身

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 1 の `core.leadSentence`、Task 2 の `core.constellation`、既存の `isIsolated` / `formatIso` / `isGem` / `PREF_CACHE`
- Produces: `renderCard(it)` の本実装、`constellationSvg(it)`、`loadedItems()`、`sameKindNearby(it)`

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_card_has_constellation_and_lead(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#deck .card", timeout=15000)

    # 星座図が描かれ、点が打たれている
    pts = p.eval_on_selector_all("#deck .card svg.constellation circle.pt", "els => els.length")
    assert pts > 0, "星座図の点が0"
    assert p.eval_on_selector_all("#deck .card svg.constellation circle.self", "els => els.length") == 1

    body = p.inner_text("#deck .card")
    assert "徒歩" in body and "直線" in body
    lead = p.inner_text("#deck .card .lead")
    assert len(lead) > 0, "生成文が空"
    assert "undefined" not in body, body[:200]

    # 断定しない
    for bad in ("静かです", "おすすめです", "空いています"):
        assert bad not in body, f"{bad} が出ている"
    p.close()


def test_card_lead_varies_between_facilities(context, page):
    """生成文が全部同じなら条件分岐が効いていない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#deck .card", timeout=15000)

    leads = []
    for _ in range(8):
        leads.append(p.inner_text("#deck .card .lead"))
        p.click("#deck-next")
        p.wait_for_timeout(200)
    assert len(set(leads)) >= 2, f"8軒すべて同じ文: {leads[0]}"
    p.close()


def test_card_star_saves_without_jumping(context, page):
    """星を押しても詳細シートが開かず、デッキの位置も動かない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#deck .card", timeout=15000)
    p.click("#deck-next")
    p.wait_for_timeout(300)
    pos = p.inner_text("#deck-pos")
    before = p.eval_on_selector("#deck .card", "e => e.dataset.id")

    p.click("#deck .card .fav")
    p.wait_for_timeout(400)
    assert p.eval_on_selector("#deck .card .fav", "e => e.getAttribute('aria-pressed')") == "true"
    assert p.inner_text("#deck-pos") == pos, "星を押してデッキの位置が動いた"
    assert p.eval_on_selector("#deck .card", "e => e.dataset.id") == before
    assert p.eval_on_selector_all("#facility dl", "e => e.length") == 0, "星で詳細シートが開いた"
    p.close()


def test_card_opens_detail_sheet(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#deck .card", timeout=15000)
    p.click("#deck .card")
    p.wait_for_selector("#facility dl", timeout=15000)
    assert "孤立度" in p.inner_text("#facility")
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `svg.constellation` が見つからない

- [ ] **Step 3: CSS を足す**

```css
#deck .card { position:relative; min-height:64vh; border-radius:14px; overflow:hidden;
              background:#0e1a24; color:#fdfaf4; cursor:pointer;
              display:flex; flex-direction:column; justify-content:space-between;
              padding:1.4rem 1.3rem; }
#deck .card svg.constellation { position:absolute; inset:0; width:100%; height:100%;
                                opacity:.42; pointer-events:none; }
#deck .card > * { position:relative; }
#deck .eyebrow { font-size:.6rem; letter-spacing:.3em; color:#e0b978; }
#deck .nm { font-family:"Hiragino Mincho ProN","Yu Mincho",serif;
            font-size:2.1rem; line-height:1.15; font-weight:600; margin:.5rem 0 0; }
#deck .meta { font-size:.7rem; color:#8fa3b2; margin-top:.5rem; }
#deck .lead { font-family:"Hiragino Mincho ProN","Yu Mincho",serif;
              font-size:.85rem; line-height:2; color:#cfd9e0; margin:0 0 1rem; }
#deck .walk { font-weight:800; font-size:2.4rem; line-height:1; }
#deck .walk small { font-size:.9rem; font-weight:600; }
#deck .sub { font-size:.66rem; color:#7f95a5; margin-top:.2rem; }
#deck .chips { display:flex; gap:.35rem; flex-wrap:wrap; justify-content:flex-end; }
#deck .chips span { border:1px solid #3c5468; color:#b9cad6; font-size:.66rem;
                    padding:.1rem .6rem; border-radius:999px; }
#deck .chips .hot { border-color:#d29922; color:#f0c98a; }
#deck .foot { display:flex; align-items:flex-end; gap:1rem;
              border-top:1px solid #24394a; padding-top:.8rem; }
```

- [ ] **Step 4: JS を実装する**

`renderCard` の骨格を以下で置き換え、補助関数を足す:

```javascript
const CAT_COLOR = { bath: '#2f6f9f', eat: '#c2622e', play: '#7a52b3', stay: '#2f8f68' };
const _constCache = new Map();          // 施設ID → 星座図。高速スワイプで再計算しない
const CONST_CACHE_MAX = 200;

// 読み込み済みの県からのみ拾う。追加の取得はしない。
// 既存の collectItems(codes) をそのまま使う（同じ処理を二度書かない）。
function loadedItems() {
  return collectItems(Object.keys(PREF_CACHE).map(Number));
}

function constellationSvg(it) {
  if (_constCache.has(it.id)) return _constCache.get(it.id);
  const c = core.constellation(it, loadedItems(), {});
  const R = c.r;
  const rings = c.rings.map(r =>
    `<circle cx="0" cy="0" r="${r.toFixed(1)}" fill="none" stroke="#22384a" stroke-width=".7"/>`).join('');
  const pts = c.points.map(p =>
    `<circle class="pt${p.self ? ' self' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}"
      r="${p.self ? 3.4 : 2.2}" fill="${CAT_COLOR[p.cat] || '#8fa3b2'}"/>`).join('');
  const ring = c.points.some(p => p.self)
    ? `<circle cx="0" cy="0" r="9" fill="none" stroke="#f5c884" stroke-width="1.4"/>` : '';
  const svg = `<svg class="constellation" viewBox="${-R - 8} ${-R - 8} ${(R + 8) * 2} ${(R + 8) * 2}"
    role="img" aria-label="周辺1.5kmの施設分布">${rings}${pts}${ring}</svg>`;

  if (_constCache.size >= CONST_CACHE_MAX) _constCache.delete(_constCache.keys().next().value);
  _constCache.set(it.id, svg);
  return svg;
}

function sameKindNearby(it) {
  let n = 0;
  for (const o of loadedItems()) {
    if (o.id === it.id || o.kind !== it.kind) continue;
    if (core.haversineM(it.lat, it.lon, o.lat, o.lon) <= 500) n++;
  }
  return n;
}

function renderCard(it) {
  const kindJa = KIND_JA[it.kind] || it.kind;
  const lead = core.leadSentence(it, {
    kindJa,
    catJa: CAT_JA[it.cat] || it.cat,   // iso は同カテゴリまでの距離なのでカテゴリ名を渡す
    isolated: isIsolated(it, it.iso),
    isoText: formatIso(it.iso),
    gem: isGem(it),
    sameKindNearby: sameKindNearby(it),
  });
  const st = core.openState(it.oh, new Date());
  const openTxt = st === 'open' ? '営業中' : st === 'closed' ? '営業時間外' : '営業時間不明';
  const dist = it.distM >= 1000 ? `直線${(it.distM / 1000).toFixed(1)}km` : `直線${Math.round(it.distM)}m`;
  const where = it.city || (BY_CODE[it.prefCode] && BY_CODE[it.prefCode].name) || '';

  return `<article class="card" data-id="${it.id}" tabindex="0">
    ${constellationSvg(it)}
    <div>
      <div class="eyebrow">${escapeHtml(where)} / ${escapeHtml(kindJa)}</div>
      <h3 class="nm">${escapeHtml(it.name)}</h3>
      <div class="meta">${escapeHtml(kindJa)}${where ? ' ・ ' + escapeHtml(where) : ''}</div>
    </div>
    <div>
      <p class="lead">${escapeHtml(lead)}</p>
      <div class="foot">
        <div>
          <div class="walk">${core.walkMinutes(it.distM)}<small>分</small></div>
          <div class="sub">${dist} ${core.bearing8(state.origin.lat, state.origin.lon, it.lat, it.lon)}</div>
        </div>
        <div class="chips" style="flex:1">
          ${FAVS_OK() ? `<button type="button" class="fav" aria-pressed="${core.isFav(state.favs, it.id)}"
             aria-label="保存">${core.isFav(state.favs, it.id) ? '★' : '☆'}</button>` : ''}
          <span>ひとり ${it.solo}</span><span>静けさ ${it.quiet}</span><span>入りやすさ ${it.easy}</span>
          <span${st === 'open' ? ' class="hot"' : ''}>${openTxt}</span>
          ${isGem(it) ? `<span class="hot">穴場 ${Math.round(it.hidden * 100)}%</span>` : ''}
          ${isIsolated(it, it.iso) ? `<span class="hot">最寄り${formatIso(it.iso)}</span>` : ''}
        </div>
      </div>
    </div>
  </article>`;
}
```

**保存の星のハンドラを直す。** 既存の配線（`hitori.html:528` 付近）は `btn.closest('li.item')` で行を引いており、カードは `article.card` なので `null.dataset` で落ちる。`[data-id]` を持つ祖先を引く形に変える。あわせて、星を押しただけでデッキが先頭に戻らないよう `renderSearchList()` を `rerenderView()` にする:

```javascript
    const btn = e.target.closest('.fav');
    if (!btn) return;
    e.stopPropagation();          // 詳細シートを開かない
    const host = btn.closest('[data-id]');   // 一覧は li.item、デッキは article.card
    if (!host) return;
    const it = currentSearchResults().find(x => x.id === host.dataset.id);
    if (!it) return;
    state.favs = core.toggleFav(state.favs, it);
    if (!core.saveFavs(safeStorage(), state.favs)) {
      state.favs = null;          // 途中で書けなくなったら機能を畳む
    }
    updateFavCount();
    rerenderView();               // デッキの位置は保つ
```

星のCSSをカード用に足す:

```css
#deck .chips .fav { background:none; border:1px solid #3c5468; border-radius:999px;
                    color:#f0c98a; cursor:pointer; font:inherit; font-size:.72rem;
                    padding:.1rem .55rem; }
#deck .chips .fav[aria-pressed="true"] { border-color:#d29922; }
```

`renderDeck()` のカード配線に、キーボードでも開けるよう追記する:

```javascript
  if (card) {
    card.addEventListener('click', () => openFacility(it.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFacility(it.id); }
    });
  }
```

- [ ] **Step 5: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 6: 目視**

Run:
```bash
PYTHONUTF8=1 python - <<'PYEOF'
import threading, functools, http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path.cwd(); PORT = 8911
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844},
                        geolocation={"latitude": 33.2794, "longitude": 131.5006},
                        permissions=["geolocation"])
    pg = ctx.new_page()
    pg.goto(f"http://127.0.0.1:{PORT}/hitori.html")
    pg.wait_for_function("window.__searchReady === true", timeout=30000)
    pg.wait_for_selector("#deck .card", timeout=20000)
    pg.wait_for_timeout(600)
    pg.screenshot(path="C:/tmp/hitori_deck_1.png", full_page=True)
    pg.click("#deck-next"); pg.wait_for_timeout(500)
    pg.screenshot(path="C:/tmp/hitori_deck_2.png", full_page=True)
    b.close()
httpd.shutdown()
print("wrote C:/tmp/hitori_deck_1.png, C:/tmp/hitori_deck_2.png")
PYEOF
```
Expected: 別府駅を起点にした全画面カードが2枚。**星座図の点が背景に見え、施設名が大きく、徒歩◯分が数字として立っていること。** 星座図が真っ黒な塊なら `maxPoints` が効いていない。

- [ ] **Step 7: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): カードに星座図と生成文を実装"
```

---

### Task 7: hitori.html — 施設名検索の統合

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: Task 3 の `core.searchFacilities`、Task 4 の `data/hitori/facilities.json`
- Produces: `ensureFacilities()`、`openFacilityByIndex(pref, i)`、`state.facIndexOk`

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_facility_search_local(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "図書館")
    p.wait_for_selector("#place-hits .grp-fac li", timeout=20000)
    # 駅・地名が施設より上
    order = p.eval_on_selector_all("#place-hits .grp", "els => els.map(e => e.className)")
    assert order[0].endswith("grp-place") or "grp-place" in order[0], order
    p.close()


def test_facility_search_opens_card_without_moving_origin(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    before = p.evaluate("state.origin.label")

    p.fill("#place-q", "図書館")
    p.wait_for_selector("#place-hits .grp-fac li", timeout=20000)
    p.click("#place-hits .grp-fac li")
    p.wait_for_selector("#facility dl", timeout=20000)
    assert p.evaluate("state.origin.label") == before, "施設を選んだのに起点が動いた"
    p.close()


def test_nationwide_search_is_opt_in(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    reqs = []
    p.on("request", lambda r: reqs.append(r.url))
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)

    p.fill("#place-q", "ぜったいにない施設名XYZ")
    p.wait_for_selector("#nationwide", timeout=20000)
    assert "facilities.json" not in " ".join(reqs), "押す前に全国データを取得している"
    assert "KB" in p.inner_text("#nationwide"), "取得量が明記されていない"

    p.click("#nationwide")
    p.wait_for_function("window.__facilitiesReady === true", timeout=40000)
    assert any("facilities.json" in u for u in reqs)
    p.close()


def test_nationwide_disabled_on_version_mismatch(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.route("**/data/hitori/facilities.json", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body='{"updated":"1999-01-01","fields":["name","pref","i"],"items":[["\\u5618",13,0]]}'))
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.fill("#place-q", "ぜったいにない施設名XYZ")
    p.wait_for_selector("#nationwide", timeout=20000)
    p.click("#nationwide")
    p.wait_for_selector("#place-hits .stale", timeout=20000)
    txt = p.inner_text("#place-hits")
    assert "更新" in txt, txt
    # 嘘の施設を出していない
    assert "嘘" not in txt
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `.grp-fac` が見つからない

- [ ] **Step 3: JS を実装する**

```javascript
let FACILITIES = null;
let facLoading = null;

// 全国インデックスは「探すためだけ」の索引。表示用の実体は県ファイルから引く。
// 添字は生成時点の県ファイルに対応するので、updated が食い違ったら使わない。
// 誤った施設を開くより、機能を止めるほうがよい。
function ensureFacilities() {
  if (FACILITIES) return Promise.resolve(FACILITIES);
  if (facLoading) return facLoading;
  facLoading = fetch('data/hitori/facilities.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(doc => {
      FACILITIES = doc;
      window.__facilitiesReady = true;
      return doc;
    })
    .catch(err => { facLoading = null; throw err; });
  return facLoading;
}

function facIndexMatches(doc, prefCode) {
  const local = PREF_CACHE[prefCode];
  return !local || local.updated === doc.updated;
}

// Task 6 で追加した loadedItems()（= collectItems の薄い包み）を使う。
// 同じ収集処理を二度書かない。距離は起点があるときだけ付ける。
function localFacilities() {
  const out = loadedItems();
  return state.origin.lat == null
    ? out : core.withDistance(out, state.origin.lat, state.origin.lon);
}

async function openFacilityByIndex(prefCode, i) {
  await loadPrefIntoCache(prefCode);
  const doc = PREF_CACHE[prefCode];
  if (!doc || !facIndexMatches(FACILITIES, prefCode)) return false;
  const row = doc.items[i];
  if (!row) return false;
  const it = Object.fromEntries(doc.fields.map((f, n) => [f, row[n]]));
  it.prefCode = prefCode;
  if (state.origin.lat != null) {
    it.distM = core.haversineM(state.origin.lat, state.origin.lon, it.lat, it.lon);
  }
  FOUND_BY_SEARCH.set(it.id, it);   // openFacility が現在の結果集合の外でも引けるように
  openFacility(it.id);
  return true;
}

const FOUND_BY_SEARCH = new Map();
```

`openFacility` の冒頭、`currentSearchResults().find(...)` の直後に追記して、検索経由で開いた施設も見つかるようにする:

```javascript
  let it = currentSearchResults().find(x => x.id === id) || FOUND_BY_SEARCH.get(id);
```

既存の `renderPlaceHits(hits)`（`hitori.html:886` 付近）を**丸ごと以下で置き換える**。名前を変えず置き換えることで、使われない旧関数が残らない。旧実装が持っていた「マーカーが空でも名称と県名がくっつかないよう区切りを常に置く」挙動は、下の `placeKindMark(p)` と `・` の並びでそのまま維持している:

```javascript
function renderPlaceHits(places, facs, opts) {
  const el = document.getElementById('place-hits');
  el.hidden = false;
  const o = opts || {};
  const parts = [];

  if (places.length) {
    parts.push(`<li class="grp grp-place label">駅・地名</li>` + places.map((p, i) => `
      <li data-kind="place" data-i="${i}" tabindex="0">${escapeHtml(p.name)}<span class="kindmark">${
        placeKindMark(p)}・${escapeHtml(BY_CODE[p.pref].name)}</span></li>`).join(''));
  }
  if (facs.length) {
    parts.push(`<li class="grp grp-fac label">施設</li>` + facs.map((f, i) => `
      <li data-kind="fac" data-i="${i}" tabindex="0">${escapeHtml(f.name)}<span class="kindmark">${
        escapeHtml(f.city || BY_CODE[f.prefCode || f.pref].name)}${
        f.kind ? '・' + escapeHtml(KIND_JA[f.kind] || f.kind) : ''}</span></li>`).join(''));
  }
  if (!parts.length) {
    parts.push('<li class="empty">該当する駅・地名・施設がありません</li>');
    if (!FACILITIES) {
      parts.push(`<li class="empty"><button type="button" id="nationwide">全国の施設から探す（初回のみ約380KB）</button></li>`);
    }
  }
  if (o.stale) parts.unshift('<li class="empty stale">データの更新中です。全国検索は一時的に使えません。</li>');

  el.innerHTML = parts.join('');
  el._places = places;
  el._facs = facs;
}
```

`bindPlaceSearch()` の `update` を差し替える:

```javascript
  const update = () => {
    const text = q.value.trim();
    if (!text) { hits.hidden = true; return; }
    ensurePlaces()
      .then(items => {
        const places = core.searchPlaces(items, text, 8);
        const facs = core.searchFacilities(localFacilities(), text, 8);
        renderPlaceHits(places, facs, {});
        const nw = document.getElementById('nationwide');
        if (nw) nw.addEventListener('click', () => searchNationwide(text));
      })
      .catch(() => {
        hits.hidden = false;
        hits.innerHTML = '<li class="empty">地名データを読み込めませんでした</li>';
      });
  };

  async function searchNationwide(text) {
    try {
      const doc = await ensureFacilities();
      const rows = doc.items
        .map(([name, pref, i]) => ({ name, pref, i }))
        .filter(r => r.name.includes(text))
        .slice(0, 12);
      // 添字の整合が取れない県は出さない
      const stale = rows.length && rows.every(r => PREF_CACHE[r.pref] && !facIndexMatches(doc, r.pref));
      renderPlaceHits([], stale ? [] : rows, { stale });
    } catch (e) {
      hits.innerHTML = '<li class="empty">全国データを読み込めませんでした</li>';
    }
  }
```

`hits` のクリック配線を、両グループに対応させる:

```javascript
  const choose = el => {
    const kind = el.dataset.kind;
    const idx = +el.dataset.i;
    if (kind === 'place') {
      const p = hits._places[idx];
      if (p) setOrigin({ kind: 'place', lat: p.lat, lon: p.lon, label: p.name });
    } else if (kind === 'fac') {
      const f = hits._facs[idx];
      if (!f) return;
      hits.hidden = true;
      // 施設は起点を変えずにカードを開く
      if (f.i !== undefined) openFacilityByIndex(f.pref, f.i);
      else openFacility(f.id);
    }
  };
```

`window` 公開に `ensureFacilities` を足す。

- [ ] **Step 4: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render -> ...`

- [ ] **Step 5: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 施設名検索を統合し全国検索をオプトインにする"
```

---

### Task 8: 全体検証とサイト反映

**Files:**
- Modify: `tests/hitori_all.py`
- Modify: `index.html`

- [ ] **Step 1: テストランナーを更新**

`tests/hitori_all.py` の `TESTS` に `"hitori_facilities_test.py"` を `"hitori_places_test.py"` の直後へ足す。`tests/` の実際の内容を確認し、`hitori_*` のスイートがすべて載っているか確かめること。

- [ ] **Step 2: 全テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_all.py`
Expected: `ALL PASS (17 suites)`

- [ ] **Step 3: 位置情報なしで通しの目視**

Run:
```bash
PYTHONUTF8=1 python - <<'PYEOF'
import threading, functools, http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path.cwd(); PORT = 8912
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Q, directory=str(ROOT)))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844})   # 位置情報なし
    pg = ctx.new_page()
    pg.goto(f"http://127.0.0.1:{PORT}/hitori.html")
    pg.wait_for_function("window.__searchReady === true", timeout=30000)
    pg.fill("#place-q", "別府")
    pg.wait_for_selector("#place-hits li[data-kind]", timeout=20000)
    pg.click("#place-hits li[data-kind='place']")
    pg.wait_for_selector("#deck .card", timeout=30000)
    pg.wait_for_timeout(700)
    n = pg.eval_on_selector_all("#deck .card svg.constellation circle.pt", "e=>e.length")
    print("星座図の点:", n, "/ 位置:", pg.inner_text("#deck-pos"))
    print("生成文:", pg.inner_text("#deck .card .lead"))
    pg.screenshot(path="C:/tmp/hitori_p2a_deck.png", full_page=True)
    b.close()
httpd.shutdown()
print("wrote C:/tmp/hitori_p2a_deck.png")
PYEOF
```
Expected: 位置情報なしで別府からデッキが出る。星座図の点が1以上、生成文が空でないこと。

- [ ] **Step 4: index.html の説明文を更新**

カードの `dsc` を差し替える:

```html
        <div class="dsc">現在地からでも駅名からでも、ひとりが標準の店だけを1軒ずつ。周辺の分布を描いた星座図つきで、穴場や「この一帯で唯一」の一軒に出会える。</div>
```

- [ ] **Step 5: Commit**

```bash
git add tests/hitori_all.py index.html
git commit -m "feat(hitori): テストランナーを更新しサイトの説明文を差し替え"
```

---

## 実行後の運用

```bash
PYTHONUTF8=1 python scripts/hitori/fetch_osm.py      # 施設データ（30〜60分）
PYTHONUTF8=1 python scripts/hitori/build_data.py     # 3軸・穴場・孤立度・分割出力
PYTHONUTF8=1 python scripts/hitori/places.py         # 駅・市区町村（build_data.py の後）
PYTHONUTF8=1 python scripts/hitori/facilities.py     # 全国施設名索引（build_data.py の後）
PYTHONUTF8=1 python tests/hitori_all.py              # 全17スイート
```

`places.py` と `facilities.py` はどちらも `build_data.py` の出力を読む。順序を守ること。

## フェーズ2B以降（この計画には含まない）

- 情報の自動収集と再構成（検索API経由の事実抽出、裏付け件数による信頼度、矛盾の記録）
- HotPepper / Yahoo の統合（要APIキー登録）
- SEO、PWA、共有
- `hitori.html` の全面分割
