"""どっちが本物？: AI の文の長さの目標を組ごとに割り振る（「長い方がAI」で当たらないように）。

  - 目標の比率 r（AI の長さ / 原文の長さ - 1）を -12%〜-3% と +3%〜+12% に 25 組ずつ均等に置き、
    種を固定した乱数で作品に割り当てる（AI が短い組と長い組が半々）
  - 許す範囲は目標 ±2 字。ただし原文と同じ長さや符号の逆転は許さず、±12% の外にも出さない
  - 出力: data/honmono/length_targets.json（公開）
          引数で渡したファイル（AI にそのまま渡す、長さ調整の依頼文。AI 自身の現在の文だけを含み、原文は含まない）

使い方:  python scripts/honmono/make_length_targets.py C:\\tmp\\honmono-gen\\len_input.txt
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "honmono"
SEED = 20261024


def main() -> None:
    origs = json.loads((D / "originals.json").read_text(encoding="utf-8"))
    r1 = {it["work_id"]: it["text"] for it in json.loads((D / "ai_raw.json").read_text(encoding="utf-8"))["items"]}
    r2 = {it["work_id"]: it["text"] for it in json.loads((D / "ai_round2.json").read_text(encoding="utf-8"))["items"]}
    n = len(origs)
    half = n // 2
    mags = [0.03 + 0.09 * k / (half - 1) for k in range(half)]
    ratios = [-m for m in mags] + mags + ([0.075] if n % 2 else [])
    rng = random.Random(SEED)
    rng.shuffle(ratios)

    items = []
    for o, r in zip(origs, ratios):
        no = o["chars"]
        t = no * (1 + r)
        lo, hi = math.ceil(t - 2), math.floor(t + 2)
        lo, hi = max(lo, math.ceil(no * 0.88)), min(hi, math.floor(no * 1.12))
        if r < 0:
            hi = min(hi, no - 1)
        else:
            lo = max(lo, no + 1)
        assert lo <= hi, (o["work_id"], lo, hi)
        cur = r2.get(o["work_id"], r1[o["work_id"]])
        items.append({"work_id": o["work_id"], "ratio": round(r, 4), "target": round(t), "lo": lo, "hi": hi,
                      "paragraphs": o["paragraphs"], "current": cur, "current_chars": len(cur.replace("\n", ""))})

    (D / "length_targets.json").write_text(json.dumps({
        "note": "AI の文の長さの目標。原文の長さに対する比率を -12%〜-3% と +3%〜+12% に半数ずつ割り振った（種 " + str(SEED) + "）。",
        "items": [{k: v for k, v in it.items() if k not in ("current", "current_chars")} for it in items],
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    if len(sys.argv) > 1:
        out = []
        for it in items:
            out.append(f"=== {it['work_id']} ===\n長さ: {it['lo']}〜{it['hi']}字（改行は数えない）。{it['paragraphs']}段落。"
                       f"いまの文は {it['current_chars']} 字。\nいまの文:\n{it['current']}\n")
        Path(sys.argv[1]).write_text("\n".join(out), encoding="utf-8")
    neg = sum(1 for it in items if it["ratio"] < 0)
    print("targets", len(items), "AI が短い", neg, "AI が長い", len(items) - neg)


if __name__ == "__main__":
    main()
