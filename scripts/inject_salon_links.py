#!/usr/bin/env python3
"""Inject 'read more' links into salon.html landing chapters.
Maps chapter num (01-14) -> sub-page slug.
"""
import re
import sys
sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace")
from pathlib import Path

SALON = Path(__file__).resolve().parent.parent / "salon.html"

SLUG_MAP = {
    "01": ("ambient", "Ambient — 夜と冬の儀式音楽"),
    "02": ("healing", "Healing & New Age — 静かさの混沌"),
    "03": ("progressive", "Progressive — 50年を貫く構築美"),
    "04": ("jazz", "Jazz & Fusion — ECM的沈黙"),
    "05": ("classic", "Classic — タッチと呼吸の系譜"),
    "06": ("metal", "Metal & Hard Rock — 物語性とメロディ"),
    "07": ("indies", "Indies — 過剰さの自由"),
    "08": ("jpop", "JPOP — 物語の歌い手"),
    "09": ("celt", "Celt & Fantasy & Violin — 夜の森と城"),
    "10": ("game", "Game — 物語のために書かれた音楽"),
    "11": ("anime", "Anime — 美しさと悲劇の同居"),
    "12": ("nature", "Nature — 人を消す音"),
    "13": ("blues-folk", "Blues & Folk — 物語の歌い手 (起点)"),
    "14": ("pop-rock", "Pop & Rock — 対外用ポケット"),
}

CSS_RULE = """
.chapter-link{
  display:inline-flex;align-items:center;gap:14px;
  margin-top:32px;padding:16px 28px;
  background:linear-gradient(180deg,rgba(122,42,58,.18),rgba(28,20,40,.4));
  border:1px solid rgba(212,160,80,.32);border-radius:4px;
  font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:16px;color:var(--amber);text-decoration:none;
  letter-spacing:.06em;transition:all .25s;
}
.chapter-link:hover{background:rgba(122,42,58,.32);border-color:rgba(240,200,120,.5);color:var(--amber-soft);transform:translateY(-2px)}
.chapter-link::after{content:"→";transition:transform .25s}
.chapter-link:hover::after{transform:translateX(4px)}
"""


def main():
    text = SALON.read_text(encoding="utf-8")

    # Inject CSS rule before the closing </style>
    if ".chapter-link{" not in text:
        text = text.replace("</style>", CSS_RULE + "\n</style>", 1)

    # For each chapter, replace `<div class="insight">...</div>\n    </article>`
    # with the same + chapter-link before </article>.
    # The chap-num is immediately before, so we can find each unique <div class="chap-num eng">NN</div>
    # and use that to determine which slug.

    # Strategy: find each chapter article block by chap-num, insert link before </article>.
    pattern = re.compile(
        r'(<article class="chapter">\s*<div class="chap-head">\s*<div>\s*<div class="chap-num eng">)(\d{2})(.*?)(</article>)',
        re.DOTALL,
    )

    def repl(m):
        before, num, mid, end = m.group(1), m.group(2), m.group(3), m.group(4)
        if num not in SLUG_MAP:
            return m.group(0)
        slug, label = SLUG_MAP[num]
        link = f'\n      <a class="chapter-link" href="salon/{slug}.html">{label}</a>\n    '
        # Don't double-inject
        if f'href="salon/{slug}.html"' in mid:
            return m.group(0)
        return f"{before}{num}{mid}{link}{end}"

    new_text = pattern.sub(repl, text)
    SALON.write_text(new_text, encoding="utf-8")

    # Count
    count = new_text.count('class="chapter-link"')
    print(f"  injected {count} chapter-link buttons")


if __name__ == "__main__":
    main()
