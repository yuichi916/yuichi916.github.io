"""どっちが本物？: AI に渡す指示文を作る（原文は入れない）。

入力: data/honmono/works.json（作家・題・表記）、data/honmono/originals.json（長さ・段落数だけを使う）、
      data/honmono/briefs.json（作業役が書いた場面のあらすじ）
出力: data/honmono/prompts.json（作品ごとの指示文。公開する）
      引数で渡したファイル（AI にそのまま渡す一括の依頼文）

使い方:  python scripts/honmono/make_prompts.py C:\\tmp\\honmono-src\\gen_input.txt
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TEMPLATE = (
    "{author}『{title}』の一場面を、原文を見ずに、あなた自身の文で書いてください。\n"
    "場面のあらすじ: {synopsis}\n"
    "語りと文体: {voice}\n"
    "表記: {ortho}\n"
    "長さ: {n}字前後（{lo}〜{hi}字。改行は数えない）。{paras}段落。\n"
    "原文の文を思い出して写さないこと。題名・説明・注釈は付けず、本文だけを書くこと。"
)

ORTHO = {
    "新字新仮名": "新字体・現代仮名遣い",
    "新字旧仮名": "新字体・歴史的仮名遣い",
}

RANGE = 0.15  # 指示する長さの幅（検査の合格線 ±20% より狭くしておく）


def build() -> list[dict]:
    works = {w["id"]: w for w in json.loads((ROOT / "data/honmono/works.json").read_text(encoding="utf-8"))["works"]}
    origs = json.loads((ROOT / "data/honmono/originals.json").read_text(encoding="utf-8"))
    briefs = json.loads((ROOT / "data/honmono/briefs.json").read_text(encoding="utf-8"))["briefs"]
    out = []
    for o in origs:
        w = works[o["work_id"]]
        b = briefs[o["work_id"]]
        title = w["title"] + (f"　{w['subtitle']}" if w["subtitle"] else "")
        n = o["chars"]
        prompt = TEMPLATE.format(
            author=w["author"], title=title, synopsis=b["synopsis"], voice=b["voice"],
            ortho=ORTHO[w["orthography"]], n=n, lo=round(n * (1 - RANGE)), hi=round(n * (1 + RANGE)),
            paras=o["paragraphs"],
        )
        out.append({"work_id": o["work_id"], "prompt": prompt})
    return out


def main() -> None:
    items = build()
    (ROOT / "data/honmono/prompts.json").write_text(json.dumps({
        "template": TEMPLATE,
        "orthography_map": ORTHO,
        "length_range": RANGE,
        "items": items,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    if len(sys.argv) > 1:
        lines = []
        for it in items:
            lines.append(f"=== {it['work_id']} ===\n{it['prompt']}\n")
        Path(sys.argv[1]).write_text("\n".join(lines), encoding="utf-8")
    print("prompts", len(items))


if __name__ == "__main__":
    main()
