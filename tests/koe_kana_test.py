# -*- coding: utf-8 -*-
"""TTS送信テキスト整形の検証。 python tests/koe_kana_test.py で実行、exit 0 が合格。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import kana


def main():
    # --- ルビ畳み: 二重読み（「そらそら」）を出さない ---
    assert kana.fold_ruby("静音器(せいおんき)が満ちる") == "せいおんきが満ちる"
    assert kana.fold_ruby("静音器（せいおんき）が満ちる") == "せいおんきが満ちる"
    assert kana.fold_ruby("残響区(ざんきょうく)の空(そら)") == "ざんきょうくのそら"
    # ルビでない括弧は壊さない
    assert kana.fold_ruby("それは(たぶん)違う") == "それは(たぶん)違う"

    # --- 読み置換: 単独の誤読を直す ---
    t = {"空": "そら", "何": "なに"}
    assert kana.apply_readings("空を見た", t) == "そらを見た"
    assert kana.apply_readings("あたしは何！", t) == "あたしはなに！"

    # --- GUARD: 別読みの語を壊さない ---
    assert kana.apply_readings("空っぽの器", t) == "空っぽの器"
    assert kana.apply_readings("空気が薄い", t) == "空気が薄い"
    assert kana.apply_readings("空白の千年", t) == "空白の千年"
    assert kana.apply_readings("空腹だ", t) == "空腹だ"

    # --- to_tts: ルビ→置換の順で通る ---
    out = kana.to_tts("空(そら)と空っぽ", {"空": "そら"})
    assert out == "そらと空っぽ", out

    # --- 実テーブルが読める ---
    tbl = kana.load_table()
    assert isinstance(tbl, dict) and len(tbl) > 0, "readings.json が空"

    print("koe_kana_test: OK")


if __name__ == "__main__":
    main()
