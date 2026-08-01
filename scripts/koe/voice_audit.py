# -*- coding: utf-8 -*-
"""ボイスの棚卸し。改稿のたびに回す。

台本を1文字直すとハッシュが変わり、その台詞は「エラーを出さずに無音になる」。
前作では改稿で足した心内描写161件が全部無音だった。機械的な棚卸しが唯一の防衛線。

本作固有の検査:
  - ren の台詞は v:1 のときだけボイスを期待する（既定は無音）
  - narr は _k / _r の対で存在しなければならない
"""
import json
from pathlib import Path

VOICED = ("kanata", "toki")


def key_of(text):
    """JSの keyOf と同じ32bit符号付きハッシュ。"""
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return "k" + str(h)


def _beats(script):
    for sc in script.get("scenes", []):
        for b in sc.get("beats", []):
            yield b
            for key in ("reply", "beats"):
                for nb in (b.get(key) or []):
                    yield nb
            for ch in (b.get("choose") or []):
                for nb in (ch.get("reply") or []):
                    yield nb


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


def audit(script, voice_dir):
    """欠落・孤児・地の文の片側欠けを返す。"""
    exp = expected_files(script)
    have = {p.stem for p in Path(voice_dir).glob("*.mp3")}
    missing = sorted(exp - have)
    orphan = sorted(have - exp)
    unpaired = sorted({s[:-2] for s in have
                       if s.startswith("n") and s.endswith(("_k", "_r"))
                       and (s[:-2] + ("_r" if s.endswith("_k") else "_k")) not in have})
    return {"missing": missing, "orphan": orphan, "unpaired": unpaired}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("usage: python voice_audit.py <script.json> <voice_dir>")
        raise SystemExit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        sc = json.load(f)
    r = audit(sc, sys.argv[2])
    print(json.dumps(r, ensure_ascii=False, indent=1))
    ok = not (r["missing"] or r["orphan"] or r["unpaired"])
    print("AUDIT:", "CLEAN" if ok else "DIRTY")
    raise SystemExit(0 if ok else 1)
