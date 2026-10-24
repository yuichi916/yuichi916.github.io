"""どっちが本物？: ページが読む data/honmono/pairs.json を組み立てる。

入力（すべて data/honmono/）:
  works.json      作品と著作権・底本（fetch_aozora.py）
  originals.json  原文の切り出し（passages.py）
  prompts.json    AI への指示文（make_prompts.py）
  ai_raw.json     AI の出力そのまま（1回目）
  ai_round2.json  照合で引っかかった分の書き直し（2回目）
  ai_round3.json  長さの目標に合わせた調整（3回目）。最後の回の文を使う
  length_targets.json  組ごとの長さの目標（make_length_targets.py）
  tells.json      問題ごとの「AIの文のくせ」1行（作業役が両方を読んで書いた）
  agent_instruction.json / rewrite_instruction.json  AI に渡した依頼の全文（1回目・書き直し）

使い方:  python scripts/honmono/build_data.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aozora_text import RULES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "honmono"


def load(name: str):
    return json.loads((D / name).read_text(encoding="utf-8"))


def longest_common_run(a: str, b: str) -> int:
    a, b = a.replace("\n", ""), b.replace("\n", "")
    best = 0
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                v = prev[j - 1] + 1
                cur[j] = v
                if v > best:
                    best = v
        prev = cur
    return best


def main() -> None:
    works = {w["id"]: w for w in load("works.json")["works"]}
    origs = load("originals.json")
    prompts = load("prompts.json")
    pmap = {it["work_id"]: it["prompt"] for it in prompts["items"]}
    raw = load("ai_raw.json")
    rounds = [{it["work_id"]: it["text"] for it in raw["items"]}]
    models = [raw["model"]]
    for name in ("ai_round2.json", "ai_round3.json"):
        if (D / name).exists():
            rr = load(name)
            rounds.append({it["work_id"]: it["text"] for it in rr["items"]})
            models.append(rr.get("model"))
    if len(set(models)) != 1:
        raise SystemExit(f"回ごとのモデルが違う: {models}")
    targets = {it["work_id"]: it for it in load("length_targets.json")["items"]} if (D / "length_targets.json").exists() else {}
    tells = load("tells.json")["tells"]

    # 並び: 各作家の1作目を先に、2作目を後に（同じ作家・同じ作品が続かない）
    seen: dict[str, int] = {}
    order = []
    for k, o in enumerate(origs):
        a = works[o["work_id"]]["author"]
        order.append((seen.get(a, 0), k, o))
        seen[a] = seen.get(a, 0) + 1
    origs = [o for _, _, o in sorted(order, key=lambda t: (t[0], t[1]))]

    pairs = []
    for o in origs:
        wid = o["work_id"]
        w = works[wid]
        last = max(k for k, r in enumerate(rounds) if wid in r)
        ai = rounds[last][wid]
        pairs.append({
            "id": wid,
            "work_id": wid,
            "author": w["author"],
            "title": w["title"],
            "subtitle": w["subtitle"],
            "died": w["died"],
            "orthography": w["orthography"],
            "card_url": w["card_url"],
            "text_url": w["text_url"],
            "teihon": w["teihon"],
            "teihon_publisher": w["teihon_publisher"],
            "where": o["where"],
            "original": o["text"],
            "ai": ai,
            "ai_round": last + 1,
            "ai_history": [{"round": k + 1, "text": r[wid], "longest_common_run": longest_common_run(o["text"], r[wid])}
                           for k, r in enumerate(rounds) if wid in r][:-1],
            "length_target": {k: targets[wid][k] for k in ("ratio", "lo", "hi")} if wid in targets else None,
            "chars": {"original": o["chars"], "ai": len(ai.replace("\n", ""))},
            "longest_common_run": longest_common_run(o["text"], ai),
            "prompt": pmap[wid],
            "tell": tells[wid],
        })

    model = models[0]
    out = {
        "title": "どっちが本物？ — 文豪の原文とAIの文",
        "built": raw.get("written_at"),
        "generator": {
            "who": "Claude（Anthropic）",
            "short": "Claude",
            "model": model,
            "how": "Claude Code のサブエージェントとして、原文を見せずに、あらすじ・語り・表記・長さだけを渡して書かせた。"
                   "照合で原文と10字以上同じ並びがあったものは、原文を見せないまま言い回しを選び直させた（2回目）。"
                   "最後に、組ごとに割り振った長さの目標（原文の -12%〜+12%、AI が短い組と長い組が半々）に合わせて、"
                   "AI 自身の文の長さを調整させた（3回目。原文は見せていない）。",
            "prompt_template": prompts["template"],
            "agent_instruction": load("agent_instruction.json")["instruction"],
            "rewrite_instruction": load("rewrite_instruction.json")["instruction"],
            "length_instruction": load("length_instruction.json")["instruction"] if (D / "length_instruction.json").exists() else None,
            "rewritten": len(rounds[1]) if len(rounds) > 1 else 0,
            "length_adjusted": len(rounds[2]) if len(rounds) > 2 else 0,
        },
        "cleaning_rules": RULES,
        "source": "青空文庫（https://www.aozora.gr.jp/）",
        "pairs": pairs,
    }
    (D / "pairs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("pairs", len(pairs), "rounds", [len(r) for r in rounds])


if __name__ == "__main__":
    main()
