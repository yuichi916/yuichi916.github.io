import numpy as np
from PIL import Image, ImageFilter

H, W = 560, 480
rng = np.random.default_rng(11)

def noise(scale):
    h = max(2, H // scale); w = max(2, W // scale)
    n = rng.random((h, w))
    return np.asarray(Image.fromarray((n * 255).astype('uint8')).resize((W, H), Image.BICUBIC), dtype=float) / 255.0

fbm = np.zeros((H, W)); amp = 1.0; tot = 0.0
for s in (60, 30, 15, 8):
    fbm += amp * noise(s); tot += amp; amp *= 0.5
fbm /= tot

yy, xx = np.mgrid[0:H, 0:W].astype(float)
ny = yy / (H - 1); nx = (xx - (W - 1) / 2) / ((W - 1) / 2)
up = 1.0 - ny

sway = (fbm - 0.5) * 0.38 * up
halfw = 0.92 * (1.0 - up * 0.82) + 0.04
core = np.clip(1.0 - np.abs(nx - sway) / np.maximum(halfw, 1e-3), 0, 1)
height_mask = np.clip((0.80 - up) / 0.80, 0, 1) ** 0.6
vbright = np.clip(1.3 - up * 1.5, 0, 1)

raw = core * (0.6 + 0.75 * fbm) * height_mask
inten = np.clip((raw - 0.20) / 0.66, 0, 1)

# saturated deep red -> orange -> yellow -> white-hot (white only low & central)
c_red = np.array([0.80, 0.03, 0.0]); c_or = np.array([1.0, 0.30, 0.0])
c_yl = np.array([1.0, 0.78, 0.12]);  c_wh = np.array([1.0, 0.95, 0.72])
def lerp(a, b, t): return a + (b - a) * t[..., None]
heat = np.clip(inten * (0.4 + 1.0 * vbright), 0, 1)
col = lerp(c_red, c_or, np.clip(heat / 0.30, 0, 1))
col = lerp(col, c_yl, np.clip((heat - 0.30) / 0.34, 0, 1))
col = lerp(col, c_wh, np.clip((heat - 0.76) / 0.24, 0, 1))

# opaque body, only the ragged edges / tips translucent
alpha = np.clip(inten * 2.2, 0, 1)
alpha[inten < 0.04] = 0.0

rgba = np.zeros((H, W, 4))
rgba[..., :3] = np.clip(col, 0, 1); rgba[..., 3] = alpha
im = Image.fromarray((rgba * 255).astype('uint8'), 'RGBA').filter(ImageFilter.GaussianBlur(0.5))
im.save(r'C:\tmp\flame.png')

# preview over a dark background (how it will actually read at night)
bg = Image.new('RGBA', (W, H), (12, 14, 20, 255))
prev = Image.alpha_composite(bg, im)
prev.save(r'C:\tmp\flame_preview.png')
print('wrote', im.size)
