"""Soul Smoker single-prop extract from KB3D Enchanted Interiors.

Output: assets/blender/enc_int_soul_smoker.glb
Run:   blender -b -P _blender/enc_extract_int_soul_smoker.py

After extraction, copy to:
  P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_int_soul_smoker.glb
"""
import os, sys
_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _DIR)
import enc_extract_cobbletop_v636 as v636

# Override source blend + prefab list for Soul Smoker
v636.BLEND = r'P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors-native.blend'
# KB3D naming conventions vary — try ENI_SoulSmoker, then alternates if main loop finds 0 objects
v636.PREFABS = [
    ('soul_smoker', 'KB3D_ENI_SoulSmoker', 'enc_int_soul_smoker', 2.5),
]
# Interior props rarely have "Ground"-named meshes — loosen the tokens so
# the cobble-Y normalization doesn't crash on missing ground.  Falls back
# to overall min Z when no token matches.
v636.GROUND_TOKENS = ('Base', 'Floor', 'Ground', 'Plinth')

import bpy


def _try_alternate_prefixes():
    """If the main prefix matched nothing, scan blend for any object
    whose name contains 'soul' or 'smoker' and report candidates."""
    matched = []
    with bpy.data.libraries.load(v636.BLEND, link=False) as (data_from, _):
        for nm in data_from.objects:
            low = nm.lower()
            if 'soul' in low or 'smoker' in low:
                matched.append(nm)
    return matched


def _patched_main():
    out = os.path.join(v636.OUT_DIR, 'enc_int_soul_smoker.glb')
    if os.path.exists(out):
        print(f'[soul-smoker] removing existing {out}')
        os.remove(out)
    # Pre-scan to confirm prefix
    print('[soul-smoker] pre-scanning blend for soul/smoker matches...')
    candidates = _try_alternate_prefixes()
    print(f'[soul-smoker] found {len(candidates)} candidate objects:')
    for nm in candidates[:20]:
        print(f'  - {nm}')
    if candidates and not any(nm.startswith('KB3D_ENI_SoulSmoker') for nm in candidates):
        # Pick the most common prefix
        prefixes = {}
        for nm in candidates:
            head = nm.rsplit('_', 1)[0] + '_'
            prefixes[head] = prefixes.get(head, 0) + 1
        best = max(prefixes.items(), key=lambda kv: kv[1])[0]
        print(f'[soul-smoker] adapting prefix → {best}')
        v636.PREFABS = [('soul_smoker', best, 'enc_int_soul_smoker', 2.5)]
    v636.main()
    print('[soul-smoker] done.  Please upload to pCloud:')
    print(f'  src: {out}')
    print('  dst: P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_int_soul_smoker.glb')


if __name__ == '__main__':
    _patched_main()
