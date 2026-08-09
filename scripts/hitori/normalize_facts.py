# -*- coding: utf-8 -*-
"""収集した事実を語彙に合わせて整える。curate.py へ渡す前段。

収集は人やエージェントが行うため、語彙の値に注釈が付いたり、整数の
項目に文字列が来たりする。curate.py はそれを例外で弾く（黙って捨てない）
が、毎回手で直すのは無駄なので、機械的に直せるものだけをここで直す。

直せないものは落として理由を報告する。**推測で埋めない。**
「price='そば定食850円、親子丼セット750円'」のように数字が複数あるものは、
どれが何の料金か判断できないので落とす。

使い方:
    python scripts/hitori/normalize_facts.py < raw.json > clean.json
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import enrich

INT_KEYS = ("price", "stay_limit", "counter_seats", "seats_total")


def normalize_fact(f):
    """(整えた事実, 落とした理由) を返す。落とさないなら理由は None。"""
    k, v = f.get("k"), f.get("v")
    if enrich.valid_fact(k, v):
        return f, None

    spec = enrich.FACT_VOCAB.get(k)
    if spec is None:
        return None, f"語彙にない事実名: {k}"

    # 整数の項目に文字列。数字がひとつだけ読めるときに限り直す。
    if spec is int and isinstance(v, str):
        nums = {n for n in re.findall(r"\d[\d,]*", v.replace(",", ""))}
        if len(nums) == 1:
            return {**f, "v": int(nums.pop())}, None
        return None, f"{k}: 数字が{len(nums)}個あり、どれを指すか決められない"

    # 語彙の値に注釈が付いているだけなら、値だけを取り出す。
    # 前方一致がちょうど1つのときだけ。複数当たるなら判断しない。
    if isinstance(spec, set) and isinstance(v, str):
        hit = [x for x in spec if v.startswith(x)]
        if len(hit) == 1:
            return {**f, "v": hit[0]}, None
        return None, f"{k}: 語彙に無い値 {v[:30]!r}"

    return None, f"{k}: 型が合わない {type(v).__name__}"


def normalize(records):
    out, dropped = [], []
    for e in records:
        if not isinstance(e, dict) or not e.get("id") or not e.get("facts"):
            continue
        facts = []
        for f in e["facts"]:
            got, why = normalize_fact(f)
            if got:
                facts.append(got)
            else:
                dropped.append((e["id"], why))
        if facts:
            out.append({**e, "facts": facts})
    return out, dropped


def main():
    try:
        recs = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"入力がJSONとして読めない: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(recs, list):
        print("入力が配列でない", file=sys.stderr)
        sys.exit(1)

    out, dropped = normalize(recs)
    for fid, why in dropped:
        print(f"落とした {fid}: {why}", file=sys.stderr)
    print(f"{len(out)}施設 / {sum(len(e['facts']) for e in out)}事実"
          f"（落とした {len(dropped)}件）", file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
