"""キャラの声を ElevenLabs で作る。台詞の正本は assets/tsunagu-naraberu/characters.js。
使い方: python gen_voice_el.py <id>=<voice_id> [<id>=<voice_id> ...] [--only key1,key2]
出力: assets/tsunagu-naraberu/voice/<id>_<key>.mp3
- モデル eleven_turbo_v2_5 + language_code ja（短い掛け声が英語読みにならない組み合わせ）
- 日本語は requests で送る（curl だと文字化けする）
- 生成後に「尺 ≒ a + b×字数」を頑健に当てはめ、外れた行を表示する（読み飛ばし・英語読みの検出）
"""
import json, os, pathlib, re, subprocess, sys
import requests

ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets" / "tsunagu-naraberu"
OUT = ASSET / "voice"
KEY = os.environ["ELEVENLABS_API_KEY"]
# 掛け声は感情を大きく、台詞（select/start/win/lose）は落ち着かせる
SHOUT = {"c1", "c2", "c3", "c4", "c5", "ouch", "danger"}
TAKES = 3  # 1本につき最大3テイク


def lines_from_js():
    js = "import('file:///' + process.argv[1].replace(/\\\\/g, '/')).then(m => console.log(JSON.stringify(m.CHARACTERS)))"
    out = subprocess.run(["node", "-e", js, str(ASSET / "characters.js")], capture_output=True, text=True, encoding="utf-8", check=True)
    return {c["id"]: c["lines"] for c in json.loads(out.stdout)}


# 読み間違えやすい語は、送る文だけ仮名にする（表示用の台詞は漢字のまま）
READ = {"完全解答": "かんぜんかいとう", "立て直す": "たてなおす", "すずの勝ち": "すずのかち", "にゃっ！？": "にゃっ！", "えいっ": "えいっ！"}


def speak(text):
    # 表示用の記号（〜♪…）は読みに要らないので落とす。「〜」は伸ばし棒にする
    t = text.replace("〜", "ー").replace("♪", "").replace("…", "、")
    for k, v in READ.items():
        t = t.replace(k, v)
    return t


def tts(voice_id, text, shout):
    body = {
        "text": speak(text), "model_id": "eleven_turbo_v2_5", "language_code": "ja",
        "voice_settings": {"stability": 0.42 if shout else 0.5, "similarity_boost": 0.85,
                           "style": 0.45 if shout else 0.3, "use_speaker_boost": True},
    }
    r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_96",
                      headers={"xi-api-key": KEY, "Content-Type": "application/json"}, json=body, timeout=120)
    r.raise_for_status()
    return r.content


def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
        args = [a for a in args if a != sys.argv[sys.argv.index("--only") + 1]]
    pairs = dict(a.split("=", 1) for a in args)
    lines = lines_from_js()
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    from faster_whisper import WhisperModel
    import difflib
    model = WhisperModel("small", device="cpu", compute_type="int8")
    norm = lambda t: re.sub(r"[、。！？!?…〜♪・ー\s,.]", "", "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in t))
    for cid, vid in pairs.items():
        for key, text in lines[cid].items():
            if only and key not in only:
                continue
            p = OUT / f"{cid}_{key}.mp3"
            best = None
            for take in range(TAKES):
                tmp = OUT / f"_take_{take}.mp3"
                tmp.write_bytes(tts(vid, text, key in SHOUT))
                segs, info = model.transcribe(str(tmp), language="ja", beam_size=5)
                heard = "".join(sg.text for sg in segs).strip()
                score = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
                if not best or score > best[0]:
                    best = (score, heard, tmp.read_bytes())
                if score >= 0.9:
                    break
            p.write_bytes(best[2])
            for t in OUT.glob("_take_*.mp3"):
                t.unlink()
            n = len(re.sub(r"[、。！？!?…〜♪・\s]", "", text))
            rows.append((cid, key, text, n, duration(p)))
            flag = "" if best[0] >= 0.6 else "  ⚠ 聞き取り不一致"
            print(cid, key, f"{rows[-1][4]:.2f}s 一致{best[0]:.2f}", text, "=>", best[1], flag, flush=True)
    # 尺の回帰（最小二乗→外れ値を除いて当て直す）
    if len(rows) >= 6:
        import statistics
        xs = [r[3] for r in rows]; ys = [r[4] for r in rows]
        keep = list(range(len(rows)))
        for _ in range(3):
            mx = statistics.mean(xs[i] for i in keep); my = statistics.mean(ys[i] for i in keep)
            b = sum((xs[i] - mx) * (ys[i] - my) for i in keep) / max(1e-9, sum((xs[i] - mx) ** 2 for i in keep))
            a = my - b * mx
            res = sorted(abs(ys[i] - (a + b * xs[i])) for i in keep)
            cut = res[int(len(res) * 0.9) - 1] if len(res) > 3 else 9
            keep = [i for i in range(len(rows)) if abs(ys[i] - (a + b * xs[i])) <= cut]
        print(f"\n尺 ≒ {a:.2f} + {b:.3f}×字数")
        for r in rows:
            d = r[4] - (a + b * r[3])
            if abs(d) > 1.2:
                print("⚠ 外れ:", r[0], r[1], r[2], f"{r[4]:.2f}s（予測より{d:+.2f}s）")


if __name__ == "__main__":
    main()
