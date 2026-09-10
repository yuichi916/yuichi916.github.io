# -*- coding: utf-8 -*-
"""チェーンの全社サイトから取れた事実を、その全店に展開する。

店舗ごとの公式ページが無いチェーンでも、「券売機で注文」「全店会員制」のような
運用は全社サイトに書いてある。1回読んで全店に効かせる。

ただし**それはその店舗を確認したことにはならない**。だから `scope: "chain"` を付けて、
画面では「チェーン全体の案内」として ◐（公式以外の根拠と同じ扱い）で出す。
店舗単位で裏を取ったものと同じ ● にすると、確かめていないことを確かめたと言うことになる。

使い方:
  python scripts/hitori/chain_expand.py --in <チェーン抽出.json ...> --out <展開結果.json>
"""
import argparse, json, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "hitori"
# 店舗差が出るものは全店に広げない（営業時間・料金・駐車場は店ごとに違う）
SPREADABLE = {"solo_ok", "counter_seats", "payment_method", "reservation", "silence", "access"}


def _norm(s):
    """空白の有無だけ吸収する。「カラオケ まねきねこ」と「カラオケまねきねこ」は同じ店。"""
    return "".join(str(s).split()).lower()


def belongs(store_name, chain_name):
    """その店舗名がそのチェーンのものか。

    データの店舗名は「快活CLUB函館昭和店」のように枝番付きなので、素の一致では拾えない。
    かといって前方一致だけにすると「金太郎」が「金太郎寿司」を巻き込む。
    枝番は「〜店」で終わるという実際の書かれ方を使って線を引く。
    """
    s, c = _norm(store_name), _norm(chain_name)
    if not c or not s.startswith(c):
        return False
    rest = s[len(c):]
    return rest == "" or rest.endswith("店")


def store_names():
    """(店舗名, id) の一覧。チェーン印が付いているものだけ。"""
    out = []
    for f in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        i_id, i_name, i_chain = (doc["fields"].index(k) for k in ("id", "name", "chain"))
        for row in doc["items"]:
            if row[i_chain]:
                out.append((row[i_name], row[i_id]))
    return out


def stores_by_name():
    """互換のために残す（名前そのままの索引）。"""
    out = {}
    for name, fid in store_names():
        out.setdefault(name, []).append(fid)
    return out


def expand(chain_results, stores):
    """stores: (店舗名, id) の一覧。"""
    results, spread, skipped = [], 0, 0
    for r in chain_results:
        name = r.get("chain")
        facts = [f for f in r.get("facts", []) if f.get("k") in SPREADABLE and f.get("quote")]
        if not name or not facts:
            continue
        ids = [fid for sname, fid in stores if belongs(sname, name)]
        if not ids:
            skipped += 1
            continue
        for fid in ids:
            results.append({
                "id": fid, "name": name, "status": "ok", "identity": "match",
                "fetched_urls": [facts[0].get("url", "")],
                # scope=chain: その店舗を確かめたのではなく、チェーン全体の案内
                "facts": [dict(f, scope="chain", official=False) for f in facts],
                "note": f"チェーン全体の案内（{name}）",
            })
            spread += len(facts)
    return results, spread, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inputs", nargs="+", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    chain = []
    for pattern in args.inputs:
        for p in sorted(glob.glob(pattern)) or [pattern]:
            try:
                doc = json.loads(Path(p).read_text(encoding="utf-8-sig"))
            except (ValueError, OSError):
                continue
            chain += doc["results"] if isinstance(doc, dict) else doc

    results, spread, skipped = expand(chain, store_names())
    Path(args.out).write_text(json.dumps({"results": results}, ensure_ascii=False), encoding="utf-8")
    print(f"チェーン {len(chain)} 件 → {len(results):,} 店舗に {spread:,} 事実を展開")
    if skipped:
        print(f"  掲載中の店舗が見つからず見送ったチェーン: {skipped}")
    print(f"{args.out} に書いた。")


if __name__ == "__main__":
    main()
