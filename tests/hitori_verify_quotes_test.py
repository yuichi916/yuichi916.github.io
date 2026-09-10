# -*- coding: utf-8 -*-
"""引用の実在照合。確かめられないことを、駄目だったことにしない。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import verify_quotes as vq

PAGES = {"https://a.jp": "当店はカウンター8席。ご予約は承っておりません。"}


def cur(**facts):
    return {"n1": {"checked": "2026-09-10", "facts": list(facts.values())}}


def test_matching_quote_passes():
    c = cur(a={"k": "reservation", "v": "none", "quote": "ご予約は承っておりません",
               "urls": ["https://a.jp"], "src": ["a.jp"]})
    checked, bad = vq.check(c, PAGES)
    assert checked == 1 and bad == []


def test_fabricated_quote_is_caught():
    c = cur(a={"k": "solo_ok", "v": "歓迎", "quote": "おひとり様大歓迎です",
               "urls": ["https://a.jp"], "src": ["a.jp"]})
    checked, bad = vq.check(c, PAGES)
    assert checked == 1 and len(bad) == 1


def test_pages_we_do_not_have_are_left_alone():
    """本文を持っていない URL の事実は、照合の対象にしない。"""
    c = cur(a={"k": "hours", "v": "10-18", "quote": "何であれ",
               "urls": ["https://unknown.jp"], "src": ["unknown.jp"]})
    checked, bad = vq.check(c, PAGES)
    assert checked == 0 and bad == []


def test_truncated_and_whitespace_variants_pass():
    c = cur(a={"k": "seats", "v": 8, "quote": "当店はカウンター8席…",
               "urls": ["https://a.jp"], "src": ["a.jp"]})
    assert vq.check(c, PAGES)[1] == []
    c2 = cur(a={"k": "seats", "v": 8, "quote": "当店は カウンター 8席",
                "urls": ["https://a.jp"], "src": ["a.jp"]})
    assert vq.check(c2, PAGES)[1] == []


def test_facts_without_quotes_are_not_judged():
    """引用を持たない事実（古い取り込み分）を、照合失敗にしない。"""
    c = cur(a={"k": "price", "v": 600, "urls": ["https://a.jp"], "src": ["a.jp"]})
    checked, bad = vq.check(c, PAGES)
    assert checked == 0 and bad == []


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
