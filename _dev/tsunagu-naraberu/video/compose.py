"""capture.py の素材から紹介動画を組み立てる: コマ＋字幕（出来事の時刻に合わせる）＋終わりのカード＋音（-14 LUFS）。
使い方: python compose.py <capture の出力> <overlays の出力> <出力 mp4> [--end 5]
"""
import json
import subprocess
import sys
from pathlib import Path

SRC, OV, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
END = float(sys.argv[sys.argv.index("--end") + 1]) if "--end" in sys.argv else 5.0
ROOT = Path(__file__).resolve().parents[3]
TITLE_BGM = ROOT / "assets/tsunagu-naraberu/sound/bgm_title.mp3"

meta = json.loads((SRC / "events.json").read_text(encoding="utf-8"))
FPS, B0, N = meta["fps"], meta["battle_start"], meta["frames"]
ev = meta["events"]
T = lambda f: (B0 + f / 2) / FPS          # 試合のコマ（60Hz）→ 動画の秒
GAME = N / FPS

# 字幕の時刻: 出来事から決める
caps = [("cap_tsunagu", T(0) + 0.3, T(0) + 6.0), ("cap_naraberu", T(0) + 0.3, T(0) + 6.0)]
busy = T(0) + 6.3
big = next((e for e in ev if e["type"] == "pop" and (e.get("chain") or 0) >= 3 and T(e["f"]) > busy), None)
if big:
    s = max(busy, T(big["f"]) - 0.6); caps.append(("cap_chain", s, s + 4.2)); busy = s + 4.5
off = next((e for e in ev if e["type"] == "attack" and (e.get("offset") or 0) > 0.5 and T(e["f"]) > busy), None)
if off:
    s = max(busy, T(off["f"]) - 0.9); caps.append(("cap_offset", s, s + 4.0)); busy = s + 4.3
act = next((e for e in ev if e["type"] == "pop" and e["p"] == 1 and (e.get("chain") or 0) == 2 and T(e["f"]) > busy
            and any(x["type"] == "pop" and x["p"] == 1 and (x.get("chain") or 0) >= 4 and 0 < x["f"] - e["f"] < 600 for x in ev)), None)
if act:
    s = max(busy, T(act["f"]) - 0.3); caps.append(("cap_active", s, s + 4.4))
for c in caps:
    print(f"  {c[0]:<13} {c[1]:5.1f} – {c[2]:5.1f} 秒")

inputs = ["-framerate", str(FPS), "-i", str(SRC / "f_%05d.jpg")]
for name, _, _ in caps:
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{GAME:.3f}", "-i", str(OV / f"{name}.png")]
inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{END:.3f}", "-i", str(OV / "end.png")]
INTRO_END = B0 / FPS + 0.4  # タイトル画面のぶんは大きな題名のカードで隠し、試合が始まってから0.4秒で溶かす
inputs += ["-i", str(SRC / "audio.wav"), "-i", str(TITLE_BGM)]
inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{INTRO_END:.3f}", "-i", str(OV / "intro.png")]
ni = len(caps)
fc, last = [], "[0:v]"
for i, (name, s, e) in enumerate(caps):
    fc.append(f"[{i + 1}:v]format=rgba,fade=t=in:st={s:.2f}:d=0.25:alpha=1,fade=t=out:st={e - 0.25:.2f}:d=0.25:alpha=1[c{i}]")
    fc.append(f"{last}[c{i}]overlay=0:0:format=auto[v{i}]")
    last = f"[v{i}]"
XF = 0.6
fc.append(f"[{ni + 4}:v]format=rgba,fade=t=out:st={INTRO_END - 0.4:.2f}:d=0.4:alpha=1[intro]")
fc.append(f"{last}[intro]overlay=0:0:eof_action=pass:format=auto[vi]")
last = "[vi]"
fc.append(f"{last}format=yuv420p,settb=1/{FPS}[game]")
fc.append(f"[{ni + 1}:v]format=yuv420p,settb=1/{FPS}[endc]")
fc.append(f"[game][endc]xfade=transition=fade:duration={XF}:offset={GAME - XF:.3f},format=yuv420p[vout]")
# 音: 試合の音（最後の1秒で下げる）→ 終わりのカードはタイトル曲
fc.append(f"[{ni + 2}:a]atrim=0:{GAME:.3f},afade=t=out:st={GAME - 1.2:.3f}:d=1.2[ga]")
fc.append(f"[{ni + 3}:a]atrim=0:{END + XF:.3f},asetpts=PTS-STARTPTS,volume=0.7,afade=t=in:d=0.4,afade=t=out:st={END + XF - 1.2:.3f}:d=1.2[ta]")
fc.append(f"[ga][ta]acrossfade=d={XF}:c1=tri:c2=tri,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")
cmd = ["ffmpeg", "-hide_banner", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k",
       "-movflags", "+faststart", str(OUT)]
subprocess.run(cmd, check=True)
print("ok", OUT)
