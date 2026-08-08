# -*- coding: utf-8 -*-
"""全国の施設名インデックスを生成する。

これは「探すためだけ」の索引であり、表示用のデータは持たない。
名前・県コード・県ファイル内の行番号だけを持つ。施設IDを持つ方式より
軽く（実測 gzip 534KB → 378KB）、選択後にその県のファイルを読めば
実体は取れる。

添字は生成時点の県ファイルに対応する。片方だけ古いと別の施設を開くという
静かな誤りになるため、updated を両方に持たせてランタイムで突き合わせる。
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREF_DIR = ROOT / "data" / "hitori" / "pref"
OUT = ROOT / "data" / "hitori" / "facilities.json"

FIELDS = ["name", "pref", "i"]
MIN_PREF_FILES = 47


class MissingPrefDataError(RuntimeError):
    pass


def build_index(pref_docs):
    """{県コード: 県ドキュメント} → [[name, prefCode, rowIndex], ...]

    県コード昇順、県内は元の並び順のまま。
    """
    rows = []
    for code in sorted(pref_docs):
        doc = pref_docs[code]
        ni = doc["fields"].index("name")
        for i, row in enumerate(doc["items"]):
            rows.append([row[ni], code, i])
    return rows


def load_pref_docs():
    if not PREF_DIR.is_dir():
        raise MissingPrefDataError(f"{PREF_DIR} がありません")
    files = sorted(PREF_DIR.glob("*.json"))
    if len(files) < MIN_PREF_FILES:
        raise MissingPrefDataError(
            f"{PREF_DIR} に県データが {len(files)} 件しかありません（{MIN_PREF_FILES}件必要）")
    docs = {}
    for f in files:
        docs[int(f.stem)] = json.loads(f.read_text(encoding="utf-8"))
    return docs


def main():
    try:
        docs = load_pref_docs()
    except MissingPrefDataError as e:
        print(f"{e}\n先に build_data.py を実行してください。", file=sys.stderr)
        sys.exit(1)

    updates = {d["updated"] for d in docs.values()}
    if len(updates) != 1:
        print(f"県ファイルの updated が揃っていません: {sorted(updates)}\n"
              f"build_data.py を実行し直してください。", file=sys.stderr)
        sys.exit(1)
    updated = updates.pop()

    rows = build_index(docs)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated": updated, "fields": FIELDS, "items": rows},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows):,}件 / {OUT.stat().st_size/1024:.0f}KB / updated={updated})")


if __name__ == "__main__":
    main()
