"""表情差分: 基本の1枚の顔だけを inpaint で描き直す（顔以外は同じ絵のまま＝別人にならない）。
使い方: python gen_expr.py <id|all> [expr|all] [n=4] [denoise=0.5]
入力: out/<id>/base.png、faces.json の顔の矩形 {"<id>": [x0, y0, x1, y1]}（base.png の画素座標）
出力: out/<id>/<expr>_<k>.png
"""
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFilter
from common import COMMON, NEG, LOOK, EXPR, DENOISE, DENOISE_DEFAULT, b64png, post

HERE = pathlib.Path(__file__).parent


def face_mask(size, box, grow=0.18, blur=14):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    x0, x1 = x0 - w * grow, x1 + w * grow
    y0, y1 = y0 - h * grow * 0.6, y1 + h * grow
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse([x0, y0, x1, y1], fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


def gen(cid, exprs, n, denoise):
    out = HERE / "out" / cid
    base = Image.open(out / "base.png").convert("RGB")
    box = json.loads((HERE / "faces.json").read_text(encoding="utf-8"))[cid]
    mask = face_mask(base.size, box)
    mask.save(out / "mask.png")
    for ex in exprs:
        for k in range(n):
            payload = {
                "init_images": [b64png(base)], "mask": b64png(mask),
                "prompt": f"{COMMON}, {LOOK[cid]}, {EXPR[ex]}", "negative_prompt": NEG,
                "denoising_strength": denoise if denoise else DENOISE.get(ex, DENOISE_DEFAULT), "inpainting_fill": 1, "inpaint_full_res": True,
                "inpaint_full_res_padding": 64, "mask_blur": 8, "inpainting_mask_invert": 0,
                "width": base.width, "height": base.height, "steps": 28, "cfg_scale": 6,
                "sampler_name": "Euler a", "seed": 5000 + k,
            }
            post("img2img", payload)[0].save(out / f"{ex}_{k}.png")
            print(cid, ex, k, flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    ex = sys.argv[2] if len(sys.argv) > 2 else "all"
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    dn = float(sys.argv[4]) if len(sys.argv) > 4 else 0  # 0=表情ごとの既定値
    for cid in (LOOK if which == "all" else [which]):
        gen(cid, list(EXPR) if ex == "all" else ex.split(","), n, dn)
