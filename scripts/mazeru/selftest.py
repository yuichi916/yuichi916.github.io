"""まぜる日本: 同梱データの自己検査。

使い方:  python scripts/mazeru/selftest.py
検査:
  1. 表の各組が「小さい番号, 大きい番号」で1回だけ入っている（A+B と B+A が同じ答えになる）
  2. 各組が正しい分割ファイル（小さい番号 % 16）に入っている
  3. すべての答えが要素一覧にある・答えが材料と同じ組がない
  4. 要素名に除外語・英数字・9字以上・除外カテゴリ・辞書上の人名が残っていない
  5. 基本要素から全要素に到達でき、保存した深さ・作り方の数・材料になる組の数が表から計算し直した値と一致する
  6. 生の生成結果（raw_graph.json）と突き合わせ、表の答えが生成時の答えと一致する（順序を入れ替えても同じ）
最後に行き止まりの数を表示する。どれか1つでも落ちたら終了コード1。
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import gen  # noqa: E402
from ngwords import ng_reason  # noqa: E402

D = ROOT / "data" / "mazeru"
B36 = "0123456789abcdefghijklmnopqrstuvwxyz"
fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def d36(s: str) -> int:
    return B36.index(s[0]) * 1296 + B36.index(s[1]) * 36 + B36.index(s[2])


def main() -> int:
    meta = json.loads((D / "elements.json").read_text(encoding="utf-8"))
    E = meta["e"]
    n = len(E)
    names = [e[0] for e in E]
    check(len(set(names)) == n, f"要素名に重複がない（{n} 個）")
    table: dict[tuple[int, int], int] = {}
    misplaced = dup = unordered = 0
    for s in range(meta["shards"]):
        t = (D / "r" / f"{s:02d}.txt").read_text(encoding="utf-8").strip()
        check(len(t) % 9 == 0, f"分割ファイル {s:02d} の長さが 9 の倍数")
        for i in range(0, len(t), 9):
            a, b, r = d36(t[i:i + 3]), d36(t[i + 3:i + 6]), d36(t[i + 6:i + 9])
            if a > b:
                unordered += 1
            if min(a, b) % meta["shards"] != s:
                misplaced += 1
            k = (min(a, b), max(a, b))
            if k in table:
                dup += 1
            table[k] = r
    check(unordered == 0, "全組が（小さい番号, 大きい番号）の順で入っている")
    check(dup == 0, "同じ組が2回入っていない（A+B と B+A が別の答えを持たない）")
    check(misplaced == 0, "全組が正しい分割ファイルに入っている")
    check(len(table) == meta["recipes"], f"組の数がメタデータと一致（{len(table)}）")
    check(all(0 <= a < n and 0 <= b < n and 0 <= r < n for (a, b), r in table.items()), "全ての材料と答えが要素一覧にある")
    check(all(r not in (a, b) for (a, b), r in table.items()), "答えが材料と同じ組がない")

    bad = []
    excl_cats = gen.EXCLUDE_CATS
    for e in E:
        nm, cat = e[0], meta["cats"][e[2]]
        if ng_reason(nm, post=True) or len(nm) > gen.MAX_LEN or not gen.VALID_NAME.match(nm) or cat in excl_cats \
                or (cat not in ("昔話・物語", "妖怪・伝説") and gen.is_person_name(nm)) or gen.is_phrase(nm):
            bad.append(nm)
    check(not bad, f"除外語・文字種・長さ・除外カテゴリ・人名・句が残っていない {bad[:10]}")

    # 到達可能性と深さを表から計算し直す
    bases = meta["bases"]
    depth = {b: 0 for b in bases}
    by_in = defaultdict(list)
    for (a, b), r in table.items():
        by_in[a].append((a, b, r))
        by_in[b].append((a, b, r))
    frontier, lv = list(bases), 0
    while frontier:
        lv += 1
        known = set(depth)
        nxt = []
        for x in frontier:
            for a, b, r in by_in[x]:
                if a in known and b in known and r not in depth:
                    depth[r] = lv
                    nxt.append(r)
        frontier = nxt
    check(len(depth) == n, f"基本要素から全要素に到達できる（{len(depth)}/{n}）")
    check(all(E[i][3] == depth.get(i) for i in range(n)), "保存した深さが表から計算し直した値と一致")
    makes = Counter(table.values())
    used = Counter()
    for (a, b) in table:
        used[a] += 1
        if b != a:
            used[b] += 1
    check(all(E[i][4] == makes[i] for i in range(n)), "作り方の数が一致")
    check(all(E[i][5] == used[i] for i in range(n)), "材料になる組の数が一致")
    check(all(E[b][3] == 0 for b in bases) and len(bases) == 7, "基本要素は7つで深さ0")

    raw_path = os.path.join(gen.WORK, "raw_graph.json")
    if os.path.exists(raw_path):
        raw = json.load(open(raw_path, encoding="utf-8"))
        rawmap = {}
        for a, b, r in raw["recipes"]:
            rawmap[(a, b)] = r
            rawmap[(b, a)] = r
        mism = 0
        for (a, b), r in table.items():
            if rawmap.get((names[a], names[b])) != names[r] or rawmap.get((names[b], names[a])) != names[r]:
                mism += 1
        check(mism == 0, f"表の答えが生成時の答えと一致（順序を入れ替えても同じ）。不一致 {mism}")
    else:
        print("skip raw_graph.json がないので生成時との突き合わせは省略")

    new_out = Counter()
    for (a, b) in table:
        new_out[a] += 1
        new_out[b] += 1
    dead = [names[i] for i in range(n) if new_out[i] == 0]
    print(f"info 行き止まり（材料にして何もできない要素） {len(dead)} / {n} = {len(dead)/n:.1%}")
    print(f"info 最大の深さ {max(depth.values())}  深さの分布 {dict(sorted(Counter(depth.values()).items()))}")
    print("FAILED" if fails else "ALL OK")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
