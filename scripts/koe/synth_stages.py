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
    """0%: スペクトル包絡だけ残してノイズ励振に差し替え、強LPF＋広帯域の呼気ノイズ床。

    フォルマント包絡はLPF側（3kHz以下）に残すが、"呼気"は本来3kHz以上にも
    薄く伸びる広帯域ノイズなので、LPF後に-24dBの白色ノイズ床を足す。
    これがないとLPFが全帯域を強く狭め、spectral flatnessが逆に下がる
    （少数の低域ビンに集中＝ピーキーに見える）ため、意図（無声化=フラット化）
    と矛盾する。ノイズ床はhi/loの3kHz境界比を壊さない程度に薄くしてある。
    """
    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP))
    # 周波数方向に平滑化して倍音構造を潰す（フォルマントは残る）
    kern = np.ones(9, dtype=np.float32) / 9.0
    S = np.apply_along_axis(lambda c: np.convolve(c, kern, mode="same"), 0, S)
    noise = rng.standard_normal(len(y)).astype(np.float32)
    Nz = librosa.stft(noise, n_fft=N_FFT, hop_length=HOP)
    out = librosa.istft(S * np.exp(1j * np.angle(Nz)), hop_length=HOP, length=len(y))
    sos = butter(6, 3000.0 / (SR / 2), btype="low", output="sos")
    filtered = sosfilt(sos, out).astype(np.float32)
    floor_amp = 10 ** (-24.0 / 20.0) * float(np.sqrt(np.mean(filtered ** 2)))
    breath_floor = rng.standard_normal(len(y)).astype(np.float32) * floor_amp
    return _norm((filtered + breath_floor).astype(np.float32))


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


PITCH_SHIFT_MIN_LEN = 2048  # librosa.effects.pitch_shift の内部 stft (time_stretch
# 経由) は n_fft をこちらから渡していないため既定値 2048 が使われる
# (librosa 0.11.0 の time_stretch/stft の実ソースで確認済み)。それより短い
# 入力はSTFTのパディングで著しく劣化するので、この長さ未満のフレームだけを
# 「シフトしない」対象とする。それ以外の失敗（API変更・依存の欠落等）は
# 握りつぶさず伝播させる — 全フレームで失敗してもテストが気付けない
# 沈黙した劣化を避けるため。


def stage_broken(y, rng, drop=0.15, frame_ms=120, cents=15.0, bits=7, pitch=True):
    """75%: 15%を欠落、±15centのピッチ揺らぎ、7bit量子化。片言になる。

    cents=40だとphase vocoder（librosa.effects.pitch_shift）のフレーム間
    位相ずれが支配的な誤差源になり、50%（半分をノイズ置換）より元から
    遠くなってしまい「回復していく」という設計の核（d75<d50<d25）を破る。
    ±15centは可聴なピッチ揺らぎを残しつつ、この破綻を避けられる上限。

    pitch=False はテスト専用のフック。ピッチ揺らぎ抜き（drop+quantizeのみ）
    の参照波形を、同じrng消費順序で計算するために使う
    （tests/koe_synth_test.py の劣化検知アサーション参照）。
    """
    f = max(1, int(SR * frame_ms / 1000))
    out = np.zeros_like(y)
    for s in range(0, len(y), f):
        seg = y[s:s + f]
        if len(seg) == 0:
            continue
        if rng.random() < drop:
            continue  # 欠落
        n_steps = float(rng.uniform(-cents, cents)) / 100.0
        if pitch and len(seg) >= PITCH_SHIFT_MIN_LEN:
            seg = librosa.effects.pitch_shift(y=seg.astype(np.float32), sr=SR, n_steps=n_steps)
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
    """テスト用の決定論的な「声らしい」信号（倍音＋音節エンベロープ）。

    音節ごとにピッチと倍音バランスを変える（実際の発話は音節間で音色が
    変わる）。単一の定常トーンだと、どこを切り取っても同じ波形なので
    グラニュラー並べ替え（stage_grain）が並べ替えても元との相関がほとんど
    落ちず、「音素は出るが言葉にならない」を検証できない。音節ごとに
    音色を変えることで、実声に近い「並べ替えると別物に聞こえる」性質を
    テスト信号に持たせる。
    """
    rng = np.random.default_rng(seed)
    n = int(sr * dur)
    n_syl = max(3, round(dur / 0.22))
    bounds = np.linspace(0, n, n_syl + 1).astype(int)
    sig = np.zeros(n, dtype=np.float64)
    for si in range(n_syl):
        a, b = bounds[si], bounds[si + 1]
        seg_n = b - a
        if seg_n <= 0:
            continue
        tt = np.arange(seg_n) / sr
        f0_syl = f0 * float(rng.uniform(0.8, 1.35))
        seg = np.zeros(seg_n, dtype=np.float64)
        for k in range(1, 13):
            amp_k = (1.0 / k) * float(rng.uniform(0.5, 1.5))
            seg += amp_k * np.sin(2 * np.pi * f0_syl * k * tt + rng.uniform(0, 2 * np.pi))
        sig[a:b] = seg * np.hanning(seg_n)
    sig = (sig / (float(np.max(np.abs(sig))) + 1e-9) * 0.8).astype(np.float32)
    sf.write(str(path), sig, sr, subtype="FLOAT")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("usage: python synth_stages.py <src.wav> <out_dir> [seed]")
        raise SystemExit(2)
    s = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    for p in render(sys.argv[1], sys.argv[2], seed=s):
        print(p)
