# -*- coding: utf-8 -*-
"""BGM素材の候補列挙とmp3変換。

設計書 8-9 の10用途に対して、各アルバムのトラックを列挙して試聴に回し、
選んだものを assets/koe/bgm/<key>.mp3 に変換する。
"""
import json
import subprocess
from pathlib import Path

ALBUM_ROOT = r"P:\My Music\Lossless\Indies\素材"
AUDIO_EXT = {".flac", ".wav", ".mp3", ".m4a", ".ogg"}


def _duration(path):
    """ffprobeで秒数を取る。取れなければ0.0（列挙を止めない）。"""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=20)
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def list_tracks(album_dir):
    """アルバムディレクトリ直下＋再帰の音声ファイルを列挙する。"""
    root = Path(album_dir)
    if not root.is_dir():
        return []
    tracks = []
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in AUDIO_EXT:
            tracks.append({"path": str(p), "name": p.stem, "sec": _duration(p)})
    return tracks


def to_mp3(src, dst, bitrate="192k"):
    """ffmpegでmp3に変換する。成功でTrue。"""
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
             "-vn", "-codec:a", "libmp3lame", "-b:a", bitrate, str(dst)],
            capture_output=True, text=True, timeout=300)
        return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0
    except Exception:
        return False


def survey(root=ALBUM_ROOT):
    """全アルバムのトラック一覧をJSONで吐く（試聴用の索引）。"""
    root = Path(root)
    result = {}
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        result[d.name] = [{"name": t["name"], "sec": round(t["sec"], 1), "path": t["path"]}
                          for t in list_tracks(str(d))]
    return result


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "survey":
        print(json.dumps(survey(), ensure_ascii=False, indent=1))
    else:
        print("usage: python bgm_prep.py survey > C:/tmp/koe_bgm_survey.json")
