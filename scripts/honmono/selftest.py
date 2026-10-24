"""どっちが本物？: データの自己検査。1つでも落ちたら終了コード 1。

  1. 作品: 50件前後（40〜60）、作品・人物の著作権フラグが「なし」、没年が1967年以前、作品の重複なし
  2. 原文: 保存した zip の SHA-256 が記録と一致し、規則どおり整えたテキストに文字どおり含まれる（全件）。
     段落単位の切り出しは、その行の本文（字下げを除く）と完全に一致する
  3. 規則の既知例: ルビ・｜・入力者注が消え、親文字が残る
  4. AI の文: 全件ある、長さが原文の ±20% 以内、使えない記号がない、原文と同一でない
  5. 指示文: 原文の文（15字以上）がそのまま入っていない
  6. 並び: データの並びで同じ作品・同じ作家が続かない（出題時の並びは test_core.mjs で検査）。作家は20人以上
  7. 解説: 全件1行（改行なし・80字以内）、「」で引いた言葉が原文かAIの文に実際にある
  8. 照合の結果（最長一致）を報告する

使い方:  python scripts/honmono/selftest.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aozora_text import BAD, clean_line, load_clean  # noqa: E402
from passages import PICKS, extract  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "honmono"
fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        fails.append(msg)
        print("  FAIL", msg)


def main() -> None:
    works = json.loads((D / "works.json").read_text(encoding="utf-8"))["works"]
    data = json.loads((D / "pairs.json").read_text(encoding="utf-8"))
    pairs = data["pairs"]
    wmap = {w["id"]: w for w in works}

    # 1
    print("1. 作品と著作権")
    check(40 <= len(pairs) <= 60, f"問題数 {len(pairs)}")
    check(len({p["work_id"] for p in pairs}) == len(pairs), "作品の重複")
    for w in works:
        check(w["work_copyright"] == "なし" and w["person_copyright"] == "なし", f"{w['id']} 著作権フラグ")
        check(int(w["died"][:4]) <= 1967, f"{w['id']} 没年 {w['died']}")
        check(w["card_url"].startswith("https://www.aozora.gr.jp/cards/"), f"{w['id']} 図書カード URL")

    # 2
    print("2. 原文の照合")
    pick_by_id = {p[0]: p for p in PICKS}
    for p in pairs:
        w = wmap[p["work_id"]]
        z = ROOT / w["text_zip"]
        check(hashlib.sha256(z.read_bytes()).hexdigest() == w["text_zip_sha256"], f"{w['id']} zip の SHA-256")
        clean = load_clean(z)
        lines = clean.split("\n")
        for para in p["original"].split("\n"):
            check(para in clean, f"{w['id']} 原文がテキストに含まれない: {para[:20]}")
        check(extract(lines, pick_by_id[w["id"]]) == p["original"], f"{w['id']} 切り出しの再現")
        wh = p["where"]
        if "paragraphs" in wh:
            seg = [l.lstrip("　 ") for l in lines[wh["line"]:wh["line"] + wh["paragraphs"]]]
            check(seg == p["original"].split("\n"), f"{w['id']} 段落の完全一致")

    # 3
    print("3. 整える規則の既知例")
    check(clean_line("　山路《やまみち》を｜登りながら［＃「登りながら」に傍点］、") == "　山路を登りながら、", "ルビと注記の除去")

    # 4
    print("4. AI の文")
    ratios = []
    for p in pairs:
        a, o = p["ai"], p["original"]
        na, no = len(a.replace("\n", "")), len(o.replace("\n", ""))
        r = na / no - 1
        ratios.append(r)
        check(abs(r) <= 0.20, f"{p['id']} 長さの差 {r:+.0%}")
        check(100 <= no <= 250, f"{p['id']} 原文の長さ {no}")
        check(not any(b in a for b in BAD), f"{p['id']} AI の文に使えない記号")
        check(not any(b in o for b in BAD), f"{p['id']} 原文に使えない記号")
        check(a.strip() != o.strip(), f"{p['id']} AI の文が原文と同一")
        check(p["chars"]["ai"] == na and p["chars"]["original"] == no, f"{p['id']} 文字数の記録")
    check(bool(data["generator"]["model"]), "モデル名の記録")

    # 5
    print("5. 指示文に原文が入っていない")
    for p in pairs:
        for s in re.findall(r"[^。\n]{15,}。?", p["original"]):
            check(s not in p["prompt"], f"{p['id']} 指示文に原文の文: {s[:20]}")
        check(p["original"] not in p["prompt"], f"{p['id']} 指示文に原文全体")

    # 6
    print("6. 並び")
    for a, b in zip(pairs, pairs[1:]):
        check(a["work_id"] != b["work_id"], f"同じ作品が続く {a['id']}")
        check(a["author"] != b["author"], f"同じ作家が続く {a['id']} {b['id']}")
    authors = {p["author"] for p in pairs}
    check(len(authors) >= 20, f"作家の数 {len(authors)}")

    # 7
    print("7. 解説")
    for p in pairs:
        t = p["tell"]
        check(bool(t) and "\n" not in t and len(t) <= 80, f"{p['id']} 解説の形 {len(t)}字")
        # 解説が「」で引いた言葉は、原文かAIの文に実際にある（〜・…で区切った各片）
        both = p["original"].replace("\n", "") + "\0" + p["ai"].replace("\n", "")
        for q in re.findall(r"「([^」]+)」", t):
            for frag in re.split(r"[〜…]+", q):
                if frag:
                    check(frag in both, f"{p['id']} 解説の引用が本文にない: {frag}")

    # 8
    runs = sorted((p["longest_common_run"], p["id"], p["author"], p["title"]) for p in pairs)
    print(f"8. 原文とAIの文の最長一致: 最小 {runs[0][0]} 字 / 中央 {runs[len(runs)//2][0]} 字 / 最大 {runs[-1][0]} 字")
    for r in runs[-5:]:
        print("   ", r)
    print(f"   長さの差: {min(ratios):+.0%} 〜 {max(ratios):+.0%}")
    print(f"   作品 {len(pairs)} / 作家 {len(authors)} / 書き直し {data['generator']['rewritten']} 件")

    if fails:
        print(f"\nFAIL {len(fails)} 件")
        sys.exit(1)
    print("\nALL OK")


if __name__ == "__main__":
    main()
