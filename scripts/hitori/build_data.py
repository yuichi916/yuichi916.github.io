# -*- coding: utf-8 -*-
"""raw + curated → data/hitori/ を全生成する。冪等。

取得(fetch_osm.py)と加工(このスクリプト)を分けてあるので、
スコアリングを直すのに Overpass を叩き直す必要はない。
"""
import argparse, json, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chains
import enrich
import hidden
import iso
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
        ax = scoring.axes(rec["kind"], rec["name"], evidence, rec)
        out.append({
            "id": fid, "name": rec["name"],
            "lat": round(rec["lat"], normalize.COORD_DIGITS),
            "lon": round(rec["lon"], normalize.COORD_DIGITS),
            "cat": rec["cat"], "kind": rec["kind"],
            "solo": ax["solo"], "quiet": ax["quiet"], "easy": ax["easy"],
            "conf": scoring.confidence(evidence),
            "chain": int(rec.get("chain", 0)),
            "hidden": 0.0, "hidden_n": 0, "iso": 0,
            "city": rec.get("city", ""), "oh": rec.get("oh", ""),
            "tel": rec.get("tel", ""), "web": rec.get("web", ""),
            "note": rec.get("note", ""),
        })
    return out


def _enrich(records, curated):
    """curated.json の事実で3軸を補正する。推定値は別列に残す。

    上書きにすると、あとから「なぜこの値なのか」を追えなくなる。
    """
    applied = 0
    excluded = []
    kept = []
    for r in records:
        r["solo_est"], r["quiet_est"], r["easy_est"] = r["solo"], r["quiet"], r["easy"]
        r["checked"] = ""
        entry = curated.get(r["id"])
        if not entry:
            kept.append(r)
            continue

        facts = entry.get("facts", [])
        # 「一人で行けるか」以前に、そこへ行けるのかを先に見る。地元住民専用や
        # 閉業が裏付けられた施設を載せると、行った人が門前払いになる。
        reason = enrich.exclusion_reason(facts)
        if reason:
            excluded.append((r["id"], r["name"], reason))
            continue

        r["checked"] = entry.get("checked", "")
        eff = enrich.apply_adjust(
            {"solo": r["solo"], "quiet": r["quiet"], "easy": r["easy"]}, facts)
        r["solo"], r["quiet"], r["easy"] = eff["solo"], eff["quiet"], eff["easy"]
        applied += 1
        kept.append(r)

    records[:] = kept
    return applied, excluded


def build(raw_by_pref, prefs, curated, updated):
    """(summary, {code: pref_doc}) を返す。ファイルI/Oはしない。"""
    by_pref = {}
    all_records = []

    for p in prefs:
        code = p["code"]
        elements = (raw_by_pref.get(code) or {}).get("elements", [])
        records = [r for r in (normalize.to_record(el, curated) for el in elements) if r]
        records += manual_records(curated, code)
        records = normalize.dedupe(records)
        for r in records:
            r["_pref"] = code
        by_pref[code] = records
        all_records.extend(records)

    # 複数県にまたがる同名店をチェーンへ昇格させる。穴場スコアがchainを
    # 読むので、これは必ず compute_hidden より前に行う。
    chains.detect_multi_pref_chains(all_records)

    # 穴場は全国の点集合に対して計算する。県別にやると県境で半径500mが切れる。
    hidden.compute_hidden(all_records)

    # 孤立度も全国の点集合に対して計算する。県別にやると県境で最寄が誤る。
    iso.compute_iso(all_records)

    # 集めた事実で3軸を補正する。solo/quiet/easy が並べ替えにも使われるため、
    # ソートより前に実効値へ差し替えておく必要がある。
    # 現データに無い施設の警告は除外より前に取る。除外した施設まで
    # 「見つからない」と報告してしまうため。
    missing = set(curated) - {r["id"] for r in all_records}
    if missing:
        print(f"警告: curated.json の {len(missing)} 件が現データに見つからない", file=sys.stderr)

    applied, excluded = _enrich(all_records, curated)
    # 出力は by_pref から作られるので、県別リストにも除外を反映する。
    # all_records だけを絞っても出力には届かない。
    dropped = {eid for eid, _, _ in excluded}
    if dropped:
        for code in by_pref:
            by_pref[code] = [r for r in by_pref[code] if r["id"] not in dropped]
    # 黙って消さない。なぜ件数が減ったのか分かるように必ず出す。
    for eid, ename, reason in excluded:
        print(f"除外: {ename}（{eid}）— {reason}", file=sys.stderr)
    if excluded:
        print(f"合計 {len(excluded)} 件を一覧から外した", file=sys.stderr)

    summary_prefs = []
    prefdocs = {}
    total = 0
    for p in prefs:
        code, pop = p["code"], p["pop"]
        records = by_pref[code]
        records.sort(key=lambda r: (-r["solo"], r["name"]))
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
        "iso_threshold": iso.iso_thresholds(all_records),
        "iso_max": iso.MAX_ISO_M,
        "checked_count": applied,
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
    print(f"curated.json による調査済み件数: {summary['checked_count']:,}")


if __name__ == "__main__":
    main()
