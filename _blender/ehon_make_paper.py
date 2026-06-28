import numpy as np
from PIL import Image
rng = np.random.default_rng(7)
W,H = 1600,2000
# multi-octave soft noise → watercolor paper grain
acc = np.zeros((H,W),np.float32)
for oct,(s,a) in enumerate([(1,0.5),(2,0.3),(4,0.15),(8,0.08)]):
    small = rng.random((max(1,H//(8//s if s<8 else 1)), max(1,W//(8//s if s<8 else 1)))).astype(np.float32)
    img = np.asarray(Image.fromarray((small*255).astype(np.uint8)).resize((W,H), Image.BILINEAR),np.float32)/255.0
    acc += (img-0.5)*a
acc = (acc-acc.min())/(acc.max()-acc.min())
# low-contrast cream paper around mid-grey for SOFT_LIGHT (keeps tone, adds tooth)
g = 0.5 + (acc-0.5)*0.35
base = np.stack([g*1.00, g*0.99, g*0.96],-1)  # faint warm
out = (np.clip(base,0,1)*255).astype(np.uint8)
Image.fromarray(out).save(r'C:\tmp\ehon\paper.png')
print('PAPER_DONE', out.shape)
