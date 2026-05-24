"""v632 - Per-scene re-extract from KB3D Enchanted .blend with:
  * **Circular footprint crop** via Boolean Intersect cylinder
  * **Decimate** to halve poly count (ratio 0.55)
  * **Texture cap** at 512 px (was 1024 in v615) — 75% smaller GLBs
  * Same per-scene prefixes as enc_extract_prefabs.py

Output: assets/blender/enc_prefab_<scene>_v632.glb
(suffix lets us keep v615 alongside as fallback while we A/B test the
smaller version client-side.)
"""
import bpy, os, math

BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

# Same 10 prefixes as v615 + per-scene CROP radius (Blender units = m).
# Smaller-than-bbox radius produces a tighter floating-island silhouette.
PREFABS = [
    ('plaza',    'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza_v632',    8.0),
    ('monlight', 'KB3D_ENC_BldgMdBookStore_A_',       'enc_prefab_monlight_v632', 9.0),
    ('oto',      'KB3D_ENC_BldgSmWatermill_A_',       'enc_prefab_oto_v632',      7.0),
    ('tabi',     'KB3D_ENC_BldgMdInn_A_',             'enc_prefab_tabi_v632',     8.5),
    ('toki',     'KB3D_ENC_BldgMdClockTower_A_',      'enc_prefab_toki_v632',     9.5),
    ('hoshi',    'KB3D_ENC_BldgMdAntiquarian_A_',     'enc_prefab_hoshi_v632',    9.0),
    ('takibi',   'KB3D_ENC_BldgMdCandleMaker_A_',     'enc_prefab_takibi_v632',   7.5),
    ('mizube',   'KB3D_ENC_BldgSmWeaver_A_',          'enc_prefab_mizube_v632',   7.0),
    ('amaoto',   'KB3D_ENC_BldgSmChurch_A_',          'enc_prefab_amaoto_v632',   8.5),
    ('heya',     'KB3D_ENC_BldgMdBaker_A_',           'enc_prefab_heya_v632',     7.0),
]


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
    """Boolean-intersect target_obj with a cylinder cutter centred at
    (cx, cy) of given radius. Modifies target in place."""
    # Create cutter cylinder
    bpy.ops.mesh.primitive_cylinder_add(radius=radius,
                                         depth=max(2.0, height_top - height_bot + 1.0),
                                         location=(cx, cy, (height_top + height_bot) / 2),
                                         vertices=48)
    cutter = bpy.context.active_object
    cutter.name = '_BOOL_CUTTER_TMP'
    mod = target_obj.modifiers.new('CircleCrop', 'BOOLEAN')
    mod.operation = 'INTERSECT'
    mod.object = cutter
    # Apply
    bpy.context.view_layer.objects.active = target_obj
    try:
        bpy.ops.object.modifier_apply(modifier='CircleCrop')
    except Exception as e:
        print(f'    [boolean apply failed]: {e}')
        target_obj.modifiers.remove(mod)
    # Remove cutter
    bpy.data.objects.remove(cutter, do_unlink=True)


def decimate_obj(obj, ratio=0.55):
    """Apply a Decimate modifier to halve the poly count."""
    if obj.type != 'MESH' or len(obj.data.polygons) < 200:
        return
    mod = obj.modifiers.new('Decimate', 'DECIMATE')
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.modifier_apply(modifier='Decimate')
    except Exception:
        obj.modifiers.remove(mod)


def main():
    print('[CROP+DECIMATE EXTRACT v632] start')
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

        # Image fix + 512 px cap (was 1024 in v615 — saves ~75% GPU mem)
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

        # Compute the world centroid of the appended mesh set
        all_co = []
        for o in meshes:
            for v in o.data.vertices:
                all_co.append(o.matrix_world @ v.co)
        if not all_co:
            print(f'  [SKIP no verts] {out_name}')
            continue
        xs = [c.x for c in all_co]; ys = [c.y for c in all_co]; zs = [c.z for c in all_co]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        bz = min(zs)

        # Recentre + bottom to z=0 (same as v615)
        for o in meshes:
            o.location.x -= cx
            o.location.y -= cy
            o.location.z -= bz
        # Refresh world matrices
        bpy.context.view_layer.update()

        # === Circular crop ===
        # Identify GROUND/PLATFORM meshes by name + Boolean-intersect them
        # with a tall cylinder of radius crop_r centred at origin. Other
        # objects (buildings, props) get DELETED if their centroid is
        # outside the radius.
        GROUND_TOKENS = ('Ground', 'Floor', 'Cobble', 'Paving', 'Path',
                         'Terrain', 'Street', 'Plaza')
        kept = []
        removed = 0
        cropped_count = 0
        for o in list(bpy.data.objects):
            if o.type != 'MESH': continue
            # Centroid in (now recentred) world coords
            obb_min = [1e9, 1e9, 1e9]
            obb_max = [-1e9, -1e9, -1e9]
            for v in o.data.vertices:
                wc = o.matrix_world @ v.co
                for i in range(3):
                    if wc[i] < obb_min[i]: obb_min[i] = wc[i]
                    if wc[i] > obb_max[i]: obb_max[i] = wc[i]
            ocx = (obb_min[0] + obb_max[0]) / 2
            ocy = (obb_min[1] + obb_max[1]) / 2
            # Ground-like? Boolean-crop.
            is_ground = any(t.lower() in o.name.lower() for t in GROUND_TOKENS)
            dist_from_centre = (ocx ** 2 + ocy ** 2) ** 0.5
            if is_ground:
                # Always crop the ground via boolean intersect
                boolean_circle_crop(o, 0.0, 0.0, crop_r, obb_max[2] + 0.5, obb_min[2] - 0.5)
                kept.append(o); cropped_count += 1
            elif dist_from_centre > crop_r + 1.0:
                # Building/prop too far out — delete
                bpy.data.objects.remove(o, do_unlink=True)
                removed += 1
            else:
                kept.append(o)
        print(f'  cropped {cropped_count} ground / removed {removed} out-of-circle / kept {len(kept)} total')

        # === Decimate the survivors ===
        decimated = 0
        for o in kept:
            if o.type == 'MESH':
                decimate_obj(o, ratio=0.55)
                decimated += 1
        print(f'  decimated {decimated} meshes (ratio 0.55)')

        # Select all surviving meshes for export
        bpy.ops.object.select_all(action='DESELECT')
        survivors = [o for o in bpy.data.objects if o.type == 'MESH']
        if not survivors:
            print(f'  [SKIP nothing left] {out_name}')
            continue
        for o in survivors: o.select_set(True)
        bpy.context.view_layer.objects.active = survivors[0]

        # Export
        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True,
                export_materials='EXPORT', export_yup=True,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=7,    # max compression
                export_image_format='JPEG', export_jpeg_quality=80,
            )
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] {out_name}.glb  meshes={len(survivors)}  size={sz:.1f}MB')
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}')

    print('\n[DONE CROP+DECIMATE EXTRACT v632]')


if __name__ == '__main__':
    main()
