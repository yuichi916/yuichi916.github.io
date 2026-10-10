"""選んだ表情を透過 WebP に書き出す。
使い方: python export.py <id|all>
入力: out/<id>/picks.json {"normal": "normal_2.png", ...}（無ければ <expr>_0.png）、out/<id>/base.png
出力: assets/tsunagu-naraberu/chara/<id>/<expr>.webp, select.webp, cutin.webp と out/<id>/dark_check.png
背景抜き: rembg(isnet-anime) のマスクを基本の1枚で1回だけ作り、全表情で共有する（顔以外は同じ絵なので輪郭も同じ）。
"""
import json, pathlib, sys
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove
from common import EXPR

HERE = pathlib.Path(__file__).parent
DEST = HERE.parents[2] / "assets" / "tsunagu-naraberu" / "chara"
H = 720
_session = None
# 生成で付いたステッカー風の縁取りを落とすため、輪郭を内側へ削る幅（px）
ERODE = {"suzu": 2}
# 縁から BAND px 以内にある黄色っぽい画素（生成で付いた縁取りの名残）を透明にするキャラ
STICKER_BAND = {"suzu": 18}
# 下端を切り落とす高さ（基本の1枚の画素。崩れた手を写さない）
CROP_BOTTOM = {"rin": 1000}


def alpha_of(img, erode=0, band=0):
    global _session
    if _session is None:
        _session = new_session("isnet-anime")
    a = remove(img, session=_session, only_mask=True, post_process_mask=True)
    a = np.array(a.convert("L"), dtype=np.float32)
    # 白い背景の残りを削る: ほぼ白で、マスクが中間値の画素は透明に寄せる
    rgb = np.array(img.convert("RGB"), dtype=np.float32)
    white = (rgb.min(axis=2) > 245)
    a[white & (a < 200)] = 0
    if band:
        # 縁取りの名残: 外側の透明部分とつながっている黄色っぽい画素のかたまりだけを消す
        # （髪飾りやハイライトの黄色は外とつながっていないので残る）。band は外から何px まで追うか
        from scipy import ndimage
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        yellow = (r > 180) & (g > 150) & (b < 160) & (r - b > 60) & (a > 0)
        outside = a < 30
        near = ndimage.binary_dilation(outside, iterations=band)
        lab, n = ndimage.label(yellow & near)
        touch = np.unique(lab[ndimage.binary_dilation(outside, iterations=2) & (lab > 0)])
        a[np.isin(lab, touch[touch > 0])] = 0
    a = Image.fromarray(a.clip(0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3 + 2 * erode)).filter(ImageFilter.GaussianBlur(0.8))
    return a


def defringe(img, a):
    """縁の白いにじみを消す: 半透明の縁は、内側の色を広げて塗り直す。"""
    rgb = np.array(img.convert("RGB"), dtype=np.float32)
    al = np.array(a, dtype=np.float32) / 255
    solid = al > 0.95
    fill = rgb.copy()
    src = Image.fromarray(np.where(solid[..., None], rgb, 0).astype(np.uint8))
    m = Image.fromarray((solid * 255).astype(np.uint8))
    for _ in range(4):  # 内側の色を外へ広げる
        src = src.filter(ImageFilter.MaxFilter(3))
        m = m.filter(ImageFilter.MaxFilter(3))
    spread = np.array(src, dtype=np.float32)
    edge = (al > 0) & ~solid
    fill[edge] = spread[edge]
    return Image.fromarray(fill.clip(0, 255).astype(np.uint8))


def to_rgba(img, a):
    out = defringe(img, a).convert("RGBA")
    out.putalpha(a)
    return out


def crop_box(a):
    bb = a.getbbox()
    return (max(0, bb[0] - 8), max(0, bb[1] - 8), min(a.width, bb[2] + 8), min(a.height, bb[3] + 8))


def export(cid):
    out = HERE / "out" / cid
    picks_p = out / "picks.json"
    picks = json.loads(picks_p.read_text(encoding="utf-8")) if picks_p.exists() else {}
    base = Image.open(out / "base.png").convert("RGB")
    a = alpha_of(base, ERODE.get(cid, 0), STICKER_BAND.get(cid, 0))
    box = crop_box(a)
    if cid in CROP_BOTTOM: box = (box[0], box[1], box[2], min(box[3], CROP_BOTTOM[cid]))
    dest = DEST / cid
    dest.mkdir(parents=True, exist_ok=True)
    checks = []
    for ex in EXPR:
        src = Image.open(out / picks.get(ex, f"{ex}_0.png")).convert("RGB")
        rgba = to_rgba(src, a).crop(box)
        rgba = rgba.resize((round(rgba.width * H / rgba.height), H), Image.LANCZOS)
        rgba.save(dest / f"{ex}.webp", "WEBP", quality=86, method=6)
        checks.append(rgba)
    # 選択画面用: 基本の1枚の全体（normal と同じ切り抜き）
    sel = to_rgba(base, a).crop(box)
    sel.resize((round(sel.width * 900 / sel.height), 900), Image.LANCZOS).save(dest / "select.webp", "WEBP", quality=86, method=6)
    # カットイン用: attack の顔まわりを横長に
    fx0, fy0, fx1, fy1 = json.loads((HERE / "faces.json").read_text(encoding="utf-8"))[cid]
    fw, fh = fx1 - fx0, fy1 - fy0
    cx, cy = (fx0 + fx1) / 2, (fy0 + fy1) / 2
    cw, ch = fw * 2.6, fh * 1.25
    cbox = (int(cx - cw / 2), int(cy - ch * 0.48), int(cx + cw / 2), int(cy + ch * 0.52))
    att = Image.open(out / picks.get("attack", "attack_0.png")).convert("RGB")
    cut = to_rgba(att, a).crop(cbox)
    cut.resize((720, round(cut.height * 720 / cut.width)), Image.LANCZOS).save(dest / "cutin.webp", "WEBP", quality=86, method=6)
    # 暗い背景に重ねた確認画像（白い縁が残っていないか）
    w = sum(c.width for c in checks)
    sheet = Image.new("RGBA", (w, H), (13, 11, 31, 255))
    x = 0
    for c in checks:
        sheet.alpha_composite(c, (x, 0)); x += c.width
    sheet.convert("RGB").save(out / "dark_check.png")
    sizes = {p.name: p.stat().st_size // 1024 for p in dest.glob("*.webp")}
    print(cid, sizes, flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    for cid in (["hinata", "momo", "rin", "suzu"] if which == "all" else [which]):
        export(cid)
