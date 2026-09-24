# -*- coding: utf-8 -*-
"""飛び出し用のカード画像 (Pillow)。ゲーム内の素材から作る。

- 背景カード: 上辺を弧に切った台紙に貼り、縁に細い金の線 (しかけ絵本の奥の書き割り)
- 立ち絵・小物: 白い縁取りの切り抜き (紙から切り出した立ち絵)
- 裏: 台紙色のシルエット (カードの裏は印刷のない紙)
- 目次のサムネ: キービジュアルを切り出す
- 見開きの頁: ほかの頁と同じ紙と金枠に、ゲームの一枚絵を色刷りの挿絵として刷る
- 歌う銀河の円盤の淡い光: 星の点の下に敷く (ehon.html の buildGalaxy と同じ腕の式)
出力: _ehon_assets/ehon/popup/<slug>_<part>_v1.webp (+ _back_v1.webp)、_ehon_assets/ehon/toc_<slug>_v1.webp、
      _ehon_assets/ehon/pages/page_<slug>_v1.webp、_ehon_assets/ehon/popup/galaxy_disk_v1.webp
usage: python _blender/ehon3_popup_cards.py
"""
import os
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_ehon_assets', 'ehon', 'popup')
os.makedirs(OUT, exist_ok=True)
PAPER = (246, 239, 224)
EDGE = (196, 182, 156)
GOLD = (176, 138, 62)


def src(p):
    return os.path.join(ROOT, p)


def save(im, name, q=88):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=q, method=6)
    print(f'{name:34s} {im.size[0]}x{im.size[1]} {os.path.getsize(path) // 1024}KB')


def arch_mask(w, h, arch_h):
    """上辺が弧 (半楕円) の台紙の形"""
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rectangle([0, arch_h, w - 1, h - 1], fill=255)
    d.ellipse([0, 0, w - 1, arch_h * 2], fill=255)
    return m


def backdrop(path, name, width=1024, border=16):
    im = Image.open(src(path)).convert('RGB')
    im = ImageOps.fit(im, (width, int(width * 9 / 16)), Image.LANCZOS, centering=(0.5, 0.42))
    w, h = im.size[0] + border * 2, im.size[1] + border * 2
    arch_h = int(h * 0.17)
    card = Image.new('RGB', (w, h), PAPER)
    art_mask = arch_mask(w - border * 2, h - border * 2, arch_h - border // 2)
    card.paste(im, (border, border), art_mask)
    shape = arch_mask(w, h, arch_h)
    # 台紙の内側に細い金の線 (印刷の縁飾り)
    line = arch_mask(w - border, h - border, arch_h - border // 4)
    inner = arch_mask(w - border - 4, h - border - 4, arch_h - border // 4 - 2)
    ring = Image.new('L', (w, h), 0)
    ring.paste(line, (border // 2, border // 2))
    hole = Image.new('L', (w, h), 0)
    hole.paste(inner, (border // 2 + 2, border // 2 + 2))
    ring = ImageChops.subtract(ring, hole)
    card.paste(Image.new('RGB', (w, h), GOLD), (0, 0), ring)
    # 紙の縁の影
    edge = ImageChops.subtract(shape, shape.filter(ImageFilter.MinFilter(5)))
    card.paste(Image.new('RGB', (w, h), EDGE), (0, 0), edge)
    out = card.convert('RGBA')
    out.putalpha(shape)
    save(out, f'{name}_v1.webp')
    back = Image.new('RGBA', (w, h), PAPER + (255,))
    back.putalpha(shape)
    save(back.resize((w // 2, h // 2), Image.LANCZOS), f'{name}_back_v1.webp', 80)
    return w, h


def standee(path, name, height=900, pad=14):
    im = Image.open(src(path)).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    s = height / im.size[1]
    im = im.resize((max(1, round(im.size[0] * s)), height), Image.LANCZOS)
    w, h = im.size[0] + pad * 2, im.size[1] + pad * 2
    a = Image.new('L', (w, h), 0)
    a.paste(im.getchannel('A'), (pad, pad))
    # 白い縁取り: 輪郭を太らせてから、ぼかして閾値で整える (切り抜きの線をなめらかに)
    cut = a.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(pad * 2 - 1))
    cut = cut.filter(ImageFilter.GaussianBlur(2.2)).point(lambda v: 255 if v > 110 else 0)
    card = Image.new('RGBA', (w, h), PAPER + (255,))
    card.putalpha(cut)
    edge = ImageChops.subtract(cut, cut.filter(ImageFilter.MinFilter(3)))
    card.paste(Image.new('RGBA', (w, h), EDGE + (255,)), (0, 0), edge)
    card.alpha_composite(im, (pad, pad))
    save(card, f'{name}_v1.webp')
    back = Image.new('RGBA', (w, h), PAPER + (255,))
    back.putalpha(cut)
    save(back.resize((w // 2, h // 2), Image.LANCZOS), f'{name}_back_v1.webp', 80)
    return w, h


def plain(path, name, size=256):
    im = Image.open(src(path)).convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS)
    save(im, f'{name}_v1.webp', 90)


def toc(path, slug, centering=(0.5, 0.5)):
    im = Image.open(src(path)).convert('RGB')
    im = ImageOps.fit(im, (480, 300), Image.LANCZOS, centering=centering)
    p = os.path.join(ROOT, '_ehon_assets', 'ehon', f'toc_{slug}_v1.webp')
    im.save(p, 'WEBP', quality=84, method=6)
    print(f'toc_{slug}_v1.webp {os.path.getsize(p) // 1024}KB')


PAGE_TEMPLATE = os.path.join(ROOT, '_ehon_assets', 'ehon', 'pages', 'page_tomoshibi_v1.webp')
PLATE_BOX = (63, 69, 460, 600)   # 左頁の金枠の内側 (1024x704 の頁画像で実測。枠の線は残す)


def plate(path, slug, centering=(0.5, 0.5)):
    """見開きの左頁に、ゲームの一枚絵を色刷りの挿絵として刷る。右頁の罫線と枠は、ほかの頁と同じ型のまま"""
    page = Image.open(PAGE_TEMPLATE).convert('RGB')
    assert page.size == (1024, 704), page.size
    x0, y0, x1, y1 = PLATE_BOX
    w, h = x1 - x0, y1 - y0
    im = ImageOps.fit(Image.open(src(path)).convert('RGB'), (w, h), Image.LANCZOS, centering=centering)
    a = np.asarray(im).astype(np.float32) / 255
    # 紙に刷ったインク: 彩度を少し落とし、いちばん暗いところも紙の色が透け、全体に紙の色がかかる
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    a = lum[..., None] + (a - lum[..., None]) * 0.86
    a = (0.055 + a * 0.93) * np.array([0.99, 0.95, 0.86], np.float32)
    # 周辺をやわらかく沈める (ほかの頁の挿絵と同じ)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((((xx + 0.5) / w - 0.5) * 2) ** 2 + (((yy + 0.5) / h - 0.5) * 2) ** 2)
    a *= (1 - 0.3 * np.clip((d - 0.6) / 0.8, 0, 1) ** 1.5)[..., None]
    a += np.random.default_rng(7).normal(0, 0.012, (h, w, 1)).astype(np.float32)   # 紙のざらつき
    page.paste(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)), (x0, y0))
    out = os.path.join(ROOT, '_ehon_assets', 'ehon', 'pages', f'page_{slug}_v1.webp')
    page.save(out, 'WEBP', quality=86, method=6)
    print(f'page_{slug}_v1.webp {os.path.getsize(out) // 1024}KB')


def galaxy_disk(size=768, span=7.6):
    """歌う銀河の円盤。星の点の下に敷き、点だけでは出ない面の明るさと、腕の内側の暗い塵の帯を出す。
    RGB = 足す光 (加算)、A = 奥の景色を隠す濃さ (円盤の暗さと塵)。ehon.html では 光 + 奥 × (1 − A) で重ねる。
    腕の式・塵の帯の位置は ehon.html の buildGalaxy と同じ (R, R0, PITCH, LANE)。
    画像の列 = x、行 = z (画像の上が z のマイナス側)。1 辺 span が銀河の座標で ±span/2"""
    R, R0, PITCH, LANE = 3.3, 0.32, 0.3, 0.26
    c = ((np.arange(size) + 0.5) / size - 0.5) * span
    X, Z = np.meshgrid(c, c)
    r = np.hypot(X, Z)
    th = np.arctan2(Z, X)
    rs = np.maximum(r, 0.05)

    def ss(a, b, x):
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    arm = np.zeros_like(r)
    lane = np.zeros_like(r)
    for k in range(2):
        d = th - (np.log(rs / R0) / PITCH + k * np.pi)
        d = (d + np.pi) % (2 * np.pi) - np.pi
        arm = np.maximum(arm, np.exp(-0.5 * (d / (0.22 * (0.35 + r / R))) ** 2))
        dl = (d - LANE + np.pi) % (2 * np.pi) - np.pi
        lane = np.maximum(lane, np.exp(-0.5 * (dl / (0.075 * (0.5 + r / R))) ** 2))
    rim = 1 - ss(2.9, 3.75, r)
    lane_on = ss(0.45, 0.9, r) * (1 - ss(2.7, 3.4, r))
    rng = np.random.default_rng(11)
    mott = gaussian_filter(rng.random((size, size)), 3.0)
    mott = (mott - mott.min()) / (mott.max() - mott.min())
    dust = (1 - 0.8 * lane * lane_on) * (1 - 0.35 * mott * ss(0.5, 1.2, r))
    clump = gaussian_filter(rng.random((size, size)), 9.0)   # 腕の明るさのむら (星の群れ)
    clump = (clump - clump.min()) / (clump.max() - clump.min())
    arm_amp = 0.75 * ss(0.25, 0.8, r) * np.exp(-(r - 0.5) / 2.0) * rim * (0.55 + 0.9 * clump)
    disk = 0.2 * np.exp(-r / 1.25) * rim
    bulge = 0.85 * np.exp(-r / 0.26) + 0.25 * np.exp(-r / 0.62)
    col = lambda v: np.array(v, np.float32)
    img = (bulge[..., None] * col([1.0, 0.8, 0.55])
           + (disk[..., None] * col([0.9, 0.88, 0.95]) + (arm * arm_amp)[..., None] * col([0.7, 0.8, 1.0])) * dust[..., None])
    # 星の生まれる赤い雲: 腕の外側の縁に沿って、小さく点々と
    px = size / span
    for _ in range(70):
        k = int(rng.random() < 0.5)
        rk = R0 + 0.35 + rng.random() ** 0.9 * (R - R0 - 0.7)
        tk = np.log(rk / R0) / PITCH + k * np.pi - abs(rng.normal()) * 0.1
        cx, cz = rk * np.cos(tk), rk * np.sin(tk)
        sg = 0.02 + rng.random() * 0.025
        amp = (0.08 + rng.random() * 0.1) * (1 - ss(2.8, 3.4, rk))
        i0 = int((cz / span + 0.5) * size)
        j0 = int((cx / span + 0.5) * size)
        rad = int(sg * 4 * px) + 1
        ys, xs = slice(max(0, i0 - rad), min(size, i0 + rad)), slice(max(0, j0 - rad), min(size, j0 + rad))
        g = np.exp(-((X[ys, xs] - cx) ** 2 + (Z[ys, xs] - cz) ** 2) / (2 * sg * sg)) * amp
        img[ys, xs] += g[..., None] * col([1.0, 0.38, 0.55])
    img = np.clip(img, 0, 1)
    # 奥を隠す濃さ: 円盤のあるところは宇宙の暗さに沈み、塵の帯はいっそう暗い
    occ = (0.6 * np.exp(-(r / 2.8) ** 2.4) + 0.3 * lane * lane_on
           + 0.12 * mott * ss(0.5, 1.2, r) * (1 - ss(2.8, 3.5, r)))
    occ = np.clip(occ * (1 - ss(3.0, 3.75, r)), 0, 0.93)   # 画像の縁 (四角) では必ず 0
    rgba = np.concatenate([img, occ[..., None]], axis=2)
    path = os.path.join(OUT, 'galaxy_disk_v1.webp')
    # exact: 透明に近いところの光 (RGB) も、圧縮で消さずに残す
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, 'WEBP', quality=88, method=6, exact=True)
    print(f'galaxy_disk_v1.webp {size}x{size} {os.path.getsize(path) // 1024}KB')


if __name__ == '__main__':
    # 正解の外側: 地下の少年と記憶のない少女が、空を目指す
    backdrop('assets/seikai/cg-townsky.jpg', 'seikai_back')
    standee('assets/seikai/cg-kai.png', 'seikai_kai')
    standee('assets/seikai/cg-rin.png', 'seikai_rin')
    # 百の悪行: 夜の城の前に魔王、手前に勇者と少女
    backdrop('assets/hyaku/img/bg_castle.jpg', 'hyaku_back')
    standee('assets/hyaku/img/sp_theodora.png', 'hyaku_theodora')
    standee('assets/hyaku/img/sp_ash.png', 'hyaku_ash')
    standee('assets/hyaku/img/sp_mia.png', 'hyaku_mia')
    # ことつぎの星: 夕暮れの浜 (キービジュアル) を背に、流れ着いた少女とおばあさん。ひろわれるのを待つ言葉のかけら
    backdrop('kototsugi/game/assets/cg/key_visual.png', 'kototsugi_back')
    standee('kototsugi/game/assets/sprite/fine/smile.png', 'kototsugi_fine')
    standee('kototsugi/game/assets/sprite/baa/normal.png', 'kototsugi_baa')
    for k in ('bright', 'warm', 'cool', 'solemn'):
        plain(f'kototsugi/game/assets/item/shard_{k}.png', f'kototsugi_shard_{k}')
    # 目次のサムネ (先頭の3作)
    toc('assets/seikai/keyvisual-bg.jpg', 'seikai', (0.5, 0.5))
    toc('kototsugi/game/assets/cg/key_visual.png', 'kototsugi', (0.45, 0.4))
    toc('assets/hyaku/img/bg_keyvisual.jpg', 'hyaku', (0.5, 0.45))
    # 見開きの左頁の挿絵
    plate('assets/seikai/keyvisual-bg.jpg', 'seikai', (0.45, 0.5))
    plate('kototsugi/game/assets/cg/shore_find.png', 'kototsugi', (0.5, 0.5))
    plate('assets/hyaku/img/bg_hyakujo.jpg', 'hyaku', (0.5, 0.5))
    # 歌う銀河
    galaxy_disk()
