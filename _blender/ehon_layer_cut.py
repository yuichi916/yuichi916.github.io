"""SD水彩の全景を距離マスクで深度レイヤーに切り出す(世界別)。
   python ehon_layer_cut.py [world]
   入力: C:\\tmp\\ehon\\<world>_watercolor.png (RGB全景)
         C:\\tmp\\ehon\\<world>_mask_{far,mid,fore}.png (RGBA, alpha=各深度シルエット)
   出力: C:\\tmp\\ehon\\<world>_{far,mid,fore}.png (RGBA・各帯を水彩から切出し)
   本ステージの上に乗せるので sky 層は作らない(SD背景は捨てる)。
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

WORLD = sys.argv[1] if len(sys.argv) > 1 else 'enchanted'
D = r'C:\tmp\ehon'
wc = Image.open(D + rf'\{WORLD}_watercolor.png').convert('RGB')
W, H = wc.size
wc = np.asarray(wc).astype(np.float32) / 255.0


def load_mask(band):
    m = Image.open(D + rf'\{WORLD}_mask_{band}.png').convert('RGBA').resize((W, H))
    return np.asarray(m).astype(np.float32)[..., 3] / 255.0


def feather(a, dilate=2, blur=1.5):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    if dilate:
        img = img.filter(ImageFilter.MaxFilter(dilate * 2 + 1))
    img = img.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(img).astype(np.float32) / 255.0


far = load_mask('far'); mid = load_mask('mid'); fore = load_mask('fore')
# 排他化(手前優先)
mid = np.clip(mid - fore, 0, 1)
far = np.clip(far - fore - mid, 0, 1)

for band, m in (('far', far), ('mid', mid), ('fore', fore)):
    a = feather(m, dilate=2, blur=1.5)
    rgba = np.concatenate([wc, a[..., None]], -1)
    Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA').save(D + rf'\{WORLD}_{band}.png')
    print('LAYER', WORLD, band)

print('LAYER_CUT_DONE', WORLD, W, H)
