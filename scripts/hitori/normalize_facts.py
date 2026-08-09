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

# 注釈の始まりとして認める文字。括弧だけに限る。
# 空白を認めると "no staff" が unstaffed="no"（無人）に化けて意味が反転する。
# 実際にその危険があった。
_ANNOT_OPEN = "（(【［[〔"

# 単位ごとの分換算。stay_limit は分で持つので、単位を無視して数字だけを
# 取ると「2時間」が「2分」になる。実際にそうなっていた。
_UNIT_MIN = {"時間": 60, "h": 60, "hour": 60, "hours": 60, "分": 1, "min": 1, "minutes": 1}

# 「無料」だけを 0 円と読む。「無料開放日あり」のような但し書きは読まない。
_FREE = re.compile(r"(無料|free|0\s*円)", re.I)


def strip_blocked_urls(f):
    """自動アクセスを禁止しているサイトのURLを外す。(事実, 外した数) を返す。

    curate.py はこれを見つけると例外で止める（黙って通さないため）。だが
    収集は人やエージェントが行うので、検索結果に出た食べログを1本混ぜて
    しまうことは起きる。その1本のために取り込み全体が止まるのは筋が悪い。
    ここで外して数を報告し、curate へは綺麗なものだけ渡す。
    残る出典が無くなった事実は落とす（normalize_fact が urls 空を弾く）。
    """
    urls = f.get("urls") or []
    keep = [u for u in urls if not enrich.is_blocked(u)]
    return ({**f, "urls": keep}, len(urls) - len(keep))


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
        # 「無料」は数字が0個なので落ちていた。無料の施設は実在するうえ、
        # 一人で行くときに料金が分かるかどうかは効くので 0 として残す。
        if k == "price" and _FREE.fullmatch(v.strip()):
            return {**f, "v": 0}, None
        nums = {n for n in re.findall(r"\d+", v.replace(",", ""))}
        if len(nums) != 1:
            return None, f"{k}: 数字が{len(nums)}個あり、どれを指すか決められない"
        num = int(nums.pop())
        if k == "stay_limit":
            # 単位を無視すると「2時間」が「2分」になる。単位が読めなければ落とす。
            m = re.search(r"\d+\s*(時間|分|hours?|h|min(?:utes)?)", v, re.I)
            if not m:
                return None, f"stay_limit: 単位が読めない {v[:24]!r}"
            return {**f, "v": num * _UNIT_MIN[m.group(1).lower()]}, None
        return {**f, "v": num}, None

    # 語彙の値に括弧書きの注釈が付いているだけなら、値だけを取り出す。
    # 区切りを括弧に限るのが要。空白を認めると "no staff" が
    # unstaffed="no"（無人）になり、有人の施設が無人と表示される。
    if isinstance(spec, set) and isinstance(v, str):
        t = v.strip()
        hit = [x for x in spec
               if t == x or (t.startswith(x) and t[len(x):len(x) + 1] in _ANNOT_OPEN)]
        if len(hit) == 1:
            return {**f, "v": hit[0]}, None
        return None, f"{k}: 語彙に無い値 {v[:30]!r}"

    return None, f"{k}: 型が合わない {type(v).__name__}"


def normalize(records):
    out, dropped = [], []
    for e in records:
        # 黙って捨てない。何件がなぜ落ちたかを必ず数える。
        if not isinstance(e, dict):
            dropped.append(("(不明)", "レコードが辞書でない")); continue
        if not e.get("id"):
            dropped.append(("(id無し)", "施設IDが無い")); continue
        if not e.get("facts"):
            dropped.append((e["id"], "事実がひとつも無い")); continue
        facts = []
        for f in e["facts"]:
            f, blocked_n = strip_blocked_urls(f)
            if blocked_n:
                dropped.append((e["id"], f"{f.get('k')}: 禁止サイトの出典を{blocked_n}件外した"))
            # 出典が1本も残らない事実は載せられない。curate も弾くが、
            # 例外で全体を止めるのではなく、ここで理由つきで落とす。
            if not (f.get("urls") or []):
                dropped.append((e["id"], f"{f.get('k')}: 出典URLが無い"))
                continue
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
