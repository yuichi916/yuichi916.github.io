"""KB3D Enchanted — extract a curated set of hero assets for the floating-island diorama.
Strategy:
  - Open the 5.6GB master .blend (textures ARE present this time)
  - Pick ~28 hero objects sized roughly 1K-20K verts each
  - Each material rewired: connect existing Image Texture nodes properly to a
    clean Principled BSDF (preserves the textures!)
  - Export each as Draco-compressed GLB
"""
import bpy, os, math

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

# Curated set targeted at the enchanted-floating-island worldview.
# (orig_name, out_glb_name, comment)
TARGETS = [
    # --- Buildings (verified names from inventory, sorted lightweight → heavier) ---
    ('KB3D_ENC_BldgMdClockTower_A_BuildingB',   'enc_clocktower_b',   'small clock tower (794 verts)'),
    ('KB3D_ENC_BldgSmChurch_A_BuildingA',       'enc_church_a',       'church chapel (4724)'),
    ('KB3D_ENC_BldgMdAntiquarian_A_BuildingB',  'enc_antiquarian',    'antiquarian shop (8670)'),
    ('KB3D_ENC_BldgMdInn_A_BuildingA',          'enc_inn',            'inn (10880)'),
    ('KB3D_ENC_BldgSmChurch_A_BuildingC',       'enc_church_spire',   'church spire (11763)'),
    ('KB3D_ENC_BldgSmBank_A_BuildingC',         'enc_bank',           'bank (12181)'),
    ('KB3D_ENC_BldgMdHerbalist_A_BuildingB',    'enc_herbalist',      'herbalist (16380)'),
    ('KB3D_ENC_BldgMdBookStore_A_BuildingB',    'enc_bookstore',      'bookstore (20518)'),
    ('KB3D_ENC_BldgMdCandleMaker_A_BuildingA',  'enc_candlemaker',    'candle maker (25218)'),
    ('KB3D_ENC_BldgMdPub_A_BuildingC',          'enc_pub',            'pub (40740)'),
    # --- Props (small, decorative) ---
    ('KB3D_ENC_PropLampPost_A_Main',            'enc_lamppost_a',     'street lamp (1910)'),
    ('KB3D_ENC_PropLampPost_C_Main',            'enc_lamppost_c',     'alt street lamp (1444)'),
    ('KB3D_ENC_PropLantern_A_Main',             'enc_lantern',        'small lantern (894)'),
    ('KB3D_ENC_PropSign_A_Main',                'enc_sign_a',         'shop sign A (1327)'),
    ('KB3D_ENC_PropSign_B_Main',                'enc_sign_b',         'shop sign B (680)'),
    ('KB3D_ENC_PropPlanter_A_Main',             'enc_planter_a',      'flower planter (1564)'),
    ('KB3D_ENC_PropPlanter_B_Main',             'enc_planter_b',      'small planter (1349)'),
    ('KB3D_ENC_PropBrazier_A_Main',             'enc_brazier',        'magical brazier (6398)'),
    ('KB3D_ENC_PropHangingPot_A_Main',          'enc_hangingpot',     'hanging flower pot (7043)'),
    ('KB3D_ENC_PropBench_A_Main',               'enc_bench',          'park bench (8352)'),
    ('KB3D_ENC_PropSigil_A_Main',               'enc_sigil',          'magic sigil (4054)'),
    ('KB3D_ENC_PropSwordInTheStone_A_Main',     'enc_sword_in_stone', 'sword in stone (13160)'),
    ('KB3D_ENC_PropZoltor_A_Main',              'enc_zoltor',         'fortune-teller machine (34123)'),
    ('KB3D_ENC_PropVendorStand_B_Main',         'enc_vendor_b',       'vendor stand (37286)'),
    ('KB3D_ENC_PropWoodenArch_A_Main',          'enc_wooden_arch',    'wooden arch (50613)'),
    ('KB3D_ENC_PropArmorChestPiece_A_Main',     'enc_armor_chest',    'armor chest (3172)'),
    ('KB3D_ENC_PropWashBasin_A_Main',           'enc_wash_basin',     'wash basin (1788)'),
    ('KB3D_ENC_PropBookshelf_B_Main',           'enc_bookshelf',      'bookshelf (2996)'),
]


def find_image_in_tree(nt):
    """Walk a node tree, return the first IMAGE_TEXTURE node with a loaded image."""
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            return n.image, n
        if n.type == 'GROUP' and n.node_tree:
            ret = find_image_in_tree(n.node_tree)
            if ret: return ret
    return None


def find_images_by_role(nt):
    """Return dict {'basecolor': img, 'roughness': img, 'metallic': img, 'normal': img, 'opacity': img} if found in any node."""
    found = {}
    def walk(t):
        for n in t.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                nm = n.image.name.lower()
                if 'basecolor' in nm or 'diffuse' in nm or 'albedo' in nm:
                    found.setdefault('basecolor', n.image)
                elif 'roughness' in nm:
                    found.setdefault('roughness', n.image)
                elif 'metallic' in nm or 'metal' in nm:
                    found.setdefault('metallic', n.image)
                elif 'normal' in nm or '_n.' in nm:
                    found.setdefault('normal', n.image)
                elif 'opacity' in nm or 'alpha' in nm:
                    found.setdefault('opacity', n.image)
            elif n.type == 'GROUP' and n.node_tree:
                walk(n.node_tree)
    walk(nt)
    return found


def rewire_material_glTF_compatible(mat):
    """Rewire material — preserve FULL PBR (basecolor + roughness + metallic +
    normal) for maximum quality. User asked for quality over size limits."""
    if not mat.use_nodes: mat.use_nodes = True
    nt = mat.node_tree
    imgs = find_images_by_role(nt)
    # Clear
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
        tx.location = (-400, -100)
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = 0.85
    if 'metallic' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['metallic']
        tx.image.colorspace_settings.name = 'Non-Color'
        tx.location = (-400, -400)
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Metallic'])
    if 'normal' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['normal']
        tx.image.colorspace_settings.name = 'Non-Color'
        tx.location = (-700, -500)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (-400, -500)
        nt.links.new(tx.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])


print(f'[ENC EXTRACT] Opening {BLEND}')
bpy.ops.wm.open_mainfile(filepath=BLEND)

# Texture path fix: .blend references //KB3DTextures\4k\*.png but only 2k/ exists.
# Keep ALL PBR maps for full quality. Downsize to 1024px for balance of
# quality vs file size.
print('[FIX IMAGE PATHS]')
fixed = 0
for img in bpy.data.images:
    fp = img.filepath
    if not fp: continue
    new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
    if new_fp != fp:
        img.filepath = new_fp
        fixed += 1
    # Force-load + downscale only when we touch it
    try:
        img.reload()
        if img.has_data:
            w, h = img.size[0], img.size[1]
            if w > 1024 or h > 1024:
                img.scale(1024, 1024)
    except Exception:
        pass

print(f'  Fixed paths: {fixed}')

print('[REWIRE MATERIALS]')
rewired = 0
for mat in bpy.data.materials:
    try:
        rewire_material_glTF_compatible(mat)
        rewired += 1
    except Exception as e:
        pass
print(f'  Rewired {rewired}/{len(bpy.data.materials)} materials')

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
        cx = (min_x + max_x) / 2
        cy = (min_y + max_y) / 2
        dup.location.x -= cx
        dup.location.y -= cy
        dup.location.z -= min_z
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

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
            # JPEG quality 85 at 1024 px → ~80-200KB per texture, full PBR
            export_image_format='JPEG',
            export_jpeg_quality=85,
        )
        verts = len(dup.data.vertices)
        sz = os.path.getsize(out_path) / 1024
        print(f'[OK] {out_name}.glb  verts={verts}  size={sz:.0f}KB  ({comment})')
    except Exception as e:
        print(f'[FAIL] {out_name}: {e}')

    bpy.data.objects.remove(dup, do_unlink=True)

print('[DONE ENC EXTRACT]')
