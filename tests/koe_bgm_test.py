# -*- coding: utf-8 -*-
"""BGM抽出・変換の検証。実ドライブに依存しないよう一時ディレクトリで検証する。"""
import sys, tempfile, wave, struct, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import bgm_prep


def write_wav(path, sec=0.4, sr=8000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        for i in range(int(sr * sec)):
            w.writeframes(struct.pack("<h", int(3000 * math.sin(i * 0.05))))


def main():
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        album = td / "[TEST] アルバム名 [WEB-FLAC]"
        album.mkdir()
        write_wav(album / "01. 静かな朝.wav")
        write_wav(album / "02. 塔の底.wav")
        (album / "cover.jpg").write_bytes(b"\xff\xd8\xff")   # 音声以外は無視される

        tracks = bgm_prep.list_tracks(str(album))
        assert len(tracks) == 2, f"音声2本のはずが {len(tracks)}"
        names = sorted(t["name"] for t in tracks)
        assert names == ["01. 静かな朝", "02. 塔の底"], names
        assert all("path" in t and "sec" in t for t in tracks), "キーが足りない"

        # 存在しないディレクトリは空リスト（例外にしない）
        assert bgm_prep.list_tracks(str(td / "nope")) == []

        dst = td / "out" / "asa.mp3"
        ok = bgm_prep.to_mp3(str(album / "01. 静かな朝.wav"), str(dst))
        assert ok, "ffmpeg変換に失敗"
        assert dst.exists() and dst.stat().st_size > 0, "mp3が空"

    print("koe_bgm_test: OK")


if __name__ == "__main__":
    main()
