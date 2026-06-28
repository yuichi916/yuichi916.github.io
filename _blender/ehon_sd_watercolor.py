"""reForge/SDXL 水彩img2img。Blenderレンダ(procedural水彩)を本格的な絵本水彩に変換。
   python ehon_sd_watercolor.py <input.png> <output.png> [denoise] [seed]
   reForge API (http://127.0.0.1:7860) が起動している前提。
"""
import base64, json, sys, urllib.request
from PIL import Image

API = 'http://127.0.0.1:7860'
INP = sys.argv[1]
OUTP = sys.argv[2]
DENOISE = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7

W, H = Image.open(INP).size
with open(INP, 'rb') as f:
    init = base64.b64encode(f.read()).decode()

payload = {
    "init_images": [init],
    "denoising_strength": DENOISE,
    "prompt": ("watercolor storybook illustration, whimsical fairytale wizard castle on a small "
               "island, soft watercolor wash, delicate ink line art, warm earthy colors, "
               "children's pop-up picture book art, hand-painted, paper texture, fantasy, "
               "highly detailed, masterpiece, soft daylight"),
    "negative_prompt": ("photo, photorealistic, 3d render, cgi, octane, blurry, lowres, jpeg "
                        "artifacts, text, watermark, signature, people, person, character, nsfw, "
                        "ugly, oversaturated, frame, border"),
    "steps": 30, "cfg_scale": 6.5, "sampler_name": "DPM++ 2M Karras",
    "width": W, "height": H, "seed": SEED, "resize_mode": 0,
}
req = urllib.request.Request(API + '/sdapi/v1/img2img',
                             data=json.dumps(payload).encode(),
                             headers={'Content-Type': 'application/json'})
r = json.loads(urllib.request.urlopen(req, timeout=600).read())
open(OUTP, 'wb').write(base64.b64decode(r['images'][0]))
print('SD_DONE', OUTP, W, H, 'denoise', DENOISE)
