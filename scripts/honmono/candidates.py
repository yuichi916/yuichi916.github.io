"""どっちが本物？（作業用）: 各作品から、問題に使えそうな段落の候補を並べる。

候補の条件: 1段落または連続する2段落で 100〜200 字、passage_ok（外字などを含まない）、
会話だけの段落（「 で始まり 」で終わる）ではない。作品の中から均等に最大 N 個を出す。

使い方:  python scripts/honmono/candidates.py [N] > 出力ファイル
出力の「行番号+段落数」を passages.py に書くと、その範囲が機械的に切り出される。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aozora_text import load_clean, passage_ok  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
LO, HI = 100, 200


def para(l: str) -> str:
    return l.strip("　 ")


def main() -> None:
    works = json.loads((ROOT / "data/honmono/works.json").read_text(encoding="utf-8"))["works"]
    for w in works:
        lines = load_clean(ROOT / w["text_zip"]).split("\n")
        cands = []
        for i, l in enumerate(lines):
            for k in (1, 2):
                seg = [para(x) for x in lines[i:i + k]]
                if len(seg) < k or any(not s for s in seg):
                    continue
                t = "\n".join(seg)
                n = len(t.replace("\n", ""))
                if not (LO <= n <= HI) or not passage_ok(t):
                    continue
                if all(s.startswith("「") and s.endswith("」") for s in seg):
                    continue
                cands.append((i, k, t))
                break
        if not cands:
            print(f"### {w['id']} {w['author']}『{w['title']}』 候補なし\n")
            continue
        step = max(1, len(cands) // N)
        pick = cands[step // 2::step][:N]
        print(f"### {w['id']} {w['author']}『{w['title']}』 {w['orthography']} 全{len(lines)}行 候補{len(cands)}")
        for i, k, t in pick:
            print(f"[{i}+{k}] {t}")
        print()


if __name__ == "__main__":
    main()
