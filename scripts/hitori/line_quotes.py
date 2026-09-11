# -*- coding: utf-8 -*-
"""LLM が返した「行番号」から引用文を復元する。

手元に本文を置いても、LLM は引用を書き写せない（実測で 45% が不一致だった。
要約・言い換え・表記の直しが混ざる）。だったら書き写させず、**根拠の行番号だけ**を
言わせて、引用はこちらがファイルから切り出す。捏造が原理的に起きなくなる。

  python scripts/hitori/line_quotes.py --in <LLMの出力.json ...> --batch <batchのdir> --out <復元後.json>
"""
import argparse, glob, json
from pathlib import Path

MAXQ = 80


def page_index(batches):
    """url -> 本文ファイルのパス。batch ファイルが持っている対応表を使う。"""
    idx = {}
    for p in sorted(glob.glob(str(Path(batches) / "*.json"))):
        for item in json.loads(Path(p).read_text(encoding="utf-8-sig")):
            for pg in item.get("pages", []):
                idx[pg["url"]] = pg["path"]
    return idx


def restore(results, idx):
    """facts の line を quote に変える。復元できない事実は落とす。"""
    out, dropped = [], {}
    for r in results:
        facts = []
        for f in r.get("facts", []):
            path = idx.get(f.get("url"))
            n = f.get("line")
            if not path or not isinstance(n, int):
                dropped["行番号か url が無い"] = dropped.get("行番号か url が無い", 0) + 1
                continue
            try:
                lines = Path(path).read_text(encoding="utf-8").splitlines()
            except OSError:
                dropped["本文が読めない"] = dropped.get("本文が読めない", 0) + 1
                continue
            if not (1 <= n <= len(lines)):
                dropped["行番号が範囲外"] = dropped.get("行番号が範囲外", 0) + 1
                continue
            line = lines[n - 1].strip()
            if len(line) < 4:
                dropped["指した行が短すぎる"] = dropped.get("指した行が短すぎる", 0) + 1
                continue
            quote = line if len(line) <= MAXQ else line[:MAXQ - 1] + "…"
            facts.append({k: v for k, v in f.items() if k != "line"} | {"quote": quote})
        if facts:
            out.append(dict(r, facts=facts))
    return out, dropped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inputs", nargs="+", required=True)
    ap.add_argument("--batch", required=True, help="batch ファイルのあるディレクトリ")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    results = []
    for pattern in args.inputs:
        for p in sorted(glob.glob(pattern)) or [pattern]:
            try:
                doc = json.loads(Path(p).read_text(encoding="utf-8-sig"))
            except (ValueError, OSError):
                continue
            results += doc["results"] if isinstance(doc, dict) else doc

    out, dropped = restore(results, page_index(args.batch))
    Path(args.out).write_text(json.dumps({"results": out}, ensure_ascii=False), encoding="utf-8")
    print(f"{len(results)} 施設 → 復元できた {len(out)} 施設 / "
          f"{sum(len(r['facts']) for r in out)} 事実")
    for why, n in sorted(dropped.items(), key=lambda x: -x[1]):
        print(f"    {n:4} {why}")
    print(f"{args.out} に書いた。")


if __name__ == "__main__":
    main()
