# -*- coding: utf-8 -*-
"""ボイスの棚卸し。改稿のたびに回す。

台本を1文字直すとハッシュが変わり、その台詞は「エラーを出さずに無音になる」。
前作では改稿で足した心内描写161件が全部無音だった。機械的な棚卸しが唯一の防衛線。

本作固有の検査:
  - ren の台詞は v:1 のときだけボイスを期待する（既定は無音）
  - narr は _k / _r の対で存在しなければならない

このモジュールが唯一の防衛線であるがゆえに、誤ってCLEANと報告する（＝偽陰性）ことは
クラッシュより悪い。fix round 1（レビュー指摘）で以下を直した:
  - _beats(): キー名（reply/beats/choose等）を決め打ちで1段だけ辿っていたのを、
    あらゆる深さを再帰的に辿るように変更。決め打ちは、それより深いネストや
    将来増えるキーを無言で棚卸しから漏らす。
  - audit(): expected_files()が0件の台本形（キー名の取り違え等）を、
    見た目だけ missing=[] / orphan=[] のクリーンな結果にしない。
    expected_count/found_count を返し、__main__ 側で0件をエラー扱いにする。
  - key_of(): エンジンはUTF-16コード単位でハッシュするため、Pythonの
    コードポイント単位のord()だと非BMP文字だけ食い違う。
  - 台本外の正規音声（title-koe/final-*/synth-*、design 8-5）をorphanから除外。
"""
import json
import struct
from pathlib import Path

VOICED = ("kanata", "toki")

# 台本には現れないが voice/ に正規に置かれる非台詞音声（設計書 8-5）。
# expected_files() の対象外なので、除外しないと orphan がこの分だけ
# 恒久的に非0になり、ゲートが常にDIRTYで誰も見なくなる。
# 新カテゴリを足すときはここに明示的に追記する（キャッチオール禁止＝
# 「見覚えのないファイルは全部許す」にしてしまうと、本物の孤児を隠す）。
# 完成声は4パターン（設計書 8-5「完成声 4パターン | 4」、finalKey()の
# mem-01/07/13/19 -> a/b/c/d）。fix round 2: a/dの2つだけを列挙していたのは
# 誤り（final-b/final-cが将来ずっとorphan扱いになり、ゲートが恒久的にDIRTY
# になっていた）。
ALLOWED_NON_SCRIPT_STEMS = ("title-koe", "final-a", "final-b", "final-c", "final-d")
ALLOWED_NON_SCRIPT_PREFIXES = ("synth-",)  # synth_stages.py の合成度5段階ステージング出力


def key_of(text):
    """JSの keyOf と同じ32bit符号付きハッシュ。

    エンジン(seikai.html:1189)は `for(i=0;i<t.length;i++) t.charCodeAt(i)` で
    UTF-16コード単位を走査する。Pythonのstrはコードポイント単位のため、
    非BMP文字（サロゲートペア）を素朴に ord() すると1文字を2ユニットに
    数えず、その台詞だけハッシュがJS側と分岐する。
    text.encode('utf-16-le') で明示的にUTF-16コード単位の並びに変換してから
    2バイトずつ読むことで、エンジンと同じ単位で走査する。
    """
    h = 0
    for (u,) in struct.iter_unpack("<H", text.encode("utf-16-le")):
        h = (h * 31 + u) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return "k" + str(h)


def _walk(node, seen):
    """dict/listを再帰的に辿り、'say'キーを持つdict（＝1台詞ぶんのbeat）を
    見つかった深さに関係なくすべて yield する。

    reply/beats/choose のようなキー名を決め打ちで列挙しない。決め打ちは、
    将来キーが増えたときや、それらの中にさらにネストした構造が来たときに
    棚卸しから無言で漏れる。id()ベースのvisitedはdictの自己参照だけを防ぐ
    （dictを再訪したら打ち切る）。list自身の自己参照は追跡していないため、
    自己参照するlistが来た場合はRecursionErrorで止まる（JSON由来の値には
    通常どちらの循環も起きない）。ここで重要なのは「無言でCLEANと嘘をつく」
    のではなく「派手に落ちる」ことなので、dict/listどちらの循環も
    "fail loud" にはなっており、この非対称は許容している。
    """
    if isinstance(node, dict):
        if id(node) in seen:
            return
        seen.add(id(node))
        if "say" in node:
            yield node
        for v in node.values():
            yield from _walk(v, seen)
    elif isinstance(node, list):
        for item in node:
            yield from _walk(item, seen)


def _beats(script):
    yield from _walk(script.get("scenes", []), set())


def expected_files(script):
    """台本から期待するボイスファイルの stem 集合を返す。"""
    exp = set()
    for b in _beats(script):
        who, text = b.get("say"), b.get("text")
        if who is None or text is None:
            continue
        if who == "narr":
            k = key_of(text)
            exp.add("n" + k + "_k")
            exp.add("n" + k + "_r")
        elif who == "ren":
            if b.get("v"):
                exp.add("v" + key_of("ren|" + text))
        elif who in VOICED:
            exp.add("v" + key_of(who + "|" + text))
    return exp


def _is_allowed_non_script(stem):
    """台本外だが design 8-5 で正規に voice/ に置かれるファイルか。"""
    return stem in ALLOWED_NON_SCRIPT_STEMS or stem.startswith(ALLOWED_NON_SCRIPT_PREFIXES)


def audit(script, voice_dir):
    """欠落・孤児・地の文の片側欠けを返す。

    expected_count（台本から期待した本数）と found_count（voice_dir にある
    .mp3の本数）も返す。expected_count が 0 の台本形は「全部揃っている」の
    見せかけになるが実際は「棚卸しが台本を読めていない」ので、呼び出し側
    （下の__main__）で別扱いにできるよう数を出す。
    """
    exp = expected_files(script)
    have = {p.stem for p in Path(voice_dir).glob("*.mp3")}
    missing = sorted(exp - have)
    orphan = sorted(s for s in (have - exp) if not _is_allowed_non_script(s))
    unpaired = sorted({s[:-2] for s in have
                       if s.startswith("n") and s.endswith(("_k", "_r"))
                       and (s[:-2] + ("_r" if s.endswith("_k") else "_k")) not in have})
    return {
        "missing": missing, "orphan": orphan, "unpaired": unpaired,
        "expected_count": len(exp), "found_count": len(have),
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("usage: python voice_audit.py <script.json> <voice_dir>")
        raise SystemExit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        sc = json.load(f)
    r = audit(sc, sys.argv[2])
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print("expected: %d  found(.mp3): %d" % (r["expected_count"], r["found_count"]))
    if r["expected_count"] == 0:
        # 0件は「クリーン」ではなく「台本の形（scenes/beatsキー等）を
        # 読み違えている」合図。ここをCLEANとして通すと棚卸し自体が
        # 無意味になるため、DIRTYより強く止める。
        print("AUDIT: ERROR — expected_files() が0件。台本の形が想定と違う可能性が高い。"
              "0件を「クリーン」として通さない。")
        raise SystemExit(2)
    ok = not (r["missing"] or r["orphan"] or r["unpaired"])
    print("AUDIT:", "CLEAN" if ok else "DIRTY")
    raise SystemExit(0 if ok else 1)
