# -*- coding: utf-8 -*-
"""調べた事実を、県別データの見立て（solo/quiet/easy）に反映し直す。

build_data.py はこれを毎回やっているが、あれは OSM の生データから全部を
作り直すので、施設の総数そのものが動く。事実だけが増えた回に総数を動かす
理由は無い（40,615 はトップにも方法論記事にも出ている数字）。

ここは**既存の県別ファイルの3軸だけ**を書き換える。素点（*_est）はそのまま
使い、enrich.apply_adjust を掛け直す。掛ける元が同じなので、何度流しても
同じ結果になる。

  python scripts/hitori/reapply_axes.py           # 下見
  python scripts/hitori/reapply_axes.py --apply
"""
import argparse
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enrich                                              # noqa: E402

DATA = ROOT / "data" / "hitori"
AXES = ("solo", "quiet", "easy")


def recompute(doc, curated):
    """1県ぶん。(書き換えた件数, 軸ごとの増減の数え) を返す。"""
    f = {k: i for i, k in enumerate(doc["fields"])}
    changed, moves = 0, collections.Counter()
    for row in doc["items"]:
        entry = curated.get(row[f["id"]])
        est = {a: row[f[f"{a}_est"]] for a in AXES}
        eff = enrich.apply_adjust(est, entry.get("facts", [])) if entry else dict(est)
        if any(row[f[a]] != eff[a] for a in AXES):
            changed += 1
            for a in AXES:
                if row[f[a]] != eff[a]:
                    moves[f"{a}{'+' if eff[a] > row[f[a]] else '-'}"] += 1
                    row[f[a]] = eff[a]
    return changed, moves


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    curated = json.loads((DATA / "curated.json").read_text(encoding="utf-8"))
    total, moves = 0, collections.Counter()
    for path in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        n, m = recompute(doc, curated)
        total += n
        moves.update(m)
        if n and args.apply:
            path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")),
                            encoding="utf-8")
    print(f"見立てが動く施設 {total:,} 件")
    for k in sorted(moves):
        print(f"  {k} {moves[k]:,}")
    if not args.apply:
        print("下見のみ。書き換えるには --apply を付ける。")
        return
    print("data/hitori/pref/*.json を書き換えた。")
    print("scripts/hitori/build_index.py を実行して索引を作り直すこと。")


if __name__ == "__main__":
    main()
