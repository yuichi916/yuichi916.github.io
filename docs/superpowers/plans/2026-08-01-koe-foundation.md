# 『声を、あげる』基盤（フェーズ0〜2）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 短編サウンドノベル『声を、あげる』の基盤——声の段階合成DSP、制作スクリプト群、エンジン `koe.html`、スタブ台本——を作り、**ダミーアセットで最初から最後まで通して読める状態**にする。

**Architecture:** 既存作 `C:\projects\yuichi916.github.io\seikai.html`（1518行・実績あり）からビート実行ループ・背景・立ち絵・音・選択肢・セーブを移植し、本作固有の6ビート命令とギミック（セイレン無音ガード／地の文2系統／タイトル声）を足す。台本は `assets\koe\koe-ep1.js` に素のJSデータとして分離し、エンジンには一切物語を持たせない。制作スクリプトは Python（`scripts\koe\`）、テストは pytest 非依存の素の assert スクリプト（`tests\` の既存慣習に合わせる）。

**Tech Stack:** HTML/JS（single-file, three.js は importmap 経由）、Python 3.10.9（numpy / scipy / soundfile / librosa / playwright / faster-whisper / rembg / PIL）、Node v24.16.0、ffmpeg N-115020。**pytest は未インストールなので使わない**。

**設計書:** `C:\projects\yuichi916.github.io\docs\superpowers\specs\2026-08-01-koe-sound-novel-design.md`

**このプランのスコープ外（フェーズ3〜6・別プラン）:** 本編脚本の執筆、SD画像生成（立ち絵32＋記憶絵24）、Blender背景12ロケ、ElevenLabs本番ボイス生成、公開作業。
**分割理由は技術的依存**です——ボイスのファイル名は台詞テキストのハッシュなので、**台本が凍結されるまで本番ボイスは1本も生成できません**。台本の凍結には、まずエンジンとスタブ台本で通し読みできる状態が要ります。

---

## Global Constraints

- **単一HTML＋アセット**でブラウザ完結。インストール不要を崩さない
- **台本はデータ、エンジンはコード**。物語の内容を `koe.html` に書かない
- **止まる命令と止まらない命令を一貫させる**。`bg/bgm/se/show/hide/narrator` は `continue`、`say/choose/card/wait/pickup/tryvoice/montage/finalvoice/title` は `return`
- **セイレン（`say:'ren'`）は既定で絶対にボイスを鳴らさない**。鳴らすのは `v:1` が明示されたビートのみ
- **地の文のボイスは `n<hash>_k.mp3` / `n<hash>_r.mp3` の対**。ハッシュは text のみから計算し、話者名を含めない
- **分岐エンドを作らない**。`choose` は必ず合流し、演出差分のみ
- アセット総容量の目標は **74 MB**
- Windows 実行時は `PYTHONUTF8=1` と `chcp 65001` を前提にする
- **HTMLへのパッチで heredoc を使わない**。Git Bash が `\\n` を潰してJS文字列を壊す。必ず Write ツールでファイルを書く
- **commit前に `python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/koe.html` が exit 0**（このツールは既に存在する）
- コミットメッセージは Conventional Commits
- 作業ブランチは `main`（このリポジトリの既定）

---

## File Structure

| ファイル | 責務 |
|---|---|
| `C:\projects\yuichi916.github.io\koe.html` | エンジン＋UI。物語を持たない |
| `C:\projects\yuichi916.github.io\assets\koe\koe-ep1.js` | 台本データ。`window.KOE.ep1` に代入するだけ |
| `C:\projects\yuichi916.github.io\scripts\koe\synth_stages.py` | 完成ボイス1本から合成度5段階を生成 |
| `C:\projects\yuichi916.github.io\scripts\koe\kana.py` | TTS送信テキストの整形（ルビ畳み・読み置換） |
| `C:\projects\yuichi916.github.io\scripts\koe\readings.json` | 読み置換テーブル（データ。コードと分離） |
| `C:\projects\yuichi916.github.io\scripts\koe\dump_script.mjs` | 台本JSをJSONに落とすNodeブリッジ |
| `C:\projects\yuichi916.github.io\scripts\koe\voice_audit.py` | ボイスの棚卸し（欠落0／孤児0／`_k`・`_r`の対） |
| `C:\projects\yuichi916.github.io\scripts\koe\bgm_prep.py` | BGM候補の抽出とmp3変換 |
| `C:\projects\yuichi916.github.io\tests\koe_synth_test.py` | 段階合成の検証 |
| `C:\projects\yuichi916.github.io\tests\koe_kana_test.py` | テキスト整形の検証 |
| `C:\projects\yuichi916.github.io\tests\koe_audit_test.py` | 棚卸しの検証 |
| `C:\projects\yuichi916.github.io\tests\koe_bgm_test.py` | BGM抽出の検証 |
| `C:\projects\yuichi916.github.io\tests\koe_e2e_test.py` | Playwright通し検証（無音ガード含む） |

テストは全て `python <path>` で実行し、**exit 0 が合格**。失敗時は `AssertionError` で落ちる。既存の `tests\niwa_behavior_test.py` と同じ流儀。

---

## Task 1: 声の段階合成DSP（最大の技術リスク）

設計書の 7-1 が成立するかを最初に確かめる。ここがノイズにしか聞こえないなら、以降の設計が変わる。

**Files:**
- Create: `C:\projects\yuichi916.github.io\scripts\koe\synth_stages.py`
- Test: `C:\projects\yuichi916.github.io\tests\koe_synth_test.py`

**Interfaces:**
- Consumes: なし（このプランの最初のタスク）
- Produces:
  - `synth_stages.render(src_path: str, out_dir: str, seed: int = 0) -> list[pathlib.Path]` — 5本のwavパスを `s00, s25, s50, s75, s100` の順で返す
  - `synth_stages.make_test_voice(path: str, sr: int = 44100, dur: float = 1.5, f0: float = 200.0, seed: int = 7) -> None` — 決定論的な合成音声を書き出す（テスト用）
  - `synth_stages.SR = 44100`

- [ ] **Step 1: テストを書く（失敗する）**

`C:\projects\yuichi916.github.io\tests\koe_synth_test.py`:

```python
# -*- coding: utf-8 -*-
"""声の段階合成DSPの検証。 python tests/koe_synth_test.py で実行、exit 0 が合格。"""
import sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import numpy as np
import soundfile as sf
import librosa
import synth_stages as ss


def flatness(y):
    return float(np.mean(librosa.feature.spectral_flatness(y=y)))


def main():
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        src = td / "src.wav"
        ss.make_test_voice(str(src))

        paths = ss.render(str(src), str(td / "out"), seed=0)
        assert len(paths) == 5, f"5段階のはずが {len(paths)} 本"
        for p in paths:
            assert p.exists(), f"未生成: {p}"

        y_src, _ = librosa.load(str(src), sr=ss.SR, mono=True)
        stages = [librosa.load(str(p), sr=ss.SR, mono=True)[0] for p in paths]
        s00, s25, s50, s75, s100 = stages

        # 全段階が同じ長さ（尺が変わるとビート進行の計算が狂う）
        for i, s in enumerate(stages):
            assert abs(len(s) - len(y_src)) <= ss.SR // 100, f"段階{i}の尺が元と違う"

        # 0%: 倍音構造が壊れてノイズ的になる（スペクトル平坦度が上がる）
        assert flatness(s00) > flatness(y_src) * 1.5, \
            f"0%が無声化できていない src={flatness(y_src):.5f} s00={flatness(s00):.5f}"

        # 0%: 3kHz以上がほぼ落ちている
        S = np.abs(librosa.stft(s00, n_fft=1024))
        freqs = librosa.fft_frequencies(sr=ss.SR, n_fft=1024)
        hi = S[freqs > 6000].mean()
        lo = S[freqs < 3000].mean()
        assert hi < lo * 0.25, f"0%のLPFが効いていない hi={hi:.5f} lo={lo:.5f}"

        # 25%: 時間順序が壊れている（元との相関が落ちる）
        n = min(len(s25), len(y_src))
        corr = abs(float(np.corrcoef(s25[:n], y_src[:n])[0, 1]))
        assert corr < 0.35, f"25%のグラニュラー並べ替えが効いていない corr={corr:.3f}"

        # 50%: 元と部分的に一致する区間が残っている（断片が通る）
        # 100%との差分エネルギーが、25%より小さい＝より元に近い
        d50 = float(np.mean((s50[:n] - s100[:n]) ** 2))
        d25 = float(np.mean((s25[:n] - s100[:n]) ** 2))
        assert d50 < d25, f"50%が25%より元に近くない d50={d50:.5f} d25={d25:.5f}"

        # 75%: 50%よりさらに元に近い（回復していく）
        d75 = float(np.mean((s75[:n] - s100[:n]) ** 2))
        assert d75 < d50, f"75%が50%より元に近くない d75={d75:.5f} d50={d50:.5f}"

        # 100%: 正規化した元と一致
        assert np.allclose(s100[:n], ss._norm(y_src)[:n], atol=2e-3), "100%が元と一致しない"

        # 決定論性：同じseedで同じ出力
        again = ss.render(str(src), str(td / "out2"), seed=0)
        a = librosa.load(str(again[1]), sr=ss.SR, mono=True)[0]
        assert np.allclose(a[:n], s25[:n], atol=2e-3), "同じseedで出力が変わる"

    print("koe_synth_test: OK")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 実行して失敗を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_synth_test.py
```

Expected: `ModuleNotFoundError: No module named 'synth_stages'`

- [ ] **Step 3: 実装する**

`C:\projects\yuichi916.github.io\scripts\koe\synth_stages.py`:

```python
# -*- coding: utf-8 -*-
"""完成ボイス1本から「合成度」5段階を機械導出する。

段階の意味（設計書 7-1）:
  s00  ノイズと呼気だけ        — 声帯を失った状態
  s25  音素は出るが言葉にならない — 粒の並べ替え
  s50  単語の断片が混じる       — 半分がノイズに置換
  s75  片言                    — 欠落・ピッチ揺らぎ・量子化
  s100 完全な声                — 無加工

人間の声優には録れない「壊れ方が連続的に回復していく5段階」を、
1本の完成ボイスから決定論的に作る。
"""
from pathlib import Path

import numpy as np
import soundfile as sf
import librosa
from scipy.signal import butter, sosfilt

SR = 44100
N_FFT = 1024
HOP = 256


def _load(path):
    y, _ = librosa.load(str(path), sr=SR, mono=True)
    return y.astype(np.float32)


def _norm(y):
    m = float(np.max(np.abs(y)))
    if m <= 0:
        return y.astype(np.float32)
    return (y / m * 0.89).astype(np.float32)


def stage_breath(y, rng):
    """0%: スペクトル包絡だけ残してノイズ励振に差し替え、強LPF。"""
    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP))
    # 周波数方向に平滑化して倍音構造を潰す（フォルマントは残る）
    kern = np.ones(9, dtype=np.float32) / 9.0
    S = np.apply_along_axis(lambda c: np.convolve(c, kern, mode="same"), 0, S)
    noise = rng.standard_normal(len(y)).astype(np.float32)
    Nz = librosa.stft(noise, n_fft=N_FFT, hop_length=HOP)
    out = librosa.istft(S * np.exp(1j * np.angle(Nz)), hop_length=HOP, length=len(y))
    sos = butter(6, 3000.0 / (SR / 2), btype="low", output="sos")
    return _norm(sosfilt(sos, out).astype(np.float32))


def stage_grain(y, rng, grain_ms=25):
    """25%: 25msの粒に分解して順序をシャッフルし、重ね合わせで戻す。"""
    g = max(1, int(SR * grain_ms / 1000))
    win = np.hanning(g * 2).astype(np.float32)
    n = max(1, (len(y) - g) // g)
    starts = [i * g for i in range(n)]
    order = rng.permutation(len(starts))
    out = np.zeros(len(y) + g * 2, dtype=np.float32)
    for k, idx in enumerate(order):
        src = starts[idx]
        seg = y[src:src + g * 2]
        if len(seg) < g * 2:
            seg = np.pad(seg, (0, g * 2 - len(seg)))
        dst = k * g
        out[dst:dst + g * 2] += seg * win
    return _norm(out[:len(y)])


def stage_fragment(y, rng, keep=0.5, frame_ms=90):
    """50%: 90msフレームの半分を、同じ音量のノイズに置換する。"""
    f = max(1, int(SR * frame_ms / 1000))
    out = y.copy()
    for s in range(0, len(y), f):
        seg = y[s:s + f]
        if len(seg) == 0:
            continue
        if rng.random() < (1.0 - keep):
            rms = float(np.sqrt(np.mean(seg ** 2)))
            out[s:s + len(seg)] = (rng.standard_normal(len(seg)) * rms * 0.6).astype(np.float32)
    return _norm(out)


def stage_broken(y, rng, drop=0.15, frame_ms=120, cents=40.0, bits=7):
    """75%: 15%を欠落、±40centのピッチ揺らぎ、7bit量子化。片言になる。"""
    f = max(1, int(SR * frame_ms / 1000))
    out = np.zeros_like(y)
    for s in range(0, len(y), f):
        seg = y[s:s + f]
        if len(seg) == 0:
            continue
        if rng.random() < drop:
            continue  # 欠落
        n_steps = float(rng.uniform(-cents, cents)) / 100.0
        try:
            seg = librosa.effects.pitch_shift(y=seg.astype(np.float32), sr=SR, n_steps=n_steps)
        except Exception:
            pass
        out[s:s + len(seg)] = seg[:len(out) - s]
    q = float(2 ** (bits - 1))
    out = np.round(out * q) / q
    return _norm(out.astype(np.float32))


STAGES = (("00", stage_breath), ("25", stage_grain),
          ("50", stage_fragment), ("75", stage_broken), ("100", None))


def render(src_path, out_dir, seed=0):
    """完成ボイスから5段階を書き出し、パスのリストを返す。"""
    y = _load(src_path)
    rng = np.random.default_rng(seed)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(src_path).stem
    paths = []
    for name, fn in STAGES:
        out = _norm(y.copy()) if fn is None else fn(y, rng)
        p = out_dir / f"{stem}-s{name}.wav"
        sf.write(str(p), out, SR, subtype="FLOAT")
        paths.append(p)
    return paths


def make_test_voice(path, sr=SR, dur=1.5, f0=200.0, seed=7):
    """テスト用の決定論的な「声らしい」信号（倍音＋音節エンベロープ）。"""
    rng = np.random.default_rng(seed)
    t = np.arange(int(sr * dur)) / sr
    sig = np.zeros_like(t)
    for k in range(1, 13):
        sig += (1.0 / k) * np.sin(2 * np.pi * f0 * k * t + rng.uniform(0, 2 * np.pi))
    env = (0.5 * (1 - np.cos(2 * np.pi * 5 * t))) ** 2
    env = env / float(env.max())
    sig = (sig / float(np.max(np.abs(sig))) * env * 0.8).astype(np.float32)
    sf.write(str(path), sig, sr, subtype="FLOAT")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("usage: python synth_stages.py <src.wav> <out_dir> [seed]")
        raise SystemExit(2)
    s = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    for p in render(sys.argv[1], sys.argv[2], seed=s):
        print(p)
```

- [ ] **Step 4: 実行して合格を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_synth_test.py
```

Expected: `koe_synth_test: OK`（exit 0）

- [ ] **Step 5: 人間の耳で判定する（このプラン唯一の人手ゲート）**

ElevenLabs で「——おはよう」相当の日本語台詞を1本だけ生成して `C:\tmp\koe_probe.wav` に置き、5段階を出して順に聴く。

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\scripts\koe\synth_stages.py C:\tmp\koe_probe.wav C:\tmp\koe_probe_out 0
```

**判定基準:** s00 → s100 を順に聴いたとき、「壊れた声が組み上がっていく」と感じられること。
**不合格だった場合:** DSP方式を捨て、ElevenLabs に「音素を実際に欠落させた台詞」（例: 「———は———う」）を直接読ませる方式に切り替える。設計書 11章のリスク表どおり。この判断はここで確定させ、以降のタスクに持ち越さない。

- [ ] **Step 6: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add scripts/koe/synth_stages.py tests/koe_synth_test.py
git commit -m "feat(koe): add 5-stage voice synthesis DSP with deterministic tests"
```

---

## Task 2: BGM候補の抽出とmp3変換

設計書 8-9 の10曲を確定させるための道具。曲そのものの選定は人間の試聴だが、候補の列挙と変換は機械化する。

**Files:**
- Create: `C:\projects\yuichi916.github.io\scripts\koe\bgm_prep.py`
- Test: `C:\projects\yuichi916.github.io\tests\koe_bgm_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `bgm_prep.list_tracks(album_dir: str) -> list[dict]` — `{"path": str, "name": str, "sec": float}` のリスト（`sec` は取得できなければ `0.0`）
  - `bgm_prep.to_mp3(src: str, dst: str, bitrate: str = "192k") -> bool` — ffmpeg で変換、成功で True
  - `bgm_prep.ALBUM_ROOT = r"P:\My Music\Lossless\Indies\素材"`

- [ ] **Step 1: テストを書く（失敗する）**

`C:\projects\yuichi916.github.io\tests\koe_bgm_test.py`:

```python
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
```

- [ ] **Step 2: 実行して失敗を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_bgm_test.py
```

Expected: `ModuleNotFoundError: No module named 'bgm_prep'`

- [ ] **Step 3: 実装する**

`C:\projects\yuichi916.github.io\scripts\koe\bgm_prep.py`:

```python
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
```

- [ ] **Step 4: 実行して合格を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_bgm_test.py
```

Expected: `koe_bgm_test: OK`

- [ ] **Step 5: 実素材の索引を作る**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\scripts\koe\bgm_prep.py survey > C:\tmp\koe_bgm_survey.json
```

Expected: 22アルバム分のトラック一覧がJSONで出る。**曲の確定はフェーズ4（別プラン）で試聴して行う**ので、ここでは索引が作れることまでを確認する。

- [ ] **Step 6: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add scripts/koe/bgm_prep.py tests/koe_bgm_test.py
git commit -m "feat(koe): add BGM survey and mp3 conversion tooling"
```

---

## Task 3: TTS送信テキストの整形（ルビ畳み・読み置換）

設計書 8-5 の「漢字の読み違いは文字比較では検出できない」への予防線。**TTSに送る文字列だけ**を整形し、ファイル名のハッシュは台詞原文から計算するので参照は壊れない。

**Files:**
- Create: `C:\projects\yuichi916.github.io\scripts\koe\kana.py`
- Create: `C:\projects\yuichi916.github.io\scripts\koe\readings.json`
- Test: `C:\projects\yuichi916.github.io\tests\koe_kana_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `kana.fold_ruby(text: str) -> str` — `静音器(せいおんき)` → `せいおんき`
  - `kana.apply_readings(text: str, table: dict[str, str]) -> str` — GUARD退避つきの置換
  - `kana.to_tts(text: str, table: dict | None = None) -> str` — `fold_ruby` → `apply_readings`
  - `kana.load_table(path: str | None = None) -> dict` — `readings.json` を読む

- [ ] **Step 1: テストを書く（失敗する）**

`C:\projects\yuichi916.github.io\tests\koe_kana_test.py`:

```python
# -*- coding: utf-8 -*-
"""TTS送信テキスト整形の検証。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import kana


def main():
    # --- ルビ畳み: 二重読み（「そらそら」）を出さない ---
    assert kana.fold_ruby("静音器(せいおんき)が満ちる") == "せいおんきが満ちる"
    assert kana.fold_ruby("静音器（せいおんき）が満ちる") == "せいおんきが満ちる"
    assert kana.fold_ruby("残響区(ざんきょうく)の空(そら)") == "ざんきょうくのそら"
    # ルビでない括弧は壊さない
    assert kana.fold_ruby("それは(たぶん)違う") == "それは(たぶん)違う"

    # --- 読み置換: 単独の誤読を直す ---
    t = {"空": "そら", "何": "なに"}
    assert kana.apply_readings("空を見た", t) == "そらを見た"
    assert kana.apply_readings("あたしは何！", t) == "あたしはなに！"

    # --- GUARD: 別読みの語を壊さない ---
    assert kana.apply_readings("空っぽの器", t) == "空っぽの器"
    assert kana.apply_readings("空気が薄い", t) == "空気が薄い"
    assert kana.apply_readings("空白の千年", t) == "空白の千年"
    assert kana.apply_readings("空腹だ", t) == "空腹だ"

    # --- to_tts: ルビ→置換の順で通る ---
    out = kana.to_tts("空(そら)と空っぽ", {"空": "そら"})
    assert out == "そらと空っぽ", out

    # --- 実テーブルが読める ---
    tbl = kana.load_table()
    assert isinstance(tbl, dict) and len(tbl) > 0, "readings.json が空"

    print("koe_kana_test: OK")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 実行して失敗を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_kana_test.py
```

Expected: `ModuleNotFoundError: No module named 'kana'`

- [ ] **Step 3: 実装する**

`C:\projects\yuichi916.github.io\scripts\koe\readings.json`:

```json
{
  "空": "そら",
  "何": "なに",
  "器": "うつわ",
  "音": "おと",
  "声": "こえ"
}
```

`C:\projects\yuichi916.github.io\scripts\koe\kana.py`:

```python
# -*- coding: utf-8 -*-
"""TTSへ送る文字列だけを整形する。ファイル名のハッシュは台詞原文から取るので参照は壊れない。

- fold_ruby: 「静音器(せいおんき)」を読み仮名だけに畳む。括弧を落とすだけだと
  「せいおんきせいおんき」と鳴るため、漢字側ごと置き換える。
- apply_readings: 単独漢字の誤読を直す。ただし「空っぽ」「空気」のような
  別読みの語を先に退避しないと「そらっぽ」「そらき」になる。
"""
import json
import re
from pathlib import Path

# 漢字＋（読み仮名）だけをルビとみなす。ひらがな始まりの括弧は本文なので触らない
RUBY = re.compile(r"[一-鿿々ヶ]+[（(]([ぁ-ゟァ-ヶー]+)[）)]")

# 退避する別読み語。置換対象の漢字を含むが、読みが違うもの
GUARD_WORDS = [
    "空っぽ", "空白", "空気", "空腹", "空間", "空か", "空き",
    "何か", "何も", "何で", "何と", "何が", "何を", "何の", "何な",
    "器用",
]

_DEFAULT_TABLE_PATH = Path(__file__).with_name("readings.json")


def fold_ruby(text):
    """漢字(かな) を かな だけに畳む。"""
    return RUBY.sub(lambda m: m.group(1), text)


def apply_readings(text, table):
    """GUARDで別読み語を退避してから、単独漢字を読み仮名に置換する。"""
    if not table:
        return text
    # 長い語から退避する（「空っぽ」が「空」より先）
    guards = sorted(GUARD_WORDS, key=len, reverse=True)
    holders = {}
    for i, w in enumerate(guards):
        if w in text:
            h = "\x01%d\x02" % i
            holders[h] = w
            text = text.replace(w, h)
    for src in sorted(table.keys(), key=len, reverse=True):
        text = text.replace(src, table[src])
    for h, w in holders.items():
        text = text.replace(h, w)
    return text


def load_table(path=None):
    p = Path(path) if path else _DEFAULT_TABLE_PATH
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def to_tts(text, table=None):
    """TTSへ送る最終形。"""
    if table is None:
        table = load_table()
    return apply_readings(fold_ruby(text), table)


if __name__ == "__main__":
    import sys
    print(to_tts(sys.argv[1] if len(sys.argv) > 1 else "静音器(せいおんき)の空(そら)"))
```

- [ ] **Step 4: 実行して合格を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_kana_test.py
```

Expected: `koe_kana_test: OK`

- [ ] **Step 5: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add scripts/koe/kana.py scripts/koe/readings.json tests/koe_kana_test.py
git commit -m "feat(koe): add TTS text normalization with ruby folding and reading guards"
```

---

## Task 4: 台本JSONブリッジとボイス棚卸し

設計書 8-5 の「欠落0／孤児0」と、本作固有の「地の文 `_k`・`_r` の対」を検査する。**改稿のたびに回す唯一の防衛線**。

**Files:**
- Create: `C:\projects\yuichi916.github.io\scripts\koe\dump_script.mjs`
- Create: `C:\projects\yuichi916.github.io\scripts\koe\voice_audit.py`
- Test: `C:\projects\yuichi916.github.io\tests\koe_audit_test.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `voice_audit.key_of(text: str) -> str` — JS の `keyOf` と同じ32bit符号付きハッシュ。`'k' + str(h)`
  - `voice_audit.expected_files(script: dict) -> set[str]` — 台本から期待ファイル名（拡張子なしのstem）の集合
  - `voice_audit.audit(script: dict, voice_dir: str) -> dict` — `{"missing": [...], "orphan": [...], "unpaired": [...]}`
  - `dump_script.mjs` — `node dump_script.mjs <ep.js> > out.json` で `window.KOE.ep1` をJSONに落とす

- [ ] **Step 1: テストを書く（失敗する）**

`C:\projects\yuichi916.github.io\tests\koe_audit_test.py`:

```python
# -*- coding: utf-8 -*-
"""ボイス棚卸しの検証。"""
import sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "koe"))

import voice_audit as va


def touch(d, stem):
    (Path(d) / (stem + ".mp3")).write_bytes(b"\x00")


def main():
    # --- ハッシュがJSのkeyOfと一致すること（32bit符号付き） ---
    # JS: let h=0; for(c of "a") h=(h*31+c.charCodeAt(0))|0  => 97
    assert va.key_of("a") == "k97", va.key_of("a")
    # "ab" => 97*31+98 = 3105
    assert va.key_of("ab") == "k3105", va.key_of("ab")
    # 負にオーバーフローする長い文字列でも例外にならない
    assert va.key_of("あ" * 50).startswith("k")

    script = {"scenes": [{"beats": [
        {"say": "kanata", "text": "拾い屋だ"},
        {"say": "narr",   "text": "音が減っていた"},
        {"say": "ren",    "text": "（文字盤を指す）"},          # 無音。ボイス不要
        {"say": "ren",    "text": "おはよう", "v": 1},          # v:1 なのでボイス必要
        {"say": "toki",   "text": "昔な"},
    ]}]}

    exp = va.expected_files(script)
    assert "v" + va.key_of("kanata|拾い屋だ") in exp
    assert "v" + va.key_of("toki|昔な") in exp
    assert "v" + va.key_of("ren|おはよう") in exp
    assert "n" + va.key_of("音が減っていた") + "_k" in exp
    assert "n" + va.key_of("音が減っていた") + "_r" in exp
    # v:1 でない ren はボイスを期待しない
    assert "v" + va.key_of("ren|（文字盤を指す）") not in exp
    assert len(exp) == 5, sorted(exp)

    with tempfile.TemporaryDirectory() as td:
        # 全部揃っている → クリーン
        for s in exp:
            touch(td, s)
        r = va.audit(script, td)
        assert r["missing"] == [] and r["orphan"] == [] and r["unpaired"] == [], r

        # 1本消す → missing に出る
        (Path(td) / ("v" + va.key_of("toki|昔な") + ".mp3")).unlink()
        r = va.audit(script, td)
        assert r["missing"] == ["v" + va.key_of("toki|昔な")], r

        # 余計な1本 → orphan に出る
        touch(td, "vk999999")
        r = va.audit(script, td)
        assert "vk999999" in r["orphan"], r

    with tempfile.TemporaryDirectory() as td2:
        # 地の文の片側だけ欠ける → unpaired に出る（missing とは別に検出する）
        for s in exp:
            if not s.endswith("_r"):
                touch(td2, s)
        r = va.audit(script, td2)
        assert r["unpaired"] == ["n" + va.key_of("音が減っていた")], r

    print("koe_audit_test: OK")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 実行して失敗を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_audit_test.py
```

Expected: `ModuleNotFoundError: No module named 'voice_audit'`

- [ ] **Step 3: 実装する**

`C:\projects\yuichi916.github.io\scripts\koe\voice_audit.py`:

```python
# -*- coding: utf-8 -*-
"""ボイスの棚卸し。改稿のたびに回す。

台本を1文字直すとハッシュが変わり、その台詞は「エラーを出さずに無音になる」。
前作では改稿で足した心内描写161件が全部無音だった。機械的な棚卸しが唯一の防衛線。

本作固有の検査:
  - ren の台詞は v:1 のときだけボイスを期待する（既定は無音）
  - narr は _k / _r の対で存在しなければならない
"""
import json
from pathlib import Path

VOICED = ("kanata", "toki")


def key_of(text):
    """JSの keyOf と同じ32bit符号付きハッシュ。"""
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return "k" + str(h)


def _beats(script):
    for sc in script.get("scenes", []):
        for b in sc.get("beats", []):
            yield b
            for key in ("reply", "beats"):
                for nb in (b.get(key) or []):
                    yield nb
            for ch in (b.get("choose") or []):
                for nb in (ch.get("reply") or []):
                    yield nb


def expected_files(script):
    """台本から期待するボイスファイルの stem 集合を返す。"""
    exp = set()
    for b in _beats(script):
        who, text = b.get("say"), b.get("text")
        if who is None or text is None:
            continue
        if who == "narr":
            k = key_of(text)
            exp.add("n" + k + "_k")
            exp.add("n" + k + "_r")
        elif who == "ren":
            if b.get("v"):
                exp.add("v" + key_of("ren|" + text))
        elif who in VOICED:
            exp.add("v" + key_of(who + "|" + text))
    return exp


def audit(script, voice_dir):
    """欠落・孤児・地の文の片側欠けを返す。"""
    exp = expected_files(script)
    have = {p.stem for p in Path(voice_dir).glob("*.mp3")}
    missing = sorted(exp - have)
    orphan = sorted(have - exp)
    unpaired = sorted({s[:-2] for s in have
                       if s.startswith("n") and s.endswith(("_k", "_r"))
                       and (s[:-2] + ("_r" if s.endswith("_k") else "_k")) not in have})
    return {"missing": missing, "orphan": orphan, "unpaired": unpaired}


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("usage: python voice_audit.py <script.json> <voice_dir>")
        raise SystemExit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        sc = json.load(f)
    r = audit(sc, sys.argv[2])
    print(json.dumps(r, ensure_ascii=False, indent=1))
    ok = not (r["missing"] or r["orphan"] or r["unpaired"])
    print("AUDIT:", "CLEAN" if ok else "DIRTY")
    raise SystemExit(0 if ok else 1)
```

`C:\projects\yuichi916.github.io\scripts\koe\dump_script.mjs`:

```javascript
// 台本JS（window.KOE.epN = {...} を代入するだけのファイル）をJSONに落とす。
// usage: node dump_script.mjs ../../assets/koe/koe-ep1.js > C:/tmp/koe-ep1.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.argv[2]), 'utf8');
const sandbox = { KOE: {} };
new Function('window', src)(sandbox);
const eps = Object.keys(sandbox.KOE);
if (!eps.length) { console.error('window.KOE に何も代入されていない'); process.exit(1); }
process.stdout.write(JSON.stringify(sandbox.KOE[eps[0]], null, 1));
```

- [ ] **Step 4: 実行して合格を確認**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_audit_test.py
```

Expected: `koe_audit_test: OK`

- [ ] **Step 5: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add scripts/koe/voice_audit.py scripts/koe/dump_script.mjs tests/koe_audit_test.py
git commit -m "feat(koe): add script-to-JSON bridge and voice inventory audit"
```

---

## Task 5: エンジン骨格 `koe.html`（seikai から移植）

**Files:**
- Create: `C:\projects\yuichi916.github.io\koe.html`
- Read (移植元): `C:\projects\yuichi916.github.io\seikai.html`

**Interfaces:**
- Consumes: なし
- Produces（以降のタスクが依存する名前）:
  - `const A = 'assets/koe/'`
  - `st` — 状態オブジェクト。`{ep, scene, beat, seen, choices, mem:[], synth:0, firstMain:null, narr:'kanata', round:1, cleared:false}`
  - `function step()` — ビート実行ループ
  - `function el(id)`, `function save()`, `function load()`
  - `function setBG(key)`, `function setCG(key)`, `function playBGM(key)`, `function se(key)`
  - `function showSprite(who,pos,expr)`, `function hideSprite(who)`, `function clearSprites()`
  - `function renderSay(b)`, `function renderChoices(list,meta)`, `function showCard(card)`
  - `function keyOf(text)`, `function voiceFile(who,text,kind)`, `function playVoice(who,text,kind)`, `function stopVoice()`
  - `const CHARS = {kanata, ren, toki, narr}`, `const BGS`, `const BGM`
  - 台本は `window.KOE.ep1` から読む

**移植方針:** `seikai.html` の以下の区画をそのまま持ってきて、固有名詞だけ置換する。**新機能はこのタスクでは足さない**（Task 6以降）。

| seikai.html の行 | 区画 | 扱い |
|---|---|---|
| 1-556 | `<head>`・CSS・DOM骨格 | 移植。`seikai` → `koe`、タイトル・OGPを差し替え |
| 557-617 | 定数・状態・save/load | 移植。`CHARS`/`BGS`/`BGM` を本作の登場人物・場所に差し替え |
| 618-654 | 背景 | そのまま移植（画像が無ければCSSグラデにフォールバックする＝ダミーで通せる） |
| 655-719 | 立ち絵・感情マーク・フリッカー | 移植。フリッカーは残す（残響区の照明に流用） |
| 720-777 | 音・fx・タイプライタ | そのまま移植 |
| 778-861 | 進行（`step`） | 移植。**ビート命令は既存のものだけ。新6命令はTask 6で足す** |
| 862-887 | カード・選択肢 | そのまま移植 |
| 1013-1041 | 3D探索 | そのまま移植 |
| 1188-1231 | 既読/ログ・ボイス・タイトル/開始 | 移植。**`voiceFile` はTask 7で差し替える** |
| 1232-1465 | 入力・セーブスロット・トースト・シェア | 移植。OP(mp4)の区画(1442-1465)は**移植しない**（本作にOPは無い） |
| 1467-1481 | 台本の読み込み | `<script src="assets/koe/koe-ep1.js"></script>` 1本だけにする |
| 1488-1563 | importmap＋three.js全天球 | そのまま移植。`pano-` のプレフィックスは共通 |

`seikai.html` 固有で**移植しないもの**: 地下全図ミニマップ(888-973)、数える暗闇(974-987)、断章ロア(988-1012)、ミニゲーム(1042-1187)、OP mp4(1442-1465)。本作には該当ギミックが無い。

- [ ] **Step 1: 移植元を読む**

`C:\projects\yuichi916.github.io\seikai.html` の 1-1518 行を読み、上の表の区画境界を確認する。

- [ ] **Step 2: `koe.html` を書く**

**Write ツールで書くこと。heredoc を使うと Git Bash が `\\n` を潰してJS文字列を壊す。**

置換する定数（本作固有）:

```javascript
const A='assets/koe/';
const CHARS={
  kanata:{name:'カナタ', color:'#8fd0e8'},
  ren   :{name:'—',      color:'#e8e2d6'},   // セイレン。名前欄はダッシュ
  toki  :{name:'トキ',   color:'#c8b48a'},
  narr  :{name:'',       color:'#9aa6b2'}
};
const BGS={
  void   :{grad:'linear-gradient(#05070a,#0b0f14)'},
  zanky  :{grad:'linear-gradient(#0d1218,#1a2028)'},  // 残響区の路地
  ichiba :{grad:'linear-gradient(#181410,#2a2018)'},  // 市場
  suiro  :{grad:'linear-gradient(#08131a,#12242e)'},  // 水路
  gekijo :{grad:'linear-gradient(#140f16,#241a26)'},  // 旧劇場
  tou    :{grad:'linear-gradient(#0a0a0e,#16161f)'},  // 放送塔
  soko   :{grad:'linear-gradient(#050506,#0e0e12)'}   // 塔の最下層
};
const BGM={
  title:'koe-title', hibi:'koe-hibi', shigoto:'koe-shigoto', deai:'koe-deai',
  tansaku:'koe-tansaku', mizu:'koe-mizu', fuon:'koe-fuon',
  shoutai:'koe-shoutai', kansei:'koe-kansei', ed:'koe-ed'
};
```

`st` の初期形（`startGame` と `startEpisode` の**両方**で同じ形を作ること。片方に新キーを足し忘れると、話をまたいだ時点で状態が消える）:

```javascript
function freshState(keep){
  keep = keep || {};
  return { ep:0, scene:0, beat:0,
    seen: keep.seen||{}, cleared: keep.cleared||false,
    choices:{}, mem:[], synth:0, firstMain:null,
    narr:'kanata', round: keep.round||1 };
}
```

- [ ] **Step 3: 構文チェック**

```
cd C:/projects/yuichi916.github.io
node -e "const fs=require('fs');const h=fs.readFileSync('koe.html','utf8');const m=[...h.matchAll(/<script(?![^>]*src=)(?![^>]*type=\"(?:importmap|application\/ld\+json)\")[^>]*>([\s\S]*?)<\/script>/g)];m.forEach((x,i)=>fs.writeFileSync('C:/tmp/koe_chunk'+i+'.mjs',x[1]));console.log(m.length+' chunks')"
```

続けて各 chunk を `node --check C:/tmp/koe_chunk<i>.mjs`。
Expected: 全 chunk が構文OK

- [ ] **Step 4: 重複宣言チェック**

```
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/koe.html
```

Expected: exit 0

- [ ] **Step 5: ブラウザで起動を確認**

```
cd C:/projects/yuichi916.github.io && python -m http.server 8099
```
別シェルで `http://localhost:8099/koe.html` を開き、タイトル画面が出ること、コンソールにエラーが無いことを確認する（台本はまだ無いので「はじめる」は押さなくてよい）。

- [ ] **Step 6: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add koe.html
git commit -m "feat(koe): port sound novel engine skeleton from seikai"
```

---

## Task 6: 新ビート命令6種

設計書 8-2。`st` に持つ状態と、止まる／止まらないの一貫性がすべて。

**Files:**
- Modify: `C:\projects\yuichi916.github.io\koe.html`（`step()` 内、および新規関数）

**Interfaces:**
- Consumes: Task 5 の `step()`, `st`, `el()`, `save()`, `setCG()`, `A`
- Produces:
  - `function doPickup(b)` — `st.mem` 追加＋記憶絵フラッシュ
  - `function tryVoice()` — `st.synth` に応じた段階音声を再生
  - `function runMontage()` — `st.mem` を加速再生
  - `function playFinalVoice()` — `st.firstMain` から4パターンを選ぶ
  - `function toTitle()` — 2周目解禁してタイトルへ

- [ ] **Step 1: `step()` に分岐を足す**

`if(b.say!=null)` の**手前**に入れる。順序が変わると `say` を持つビートの新命令が無視される。

```javascript
    if(b.pickup){ doPickup(b); return; }
    if(b.tryvoice){ tryVoice(); return; }
    if(b.narrator){ st.narr=b.narrator; save(); continue; }
    if(b.montage){ runMontage(); return; }
    if(b.finalvoice){ playFinalVoice(); return; }
    if(b.title){ toTitle(); return; }
```

- [ ] **Step 2: 実装を書く**

```javascript
/* ---------- 音の採取・合成度 ---------- */
const SYNTH_MAX=4;
function doPickup(b){
  if(st.mem.indexOf(b.pickup)<0) st.mem.push(b.pickup);
  if(b.main){ st.synth=Math.min(SYNTH_MAX, st.synth+1);
              if(!st.firstMain) st.firstMain=b.pickup; }
  save();
  flashMem(b.pickup, 1400, ()=>{ locked=false; step(); });
  locked=true;
}
function flashMem(key, ms, done){
  const e=el('memflash');
  e.style.backgroundImage="url('"+A+key+".jpg')";
  e.classList.add('on');
  setTimeout(()=>{ e.classList.remove('on'); setTimeout(done, 420); }, ms);
}
function tryVoice(){
  const stage=['00','25','50','75','100'][Math.min(SYNTH_MAX, st.synth)];
  const v=el('voice'); locked=true;
  v.src=A+'voice/synth-'+finalKey()+'-s'+stage+'.mp3';
  v.volume=cfg.voice/100;
  const go=()=>{ v.onended=null; v.onerror=null; locked=false; step(); };
  v.onended=go; v.onerror=go;
  v.play().catch(go);
}
function finalKey(){
  // 最初に取った主素材で4パターンに分かれる（設計書 5章「結」）
  const map={'mem-01':'a','mem-07':'b','mem-13':'c','mem-19':'d'};
  return map[st.firstMain]||'a';
}
function runMontage(){
  const list=st.mem.slice(); locked=true;
  let i=0, wait=520;
  const tick=()=>{
    if(i>=list.length){ locked=false; step(); return; }
    flashMem(list[i], wait, ()=>{ i++; wait=Math.max(90, wait*0.82); tick(); });
  };
  tick();
}
function playFinalVoice(){
  const v=el('voice'); locked=true;
  v.src=A+'voice/final-'+finalKey()+'.mp3';
  v.volume=cfg.voice/100;
  const go=()=>{ v.onended=null; v.onerror=null; locked=false; step(); };
  v.onended=go; v.onerror=go;
  v.play().catch(go);
}
function toTitle(){
  st.cleared=true; st.round=Math.max(2,(st.round||1)+1); save();
  stopBGM(); clearSprites(); setCG(null);
  el('title').classList.remove('gone');
}
```

**`onerror` でも必ず先へ進めること。** アセットが欠けたときに進行不能になるのが、このジャンルで最も痛い壊れ方。

- [ ] **Step 3: `#memflash` のCSSを足す**

```css
#memflash{position:absolute;inset:0;z-index:8;opacity:0;pointer-events:none;
  background-size:cover;background-position:center;
  transition:opacity .38s ease;filter:saturate(.55) contrast(1.06)}
#memflash.on{opacity:1}
```
DOMにも `<div id="memflash"></div>` を `#stage` 内、`#evcg` の直後に置く。

- [ ] **Step 4: 構文チェックと重複宣言チェック**

```
node --check C:/tmp/koe_chunk0.mjs
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/koe.html
```
Expected: どちらも exit 0

- [ ] **Step 5: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add koe.html
git commit -m "feat(koe): add pickup/tryvoice/narrator/montage/finalvoice/title beats"
```

---

## Task 7: セイレン無音ガードと地の文2系統

本作の中核ギミック。**既定を「鳴らさない」にして、鳴らす方を明示にする**——逆にすると、指定漏れ1つで仕掛けが崩れる。

**Files:**
- Modify: `C:\projects\yuichi916.github.io\koe.html`（`voiceFile` / `renderSay` 周辺）

**Interfaces:**
- Consumes: Task 5 の `keyOf`, `playVoice`, `stopVoice`, `renderSay`, `st.narr`
- Produces:
  - `voiceFile(who, text, kind)` — `kind==='narr'` のとき `n<hash>_k|_r.mp3`、それ以外は `v<hash>.mp3`
  - `window.__koeVoiceLog` — 再生を試みたファイルの配列（E2E検証用。Task 10が読む）

- [ ] **Step 1: `voiceFile` と `playVoice` を差し替える**

```javascript
function voiceFile(who,text,kind){
  if(kind==='narr') return A+'voice/n'+keyOf(text)+(who==='ren'?'_r':'_k')+'.mp3';
  return A+'voice/v'+keyOf(who+'|'+text)+'.mp3';
}
window.__koeVoiceLog=[];
function playVoice(who,text,kind){
  const v=el('voice'); try{v.pause();}catch(e){}
  if(cfg.voice<=0) return;
  const f=voiceFile(who,text,kind);
  window.__koeVoiceLog.push(f);
  v.src=f; v.volume=cfg.voice/100;
  try{ v.currentTime=0; }catch(e){}
  v.play().catch(()=>{});
}
```

- [ ] **Step 2: `renderSay` のボイス分岐を差し替える**

`seikai.html:829` に相当する1行を、次に置き換える。

```javascript
  if(b.say==='ren'){
    if(b.v) playVoice('ren', b.text);     // 例外：v:1 のときだけ鳴らす
    else stopVoice();                     // 既定：絶対に鳴らさない
  } else if(b.say==='kanata'||b.say==='toki'){
    playVoice(b.say, b.text);
  } else if(b.say==='narr'){
    playVoice(st.narr||'kanata', b.text, 'narr');
  } else {
    stopVoice();
  }
```

- [ ] **Step 3: 名前欄の切り替えを足す**

セイレンは既定で `—`。`v:1` のビートで初めて「セイレン」になる（設計書 8-3）。

```javascript
function nameFor(who,b){
  if(who==='ren') return (b && b.v) ? 'セイレン' : '—';
  return (CHARS[who]||CHARS.narr).name;
}
```
`renderSay` 内の名前欄設定を `nameFor(b.say, b)` に差し替える。
併せて `ren` の台詞には `.saysoft` クラスを付け、CSSで一段小さく・字送りを遅くする。

```css
#adv .saysoft{font-size:.94em;letter-spacing:.06em;opacity:.92}
```
字送りはタイプライタの間隔を `b.say==='ren'` のとき1.6倍にする。

- [ ] **Step 4: 2周目で地の文を切り替える**

`startGame(fresh)` の中、`enterScene()` の直前に置く。

```javascript
  st.narr = (st.round && st.round>=2) ? 'ren' : 'kanata';
```

- [ ] **Step 5: 構文チェックと重複宣言チェック**

```
node --check C:/tmp/koe_chunk0.mjs
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/koe.html
```
Expected: どちらも exit 0

- [ ] **Step 6: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add koe.html
git commit -m "feat(koe): enforce heroine voice silence and dual narration voice tracks"
```

---

## Task 8: タイトル画面のタップゲートと声

設計書 8-4。**autoplayブロックで素通りされると仕掛けが全部死ぬ**ので、導線で確実に聞かせる。

**Files:**
- Modify: `C:\projects\yuichi916.github.io\koe.html`

**Interfaces:**
- Consumes: Task 5 の `el()`, `cfg`, `ensureCtx()`
- Produces:
  - `function openGate()` — タップで `title-koe.mp3` を鳴らし、鳴り終わってからタイトルを出す
  - `window.__koeGate` — `{played:false, ended:false, currentTime:0}`（E2E検証用。Task 10が読む）

- [ ] **Step 1: ゲートのDOMとCSSを足す**

`<body>` 直下の先頭に置く。

```html
<div id="gate"><div id="gatetx">画面をタップ</div></div>
<audio id="titlekoe" preload="auto" src="assets/koe/voice/title-koe.mp3"></audio>
```
```css
#gate{position:fixed;inset:0;z-index:200;background:#000;display:flex;
  align-items:center;justify-content:center;cursor:pointer}
#gatetx{color:#6a7480;font-size:14px;letter-spacing:.5em;
  animation:gblink 2.6s ease-in-out infinite}
@keyframes gblink{0%,100%{opacity:.25}50%{opacity:.8}}
#gate.gone{opacity:0;pointer-events:none;transition:opacity 1.2s}
#title{opacity:0;transition:opacity 1.6s}
#title.ready{opacity:1}
```
`#title` は既定で不可視にし、ゲート通過後に `.ready` を付けて出す。

- [ ] **Step 2: ゲートの実装を書く**

```javascript
window.__koeGate={played:false, ended:false, currentTime:0};
function openGate(){
  const g=el('gate'), a=el('titlekoe');
  ensureCtx(); if(actx&&actx.state==='suspended') actx.resume();
  // この1本だけは音量下限を張る。聞き流させるが、聞こえないのは困る
  a.volume=Math.max(0.20, cfg.voice/100);
  window.__koeGate.played=true;
  const reveal=()=>{
    window.__koeGate.ended=true;
    window.__koeGate.currentTime=a.currentTime||0;
    g.classList.add('gone');
    el('title').classList.add('ready');
    playBGM('title');
  };
  a.onended=reveal;
  a.onerror=reveal;                       // 音が無くても進める
  setTimeout(()=>{ if(!window.__koeGate.ended) reveal(); }, 6000);  // 保険
  a.play().catch(reveal);
}
el('gate').addEventListener('click', openGate, {once:true});
el('gate').addEventListener('touchstart', openGate, {once:true, passive:true});
```

- [ ] **Step 3: 構文チェックと重複宣言チェック**

```
node --check C:/tmp/koe_chunk0.mjs
python C:/tmp/check_dup_const.py C:/projects/yuichi916.github.io/koe.html
```
Expected: どちらも exit 0

- [ ] **Step 4: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add koe.html
git commit -m "feat(koe): add tap gate that guarantees the title voice is heard"
```

---

## Task 9: スタブ台本で通し再生

**エンジンが動く≠物語が読める。** 本編を書く前に、全ビート命令が正しい順で通ることをダミーで確かめる。

**Files:**
- Create: `C:\projects\yuichi916.github.io\assets\koe\koe-ep1.js`

**Interfaces:**
- Consumes: Task 5-8 のビート命令一式
- Produces: `window.KOE.ep1 = {scenes:[...]}` — Task 10 のE2Eが通す台本

- [ ] **Step 1: スタブ台本を書く**

起承転結の骨だけを置く。**本文は仮**だが、**構造は本番と同じ**にする（採取4か所＝主素材4＋記憶片は各所1つに間引く）。

```javascript
window.KOE = window.KOE || {};
window.KOE.ep1 = { scenes: [
  /* --- 起 --- */
  { bg:'zanky', bgm:'hibi', beats:[
    {say:'narr', text:'（仮）音が減っていた。'},
    {show:'kanata', pos:'c'},
    {say:'kanata', text:'（仮）今日も拾いに行く。'},
    {bg:'soko', bgm:'deai'},
    {show:'ren', pos:'r'},
    {say:'ren', text:'（仮）（文字盤を指す）'},
    {say:'kanata', text:'（仮）きみの声、作ってやるよ。'},
    {tryvoice:1},
    {end:1}
  ]},
  /* --- 承：採取4か所 --- */
  { bg:'ichiba', bgm:'tansaku', beats:[
    {pickup:'mem-01', main:1}, {tryvoice:1},
    {pickup:'mem-02'},
    {say:'narr', text:'（仮）市場の音がひとつ減った。'},
    {end:1}
  ]},
  { bg:'suiro', bgm:'mizu', beats:[
    {pickup:'mem-07', main:1}, {tryvoice:1},
    {pickup:'mem-08'},
    {end:1}
  ]},
  { bg:'gekijo', bgm:'fuon', beats:[
    {pickup:'mem-13', main:1}, {tryvoice:1},
    {pickup:'mem-14'},
    {choose:[
      {t:'（仮）先に進む', reply:[{say:'kanata', text:'（仮）行こう。'}]},
      {t:'（仮）少し休む', reply:[{say:'kanata', text:'（仮）少しだけ。'}]}
    ]},
    {end:1}
  ]},
  { bg:'tou', bgm:'fuon', beats:[
    {pickup:'mem-19', main:1}, {tryvoice:1},
    {pickup:'mem-20'},
    {end:1}
  ]},
  /* --- 転 --- */
  { bg:'soko', bgm:'shoutai', beats:[
    {say:'narr', text:'（仮）拾ってきた音は、全部だれかの声だった。'},
    {montage:1},
    {say:'ren', text:'（仮）（後ずさる）'},
    {end:1}
  ]},
  /* --- 結 --- */
  { bg:'soko', bgm:'kansei', beats:[
    {finalvoice:1},
    {say:'ren', text:'（仮）ありがとう', v:1},
    {narrator:'ren'},
    {say:'narr', text:'（仮）——ここから先は、わたしの声で話す。'},
    {bg:'zanky', bgm:'ed'},
    {say:'ren', text:'（仮）——おはよう', v:1},
    {title:1}
  ]}
]};
```

- [ ] **Step 2: 台本をJSONに落として棚卸しを通す**

```
cd C:/projects/yuichi916.github.io/scripts/koe
node dump_script.mjs ../../assets/koe/koe-ep1.js > C:/tmp/koe-ep1.json
set PYTHONUTF8=1 && python voice_audit.py C:/tmp/koe-ep1.json C:/projects/yuichi916.github.io/assets/koe/voice
```
Expected: ボイスが1本も無いので `missing` が全件、`orphan` と `unpaired` は空。**`unpaired` が空であること**をここで確認する（`_k`/`_r` の対の論理が正しく働く前提が取れる）。

- [ ] **Step 3: ブラウザで通し読みする**

```
cd C:/projects/yuichi916.github.io && python -m http.server 8099
```
`http://localhost:8099/koe.html` を開き、タップ → タイトル → 最初から最後まで進め、**タイトル画面に戻ってくる**こと、コンソールにエラーが出ないことを確認する。

- [ ] **Step 4: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add assets/koe/koe-ep1.js
git commit -m "feat(koe): add stub script covering all beat types end to end"
```

---

## Task 10: E2E検証（Playwright）

設計書 10章の「本作固有の必須チェック3つ」を自動化する。

**Files:**
- Create: `C:\projects\yuichi916.github.io\tests\koe_e2e_test.py`

**Interfaces:**
- Consumes: `window.__koeVoiceLog`（Task 7）、`window.__koeGate`（Task 8）、`window.KOE.ep1`（Task 9）
- Produces: なし（最終検証）

- [ ] **Step 1: テストを書く**

`C:\projects\yuichi916.github.io\tests\koe_e2e_test.py`:

```python
# -*- coding: utf-8 -*-
"""koe.html の通し検証。ローカルHTTPを自前で立てて Playwright で回す。

  set PYTHONUTF8=1 && python tests/koe_e2e_test.py
"""
import subprocess, sys, time, socket, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8099
URL = f"http://127.0.0.1:{PORT}/koe.html"


def wait_port(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.4):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    try:
        assert wait_port(PORT), "ローカルHTTPが起動しない"
        with sync_playwright() as pw:
            br = pw.chromium.launch(args=["--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"])
            pg = br.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(URL)
            pg.wait_for_selector("#gate")

            # --- 検証3: タイトルの声が鳴るか ---
            pg.evaluate("document.getElementById('gate').click()")
            pg.wait_for_function("window.__koeGate && window.__koeGate.ended === true",
                                 timeout=12000)
            gate = pg.evaluate("window.__koeGate")
            assert gate["played"] is True, "タイトル声が再生されていない"

            # --- 台本が全ビート型を含むこと（スタブの退化を防ぐ） ---
            kinds = pg.evaluate("""() => {
              const ks = new Set();
              (window.KOE.ep1.scenes||[]).forEach(s=>(s.beats||[]).forEach(b=>
                Object.keys(b).forEach(k=>ks.add(k))));
              return [...ks];
            }""")
            for need in ["pickup", "tryvoice", "narrator", "montage",
                         "finalvoice", "title", "choose"]:
                assert need in kinds, f"台本に {need} ビートが無い"

            # --- 通し再生（選択肢はactionabilityで詰まるのでJSの.click()） ---
            pg.evaluate("window.__koeVoiceLog=[]")
            pg.evaluate("startGame(true)")
            for _ in range(400):
                if pg.evaluate("document.getElementById('title').classList.contains('ready') "
                               "&& !document.getElementById('title').classList.contains('gone')"):
                    break
                pg.evaluate("""() => {
                  const c = document.querySelector('#choices.show .ch');
                  if (c) { c.click(); return; }
                  const a = document.getElementById('adv');
                  if (a) a.click();
                  if (typeof step === 'function' && !window.__locked) {}
                }""")
                pg.wait_for_timeout(120)
            else:
                raise AssertionError("400ステップでエンディングに到達しなかった（進行不能）")

            # --- 検証1: セイレンの無音が守られているか ---
            log = pg.evaluate("window.__koeVoiceLog")
            script = pg.evaluate("window.KOE.ep1")
            import hashlib  # noqa: F401  (未使用。keyOfはJS側で計算させる)
            allowed = pg.evaluate("""() => {
              const out = [];
              (window.KOE.ep1.scenes||[]).forEach(s=>(s.beats||[]).forEach(b=>{
                if (b.say === 'ren' && b.v) out.push(voiceFile('ren', b.text));
              }));
              return out;
            }""")
            ren_calls = [f for f in log if "/v" in f and f not in allowed]
            # ren の無音台詞はそもそも playVoice を通らないので、
            # ren 由来の再生は allowed にしか現れないはず
            leaked = pg.evaluate("""(log) => {
              const bad = [];
              (window.KOE.ep1.scenes||[]).forEach(s=>(s.beats||[]).forEach(b=>{
                if (b.say === 'ren' && !b.v) {
                  const f = voiceFile('ren', b.text);
                  if (log.includes(f)) bad.push(f);
                }
              }));
              return bad;
            }""", log)
            assert leaked == [], f"セイレンの無音が破れている: {leaked}"

            # --- 検証2: 地の文が2系統で参照されているか ---
            narr = [f for f in log if "/n" in f]
            assert narr, "地の文のボイスが1本も参照されていない"
            assert all(f.endswith("_k.mp3") for f in narr), \
                f"1周目なのに _r が参照された: {[f for f in narr if not f.endswith('_k.mp3')]}"

            # --- 2周目: 地の文が _r になる ---
            pg.evaluate("window.__koeVoiceLog=[]")
            pg.evaluate("st.round=2; startGame(true)")
            pg.wait_for_timeout(400)
            for _ in range(40):
                pg.evaluate("(()=>{const a=document.getElementById('adv'); if(a) a.click();})()")
                pg.wait_for_timeout(90)
            narr2 = [f for f in pg.evaluate("window.__koeVoiceLog") if "/n" in f]
            assert narr2, "2周目で地の文が参照されていない"
            assert all(f.endswith("_r.mp3") for f in narr2), \
                f"2周目で _k が参照された: {[f for f in narr2 if not f.endswith('_r.mp3')]}"

            assert errors == [], f"ページエラー: {errors}"
            br.close()
    finally:
        srv.terminate()
    print("koe_e2e_test: OK")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 実行する**

```
set PYTHONUTF8=1 && python C:\projects\yuichi916.github.io\tests\koe_e2e_test.py
```
Expected: `koe_e2e_test: OK`

失敗したら**エンジン側を直す**。テストを緩めない。特に「400ステップでエンディングに到達しなかった」は、`onerror` で先へ進めていないビートがある証拠なので Task 6 に戻る。

- [ ] **Step 3: 全テストを通す**

```
cd C:/projects/yuichi916.github.io
set PYTHONUTF8=1 && python tests/koe_synth_test.py && python tests/koe_kana_test.py && python tests/koe_audit_test.py && python tests/koe_bgm_test.py && python tests/koe_e2e_test.py
```
Expected: 5本すべて `OK`

- [ ] **Step 4: コミット**

```bash
cd C:/projects/yuichi916.github.io
git add tests/koe_e2e_test.py
git commit -m "test(koe): add e2e verification for silence guard, dual narration and title voice"
```

---

## Self-Review 結果

**1. Spec coverage** — 設計書の各節に対応するタスク:

| 設計書 | タスク |
|---|---|
| 7-1 段階合成 | Task 1 |
| 8-1 ファイル構成 | Task 5, 9 |
| 8-2 新ビート命令 | Task 6 |
| 8-3 無音ガード・2系統・名前欄 | Task 7 |
| 8-4 タップゲート | Task 8 |
| 8-5 ボイスパイプライン（整形・棚卸し） | Task 3, 4 |
| 8-9 BGM | Task 2 |
| 10章 必須チェック3つ | Task 10 |
| 9章 フェーズ0（DSP判定） | Task 1 Step 5 |

**未カバー（意図的にスコープ外・別プラン）:** 設計書 7-2/7-3/7-5（SD画像生成）、8-7（reForge）、8-8（Blender背景）、8-6の本番生成、9章フェーズ1（脚本執筆）／フェーズ3・4・6。理由は冒頭に記載のとおり、**台本の凍結が本番アセット生成の前提**であるため。

**2. Placeholder scan** — 「TBD」「後で」「Task Nと同様」は無し。全コードステップに実コードを記載済み。BGMの曲名確定のみ人間の試聴に委ねているが、これは Task 2 で索引を作るところまでを機械化し、確定行為をフェーズ4へ明示的に送っている。

**3. Type consistency** — 確認して修正した箇所:
- `st.mem` / `st.synth` / `st.firstMain` / `st.narr` / `st.round` を Task 5 の `freshState()` で定義し、Task 6・7・9・10 が同名で参照している
- `voiceFile(who, text, kind)` の3引数を Task 5（Produces）・Task 7（実装）・Task 10（E2Eからの呼び出し）で統一
- `flashMem(key, ms, done)` を Task 6 内で `doPickup` と `runMontage` の両方から同じ signature で呼んでいる
- `finalKey()` の `mem-01/07/13/19` は Task 9 のスタブ台本の主素材IDと一致

---

## 次のプラン（このプラン完了後）

**Plan 2: 本編制作（フェーズ1・3・4・5・6）** — 脚本執筆（地の文の二重読みチェック表つき）、SD立ち絵32＋記憶絵24、Blender背景12、ElevenLabs本番ボイス281本＋段階合成、whisper QA、公開。
Plan 1 の Task 9 のスタブ台本が本編に置き換わり、Task 4 の棚卸しと Task 10 のE2Eがそのまま本番の品質ゲートになります。
