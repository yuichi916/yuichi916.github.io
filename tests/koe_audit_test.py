# -*- coding: utf-8 -*-
"""ボイス棚卸しの検証。

fix round 1（レビュー指摘）で追加した回帰テスト:
  - 2段より深いネストが棚卸しから漏れないこと（Critical 1）
  - 台本の形が想定と違うとき expected_count で「0件チェック」を検知できること、
    かつCLIがそれをCLEANとして通さないこと（Critical 2）
  - 非BMP文字（サロゲートペア）でもJSのkeyOfと一致すること（Important 3）
  - 台本外の正規音声（title-koe/final-*/synth-*）がorphan誤検知にならないこと（追加分）
"""
import json
import os
import subprocess
import sys
import tempfile
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
    # 長い文字列でオーバーフローしても例外にならず、かつnodeの実測値と一致する
    # （"startswith('k')" のような形だけの検査は何が来ても通ってしまうため、
    #   実際に node -e で計算した値をピン止めして区別力を持たせる）
    assert va.key_of("あ" * 50) == "k214437440", va.key_of("あ" * 50)
    # 非BMP文字（サロゲートペア）: エンジンは charCodeAt でUTF-16コード単位を
    # 走査するため、Pythonのコードポイント単位のord()と食い違う。
    # node -e "keyOf('𠮟')" => k1773469 で確認済み。
    assert va.key_of("𠮟") == "k1773469", va.key_of("𠮟")

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

    # --- Critical 1: 2段より深いネストも棚卸しから漏れない ---
    # scenes -> beats -> choose[].reply -> choose[].reply -> beat という
    # 4段ネスト。キー名を決め打ちで2段だけ辿る実装だとここは空を返す。
    deep = {"scenes": [{"beats": [
        {"choose": [{"reply": [
            {"choose": [{"reply": [
                {"say": "kanata", "text": "深い"}
            ]}]}
        ]}]}
    ]}]}
    deep_exp = va.expected_files(deep)
    assert "v" + va.key_of("kanata|深い") in deep_exp, sorted(deep_exp)

    # 循環参照があっても無限ループしない（id()ベースのvisitedガード）
    cyclic_beat = {"say": "kanata", "text": "循環"}
    cyclic_beat["reply"] = [cyclic_beat]
    cyclic = {"scenes": [{"beats": [cyclic_beat]}]}
    cyclic_exp = va.expected_files(cyclic)
    assert "v" + va.key_of("kanata|循環") in cyclic_exp

    with tempfile.TemporaryDirectory() as td:
        # 全部揃っている → クリーン
        for s in exp:
            touch(td, s)
        r = va.audit(script, td)
        assert r["missing"] == [] and r["orphan"] == [] and r["unpaired"] == [], r
        assert r["expected_count"] == 5, r

        # 1本消す → missing に出る
        (Path(td) / ("v" + va.key_of("toki|昔な") + ".mp3")).unlink()
        r = va.audit(script, td)
        assert r["missing"] == ["v" + va.key_of("toki|昔な")], r

        # 余計な1本 → orphan に出る
        touch(td, "vk999999")
        r = va.audit(script, td)
        assert "vk999999" in r["orphan"], r

        # --- 追加分: 台本外の正規音声はorphan誤検知にならない（design 8-5） ---
        # 完成声は4パターン（設計書 8-5「完成声 4パターン | 4」、finalKey()の
        # mem-01/07/13/19 -> a/b/c/d）。fix round 2: a/dの代表2つだけをピン止め
        # すると b/c の欠落に気付けない（実際、最初の実装は a/d の2つしか
        # 許可しておらず b/c が永久にorphan扱いになる欠陥があった）ため、
        # 4つ全部を個別に確認する。
        touch(td, "title-koe")
        touch(td, "final-a")
        touch(td, "final-b")
        touch(td, "final-c")
        touch(td, "final-d")
        touch(td, "synth-abc123-s00")
        r = va.audit(script, td)
        assert "title-koe" not in r["orphan"], r
        assert "final-a" not in r["orphan"], r
        assert "final-b" not in r["orphan"], r
        assert "final-c" not in r["orphan"], r
        assert "final-d" not in r["orphan"], r
        assert "synth-abc123-s00" not in r["orphan"], r
        # 本当に無関係なファイルはちゃんとorphanのまま（アローリストが
        # キャッチオールになっていないことの確認）
        assert "vk999999" in r["orphan"], r

    with tempfile.TemporaryDirectory() as td2:
        # 地の文の片側だけ欠ける → unpaired に出る（missing とは別に検出する）
        for s in exp:
            if not s.endswith("_r"):
                touch(td2, s)
        r = va.audit(script, td2)
        assert r["unpaired"] == ["n" + va.key_of("音が減っていた")], r

    # --- Critical 2: 台本の形が想定と違う → expected_count==0 で検知できる ---
    # "scenes"ではなく"chapters"というよくある誤字/仕様違いを想定。
    # 台詞は入っているのに _beats() は何も見つけられない。
    wrong_shape = {"chapters": [{"beats": [{"say": "kanata", "text": "x"}]}]}
    assert va.expected_files(wrong_shape) == set()
    with tempfile.TemporaryDirectory() as td3:
        r = va.audit(wrong_shape, td3)
        # missing/orphan/unpaired はどれも空になってしまう（≒見かけ上クリーン）。
        # だからこそ expected_count で「0件しか見ていない」ことを区別できないと
        # このケースが「合格」として素通りしてしまう。
        assert r["missing"] == [] and r["orphan"] == [] and r["unpaired"] == [], r
        assert r["expected_count"] == 0, r

        # CLI (__main__) はこれを CLEAN として通さず、非ゼロで止まる
        script_path = Path(td3) / "script.json"
        script_path.write_text(json.dumps(wrong_shape), encoding="utf-8")
        cli = str(ROOT / "scripts" / "koe" / "voice_audit.py")
        env = dict(os.environ, PYTHONUTF8="1")
        proc = subprocess.run(
            [sys.executable, cli, str(script_path), td3],
            capture_output=True, text=True, encoding="utf-8", env=env,
        )
        assert proc.returncode == 2, (proc.returncode, proc.stdout, proc.stderr)
        assert "ERROR" in proc.stdout, proc.stdout
        assert "CLEAN" not in proc.stdout, proc.stdout

    print("koe_audit_test: OK")


if __name__ == "__main__":
    main()
