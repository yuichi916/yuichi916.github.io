# -*- coding: utf-8 -*-
"""ボイス棚卸しの検証。"""
import sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import voice_audit as va


def touch(d, stem):
    (Path(d) / (stem + ".mp3")).write_bytes(b"\x00")


def main():
    # --- ハッシュがJSのkeyOfと一致すること（32bit符号付き） ---
    # JS: let h=0; for(c of "a") h=(h*31+c.charCodeAt(0))|0  => 97
    assert va.key_of("a") == "k97", va.key_of("a")
    # "ab" => 97*31+98 = 3105
    assert va.key_of("ab") == "k3105", va.key_of("ab")
    # 負にオーバーフローする長い文字列でも例外にならない
    assert va.key_of("あ" * 50).startswith("k")

    script = {"scenes": [{"beats": [
        {"say": "kanata", "text": "拾い屋だ"},
        {"say": "narr",   "text": "音が減っていた"},
        {"say": "ren",    "text": "（文字盤を指す）"},          # 無音。ボイス不要
        {"say": "ren",    "text": "おはよう", "v": 1},          # v:1 なのでボイス必要
        {"say": "toki",   "text": "昔な"},
    ]}]}

    exp = va.expected_files(script)
    assert "v" + va.key_of("kanata|拾い屋だ") in exp
    assert "v" + va.key_of("toki|昔な") in exp
    assert "v" + va.key_of("ren|おはよう") in exp
    assert "n" + va.key_of("音が減っていた") + "_k" in exp
    assert "n" + va.key_of("音が減っていた") + "_r" in exp
    # v:1 でない ren はボイスを期待しない
    assert "v" + va.key_of("ren|（文字盤を指す）") not in exp
    assert len(exp) == 5, sorted(exp)

    with tempfile.TemporaryDirectory() as td:
        # 全部揃っている → クリーン
        for s in exp:
            touch(td, s)
        r = va.audit(script, td)
        assert r["missing"] == [] and r["orphan"] == [] and r["unpaired"] == [], r

        # 1本消す → missing に出る
        (Path(td) / ("v" + va.key_of("toki|昔な") + ".mp3")).unlink()
        r = va.audit(script, td)
        assert r["missing"] == ["v" + va.key_of("toki|昔な")], r

        # 余計な1本 → orphan に出る
        touch(td, "vk999999")
        r = va.audit(script, td)
        assert "vk999999" in r["orphan"], r

    with tempfile.TemporaryDirectory() as td2:
        # 地の文の片側だけ欠ける → unpaired に出る（missing とは別に検出する）
        for s in exp:
            if not s.endswith("_r"):
                touch(td2, s)
        r = va.audit(script, td2)
        assert r["unpaired"] == ["n" + va.key_of("音が減っていた")], r

    print("koe_audit_test: OK")


if __name__ == "__main__":
    main()
