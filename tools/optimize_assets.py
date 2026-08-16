from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "kototsugi" / "thumb.png"
target = root / "kototsugi" / "thumb.webp"

with Image.open(source) as image:
    image.convert("RGB").save(target, "WEBP", quality=84, method=6)

print(f"{source} -> {target} ({target.stat().st_size} bytes)")

# The root page previously referenced a non-existent OGP JPG. Create a compact
# 1200x630 WebP from the official key visual for reliable social previews.
og_dir = root / "assets" / "og"
og_dir.mkdir(parents=True, exist_ok=True)
og_target = og_dir / "index-1200x630.webp"
with Image.open(source) as image:
    image = image.convert("RGB")
    target_ratio = 1200 / 630
    current_ratio = image.width / image.height
    if current_ratio > target_ratio:
        crop_width = int(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = int(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))
    image.resize((1200, 630), Image.Resampling.LANCZOS).save(og_target, "WEBP", quality=84, method=6)
print(f"{source} -> {og_target} ({og_target.stat().st_size} bytes)")

for path in (target, og_target):
    with Image.open(path) as image:
        print(f"verified {path}: {image.size} {image.format}")
        if image.width == 0 or image.height == 0:
            raise RuntimeError(f"invalid image dimensions: {path}")

original_bytes = source.stat().st_size
optimized_bytes = target.stat().st_size
if optimized_bytes >= original_bytes:
    raise RuntimeError("thumbnail WebP is not smaller than source PNG")
print(f"thumbnail reduction: {original_bytes} -> {optimized_bytes} bytes")

# Keep this script out of the public site; it is only a reproducible build helper.
print("asset optimization complete")
  
  
