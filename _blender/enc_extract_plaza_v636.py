"""Plaza-only re-extract using the v636 cobble-Y normalisation.

The KB3D plaza prefab ships with the cobble TOP at z=5.46 in Blender,
which left bridges (placed at y=0 in niwa.html) floating 5.46 m below
the avatar. v636 shifts the prefab DOWN so the cobble surface ends at
z=0 in Blender (= y=0 after Y-up glTF export).

This script is a thin wrapper over enc_extract_cobbletop_v636.py — it
reuses every helper and the main() loop, but narrows PREFABS to just
plaza AND writes to the production filename (enc_prefab_plaza.glb,
without the _v636 suffix) so the freshly-extracted file overwrites
the broken one in-place.

Run:
    blender -b -P _blender/enc_extract_plaza_v636.py

After extraction, copy assets/blender/enc_prefab_plaza.glb to:
    P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_prefab_plaza.glb
and wait for pCloud Drive sync.
"""
import os, sys

# Import the v636 module (same directory).
_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _DIR)
import enc_extract_cobbletop_v636 as v636

# Narrow PREFABS to plaza only AND write to production filename
# (no _v636 suffix) so the existing asset is overwritten in place.
v636.PREFABS = [
    ('plaza', 'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza', 8.0),
]

# Force overwrite even if file exists (v636 skips when present).
import bpy

def _patched_main():
    print('[plaza-v636] start (single-prefab re-extract)')
    out_path = os.path.join(v636.OUT_DIR, 'enc_prefab_plaza.glb')
    if os.path.exists(out_path):
        print(f'[plaza-v636] removing existing {out_path}')
        os.remove(out_path)
    v636.main()
    print('[plaza-v636] done.  Upload to pCloud:')
    print(f'  src: {out_path}')
    print('  dst: P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_prefab_plaza.glb')


if __name__ == '__main__':
    _patched_main()
