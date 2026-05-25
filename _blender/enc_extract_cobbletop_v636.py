"""v636 - Per-scene re-extract with COBBLE TOP normalised to z=0.

The previous v632 extract used `o.location.z -= min(z)` so the bottom
of the rocky pedestal landed at z=0 — but that left the COBBLE TOP
floating at z=2-5m, which broke the "procedurals at y=0 sit on cobble"
assumption and produced the persistent 二層構造 the user kept seeing.

v636 instead:
  1. Identifies GROUND/FLOOR/COBBLE/PAVING/PATH meshes by name
  2. Computes their MAX z across all vertices → cobbleTop
  3. Shifts the entire prefab DOWN by cobbleTop so the cobble surface
     ends at z=0 in Blender (= y=0 in glTF after Y-up export)
  4. Rocky underside ends up at z < 0 — exactly where the JS
     makeFloatingBase cone expects to attach

Same circular Boolean crop + Decimate + 512-px textures as v632.
"""
import bpy, os

BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

PREFABS = [
    ('plaza',    'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza_v636',    8.0),
    ('monlight', 'KB3D_ENC_BldgMdBookStore_A_',       'enc_prefab_monlight_v636', 9.0),
    ('oto',      'KB3D_ENC_BldgSmWatermill_A_',       'enc_prefab_oto_v636',      7.0),
    ('tabi',     'KB3D_ENC_BldgMdInn_A_',             'enc_prefab_tabi_v636',     8.5),
    ('toki',     'KB3D_ENC_BldgMdClockTower_A_',      'enc_prefab_toki_v636',     9.5),
    ('hoshi',    'KB3D_ENC_BldgMdAntiquarian_A_',     'enc_prefab_hoshi_v636',    9.0),
    ('takibi',   'KB3D_ENC_BldgMdCandleMaker_A_',     'enc_prefab_takibi_v636',   7.5),
    ('mizube',   'KB3D_ENC_BldgSmWeaver_A_',          'enc_prefab_mizube_v636',   7.0),
    ('amaoto',   'KB3D_ENC_BldgSmChurch_A_',          'enc_prefab_amaoto_v636',   8.5),
    ('heya',     'KB3D_ENC_BldgMdBaker_A_',           'enc_prefab_heya_v636',     7.0),
]

GROUND_TOKENS = ('Ground', 'Floor', 'Cobble', 'Paving', 'Path',
                 'Terrain', 'Street', 'Plaza')


def find_images_by_role(nt):
    found = {}
    def walk(t):
        for n in t.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                nm = n.image.name.lower()
                if 'basecolor' in nm or 'diffuse' in nm or 'albedo' in nm:
                    found.setdefault('basecolor', n.image)
                elif 'roughness' in nm: found.setdefault('roughness', n.image)
                elif 'metallic' in nm or 'metal' in nm: found.setdefault('metallic', n.image)
                elif 'normal' in nm or '_n.' in nm: found.setdefault('normal', n.image)
            elif n.type == 'GROUP' and n.node_tree: walk(n.node_tree)
    walk(nt)
    return found


def rewire(mat):
    if not mat.use_nodes: mat.use_nodes = True
    nt = mat.node_tree
    imgs = find_images_by_role(nt)
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if 'basecolor' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['basecolor']
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.55, 0.50, 0.45, 1.0)
    if 'roughness' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['roughness']
        tx.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Roughness'])
    if 'normal' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['normal']
        tx.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tx.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def list_prefab_objects(prefix):
    objs = []
    with bpy.data.libraries.load(BLEND, link=False) as (data_from, _):
        for name in data_from.objects:
            if name.startswith(prefix):
                objs.append(name)
    return objs


def boolean_circle_crop(target_obj, cx, cy, radius, height_top, height_bot):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius,
                                         depth=max(2.0, height_top - height_bot + 1.0),
                                         location=(cx, cy, (height_top + height_bot) / 2),
                                         vertices=48)
    cutter = bpy.context.active_object
    cutter.name = '_BOOL_CUTTER_TMP'
    mod = target_obj.modifiers.new('CircleCrop', 'BOOLEAN')
    mod.operation = 'INTERSECT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = target_obj
    try:
        bpy.ops.object.modifier_apply(modifier='CircleCrop')
    except Exception:
        target_obj.modifiers.remove(mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def decimate_obj(obj, ratio=0.55):
    if obj.type != 'MESH' or len(obj.data.polygons) < 200:
        return
    mod = obj.modifiers.new('Decimate', 'DECIMATE')
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.modifier_apply(modifier='Decimate')
    except Exception:
        obj.modifiers.remove(mod)


def find_cobble_top_z(meshes):
    """Walk every vertex of meshes whose name contains a ground token
    and return their MAX world-Z. That's the cobble surface height."""
    max_z = None
    for o in meshes:
        if not any(t.lower() in o.name.lower() for t in GROUND_TOKENS):
            continue
        for v in o.data.vertices:
            wc = o.matrix_world @ v.co
            if max_z is None or wc.z > max_z:
                max_z = wc.z
    return max_z


def main():
    print('[COBBLE-TOP NORMALIZE EXTRACT v636] start')
    for scene_name, prefix, out_name, crop_r in PREFABS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        if os.path.exists(out_path):
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[SKIP exists] {out_name}.glb  ({sz:.1f} MB)')
            continue
        print(f'\n[START] {out_name}  r={crop_r}m  prefix={prefix}')
        reset_scene()
        try:
            names_to_append = list_prefab_objects(prefix)
        except Exception as e:
            print(f'[FAIL list] {out_name}: {e}')
            continue
        if not names_to_append:
            print(f'[SKIP no objects] {out_name}')
            continue
        print(f'  matched {len(names_to_append)} objects')

        appended = 0
        for nm in names_to_append:
            try:
                bpy.ops.wm.append(directory=f"{BLEND}\\Object\\", filename=nm, link=False)
                appended += 1
            except Exception:
                pass
        print(f'  appended {appended}/{len(names_to_append)}')

        # Image cap 512
        for img in bpy.data.images:
            fp = img.filepath
            if not fp: continue
            new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
            if new_fp != fp: img.filepath = new_fp
            try:
                img.reload()
                if img.has_data and (img.size[0] > 512 or img.size[1] > 512):
                    img.scale(512, 512)
            except Exception: pass

        for mat in bpy.data.materials:
            try: rewire(mat)
            except Exception: pass

        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no meshes] {out_name}')
            continue

        # === Step 1: XY centroid (centre the prefab horizontally) ===
        all_co = []
        for o in meshes:
            for v in o.data.vertices:
                all_co.append(o.matrix_world @ v.co)
        if not all_co:
            print(f'  [SKIP no verts] {out_name}')
            continue
        xs = [c.x for c in all_co]; ys = [c.y for c in all_co]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        for o in meshes:
            o.location.x -= cx
            o.location.y -= cy
        bpy.context.view_layer.update()

        # === Step 2: COBBLE TOP normalisation (the v636 fix) ===
        cobble_top = find_cobble_top_z(meshes)
        if cobble_top is None:
            # No named ground found — fall back to overall min Z (v632 behaviour)
            print(f'  [WARN] no ground-named meshes — falling back to min(z)=0')
            zs = [c.z for c in all_co]
            shift_z = min(zs)
        else:
            print(f'  cobble top z = {cobble_top:.2f}  (shifting down so cobble TOP = 0)')
            shift_z = cobble_top
        for o in meshes:
            o.location.z -= shift_z
        bpy.context.view_layer.update()

        # === Step 3: circular crop ===
        kept = []; removed = 0; cropped_count = 0
        for o in list(bpy.data.objects):
            if o.type != 'MESH': continue
            obb_min = [1e9, 1e9, 1e9]
            obb_max = [-1e9, -1e9, -1e9]
            for v in o.data.vertices:
                wc = o.matrix_world @ v.co
                for i in range(3):
                    if wc[i] < obb_min[i]: obb_min[i] = wc[i]
                    if wc[i] > obb_max[i]: obb_max[i] = wc[i]
            ocx = (obb_min[0] + obb_max[0]) / 2
            ocy = (obb_min[1] + obb_max[1]) / 2
            is_ground = any(t.lower() in o.name.lower() for t in GROUND_TOKENS)
            dist_from_centre = (ocx ** 2 + ocy ** 2) ** 0.5
            if is_ground:
                boolean_circle_crop(o, 0.0, 0.0, crop_r, obb_max[2] + 0.5, obb_min[2] - 0.5)
                kept.append(o); cropped_count += 1
            elif dist_from_centre > crop_r + 1.0:
                bpy.data.objects.remove(o, do_unlink=True)
                removed += 1
            else:
                kept.append(o)
        print(f'  cropped {cropped_count} ground / removed {removed} / kept {len(kept)}')

        # === Step 4: Decimate ===
        for o in kept:
            if o.type == 'MESH':
                decimate_obj(o, ratio=0.55)

        # === Step 5: Export ===
        bpy.ops.object.select_all(action='DESELECT')
        survivors = [o for o in bpy.data.objects if o.type == 'MESH']
        if not survivors:
            print(f'  [SKIP nothing left] {out_name}')
            continue
        for o in survivors: o.select_set(True)
        bpy.context.view_layer.objects.active = survivors[0]
        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True,
                export_materials='EXPORT', export_yup=True,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=7,
                export_image_format='JPEG', export_jpeg_quality=80,
            )
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] {out_name}.glb  meshes={len(survivors)}  size={sz:.1f}MB')
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}')

    print('\n[DONE COBBLE-TOP NORMALIZE EXTRACT v636]')


if __name__ == '__main__':
    main()
