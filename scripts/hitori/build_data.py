# -*- coding: utf-8 -*-
"""raw + curated → data/hitori/ を全生成する。冪等。

取得(fetch_osm.py)と加工(このスクリプト)を分けてあるので、
スコアリングを直すのに Overpass を叩き直す必要はない。
"""
import argparse, json, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize
import scoring
import validate

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"
CURATED = ROOT / "data" / "hitori" / "curated.json"
RAW_DIR = ROOT / "_local" / "hitori_raw"
OUT_DIR = ROOT / "data" / "hitori"

CATS = ("bath", "eat", "play", "stay")


def _density(count, pop):
    return round(count / pop * 100000, 2) if pop else 0.0


def manual_records(curated, code):
    """curated の 'c-' エントリのうち、指定県のものをレコード化する。

    OSM に存在しない施設（カプセルホテルなど。全国で1件しかタグ付けされていない）を
    手で足すための経路。OSM 由来と同じスコアリングを通す。
    """
    out = []
    for fid, rec in curated.items():
        if not fid.startswith("c-") or rec.get("excluded"):
            continue
        if rec.get("pref") != code:
            continue
        evidence = rec.get("evidence") or []
        out.append({
            "id": fid,
            "name": rec["name"],
            "lat": round(rec["lat"], normalize.COORD_DIGITS),
            "lon": round(rec["lon"], normalize.COORD_DIGITS),
            "cat": rec["cat"],
            "kind": rec["kind"],
            "score": scoring.score(rec["base"], rec["name"], evidence),
            "conf": scoring.confidence(evidence),
            "chain": int(rec.get("chain", 0)),
            "note": rec.get("note", ""),
        })
    return out


def build(raw_by_pref, prefs, curated, updated):
    """(summary, {code: pref_doc}) を返す。ファイルI/Oはしない。"""
    summary_prefs = []
    prefdocs = {}
    total = 0

    for p in prefs:
        code, pop = p["code"], p["pop"]
        elements = (raw_by_pref.get(code) or {}).get("elements", [])

        records = [r for r in (normalize.to_record(el, curated) for el in elements) if r]
        records += manual_records(curated, code)
        records = normalize.dedupe(records)
        records.sort(key=lambda r: (-r["score"], r["name"]))
        total += len(records)

        counts = {c: 0 for c in CATS}
        counts_indie = {c: 0 for c in CATS}
        for r in records:
            counts[r["cat"]] += 1
            if r["chain"] == 0:
                counts_indie[r["cat"]] += 1
        counts["all"] = sum(counts[c] for c in CATS)
        counts_indie["all"] = sum(counts_indie[c] for c in CATS)

        summary_prefs.append({
            "code": code, "name": p["name"], "pop": pop,
            "counts": counts, "counts_indie": counts_indie,
            "density": {k: _density(v, pop) for k, v in counts.items()},
            "density_indie": {k: _density(v, pop) for k, v in counts_indie.items()},
        })

        fields = validate.EXPECTED_FIELDS
        prefdocs[code] = {
            "pref": code, "name": p["name"], "updated": updated,
            "fields": fields,
            "items": [[r[f] for f in fields] for r in records],
        }

    summary = {
        "updated": updated,
        "total": total,
        "population_source": "Wikidata (CC0) / 令和2年国勢調査",
        "prefectures": summary_prefs,
    }
    return summary, prefdocs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--allow-partial", action="store_true",
                    help="47県揃っていなくてもビルドする")
    args = ap.parse_args()

    prefs = json.loads(MASTER.read_text(encoding="utf-8"))
    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}

    cur_errs = validate.validate_curated(curated)
    if cur_errs:
        print(f"curated.json に {len(cur_errs)} 件の問題があります:")
        for e in cur_errs[:30]:
            print("  " + e)
        sys.exit(1)

    raw_by_pref = {}
    for p in prefs:
        f = RAW_DIR / f"{p['code']:02d}.json"
        if f.exists():
            raw_by_pref[p["code"]] = json.loads(f.read_text(encoding="utf-8"))

    if len(raw_by_pref) < 47 and not args.allow_partial:
        missing = [p["code"] for p in prefs if p["code"] not in raw_by_pref]
        print(f"raw が {len(raw_by_pref)}/47 件しかありません。未取得: {missing}")
        print("fetch_osm.py を再実行するか、--allow-partial を付けてください。")
        sys.exit(1)

    summary, prefdocs = build(raw_by_pref, prefs, curated, date.today().isoformat())

    errs = validate.validate_summary(summary)
    for code, doc in prefdocs.items():
        errs += [f"pref{code}: {e}" for e in validate.validate_pref(doc)]
    if errs:
        print(f"検証エラー {len(errs)} 件:")
        for e in errs[:30]:
            print("  " + e)
        sys.exit(1)

    (OUT_DIR / "pref").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for code, doc in prefdocs.items():
        (OUT_DIR / "pref" / f"{code:02d}.json").write_text(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    biggest = max(prefdocs, key=lambda c: len(prefdocs[c]["items"]))
    size_kb = (OUT_DIR / "pref" / f"{biggest:02d}.json").stat().st_size / 1024
    print(f"total {summary['total']:,} 件 / 最大 {biggest:02d} = "
          f"{len(prefdocs[biggest]['items']):,} 件 {size_kb:.0f}KB")


if __name__ == "__main__":
    main()
