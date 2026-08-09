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

    entry = {"checked": raw.get("checked") or date.today().isoformat(), "facts": built}
    if raw.get("id"):
        entry["id"] = raw["id"]
    return entry


def _fact_key(f):
    return (f["k"], json.dumps(f["v"], ensure_ascii=False))


def merge(curated, entries):
    """施設IDごとに事実を足し込む。入力の dict は変更しない。

    以前は entry 全体を差し替えていた。そのためブランド単位の判定
    （閉業など1つの事実だけを持つ）を流すと、個別に集めた料金・支払い
    方法などが黙って消えていた。同じ (事実名, 値) は新しい側で上書きし、
    それ以外は残す。
    """
    out = {k: {"checked": v["checked"], "facts": list(v["facts"])}
           for k, v in curated.items()}
    for e in entries:
        prev = out.get(e["id"])
        if not prev:
            out[e["id"]] = {"checked": e["checked"], "facts": e["facts"]}
            continue
        by_key = {_fact_key(f): f for f in prev["facts"]}
        for f in e["facts"]:
            by_key[_fact_key(f)] = f
        out[e["id"]] = {"checked": e["checked"], "facts": list(by_key.values())}
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
