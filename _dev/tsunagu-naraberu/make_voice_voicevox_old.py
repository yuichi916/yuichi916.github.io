# -*- coding: utf-8 -*-
"""キャラのかけ声を VOICEVOX で作り、assets/tsunagu-naraberu/voice/{t|n}_{名前}.mp3 に書く（モノラル 64kbps）。
   つなぐ派「ぷにまる」= 満別花丸（元気, 70）／ならべる派「カクたん」= 春日部つむぎ（ノーマル, 8）。クレジット表記が必要（ヘルプに載せる）
   使い方: python _dev/tsunagu-naraberu/make_voice.py   （VOICEVOX を 50021 番で起動しておく）"""
import io, json, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
OUT = Path(__file__).resolve().parents[2] / "assets" / "tsunagu-naraberu" / "voice"; OUT.mkdir(parents=True, exist_ok=True)
VV = "http://127.0.0.1:50021"
CHARS = {"t": 70, "n": 8}
LINES = {"c1": "えいっ！", "c2": "それっ！", "c3": "まだまだ！", "c4": "いっけー！", "c5": "とどめっ！",
         "ouch": "うわぁっ！", "danger": "あぶないっ！", "win": "やったー！", "lose": "うぅ、まけたぁ…"}
for ch, spk in CHARS.items():
    for key, text in LINES.items():
        q = json.loads(urllib.request.urlopen(urllib.request.Request(f"{VV}/audio_query?speaker={spk}&text={urllib.parse.quote(text)}", method="POST")).read())
        q["speedScale"] = 1.12; q["intonationScale"] = 1.45; q["pitchScale"] = 0.04 if key != "lose" else 0.0
        q["prePhonemeLength"] = 0.02; q["postPhonemeLength"] = 0.06
        wav = urllib.request.urlopen(urllib.request.Request(f"{VV}/synthesis?speaker={spk}", data=json.dumps(q).encode(), headers={"Content-Type": "application/json"})).read()
        dst = OUT / f"{ch}_{key}.mp3"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "pipe:0", "-af", "loudnorm=I=-16:TP=-1.5", "-ac", "1", "-ar", "44100", "-b:a", "64k", str(dst)], input=wav, check=True)
        print(dst.name, dst.stat().st_size)
