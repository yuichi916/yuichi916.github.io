"""KB3D re-extract — this time force materials to be glTF-compatible.
KB3D uses Cycles shader graphs that don't fully translate to glTF Principled.
Strategy: for each material, find the IMAGE TEXTURE node connected to Base Color
(or fallback to ambient/diffuse color) and rewire to a clean Principled BSDF
graph that glTF can export. Keep the textures.
"""
import bpy, os

BLEND = r'P:\CG fanbook\KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))

TARGETS = [
    ('KB3D_DKF_Fountain_A_Main', 'kb3d_fountain'),
    ('KB3D_DKF_Tower_A_Main', 'kb3d_tower_a'),
    ('KB3D_DKF_Tower_D_Main', 'kb3d_tower_d'),
    ('KB3D_DKF_Tower_J_Main', 'kb3d_tower_small'),
    ('KB3D_DKF_Tower_M_Main', 'kb3d_tower_grand'),
    ('KB3D_DKF_Statue_A_Main', 'kb3d_statue_a'),
    ('KB3D_DKF_Statue_B_Main', 'kb3d_statue_b'),
    ('KB3D_DKF_Statue_E_Main', 'kb3d_statue_e'),
    ('KB3D_DKF_Gate_B_Main', 'kb3d_gate_b'),
    ('KB3D_DKF_Gate_C_Main', 'kb3d_gate_c'),
    ('KB3D_DKF_Door_E_Main', 'kb3d_door_e'),
    ('KB3D_DKF_Torch_A_Main', 'kb3d_torch'),
    ('KB3D_DKF_Barrel_A_Main', 'kb3d_barrel'),
    ('KB3D_DKF_Firewood_A_Main', 'kb3d_firewood'),
    ('KB3D_DKF_ChainHook_A_Main', 'kb3d_chainhook'),
    ('KB3D_DKF_BldgSM_F_Main', 'kb3d_bldg_sm_f'),
    ('KB3D_DKF_BldgSM_G_Main', 'kb3d_bldg_sm_g'),
    ('KB3D_DKF_BldgMD_E_Main', 'kb3d_bldg_md_e'),
    ('KB3D_DKF_BldgSM_C_Main', 'kb3d_bldg_sm_c'),
]

print(f'[KB3D RE-EXTRACT TEXTURED] Opening {BLEND}')
bpy.ops.wm.open_mainfile(filepath=BLEND)


def find_image_from_node_tree(nt):
    """Walk a node tree and return the first IMAGE_TEXTURE image found."""
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            return n.image
        # Recurse into node groups
        if n.type == 'GROUP' and n.node_tree:
            img = find_image_from_node_tree(n.node_tree)
            if img:
                return img
    return None


def find_color_from_node_tree(nt):
    """Find any RGB / value node as a fallback base color."""
    for n in nt.nodes:
        if n.type == 'RGB' and hasattr(n.outputs[0], 'default_value'):
            v = n.outputs[0].default_value
            return (v[0], v[1], v[2])
        if n.type == 'BSDF_DIFFUSE' or n.type == 'BSDF_PRINCIPLED':
            for inp in n.inputs:
                if inp.name == 'Color' or inp.name == 'Base Color':
                    if hasattr(inp, 'default_value'):
                        v = inp.default_value
                        return (v[0], v[1], v[2])
    return (0.6, 0.55, 0.50)


def color_from_material_name(name):
    """Map KB3D material name keyword → realistic PBR color + roughness + metalness.
    KB3D textures are absent (texture files not downloaded), so we infer
    by name keyword."""
    n = name.lower()
    # KB3D naming pattern: KB3D_DKF_Stone_A, KB3D_DKF_Wood_B, etc.
    if 'metal' in n or 'iron' in n or 'gold' in n:
        return ((0.42, 0.40, 0.38), 0.45, 0.75)
    if 'wood' in n or 'beam' in n or 'plank' in n:
        return ((0.45, 0.30, 0.18), 0.90, 0.0)
    if 'stone' in n or 'rock' in n or 'block' in n or 'wall' in n:
        return ((0.58, 0.55, 0.50), 0.92, 0.0)
    if 'floor' in n or 'cobble' in n:
        return ((0.50, 0.45, 0.40), 0.92, 0.0)
    if 'roof' in n or 'tile' in n:
        return ((0.32, 0.18, 0.14), 0.65, 0.0)
    if 'plaster' in n or 'whitewash' in n:
        return ((0.85, 0.78, 0.65), 0.88, 0.0)
    if 'fire' in n or 'flame' in n:
        return ((0.95, 0.55, 0.20), 0.50, 0.0)
    if 'glass' in n or 'window' in n:
        return ((0.90, 0.92, 0.95), 0.10, 0.0)
    if 'fabric' in n or 'cloth' in n:
        return ((0.55, 0.25, 0.20), 0.85, 0.0)
    if 'leaf' in n or 'foliage' in n:
        return ((0.35, 0.55, 0.25), 0.88, 0.0)
    if 'dirt' in n or 'mud' in n:
        return ((0.30, 0.22, 0.16), 0.95, 0.0)
    if 'damage' in n or 'rust' in n:
        return ((0.35, 0.28, 0.22), 0.92, 0.10)
    if 'deco' in n or 'ornament' in n:
        return ((0.55, 0.45, 0.32), 0.85, 0.10)
    if 'paint' in n:
        return ((0.65, 0.32, 0.22), 0.70, 0.0)
    # Fallback: neutral dark-fantasy stone-grey
    return ((0.50, 0.46, 0.42), 0.90, 0.0)


def rewire_material_for_gltf(mat):
    """Replace the material's shader graph with a clean Principled BSDF.
    Since KB3D PNG textures are missing on disk, fall back to a per-material
    color inferred from the material name."""
    if not mat.use_nodes:
        mat.use_nodes = True
    nt = mat.node_tree
    img = find_image_from_node_tree(nt)
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (300, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if img and img.has_data:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.location = (-300, 0)
        tex.image = img
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        try: nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        except Exception: pass
        bsdf.inputs['Roughness'].default_value = 0.85
        bsdf.inputs['Metallic'].default_value = 0.0
    else:
        # Texture file missing — use name-based color
        col, rough, metal = color_from_material_name(mat.name)
        bsdf.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1.0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal


# Rewire every material in the file once
print('[REWIRE MATERIALS]')
for mat in bpy.data.materials:
    try:
        rewire_material_for_gltf(mat)
    except Exception as e:
        print(f'  [WARN] {mat.name}: {e}')
print(f'  Rewired {len(bpy.data.materials)} materials')

all_objs = {o.name: o for o in bpy.data.objects}

for src_name, out_name in TARGETS:
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
            export_image_format='AUTO',
        )
        verts = len(dup.data.vertices)
        sz = os.path.getsize(out_path) / 1024
        print(f'[OK] {out_name}.glb  verts={verts}  size={sz:.0f}KB')
    except Exception as e:
        print(f'[FAIL] {out_name}: {e}')

    bpy.data.objects.remove(dup, do_unlink=True)

print('[DONE KB3D RE-EXTRACT]')
