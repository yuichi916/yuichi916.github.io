# ひとり歓迎マップ フェーズ2B 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 多数のサイトから集めた事実で3軸を推定から実証へ置き換え、どこを調べたかを利用者に見せる。

**Architecture:** 収集はビルド前の作業。`curate.py` が語彙・禁止ドメイン・裏付け件数・調整上限をコードで強制し `curated.json` を作る。`build_data.py` が推定値と実効値の両方を出力し、`hitori.html` は差分と出典を表示する。

**Tech Stack:** Python 3.10 標準ライブラリのみ、素の HTML+CSS+JS、Playwright、Node

## Global Constraints

- Python は **標準ライブラリのみ**、テストは `main()` を持つ素のスクリプト（**pytest は使わない**）
- テスト実行は必ず `PYTHONUTF8=1`。UTF-8（BOMなし）。Python ファイル冒頭に `# -*- coding: utf-8 -*-`
- コメントとドキストリングは**日本語**。commit は Conventional Commits、scope は `hitori`、メッセージは日本語
- `hitori.html` の commit 前に `PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html` が exit 0
- **`git add -A` を使わない**（作業ツリーに他プロジェクトの未コミット変更がある）
- Bash から commit するとき PowerShell のヒアストリング記法（`@'...'@`）を使わない
- **禁止ドメイン**: `tabelog.com` / `sauna-ikitai.com` / `retty.me`。自動アクセスを禁止しているため、事実の出所として数えない
- **自由記述を保存しない。** 集めるのは語彙にある値だけ。他人の文章を持ち込まない
- **調べていない施設に「調べた上で何も無かった」と読める表示をしない**
- しきい値をコードに二重に持たない

---

### Task 1: enrich.py — 語彙と調整表

**Files:**
- Create: `scripts/hitori/enrich.py`
- Test: `tests/hitori_enrich_test.py`

**Interfaces:**
- Produces:
  - `FACT_VOCAB: dict[str, set|type]` — 事実名 → 許される値
  - `ADJUST: dict[tuple[str, str], tuple[str, int]]` — (事実, 値) → (軸, 増減)
  - `MAX_ADJUST = 2`
  - `BLOCKED_DOMAINS: frozenset[str]`
  - `OFFICIAL_ONLY_FACTS: frozenset[str]` — 公式1件で足りる事実
  - `normalize_domain(url) -> str`
  - `apply_adjust(est: dict, facts: list) -> dict` — `{'solo':int,'quiet':int,'easy':int}` を返す

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_enrich_test.py`:

```python
# -*- coding: utf-8 -*-
"""事実の語彙と、軸への反映。

軸は上書きせず推定値からの差分にする。1つの事実で3から5へ飛ぶのは
根拠に対して主張が強すぎるので、軸ごとに±2で頭打ちにする。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import enrich


def test_normalize_domain():
    assert enrich.normalize_domain("https://www.city.beppu.oita.jp/sisetu/x.html") == "city.beppu.oita.jp"
    assert enrich.normalize_domain("http://danish.hateblo.jp/entry/1") == "danish.hateblo.jp"
    assert enrich.normalize_domain("https://NOTE.com/abc") == "note.com"


def test_blocked_domains():
    for u in ("https://tabelog.com/oita/x", "https://sauna-ikitai.com/y", "https://retty.me/z"):
        assert enrich.is_blocked(u), u
    assert not enrich.is_blocked("https://city.beppu.oita.jp/x")


def test_vocab_rejects_unknown():
    assert enrich.valid_fact("payment_method", "ticket_machine")
    assert not enrich.valid_fact("payment_method", "なんとなく親切")
    assert not enrich.valid_fact("親切さ", "high")
    assert enrich.valid_fact("counter_seats", 6)
    assert not enrich.valid_fact("counter_seats", "6席")
    assert not enrich.valid_fact("counter_seats", -1)


def test_adjust_direction():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    tm = [{"k": "payment_method", "v": "ticket_machine", "n": 2}]
    assert enrich.apply_adjust(est, tm)["easy"] == 4
    cp = [{"k": "payment_method", "v": "counter_person", "n": 2}]
    assert enrich.apply_adjust(est, cp)["easy"] == 2


def test_support_below_two_does_not_move():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    one = [{"k": "payment_method", "v": "ticket_machine", "n": 1}]
    assert enrich.apply_adjust(est, one) == est


def test_official_counts_for_factual_fields_only():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    # price は軸に効かないが、公式1件で採用されること自体は curate 側の話。
    # 軸に効く事実は公式1件でも動かさない（主観を含むため）。
    f = [{"k": "clientele", "v": "local", "n": 1, "official": True}]
    assert enrich.apply_adjust(est, f) == est


def test_adjust_is_capped():
    est = {"solo": 4, "quiet": 3, "easy": 3}
    many = [
        {"k": "payment_method", "v": "ticket_machine", "n": 3},
        {"k": "reservation", "v": "none", "n": 3},
        {"k": "first_timer", "v": "easy", "n": 3},
    ]
    out = enrich.apply_adjust(est, many)
    assert out["easy"] == 5, out          # 3 + 2（上限）
    assert out["easy"] - est["easy"] <= enrich.MAX_ADJUST


def test_adjust_stays_in_range():
    est = {"solo": 3, "quiet": 5, "easy": 2}
    f = [{"k": "payment_method", "v": "counter_person", "n": 2},
         {"k": "clientele", "v": "local", "n": 2},
         {"k": "silence", "v": "posted", "n": 2}]
    out = enrich.apply_adjust(est, f)
    assert out["easy"] == 1, out          # 2 - 2 だが1で下限
    assert out["quiet"] == 5, out         # 5 が上限
    for k, v in out.items():
        assert 1 <= v <= 5, (k, v)


def test_conflict_freezes_the_axis():
    """相反する事実があるとその軸を動かさない。どちらかを選ばない。"""
    est = {"solo": 4, "quiet": 4, "easy": 3}
    f = [{"k": "payment_method", "v": "ticket_machine", "n": 2},
         {"k": "payment_method", "v": "counter_person", "n": 2}]
    assert enrich.apply_adjust(est, f)["easy"] == 3


def test_does_not_mutate_input():
    est = {"solo": 4, "quiet": 4, "easy": 3}
    before = dict(est)
    enrich.apply_adjust(est, [{"k": "payment_method", "v": "ticket_machine", "n": 2}])
    assert est == before


def main():
    test_normalize_domain()
    test_blocked_domains()
    test_vocab_rejects_unknown()
    test_adjust_direction()
    test_support_below_two_does_not_move()
    test_official_counts_for_factual_fields_only()
    test_adjust_is_capped()
    test_adjust_stays_in_range()
    test_conflict_freezes_the_axis()
    test_does_not_mutate_input()
    print("OK: enrich")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_enrich_test.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'enrich'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/enrich.py`:

```python
# -*- coding: utf-8 -*-
"""集めた事実の語彙と、3軸への反映。

3軸は業態からの機械的な推定である。実際に確認できた事実があれば、その
ぶんだけ推定を補正する。上書きはしない。差分として持ち、推定値と実効値の
両方を出力する（何を根拠に変えたのかを隠さないため）。

自由記述は扱わない。ここにある語彙の値だけを受け付ける。他人の文章を
持ち込まないための構造上の制約であり、運用の約束ではない。
"""
from urllib.parse import urlparse

# 自動アクセスを禁止しているサイト。著作権ではなくアクセス規約の問題なので、
# 検索結果に出てきても事実の出所として数えない。
BLOCKED_DOMAINS = frozenset({"tabelog.com", "sauna-ikitai.com", "retty.me"})

AXES = ("solo", "quiet", "easy")
MIN_SUPPORT = 2          # 軸を動かすのに必要な独立ドメイン数
MAX_ADJUST = 2           # 軸ごとの補正の上限（絶対値）

# 事実名 → 許される値。int は非負整数。
FACT_VOCAB = {
    "payment_method": {"ticket_machine", "counter_person", "cashless_ok", "cash_only"},
    "counter_seats": int,
    "seats_total": int,
    "reservation": {"none", "possible", "required"},
    "silence": {"posted", "observed"},
    "clientele": {"local", "tourist", "solo_common"},
    "first_timer": {"easy", "custom_exists"},
    "hours": str,
    "closed_days": str,
    "price": int,
}

# 公式サイト1件で採用してよい事実。客観的で、自治体や施設自身が
# 一次情報を持つものに限る。主観を含む事実（客層など）は含めない。
OFFICIAL_ONLY_FACTS = frozenset({"hours", "closed_days", "price"})

# (事実, 値) → (軸, 増減)
ADJUST = {
    ("payment_method", "ticket_machine"): ("easy", +1),
    ("payment_method", "counter_person"): ("easy", -1),
    ("reservation", "none"): ("easy", +1),
    ("reservation", "required"): ("easy", -2),
    ("first_timer", "easy"): ("easy", +1),
    ("first_timer", "custom_exists"): ("easy", -1),
    ("clientele", "local"): ("easy", -1),
    ("clientele", "solo_common"): ("solo", +1),
    ("silence", "posted"): ("quiet", +1),
    ("silence", "observed"): ("quiet", +1),
}


def normalize_domain(url):
    """URL → 小文字のホスト名（先頭の www. を除く）。"""
    host = (urlparse(str(url)).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def is_blocked(url):
    d = normalize_domain(url)
    return any(d == b or d.endswith("." + b) for b in BLOCKED_DOMAINS)


def valid_fact(key, value):
    spec = FACT_VOCAB.get(key)
    if spec is None:
        return False
    if spec is int:
        return isinstance(value, int) and not isinstance(value, bool) and value >= 0
    if spec is str:
        return isinstance(value, str) and bool(value.strip())
    return value in spec


def _conflicting_keys(facts):
    """同じ事実名に異なる値がある（＝情報が分かれている）ものの集合。"""
    seen = {}
    bad = set()
    for f in facts:
        k, v = f["k"], f["v"]
        if k in seen and seen[k] != v:
            bad.add(k)
        seen.setdefault(k, v)
    return bad


def apply_adjust(est, facts):
    """推定値 est に事実 facts を反映した実効値を返す。est は変更しない。

    - 裏付けが MIN_SUPPORT 未満の事実は無視する
    - 情報が分かれている事実は無視する（どちらかを選ばない）
    - 軸ごとの補正は ±MAX_ADJUST で頭打ち、最後に 1..5 へ収める
    """
    conflicts = _conflicting_keys(facts)
    delta = {a: 0 for a in AXES}

    for f in facts:
        k, v = f["k"], f["v"]
        if k in conflicts:
            continue
        if f.get("n", 0) < MIN_SUPPORT:
            continue          # 公式1件は事実の採用には効くが、軸は動かさない
        hit = ADJUST.get((k, v))
        if hit is None:
            if k == "counter_seats" and isinstance(v, int) and v >= 1:
                hit = ("solo", +1)
            else:
                continue
        axis, amount = hit
        delta[axis] += amount

    out = {}
    for a in AXES:
        d = max(-MAX_ADJUST, min(MAX_ADJUST, delta[a]))
        out[a] = max(1, min(5, est[a] + d))
    return out
```

- [ ] **Step 4: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_enrich_test.py`
Expected: `OK: enrich`

- [ ] **Step 5: Commit**

```bash
git add scripts/hitori/enrich.py tests/hitori_enrich_test.py
git commit -m "feat(hitori): 事実の語彙と3軸への反映を追加"
```

---

### Task 2: curate.py — 事実の検証と保存

**Files:**
- Create: `scripts/hitori/curate.py`
- Test: `tests/hitori_curate_test.py`

**Interfaces:**
- Consumes: `enrich.BLOCKED_DOMAINS` / `valid_fact` / `normalize_domain` / `OFFICIAL_ONLY_FACTS`
- Produces:
  - `class RejectedError(ValueError)`
  - `build_entry(raw) -> dict` — 生の入力を検証して `{"checked","facts"}` に整える
  - `merge(curated, entries) -> dict`
  - `data/hitori/curated.json`

`curated.json` の形:

```json
{
  "n1234": {
    "checked": "2026-08-08",
    "facts": [
      {"k": "payment_method", "v": "counter_person", "n": 2,
       "src": ["city.beppu.oita.jp", "danish.hateblo.jp"],
       "urls": ["https://www.city.beppu.oita.jp/...", "https://danish.hateblo.jp/..."],
       "official": true, "conflict": false}
    ]
  }
}
```

- [ ] **Step 1: 失敗するテストを書く**

`tests/hitori_curate_test.py`:

```python
# -*- coding: utf-8 -*-
"""集めた事実の検証。禁止ドメイン・語彙・重複はコードで弾く。

運用の約束にすると守られなくなる。気づかないまま集め続けるのが一番悪い
ので、拒否は黙って捨てるのではなく例外にする。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import curate


def _raw(**kw):
    base = {
        "id": "n1", "checked": "2026-08-08",
        "facts": [{"k": "payment_method", "v": "ticket_machine",
                   "urls": ["https://a.example/1", "https://b.example/2"]}],
    }
    base.update(kw)
    return base


def test_blocked_domain_raises():
    raw = _raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                       "urls": ["https://tabelog.com/x", "https://b.example/2"]}])
    try:
        curate.build_entry(raw)
    except curate.RejectedError as e:
        assert "tabelog.com" in str(e), str(e)
    else:
        raise AssertionError("禁止ドメインが通ってしまった")


def test_unknown_fact_raises():
    for bad in ({"k": "親切さ", "v": "high", "urls": ["https://a.example/1"]},
                {"k": "payment_method", "v": "なんとなく", "urls": ["https://a.example/1"]}):
        try:
            curate.build_entry(_raw(facts=[bad]))
        except curate.RejectedError:
            pass
        else:
            raise AssertionError(f"語彙にない事実が通った: {bad}")


def test_same_domain_counts_once():
    raw = _raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                       "urls": ["https://a.example/1", "https://a.example/2",
                                "https://www.a.example/3"]}])
    e = curate.build_entry(raw)
    assert e["facts"][0]["n"] == 1, e["facts"][0]
    assert e["facts"][0]["src"] == ["a.example"], e["facts"][0]


def test_support_counts_distinct_domains():
    e = curate.build_entry(_raw())
    assert e["facts"][0]["n"] == 2
    assert sorted(e["facts"][0]["src"]) == ["a.example", "b.example"]


def test_official_flag():
    raw = _raw(facts=[{"k": "price", "v": 200,
                       "urls": ["https://www.city.beppu.oita.jp/x"]}])
    e = curate.build_entry(raw)
    assert e["facts"][0]["official"] is True
    # 公式でない1件は official にならない
    raw2 = _raw(facts=[{"k": "price", "v": 200, "urls": ["https://blog.example/x"]}])
    assert curate.build_entry(raw2)["facts"][0]["official"] is False


def test_conflict_is_marked_not_dropped():
    raw = _raw(facts=[
        {"k": "payment_method", "v": "ticket_machine", "urls": ["https://a.example/1", "https://b.example/1"]},
        {"k": "payment_method", "v": "counter_person", "urls": ["https://c.example/1", "https://d.example/1"]},
    ])
    e = curate.build_entry(raw)
    assert len(e["facts"]) == 2, "矛盾する主張が捨てられている"
    assert all(f["conflict"] for f in e["facts"])


def test_no_free_text_is_stored():
    """自由記述の欄を持ち込めないこと。"""
    raw = _raw()
    raw["facts"][0]["note"] = "店員さんがとても親切でした"
    e = curate.build_entry(raw)
    assert "note" not in e["facts"][0], e["facts"][0]
    allowed = {"k", "v", "n", "src", "urls", "official", "conflict"}
    assert set(e["facts"][0]) <= allowed, set(e["facts"][0])


def test_urls_without_scheme_raise():
    try:
        curate.build_entry(_raw(facts=[{"k": "payment_method", "v": "ticket_machine",
                                        "urls": ["a.example/1"]}]))
    except curate.RejectedError:
        pass
    else:
        raise AssertionError("スキームの無いURLが通った")


def test_empty_urls_raise():
    try:
        curate.build_entry(_raw(facts=[{"k": "payment_method", "v": "ticket_machine", "urls": []}]))
    except curate.RejectedError:
        pass
    else:
        raise AssertionError("出典の無い事実が通った")


def test_merge_replaces_by_id():
    a = {"n1": {"checked": "2026-01-01", "facts": []}}
    b = curate.merge(a, [curate.build_entry(_raw())])
    assert b["n1"]["checked"] == "2026-08-08"
    assert len(b["n1"]["facts"]) == 1
    assert a["n1"]["checked"] == "2026-01-01", "入力を破壊している"


def main():
    test_blocked_domain_raises()
    test_unknown_fact_raises()
    test_same_domain_counts_once()
    test_support_counts_distinct_domains()
    test_official_flag()
    test_conflict_is_marked_not_dropped()
    test_no_free_text_is_stored()
    test_urls_without_scheme_raise()
    test_empty_urls_raise()
    test_merge_replaces_by_id()
    print("OK: curate")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_curate_test.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'curate'`

- [ ] **Step 3: 実装を書く**

`scripts/hitori/curate.py`:

```python
# -*- coding: utf-8 -*-
"""集めた事実を検証して curated.json に書く。

禁止ドメイン・語彙・重複はここで弾く。運用の約束にすると守られなくなり、
気づかないまま集め続けることになる。だから黙って捨てず例外にする。

自由記述は保存しない。facts の各要素は決まったキーだけを持つ。
"""
import json
import sys
from datetime import date
from pathlib import Path

import enrich

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "hitori" / "curated.json"

# 保存してよいキー。これ以外は落とす（自由記述を持ち込ませないため）。
FACT_KEYS = ("k", "v", "n", "src", "urls", "official", "conflict")

# 公式とみなすドメインの特徴。自治体（.lg.jp / city.*）と go.jp。
_OFFICIAL_SUFFIXES = (".lg.jp", ".go.jp")
_OFFICIAL_PREFIXES = ("city.", "town.", "vill.", "pref.")


class RejectedError(ValueError):
    """検証に落ちた入力。黙って捨てず、ここで止める。"""


def _is_official(domain):
    return (domain.endswith(_OFFICIAL_SUFFIXES)
            or domain.startswith(_OFFICIAL_PREFIXES))


def _domains(urls):
    if not urls:
        raise RejectedError("出典URLの無い事実は受け付けない")
    out = []
    for u in urls:
        if not str(u).startswith(("http://", "https://")):
            raise RejectedError(f"スキームの無いURL: {u}")
        if enrich.is_blocked(u):
            raise RejectedError(
                f"自動アクセスを禁止しているサイトは出所にできない: {enrich.normalize_domain(u)}")
        d = enrich.normalize_domain(u)
        if not d:
            raise RejectedError(f"ホスト名を取れないURL: {u}")
        if d not in out:
            out.append(d)
    return out


def build_entry(raw):
    """生の入力を検証して {"checked", "facts"} に整える。"""
    facts_in = raw.get("facts") or []
    if not facts_in:
        raise RejectedError("事実がひとつも無い")

    built = []
    for f in facts_in:
        k, v = f.get("k"), f.get("v")
        if not enrich.valid_fact(k, v):
            raise RejectedError(f"語彙にない事実: {k}={v!r}")
        doms = _domains(f.get("urls"))
        urls = [u for u in f["urls"] if not enrich.is_blocked(u)]
        built.append({
            "k": k, "v": v, "n": len(doms), "src": doms, "urls": urls,
            "official": any(_is_official(d) for d in doms) and k in enrich.OFFICIAL_ONLY_FACTS,
            "conflict": False,
        })

    # 同じ事実名に異なる値があれば、両方を残して印を付ける。どちらかを選ばない。
    by_key = {}
    for b in built:
        by_key.setdefault(b["k"], set()).add(json.dumps(b["v"], ensure_ascii=False))
    for b in built:
        b["conflict"] = len(by_key[b["k"]]) > 1

    for b in built:
        assert set(b) <= set(FACT_KEYS), set(b)

    return {"checked": raw.get("checked") or date.today().isoformat(), "facts": built}


def merge(curated, entries):
    """施設IDごとに置き換える。入力の dict は変更しない。"""
    out = {k: v for k, v in curated.items()}
    for e in entries:
        out[e["id"]] = {"checked": e["checked"], "facts": e["facts"]}
    return out


def main():
    """標準入力から JSON の配列を読み、検証して curated.json へ反映する。

    入力の各要素は {"id","checked","facts":[{"k","v","urls"}]} の形。
    """
    try:
        raw_list = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"入力がJSONとして読めない: {e}", file=sys.stderr)
        sys.exit(1)

    entries = []
    for raw in raw_list:
        if not raw.get("id"):
            print("id の無い項目がある", file=sys.stderr)
            sys.exit(1)
        try:
            e = build_entry(raw)
        except RejectedError as err:
            print(f"{raw['id']}: {err}", file=sys.stderr)
            sys.exit(1)
        e["id"] = raw["id"]
        entries.append(e)

    curated = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    merged = merge(curated, entries)
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=1, sort_keys=True),
                   encoding="utf-8")
    print(f"wrote {OUT}（{len(merged):,}施設 / 今回 {len(entries)}件）")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_curate_test.py`
Expected: `OK: curate`

- [ ] **Step 5: 実データで1件通す**

Run:
```bash
PYTHONUTF8=1 python -c "
import json,pathlib
d=json.loads(pathlib.Path('data/hitori/pref/44.json').read_text(encoding='utf-8'))
i={k:n for n,k in enumerate(d['fields'])}
for r in d['items']:
    if r[i['name']]=='田の湯温泉': print(r[i['id']]); break
"
```
その施設IDを使って:
```bash
echo '[{"id":"REPLACE_WITH_ID","checked":"2026-08-08","facts":[
 {"k":"price","v":200,"urls":["https://www.city.beppu.oita.jp/sisetu/shieionsen/detail6.html","https://beppu88onsen.com/beppu/tanoyu/"]},
 {"k":"payment_method","v":"counter_person","urls":["https://danish.hateblo.jp/entry/20220727/1658904281","https://beppu88onsen.com/beppu/tanoyu/"]},
 {"k":"clientele","v":"local","urls":["https://danish.hateblo.jp/entry/20220727/1658904281","https://beppu88onsen.com/beppu/tanoyu/"]}
]}]' | PYTHONUTF8=1 python scripts/hitori/curate.py
```
Expected: `wrote ...curated.json（1施設 / 今回 1件）`

書けたら `data/hitori/curated.json` を確認し、`note` のような自由記述欄が無いこと、`n` が2になっていることを見ること。

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/curate.py tests/hitori_curate_test.py data/hitori/curated.json
git commit -m "feat(hitori): 事実の検証と保存を追加"
```

---

### Task 3: build_data.py — 推定値と実効値の両方を出す

**Files:**
- Modify: `scripts/hitori/build_data.py`
- Modify: `scripts/hitori/validate.py`
- Modify: `tests/hitori_build_test.py`
- Modify: `tests/hitori_validate_test.py`

**Interfaces:**
- Consumes: `enrich.apply_adjust`、`data/hitori/curated.json`
- Produces: `pref/*.json` の `fields` に3列追加 — `solo_est` / `quiet_est` / `easy_est`、および `checked`（調査日、未調査は空文字）
  - `solo` / `quiet` / `easy` は**実効値**になる（表示・絞り込みはこれを使う）
  - `summary.json` に `checked_count`（調査済み件数）を追加

- [ ] **Step 1: 失敗するテストを追加**

`tests/hitori_build_test.py` に追加し `main()` から呼ぶ:

```python
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
```

`tests/hitori_validate_test.py` の `EXPECTED_FIELDS` 相当を4列ぶん更新する。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_build_test.py`
Expected: FAIL — `solo_est が列に無い`

- [ ] **Step 3: build_data.py を変更**

`build_data.py` の冒頭に `import enrich` を足し、レコードを出力する直前で:

```python
def _enrich(records, curated):
    """curated.json の事実で3軸を補正する。推定値は別列に残す。

    上書きにすると、あとから「なぜこの値なのか」を追えなくなる。
    """
    applied = 0
    for r in records:
        r["solo_est"], r["quiet_est"], r["easy_est"] = r["solo"], r["quiet"], r["easy"]
        r["checked"] = ""
        entry = curated.get(r["id"])
        if not entry:
            continue
        r["checked"] = entry.get("checked", "")
        eff = enrich.apply_adjust(
            {"solo": r["solo"], "quiet": r["quiet"], "easy": r["easy"]}, entry.get("facts", []))
        r["solo"], r["quiet"], r["easy"] = eff["solo"], eff["quiet"], eff["easy"]
        applied += 1
    return applied
```

`main()` で `curated.json` を読み（無ければ `{}`）、`_enrich` を呼び、件数を標準出力に出す。`summary.json` に `"checked_count": applied` を足す。

**現データに無い施設IDが curated.json にあれば警告して読み飛ばし、件数を報告する**（黙って無視しない）:

```python
    missing = set(curated) - {r["id"] for r in records}
    if missing:
        print(f"警告: curated.json の {len(missing)} 件が現データに見つからない", file=sys.stderr)
```

`FIELDS`（出力する列）に `"solo_est", "quiet_est", "easy_est", "checked"` を足す。

- [ ] **Step 4: validate.py を更新**

`EXPECTED_FIELDS` に4列を足す（19列 → 23列）。`checked` は空文字または `YYYY-MM-DD` であることを検証する。

- [ ] **Step 5: 再ビルドしてテストを通す**

Run:
```bash
PYTHONUTF8=1 python scripts/hitori/build_data.py
PYTHONUTF8=1 python scripts/hitori/places.py
PYTHONUTF8=1 python scripts/hitori/facilities.py
PYTHONUTF8=1 python tests/hitori_build_test.py
PYTHONUTF8=1 python tests/hitori_validate_test.py
PYTHONUTF8=1 python tests/hitori_facilities_test.py
```
Expected: すべて `OK:`

`places.py` と `facilities.py` は `build_data.py` の出力を読むので、**必ずこの順で**実行すること。`facilities.json` は行番号を持つので、再ビルドすると `updated` が変わり、走らせ忘れると版ずれで全国検索が止まる。

- [ ] **Step 6: Commit**

```bash
git add scripts/hitori/build_data.py scripts/hitori/validate.py \
        tests/hitori_build_test.py tests/hitori_validate_test.py \
        data/hitori/pref data/hitori/summary.json data/hitori/facilities.json
git commit -m "feat(hitori): 集めた事実で3軸を補正し推定値も残す"
```

---

### Task 4: hitori.html — 確認できたことを見せる

**Files:**
- Modify: `hitori.html`
- Modify: `tests/hitori_render_test.py`

**Interfaces:**
- Consumes: `it.checked` / `it.solo_est` / `it.quiet_est` / `it.easy_est`、`SUMMARY.checked_count`
- Produces: 詳細シートの「確認できたこと」の節

- [ ] **Step 1: 失敗するテストを追加**（`main()` から呼ぶこと）

```python
def test_unchecked_facility_says_so(context, page):
    """調べていない施設に、調べた上で何も無かったと読める表示をしない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#search-list .item", timeout=20000)
    p.click("#search-list .item")
    p.wait_for_selector("#facility dl", timeout=15000)
    body = p.inner_text("#facility")
    assert ("まだ調べていません" in body) or ("確認できたこと" in body), body[:300]
    p.close()


def test_axis_shows_estimate_when_adjusted(context, page):
    """実効値が推定値と違うとき、両方を出す。何を根拠に変えたか隠さない。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#search-list .item", timeout=20000)
    # 補正が入った施設を人工的に作って描画する
    p.evaluate("""() => {
      const it = currentSearchResults()[0];
      it.checked = '2026-08-08'; it.easy_est = it.easy; it.easy = Math.min(5, it.easy + 1);
      FOUND_BY_SEARCH.set(it.id, it); openFacility(it.id);
    }""")
    p.wait_for_selector("#facility dl", timeout=15000)
    body = p.inner_text("#facility")
    assert "推定" in body, body[:300]
    p.close()


def test_curated_urls_shown_without_quoting(context, page):
    """出典URLは出す。主張の文章は出さない（自由記述は保存していない）。"""
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#search-list .item", timeout=20000)
    p.evaluate("""() => {
      const it = currentSearchResults()[0];
      it.checked = '2026-08-08';
      CURATED[it.id] = { checked: '2026-08-08', facts: [
        { k: 'payment_method', v: 'ticket_machine', n: 2,
          src: ['a.example','b.example'], urls: ['https://a.example/1','https://b.example/2'],
          official: false, conflict: false }] };
      FOUND_BY_SEARCH.set(it.id, it); openFacility(it.id);
    }""")
    p.wait_for_selector("#facility .curated", timeout=15000)
    body = p.inner_text("#facility .curated")
    assert "券売機" in body, body
    assert "2件" in body, body
    assert p.eval_on_selector_all("#facility .curated a", "e => e.length") == 2
    p.close()


def test_conflict_is_disclosed(context, page):
    context.grant_permissions(["geolocation"])
    context.set_geolocation(TOKYO)
    p = context.new_page()
    p.goto(BASE)
    p.wait_for_function("window.__searchReady === true", timeout=30000)
    p.wait_for_selector("#search-list .item", timeout=20000)
    p.evaluate("""() => {
      const it = currentSearchResults()[0];
      it.checked = '2026-08-08';
      CURATED[it.id] = { checked: '2026-08-08', facts: [
        { k: 'payment_method', v: 'ticket_machine', n: 2, src: ['a.example','b.example'],
          urls: ['https://a.example/1','https://b.example/2'], official: false, conflict: true },
        { k: 'payment_method', v: 'counter_person', n: 2, src: ['c.example','d.example'],
          urls: ['https://c.example/1','https://d.example/2'], official: false, conflict: true }] };
      FOUND_BY_SEARCH.set(it.id, it); openFacility(it.id);
    }""")
    p.wait_for_selector("#facility .curated", timeout=15000)
    assert "情報が分かれています" in p.inner_text("#facility .curated")
    p.close()
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: FAIL — `#facility .curated` が見つからない

- [ ] **Step 3: 実装する**

`hitori.html` に追加:

```javascript
// 集めた事実。ビルド時に curated.json から埋め込むのではなく、必要になった
// 時点で取りに行く（未調査が大半なので全員に配らない）。
const CURATED = {};
let curatedLoading = null;

function ensureCurated() {
  if (curatedLoading) return curatedLoading;
  curatedLoading = fetch('data/hitori/curated.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(doc => { Object.assign(CURATED, doc); return CURATED; })
    .catch(err => { curatedLoading = null; throw err; });
  return curatedLoading;
}

const FACT_JA = {
  'payment_method:ticket_machine': '券売機あり',
  'payment_method:counter_person': '番台・対面での支払い',
  'payment_method:cashless_ok': 'キャッシュレス可',
  'payment_method:cash_only': '現金のみ',
  'reservation:none': '予約不可（当日入店）',
  'reservation:possible': '予約可',
  'reservation:required': '予約が必要',
  'silence:posted': '黙浴の掲示あり',
  'silence:observed': '会話が少ない',
  'clientele:local': '地元の人が中心',
  'clientele:tourist': '観光客が多い',
  'clientele:solo_common': '一人客が多い',
  'first_timer:easy': '初めてでも入りやすい',
  'first_timer:custom_exists': '作法がある',
};
const FACT_KEY_JA = { counter_seats: 'カウンター席', seats_total: '席数',
                      hours: '営業時間', closed_days: '定休日', price: '料金' };

function factLabel(f) {
  const fixed = FACT_JA[`${f.k}:${f.v}`];
  if (fixed) return fixed;
  const unit = f.k === 'price' ? '円' : (f.k === 'counter_seats' || f.k === 'seats_total') ? '席' : '';
  return `${FACT_KEY_JA[f.k] || f.k} ${f.v}${unit}`;
}

// 出典URLは出す。主張の文章は出さない（そもそも保存していない）。
function renderCurated(it) {
  const entry = CURATED[it.id];
  if (!it.checked) {
    return `<div class="curated unchecked">この施設はまだ調べていません。
      3軸は業態からの推定です。</div>`;
  }
  if (!entry || !entry.facts.length) return '';
  const rows = entry.facts.map(f => {
    const support = f.official ? '公式サイト' : `${f.n}件`;
    const links = f.urls.map((u, i) =>
      `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${i + 1}</a>`).join(' ');
    return `<li${f.conflict ? ' class="conflict"' : ''}>${escapeHtml(factLabel(f))}
      <span class="sup">${support}</span> <span class="srcs">${links}</span></li>`;
  }).join('');
  const conflicted = [...new Set(entry.facts.filter(f => f.conflict)
    .map(f => FACT_KEY_JA[f.k] || FACT_JA[`${f.k}:${f.v}`] || f.k))];
  const note = conflicted.length
    ? `<p class="conflict-note">情報が分かれています: ${escapeHtml(conflicted.join('・'))}。
       この点は判断を保留し、3軸に反映していません。</p>` : '';
  return `<div class="curated"><h4>確認できたこと（${escapeHtml(entry.checked)} 時点）</h4>
    <ul>${rows}</ul>${note}</div>`;
}
```

3軸の行を、実効値と推定値が違うとき両方出す形に変える:

```javascript
      <dt>ひとり度</dt><dd>${axCell(it, 'solo')}</dd>
      <dt>静けさ</dt><dd>${axCell(it, 'quiet')}</dd>
      <dt>入りやすさ</dt><dd>${axCell(it, 'easy')}</dd>
```

```javascript
// 補正が入っているときは推定値も出す。何を根拠に変えたのかを隠さない。
function axCell(it, k) {
  const est = it[k + '_est'];
  const base = `${it[k]} — ${AX_LABEL[k][it[k]]}`;
  return (est != null && est !== it[k])
    ? `${base}<br><small>業態からの推定は ${est}。確認できた事実により補正</small>`
    : base;
}
```

`openFacility` の中で `ensureCurated()` を待ってから `renderCurated(it)` を差し込む。取得に失敗しても詳細シート自体は開くこと（`catch` で空文字にし、コンソールに警告）。

CSS:

```css
.curated { border-top:1px solid var(--line); margin-top:.8rem; padding-top:.7rem; font-size:.82rem; }
.curated h4 { margin:0 0 .4rem; font-size:.85rem; }
.curated ul { list-style:none; padding:0; margin:0; display:grid; gap:.25rem; }
.curated li.conflict { opacity:.7; }
.curated .sup { color:var(--muted); font-size:.75rem; margin-left:.4rem; }
.curated .srcs a { margin-left:.25rem; }
.curated .conflict-note { color:var(--muted); margin:.5rem 0 0; }
.curated.unchecked { color:var(--muted); }
```

`window` 公開に `CURATED` と `ensureCurated` を足す。

- [ ] **Step 4: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_render_test.py`
Expected: `OK: render`

- [ ] **Step 5: 重複const宣言チェックと commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add hitori.html tests/hitori_render_test.py
git commit -m "feat(hitori): 確認できたことと出典を詳細シートに出す"
```

---

### Task 5: 調査対象の優先順位と、実際の収集

**Files:**
- Modify: `scripts/hitori/research_queue.py`
- Modify: `tests/hitori_queue_test.py`
- Modify: `data/hitori/curated.json`

**Interfaces:**
- Produces: `rank_targets(prefdocs, curated, limit)` に「当たりやすさ」を加味した順位

- [ ] **Step 1: 失敗するテストを追加**

```python
def test_public_baths_rank_high():
    """市営・公営の入浴施設は自治体サイトがあり必ず当たるので先に調べる。"""
    docs = {44: {"fields": ["id", "name", "cat", "kind", "solo", "quiet", "easy", "conf",
                            "hidden", "hidden_n", "iso", "chain"],
                 "items": [
                     ["n1", "市営 田の湯温泉", "bath", "sento", 4, 4, 3, 0, 0.0, 2, 300, 0],
                     ["n2", "適当なラーメン", "eat", "ramen", 4, 4, 3, 0, 0.0, 2, 300, 0],
                 ]}}
    got = [t["id"] for t in research_queue.rank_targets(docs, {}, limit=2)]
    assert got[0] == "n1", got


def test_checked_are_excluded():
    docs = {44: {"fields": ["id", "name", "cat", "kind", "solo", "quiet", "easy", "conf",
                            "hidden", "hidden_n", "iso", "chain"],
                 "items": [["n1", "市営 田の湯温泉", "bath", "sento", 4, 4, 3, 0, 0.0, 2, 300, 0]]}}
    assert research_queue.rank_targets(docs, {"n1": {"checked": "2026-08-08"}}, limit=5) == []
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `PYTHONUTF8=1 python tests/hitori_queue_test.py`

- [ ] **Step 3: research_queue.py の既存バグを直す**

`rank_targets` は `r["score"]` を参照しているが、**`score` 列は既に削除されている**（現在の列は `solo` / `quiet` / `easy`）。そのため `PYTHONUTF8=1 python scripts/hitori/research_queue.py` は `KeyError: 'score'` で落ちる。既存テストは `score` を含む架空データを渡しているため、この破綻を検出できていない。

境界値の考え方（「一番判定を間違えやすいところを先に調べる」）は3軸に移す。**いずれかの軸が3（中央）なら境界とみなす**:

```python
BOUNDARY_VALUE = 3   # 3軸の中央。ここが一番判定を間違えやすい

def _is_boundary(r):
    return any(r[a] == BOUNDARY_VALUE for a in ("solo", "quiet", "easy"))
```

`rank_targets` の `r["score"] == BOUNDARY_SCORE` を `_is_boundary(r)` に、出力の `"score": r["score"]` を `"axes": [r["solo"], r["quiet"], r["easy"]]` に置き換える。

**除外条件も直す。** 現在は `conf >= 1` で除外しているが、調査済みかどうかは `curated` が持つ情報なので `r["id"] in curated` で除外する（`conf` は別の意味の列である）。

既存テストの架空データから `score` を消し、実データで `rank_targets` が動くことを確かめるテストを足す:

```python
def test_runs_on_real_data():
    """架空データだけだと列名の変更に気づけない（score 削除時に実際に見逃した）。"""
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    docs = {}
    for f in sorted((root / "data" / "hitori" / "pref").glob("*.json"))[:3]:
        docs[int(f.stem)] = json.loads(f.read_text(encoding="utf-8"))
    got = research_queue.rank_targets(docs, {}, limit=10)
    assert len(got) == 10, len(got)
    assert all(t["id"] for t in got)
```

そのうえで、スコアに以下を足す。既存の希少カテゴリの重みは残す。

```python
PUBLIC_BATH_BONUS = 6      # 自治体サイトがあり必ず当たる
ISOLATED_BONUS = 4         # そこしか無いので調べる価値が高い
GEM_BONUS = 3

_PUBLIC_RE = re.compile(r"(市営|町営|村営|公衆浴場|共同浴場)")
```

`rank_targets` の中で、`cat == "bath"` かつ名前が `_PUBLIC_RE` に一致すれば `PUBLIC_BATH_BONUS`、孤立していれば `ISOLATED_BONUS`、穴場なら `GEM_BONUS` を加算する。孤立と穴場の判定は `summary.json` のしきい値を渡して行い、**モジュール内にしきい値を書かない**。

- [ ] **Step 4: テストを実行して通す**

Run: `PYTHONUTF8=1 python tests/hitori_queue_test.py`
Expected: `OK: research_queue`

- [ ] **Step 5: 調査対象を出す**

Run: `PYTHONUTF8=1 python scripts/hitori/research_queue.py > C:/tmp/hitori_targets.json`

先頭50件を確認し、**市営・公営の入浴施設が上位に来ているか**を目で見ること。来ていなければ重みを見直す。

- [ ] **Step 6: 実際に調べる（この計画で最も時間がかかる）**

対象を20件ずつに分け、各バッチで次を行う。

1. 施設ごとに検索する。クエリは施設名＋市区町村＋「個人の体験記」「営業時間 料金」など、**業態に応じて変える**
2. 結果から §4 の語彙にある事実だけを取り出す。**文章は写さない**
3. 禁止ドメイン（食べログ・サウナイキタイ・Retty）は出所として数えない
4. 同じ事実を主張する独立ドメインが2件以上あるものだけを軸に効く事実として記録する（1件でも記録はする）
5. 相反する主張があれば両方記録する
6. バッチごとに `curate.py` へ流す:
   ```bash
   cat batch.json | PYTHONUTF8=1 python scripts/hitori/curate.py
   ```
7. `curate.py` が拒否したら**入力を直す**。検証を緩めない

**当たらなかった施設は記録しない。** 空の記録を作ると「調べたが何も無かった」と「まだ調べていない」の区別がつかなくなる。ただし何件試して何件当たったかは報告すること。

- [ ] **Step 7: 再ビルドして反映**

```bash
PYTHONUTF8=1 python scripts/hitori/build_data.py
PYTHONUTF8=1 python scripts/hitori/places.py
PYTHONUTF8=1 python scripts/hitori/facilities.py
PYTHONUTF8=1 python tests/hitori_all.py
```

- [ ] **Step 8: Commit**

```bash
git add scripts/hitori/research_queue.py tests/hitori_queue_test.py \
        data/hitori/curated.json data/hitori/pref data/hitori/summary.json \
        data/hitori/facilities.json
git commit -m "feat(hitori): 調査対象の優先順位を見直し、収集した事実を反映"
```

---

### Task 6: 全体検証とサイト反映

**Files:**
- Modify: `tests/hitori_all.py`
- Modify: `hitori.html`

- [ ] **Step 1: テストランナーを更新**

`TESTS` に `"hitori_enrich_test.py"` と `"hitori_curate_test.py"` を `"hitori_scoring_test.py"` の直後へ足す。

- [ ] **Step 2: 調査済み件数をページに出す**

`hitori.html` の免責文の近くに、数を誇張せずに出す:

```html
<p class="disclaimer">この分類は OpenStreetMap のタグと業態から機械的に推定したものです。
実際の座席形態や黙浴の有無を保証するものではありません。
うち <strong id="checked-count">0</strong> 件については、複数の情報源で事実を確認しています。</p>
```

`init()` で `SUMMARY.checked_count` を入れる。

- [ ] **Step 3: 全テストを実行**

Run: `PYTHONUTF8=1 python tests/hitori_all.py`
Expected: `ALL PASS (19 suites)`

- [ ] **Step 4: 目視**

別府を起点に、調査済みの施設（田の湯温泉など）と未調査の施設の詳細シートを両方開き、スクリーンショットを撮って確認する。

- 調査済み: 「確認できたこと」と出典リンク、補正された軸に「業態からの推定は3」
- 未調査: 「この施設はまだ調べていません」

- [ ] **Step 5: Commit**

```bash
PYTHONUTF8=1 python C:/tmp/check_dup_const.py hitori.html
git add tests/hitori_all.py hitori.html
git commit -m "feat(hitori): テストランナーを更新し調査済み件数を表示"
```

---

## 実行後の運用

```bash
PYTHONUTF8=1 python scripts/hitori/research_queue.py   # 次に調べる施設
# 検索して事実を抽出し、バッチJSONを作る
cat batch.json | PYTHONUTF8=1 python scripts/hitori/curate.py
PYTHONUTF8=1 python scripts/hitori/build_data.py       # 軸へ反映
PYTHONUTF8=1 python scripts/hitori/places.py           # build_data.py の後
PYTHONUTF8=1 python scripts/hitori/facilities.py       # build_data.py の後
PYTHONUTF8=1 python tests/hitori_all.py
```

`facilities.json` は県ファイル内の行番号を持つ。`build_data.py` を走らせたら**必ず `facilities.py` も走らせる**こと。忘れると `updated` が食い違い、全国検索が止まる（誤った施設を開かないための仕組みが働く）。
