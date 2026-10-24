"""まぜる日本: 人が目で見た抜き取り（200組）の判定を data/mazeru/review.json に記録する。

使い方:  python scripts/mazeru/record_review.py <round名> <sample.tsv> <納得できない組の番号をカンマ区切り> [メモ]
判定の基準: 2つの材料の両方から答えへのつながりが「なるほど」と思えるものを納得とする。
片方が無関係・こじつけ・意味が通らない・答えが材料の言いかえ（表記ゆれ・同義語）なら納得できないとする。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "mazeru" / "review.json"
# 判定したのは、制作を担当した AI エージェント（Claude Opus 5.5）。人（依頼主）による確認ではない
REVIEWER = "Claude Opus 5.5（制作を担当したAIエージェント。組み合わせを作ったローカルLLMとは別のモデル）"


def main() -> None:
    name, sample, ng = sys.argv[1], sys.argv[2], sys.argv[3]
    memo = sys.argv[4] if len(sys.argv) > 4 else ""
    ngs = {int(x) for x in ng.split(",") if x.strip()}
    rows = [line.rstrip("\n").split("\t") for line in open(sample, encoding="utf-8") if line.strip()]
    items = [{"no": int(r[0]), "a": r[1], "b": r[2], "result": r[3], "ok": int(r[0]) not in ngs} for r in rows]
    ok = sum(1 for x in items if x["ok"])
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"rounds": []}
    data["rounds"] = [r for r in data["rounds"] if r["name"] != name]
    data["rounds"].append({"name": name, "reviewer": REVIEWER, "n": len(items), "ok": ok, "rate": round(ok / len(items), 3), "memo": memo,
                           "criteria": __doc__.split("判定の基準: ")[1].strip(), "items": items})
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(name, f"{ok}/{len(items)} = {ok / len(items):.1%}")


if __name__ == "__main__":
    main()
