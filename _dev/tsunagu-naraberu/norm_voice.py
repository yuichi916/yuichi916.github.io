"""声の音量をそろえる。台詞は -15 LUFS、大技の掛け声（c4・c5）は -13 LUFS。
音量の変更は一定のゲイン＋ピークの頭打ち（-1.5 dBFS）だけ（短い声で loudnorm の動的処理をかけると揺れるため）。
使い方: python norm_voice.py   （assets/tsunagu-naraberu/voice/*.mp3 を上書き）"""
import json, os, pathlib, subprocess, tempfile, shutil

VOICE = pathlib.Path(__file__).resolve().parents[2] / "assets" / "tsunagu-naraberu" / "voice"


def loudness(p):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(p), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True, encoding="utf-8").stderr
    j = json.loads(out[out.rindex("{"):out.rindex("}") + 1])
    return float(j["input_i"]), float(j["input_tp"])


def main():
    for p in sorted(VOICE.glob("*.mp3")):
        if p.name.startswith("_"):
            continue
        key = p.stem.split("_", 1)[1]
        target = -13.0 if key in ("c4", "c5") else -15.0
        i, tp = loudness(p)
        gain = target - i
        if abs(gain) < 0.3:
            continue
        fd, name = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        tmp = pathlib.Path(name)
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(p), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:level=false",
                        "-c:a", "libmp3lame", "-b:a", "96k", "-ar", "44100", str(tmp)], check=True)
        shutil.move(str(tmp), str(p))
        i2, tp2 = loudness(p)
        print(f"{p.name}: {i:.1f} → {i2:.1f} LUFS（ピーク {tp2:.1f}）")


if __name__ == "__main__":
    main()
