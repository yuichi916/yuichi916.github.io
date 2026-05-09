#!/usr/bin/env python3
"""Generate the Open Graph image (1200x630) for stopwatch.html."""
import sys
sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace")

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

W, H = 1200, 630
OUT = Path(r"C:\Users\yuich\yuichi916.github.io\assets\og-stopwatch.png")

FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_MONO = r"C:\Windows\Fonts\consolab.ttf"
FONT_MIN_B = r"C:\Windows\Fonts\yumindb.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def make_bg():
    """Dark terminal background with subtle gradient."""
    img = Image.new("RGB", (W, H), (13, 17, 23))  # #0d1117 (term-bg)
    px = img.load()
    for y in range(H):
        for x in range(W):
            dx = (x - W * 0.55) / W
            dy = (y - H * 0.55) / H
            d = (dx * dx + dy * dy) ** 0.5
            t = max(0.0, min(1.0, 1 - d * 1.05))
            r = int(13 + t * 18)
            g = int(17 + t * 12)
            b = int(23 + t * 25)
            px[x, y] = (r, g, b)
    grain = Image.effect_noise(img.size, 12).convert("RGB")
    img = Image.blend(img, grain, 0.03)
    return img


def draw_glow(base, xy, text, f, fill, glow_color, glow_blur=18):
    g = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    gd.text(xy, text, font=f, fill=glow_color)
    g = g.filter(ImageFilter.GaussianBlur(glow_blur))
    base.paste(g, (0, 0), g)
    d = ImageDraw.Draw(base)
    d.text(xy, text, font=f, fill=fill)


def draw_shadow(base, xy, text, f, fill,
                shadow=(0, 0, 0, 220), offset=(0, 3), blur=4):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((xy[0] + offset[0], xy[1] + offset[1]), text, font=f, fill=shadow)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(base)
    d.text(xy, text, font=f, fill=fill)


def measure(d, text, f):
    b = d.textbbox((0, 0), text, font=f)
    return b[2] - b[0], b[3] - b[1]


def main():
    img = make_bg().convert("RGBA")
    d = ImageDraw.Draw(img)

    GREEN = (126, 231, 135, 255)   # term-green
    YELLOW = (244, 208, 63, 255)   # term-yellow
    DIM = (139, 148, 158, 255)     # term-dim
    FG = (201, 209, 217, 255)      # term-fg
    BORDER = (33, 38, 45, 255)     # term-border

    # Terminal frame with traffic lights
    panel_pad = 56
    panel_top = 90
    panel_bottom = H - 90
    d.rounded_rectangle(
        [panel_pad, panel_top, W - panel_pad, panel_bottom],
        radius=12, outline=BORDER, width=2, fill=(15, 20, 28, 255)
    )
    # title bar
    d.rounded_rectangle(
        [panel_pad, panel_top, W - panel_pad, panel_top + 44],
        radius=12, fill=(33, 38, 45, 255)
    )
    d.rectangle(
        [panel_pad, panel_top + 32, W - panel_pad, panel_top + 44],
        fill=(33, 38, 45, 255)
    )
    # traffic lights
    cy = panel_top + 22
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([panel_pad + 18 + i * 22 - 7, cy - 7,
                   panel_pad + 18 + i * 22 + 7, cy + 7], fill=c)
    # title
    f_title = font(FONT_MONO, 16)
    title_text = "timer.sh — yuichi916.github.io/stopwatch.html"
    tw, th = measure(d, title_text, f_title)
    d.text(((W - tw) // 2, panel_top + 14), title_text, font=f_title, fill=DIM)

    # ───── Inside terminal ─────

    # Mode tabs row
    f_tab = font(FONT_BOLD, 18)
    tabs = [("STOPWATCH", True), ("COUNTDOWN", False), ("WORLD CLOCK", False)]
    tx = panel_pad + 56
    ty = panel_top + 80
    for label, active in tabs:
        tw, th = measure(d, label, f_tab)
        bx, by = tx, ty
        bw, bh = tw + 32, 36
        if active:
            d.rectangle([bx, by, bx + bw, by + bh], fill=GREEN)
            d.text((bx + 16, by + 8), label, font=f_tab, fill=(13, 17, 23, 255))
        else:
            d.rectangle([bx, by, bx + bw, by + bh], outline=BORDER, width=1)
            d.text((bx + 16, by + 8), label, font=f_tab, fill=DIM)
        tx += bw + 12

    # HUGE timer display (mock)
    f_disp = font(FONT_MONO, 142)
    disp_text = "00:42:13.504"
    dw, dh = measure(d, disp_text, f_disp)
    dx = (W - dw) // 2
    dy = panel_top + 165
    draw_glow(img, (dx, dy), disp_text, f_disp,
              fill=GREEN, glow_color=(126, 231, 135, 200), glow_blur=22)

    # Buttons row (mock)
    f_btn = font(FONT_BOLD, 16)
    btns = ["START", "LAP", "RESET", "EXPORT JSON"]
    btn_w = 150
    gap = 14
    total = len(btns) * btn_w + (len(btns) - 1) * gap
    bx0 = (W - total) // 2
    by0 = panel_top + 360
    for i, label in enumerate(btns):
        bx = bx0 + i * (btn_w + gap)
        outline = GREEN if i == 0 else BORDER
        text_col = GREEN if i == 0 else FG
        d.rectangle([bx, by0, bx + btn_w, by0 + 38], outline=outline, width=2)
        tw, th = measure(d, label, f_btn)
        d.text((bx + (btn_w - tw) // 2, by0 + 11), label, font=f_btn, fill=text_col)

    # ───── Bottom: site brand & tagline ─────
    # left: title  /  right: feature pills
    f_brand = font(FONT_BOLD, 28)
    f_brand_sub = font(FONT_BOLD, 18)

    # left side title
    draw_shadow(img, (panel_pad, H - 70),
                "Web Stopwatch", f_brand, fill=FG)
    f_caption = font(FONT_BOLD, 16)
    draw_shadow(img, (panel_pad, H - 38),
                "High-Precision Timer · JSON Export · 10 Languages",
                f_caption, fill=DIM)

    # right side: feature pills
    f_pill = font(FONT_BOLD, 14)
    pills = ["⏱ Stopwatch", "⏳ Countdown", "🌐 World Clock"]
    pill_x = W - panel_pad
    pill_y = H - 60
    for label in reversed(pills):
        tw, th = measure(d, label, f_pill)
        bw, bh = tw + 24, 30
        bx = pill_x - bw
        d.rounded_rectangle([bx, pill_y, bx + bw, pill_y + bh], radius=6,
                             fill=(15, 20, 28, 255), outline=GREEN, width=1)
        d.text((bx + 12, pill_y + 7), label, font=f_pill, fill=GREEN)
        pill_x = bx - 8

    # Save
    img.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"saved: {OUT}  {OUT.stat().st_size // 1024} KB  ({W}x{H})")


if __name__ == "__main__":
    main()
