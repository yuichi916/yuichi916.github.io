# -*- coding: utf-8 -*-
"""Overpass から県単位でデータを取得し、_local/hitori_raw/ にキャッシュする。

途中で失敗しても再実行すれば未取得の県だけを埋める。47県すべてが揃うまで
build_data.py は走らせないこと。
"""
import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import osm_query

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "hitori" / "prefectures.json"
RAW_DIR = ROOT / "_local" / "hitori_raw"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=int, default=None, help="この県コードだけ取得する")
    ap.add_argument("--force", action="store_true", help="キャッシュがあっても取り直す")
    args = ap.parse_args()

    prefs = json.loads(MASTER.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    failed = []
    for p in prefs:
        code = p["code"]
        if args.only and code != args.only:
            continue
        out = RAW_DIR / f"{code:02d}.json"
        if out.exists() and not args.force:
            print(f"skip {code:02d} {p['name']} (cached)", flush=True)
            continue
        try:
            data = osm_query.run_query(osm_query.build_query(code))
        except osm_query.OverpassError as e:
            print(f"FAIL {code:02d} {p['name']}: {e}", flush=True)
            failed.append(code)
            continue
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"ok   {code:02d} {p['name']}: {len(data['elements'])} elements", flush=True)
        time.sleep(3)  # Overpass への礼儀。連続投げでレート制限に当たらないように

    have = sorted(int(f.stem) for f in RAW_DIR.glob("*.json") if f.stem.isdigit())
    print(f"\ncached: {len(have)}/47 prefectures")
    if failed:
        print(f"failed: {failed} — 再実行すれば未取得分だけ取りにいきます")
        sys.exit(1)


if __name__ == "__main__":
    main()
