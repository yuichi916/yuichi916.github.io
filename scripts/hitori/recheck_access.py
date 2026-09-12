# -*- coding: utf-8 -*-
"""curated.json の「誰が使えるか」を、いまの規則で洗い直す。

access の制限値（会員制・住民限定・男性専用・女性専用）は、ひとりチェックで
**赤（入れない）**として出る。ここが誤っていると、入れる施設を入れないことに
してしまう。実測ではこれが起きていた:

    女性専用  45件中 42件が「女性専用フロア」「ベビールームは女性専用」
    住民限定 225件中 223件が「市民のみなさんへ」のような呼びかけ
    会員制   337件中 115件が「会員限定キャンペーン」のような特典の案内

いずれも引用そのものは本物で、verify_quotes.py では見つからない。
引用が**施設まるごとの制限を言っているか**は別の検査がいる、というのが教訓。

extract_rules.access_of を唯一の物差しにして、支えのない値を外す。
規則を直したら、そのたびにこれを流し直せば既存の事実も追随する。

  python scripts/hitori/recheck_access.py           # 下見
  python scripts/hitori/recheck_access.py --drop    # 支えのない事実を外す
"""
import argparse
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_rules import access_of                          # noqa: E402

CURATED = ROOT / "data" / "hitori" / "curated.json"
# 「使えない人がいる」値だけを見る。public は誰かを閉め出さないので触らない。
RESTRICTED = {"residents_only", "members_only", "male_only", "female_only"}


def unsupported(entry):
    """この施設の access のうち、引用が値を支えていない事実を返す。"""
    out = []
    for f in entry.get("facts", []):
        if f.get("k") != "access" or f.get("v") not in RESTRICTED:
            continue
        if access_of(f.get("quote")) != f["v"]:
            out.append(f)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drop", action="store_true", help="支えのない事実を curated.json から外す")
    args = ap.parse_args()

    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    keep, bad = collections.Counter(), collections.Counter()
    samples = collections.defaultdict(list)
    for entry in curated.values():
        drop = unsupported(entry)
        for f in drop:
            bad[f["v"]] += 1
            if len(samples[f["v"]]) < 4:
                samples[f["v"]].append(str(f.get("quote"))[:56])
        ids = {id(f) for f in drop}
        for f in entry.get("facts", []):
            if f.get("k") == "access" and f.get("v") in RESTRICTED and id(f) not in ids:
                keep[f["v"]] += 1

    print(f"制限の事実 {sum(keep.values()) + sum(bad.values()):,} 件")
    for v in sorted(RESTRICTED):
        print(f"  {v:<15} 残す {keep[v]:4}  外す {bad[v]:4}")
        for q in samples[v]:
            print(f"      ✗ {q}")
    if not args.drop:
        print("下見のみ。外すには --drop を付ける。")
        return

    removed, empty = 0, []
    for fid, entry in curated.items():
        ids = {id(f) for f in unsupported(entry)}
        facts = [f for f in entry.get("facts", []) if id(f) not in ids]
        removed += len(entry.get("facts", [])) - len(facts)
        entry["facts"] = facts
        if not facts:
            empty.append(fid)
    for fid in empty:
        del curated[fid]
    CURATED.write_text(json.dumps(curated, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{removed:,} 件を外した。根拠が無くなった施設 {len(empty):,} 件も外した。")
    print("scripts/hitori/build_index.py を実行して索引を作り直すこと。")


if __name__ == "__main__":
    main()
