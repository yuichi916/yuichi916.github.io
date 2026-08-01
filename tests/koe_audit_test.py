# -*- coding: utf-8 -*-
"""ボイス棚卸しの検証。

fix round 1（レビュー指摘）で追加した回帰テスト:
  - 2段より深いネストが棚卸しから漏れないこと（Critical 1）
  - 台本の形が想定と違うとき expected_count で「0件チェック」を検知できること、
    かつCLIがそれをCLEANとして通さないこと（Critical 2）
  - 非BMP文字（サロゲートペア）でもJSのkeyOfと一致すること（Important 3）
  - 台本外の正規音声（title-koe/final-*/synth-*）がorphan誤検知にならないこと（追加分）

fix round 2（koe-ep1スタブのレビュー指摘, Important 2）で追加した回帰テスト:
  - is_mono() が koe.html:renderSay() の mono 判定と一致すること
  - kanata/toki の（心の声）行が expected_files() から除外されること
  - narr/ren は同じ見た目の括弧始まりでも mono 対象外のまま変わらないこと
    （mono はkanata/tokiだけの条件——ここが崩れるとnarr/renのボイスが
    無言で期待から漏れるという、別方向の偽陰性になる）

fix round 2 の再レビュー指摘（Important, 「ドリフトを検査するテストが
ドリフトを検査していない」）で追加した回帰テスト:
  - 上記の is_mono() ピン止めは Python の定数同士を比べているだけで、
    koe.html:renderSay() の mono 判定式が変わってもそれを検出できなかった
    （`/^[（(]/` を `/^[（(「]/` に変えても全ピン止めが通り続けた）。
  - _extract_mono_definition() が koe.html を実際に読み、正規表現で
    `const mono = ...;` から話者集合と文字クラスを抽出する。is_mono() を
    その場でその抽出結果と突き合わせるので、koe.html 側の定義が変われば
    Python側を1文字も触らなくてもテストが落ちる。
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import voice_audit as va


def touch(d, stem):
    (Path(d) / (stem + ".mp3")).write_bytes(b"\x00")


def _extract_mono_definition():
    """koe.html:renderSay() の `const mono = ...;` を実際に読み取り、
    (speakers: set[str], class_chars: tuple[str, ...]) を返す。

    is_mono() を直接ピン止めするだけのテストは「Pythonの定数同士を比べて
    いる」だけで、koe.html 側の定義が変わってもそれを検出できない
    （再レビュー指摘: `/^[（(]/` を `/^[（(「]/` に変えても全ピン止めが
    通り続けた）。この関数はハードコードされた値をPython側に持たず、
    実行のたびに koe.html を読みにいく——ここがドリフト検査の要。

    抽出が壊れる（行がリネーム/移動される、話者一覧や文字クラスの書式が
    変わる等）場合は、黙って空集合を返して検査をすり抜けさせるのではなく、
    ここで例外を投げて落ちる。「対象を見失っている」こと自体がこの検査が
    知りたい異常であり、抽出できないことを CLEAN 扱いにしてはならない
    （voice_audit.py の audit() が expected_count==0 を別扱いにしたのと
    同じ理由）。抽出がここまで脆く壊れた場合は、正規表現をこれ以上凝らす
    のではなく、koe.html 側に `window.__koeMonoDef = {...}` のような
    実行時にテストから読める形の宣言を足す方が次善策になる——今の1行
    正規表現の書式（`(b.say===...||...) && /^[...]/.test(...)`）が保たれて
    いる限りは、この抽出で足りる。
    """
    html = (ROOT / "koe.html").read_text(encoding="utf-8")
    m = re.search(r"const mono\s*=\s*(.+?);", html)
    if not m:
        raise AssertionError(
            "koe.html に `const mono = ...;` が見つからない。"
            "renderSay() の mono 判定行がリネーム/移動された可能性がある。"
            "このテストの _extract_mono_definition() を新しい形に合わせて"
            "更新すること（is_mono() とのドリフト検査が対象を見失っている）。"
        )
    expr = m.group(1)

    speaker_pairs = re.findall(r"b\.say===(['\"])([A-Za-z0-9_]+)\1", expr)
    if not speaker_pairs:
        raise AssertionError(
            "mono 判定式から話者一覧(b.say===...)を抽出できなかった: " + expr
        )
    speakers = {name for (_, name) in speaker_pairs}

    cm = re.search(r"/\^\[([^\]]*)\]/", expr)
    if not cm:
        raise AssertionError(
            "mono 判定式から文字クラス(/^[...]/ )を抽出できなかった: " + expr
        )
    class_body = cm.group(1)
    if "\\" in class_body:
        raise AssertionError(
            "mono 判定の文字クラスにエスケープシーケンスが含まれている"
            " (%r)。このテストの抽出ロジックは素の文字の列挙しか想定して"
            "いない。_extract_mono_definition() を更新してから続行すること"
            "（黙って誤った文字集合で通すよりは、ここで落ちる方が安全）。"
            % (class_body,)
        )
    class_chars = tuple(class_body)
    if not class_chars:
        raise AssertionError("mono 判定の文字クラスが空: " + expr)

    return speakers, class_chars


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

    # --- Important 2: is_mono() は koe.html:renderSay() の mono 判定と一致する ---
    # 以下はまず既知の値へのピン止め（速い・ファイルI/O無し）。
    # const mono = (b.say==='kanata'||b.say==='toki') && /^[（(]/.test(b.text.trim());
    assert va.is_mono("（心の声）") is True
    assert va.is_mono("(parenthesis)") is True
    assert va.is_mono("  （前後に空白があっても検出する）  ") is True  # .trim()相当
    assert va.is_mono("台詞。") is False
    assert va.is_mono("") is False
    # JSのtrim()はBOM(U+FEFF)を剥がすが、Pythonのstr.strip()は剥がさない
    # （fold-in指摘）。_js_trim()経由なのでここも一致するはず。
    assert va.is_mono("﻿（BOM付き）") is True

    # --- Important（再レビュー）: is_mono() を koe.html を実際に読んで検査する ---
    # 上のピン止めは Python の定数同士の比較でしかなく、koe.html 側の mono
    # 判定式が変わっても検出できない。ここが実際のドリフト検査本体。
    engine_speakers, engine_mono_chars = _extract_mono_definition()

    # 話者スコープの一致。VOICED(kanata,toki)とエンジンの
    # b.say==='kanata'||b.say==='toki' が食い違うと、mono対象の範囲がずれる。
    assert engine_speakers == set(va.VOICED), (engine_speakers, va.VOICED)

    # エンジンの文字クラスに実在する文字はすべて is_mono() が True と判定
    # しなければならない。koe.html側がこのクラスに文字を足しても
    # is_mono() 側を更新し忘れていれば、Pythonの定数を一切変えなくても
    # ここが落ちる——これが「ドリフトを検出する」ということ。
    for ch in engine_mono_chars:
        assert va.is_mono(ch + "テスト") is True, (ch, hex(ord(ch)))

    # 対照: エンジンのクラスに入っていない普通の文字は mono と判定しない
    # （抽出した文字集合と衝突しないことを先に確認してから使う）
    control_char = "あ"
    assert control_char not in engine_mono_chars, "対照文字がエンジンの文字クラスと衝突している"
    assert va.is_mono(control_char + "テスト") is False

    # kanata/toki の（心の声）行は expected_files() から除外される。
    # 除外し忘れると、その行のボイスファイルは実際には一度も要求されないのに
    # 「missing」に永久に載り続け、ゲートが恒久的にDIRTYになる
    # （ALLOWED_NON_SCRIPT_STEMS を足したのと同じ理由の逆側）。
    mono_script = {"scenes": [{"beats": [
        {"say": "kanata", "text": "（心の声）今日も拾いに行く"},   # mono → 期待しない
        {"say": "kanata", "text": "仮：地の声、鳴る方"},           # 括弧始まりでない → 期待する
        {"say": "toki",   "text": "(半角括弧も同じ扱い)"},        # mono → 期待しない
        {"say": "narr",   "text": "（narrは常に地の文。mono対象外）"},  # narrはmono判定の対象外
        {"say": "ren",    "text": "（renも常に対象外。v:1）", "v": 1},  # renはmono判定の対象外
    ]}]}
    mono_exp = va.expected_files(mono_script)
    assert "v" + va.key_of("kanata|（心の声）今日も拾いに行く") not in mono_exp, sorted(mono_exp)
    assert "v" + va.key_of("kanata|仮：地の声、鳴る方") in mono_exp, sorted(mono_exp)
    assert "v" + va.key_of("toki|(半角括弧も同じ扱い)") not in mono_exp, sorted(mono_exp)
    # narr/ren は mono の対象外なので、丸括弧で始まっていても普通に期待される
    n_k = "n" + va.key_of("（narrは常に地の文。mono対象外）")
    assert n_k + "_k" in mono_exp and n_k + "_r" in mono_exp, sorted(mono_exp)
    assert "v" + va.key_of("ren|（renも常に対象外。v:1）") in mono_exp, sorted(mono_exp)
    # 上の5行のうち mono で落ちる2行(kanata1・toki1)を除いた分だけが期待される
    assert len(mono_exp) == 4, sorted(mono_exp)  # kanata1本 + narr2本(_k/_r) + ren1本

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
