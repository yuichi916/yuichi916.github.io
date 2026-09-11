# -*- coding: utf-8 -*-
"""行番号 → 引用の復元。書き写させない代わりに、指させて切り出す。"""
import sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))
import line_quotes as lq

PAGE = "見出し\n当店はカウンター8席です\nご予約は承っておりません\nあ\n"


def setup():
    d = Path(tempfile.mkdtemp())
    f = d / "p.txt"
    f.write_text(PAGE, encoding="utf-8")
    return {"https://a.jp": str(f)}


def res(**f):
    return [{"id": "n1", "name": "X", "status": "ok", "identity": "match",
             "facts": [dict(url="https://a.jp", **f)]}]


def test_line_number_becomes_the_exact_line():
    out, _ = lq.restore(res(k="counter_seats", v=8, line=2), setup())
    assert out[0]["facts"][0]["quote"] == "当店はカウンター8席です"
    assert "line" not in out[0]["facts"][0], "行番号は残さない（引用に置き換わる）"


def test_out_of_range_and_missing_line_are_dropped():
    idx = setup()
    assert lq.restore(res(k="hours", v="x", line=99), idx)[0] == []
    assert lq.restore(res(k="hours", v="x", line=0), idx)[0] == []
    assert lq.restore(res(k="hours", v="x"), idx)[0] == []
    assert lq.restore(res(k="hours", v="x", line="2"), idx)[0] == [], "文字列の行番号は受けない"


def test_unknown_url_is_dropped():
    out, dropped = lq.restore([{"id": "n1", "facts": [
        {"k": "hours", "v": "x", "line": 2, "url": "https://unknown.jp"}]}], setup())
    assert out == [] and sum(dropped.values()) == 1


def test_too_short_line_is_not_evidence():
    assert lq.restore(res(k="hours", v="x", line=4), setup())[0] == [], "「あ」は根拠にならない"


def test_long_line_is_truncated_with_a_mark():
    d = Path(tempfile.mkdtemp()); f = d / "p.txt"
    f.write_text("あ" * 200, encoding="utf-8")
    out, _ = lq.restore(res(k="hours", v="x", line=1), {"https://a.jp": str(f)})
    q = out[0]["facts"][0]["quote"]
    assert len(q) == 80 and q.endswith("…")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
