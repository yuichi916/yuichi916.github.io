"""まぜる日本: 生成した組み合わせ表（C:/tmp/mazeru-gen/raw_graph.json）に品質の門をかけ、
ブラウザ用のデータ data/mazeru/ を書き出す。

使い方:  python scripts/mazeru/build_data.py [raw_graph.json]

門（生成中の門と同じ規則をもう一度、全件にかける）:
  - 除外語の辞書（ngwords.py）、文字種（英数字・記号まじり）、長さ（8字超）、辞書にない造語、人名
  - LLMの分類で「実在の人物」「商品名・会社名・作品名」「不適切」「意味が通らない」になった語
  - 除外した要素を使う組・作る組を落とし、基本要素から届かなくなった要素も落とす

出力:
  data/mazeru/elements.json  要素一覧（名前・絵文字・分類・深さ・作り方の数）と統計
  data/mazeru/r/NN.txt       組み合わせ表を 16 分割（a の番号 % 16）。1組 = 番号3つ × base36 3桁
  data/mazeru/stats.json     除外の内訳・行き止まり・到達可能数など
  C:/tmp/mazeru-gen/sample200.tsv  目視の抜き取り用（乱数固定）
"""
from __future__ import annotations

import json
import os
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import gen  # noqa: E402
from ngwords import ng_reason  # noqa: E402

OUT = ROOT / "data" / "mazeru"
SHARDS = 16
# 要素の絵として出したくない絵文字の置きかえ（LLMの答えのまま使うと品がないもの・誤解されるもの）
EMOJI_FIX = {"💩": "🟤", "🍆": "🟣", "🍑": "🍑", "🖕": "✋", "🔞": "⚠️", "🔫": "🎯", "💉": "🩹", "🚬": "💨", "🩸": "🔴",
             "☠️": "💀", "🪦": "🪨", "⚰️": "🪨"}
CAT_ORDER = ["自然", "天気・季節", "植物", "生きもの", "食べもの", "妖怪・伝説", "昔話・物語", "場所・名所", "建物",
             "道具・もの", "乗りもの", "行事・文化", "人・職業", "からだ・こころ", "ことば・考え"]


def b36(n: int) -> str:
    s = ""
    for _ in range(3):
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
    assert n == 0
    return s


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gen.WORK, "raw_graph.json")
    raw = json.load(open(src, encoding="utf-8"))
    bases = raw["bases"]
    emoji = {e["name"]: e["emoji"] for e in raw["elems"]}
    cat = {e["name"]: e["cat"] for e in raw["elems"]}
    order = [e["name"] for e in raw["elems"]]

    removed: Counter = Counter()
    removed_samples = defaultdict(list)
    bad = set()
    for n in order:
        if n in bases:
            continue
        reason = None
        if len(n) > gen.MAX_LEN:
            reason = "長すぎ"
        elif not gen.VALID_NAME.match(n):
            reason = "文字種"
        elif ng_reason(n, post=not os.environ.get("MAZERU_NO_POSTNG")):
            reason = "NG語:" + ng_reason(n, post=not os.environ.get("MAZERU_NO_POSTNG"))
        elif cat.get(n) in gen.EXCLUDE_CATS or cat.get(n) not in CAT_ORDER:
            reason = "分類:" + str(cat.get(n))
        elif cat.get(n) not in ("昔話・物語", "妖怪・伝説") and gen.is_person_name(n):
            reason = "人名(辞書)"
        elif gen.is_phrase(n):
            reason = "句（助詞でつないだ語）"
        elif gen.needs_word_check(n) and not (raw.get("words") or {}).get(n):
            reason = "辞書にない語(AI判定)"
        if reason:
            bad.add(n)
            removed["要素:" + reason] += 1
            removed_samples["要素:" + reason].append(n)

    recipes = {}
    for a, b, r in raw["recipes"]:
        if a in bad or b in bad or r in bad:
            removed["組:除外した要素を含む"] += 1
            continue
        if r in (a, b):
            removed["組:入力と同じ"] += 1
            continue
        if gen.is_coinage(r, a, b):
            removed["組:造語"] += 1
            removed_samples["組:造語"].append(f"{a}+{b}={r}")
            continue
        recipes[gen.pk(a, b)] = r

    # AIの採点（judge.py）で組を落とす: KEEP_MIN 点以上は残す。RESCUE_MIN〜KEEP_MIN-1 点は、
    # その答えの要素へ届く道がほかにないときだけ残す（要素ごとに1組ずつ、届くまで繰り返す）。それより低い点は落とす。
    judge_path = os.path.join(gen.WORK, "judge.jsonl")
    keep_min = int(os.environ.get("MAZERU_KEEP_MIN", "3"))
    rescue_min = int(os.environ.get("MAZERU_RESCUE_MIN", "2"))
    if os.path.exists(judge_path) and not os.environ.get("MAZERU_NO_JUDGE"):
        score = {}
        for line in open(judge_path, encoding="utf-8"):
            j = json.loads(line)
            score[gen.pk(j["a"], j["b"]) + (j["r"],)] = j["score"]
        sc = lambda k, r: score.get(k + (r,), keep_min)  # 採点漏れは残す（数は stats に出す）
        unscored = sum(1 for k, r in recipes.items() if k + (r,) not in score)
        good = {k: r for k, r in recipes.items() if sc(k, r) >= keep_min}
        pool = sorted(((k, r) for k, r in recipes.items() if rescue_min <= sc(k, r) < keep_min),
                      key=lambda kr: -sc(*kr))

        def closure(rs):
            reach = set(bases)
            by = defaultdict(list)
            for (x, y), z in rs.items():
                by[x].append((x, y, z)); by[y].append((x, y, z))
            stack = list(bases)
            while stack:
                v = stack.pop()
                for x, y, z in by[v]:
                    if x in reach and y in reach and z not in reach:
                        reach.add(z); stack.append(z)
            return reach

        rescued = 0
        while True:
            reach = closure(good)
            got = set()
            for k, r in pool:
                if r not in reach and r not in got and k[0] in reach and k[1] in reach and k not in good:
                    good[k] = r; got.add(r); rescued += 1
            if not got:
                break
        dropped_low = len(recipes) - len(good)
        removed["組:AI採点で落とした"] += dropped_low
        judge_stats = {"keep_min": keep_min, "rescue_min": rescue_min, "rescued": rescued, "unscored": unscored,
                       "score_hist": dict(sorted(Counter(sc(k, r) for k, r in recipes.items()).items()))}
        recipes = good
    else:
        judge_stats = None

    # 到達可能性と深さ（基本要素=0。A+B=C なら depth(C) <= max(depth(A),depth(B))+1 の最小）
    depth = {b: 0 for b in bases}
    by_input = defaultdict(list)
    for (a, b), r in recipes.items():
        by_input[a].append((a, b, r))
        if b != a:
            by_input[b].append((a, b, r))
    # 1段ずつ: その段の開始時点で手元にある要素どうしの組だけで次の段を作る
    frontier = list(bases)
    level = 0
    while frontier:
        level += 1
        nxt = []
        known = set(depth)
        for x in frontier:
            for a, b, r in by_input[x]:
                if a in known and b in known and r not in depth:
                    depth[r] = level
                    nxt.append(r)
        frontier = nxt
    unreachable = [n for n in order if n not in bad and n not in depth]
    for n in unreachable:
        removed["要素:基本要素から届かない"] += 1
    keep = [n for n in order if n in depth]
    # 届かない要素を含む組を落とす
    final = {k: r for k, r in recipes.items() if k[0] in depth and k[1] in depth and r in depth}
    removed["組:届かない要素を含む"] += len(recipes) - len(final)

    # 深さ順（同じ深さなら発見順）に番号をふる
    pos = {n: i for i, n in enumerate(order)}
    keep.sort(key=lambda n: (depth[n], pos[n]))
    idx = {n: i for i, n in enumerate(keep)}
    makes = Counter(final.values())
    used_in = Counter()
    new_out = Counter()  # その要素を材料にして「入力と別の要素」ができる組の数
    for (a, b), r in final.items():
        used_in[a] += 1
        if b != a:
            used_in[b] += 1
        new_out[a] += 1
        if b != a:
            new_out[b] += 1
    dead = [n for n in keep if new_out[n] == 0]

    cats = CAT_ORDER
    elems = []
    for n in keep:
        c = cat.get(n) if n not in bases else {"米": "食べもの", "人": "人・職業", "木": "植物"}.get(n, "自然")
        em = emoji.get(n) or "✨"
        em = EMOJI_FIX.get(em, em)
        elems.append([n, em, cats.index(c), depth[n], makes[n], used_in[n]])

    shards = [[] for _ in range(SHARDS)]
    for (a, b), r in sorted(final.items(), key=lambda kv: (idx[kv[0][0]], idx[kv[0][1]])):
        ia, ib = sorted((idx[a], idx[b]))
        shards[ia % SHARDS].append(b36(ia) + b36(ib) + b36(idx[r]))

    depth_hist = Counter(depth[n] for n in keep)
    stats = {
        "source": os.path.basename(src),
        "model": raw.get("model"),
        "elements": len(keep),
        "recipes": len(final),
        "pairs_tried": raw.get("pairs_tried"),
        "max_depth": max(depth.values()),
        "depth_hist": dict(sorted(depth_hist.items())),
        "dead_ends": len(dead),
        "dead_end_ratio": round(len(dead) / len(keep), 4),
        "dead_end_samples": dead[:40],
        "removed_in_generation": raw.get("rejects", {}),
        "removed_in_generation_samples": raw.get("reject_samples", {}),
        "removed_post": dict(removed),
        "removed_post_samples": {k: v[:40] for k, v in removed_samples.items()},
        "categories": {c: sum(1 for e in elems if e[2] == i) for i, c in enumerate(cats)},
        "judge": judge_stats,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "r").mkdir(exist_ok=True)
    for i, s in enumerate(shards):
        (OUT / "r" / f"{i:02d}.txt").write_text("".join(s), encoding="utf-8")
    # 品質の門で落とした答えの数（「入力と同じ」=何も起きない、「上限後の新語」=規模の上限、は門ではないので数えない）
    gate = {k: v for k, v in (raw.get("rejects") or {}).items()
            if not k.startswith(("入力と同じ", "上限後の新語", "絵文字なし"))}
    gate_post = {k: v for k, v in removed.items() if k.startswith("組:") and not k.startswith("組:入力と同じ")}
    removed_total = sum(gate.values()) + sum(gate_post.values())
    stats["quality_gate_removed"] = {"in_generation": gate, "post": gate_post, "total": removed_total}
    # 説明欄の例: 好みの答えを、浅い材料で作れる組から選ぶ
    prefer = ["河童", "雪女", "お酒", "花火", "温泉", "餅", "おにぎり", "天狗", "桜餅", "月見", "鬼", "寿司", "富士山", "神社"]
    examples = []
    for want in prefer:
        best = None
        for (a, b), r in final.items():
            if r == want:
                c = (max(depth[a], depth[b]), idx[a] + idx[b])
                if best is None or c < best[0]:
                    best = (c, a, b)
        if best:
            examples.append([idx[best[1]], idx[best[2]], idx[want]])
        if len(examples) >= 6:
            break
    meta = {"v": 1, "model": raw.get("model"), "bases": [idx[b] for b in bases], "cats": cats, "shards": SHARDS,
            "recipes": len(final), "maxDepth": stats["max_depth"],
            "removedTotal": removed_total, "examples": examples,
            "cols": ["name", "emoji", "cat", "depth", "makes", "usedIn"], "e": elems}
    (OUT / "elements.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # 公開する stats.json には除外した語の実例を載せない（差別語などをサイトに置かないため）。実例つきは作業フォルダへ
    Path(gen.WORK, "stats_full.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    public = {k: v for k, v in stats.items() if "samples" not in k}
    (OUT / "stats.json").write_text(json.dumps(public, ensure_ascii=False, indent=1), encoding="utf-8")

    # 目視の抜き取り（200件・乱数固定）
    rng = random.Random(20261024)
    items = sorted(final.items(), key=lambda kv: (idx[kv[0][0]], idx[kv[0][1]]))
    sample = rng.sample(items, min(200, len(items)))
    with open(os.environ.get("MAZERU_SAMPLE_OUT") or os.path.join(gen.WORK, "sample200.tsv"), "w", encoding="utf-8") as f:
        for i, ((a, b), r) in enumerate(sample, 1):
            f.write(f"{i}\t{a}\t{b}\t{r}\t{emoji.get(r)}\n")

    print(json.dumps({k: stats[k] for k in ("elements", "recipes", "pairs_tried", "max_depth", "dead_ends",
                                           "dead_end_ratio", "depth_hist", "categories")}, ensure_ascii=False))
    print("removed_in_generation", sum(raw.get("rejects", {}).values()), raw.get("rejects"))
    print("removed_post", dict(removed))
    print("judge", judge_stats)
    print("quality_gate_removed", removed_total, "examples", [[keep[i] for i in x] for x in examples])
    sz = sum(p.stat().st_size for p in (OUT / "r").glob("*.txt"))
    print("elements.json", (OUT / "elements.json").stat().st_size, "bytes; shards", sz, "bytes")


if __name__ == "__main__":
    main()
