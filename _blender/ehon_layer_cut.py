"""SD水彩の全景画を、Blenderの距離グループ・マスクで深度レイヤーに切り出す。
   python ehon_layer_cut.py
   入力: C:\\tmp\\ehon\\A_watercolor.png (RGB全景)
         C:\\tmp\\ehon\\A_mask_{far,mid,fore}.png (RGBA, alpha=各深度のシルエット)
   出力: C:\\tmp\\ehon\\A_layer_sky.png  (RGB全景・被写体を空グラデで埋めた背景)
         C:\\tmp\\ehon\\A_layer_{far,mid,fore}.png (RGBA・各帯を水彩から切出し)
   SDが構図を保つ前提。被写体外形の微ズレは羽根ぼかし+膨張で吸収。
"""
import numpy as np
from PIL import Image, ImageFilter

D = r'C:\tmp\ehon'
wc = Image.open(D + r'\A_watercolor.png').convert('RGB')
W, H = wc.size
wc = np.asarray(wc).astype(np.float32) / 255.0


def load_mask(band):
    m = Image.open(D + rf'\A_mask_{band}.png').convert('RGBA').resize((W, H))
    a = np.asarray(m).astype(np.float32)[..., 3] / 255.0
    return a


def feather(a, dilate=2, blur=2.0):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    if dilate:
        img = img.filter(ImageFilter.MaxFilter(dilate * 2 + 1))
    img = img.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(img).astype(np.float32) / 255.0


far = load_mask('far')
mid = load_mask('mid')
fore = load_mask('fore')
# 排他化(手前優先): fore > mid > far の順で帯を奪い合う
mid = np.clip(mid - fore, 0, 1)
far = np.clip(far - fore - mid, 0, 1)
subject = np.clip(far + mid + fore, 0, 1)

# ── 空背景: 被写体領域を上部の空グラデで埋める ──
sky_cols = wc[:max(4, H // 12), :, :].mean(axis=0, keepdims=True)  # 上部帯の平均色(横方向の空)
yy = np.linspace(0, 1, H)[:, None, None]
top = wc[:4].mean(axis=(0, 1))
# 縦グラデ: 上=実空色, 下=やや暖色
sky = top[None, None, :] * (1 - yy * 0.15) + np.array([0.97, 0.95, 0.90]) * (yy * 0.15)
sky = np.broadcast_to(sky, (H, W, 3)).copy()
sky = sky * 0.6 + np.broadcast_to(sky_cols, (H, W, 3)) * 0.4
sub_f = feather(subject, dilate=3, blur=6.0)[..., None]
sky_layer = wc * (1 - sub_f) + sky * sub_f
Image.fromarray((np.clip(sky_layer, 0, 1) * 255).astype(np.uint8), 'RGB').save(D + r'\A_layer_sky.png')
print('LAYER sky')

# ── 各深度帯: 水彩からアルファ切出し ──
for band, m in (('far', far), ('mid', mid), ('fore', fore)):
    a = feather(m, dilate=2, blur=1.5)
    rgba = np.concatenate([wc, a[..., None]], -1)
    Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA').save(D + rf'\A_layer_{band}.png')
    print('LAYER', band)

print('LAYER_CUT_DONE', W, H)
