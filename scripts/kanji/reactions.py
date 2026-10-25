"""まぜる漢字（役札・きょうの7字・プリント）の反応を、GoatCounter の公開カウンタから1枚にまとめる。

使い方:  python -I scripts/kanji/reactions.py [--log 保存先.csv]
  公開カウンタ https://viewsengineer.goatcounter.com/counter/<path>.json を読むだけ（トークン不要・サーバなし）。
  値は訪問者単位（同じ人が何度押しても1）。まだ誰も来ていないパスは HTTP 404 と {"count":"0"} が返る。
  ひとこと（作者だけが読む）は Google フォームの回答シートに入る。ここでは数えない。
"""
from __future__ import annotations

import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://viewsengineer.goatcounter.com/counter/"

# [見出し, [(表示名, パス), ...]]。パスは mazeru.html / yaku-ui.js / feel-core.js が送っているもの
GROUPS = [
    ("ページの訪問", [("まぜる漢字", "/mazeru.html"), ("プリントの着地ページ", "/kanji-print.html")]),
    ("役札", [("きょうの一局を始めた", "mazeru-kanji/yaku/start/daily"), ("自由に一局を始めた", "mazeru-kanji/yaku/start/free")]
     + [(f"局{n}で散った", f"mazeru-kanji/yaku/end/r{n}") for n in range(1, 9)]
     + [("8局すべて勝った", "mazeru-kanji/yaku/end/win")]
     + [(f"{n}字の熟語を出した", f"mazeru-kanji/yaku/word/{n}") for n in (2, 3, 4)]),
    ("プリント", [("和同開珎を印刷", "mazeru-kanji/print/a"), ("7字でつくるを印刷", "mazeru-kanji/print/b")]),
    ("気持ちスタンプ", [
        ("役札 🎉楽しかった", "feel/mazeru-yaku/tanoshii"), ("役札 🧠手ごわかった", "feel/mazeru-yaku/tegowai"), ("役札 🔁またやる", "feel/mazeru-yaku/mata"),
        ("7字 🎉楽しかった", "feel/mazeru/tanoshii"), ("7字 🧠手ごわかった", "feel/mazeru/tegowai"), ("7字 🔁またやる", "feel/mazeru/mata"),
        ("プリント 🖨印刷して使った", "feel/kanji-print/tsukatta"), ("プリント 💡役に立った", "feel/kanji-print/yakudatta"),
        ("プリント 📝ほかの形式もほしい", "feel/kanji-print/hoshii"),
    ]),
]


def parse_count(s) -> int:
    """GoatCounter の数（"2 035" のように空白で桁を区切る）を整数にする。"""
    return int(str(s).replace(" ", "").replace(",", "").replace(" ", "") or 0)


def fetch(path: str) -> int:
    url = BASE + urllib.parse.quote(path, safe="") + ".json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        if e.code != 404:     # 404 は「まだ0」
            raise
        body = e.read()
    return parse_count(json.loads(body).get("count", 0))


# 既知の正解で検算（自作の集計は必ず確かめる）
assert parse_count("2 035") == 2035 and parse_count("0") == 0 and parse_count("12") == 12 and parse_count("1 234") == 1234


def main():
    log = sys.argv[sys.argv.index("--log") + 1] if "--log" in sys.argv else None
    now = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M")
    rows = []
    print(f"まぜる漢字の反応（{now} JST、訪問者単位）")
    for title, items in GROUPS:
        print(f"\n■ {title}")
        for label, path in items:
            n = fetch(path)
            rows.append((now, path, n))
            print(f"  {label:<22} {n:>6}")
    # 既知の正解: 一筆花火のスタンプは公開以来押されている（0 なら読み方が壊れている）
    assert fetch("feel/hitofude/tanoshii") > 0, "公開カウンタが読めていない"
    if log:
        new = False
        try:
            open(log, encoding="utf-8").close()
        except FileNotFoundError:
            new = True
        with open(log, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            if new:
                w.writerow(["at", "path", "count"])
            w.writerows(rows)
        print(f"\n保存: {log}")


if __name__ == "__main__":
    main()
