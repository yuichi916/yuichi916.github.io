"""capture.py の素材から紹介動画を組み立てる。
構成: 冒頭（試合のいちばん動く2.6秒＋「ぷよぷよ風 vs パネルでポン風」）→ 試合の始まりから決着まで（出来事に合わせた字幕・勝者）→ 終わりのカード。
音は試合の実際の音、終わりのカードはタイトル曲。-14 LUFS・ピークは -1.5 dBTP 以下。
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
ev, res = meta["events"], meta["result"]
S0 = B0 / FPS                       # 素材の中で試合が始まる秒
bt = lambda f: f / 60               # 試合のコマ（60Hz）→ 試合の秒
MAIN = N / FPS - S0                 # 試合の長さ（決着のあとの余韻を含む）

# 冒頭: 最初の3連鎖以上の1秒前から2.6秒
first = next(e for e in ev if e["type"] == "pop" and (e.get("chain") or 0) >= 3)
O0 = max(0.0, bt(first["f"]) - 1.0)
O = 2.6
SH = O                              # 本編の字幕は O 秒ずらす


def nxt(pred, after):
    return next((e for e in ev if pred(e) and bt(e["f"]) > after), None)


# 字幕は「その場面で本当に起きていること」に合わせる（事実確認の指摘 2026-10-18）
caps = [("cap_open", 0.0, O - 0.08), ("cap_tsunagu", SH + 0.3, SH + 5.6), ("cap_naraberu", SH + 0.3, SH + 5.6)]
busy = 5.9
# 送る: 相手に実際に3以上送った攻撃（相殺で消えたぶんではなく）
snd = nxt(lambda e: e["type"] == "attack" and (e.get("sent") or 0) >= 3, busy)
if snd:
    s = max(busy, bt(snd["f"]) - 0.8); caps.append(("cap_chain", SH + s, SH + s + 4.0)); busy = s + 4.3
off = nxt(lambda e: e["type"] == "attack" and (e.get("offset") or 0) > 0.5, busy)
if off:
    s = max(busy, bt(off["f"]) - 0.9); caps.append(("cap_offset", SH + s, SH + s + 4.0)); busy = s + 4.3
act = nxt(lambda e: e["type"] == "pop" and e["p"] == 1 and (e.get("chain") or 0) == 2
          and any(x["type"] == "pop" and x["p"] == 1 and (x.get("chain") or 0) >= 4 and 0 < x["f"] - e["f"] < 600 for x in ev), busy)
gar = nxt(lambda e: e["type"] == "garbage" and (e.get("n") or 0) >= 6, busy)
if gar and (not act or bt(gar["f"]) + 4.6 < bt(act["f"])):
    s = max(busy, bt(gar["f"]) - 0.5); caps.append(("cap_garbage", SH + s, SH + s + 4.0)); busy = s + 4.3
if act:
    s = max(busy, bt(act["f"]) - 0.3); caps.append(("cap_active", SH + s, SH + s + 4.4)); busy = s + 4.7
if res and res.get("winner") in (0, 1):
    s = bt(res["frames"]) + 0.2
    caps.append((f"cap_win{res['winner']}", SH + s, SH + MAIN))
TOTAL = O + MAIN
for c in caps:
    print(f"  {c[0]:<13} {c[1]:5.1f} - {c[2]:5.1f} s")

inputs = ["-framerate", str(FPS), "-i", str(SRC / "f_%05d.jpg"), "-i", str(SRC / "audio.wav"), "-i", str(TITLE_BGM)]
inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{END:.3f}", "-i", str(OV / "end.png")]
for name, _, _ in caps:
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{TOTAL:.3f}", "-i", str(OV / f"{name}.png")]
K = 4  # 字幕の入力の始まり
fc = [
    "[0:v]split=2[va][vb]",
    f"[va]trim={S0 + O0:.4f}:{S0 + O0 + O:.4f},setpts=PTS-STARTPTS[vo]",
    f"[vb]trim={S0:.4f},setpts=PTS-STARTPTS[vm]",
    f"[vo][vm]concat=n=2:v=1:a=0,settb=1/{FPS}[v0]",
]
last = "[v0]"
for i, (name, s, e) in enumerate(caps):
    fi = 0.12 if name == "cap_open" else 0.25
    fc.append(f"[{K + i}:v]format=rgba,fade=t=in:st={s:.2f}:d={fi}:alpha=1,fade=t=out:st={e - 0.25:.2f}:d=0.25:alpha=1[c{i}]")
    fc.append(f"{last}[c{i}]overlay=0:0:format=auto[v{i + 1}]")
    last = f"[v{i + 1}]"
XF = 0.6
fc.append(f"{last}fps={FPS},format=yuv420p,settb=1/{FPS}[game]")  # concat のあとは frame rate が 1/0 になるので付け直す
fc.append(f"[3:v]zoompan=z='1+0.0006*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS},format=yuv420p,settb=1/{FPS}[endc]")
fc.append(f"[game][endc]xfade=transition=fade:duration={XF}:offset={TOTAL - XF:.3f},format=yuv420p[vout]")
# 音: 冒頭の切り出し＋本編（つなぎ目は短く溶かす）→ 終わりのカードはタイトル曲
fc.append("[1:a]asplit=2[aa][ab]")
fc.append(f"[aa]atrim={S0 + O0:.4f}:{S0 + O0 + O:.4f},asetpts=PTS-STARTPTS,afade=t=out:st={O - 0.06:.3f}:d=0.06[ao]")
fc.append(f"[ab]atrim={S0:.4f},asetpts=PTS-STARTPTS,afade=t=in:d=0.06[am]")
fc.append(f"[ao][am]concat=n=2:v=0:a=1,atrim=0:{TOTAL:.3f},afade=t=out:st={TOTAL - 1.2:.3f}:d=1.2[ga]")
fc.append(f"[2:a]atrim=0:{END + XF:.3f},asetpts=PTS-STARTPTS,volume=0.7,afade=t=in:d=0.4,afade=t=out:st={END + XF - 1.2:.3f}:d=1.2[ta]")
fc.append(f"[ga][ta]acrossfade=d={XF}:c1=tri:c2=tri,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.79:level=false[aout]")
cmd = ["ffmpeg", "-hide_banner", "-v", "warning", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k",
       "-movflags", "+faststart", str(OUT)]
subprocess.run(cmd, check=True)
print("ok", OUT, f"{TOTAL + END - XF:.1f}s")
