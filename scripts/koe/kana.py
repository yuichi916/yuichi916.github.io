# -*- coding: utf-8 -*-
"""TTSへ送る文字列だけを整形する。ファイル名のハッシュは台詞原文から取るので参照は壊れない。

- fold_ruby: 「静音器(せいおんき)」を読み仮名だけに畳む。括弧を落とすだけだと
  「せいおんきせいおんき」と鳴るため、漢字側ごと置き換える。
- apply_readings: 単独漢字の誤読を直す。ただし「空っぽ」「空気」のような
  別読みの語を先に退避しないと「そらっぽ」「そらき」になる。
"""
import json
import re
from pathlib import Path

# 漢字＋（読み仮名）だけをルビとみなす。ひらがな始まりの括弧は本文なので触らない
RUBY = re.compile(r"[一-鿿々ヶ]+[（(]([ぁ-ゟァ-ヶー]+)[）)]")

# 退避する別読み語。置換対象の漢字を含むが、読みが違うもの
GUARD_WORDS = [
    "空っぽ", "空白", "空気", "空腹", "空間", "空か", "空き",
    "何か", "何も", "何で", "何と", "何が", "何を", "何の", "何な",
    "器用",
]

_DEFAULT_TABLE_PATH = Path(__file__).with_name("readings.json")


def fold_ruby(text):
    """漢字(かな) を かな だけに畳む。"""
    return RUBY.sub(lambda m: m.group(1), text)


def apply_readings(text, table):
    """GUARDで別読み語を退避してから、単独漢字を読み仮名に置換する。"""
    if not table:
        return text
    # 長い語から退避する（「空っぽ」が「空」より先）
    guards = sorted(GUARD_WORDS, key=len, reverse=True)
    holders = {}
    for i, w in enumerate(guards):
        if w in text:
            h = "\x01%d\x02" % i
            holders[h] = w
            text = text.replace(w, h)
    for src in sorted(table.keys(), key=len, reverse=True):
        text = text.replace(src, table[src])
    for h, w in holders.items():
        text = text.replace(h, w)
    return text


def load_table(path=None):
    p = Path(path) if path else _DEFAULT_TABLE_PATH
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def to_tts(text, table=None):
    """TTSへ送る最終形。"""
    if table is None:
        table = load_table()
    return apply_readings(fold_ruby(text), table)


if __name__ == "__main__":
    import sys
    print(to_tts(sys.argv[1] if len(sys.argv) > 1 else "静音器(せいおんき)の空(そら)"))
