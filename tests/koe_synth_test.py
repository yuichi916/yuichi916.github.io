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

        # 75%: ピッチ揺らぎが実際にかかっている（drop+quantizeだけに退化していないか）
        # librosa.effects.pitch_shift が例外で握りつぶされて無効化されても、
        # d75<d50 など他のどのアサーションもそれを検知できない
        # （drop+quantizeだけのほうがむしろ元に近くなり通ってしまう）。
        # 同じrng消費順序でpitch shiftなし版を計算し、実際のs75と
        # 有意に異なることを直接確認する。
        rng_ref = np.random.default_rng(0)
        ss.stage_breath(y_src, rng_ref)
        ss.stage_grain(y_src, rng_ref)
        ss.stage_fragment(y_src, rng_ref)
        ref_no_pitch = ss.stage_broken(y_src, rng_ref, pitch=False)
        d_pitch = float(np.mean((s75[:n] - ref_no_pitch[:n]) ** 2))
        assert d_pitch > 2e-3, \
            f"75%にピッチ揺らぎがかかっていない（drop+quantizeだけに退化） d_pitch={d_pitch:.5f}"

        # 100%: 正規化した元と一致
        assert np.allclose(s100[:n], ss._norm(y_src)[:n], atol=2e-3), "100%が元と一致しない"

        # 決定論性：同じseedで同じ出力
        again = ss.render(str(src), str(td / "out2"), seed=0)
        a = librosa.load(str(again[1]), sr=ss.SR, mono=True)[0]
        assert np.allclose(a[:n], s25[:n], atol=2e-3), "同じseedで出力が変わる"

    print("koe_synth_test: OK")


if __name__ == "__main__":
    main()
