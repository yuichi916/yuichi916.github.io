# -*- coding: utf-8 -*-
"""次に調べるべき施設を優先度順に出す。

調査結果は必ず出典URLと確認日つきで curated.json に入れること。
URLが取れないものは採用しない（validate.validate_curated が弾く）。
"""
import argparse, json, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "hitori"

BOUNDARY_SCORE = 3   # スコア境界。ここが一番判定を間違えやすい
RARE_CAT_THRESHOLD = 5


def rank_targets(prefdocs, curated, limit=50):
    """優先度降順の調査対象。conf>=1 の施設は調査済みなので除外する。"""
    targets = []
    for code, doc in prefdocs.items():
        rows = [dict(zip(doc["fields"], r)) for r in doc["items"]]
        cat_counts = Counter(r["cat"] for r in rows)

        for r in rows:
            if r["conf"] >= 1:
                continue
            weight, reasons = 0, []
            if r["score"] == BOUNDARY_SCORE:
                weight += 10
                reasons.append("スコア境界")
            if cat_counts[r["cat"]] <= RARE_CAT_THRESHOLD:
                weight += 5
                reasons.append(f"県内で{r['cat']}が{cat_counts[r['cat']]}件のみ")
            if r["chain"] == 0:
                weight += 2
                reasons.append("独立店")
            if weight == 0:
                continue
            targets.append({
                "id": r["id"], "name": r["name"], "pref": code,
                "cat": r["cat"], "kind": r["kind"], "score": r["score"],
                "weight": weight, "reason": " / ".join(reasons),
                "maps": f"https://www.google.com/maps/search/?api=1&query={r['lat']},{r['lon']}",
            })

    targets.sort(key=lambda t: (-t["weight"], t["pref"], t["id"]))
    return targets[:limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--pref", type=int, default=None, help="この県だけ")
    args = ap.parse_args()

    curated_path = OUT_DIR / "curated.json"
    curated = json.loads(curated_path.read_text(encoding="utf-8")) if curated_path.exists() else {}

    prefdocs = {}
    for f in sorted((OUT_DIR / "pref").glob("*.json")):
        code = int(f.stem)
        if args.pref and code != args.pref:
            continue
        prefdocs[code] = json.loads(f.read_text(encoding="utf-8"))

    if not prefdocs:
        print("pref/*.json がありません。build_data.py を先に実行してください。")
        sys.exit(1)

    for t in rank_targets(prefdocs, curated, args.limit):
        print(f"[{t['weight']:>2}] {t['id']:<12} {t['name'][:22]:<24} "
              f"{t['cat']}/{t['kind']:<12} {t['reason']}")
        print(f"     {t['maps']}")


if __name__ == "__main__":
    main()
