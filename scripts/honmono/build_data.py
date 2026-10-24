"""どっちが本物？: ページが読む data/honmono/pairs.json を組み立てる。

入力（すべて data/honmono/）:
  works.json      作品と著作権・底本（fetch_aozora.py）
  originals.json  原文の切り出し（passages.py）
  prompts.json    AI への指示文（make_prompts.py）
  ai_raw.json     AI の出力そのまま（1回目）
  ai_round2.json  照合で引っかかった分の書き直し（2回目）。あればこちらを使う
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
    r1 = {it["work_id"]: it["text"] for it in raw["items"]}
    r2 = {}
    r2_model = None
    if (D / "ai_round2.json").exists():
        rr = load("ai_round2.json")
        r2 = {it["work_id"]: it["text"] for it in rr["items"]}
        r2_model = rr.get("model")
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
        ai = r2.get(wid, r1[wid])
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
            "ai_round": 2 if wid in r2 else 1,
            "ai_round1": r1[wid] if wid in r2 else None,
            "chars": {"original": o["chars"], "ai": len(ai.replace("\n", ""))},
            "longest_common_run": longest_common_run(o["text"], ai),
            "longest_common_run_round1": longest_common_run(o["text"], r1[wid]) if wid in r2 else None,
            "prompt": pmap[wid],
            "tell": tells[wid],
        })

    model = raw["model"]
    if r2_model and r2_model != model:
        raise SystemExit(f"1回目と2回目のモデルが違う: {model} / {r2_model}")
    out = {
        "title": "どっちが本物？ — 文豪の原文とAIの文",
        "built": raw.get("written_at"),
        "generator": {
            "who": "Claude（Anthropic）",
            "short": "Claude",
            "model": model,
            "how": "Claude Code のサブエージェントとして、原文を見せずに、あらすじ・語り・表記・長さだけを渡して書かせた。"
                   "照合で原文と10字以上同じ並びがあったものは、原文を見せないまま言い回しを選び直させた（2回目）。",
            "prompt_template": prompts["template"],
            "agent_instruction": load("agent_instruction.json")["instruction"],
            "rewrite_instruction": load("rewrite_instruction.json")["instruction"],
            "rewritten": len(r2),
        },
        "cleaning_rules": RULES,
        "source": "青空文庫（https://www.aozora.gr.jp/）",
        "pairs": pairs,
    }
    (D / "pairs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("pairs", len(pairs), "rewritten", len(r2))


if __name__ == "__main__":
    main()
