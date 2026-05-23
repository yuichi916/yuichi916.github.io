"""Extract atmospheric prop assets from the four "side packs" KB3D Dark
Fantasy, KB3D Valhalla, and Village House Kit, so the Enchanted-base
niwa scenes get variety accents (a Valhalla shield in tabi, a
Dark Fantasy brazier behind hoshi, a Village House well in oto).

Each pack is processed sequentially — opens master .blend, picks 10-15
representative props by name match, runs the same image-downscale +
material-rewire pipeline as enc_extract_prefabs.py, exports per-prop
GLBs to assets/blender/.

Output naming:
  df_<prop>.glb     KB3D Dark Fantasy
  val_<prop>.glb    KB3D Valhalla
  vh_<prop>.glb     Village House Kit

This is *one* Blender process — must be launched AFTER the Interiors
extract finishes (so we never hit pCloud Drive with two Blenders).
"""
import bpy, os

BASE = r'P:\CG fanbook\3D assets'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)


# Each entry: (pack_label, .blend path, [(scene_filters, out_name)])
PACKS = [
    ('df',  os.path.join(BASE, r'KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'), [
        (['torchwall', 'sconce', 'wall_torch'],    'df_wall_torch'),
        (['statue', 'gargoyle'],                    'df_gargoyle'),
        (['brazier', 'firepit'],                    'df_brazier'),
        (['chain'],                                 'df_chain'),
        (['banner'],                                'df_banner'),
        (['altar', 'tomb', 'pedestal'],             'df_altar'),
        (['gate', 'portcullis'],                    'df_gate'),
        (['skull', 'bone'],                         'df_relic'),
    ]),
    ('val', os.path.join(BASE, r'KitBash3D - Valhalla\Blender\KB3D_Valhalla-Native.blend'), [
        (['shield'],                                'val_shield'),
        (['carving', 'pillar', 'totem'],            'val_pillar'),
        (['rune', 'stone'],                         'val_rune'),
        (['banner', 'standard'],                    'val_banner'),
        (['horn', 'tankard', 'mug'],                'val_horn'),
        (['barrel'],                                'val_barrel'),
        (['axe'],                                   'val_axe'),
        (['bench', 'longhouse'],                    'val_longbench'),
    ]),
    ('vh',  os.path.join(BASE, r'Village House Kit\village house kit.blend'), [
        (['well'],                                  'vh_well'),
        (['fence'],                                 'vh_fence'),
        (['cart'],                                  'vh_cart'),
        (['barrel'],                                'vh_barrel'),
        (['crate'],                                 'vh_crate'),
        (['ladder'],                                'vh_ladder'),
        (['gate'],                                  'vh_gate'),
        (['fortification'],                         'vh_palisade'),
    ]),
]


def list_objs(blend):
    objs = []
    with bpy.data.libraries.load(blend, link=False) as (data_from, _):
        for name in data_from.objects:
            objs.append(name)
    return objs


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


def extract_prop(blend, name_filters, out_name):
    out_path = os.path.join(OUT_DIR, out_name + '.glb')
    if os.path.exists(out_path):
        sz = os.path.getsize(out_path) / 1024 / 1024
        print(f'  [SKIP] {out_name}.glb ({sz:.1f} MB) — already exists')
        return
    try:
        all_objs = list_objs(blend)
    except Exception as e:
        print(f'  [FAIL list] {blend}: {e}')
        return

    matched = []
    for nm in all_objs:
        low = nm.lower()
        if any(f in low for f in name_filters):
            matched.append(nm)
    if not matched:
        print(f'  [SKIP no match] {out_name}  filters={name_filters}')
        return
    # Cap to 5 props (this is a single small accent prop, not a building)
    matched = matched[:5]

    reset_scene()
    appended = 0
    for nm in matched:
        try:
            bpy.ops.wm.append(directory=f"{blend}\\Object\\", filename=nm, link=False)
            appended += 1
        except Exception:
            pass
    if not appended:
        print(f'  [SKIP no append] {out_name}')
        return

    # Image fix + downscale to 1024
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

    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes: return
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    # Centre + base at z=0
    all_co = []
    for o in meshes:
        for v in o.data.vertices:
            all_co.append(o.matrix_world @ v.co)
    if all_co:
        xs=[c.x for c in all_co]; ys=[c.y for c in all_co]; zs=[c.z for c in all_co]
        cx = (min(xs)+max(xs))/2; cy = (min(ys)+max(ys))/2; bz = min(zs)
        for o in meshes:
            o.location.x -= cx; o.location.y -= cy; o.location.z -= bz

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
        print(f'  [OK] {out_name}.glb  meshes={len(meshes)}  size={sz:.1f}MB')
    except Exception as e:
        print(f'  [FAIL export] {out_name}: {e}')


def main():
    print('[MULTI-PACK EXTRACT] start')
    for pack_label, blend, props in PACKS:
        if not os.path.exists(blend):
            print(f'\n[SKIP PACK] {pack_label} — blend not found: {blend}')
            continue
        print(f'\n=== Pack: {pack_label}  ({blend}) ===')
        for filters, out_name in props:
            print(f'  [extract] {out_name}  filters={filters}')
            extract_prop(blend, filters, out_name)
    print('\n[DONE MULTI-PACK EXTRACT]')


if __name__ == '__main__':
    main()
