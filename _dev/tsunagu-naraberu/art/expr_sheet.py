"""表情候補の一覧: キャラごとに 7表情（行）× 4候補（列）の顔まわりを並べる。左端は基本の1枚。
使い方: python expr_sheet.py <id|all>  → out/<id>/expr_sheet.png
"""
import json, pathlib, sys
from PIL import Image, ImageDraw
from common import EXPR

HERE = pathlib.Path(__file__).parent
T = 260  # 1マスの大きさ


def sheet(cid):
    out = HERE / "out" / cid
    x0, y0, x1, y1 = json.loads((HERE / "faces.json").read_text(encoding="utf-8"))[cid]
    w, h = x1 - x0, y1 - y0
    box = (int(x0 - w * 0.35), int(y0 - h * 0.35), int(x1 + w * 0.35), int(y1 + h * 0.45))
    base = Image.open(out / "base.png").convert("RGB").crop(box).resize((T, T))
    rows = list(EXPR)
    img = Image.new("RGB", (T * 5 + 120, T * len(rows)), "white")
    d = ImageDraw.Draw(img)
    for r, ex in enumerate(rows):
        d.text((8, r * T + T // 2), ex, fill="black")
        img.paste(base, (120, r * T))
        for k in range(4):
            p = out / f"{ex}_{k}.png"
            if p.exists():
                img.paste(Image.open(p).convert("RGB").crop(box).resize((T, T)), (120 + T * (k + 1), r * T))
            d.rectangle([120 + T * (k + 1), r * T, 120 + T * (k + 1) + 28, r * T + 22], fill="black")
            d.text((120 + T * (k + 1) + 9, r * T + 5), str(k), fill="white")
        d.text((124, r * T + 4), "base", fill="red")
    img.save(out / "expr_sheet.png")
    print(cid, img.size)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    for cid in (["hinata", "momo", "rin", "suzu"] if which == "all" else [which]):
        sheet(cid)
