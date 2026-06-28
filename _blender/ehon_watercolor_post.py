"""水彩ポスト処理 (決定論的・非AI)。Blenderのクリーン透過レンダを絵本水彩調にする。
   python ehon_watercolor_post.py <input.png> <output.png> [full|layer]
   - full : 透過被写体を紙/空グラデ背景に合成し、ウェットエッジ付与 (Task2 ヒーロー画)
   - layer: アルファ保持のまま水彩化 (Task3 深度レイヤー)
   依存: Pillow, numpy。紙テクスチャ C:\\tmp\\ehon\\paper.png を使用。
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

INP = sys.argv[1]
OUTP = sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else 'full'
PAPER = r'C:\tmp\ehon\paper.png'

im = Image.open(INP).convert('RGBA')
W, H = im.size
arr = np.asarray(im).astype(np.float32) / 255.0
rgb = arr[..., :3]
alpha = arr[..., 3:4]


def to_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def soft_light(base, blend):
    b = np.clip(base, 0, 1)
    a = np.clip(blend, 0, 1)
    return np.where(a < 0.5, 2 * a * b + b * b * (1 - 2 * a),
                    2 * b * (1 - a) + np.sqrt(b) * (2 * a - 1))


# 1. ウォッシュ平坦化: メディアン強め + ポスタライズで水彩の色面をつくる
med = np.asarray(to_img(rgb).filter(ImageFilter.MedianFilter(7))).astype(np.float32) / 255.0
wash = rgb * 0.30 + med * 0.70
# ポスタライズ(段階化)で平らな水彩パッチに
LEVELS = 10
wash = np.round(wash * LEVELS) / LEVELS

# 2. にじみ: ガウスを混合(色がにじむ)
blur = np.asarray(to_img(wash).filter(ImageFilter.GaussianBlur(1.6))).astype(np.float32) / 255.0
wash = wash * 0.6 + blur * 0.4

# 3. 彩度UP + 暖色 + 明るく(絵本の鮮やかな水彩)
lum = (wash * np.array([0.299, 0.587, 0.114])).sum(-1, keepdims=True)
wash = lum + (wash - lum) * 1.35              # 彩度+35%
wash = wash * np.array([1.06, 1.0, 0.92])     # 金色寄りの暖色
wash = np.clip((wash - 0.5) * 1.12 + 0.5, 0, 1)  # 軽いコントラスト
wash = np.clip(wash * 1.06 + 0.03, 0, 1)         # 持ち上げ

# 4. インク線: 輝度Sobel + 膨張で太く濃い絵本輪郭線
gl = (wash * np.array([0.299, 0.587, 0.114])).sum(-1)
gx = np.zeros_like(gl); gy = np.zeros_like(gl)
gx[:, 1:-1] = gl[:, 2:] - gl[:, :-2]
gy[1:-1, :] = gl[2:, :] - gl[:-2, :]
edge = np.sqrt(gx * gx + gy * gy)
edge = np.clip((edge - 0.03) / 0.16, 0, 1)
# 被写体内部のみ(透過部の縁ノイズを抑制) — アルファ収縮マスク
a_erode = np.asarray(to_img(alpha[..., 0]).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255.0
edge = edge * a_erode
# 膨張(線を太く)
edge = np.asarray(to_img(edge).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255.0
ink = edge[..., None]
ink_color = np.array([0.16, 0.12, 0.09])
wash = wash * (1 - ink * 0.85) + ink_color * (ink * 0.85)

# 5. 紙テクスチャ: SOFT_LIGHT + 軽い乗算で紙肌の凹凸
paper = np.asarray(Image.open(PAPER).convert('RGB').resize((W, H))).astype(np.float32) / 255.0
wash = wash * 0.78 + soft_light(wash, paper) * 0.22
wash = wash * (1 - 0.06) + (wash * paper) * 0.06
wash = np.clip(wash, 0, 1)

if MODE == 'full':
    # 紙/空グラデ背景
    yy = np.linspace(0, 1, H)[:, None, None]
    sky_top = np.array([0.86, 0.90, 0.93])
    sky_bot = np.array([0.97, 0.94, 0.87])
    bg = sky_top * (1 - yy) + sky_bot * yy
    bg = bg * 0.9 + soft_light(bg, paper) * 0.1
    # 被写体の外側に淡い顔料のにじみ環(ウェットエッジ)
    a_blur = np.asarray(to_img(alpha[..., 0]).filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255.0
    ring = np.clip(a_blur - alpha[..., 0], 0, 1)[..., None]
    out = bg * (1 - alpha) + wash * alpha
    out = out * (1 - ring * 0.22) + np.array([0.34, 0.28, 0.22]) * (ring * 0.22)
    out_img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGB')
else:  # layer: アルファ保持
    out = np.concatenate([wash, alpha], -1)
    out_img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA')

out_img.save(OUTP)
print('WATERCOLOR_DONE', MODE, W, H)
