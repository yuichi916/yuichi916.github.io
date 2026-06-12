"""v670 multi-kit extractor: pull the curated commercial-scene accents
from Treasure Island / Valhalla / Dark Fantasy into assets/blender/.

Differences from ti_extract_v2.py:
  * multi-kit (TIS / VAL / DKF) in one run
  * exact-name selection via the `_Main` joined meshes (inventory-driven,
    no fuzzy filters) + multi-object support for the TIS Ship hierarchy
  * 512px texture cap (props are now seen close-up in 1P), ship at 1024
Run: blender -b --python multi_pack_extract_v670.py
"""
import bpy, os

BASE = r'P:\CG fanbook\3D assets'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

def _prefer_local(local, remote):
    """pCloud Drive streaming stalls on multi-GB appends — use the local
    copy under C:\\tmp\\blends when it exists (same workaround as the
    .blend local-copy rule in feedback_no_quality_compromise)."""
    return local if os.path.exists(local) else remote

TI_BLEND = _prefer_local(
    r'C:\tmp\blends\ti\KB3D_TreasureIsland-Native.blend',
    os.path.join(BASE, r'Kitbash3D - Treasure Island BLENDER\Native (1)\KB3D_TreasureIsland-Native.blend'))
VAL_BLEND = _prefer_local(
    r'C:\tmp\blends\val\KB3D_Valhalla-Native.blend',
    os.path.join(BASE, r'KitBash3D - Valhalla\Blender\KB3D_Valhalla-Native.blend'))
DKF_BLEND = _prefer_local(
    r'C:\tmp\blends\dkf\KB3D_DarkFantasy-Native.blend',
    os.path.join(BASE, r'KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'))

# (blend, out_name, [exact object names] OR prefix string, tex_cap)
JOBS = [
    (TI_BLEND, 'ti_ship',      'KB3D_TIS_Ship_A_',               1024),
    (TI_BLEND, 'ti_boat',      ['KB3D_TIS_Boat_A_Main'],          512),
    (TI_BLEND, 'ti_hammock',   ['KB3D_TIS_Hammock_A_Main'],       512),
    (TI_BLEND, 'ti_flag',      ['KB3D_TIS_Flag_A_Main'],          512),
    (TI_BLEND, 'ti_torch',     ['KB3D_TIS_Torch_A_Main'],         512),
    (VAL_BLEND, 'val_bonfire', ['KB3D_VAL_Bonfire_A_Main'],       512),
    (VAL_BLEND, 'val_totem_a', ['KB3D_VAL_Totem_A_Main'],         512),
    (VAL_BLEND, 'val_totem_b', ['KB3D_VAL_Totem_B_Main'],         512),
    (VAL_BLEND, 'val_fishrack',['KB3D_VAL_FishRack_A_Main'],      512),
    (VAL_BLEND, 'val_firewood',['KB3D_VAL_Firewood_A_Main'],      512),
    (VAL_BLEND, 'val_dummy',   ['KB3D_VAL_PractiseDummy_A_Main'], 512),
    (DKF_BLEND, 'df_statue',   ['KB3D_DKF_Statue_A_Main'],        512),
    (DKF_BLEND, 'df_fountain', ['KB3D_DKF_Fountain_A_Main'],      512),
    (DKF_BLEND, 'df_torch',    ['KB3D_DKF_Torch_A_Main'],         512),
]

_names_cache = {}

def list_objs(blend):
    if blend not in _names_cache:
        with bpy.data.libraries.load(blend, link=False) as (data_from, _):
            _names_cache[blend] = list(data_from.objects)
    return _names_cache[blend]


def downscale_all_images(cap):
    for img in bpy.data.images:
        try:
            img.reload()
        except Exception:
            pass
        try:
            if img.has_data and (img.size[0] > cap or img.size[1] > cap):
                img.scale(cap, cap)
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
    # Optional args vary across Blender versions — probe then export once.
    for extra in (
        {'export_draco_mesh_compression_enable': True,
         'export_draco_mesh_compression_level': 10},
        {'export_jpeg_quality': 80},
    ):
        try:
            bpy.ops.export_scene.gltf(**dict(kwargs, **extra))
            kwargs.update(extra)
            return   # export already succeeded with extras
        except TypeError:
            continue   # unsupported kwarg — try next combination
        except Exception:
            continue
    bpy.ops.export_scene.gltf(**kwargs)


def main():
    for blend, out_name, sel, cap in JOBS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        if os.path.exists(out_path):
            print(f'[SKIP exists] {out_name}.glb', flush=True)
            continue
        try:
            all_names = list_objs(blend)
        except Exception as e:
            print(f'[FAIL list] {blend}: {e}', flush=True)
            continue
        if isinstance(sel, str):
            wanted = [n for n in all_names
                      if n.startswith(sel) and not n.endswith('_grp')]
        else:
            wanted = [n for n in sel if n in all_names]
        if not wanted:
            print(f'[SKIP no match] {out_name}', flush=True)
            continue
        print(f'[START] {out_name}: {len(wanted)} objects', flush=True)
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
        # bottom-center the combined bbox at the origin
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
            if o.parent:   # ship parts may share a parent empty — move roots only
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
            export_selected(out_path)
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] {out_name}.glb  {sz:.1f} MB', flush=True)
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}', flush=True)
    print('[DONE multi_pack_extract_v670]', flush=True)


if __name__ == '__main__':
    main()
