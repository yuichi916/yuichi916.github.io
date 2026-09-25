# -*- coding: utf-8 -*-
"""絵本の頁ごとの「世界の空気」: 画面全体の背景 (Pillow + numpy)。

めくった頁の作品の世界が、本の外まであふれて見えるように、画面全体の背景をその作品の景色にする。
- 作品の絵があるもの (正解の外側・ことつぎの星・百の悪行・一人旅・森の小屋) は、その絵を大きくぼかし、暗く沈めて
  遠くの景色にする (飛び出しのカードと同じ場所が、ピントの外に広がる)
- 絵のないもの (音楽の宇宙・キューブ・将棋ぷよ・アトラス・動画の作り方・ひとり歓迎マップ・浮遊島・目次) は、
  作品の画面の色 (実際のページの色) で描く
- どれも、本と飛び出しと文字が主役になるよう、周りを沈め (ヴィネット)、飛び出しの立つ上の真ん中に作品の色の光をため、
  なめらかな階調に細かな粒を混ぜて (圧縮の縞が出ないように)、960x540 の WebP (約 10〜40KB) にする
出力: _ehon_assets/ehon/ambience/bg_<id>_v1.webp
      _ehon_assets/ehon/pages/page_henshu_v1.webp (見開きの挿絵)
usage: python _blender/ehon4_ambience.py [ids...]
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_ehon_assets', 'ehon', 'ambience')
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 720
TABI = 'P:\\Public Folder\\hitoritabi\\'
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
U, V = (xx + 0.5) / W, (yy + 0.5) / H


def col(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def vgrad(top, bottom, curve=1.0):
    t = V[..., None] ** curve
    return col(top) * (1 - t) + col(bottom) * t


def glow(img, c, cx, cy, rx, ry, amt, mode='add'):
    """楕円の光だまり (中心 cx,cy・半径 rx,ry は画面の割合)"""
    d = np.sqrt(((U - cx) / rx) ** 2 + ((V - cy) / ry) ** 2)
    g = np.exp(-d * d * 1.6)[..., None] * amt
    return img + g * col(c) if mode == 'add' else img * (1 - g) + g * col(c)


def vignette(img, amt=0.6, inner=0.55, outer=1.25):
    d = np.sqrt(((U - 0.5) / 0.62) ** 2 + ((V - 0.46) / 0.62) ** 2)
    return img * (1 - amt * ss(inner, outer, d))[..., None]


def noise(sigma, seed, shape=(H, W)):
    n = gaussian_filter(np.random.default_rng(seed).random(shape).astype(np.float32), sigma)
    return (n - n.min()) / (n.max() - n.min() + 1e-6)


def stars(img, n, seed, bright=0.9, colors=('#ffffff', '#cfe0ff', '#ffe7c4'), region=None):
    rng = np.random.default_rng(seed)
    out = img.copy()
    for _ in range(n):
        x, y = rng.random() * W, rng.random() * H
        if region is not None and not region(x / W, y / H):
            continue
        r = 0.6 + rng.random() ** 3 * 1.8
        b = bright * (0.25 + rng.random() ** 2 * 0.75)
        c = col(colors[rng.integers(len(colors))])
        x0, x1, y0, y1 = int(max(0, x - 4)), int(min(W, x + 5)), int(max(0, y - 4)), int(min(H, y + 5))
        d2 = (xx[y0:y1, x0:x1] - x) ** 2 + (yy[y0:y1, x0:x1] - y) ** 2
        out[y0:y1, x0:x1] += (np.exp(-d2 / (2 * r * r)) * b)[..., None] * c
    return out


def finish(img, name, grain=0.012, seed=3):
    img = img + np.random.default_rng(seed).normal(0, grain, img.shape[:2])[..., None].astype(np.float32)
    im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((960, 540), Image.LANCZOS)
    p = os.path.join(OUT, f'bg_{name}_v1.webp')
    im.save(p, 'WEBP', quality=80, method=6)
    print(f'bg_{name}_v1.webp {os.path.getsize(p) // 1024}KB  mean={np.asarray(im).mean() / 255:.2f}')


def photo(path, center=(0.5, 0.5), blur=18, expo=0.55, sat=0.85, lift='#000000', lift_amt=0.0):
    """作品の絵を画面いっぱいに広げ、大きくぼかして遠くの景色にする"""
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im = ImageOps.fit(im, (W, H), Image.LANCZOS, centering=center)
    im = im.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im).astype(np.float32) / 255
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = lum + (a - lum) * sat
    a = a * expo
    return a + col(lift) * lift_amt * (1 - a)


# ---- 頁ごと ----
def library():
    """目次とおしまい: 夜の書斎。左右の書棚の影、本の奥にろうそくの灯り"""
    img = vgrad('#1b1526', '#0f0a09', 1.1)
    shelves = np.zeros((H, W), np.float32)
    for x0 in list(range(0, 330, 46)) + list(range(950, W, 46)):
        shelves[:, x0:x0 + 36] = 1
    for y0 in range(40, H, 118):
        shelves[y0:y0 + 10, :] = 0.2
    shelves = gaussian_filter(shelves, 6) * (1 - ss(0.2, 0.42, np.abs(U - 0.5)))
    img = img * (1 - 0.35 * shelves[..., None]) + shelves[..., None] * col('#2a1c14') * 0.25
    img = glow(img, '#ffb35c', 0.5, 0.52, 0.34, 0.32, 0.22)
    img = glow(img, '#ffd79a', 0.5, 0.45, 0.12, 0.14, 0.10)
    return vignette(img, 0.65)


def seikai():
    """正解の外側: 物語の出だし「地下のいちばん底」のトンネル。奥に青い光 (外へ・空へ)、金の道筋の光"""
    img = photo(os.path.join(ROOT, 'assets', 'seikai', 'bg-ruins.jpg'), (0.5, 0.42), blur=14, expo=0.7, sat=0.9)
    img = glow(img, '#f0c46a', 0.5, 0.36, 0.30, 0.26, 0.10)
    return vignette(img, 0.6)


def kototsugi():
    img = photo(os.path.join(ROOT, 'kototsugi', 'game', 'assets', 'cg', 'key_visual.png'), (0.5, 0.42), blur=24, expo=0.72, sat=0.95)
    img = glow(img, '#ff9a55', 0.5, 0.58, 0.45, 0.16, 0.10)   # 水平線の夕焼け
    img = stars(img, 120, 21, 0.55, region=lambda x, y: y < 0.42)
    return vignette(img, 0.6)


def hyaku():
    img = photo(os.path.join(ROOT, 'assets', 'hyaku', 'img', 'bg_castle.jpg'), (0.5, 0.4), blur=15, expo=0.6, sat=0.55)
    img = img * col('#c8d2ea')   # 月の光の青
    img = glow(img, '#e9f0ff', 0.5, 0.18, 0.22, 0.16, 0.10)
    img = glow(img, '#8a1c22', 0.5, 0.9, 0.5, 0.2, 0.08)   # 足もとに、嘘の判の赤
    return vignette(img, 0.66)


def salon():
    """音楽の宇宙: 深い宇宙。紫と青の星雲、たくさんの星"""
    img = vgrad('#060714', '#0a0b1f', 1.0)
    n1, n2 = noise(60, 1), noise(28, 2)
    neb = np.clip((n1 - 0.45) * 2.2, 0, 1) * (0.6 + 0.4 * n2)
    img += neb[..., None] * (col('#4b2c8a') * 0.35 * (1 - U[..., None]) + col('#1d4f8f') * 0.35 * U[..., None])
    img = glow(img, '#b58cff', 0.5, 0.36, 0.40, 0.30, 0.10)
    img = glow(img, '#ffd89a', 0.5, 0.36, 0.10, 0.08, 0.06)
    img = stars(img, 900, 5, 0.95)
    return vignette(img, 0.55)


def sudoku():
    """ルーン・キューブ: 紫の魔法の夜。キューブの 4 色が遠くのオーロラに"""
    img = vgrad('#130a24', '#1c0f33', 1.0)
    for c, cx, cy in (('#e63329', 0.2, 0.3), ('#2f7bef', 0.8, 0.28), ('#27b34a', 0.32, 0.62), ('#a16a2c', 0.72, 0.64)):
        img = glow(img, c, cx, cy, 0.28, 0.2, 0.07)
    img = glow(img, '#9b6bff', 0.5, 0.38, 0.34, 0.30, 0.16)
    # 魔法陣の輪 (細い線をぼかして)
    ring = np.zeros((H, W), np.float32)
    rr = np.sqrt(((xx - W * 0.5) / 1.0) ** 2 + ((yy - H * 0.38) / 0.42) ** 2)
    for r0 in (250, 262, 330):
        ring += np.exp(-((rr - r0) ** 2) / 8)
    img += gaussian_filter(ring, 1.5)[..., None] * col('#c9a7ff') * 0.10
    img = stars(img, 260, 9, 0.6, colors=('#ffffff', '#e6d9ff'))
    return vignette(img, 0.6)


def shogi():
    """将棋ぷよ: 作品の顔 (サムネ) と同じ、黒い漆に金の渦と金の粒、桜色のぼけ"""
    img = vgrad('#0d0806', '#120a06', 1.0)
    sw = np.zeros((H, W), np.float32)
    for cx, cy, r0, a0, a1 in ((0.22, 0.3, 330, 3.6, 5.6), (0.8, 0.26, 360, 3.9, 6.1), (0.5, 0.95, 520, 3.4, 6.0), (0.12, 0.8, 260, 4.6, 6.8)):
        th = np.arctan2(yy - H * cy, xx - W * cx) % (2 * np.pi)
        on = ((th - a0) % (2 * np.pi)) < (a1 - a0)
        rr = np.sqrt((xx - W * cx) ** 2 + (yy - H * cy) ** 2)
        for k in range(4):
            sw += np.exp(-((rr - (r0 + k * 22)) ** 2) / (2 * (1.6 + k) ** 2)) * on * (0.9 - 0.18 * k)
    sw = gaussian_filter(sw, 1.4)
    img += sw[..., None] * col('#d9a441') * 0.16
    rng = np.random.default_rng(31)
    bok = np.zeros((H, W, 3), np.float32)
    for _ in range(46):
        x, y, r = rng.random() * W, rng.random() * H, 3 + rng.random() ** 3 * 16
        c = col('#f2c46a' if rng.random() < 0.75 else '#f3a6b8')
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2)
        bok += (ss(r, r - 2, d) * (0.10 + 0.25 * rng.random()))[..., None] * c
    img += gaussian_filter(bok, (1.2, 1.2, 0))
    img = glow(img, '#d9a441', 0.5, 0.3, 0.36, 0.28, 0.16)
    img = glow(img, '#e2522b', 0.5, 0.78, 0.4, 0.18, 0.06)
    return vignette(img, 0.62)


def aimap():
    """AI能力アトラス: 明るい紙の地図 (ai-map.html の生成りと段の色)。遠くにツリーマップのマス"""
    img = vgrad('#f1e9da', '#e2d4bb', 1.0)
    rng = np.random.default_rng(4)
    tiles = np.zeros((H, W, 3), np.float32)
    LV = ['#d9e2e7', '#f5e5d0', '#e9c397', '#d8955c', '#bf5a2d', '#6b2412']

    def split(x0, y0, x1, y1, depth):
        if depth == 0 or (x1 - x0) * (y1 - y0) < 2600:
            lv = min(5, int(rng.random() ** 0.8 * 6 * (0.4 + 0.8 * ((x0 + x1) / 2 / W))))
            tiles[int(y0) + 2:int(y1) - 2, int(x0) + 2:int(x1) - 2] = col(LV[lv])
            return
        if (x1 - x0) > (y1 - y0):
            m = x0 + (x1 - x0) * (0.3 + rng.random() * 0.4); split(x0, y0, m, y1, depth - 1); split(m, y0, x1, y1, depth - 1)
        else:
            m = y0 + (y1 - y0) * (0.3 + rng.random() * 0.4); split(x0, y0, x1, m, depth - 1); split(x0, m, x1, y1, depth - 1)
    split(0, 0, W, H, 9)
    tiles = gaussian_filter(tiles, (9, 9, 0))
    mask = ss(0.12, 0.5, np.abs(U - 0.5))[..., None] * 0.4 + 0.08   # 真ん中 (本と飛び出し) は薄く
    img = img * (1 - mask) + tiles * mask
    img = glow(img, '#fff8ec', 0.5, 0.4, 0.34, 0.32, 0.25, mode='mix')
    return vignette(img, 0.42, 0.6, 1.3) * col('#fbf4ea')


def henshu():
    """動画の作り方: 夜の編集室。サンプルの画面と同じ紺 (#0f172a → #1e3a8a) に、黄色 (#facc15) の光。
    奥に、1 コマずつ並ぶフィルムの帯と、音の波形がぼんやり"""
    a = np.deg2rad(160)
    t = np.clip((U - 0.5) * np.sin(a) * 1.2 - (V - 0.5) * np.cos(a) * 1.2 + 0.5, 0, 1)[..., None]
    img = col('#0b1224') * (1 - t) + col('#1a3275') * t
    strip = np.zeros((H, W), np.float32)
    for k in range(-1, 15):
        x = 40 + k * 96
        strip[int(H * 0.16):int(H * 0.16) + 54, x:x + 80] = 1   # コマ
    strip = gaussian_filter(strip, 3) * 0.10
    wave = np.zeros((H, W), np.float32)
    rng = np.random.default_rng(12)
    for i, x in enumerate(range(0, W, 8)):
        h = (0.3 + 0.7 * rng.random()) * (0.5 + 0.5 * np.sin(i * 0.21)) * 60
        wave[int(H * 0.8 - h):int(H * 0.8 + h), x:x + 5] = 1
    wave = gaussian_filter(wave, 2.5) * 0.08
    img += strip[..., None] * col('#cbd5e1') + wave[..., None] * col('#facc15')
    img = glow(img, '#facc15', 0.5, 0.34, 0.30, 0.26, 0.12)
    img = glow(img, '#60a5fa', 0.14, 0.4, 0.3, 0.4, 0.07)
    return vignette(img, 0.62)


def hitori():
    """ひとり歓迎マップ: 夕暮れの町。遠くの灯りのぼけ (琥珀・朱・青緑)"""
    img = vgrad('#141a2e', '#2a1c18', 1.2)
    img = glow(img, '#f2a65a', 0.5, 0.78, 0.6, 0.25, 0.14)
    rng = np.random.default_rng(8)
    bok = np.zeros((H, W, 3), np.float32)
    for _ in range(70):
        x, y = rng.random() * W, H * (0.25 + rng.random() * 0.6)
        r = 12 + rng.random() ** 2 * 46
        c = col(['#ffb257', '#ff7a45', '#ffd889', '#5fd3c4', '#e0452b'][rng.integers(5)])
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2)
        bok += (ss(r, r - 3, d) * (0.05 + 0.1 * rng.random()))[..., None] * c
    img += gaussian_filter(bok, (2, 2, 0)) * (1 - 0.6 * ss(0.15, 0.0, np.abs(U - 0.5)))[..., None]
    return vignette(img, 0.62)


def tabi():
    """一人旅: 旅先の空と湖 (モレーン湖の写真)"""
    img = photo(TABI + '_カナダ___P_20180908_113122_vHDR_On_jpg.jpg', (0.5, 0.4), blur=14, expo=0.7, sat=0.95)
    img = glow(img, '#fff4dc', 0.5, 0.2, 0.4, 0.2, 0.10)
    return vignette(img, 0.6)


def niwa():
    """浮遊島: 雲の上の夜空。下に雲の海、上に星、ほのかな月"""
    img = vgrad('#0b1030', '#1b1f45', 1.0)
    n = noise(22, 6)
    sea = ss(0.55, 0.9, V) * (0.55 + 0.45 * n) * ss(0.5, 0.7, V + 0.1 * (n - 0.5))
    img = img * (1 - 0.6 * sea[..., None]) + sea[..., None] * col('#9aa6c9') * 0.55
    img = glow(img, '#f6e7c1', 0.78, 0.14, 0.08, 0.1, 0.35)
    img = glow(img, '#f6e7c1', 0.78, 0.14, 0.3, 0.3, 0.08)
    img = stars(img, 420, 14, 0.8, region=lambda x, y: y < 0.62)
    return vignette(img, 0.55)


def cabin():
    img = photo(os.path.join(ROOT, 'assets', 'cabin-hero.png'), (0.55, 0.55), blur=16, expo=0.6, sat=0.9)
    img = glow(img, '#ffae5a', 0.52, 0.56, 0.24, 0.2, 0.10)   # 窓の灯り
    return vignette(img, 0.64)


BG = {'library': library, 'seikai': seikai, 'kototsugi': kototsugi, 'hyaku': hyaku, 'salon': salon, 'sudoku': sudoku,
      'shogipuyo': shogi, 'aimap': aimap, 'henshu': henshu, 'hitori': hitori, 'hitoritabi': tabi, 'niwa': niwa, 'cabin': cabin}


def padded(path, size, bg):
    """図は切らずに、同じ地の色の余白を足して収める (切ると「87本」が「7本」に読める)"""
    im = Image.open(os.path.join(ROOT, path)).convert('RGB')
    return ImageOps.pad(im, size, Image.LANCZOS, color=bg, centering=(0.5, 0.5))


def henshu_page():
    """見開きの左頁の挿絵: 公開中の動画137本の音量 (記事の図と同じもの)。右頁と枠はほかの頁と同じ型 (図は切らずに余白を足す)"""
    sys.path.insert(0, os.path.join(ROOT, '_blender'))
    import ehon3_popup_cards as P
    tmp = os.path.join(OUT, '_henshu_plate_src.png')
    x0, y0, x1, y1 = P.PLATE_BOX
    padded('assets/video-kit/f2_loud.webp', (x1 - x0, y1 - y0), (252, 251, 252)).save(tmp)
    P.plate(tmp, 'henshu', (0.5, 0.5))
    os.remove(tmp)
    # 目次の絵 (toc_henshu_v2.webp) は、絵本の中の飛び出し (紺地に画面と検査の帳面) を撮ったもの。
    # 記事の見出しの絵は地が白く、目次のカードの白い題字が読めなかった


if __name__ == '__main__':
    ids = sys.argv[1:] or list(BG) + ['henshu_page']
    for k in ids:
        if k == 'henshu_page':
            henshu_page()
        else:
            finish(BG[k](), k)
