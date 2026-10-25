"""まぜる漢字「役札」: 字ごとの画数・部首と、山札に入れる字の池を作る。

使い方:  python -I scripts/kanji/build_yaku.py [辞書の場所=C:/tmp/mazeru-gen/dict]

入力: data/kanji/words.json, data/kanji/kanji.json（build_dict.py の出力）, kanjidic2.xml.gz（© EDRDG, CC BY-SA 4.0）
出力: data/kanji/yaku.json
  s    … 字 → 画数（常用漢字すべて）
  r    … 字 → 康煕部首の番号（常用漢字すべて）
  pool … 店に並べる字。2字熟語をよく作る順（常用・質0〜1の2字熟語の数）。[[字, 2字熟語の数], ...]
  base … 最初の山札の候補（pool の上位から、部首がかたよらないように選んだ字）
"""
from __future__ import annotations

import collections
import gzip
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
DICT = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/mazeru-gen/dict")
OUT = ROOT / "data" / "kanji"

grade = json.loads((OUT / "kanji.json").read_text(encoding="utf-8"))
words = json.loads((OUT / "words.json").read_text(encoding="utf-8"))["common"]

strokes: dict[str, int] = {}
rad: dict[str, int] = {}
with gzip.open(DICT / "kanjidic2.xml.gz", "rb") as f:
    for _, el in ET.iterparse(f):
        if el.tag != "character":
            continue
        ch = el.findtext("literal")
        if ch in grade:
            sc = el.find("misc/stroke_count")
            rv = el.find("radical/rad_value[@rad_type='classical']")
            strokes[ch] = int(sc.text)
            rad[ch] = int(rv.text)
        el.clear()

missing = [c for c in grade if c not in strokes]
assert not missing, missing[:10]
# 既知の正解で確かめる
assert strokes["一"] == 1 and strokes["山"] == 3 and strokes["鬱"] == 29 and strokes["海"] == 9, (strokes["海"],)
assert rad["海"] == 85 and rad["林"] == 75 and rad["体"] == 9 and rad["語"] == 149 and rad["明"] == 72

deg = collections.Counter()
for w, _read, _g, q in words:
    if len(w) == 2 and q <= 1:
        for c in set(w):
            deg[c] += 1
pool = [[c, n] for c, n in sorted(deg.items(), key=lambda x: (-x[1], x[0])) if c in grade and n >= 8]

# 最初の山札の候補: 上位90字から、同じ部首は4字まで
base, per_rad = [], collections.Counter()
for c, _n in pool[:140]:
    if per_rad[rad[c]] >= 4:
        continue
    per_rad[rad[c]] += 1
    base.append(c)
    if len(base) >= 90:
        break
assert len(base) == 90 and "人" in base

out = {"v": 1, "s": strokes, "r": rad, "pool": pool, "base": "".join(base)}
(OUT / "yaku.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"strokes {len(strokes)}  pool {len(pool)}  base {''.join(base[:30])}…  size {(OUT / 'yaku.json').stat().st_size} bytes")
