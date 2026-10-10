"""生成の共通設定。正本は docs/tsunagu-naraberu-stylebook.md（変えるときは両方そろえる）。"""
import base64, io
import requests
from PIL import Image

HOST = "http://127.0.0.1:7860/sdapi/v1"
COMMON = ("masterpiece, best quality, amazing quality, anime style, cute, 1girl, solo, teenage, cowboy shot, looking at viewer, "
          "upper body focus, simple background, white background, soft shading, thick outline, bright colors")
NEG = ("nsfw, nude, cleavage, underwear, revealing clothes, lowres, worst quality, bad quality, bad anatomy, bad hands, "
       "extra fingers, missing fingers, extra arms, deformed, blurry, text, watermark, signature, logo, multiple girls, "
       "multiple views, frame, border, dark background, sticker, outline, white outline, yellow outline, outer glow")
# 外見だけ（表情の語は入れない）
LOOK = {
    "hinata": "orange hair, twintails, star hair ornament, yellow hairclip, amber eyes, coral hoodie, white shirt, black shorts, energetic, fang",
    "momo": "pink hair, long hair, wavy hair, cream beret, droopy eyes, pink eyes, white cardigan, pastel ribbon, long pink skirt",
    "rin": "cyan hair, bob cut, square hair ornament, block hairclip, blue eyes, tsurime, navy blazer, white shirt, blue necktie, pleated skirt",
    "suzu": "mint green hair, short hair, purple streaked hair, cat ear hood, oversized purple hoodie, denim shorts, green eyes, fang",
}
EXPR = {
    "normal": "smile, closed mouth",
    "happy": "(closed eyes:1.3), (^_^:1.2), (open mouth smile:1.2), happy, blush",
    "attack": "(shouting:1.4), (wide open mouth:1.3), (v-shaped eyebrows:1.3), determined, fierce",
    "ouch": "(wince:1.3), (one eye closed:1.3), (open mouth:1.2), surprised, sweatdrop, >_<",
    "pinch": "(worried:1.3), (nervous sweat:1.3), (wavy mouth:1.3), frown, panicking",
    "win": "(laughing:1.3), (open mouth:1.2), (closed eyes:1.1), sparkle, happy",
    "lose": "(crying:1.4), (streaming tears:1.3), (open mouth:1.1), sad, frown",
}
# 表情ごとの描き直しの強さ（normal は基本の1枚に近く、ほかは大きく変える）
DENOISE = {"normal": 0.4, "attack": 0.7, "happy": 0.7, "win": 0.68}
DENOISE_DEFAULT = 0.62


def b64png(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()


def post(path, payload, timeout=600):
    r = requests.post(f"{HOST}/{path}", json=payload, timeout=timeout)
    r.raise_for_status()
    return [Image.open(io.BytesIO(base64.b64decode(s))) for s in r.json()["images"]]
