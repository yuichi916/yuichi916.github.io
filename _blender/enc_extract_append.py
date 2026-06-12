"""ENC extraction via bpy.ops.wm.append — loads ONE object at a time from the
5.6GB .blend without opening it entirely. Massively lower memory footprint
(previous approach crashed at ~5.4GB malloc-null).

Each iteration:
  1. Start a fresh empty scene
  2. wm.append a single mesh object from the .blend
  3. Resolve image filepaths (//4k\ -> //2k\), reload them, downscale to 1024
  4. Rewire its materials → glTF Principled BSDF
  5. Re-centre at world origin, base at z=0
  6. Export as Draco-compressed GLB w/ JPEG textures
"""
import bpy, os, math

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

TARGETS = [
    ('KB3D_ENC_BldgSmLowerTownSquare_A_Ground', 'enc_townsquare_ground'),
    ('KB3D_ENC_BldgSmUpperTownSquare_A_Floor',  'enc_townsquare_floor'),
    ('KB3D_ENC_BldgSmUpperTownSquare_A_Building', 'enc_townsquare_upper'),
    ('KB3D_ENC_BldgLgCastleKeep_A_Ground',       'enc_castle_ground'),
    ('KB3D_ENC_BldgMdHerbalist_A_Ground',        'enc_herbalist_ground'),
    ('KB3D_ENC_BldgMdAntiquarian_A_Ground',      'enc_antiquarian_ground'),
    ('KB3D_ENC_BldgLgManor_A_Ground',            'enc_manor_ground'),
    ('KB3D_ENC_BldgLgCastleKeep_A_Floor',        'enc_castle_floor'),
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


def reset_scene():
    """Wipe absolutely everything — start with an empty file."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    for src_name, out_name in TARGETS:
        print(f'[START] {out_name}  ({src_name})')
        reset_scene()
        # Append just this one object from the .blend's "Object" data block.
        try:
            bpy.ops.wm.append(
                directory=f"{BLEND}\\Object\\",
                filename=src_name,
                link=False,
            )
        except Exception as e:
            print(f'[FAIL append] {src_name}: {e}')
            continue

        # Find the appended object (must be a mesh)
        obj = bpy.data.objects.get(src_name)
        if not obj or obj.type != 'MESH':
            print(f'[FAIL] {src_name} not found after append')
            continue

        # Fix image paths + load + downscale to 1024
        for img in bpy.data.images:
            fp = img.filepath
            if not fp: continue
            new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
            if new_fp != fp: img.filepath = new_fp
            try:
                img.reload()
                if img.has_data and (img.size[0] > 1024 or img.size[1] > 1024):
                    img.scale(1024, 1024)
            except Exception:
                pass

        # Rewire materials
        for mat in bpy.data.materials:
            try: rewire_material(mat)
            except Exception: pass

        # Recentre + base at z=0
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        except Exception: pass
        if obj.data.vertices:
            verts_co = [obj.matrix_world @ v.co for v in obj.data.vertices]
            min_x = min(v.x for v in verts_co); max_x = max(v.x for v in verts_co)
            min_y = min(v.y for v in verts_co); max_y = max(v.y for v in verts_co)
            min_z = min(v.z for v in verts_co)
            obj.location.x -= (min_x + max_x) / 2
            obj.location.y -= (min_y + max_y) / 2
            obj.location.z -= min_z
            try:
                bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
            except Exception: pass

        # Export
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True, export_materials='EXPORT',
                export_yup=True, export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=6,
                export_image_format='JPEG', export_jpeg_quality=85,
            )
            verts = len(obj.data.vertices); sz = os.path.getsize(out_path) / 1024
            verts_co = [obj.matrix_world @ v.co for v in obj.data.vertices] if obj.data.vertices else []
            if verts_co:
                xs=[c.x for c in verts_co]; ys=[c.y for c in verts_co]; zs=[c.z for c in verts_co]
                bbox = f'({max(xs)-min(xs):.1f}×{max(ys)-min(ys):.1f}×{max(zs)-min(zs):.1f})m'
            else: bbox = '?'
            print(f'[OK] {out_name}.glb  verts={verts}  size={sz:.0f}KB  bbox={bbox}')
        except Exception as e:
            print(f'[FAIL export] {out_name}: {e}')

    print('[DONE]')


if __name__ == '__main__':
    main()
