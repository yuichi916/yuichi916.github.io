"""どっちが本物？: 表面の手がかりだけで答えたときの正答率。

各組で「特徴の値が大きい方を原文と答える」戦略の正答率を出す（同じ値なら半分当たりとする）。
逆向き（小さい方を原文と答える）の正答率は 1 - それ。どちら向きでも 65% を超える手がかりは「効いてしまう」とみなす。

使い方:  python scripts/honmono/surface_cues.py   → 表を出し、data/honmono/surface_cues.json に書く
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "honmono"

KANJI = re.compile(r"[㐀-鿿豈-﫿々〆]")
KATA = re.compile(r"[ァ-ヺー]")
HIRA = re.compile(r"[ぁ-ゖ]")


def sentences(t: str) -> list[str]:
    return [s for s in re.split(r"(?<=[。！？])", t.replace("\n", "")) if s.strip()]


def features(t: str) -> dict[str, float]:
    s = t.replace("\n", "")
    n = len(s)
    ss = sentences(t)
    return {
        "長さ（字数）": n,
        "句読点の数（、。）": s.count("、") + s.count("。"),
        "読点の数（、）": s.count("、"),
        "文の数": len(ss),
        "1文の平均の長さ": n / max(1, len(ss)),
        "読点1つあたりの字数": n / max(1, s.count("、")),
        "漢字の割合": len(KANJI.findall(s)) / n,
        "ひらがなの割合": len(HIRA.findall(s)) / n,
        "カタカナの数": len(KATA.findall(s)),
        "かぎかっこ「の数": s.count("「"),
        "……・――の数": s.count("…") + s.count("―"),
        "段落の数": t.count("\n") + 1,
    }


def strategy_accuracy(pairs: list[dict]) -> dict[str, float]:
    """特徴ごとに「値が大きい方を原文と答える」ときの正答率"""
    acc: dict[str, float] = {}
    for p in pairs:
        fo, fa = features(p["original"]), features(p["ai"])
        for k in fo:
            v = 1.0 if fo[k] > fa[k] else 0.0 if fo[k] < fa[k] else 0.5
            acc[k] = acc.get(k, 0.0) + v
    return {k: v / len(pairs) for k, v in acc.items()}


def main() -> None:
    pairs = json.loads((D / "pairs.json").read_text(encoding="utf-8"))["pairs"]
    acc = strategy_accuracy(pairs)
    rows = []
    print(f"{'手がかり':<16} 大きい方を原文 / 小さい方を原文")
    for k, v in acc.items():
        best = max(v, 1 - v)
        flag = "  <- 65% 超" if best > 0.65 else ""
        print(f"{k:<16} {v:6.1%} / {1 - v:6.1%}{flag}")
        rows.append({"cue": k, "pick_larger_as_original": round(v, 4), "pick_smaller_as_original": round(1 - v, 4),
                     "over_65": best > 0.65})
    (D / "surface_cues.json").write_text(json.dumps({
        "note": "表面の手がかりだけで答えたときの正答率（全組）。同じ値の組は半分当たりとして数えた。",
        "pairs": len(pairs),
        "cues": rows,
    }, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
