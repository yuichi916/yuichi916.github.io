# -*- coding: utf-8 -*-
"""台本から本番ボイスを生成する。ElevenLabs。

  python voice_gen.py <script.json> <out_dir> [--who ren|kanata|toki|narr_k|narr_r|title]

設計（設計書 8-5）:
  - 話者は3人。地の文だけ「カナタ声版(_k)」と「セイレン声版(_r)」の2本立て
  - ファイル名は台詞原文のハッシュ。TTSへ送る文字列だけ kana.to_tts で整形する
    （整形はファイル名に影響しない＝参照が壊れない）
  - 演技タグは v3 の短いものを1つまで。カンマ区切りの説明列は読み上げられる

既にあるファイルは飛ばす。改稿で増えた分だけを足せるようにするため。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import kana                      # noqa: E402
import voice_audit as va         # noqa: E402

KEY = os.environ.get("ELEVENLABS_API_KEY")
MODEL = "eleven_v3"
LANG = "ja"

# 設計書 8-5 のキャスティング表。未定は None
VOICES = {
    "ren":    "HxuFAkkGVeQs1sDIMF5g",
    "kanata": None,
    "toki":   None,
}
# タイトル画面で一度だけ鳴る一言。最終シーンと同一ファイル
TITLE_TEXT = "——おはよう"


def tts(text, voice, table):
    body = {
        "text": kana.to_tts(text, table),
        "model_id": MODEL,
        "language_code": LANG,
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json",
                 "Accept": "audio/mpeg"},
        method="POST")
    return urllib.request.urlopen(req, timeout=300).read()


def jobs_for(script, want):
    """(出力ファイル名, 台詞, 話者voice) の一覧。設計の命名規則に厳密に従う。"""
    out = []
    for b in va._beats(script):
        who, text = b.get("say"), b.get("text")
        if who is None or text is None:
            continue
        if who == "narr":
            if want in (None, "narr_k"):
                out.append((f"n{va.key_of(text)}_k.mp3", text, "kanata"))
            if want in (None, "narr_r"):
                out.append((f"n{va.key_of(text)}_r.mp3", text, "ren"))
        elif who == "ren":
            if b.get("v") and want in (None, "ren"):
                out.append((f"v{va.key_of('ren|' + text)}.mp3", text, "ren"))
        elif who in ("kanata", "toki"):
            if va.is_mono(text):          # 「（…」始まりはエンジンが鳴らさない
                continue
            if want in (None, who):
                out.append((f"v{va.key_of(who + '|' + text)}.mp3", text, who))
    if want in (None, "title"):
        out.append(("title-koe.mp3", TITLE_TEXT, "ren"))
    # 同一テキストは同一ファイル。重複を潰す
    seen, uniq = set(), []
    for f, t, w in out:
        if f not in seen:
            seen.add(f); uniq.append((f, t, w))
    return uniq


def main():
    if not KEY:
        raise SystemExit("ELEVENLABS_API_KEY が無い")
    script = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    outdir = Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    want = None
    if "--who" in sys.argv:
        want = sys.argv[sys.argv.index("--who") + 1]

    table = kana.load_table()
    jobs = jobs_for(script, want)
    todo = [j for j in jobs if not (outdir / j[0]).exists()]
    skipped = len(jobs) - len(todo)

    blocked = sorted({w for _, _, w in todo if not VOICES.get(w)})
    todo = [j for j in todo if VOICES.get(j[2])]
    print(f"  対象 {len(jobs)} / 既存 {skipped} / 生成 {len(todo)}"
          + (f" / 話者未定でスキップ {blocked}" if blocked else ""))

    ok = fail = 0
    for i, (fname, text, who) in enumerate(todo, 1):
        try:
            audio = tts(text, VOICES[who], table)
            (outdir / fname).write_bytes(audio)
            ok += 1
            if i % 10 == 0 or i == len(todo):
                print(f"    [{i:4}/{len(todo)}] {fname}  {len(audio)//1024}KB")
        except urllib.error.HTTPError as e:
            fail += 1
            print(f"    !! {fname} {e.code} {e.read().decode('utf-8','replace')[:160]}")
            if e.code in (401, 402, 429):
                print("    中断（認証・課金・レート）"); break
            time.sleep(2)
        except Exception as e:
            fail += 1
            print(f"    !! {fname} {e}")
            time.sleep(2)
    print(f"  生成 {ok} / 失敗 {fail}")
    raise SystemExit(1 if fail else 0)


if __name__ == "__main__":
    main()
