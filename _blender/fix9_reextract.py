"""Re-extract the 9 texture-broken kit props (val_barrel / val_horn /
val_longbench / val_pillar / val_rune / val_shield, df_chain /
df_gargoyle / df_gate) that the legacy multi_pack_extract.py exported
with unresolved image paths (1x1 placeholder textures, no baseColor).

Uses the proven multi_pack_extract_v670.py machinery: basename texture
index remap -> reload -> 512px downscale -> pack -> GLB export.
OVERWRITES existing outputs (that is the point).
Run: blender -b --python fix9_reextract.py
"""
import bpy, os

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       '..', 'assets', 'blender'))

VAL_BLEND = r'C:\tmp\blends\val\KB3D_Valhalla-Native.blend'
DKF_BLEND = r'C:\tmp\blends\dkf\KB3D_DarkFantasy-Native.blend'

# (blend, out_name, [exact object names], tex_cap)
# Object names verified against the live blend inventories (2026-06-13).
JOBS = [
    (VAL_BLEND, 'val_barrel',    ['KB3D_VAL_BldgSM_I_BarrelA'],      512),
    (VAL_BLEND, 'val_horn',      ['KB3D_VAL_Mug_A_Main'],            512),
    (VAL_BLEND, 'val_longbench', ['KB3D_VAL_BldgSM_K_BenchA'],       512),
    (VAL_BLEND, 'val_pillar',    ['KB3D_VAL_BldgSM_K_StoneCircleC'], 512),
    (VAL_BLEND, 'val_rune',      ['KB3D_VAL_BldgSM_K_StoneCircleA'], 512),
    (VAL_BLEND, 'val_shield',    ['KB3D_VAL_Shield_A_Main'],         512),
    (DKF_BLEND, 'df_chain',      ['KB3D_DKF_ChainHook_A_Main'],      512),
    (DKF_BLEND, 'df_gargoyle',   ['KB3D_DKF_Statue_B_Main'],         512),
    (DKF_BLEND, 'df_gate',       ['KB3D_DKF_Gate_A_Main'],           512),
]

_names_cache = {}

def list_objs(blend):
    if blend not in _names_cache:
        with bpy.data.libraries.load(blend, link=False) as (data_from, _):
            _names_cache[blend] = list(data_from.objects)
    return _names_cache[blend]


_TEX_INDEX = None

def _texture_index():
    global _TEX_INDEX
    if _TEX_INDEX is not None:
        return _TEX_INDEX
    _TEX_INDEX = {}
    for d in (
        r'C:\tmp\blends\val\Textures',
        r'C:\tmp\blends\dkf\Textures',
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
    fixed = missing = 0
    for img in bpy.data.images:
        try:
            if img.packed_file:
                continue
            ap = bpy.path.abspath(img.filepath)
            if ap and os.path.exists(ap):
                continue
            hit = idx.get(os.path.basename(ap or img.name).lower())
            if hit:
                img.filepath = hit
                fixed += 1
            else:
                missing += 1
                print(f'  [tex MISS] {os.path.basename(ap or img.name)}', flush=True)
        except Exception:
            pass
    print(f'  [tex fix] remapped {fixed}, unresolved {missing}', flush=True)


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
    for blend, out_name, sel, cap in JOBS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        try:
            all_names = list_objs(blend)
        except Exception as e:
            print(f'[FAIL list] {blend}: {e}', flush=True)
            continue
        wanted = [n for n in sel if n in all_names]
        if not wanted:
            print(f'[SKIP no match] {out_name} (wanted {sel})', flush=True)
            continue
        print(f'[START] {out_name}: {wanted}', flush=True)
        reset_scene()
        ok = 0
        for nm in wanted:
            try:
                bpy.ops.wm.append(directory=f"{blend}\\Object\\",
                                  filename=nm, link=False)
                ok += 1
            except Exception as e:
                print(f'  [warn append] {nm}: {e}', flush=True)
        if not ok:
            print(f'  [FAIL all appends] {out_name}', flush=True)
            continue
        downscale_all_images(cap)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no mesh] {out_name}', flush=True)
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
            print(f'[OK] {out_name}.glb  {sz:.1f} MB', flush=True)
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}', flush=True)
    print('[DONE fix9_reextract]', flush=True)


if __name__ == '__main__':
    main()
