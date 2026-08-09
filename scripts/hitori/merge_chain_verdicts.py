# -*- coding: utf-8 -*-
"""チェーン分類の調査結果を brand_notes.json へ取り込む。

同名の施設が複数あるとき、チェーンなのか同名の独立店なのかは機械的な
条件（県数・件数）だけでは分けられない。味の時計台は2県展開の本物の
チェーンで条件から漏れ、松の湯は26件あっても各地の独立銭湯である。
調べて確定したものを名簿に積む。

使い方:
    python scripts/hitori/merge_chain_verdicts.py C:/tmp/cv_all.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "data" / "hitori" / "brand_notes.json"

VERDICTS = ("chain", "not_chain", "generic", "unknown")


def merge(notes, rows):
    """判定を名簿へ積む。戻り値は (更新後の名簿, 内訳)。

    chain と判定するには出典2件以上を要求する。数十件の施設に一斉に印が
    付くため、1件では足りない。足りないものは unknown として残す。
    """
    notes = json.loads(json.dumps(notes, ensure_ascii=False))
    notes.setdefault("active_verified", {"_why": "", "brands": []})
    notes.setdefault("not_a_chain", {"_why": "同名だがチェーンではない"})
    notes.setdefault("generic_name", {
        "_why": "店名ではなく施設の種別名。チェーン判定の対象ですらない"})
    notes.setdefault("unresolved", {"_why": "調べたが判断できなかった"})

    counts = {v: 0 for v in VERDICTS}
    counts["rejected"] = 0
    for r in rows:
        name, v = r.get("name"), r.get("verdict")
        if not name or v not in VERDICTS:
            counts["rejected"] += 1
            continue
        note = r.get("note", "")
        if v == "chain":
            doms = {u.split("/")[2] for u in r.get("urls", []) if "//" in u}
            if len(doms) < 2:
                notes["unresolved"][name] = f"チェーンの疑いだが出典{len(doms)}件のみ: {note}"
                counts["rejected"] += 1
                continue
            if name not in notes["active_verified"]["brands"]:
                notes["active_verified"]["brands"].append(name)
        elif v == "not_chain":
            notes["not_a_chain"][name] = note
        elif v == "generic":
            notes["generic_name"][name] = note
        else:
            notes["unresolved"][name] = note
        counts[v] += 1

    notes["active_verified"]["brands"].sort()
    return notes, counts


def main():
    if len(sys.argv) < 2:
        print("使い方: merge_chain_verdicts.py <判定JSON> [<判定JSON> ...]", file=sys.stderr)
        sys.exit(1)
    # 複数ファイルを一度に取り込む。以前は1つ目しか読まず、残りが黙って
    # 捨てられていた（8体で分担した監査のうち33件しか反映されなかった）。
    rows = []
    for arg in sys.argv[1:]:
        part = json.loads(Path(arg).read_text(encoding="utf-8"))
        if not isinstance(part, list):
            print(f"配列でない: {arg}", file=sys.stderr)
            sys.exit(1)
        rows.extend(part)
        print(f"読み込み {arg}: {len(part)}件", file=sys.stderr)
    notes = json.loads(NOTES.read_text(encoding="utf-8")) if NOTES.exists() else {}
    merged, counts = merge(notes, rows)
    NOTES.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"取り込み: {counts}", file=sys.stderr)
    print(f"wrote {NOTES}")


if __name__ == "__main__":
    main()
