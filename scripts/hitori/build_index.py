# -*- coding: utf-8 -*-
"""curated.json と pref/NN.json から、軽い索引 index.json と県別 curated/NN.json を作る。

hitori.html は初回に 2.3MB の curated.json を丸ごと読んでいた。索引だけを先に読み、
事実の本体は必要になった県だけ読むための一方向の派生。curated.json 自体は触らない。
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "hitori"


def _pref_of_ids(prefdocs):
    out = {}
    for code, doc in prefdocs.items():
        i = doc["fields"].index("id")
        for row in doc["items"]:
            out[row[i]] = code
    return out


def _is_grounded_insight(fact):
    v = fact.get("v")
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return False
    return (fact.get("official") is True and isinstance(v, dict)
            and v.get("quality") == "grounded"
            and v.get("policyVersion") == "official-provenance-v2"
            and bool(str(v.get("title", "")).strip()) and bool(str(v.get("insight", "")).strip()))


def build_index(prefdocs, curated, summary):
    pref_of = _pref_of_ids(prefdocs)
    checked, by_pref, orphans = {}, {code: {} for code in prefdocs}, []
    for fid, entry in curated.items():
        code = pref_of.get(fid)
        if code is None:
            orphans.append(fid)
            continue
        facts = entry.get("facts", [])
        checked[fid] = [
            code, len(facts),
            sum(1 for f in facts if f.get("official")),
            sum(1 for f in facts if f.get("conflict")),
            1 if any(f.get("k") == "solo_insight" and _is_grounded_insight(f) for f in facts) else 0,
            entry.get("checked", ""),
        ]
        by_pref[code][fid] = entry
    prefectures = []
    for code, doc in sorted(prefdocs.items()):
        ilat, ilon = doc["fields"].index("lat"), doc["fields"].index("lon")
        n = len(doc["items"])
        lat = sum(r[ilat] for r in doc["items"]) / n if n else 0
        lon = sum(r[ilon] for r in doc["items"]) / n if n else 0
        prefectures.append({"code": code, "name": doc["name"], "count": n,
                            "checked": len(by_pref[code]),
                            "center": [round(lat, 4), round(lon, 4)]})
    index = {"updated": summary["updated"], "total": summary["total"],
             "checked_count": len(checked), "prefectures": prefectures, "checked": checked}
    if orphans:
        print(f"県ファイルに無い curated: {len(orphans)} 件を索引から外した", file=sys.stderr)
    return index, by_pref


def main():
    summary = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    curated = json.loads((DATA / "curated.json").read_text(encoding="utf-8"))
    prefdocs = {}
    for f in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        prefdocs[int(doc["pref"])] = doc
    index, by_pref = build_index(prefdocs, curated, summary)
    (DATA / "curated").mkdir(exist_ok=True)
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for code, entries in by_pref.items():
        (DATA / "curated" / f"{code:02d}.json").write_text(
            json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = (DATA / "index.json").stat().st_size / 1024
    print(f"index.json {kb:.0f}KB / checked {index['checked_count']:,} / curated/ {len(by_pref)} files")


if __name__ == "__main__":
    main()
