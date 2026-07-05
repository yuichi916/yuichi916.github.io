# -*- coding: utf-8 -*-
"""頁別の見開きページ画像生成 (Pillow)
各頁の diorama サムネをセピア水彩調にして羊皮紙見開きに合成し、飾り枠を付ける。
出力: C:\tmp\ehon2\pages\page_<slug>_v1.webp (1024x704, 左=挿絵 右=装飾)
usage: python ehon2_page_textures.py   (サムネは C:\tmp\ehon2\thumb_<slug>.png を参照)
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance

THUMB_DIR = r'C:\tmp\ehon2'
OUT_DIR = r'C:\tmp\ehon2\pages'
os.makedirs(OUT_DIR, exist_ok=True)
W, H = 1024, 704
PW = W // 2   # 1ページ幅

PARCH = (233, 219, 187)
INK = (74, 52, 30)
GOLD = (166, 124, 54)

SLUGS = ['cabin', 'niwa', 'tomoshibi', 'stopwatch', 'sudoku', 'shogipuyo',
         'lingo', 'toeic', 'salon', 'hitoritabi', 'world', 'hollowtale',
         'enchanted', 'valhalla', 'darkfantasy', 'toc', 'colophon']

random.seed(7)


def parchment(w, h, seed=0):
    rnd = random.Random(seed)
    img = Image.new('RGB', (w, h), PARCH)
    px = img.load()
    for y in range(h):
        for x in range(0, w, 2):
            n = rnd.randint(-9, 9)
            r = int(min(255, max(0, PARCH[0] + n)))
            g = int(min(255, max(0, PARCH[1] + n)))
            b = int(min(255, max(0, PARCH[2] + n * 0.7)))
            px[x, y] = (r, g, b)
            if x + 1 < w:
                px[x + 1, y] = (r, g, b)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    # 縁のヤケ (vignette)
    vig = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(vig)
    d.rounded_rectangle([int(w*0.02), int(h*0.03), int(w*0.98), int(h*0.97)], radius=24, fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(26))
    dark = ImageOps.colorize(ImageOps.invert(vig), (0, 0, 0), (60, 40, 18))
    img = Image.composite(img, Image.blend(img, dark, 0.5), vig)
    # 中央綴じの陰影
    spine = Image.new('L', (w, h), 0)
    ds = ImageDraw.Draw(spine)
    for i in range(60):
        a = int(90 * (1 - i / 60))
        ds.line([(w // 2 - i, 0), (w // 2 - i, h)], fill=a)
        ds.line([(w // 2 + i, 0), (w // 2 + i, h)], fill=a)
    img = Image.composite(Image.blend(img, Image.new('RGB', (w, h), (98, 74, 44)), 0.55), img, spine)
    return img


def sepia_watercolor(im, size):
    """dioramaサムネ → セピア水彩調の挿絵"""
    im = ImageOps.fit(im.convert('RGB'), size, Image.LANCZOS)
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=1)
    # 濃いインクトーン (暗部をしっかり) で挿絵をはっきり見せる
    sep = ImageOps.colorize(g, (36, 24, 12), (244, 232, 205), mid=(138, 104, 66))
    sep = sep.filter(ImageFilter.GaussianBlur(0.5))
    sep = ImageEnhance.Contrast(sep).enhance(1.28)
    sep = ImageEnhance.Color(sep).enhance(1.15)
    mask = Image.new('L', size, 0)
    dm = ImageDraw.Draw(mask)
    dm.rounded_rectangle([6, 6, size[0] - 6, size[1] - 6], radius=18, fill=235)
    mask = mask.filter(ImageFilter.GaussianBlur(7))
    return sep, mask


def deco_frame(draw, box, color=GOLD, w=3):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle([x0, y0, x1, y1], radius=14, outline=color, width=w)
    draw.rounded_rectangle([x0 + 8, y0 + 8, x1 - 8, y1 - 8], radius=10, outline=color, width=1)
    for cx, cy in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=color, width=2)


def ruled_lines(draw, x0, y0, x1, n, gap):
    """物語文風の飾り罫線 (文字は書かない: i18n は HTML 側)"""
    rnd = random.Random(11)
    for i in range(n):
        y = y0 + i * gap
        end = x1 - rnd.randint(0, 90) if i % 4 == 3 else x1
        draw.line([(x0, y), (end, y)], fill=(150, 126, 92), width=2)


def make_page(slug):
    img = parchment(W, H, seed=hash(slug) % 9999)
    draw = ImageDraw.Draw(img)

    # 左ページ: 挿絵
    art_box = (54, 60, PW - 44, H - 96)
    thumb_path = os.path.join(THUMB_DIR, f'thumb_{slug}.png')
    if os.path.exists(thumb_path):
        art, mask = sepia_watercolor(Image.open(thumb_path),
                                     (art_box[2] - art_box[0], art_box[3] - art_box[1]))
        img.paste(art, (art_box[0], art_box[1]), mask)
    else:
        # サムネ無し頁 (salon/toc/colophon): テーマ描画
        ad = ImageDraw.Draw(img)
        cx, cy = (art_box[0] + art_box[2]) // 2, (art_box[1] + art_box[3]) // 2
        if slug == 'salon':
            rnd = random.Random(5)
            for arm in range(3):
                base = arm * 2 * math.pi / 3
                for i in range(90):
                    t = i / 90
                    r = 8 + 150 * t
                    th = base + t * 3.4
                    x = cx + r * math.cos(th) + rnd.uniform(-4, 4)
                    y = cy + r * 0.62 * math.sin(th) + rnd.uniform(-4, 4)
                    s = max(1, int(3.5 * (1.15 - t)))
                    col = (176, 138, 64) if t < 0.5 else (110, 108, 140)
                    ad.ellipse([x - s, y - s, x + s, y + s], fill=col)
            ad.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(190, 150, 70))
        elif slug == 'toc':
            ad.ellipse([cx - 130, cy - 130, cx + 130, cy + 130], outline=INK, width=3)
            ad.ellipse([cx - 100, cy - 100, cx + 100, cy + 100], outline=GOLD, width=2)
            for k in range(8):
                a = k * math.pi / 4
                x2, y2 = cx + 124 * math.cos(a), cy + 124 * math.sin(a)
                ad.line([(cx, cy), (x2, y2)], fill=INK, width=3 if k % 2 == 0 else 1)
        else:  # colophon: 窓
            for wx in (cx - 92, cx + 8):
                for wy in (cy - 112, cy + 8):
                    ad.rounded_rectangle([wx, wy, wx + 84, wy + 104], radius=30,
                                         outline=INK, width=3)
                    ad.line([(wx + 42, wy), (wx + 42, wy + 104)], fill=INK, width=2)
                    ad.line([(wx, wy + 52), (wx + 84, wy + 52)], fill=INK, width=2)
    deco_frame(draw, art_box)

    # 右ページ: 飾り (イニシャル風ブロック + 罫線)
    rx0 = PW + 44
    draw.rounded_rectangle([rx0, 60, W - 54, 190], radius=12, outline=GOLD, width=2)
    draw.rounded_rectangle([rx0 + 16, 76, rx0 + 96, 174], radius=8, fill=(196, 168, 116))
    draw.rounded_rectangle([rx0 + 16, 76, rx0 + 96, 174], radius=8, outline=INK, width=2)
    ruled_lines(draw, rx0 + 112, 100, W - 76, 4, 24)
    ruled_lines(draw, rx0, 232, W - 76, 14, 30)
    deco_frame(draw, (rx0 - 10, 48, W - 44, H - 96), color=(150, 120, 70), w=2)

    # ページ番号風の装飾
    draw.ellipse([W // 4 - 9, H - 62, W // 4 + 9, H - 44], outline=GOLD, width=2)
    draw.ellipse([3 * W // 4 - 9, H - 62, 3 * W // 4 + 9, H - 44], outline=GOLD, width=2)

    img.save(os.path.join(OUT_DIR, f'page_{slug}_v1.webp'), 'WEBP', quality=84)
    print('page:', slug)


for s in SLUGS:
    make_page(s)
print('PAGE_TEXTURES_DONE')
