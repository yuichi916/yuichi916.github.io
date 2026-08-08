# -*- coding: utf-8 -*-
"""次に調べるべき施設を優先度順に出す。

調査結果は必ず出典URLと確認日つきで curated.json に入れること。
URLが取れないものは採用しない（validate.validate_curated が弾く）。
"""
import argparse, json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "hitori"

BOUNDARY_VALUE = 3        # 3軸の中央。ここが一番判定を間違えやすい
RARE_CAT_THRESHOLD = 5
PUBLIC_BATH_BONUS = 6     # 自治体が施設ページを持つので必ず当たる
ISOLATED_BONUS = 4        # そこしか無いので調べる価値が高い
GEM_BONUS = 3

AXES = ("solo", "quiet", "easy")
_PUBLIC_RE = re.compile(r"(市営|町営|村営|公衆浴場|共同浴場)")


def _nearest_city(lat, lon, munis):
    """最寄りの市区町村名。OSMに city が無い施設のため。

    「町営公衆浴場」のような一般名は、地名が無いと検索のしようがない。
    正確な所在自治体である必要はなく、検索クエリの手掛かりになればよい。
    """
    best, bestd = "", float("inf")
    for name, mlat, mlon in munis:
        d = (mlat - lat) ** 2 + ((mlon - lon) * 0.82) ** 2
        if d < bestd:
            bestd, best = d, name
    return best


def _load_municipalities():
    f = OUT_DIR / "places.json"
    if not f.exists():
        return []
    doc = json.loads(f.read_text(encoding="utf-8"))
    i = {k: n for n, k in enumerate(doc["fields"])}
    return [(r[i["name"]], r[i["lat"]], r[i["lon"]])
            for r in doc["items"] if r[i["type"]] == "c"]   # c=市区町村, s=駅


def _is_boundary(r):
    """いずれかの軸が中央値。かつては単一の score 列で見ていたが、その列は
    削除されている。3軸に移した。"""
    return any(r[a] == BOUNDARY_VALUE for a in AXES)


def rank_targets(prefdocs, curated, limit=50, iso_threshold=None, munis=None):
    """優先度降順の調査対象。curated.json にある施設は調査済みなので除外する。

    iso_threshold は summary.json の値を渡す（しきい値をここに書かない）。
    """
    iso_threshold = iso_threshold or {}
    munis = munis or []
    targets = []
    for code, doc in prefdocs.items():
        rows = [dict(zip(doc["fields"], r)) for r in doc["items"]]
        cat_counts = Counter(r["cat"] for r in rows)

        for r in rows:
            if r["id"] in curated:
                continue
            weight, reasons = 0, []
            if _is_boundary(r):
                weight += 10
                reasons.append("軸が中央値")
            if r["cat"] == "bath" and _PUBLIC_RE.search(r["name"]):
                weight += PUBLIC_BATH_BONUS
                reasons.append("公営の入浴施設")
            th = iso_threshold.get(r["cat"])
            if th and r.get("iso", 0) >= th:
                weight += ISOLATED_BONUS
                reasons.append("孤立")
            if r["chain"] == 0 and r.get("hidden_n", 0) >= 3 and r.get("hidden", 0) >= 0.4:
                weight += GEM_BONUS
                reasons.append("穴場")
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
                "cat": r["cat"], "kind": r["kind"],
                "city": r.get("city") or _nearest_city(r["lat"], r["lon"], munis),
                "axes": [r["solo"], r["quiet"], r["easy"]],
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
    summary = json.loads((OUT_DIR / "summary.json").read_text(encoding="utf-8"))

    prefdocs = {}
    for f in sorted((OUT_DIR / "pref").glob("*.json")):
        code = int(f.stem)
        if args.pref and code != args.pref:
            continue
        prefdocs[code] = json.loads(f.read_text(encoding="utf-8"))

    if not prefdocs:
        print("pref/*.json がありません。build_data.py を先に実行してください。")
        sys.exit(1)

    for t in rank_targets(prefdocs, curated, args.limit,
                          summary.get("iso_threshold"), _load_municipalities()):
        where = t["city"] or f"pref{t['pref']:02d}"
        print(f"[{t['weight']:>2}] {t['id']:<12} {t['name'][:20]:<22} {where[:10]:<12} "
              f"{t['cat']}/{t['kind']:<10} {t['reason']}")
        print(f"     {t['maps']}")


if __name__ == "__main__":
    main()
