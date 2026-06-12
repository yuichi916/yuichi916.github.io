"""Re-extract the 9 texture-broken enc_int_* interior prop GLBs.

The legacy enc_interiors_extract.py exported them with unresolved image
paths -> every material got a 1x1 placeholder (no baseColor) and the
props render flat grey on the island.  Same fix as fix9_reextract.py:
basename texture index remap -> reload -> 512px downscale -> GLB export,
OVERWRITING the broken outputs.  Object selection mirrors the original
SCENE_FILTERS so the visual content stays identical.
Run: blender -b --python eci_reextract.py
"""
import bpy, os

BLEND = r'C:\tmp\blends\eci\kb3d_enchantedinteriors-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       '..', 'assets', 'blender'))

SCENE_FILTERS = {
    'monlight': ['bookshelf', 'shelf', 'book', 'reading', 'chair', 'desk',
                 'scroll', 'candle', 'lantern', 'rug'],
    'oto':      ['watermill', 'wheel', 'workbench', 'barrel', 'crate',
                 'cog', 'bucket', 'pipe', 'lamp'],
    'tabi':     ['inn', 'bed', 'fireplace', 'hearth', 'table', 'chair',
                 'tankard', 'pot', 'rug', 'beam'],
    'toki':     ['pendulum', 'gear', 'cog', 'clock', 'cushion', 'pillar',
                 'arch', 'sphere'],
    'hoshi':    ['orrery', 'globe', 'astrolabe', 'bookshelf', 'chest',
                 'desk', 'shelf', 'candle', 'rug'],
    'takibi':   ['candle', 'wax', 'iron', 'stand', 'table', 'crate',
                 'bench', 'bowl'],
    'mizube':   ['loom', 'spinning', 'wheel', 'workbench', 'basket',
                 'cloth', 'rug', 'chair'],
    'amaoto':   ['pew', 'altar', 'candelabra', 'cross', 'arch', 'pillar',
                 'organ', 'banner'],
    'heya':     ['oven', 'kitchen', 'table', 'bread', 'basket',
                 'window', 'rug', 'bowl', 'shelf'],
}

_names_cache = None

def list_objs():
    global _names_cache
    if _names_cache is None:
        with bpy.data.libraries.load(BLEND, link=False) as (data_from, _):
            _names_cache = list(data_from.objects)
    return _names_cache


# The ECI kit's own KB3DTextures set was never downloaded (the 3GB blend
# is geometry-only, nothing packed).  Substitute the closest family from
# the KB3D Enchanted MAIN kit, which IS on disk — several families are
# exact counterparts (WoodHeartwoodAtlas, FoodAtlas, RopesTrim).
ECI_TO_ENC = {
    'KB3D_ECI_BooksAtlas':            'KB3D_ENC_AtlasGraphicsA',
    'KB3D_ECI_CandlesAtlas':          'KB3D_ENC_CandleWax',
    'KB3D_ECI_ChairAtlasB':           'KB3D_ENC_WoodOrangePolished',
    'KB3D_ECI_FabGoldCloth':          'KB3D_ENC_FabricPatternA',
    'KB3D_ECI_FabKingsHallCloth':     'KB3D_ENC_FabricPatternBlue',
    'KB3D_ECI_FabRedCloth':           'KB3D_ENC_FabricPatternRed',
    'KB3D_ECI_FabTavernClothTrim':    'KB3D_ENC_FabricB',
    'KB3D_ECI_FlagsBannersB':         'KB3D_ENC_FabricTentRed',
    'KB3D_ECI_FoodAtlas':             'KB3D_ENC_AtlasFoodA',
    'KB3D_ECI_KnightPropsAtlas':      'KB3D_ENC_ShieldsUnique',
    'KB3D_ECI_MetalDarkWorn':         'KB3D_ENC_MetalForgedBlackRustedA',
    'KB3D_ECI_MetalTrimA':            'KB3D_ENC_MetalForgedGrayA',
    'KB3D_ECI_RopesTrimM':            'KB3D_ENC_RopesTrimA',
    'KB3D_ECI_StoneCastleWall':       'KB3D_ENC_BrickStoneGray',
    'KB3D_ECI_StoneColumnsTrim':      'KB3D_ENC_StoneGrayLightTrim',
    'KB3D_ECI_StoneTrimA':            'KB3D_ENC_StoneGrayTrim',
    'KB3D_ECI_StoneTrimB':            'KB3D_ENC_StoneGrayLightTrimB',
    'KB3D_ECI_VFXFireAndSmoke':       'KB3D_ENC_EmissiveTrim',
    'KB3D_ECI_Wicker':                'KB3D_ENC_WickerDirtBrownA',
    'KB3D_ECI_WoodBarkWorn':          'KB3D_ENC_WoodBarkA',
    'KB3D_ECI_WoodBrightOldA':        'KB3D_ENC_WoodOldWornBrightA',
    'KB3D_ECI_WoodDamageGradientA':   'KB3D_ENC_WoodOldWornBrownBDamaged',
    'KB3D_ECI_WoodenBeams':           'KB3D_ENC_WoodOldWornBrownA',
    'KB3D_ECI_WoodGrayBrightOldA':    'KB3D_ENC_WoodOldWornGrayA',
    'KB3D_ECI_WoodHeartwoodAtlas':    'KB3D_ENC_WoodHeartwoodAtlas',
    'KB3D_ECI_WoodPolishedA':         'KB3D_ENC_WoodOrangePolished',
    'KB3D_ECI_WoodTable':             'KB3D_ENC_WoodPlankA',
    'KB3D_ECI_WoodVarnishedBrownTrim':'KB3D_ENC_WoodPaintTrim',
}

import re as _re
_ROLE_RE = _re.compile(r'_(basecolor|roughness|metallic|normal|height|opacity|emissive)\.', _re.I)

def _enc_substitute(basename, idx):
    """KB3D_ECI_<Fam>_<role>.png -> the mapped ENC family's same role file."""
    m = _ROLE_RE.search(basename)
    if not m:
        return None
    fam = basename[:m.start()]
    enc = ECI_TO_ENC.get(fam)
    if not enc:
        return None
    role = m.group(1).lower()
    for ext in ('.png', '.jpg', '.jpeg'):
        hit = idx.get(f'{enc}_{role}{ext}'.lower())
        if hit:
            return hit
    # role-suffix variants like _basecolor_2k.png
    prefix = f'{enc}_{role}'.lower()
    for k, v in idx.items():
        if k.startswith(prefix):
            return v
    return None


_TEX_INDEX = None

def _texture_index():
    global _TEX_INDEX
    if _TEX_INDEX is not None:
        return _TEX_INDEX
    _TEX_INDEX = {}
    for d in (
        r'C:\tmp\blends\eci\KB3DTextures',
        r'C:\tmp\blends\Textures',
        r'C:\tmp\blends\ti\KB3DTextures',
        r'C:\tmp\blends\val\Textures',
        r'C:\tmp\blends\dkf\Textures',
        r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\KB3DTextures',
    ):
        if not os.path.isdir(d):
            continue
        for root, _dirs, files in os.walk(d):
            for fn in files:
                _TEX_INDEX.setdefault(fn.lower(), os.path.join(root, fn))
    print(f'  [tex index] {len(_TEX_INDEX)} files', flush=True)
    return _TEX_INDEX


def fix_image_paths():
    idx = _texture_index()
    fixed = missing = packed = 0
    for img in bpy.data.images:
        try:
            if img.packed_file:
                packed += 1
                continue
            ap = bpy.path.abspath(img.filepath)
            if ap and os.path.exists(ap):
                continue
            base = os.path.basename(ap or img.name)
            hit = idx.get(base.lower()) or _enc_substitute(base, idx)
            if hit:
                img.filepath = hit
                fixed += 1
            else:
                missing += 1
                print(f'  [tex MISS] {base}', flush=True)
        except Exception:
            pass
    print(f'  [tex fix] remapped {fixed}, packed {packed}, unresolved {missing}', flush=True)


def downscale_all_images(cap):
    fix_image_paths()
    for img in bpy.data.images:
        try:
            img.reload()
        except Exception:
            pass
        try:
            if img.has_data and (img.size[0] > cap or img.size[1] > cap):
                img.scale(cap, cap)
                img.update()
                if hasattr(img, 'is_dirty') and not img.is_dirty:
                    try:
                        img.pack()
                    except Exception:
                        pass
        except Exception:
            pass


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_selected(out_path):
    kwargs = dict(
        filepath=out_path, export_format='GLB',
        use_selection=True, export_apply=True,
        export_materials='EXPORT', export_yup=True,
        export_image_format='JPEG',
    )
    for extra in (
        {'export_draco_mesh_compression_enable': True,
         'export_draco_mesh_compression_level': 10},
        {'export_jpeg_quality': 80},
    ):
        try:
            bpy.ops.export_scene.gltf(**dict(kwargs, **extra))
            kwargs.update(extra)
            return
        except TypeError:
            continue
        except Exception:
            continue
    bpy.ops.export_scene.gltf(**kwargs)


def main():
    try:
        all_names = list_objs()
        print(f'[ECI] {len(all_names)} objects in blend', flush=True)
    except Exception as e:
        print(f'[FAIL list] {e}', flush=True)
        return
    for scene_name, filters in SCENE_FILTERS.items():
        out_path = os.path.join(OUT_DIR, f'enc_int_{scene_name}.glb')
        matched = [n for n in all_names
                   if any(f in n.lower() for f in filters)][:20]
        if not matched:
            print(f'[SKIP no match] enc_int_{scene_name}', flush=True)
            continue
        print(f'[START] enc_int_{scene_name}: {len(matched)} objects', flush=True)
        reset_scene()
        ok = 0
        for nm in matched:
            try:
                bpy.ops.wm.append(directory=f"{BLEND}\\Object\\",
                                  filename=nm, link=False)
                ok += 1
            except Exception:
                pass
        if not ok:
            print(f'  [FAIL all appends] enc_int_{scene_name}', flush=True)
            continue
        downscale_all_images(512)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no mesh] enc_int_{scene_name}', flush=True)
            continue
        from mathutils import Vector
        all_co = []
        for o in meshes:
            for corner in o.bound_box:
                all_co.append(o.matrix_world @ Vector(corner))
        xs = [c.x for c in all_co]; ys = [c.y for c in all_co]; zs = [c.z for c in all_co]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        bz = min(zs)
        for o in meshes:
            if o.parent:
                continue
            o.location.x -= cx
            o.location.y -= cy
            o.location.z -= bz
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        try:
            if os.path.exists(out_path):
                os.remove(out_path)
            export_selected(out_path)
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] enc_int_{scene_name}.glb  {sz:.1f} MB', flush=True)
        except Exception as e:
            print(f'[FAIL export] enc_int_{scene_name}: {e}', flush=True)
    print('[DONE eci_reextract]', flush=True)


if __name__ == '__main__':
    main()
