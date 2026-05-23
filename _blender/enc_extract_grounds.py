"""Extract ENC ground/plaza pieces (full PBR + 1024 JPG q85)."""
import bpy, os, math

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

TARGETS = [
    ('KB3D_ENC_BldgSmLowerTownSquare_A_Ground', 'enc_townsquare_ground', 'cobble plaza ground (5549)'),
    ('KB3D_ENC_BldgSmUpperTownSquare_A_Floor',  'enc_townsquare_floor',  'plaza floor tiles (1870)'),
    ('KB3D_ENC_BldgSmUpperTownSquare_A_Building', 'enc_townsquare_upper', 'upper town square building hero (71214)'),
    ('KB3D_ENC_BldgLgCastleKeep_A_Ground',       'enc_castle_ground',     'castle ground (668)'),
    ('KB3D_ENC_BldgMdHerbalist_A_Ground',        'enc_herbalist_ground',  'shop ground patch (5066)'),
    ('KB3D_ENC_BldgMdAntiquarian_A_Ground',      'enc_antiquarian_ground','antiquarian ground (4614)'),
    ('KB3D_ENC_BldgLgManor_A_Ground',            'enc_manor_ground',      'manor ground (4022)'),
    ('KB3D_ENC_BldgLgCastleKeep_A_Floor',        'enc_castle_floor',      'castle floor (1537)'),
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


def rewire_material(mat):
    if not mat.use_nodes: mat.use_nodes = True
    nt = mat.node_tree
    imgs = find_images_by_role(nt)
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if 'basecolor' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['basecolor']
        tx.location = (-400, 200)
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


print('[OPEN]')
bpy.ops.wm.open_mainfile(filepath=BLEND)

print('[FIX PATHS + LOAD IMAGES]')
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

print('[REWIRE]')
for mat in bpy.data.materials:
    try: rewire_material(mat)
    except Exception: pass

all_objs = {o.name: o for o in bpy.data.objects}
for src_name, out_name, comment in TARGETS:
    src = all_objs.get(src_name)
    if not src or src.type != 'MESH':
        print(f'[SKIP] {src_name}')
        continue
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = src
    src.select_set(True)
    bpy.ops.object.duplicate(linked=False)
    dup = bpy.context.active_object
    dup.name = f'EXPORT_{out_name}'
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if dup.data.vertices:
        verts_co = [dup.matrix_world @ v.co for v in dup.data.vertices]
        min_x = min(v.x for v in verts_co); max_x = max(v.x for v in verts_co)
        min_y = min(v.y for v in verts_co); max_y = max(v.y for v in verts_co)
        min_z = min(v.z for v in verts_co)
        dup.location.x -= (min_x + max_x) / 2
        dup.location.y -= (min_y + max_y) / 2
        dup.location.z -= min_z
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.ops.object.select_all(action='DESELECT')
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup
    out_path = os.path.join(OUT_DIR, out_name + '.glb')
    try:
        bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB',
            use_selection=True, export_apply=True, export_materials='EXPORT',
            export_yup=True, export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_image_format='JPEG', export_jpeg_quality=85)
        verts = len(dup.data.vertices); sz = os.path.getsize(out_path)/1024
        # bounding box for size reporting
        verts_co = [dup.matrix_world @ v.co for v in dup.data.vertices]
        if verts_co:
            xs=[c.x for c in verts_co]; ys=[c.y for c in verts_co]; zs=[c.z for c in verts_co]
            bbox = f'({max(xs)-min(xs):.1f}×{max(ys)-min(ys):.1f}×{max(zs)-min(zs):.1f})m'
        else:
            bbox = '?'
        print(f'[OK] {out_name}.glb  verts={verts}  size={sz:.0f}KB  bbox={bbox}  ({comment})')
    except Exception as e:
        print(f'[FAIL] {out_name}: {e}')
    bpy.data.objects.remove(dup, do_unlink=True)

print('[DONE]')
