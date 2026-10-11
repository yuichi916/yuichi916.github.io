"""キャラの声を ElevenLabs で作る。台詞の正本は assets/tsunagu-naraberu/characters.js。
使い方: python gen_voice_el.py <id>=<voice_id> [<id>=<voice_id> ...] [--only key1,key2] [--takes 4] [--minmatch 0.7]
出力: assets/tsunagu-naraberu/voice/<id>_<key>.mp3
- モデル eleven_v3 + language_code ja（日本語固定）、安定度 0.0（いちばん表現が大きい）。
  感情の指示（[excited] など）をキャラの性格と台詞ごとに付ける
  （以前の turbo_v2_5 は安定させると棒読みになった。ひなた c5 の声の高さの幅 3.8半音 → v3 で 20半音超）
- 語の終わりの小さい「っ」は送らない（v3 が「つ」と読むことがある）。掛け声は仮名で言い切る形にする
- 1本につき数テイク作り、書き起こし（faster-whisper）が台詞と合い、
  送っていない「つ」や英字（指示タグの読み上げ）が出ていないものの中から、抑揚の大きいものを選ぶ
- 日本語は requests で送る（curl だと文字化けする）
"""
import json, os, pathlib, re, subprocess, sys, difflib
import requests

ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets" / "tsunagu-naraberu"
OUT = ASSET / "voice"
KEY = os.environ["ELEVENLABS_API_KEY"]
SHOUT = {"c1", "c2", "c3", "c4", "c5", "ouch", "danger"}

# 演技の指示。キャラの性格（スタイルブック）× 台詞の種類。連鎖は段が上がるほど大きく
DIRECTION = {
    # 元気・負けず嫌い: いつも全力、連鎖は叫ぶ
    "hinata": {"select": "[excited] [energetic]", "start": "[determined] [excited]", "c1": "[energetic]", "c2": "[excited] [energetic]",
               "c3": "[excited] [shouting]", "c4": "[shouting] [fired up]", "c5": "[shouting] [triumphant]",
               "ouch": "[startled] [yelps]", "danger": "[panicked]", "win": "[laughs] [overjoyed]", "lose": "[frustrated] [pouting]"},
    # おっとり・天然: ふんわり甘い、大技だけ精いっぱい
    "momo": {"select": "[sweetly] [cheerful]", "start": "[relaxed] [sweetly]", "c1": "[playfully] [sweetly]", "c2": "[dreamy] [cheerful]",
             "c3": "[cheerful] [excited]", "c4": "[excited] [cheerful]", "c5": "[excited] [shouting]",
             "ouch": "[startled] [squeaks]", "danger": "[flustered]", "win": "[giggles] [delighted]", "lose": "[sad] [whimpering]"},
    # クール・秀才: 低めに静か、決めの一言は力強く
    "rin": {"select": "[calm] [confident]", "start": "[calm] [focused]", "c1": "[cool] [quietly]", "c2": "[confident]",
            "c3": "[confident] [satisfied]", "c4": "[intense] [determined]", "c5": "[shouting] [triumphant]",
            "ouch": "[pained] [grunts]", "danger": "[tense]", "win": "[smug] [calm]", "lose": "[bitter] [sighs]"},
    # いたずら好き: にやにや、笑いまじり
    "suzu": {"select": "[mischievously] [playful]", "start": "[mischievously] [excited]", "c1": "[mischievously] [chuckles]",
             "c2": "[playful] [teasing]", "c3": "[excited] [playful]", "c4": "[shouting] [gleeful]", "c5": "[shouting] [maniacal laugh]",
             "ouch": "[startled] [yelps]", "danger": "[nervous] [whiny]", "win": "[laughs] [smug]", "lose": "[whiny] [pouting]"},
}

# 読み間違えやすい語は、送る文だけ仮名にする（表示用の台詞は漢字のまま）
READ = {"くっ…！": "くぅ…！", "きゃっ…！": "きゃあ…！", "にひっ": "にひひ", "うわわっ！": "うわわ！", "にゃあっ！": "にゃあ！",
        "立て直す": "たてなおす", "すずの勝ち": "すずのかち", "解析完了": "かいせきかんりょう", "最適解": "さいてきかい",
        "証明、終了": "しょうめい、しゅうりょう", "びっくり箱": "びっくりばこ", "大・爆・発": "だい、ばく、はつ",
        "計算ミス": "けいさんミス", "計算どおり": "けいさんどおり", "当然の結果": "とうぜんのけっか", "負けない": "まけない"}


def lines_from_js():
    js = "import('file:///' + process.argv[1].replace(/\\\\/g, '/')).then(m => console.log(JSON.stringify(m.CHARACTERS)))"
    out = subprocess.run(["node", "-e", js, str(ASSET / "characters.js")], capture_output=True, text=True, encoding="utf-8", check=True)
    return {c["id"]: c["lines"] for c in json.loads(out.stdout)}


def speak(text):
    # 掛け声の言い換え → 語の終わりの小さい「っ」を落とす → 表示用の記号（〜♪…）を読み用に
    t = text
    for k, v in READ.items():
        t = t.replace(k, v)
    t = re.sub(r"[っッ]+(?=[！!？?、。ー〜…♪\s]|$)", "", t)
    t = t.replace("〜", "ー").replace("♪", "").replace("…", "、")
    # 句読点が重なったところを整える（「、！」→「！」、「。、」→「。」、頭の「、」）
    t = re.sub(r"、+(?=[！!？?。])", "", t).replace("。、", "。")
    return re.sub(r"^、+", "", t)


def bad_reading(sent, heard):
    """送っていない「つ」が聞こえた（小さい「っ」を読んだ）／英字が出た（指示タグを読み上げた）"""
    if re.search(r"[A-Za-z]", heard):
        return "英字"
    if not re.search(r"[つツ]", sent) and re.search(r"[つツ]", heard):
        return "「つ」"
    return ""


def tts(voice_id, text, direction, shout):
    body = {
        "text": f"{direction} {speak(text)}", "model_id": "eleven_v3", "language_code": "ja",
        # v3 の安定度は 0.0（表現豊か）/ 0.5 / 1.0 のいずれか。感情を出すため全部 0.0
        "voice_settings": {"stability": 0.0, "similarity_boost": 0.8},
    }
    r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_96",
                      headers={"xi-api-key": KEY, "Content-Type": "application/json"}, json=body, timeout=180)
    r.raise_for_status()
    return r.content


def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


def prosody(path):
    """抑揚の目安: 声の高さの幅（半音、10〜90%）と、高さの動き（半音/秒）"""
    import numpy as np, librosa
    y, sr = librosa.load(str(path), sr=22050)
    f0, vflag, _ = librosa.pyin(y, fmin=120, fmax=900, sr=sr, frame_length=1024)
    f = f0[vflag & ~np.isnan(f0)]
    if len(f) < 5:
        return 0.0, 0.0
    st = 12 * np.log2(f / np.median(f))
    return float(np.percentile(st, 90) - np.percentile(st, 10)), float(np.mean(np.abs(np.diff(st))) / (256 / sr))


def main():
    argv = sys.argv[1:]
    only, takes, minmatch = None, 4, 0.7
    if "--only" in argv:
        i = argv.index("--only"); only = set(argv[i + 1].split(",")); del argv[i:i + 2]
    if "--takes" in argv:
        i = argv.index("--takes"); takes = int(argv[i + 1]); del argv[i:i + 2]
    if "--minmatch" in argv:
        i = argv.index("--minmatch"); minmatch = float(argv[i + 1]); del argv[i:i + 2]
    pairs = dict(a.split("=", 1) for a in argv)
    lines = lines_from_js()
    OUT.mkdir(parents=True, exist_ok=True)
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    norm = lambda t: re.sub(r"[、。！？!?…〜♪・ー\s,.\-]", "", "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in t))
    rp = ROOT / "_dev" / "tsunagu-naraberu" / "voice_report.txt"
    report = {}
    if rp.exists():
        for ln in rp.read_text(encoding="utf-8").splitlines():
            report[" ".join(ln.split(" ")[:2])] = ln
    for cid, vid in pairs.items():
        for key, text in lines[cid].items():
            if only and key not in only:
                continue
            p = OUT / f"{cid}_{key}.mp3"
            cands = []
            for take in range(takes):
                tmp = OUT / f"_take_{take}.mp3"
                tmp.write_bytes(tts(vid, text, DIRECTION[cid][key], key in SHOUT))
                segs, _ = model.transcribe(str(tmp), language="ja", beam_size=5)
                heard = "".join(sg.text for sg in segs).strip()
                # 書き起こしは漢字でも仮名でも出るので、送った読み（仮名）と表示の台詞の両方と比べて高い方
                match = max(difflib.SequenceMatcher(None, norm(t), norm(heard)).ratio() for t in (text, speak(text)))
                rng, move = prosody(tmp)
                dur = duration(tmp)
                bad = bad_reading(speak(text), heard)
                if bad:
                    match = min(match, 0.5)  # 読み方の誤りは候補から外す（全部だめなら一番近いものを残して印を付ける）
                cands.append({"match": match, "heard": heard, "range": rng, "move": move, "dur": dur, "bad": bad, "data": tmp.read_bytes()})
            # 台詞として聞き取れる（一致0.7以上）うちで、抑揚（高さの幅は14半音で頭打ち）の大きいもの。長すぎる尺は減点
            limit = 1.0 + 0.16 * len(text)
            def score(c):
                return min(c["range"], 14) + c["move"] / 10 - max(0, c["dur"] - limit) * 4
            ok = [c for c in cands if c["match"] >= minmatch] or sorted(cands, key=lambda c: -c["match"])[:1]
            best = max(ok, key=score)
            p.write_bytes(best["data"])
            for t in OUT.glob("_take_*.mp3"):
                t.unlink()
            flag = (f"  ⚠ {best['bad']}を読んだ" if best["bad"] else "") + ("" if best["match"] >= 0.7 else "  ⚠ 聞き取り不一致")
            line = f"{cid} {key} {best['dur']:.2f}s 一致{best['match']:.2f} 高さの幅{best['range']:.1f}半音 動き{best['move']:.0f} {text} => {best['heard']}{flag}"
            print(line, flush=True)
            report[f"{cid} {key}"] = line
    # 作り直した行だけ差し替えて、全体の一覧を残す
    rp.write_text("\n".join(report.values()), encoding="utf-8")


if __name__ == "__main__":
    main()
