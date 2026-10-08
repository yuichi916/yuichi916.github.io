# -*- coding: utf-8 -*-
"""Suno で作った効果音（E:\\suno_hitofude\\tn_<名前>.mp3）を、ゲーム用に整えて assets/tsunagu-naraberu/sound/se_<名前>.mp3 に書く。
   頭の無音を削り、長さを上限で切って終わりをフェードし、音量をそろえる（モノラル 96kbps）。
   使い方: python _dev/tsunagu-naraberu/make_se.py"""
import io, subprocess, sys
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
SRC = Path(r"E:\suno_hitofude")
OUT = Path(__file__).resolve().parents[2] / "assets" / "tsunagu-naraberu" / "sound"
# 名前 → (長さの上限 秒, 山の高さ dBFS)。短い音は loudnorm が効かないので、山の高さでそろえる。何度も鳴る音ほど短く小さく
SPEC = {"pop": (0.5, -4), "clear": (1.0, -4), "chain": (1.6, -5), "land": (0.45, -9), "swap": (0.35, -10),
        "garbage": (1.4, -3), "attack": (1.4, -4), "win": (4.5, -3), "lose": (4.5, -3)}
import re
def peak(src, af):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(src), "-af", af + ",volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    return float(re.search(r"max_volume: (-?[0-9.]+) dB", r.stderr).group(1))
for name, (cap, top) in SPEC.items():
    src = SRC / f"tn_{name}.mp3"
    if not src.exists():
        print("なし", src); continue
    fade = min(0.25, cap * 0.35)
    af = (f"silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005,"
          f"atrim=0:{cap},afade=t=out:st={cap - fade:.3f}:d={fade:.3f}")
    af += f",volume={top - peak(src, af):.2f}dB"
    dst = OUT / f"se_{name}.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", af, "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-b:a", "96k", str(dst)], check=True)
    d_in = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout)
    d_out = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)], capture_output=True, text=True).stdout)
    print(f"{name:8s} 元 {d_in:5.2f}s → {d_out:4.2f}s  {dst.stat().st_size // 1024}KB")
