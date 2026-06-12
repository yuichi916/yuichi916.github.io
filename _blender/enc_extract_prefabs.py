"""Extract ENC SCENE PREFABS — whole building groups (Building + Ground + props
+ cobblestones + lamps + ...) as a single multi-mesh GLB with ORIGINAL world
positions preserved. This is how KB3D ships its dioramas — extracting individual
buildings broke the relative ground/path positioning.

Strategy:
  For each prefab (e.g. KB3D_ENC_BldgSmLowerTownSquare_A_*):
    1. Start with an empty scene
    2. wm.append every object that begins with the prefix
    3. Resolve image paths + downscale to 1024 + rewire materials
    4. Export ALL appended objects as one multi-mesh GLB (positions kept)
"""
import bpy, os

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

# Map: niwa scene name → (prefab prefix, output filename)
PREFABS = [
    ('plaza',    'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza'),
    ('monlight', 'KB3D_ENC_BldgMdBookStore_A_',       'enc_prefab_monlight'),
    ('oto',      'KB3D_ENC_BldgSmWatermill_A_',       'enc_prefab_oto'),
    ('tabi',     'KB3D_ENC_BldgMdInn_A_',             'enc_prefab_tabi'),
    ('toki',     'KB3D_ENC_BldgMdClockTower_A_',      'enc_prefab_toki'),
    ('hoshi',    'KB3D_ENC_BldgMdAntiquarian_A_',     'enc_prefab_hoshi'),
    ('takibi',   'KB3D_ENC_BldgMdCandleMaker_A_',     'enc_prefab_takibi'),
    ('mizube',   'KB3D_ENC_BldgSmWeaver_A_',          'enc_prefab_mizube'),
    ('amaoto',   'KB3D_ENC_BldgSmChurch_A_',          'enc_prefab_amaoto'),
    ('heya',     'KB3D_ENC_BldgMdBaker_A_',           'enc_prefab_heya'),
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
                elif 'opacity' in nm: found.setdefault('opacity', n.image)
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
        if 'opacity' in imgs:
            try: nt.links.new(tx.outputs['Alpha'], bsdf.inputs['Alpha'])
            except Exception: pass
    else:
        bsdf.inputs['Base Color'].default_value = (0.55, 0.50, 0.45, 1.0)
    if 'roughness' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['roughness']
        tx.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = 0.85
    if 'metallic' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['metallic']
        tx.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Metallic'])
    if 'normal' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['normal']
        tx.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tx.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def list_prefab_objects(prefix):
    """Open the master .blend just to get the object list for this prefix."""
    # Use library API to peek without full load
    objs = []
    with bpy.data.libraries.load(BLEND, link=False) as (data_from, _):
        for name in data_from.objects:
            if name.startswith(prefix):
                objs.append(name)
    return objs


def main():
    print(f'[ENC PREFAB EXTRACT] start')

    for scene_name, prefix, out_name in PREFABS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        if os.path.exists(out_path):
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[SKIP exists] {out_name}.glb  ({sz:.1f} MB)')
            continue
        print(f'\n[START] {out_name}  prefix={prefix}')
        reset_scene()
        # Discover names in the .blend (library API — does not load mesh data)
        try:
            names_to_append = list_prefab_objects(prefix)
        except Exception as e:
            print(f'[FAIL list] {out_name}: {e}')
            continue
        if not names_to_append:
            print(f'[SKIP no objects] {out_name}')
            continue
        print(f'  matched {len(names_to_append)} objects')

        # Append each object into the empty scene
        appended = 0
        for nm in names_to_append:
            try:
                bpy.ops.wm.append(
                    directory=f"{BLEND}\\Object\\",
                    filename=nm,
                    link=False,
                )
                appended += 1
            except Exception as e:
                pass
        print(f'  appended {appended}/{len(names_to_append)}')

        # Image path fix + downscale + reload
        for img in bpy.data.images:
            fp = img.filepath
            if not fp: continue
            new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
            if new_fp != fp: img.filepath = new_fp
            try:
                img.reload()
                if img.has_data and (img.size[0] > 1024 or img.size[1] > 1024):
                    img.scale(1024, 1024)
            except Exception: pass

        for mat in bpy.data.materials:
            try: rewire(mat)
            except Exception: pass

        # Select all mesh objects, normalize so the group's bbox-bottom sits at z=0
        bpy.ops.object.select_all(action='DESELECT')
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no meshes] {out_name}')
            continue
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]

        # Compute group bbox + shift everything so base is at z=0 and centred in XY
        all_co = []
        for o in meshes:
            for v in o.data.vertices:
                all_co.append(o.matrix_world @ v.co)
        if all_co:
            xs=[c.x for c in all_co]; ys=[c.y for c in all_co]; zs=[c.z for c in all_co]
            cx = (min(xs)+max(xs))/2; cy = (min(ys)+max(ys))/2; bz = min(zs)
            bbox = (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
            for o in meshes:
                o.location.x -= cx
                o.location.y -= cy
                o.location.z -= bz
        else:
            bbox = (0,0,0)

        # Export multi-mesh GLB (positions retained as in original)
        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True,
                export_materials='EXPORT', export_yup=True,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=6,
                export_image_format='JPEG', export_jpeg_quality=85,
            )
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] {out_name}.glb  meshes={len(meshes)}  size={sz:.1f}MB  bbox={bbox[0]:.1f}×{bbox[1]:.1f}×{bbox[2]:.1f}m')
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}')

    print('\n[DONE PREFAB EXTRACT]')


if __name__ == '__main__':
    main()
