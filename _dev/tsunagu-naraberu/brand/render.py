"""『ツナラベ！』のロゴと表紙を撮る。
使い方: python render.py logo        → out/logo.png（副題つき・透過）、out/logo_nosub.png、out/logo_en.png
        python render.py covers      → out/cover_*.png（投稿サイトごとの大きさ）
撮る HTML は同じフォルダの logo.html / cover.html。フォントは Google Fonts を読むので、ネットにつながっていること。"""
import pathlib, sys
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# 投稿サイトの表紙: 名前, 幅, 高さ, 文字の種類（full=ロゴ＋副題＋紹介文 / logo=ロゴだけ：CrazyGames は題名以外の文字禁止）, 言語
COVERS = [
    ("og_1200x630", 1200, 630, "full", "ja"),  # 共有したときの画像（assets/branding/tsunagu-naraberu-og.jpg）
    ("itch_630x500", 630, 500, "full", "ja"),
    ("itch_en_630x500", 630, 500, "full", "en"),
    ("square_800", 800, 800, "full", "ja"),
    ("wide_1280x720", 1280, 720, "full", "ja"),
    ("header_2000x500", 2000, 500, "full", "ja"),
    ("crazygames_1920x1080", 1920, 1080, "logo", "ja"),
    ("crazygames_800x1200", 800, 1200, "logo", "ja"),
]


def crop_alpha(path):
    im = Image.open(path)
    box = im.getbbox()
    if box:
        pad = 12
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        im.crop(box).save(path)


def logo(page):
    for name, query in [("logo", ""), ("logo_nosub", "?sub=0"), ("logo_en", "?lang=en")]:
        page.goto((HERE / "logo.html").as_uri() + query)
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(300)
        p = OUT / f"{name}.png"
        page.locator("#logo").screenshot(path=str(p), omit_background=True)
        crop_alpha(p)
        print("wrote", p)


def covers(page):
    for name, w, h, kind, lang in COVERS:
        page.set_viewport_size({"width": w, "height": h})
        page.goto((HERE / "cover.html").as_uri() + f"?w={w}&h={h}&kind={kind}&lang={lang}")
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(500)
        p = OUT / f"cover_{name}.png"
        page.screenshot(path=str(p))
        print("wrote", p)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "logo"
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome")
        page = b.new_page(viewport={"width": 1400, "height": 620}, device_scale_factor=1)
        if what in ("logo", "all"):
            page.set_viewport_size({"width": 1400, "height": 620})
            logo(page)
        if what in ("covers", "all"):
            covers(page)
        b.close()
