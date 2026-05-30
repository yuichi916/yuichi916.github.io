"""TI extractor v2: aggressive 256×256 texture cap so each ti_*.glb
weighs a few MB instead of tens of MB.  The original ti_extract.py
tried 512×512 but the /4k/ → /2k/ path swap that multi_pack_extract.py
relies on does NOT exist in the TI texture folder structure, so the
fallback `img.scale()` was bypassed for many textures.  This version
unconditionally caps every image to 256 px.
"""
import bpy, os

BASE = r'P:\CG fanbook\3D assets'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

TI_BLEND = os.path.join(BASE,
    r'Kitbash3D - Treasure Island BLENDER\Native (1)\KB3D_TreasureIsland-Native.blend')

# Cap at 256 — accent props are < 1 m on the chibi diorama, no one will
# zoom close enough to see 512 px texture detail.
TEX_CAP = 256

PROPS = [
    (['treasurechest', 'chest'],       'ti_chest'),
    (['barrel'],                        'ti_barrel'),
    (['anchor'],                        'ti_anchor'),
    (['lantern', 'oillamp'],            'ti_lantern'),
    (['rope', 'coil'],                  'ti_rope'),
    (['cannon'],                        'ti_cannon'),
    (['lighthouse', 'beacon'],          'ti_beacon'),
    (['palm', 'tree'],                  'ti_palm'),
    (['skull'],                         'ti_skull'),
    (['ship_wheel', 'helm', 'wheel'],   'ti_helm'),
    (['crate', 'box'],                  'ti_crate'),
    (['boat', 'rowboat', 'dinghy'],     'ti_dinghy'),
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
        bsdf.inputs['Base Color'].default_value = (0.55, 0.45, 0.30, 1.0)
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


def pick_object_name(all_names, filters):
    fl = [f.lower() for f in filters]
    for nm in all_names:
        low = nm.lower()
        if any(f in low for f in fl):
            return nm
    return None


def downscale_all_images(cap):
    """Force every image in bpy.data.images to cap × cap (or smaller).
    Triggers reload first so the data is real before scaling."""
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


def main():
    print(f'[TI EXTRACT v2] scanning {TI_BLEND}  texCap={TEX_CAP}')
    try:
        all_names = list_objs(TI_BLEND)
    except Exception as e:
        print(f'[FAIL list] {e}')
        return
    print(f'  {len(all_names)} objects in TI blend')

    for filters, out_name in PROPS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        # Force re-extract — delete old heavy version
        if os.path.exists(out_path):
            sz = os.path.getsize(out_path) / 1024
            print(f'[REMOVE old] {out_name}.glb was {sz:.0f} KB')
            os.remove(out_path)
        obj_name = pick_object_name(all_names, filters)
        if not obj_name:
            print(f'[SKIP no match] {out_name} (filters={filters})')
            continue
        print(f'\n[START] {out_name}  obj={obj_name}')
        reset_scene()
        try:
            bpy.ops.wm.append(directory=f"{TI_BLEND}\\Object\\",
                              filename=obj_name, link=False)
        except Exception as e:
            print(f'  [FAIL append] {e}')
            continue
        downscale_all_images(TEX_CAP)
        for mat in bpy.data.materials:
            try: rewire(mat)
            except Exception: pass
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no mesh] {out_name}')
            continue
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
        for o in meshes:
            o.location.x -= cx
            o.location.y -= cy
            o.location.z -= bz
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='DESELECT')
        survivors = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in survivors: o.select_set(True)
        bpy.context.view_layer.objects.active = survivors[0]
        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True,
                export_materials='EXPORT', export_yup=True,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=10,   # max compression
                export_image_format='JPEG', export_jpeg_quality=70,
            )
            sz = os.path.getsize(out_path) / 1024
            print(f'[OK] {out_name}.glb  size={sz:.0f}KB')
        except Exception as e:
            print(f'[FAIL export] {e}')

    print('\n[DONE TI EXTRACT v2]')


if __name__ == '__main__':
    main()
