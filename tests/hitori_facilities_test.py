# -*- coding: utf-8 -*-
"""全国の施設名インデックス。「探すためだけ」の軽量ファイル。

施設IDではなく県ファイル内の行番号を持つ（実測 gzip 534KB → 378KB）。
選択後にその県のファイルを読めば実体は取れるため、索引に実体は要らない。
"""
import sys, json, gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import facilities

OUT = ROOT / "data" / "hitori" / "facilities.json"
PREF = ROOT / "data" / "hitori" / "pref"
MAX_GZIP = 460 * 1024   # 実測378KBに将来の増加ぶんの余裕


def test_build_index_shape():
    docs = {
        13: {"fields": ["id", "name"], "items": [["n1", "あ"], ["n2", "い"]]},
        14: {"fields": ["id", "name"], "items": [["n3", "う"]]},
    }
    rows = facilities.build_index(docs)
    assert rows == [["あ", 13, 0], ["い", 13, 1], ["う", 14, 0]], rows


def test_build_index_is_sorted_by_pref():
    docs = {
        14: {"fields": ["name"], "items": [["う"]]},
        13: {"fields": ["name"], "items": [["あ"]]},
    }
    rows = facilities.build_index(docs)
    assert [r[1] for r in rows] == [13, 14], rows


def main():
    test_build_index_shape()
    test_build_index_is_sorted_by_pref()

    assert OUT.exists(), f"not found: {OUT} — facilities.py を実行してください"
    raw = OUT.read_bytes()
    gz = len(gzip.compress(raw, 9))
    assert gz <= MAX_GZIP, f"gzip {gz/1024:.0f}KB が上限 {MAX_GZIP/1024:.0f}KB 超過"

    doc = json.loads(raw.decode("utf-8"))
    assert doc["fields"] == ["name", "pref", "i"], doc["fields"]
    assert doc.get("updated"), "updated がない"

    # 添字が県ファイルの実体を指していること。ずれると別の施設を開く。
    by_pref = {}
    for name, pref, i in doc["items"]:
        by_pref.setdefault(pref, []).append((name, i))
    total = 0
    for pref, entries in by_pref.items():
        d = json.loads((PREF / f"{pref:02d}.json").read_text(encoding="utf-8"))
        assert d["updated"] == doc["updated"], \
            f"pref{pref:02d} の updated がインデックスと不一致: {d['updated']} vs {doc['updated']}"
        ni = d["fields"].index("name")
        for name, i in entries:
            assert 0 <= i < len(d["items"]), f"添字が範囲外: pref{pref} i={i}"
            assert d["items"][i][ni] == name, \
                f"添字が別の施設を指している: pref{pref} i={i} 索引={name} 実体={d['items'][i][ni]}"
        total += len(entries)

    assert total == len(doc["items"])
    assert total > 35000, f"件数が少なすぎる: {total}"
    assert sorted(by_pref) == list(range(1, 48)), "47県そろっていない"

    print(f"OK: facilities（{total:,}件 / 生 {len(raw)/1024:.0f}KB gzip {gz/1024:.0f}KB）")


if __name__ == "__main__":
    main()
