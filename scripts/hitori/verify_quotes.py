# -*- coding: utf-8 -*-
"""curated.json の引用が、本当にそのページに書いてあるかを確かめる。

抽出のときに検査してはいるが、**本文を手元に持っていない時期に入れた事実**は
素通りしている。実測では LLM の引用の 25% がページに存在しなかった。
入れたあとでも確かめられるようにしておく。

  python scripts/hitori/verify_quotes.py --pages <本文dir> [--pages <本文dir> ...]        # 下見
  python scripts/hitori/verify_quotes.py --pages <本文dir> --drop                        # 通らない事実を外す

照合できるのは「本文を持っている URL の事実」だけ。持っていないものは触らない
（確かめられないことを、確かめて駄目だったことにしない）。
"""
import argparse, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "hitori" / "curated.json"
WS = re.compile(r"\s+")


# HTML→本文の変換方式が違うと、表の区切りが「|」で入るか空白で入るかが変わる。
# 中身が同じ引用を「見つからない」と数えないための正規化（merge_extract と同じ規則）。
_SEP = str.maketrans("", "", "|｜･・〖〗【】［］[]（）()　")


def norm(s):
    return (WS.sub("", str(s)).translate(_SEP)
            .replace("～", "〜").replace("－", "-").replace("：", ":"))


def load_pages(dirs):
    """url -> 本文。fetch_pages.py の出力ディレクトリを何個でも受ける。"""
    pages = {}
    for d in dirs:
        base = Path(d)
        fetch = base / "fetch.json"
        if not fetch.exists():
            continue
        for rec in json.loads(fetch.read_text(encoding="utf-8")):
            if rec.get("status") != "ok":
                continue
            p = base / "pages" / f"{rec['id']}.txt"
            if not p.exists():
                continue
            text = p.read_text(encoding="utf-8")
            for u in (rec.get("final_url"), rec.get("web")):
                if u:
                    pages[u] = text
    return pages


def check(curated, pages):
    """(照合できた数, 通らなかった事実のリスト) を返す。"""
    checked, bad = 0, []
    for fid, entry in curated.items():
        for f in entry.get("facts", []):
            q = f.get("quote")
            if not q:
                continue
            text = next((pages[u] for u in f.get("urls", []) if u in pages), None)
            if text is None:
                continue
            checked += 1
            qn = norm(q).rstrip("…").rstrip(".")
            if qn and qn not in norm(text):
                bad.append((fid, f))
    return checked, bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", nargs="+", required=True)
    ap.add_argument("--drop", action="store_true", help="通らない事実を curated.json から外す")
    args = ap.parse_args()

    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    pages = load_pages(args.pages)
    checked, bad = check(curated, pages)
    total = sum(len(e.get("facts", [])) for e in curated.values())
    print(f"事実 {total:,} 件のうち、本文を持っていて照合できたもの {checked:,} 件")
    print(f"  引用がページに見つからない: {len(bad):,} 件"
          f"（{len(bad) * 100 / max(checked, 1):.1f}%）")
    by_src = {}
    for _, f in bad:
        for s in f.get("src", ["?"]):
            by_src[s] = by_src.get(s, 0) + 1
    for s, n in sorted(by_src.items(), key=lambda x: -x[1])[:8]:
        print(f"    {n:5} {s}")
    for fid, f in bad[:5]:
        print(f"    例 {fid} {f['k']}={str(f['v'])[:20]!r} 引用={str(f.get('quote'))[:44]!r}")

    if not args.drop:
        print("下見のみ。外すには --drop を付ける。")
        return
    drop = {(fid, id(f)) for fid, f in bad}
    removed = 0
    for fid, entry in curated.items():
        keep = [f for f in entry.get("facts", []) if (fid, id(f)) not in drop]
        removed += len(entry.get("facts", [])) - len(keep)
        entry["facts"] = keep
    # 事実がゼロになった施設は、根拠を持たない施設なので索引から消す
    empty = [fid for fid, e in curated.items() if not e.get("facts")]
    for fid in empty:
        del curated[fid]
    CURATED.write_text(json.dumps(curated, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{removed:,} 件の事実を外した。根拠が無くなった施設 {len(empty):,} 件も外した。")
    print("scripts/hitori/build_index.py を実行して索引を作り直すこと。")


if __name__ == "__main__":
    main()
