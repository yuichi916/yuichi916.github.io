"""基本の1枚の候補を reForge で作る。プロンプトの正本は docs/tsunagu-naraberu-stylebook.md。
使い方: python gen_base.py <id|all> [n=8] [seed0=1000]
出力: out/<id>/base_<k>.png と out/<id>/base_meta.json
"""
import base64, json, pathlib, sys
import requests

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
HERE = pathlib.Path(__file__).parent
from common import COMMON, NEG  # 共通設定の正本は common.py
CHARS = {
    "hinata": "orange hair, twintails, star hair ornament, yellow hairclip, amber eyes, coral hoodie, white shirt, black shorts, energetic, fang, smile, closed mouth",
    "momo": "pink hair, long hair, wavy hair, cream beret, droopy eyes, pink eyes, white cardigan, pastel ribbon, long pink skirt, gentle smile, closed mouth",
    "rin": "cyan hair, bob cut, square hair ornament, block hairclip, blue eyes, tsurime, navy blazer, white shirt, blue necktie, pleated skirt, calm, slight smile, closed mouth",
    "suzu": "mint green hair, short hair, purple streaked hair, cat ear hood, oversized purple hoodie, denim shorts, green eyes, fang, mischievous smile, closed mouth",
}


def gen(cid, n, seed0):
    out = HERE / "out" / cid
    out.mkdir(parents=True, exist_ok=True)
    meta = []
    for k in range(n):
        seed = seed0 + k
        payload = {
            "prompt": f"{COMMON}, {CHARS[cid]}", "negative_prompt": NEG,
            "width": 832, "height": 1216, "steps": 28, "cfg_scale": 5.5,
            "sampler_name": "Euler a", "seed": seed, "batch_size": 1,
        }
        r = requests.post(API, json=payload, timeout=600)
        r.raise_for_status()
        img = base64.b64decode(r.json()["images"][0])
        (out / f"base_{k}.png").write_bytes(img)
        meta.append({"k": k, "seed": seed, "prompt": payload["prompt"]})
        print(cid, k, seed, flush=True)
    (out / "base_meta.json").write_text(json.dumps({"negative": NEG, "items": meta}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    seed0 = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    for cid in (CHARS if which == "all" else [which]):
        gen(cid, n, seed0)
