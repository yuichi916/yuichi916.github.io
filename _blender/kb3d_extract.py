"""KB3D Dark Fantasy — extract hand-picked hero assets as individual GLBs.
Strategy:
  - Open the master .blend
  - For each target name, isolate the object, recentre, export as GLB
  - Use Draco mesh compression to keep file size web-friendly
  - Output name = lowercased + 'kb3d_' prefix (e.g. 'kb3d_fountain_a.glb')
"""
import bpy, os

BLEND = r'P:\CG fanbook\KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

# Hand-picked targets aimed at floating-island dark-fantasy worldview.
# (orig name in .blend, output GLB name, scene-purpose)
TARGETS = [
    # Central fountain — plaza hero
    ('KB3D_DKF_Fountain_A_Main', 'kb3d_fountain', 'plaza-center / mizube'),
    # Towers — silhouette skyline
    ('KB3D_DKF_Tower_A_Main', 'kb3d_tower_a', 'plaza-edge tall building'),
    ('KB3D_DKF_Tower_D_Main', 'kb3d_tower_d', 'monlight 5-tier pagoda equivalent'),
    ('KB3D_DKF_Tower_J_Main', 'kb3d_tower_small', 'small watch-tower'),
    ('KB3D_DKF_Tower_M_Main', 'kb3d_tower_grand', 'big hero tower (toki/hoshi)'),
    # Statues — image-2 totems
    ('KB3D_DKF_Statue_A_Main', 'kb3d_statue_a', 'plaza guardian'),
    ('KB3D_DKF_Statue_B_Main', 'kb3d_statue_b', 'plaza counterpart'),
    ('KB3D_DKF_Statue_E_Main', 'kb3d_statue_e', 'hero shrine statue'),
    # Gates
    ('KB3D_DKF_Gate_B_Main', 'kb3d_gate_b', 'fortress gate'),
    ('KB3D_DKF_Gate_C_Main', 'kb3d_gate_c', 'wide gate'),
    # Doors (small detail-add for buildings)
    ('KB3D_DKF_Door_E_Main', 'kb3d_door_e', 'door detail'),
    # Torch + small props
    ('KB3D_DKF_Torch_A_Main', 'kb3d_torch', 'magical torch'),
    ('KB3D_DKF_Barrel_A_Main', 'kb3d_barrel', 'market barrel'),
    ('KB3D_DKF_Firewood_A_Main', 'kb3d_firewood', 'firewood pile'),
    # Chain hook — used for the floating-island chain bridges (LITERALLY)
    ('KB3D_DKF_ChainHook_A_Main', 'kb3d_chainhook', 'chain-bridge anchor'),
    # Buildings — small / medium houses for kominka replacements
    ('KB3D_DKF_BldgSM_F_Main', 'kb3d_bldg_sm_f', 'small house A'),
    ('KB3D_DKF_BldgSM_G_Main', 'kb3d_bldg_sm_g', 'small house B'),
    ('KB3D_DKF_BldgMD_E_Main', 'kb3d_bldg_md_e', 'medium house'),
    ('KB3D_DKF_BldgSM_C_Main', 'kb3d_bldg_sm_c', 'tall narrow house'),
    # Railing — for bridges / fences
    ('KB3D_DKF_Railing_A_Main', 'kb3d_railing', 'bridge railing'),
]

print(f'[KB3D EXTRACT] Opening {BLEND}')
bpy.ops.wm.open_mainfile(filepath=BLEND)

# Get list of all source objects
all_objs = {o.name: o for o in bpy.data.objects}
missing = [t[0] for t in TARGETS if t[0] not in all_objs]
if missing:
    print(f'[WARN] {len(missing)} missing in .blend:')
    for m in missing: print(f'   - {m}')

for src_name, out_name, purpose in TARGETS:
    src = all_objs.get(src_name)
    if not src or src.type != 'MESH':
        print(f'[SKIP] {src_name}')
        continue

    # Deselect everything
    bpy.ops.object.select_all(action='DESELECT')

    # Make a copy isolated to the world
    bpy.context.view_layer.objects.active = src
    src.select_set(True)
    bpy.ops.object.duplicate(linked=False)
    dup = bpy.context.active_object
    dup.name = f'EXPORT_{out_name}'

    # Apply transforms (some KB3D objs have heavy parent transforms)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Move to world origin (centre of mass at 0,0,0)
    bpy.context.scene.cursor.location = (0, 0, 0)
    # Compute current bounding box centre, then offset object so XY centre is (0,0)
    # and bottom (min Z) sits on 0.
    if dup.data.vertices:
        verts_co = [dup.matrix_world @ v.co for v in dup.data.vertices]
        min_x = min(v.x for v in verts_co); max_x = max(v.x for v in verts_co)
        min_y = min(v.y for v in verts_co); max_y = max(v.y for v in verts_co)
        min_z = min(v.z for v in verts_co)
        cx = (min_x + max_x) / 2
        cy = (min_y + max_y) / 2
        # Reposition the object so its XY centre is at 0,0 and base is at z=0
        dup.location.x -= cx
        dup.location.y -= cy
        dup.location.z -= min_z
        # Apply that translation
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # Select only the duplicate for export
    bpy.ops.object.select_all(action='DESELECT')
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup

    out_path = os.path.join(OUT_DIR, out_name + '.glb')
    try:
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_materials='EXPORT',
            export_yup=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
        )
        verts = len(dup.data.vertices)
        sz = os.path.getsize(out_path) / 1024
        print(f'[OK] {out_name}.glb  verts={verts}  size={sz:.0f}KB  ({purpose})')
    except Exception as e:
        print(f'[FAIL] {out_name}: {e}')

    # Delete the duplicate so the next iteration is clean
    bpy.data.objects.remove(dup, do_unlink=True)

print('[DONE KB3D EXTRACT]')
