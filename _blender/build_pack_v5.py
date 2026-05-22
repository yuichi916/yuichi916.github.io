"""
Pack v5 — chibi NPC outfit variants. Original procedural geometry.
Run headless:
  blender --background --python build_pack_v5.py
"""
import bpy, os, math

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images]:
        for item in list(block):
            block.remove(item)


def pbr(name, base, rough=0.85, metal=0.0, emit=None, emit_strength=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes['Principled BSDF']
    n.inputs['Base Color'].default_value = (*base, 1.0)
    n.inputs['Roughness'].default_value = rough
    n.inputs['Metallic'].default_value = metal
    if emit is not None:
        em = n.inputs.get('Emission Color') or n.inputs.get('Emission')
        if em is not None: em.default_value = (*emit, 1.0)
        es = n.inputs.get('Emission Strength')
        if es is not None: es.default_value = emit_strength
    return m


def box(name, loc, sz, mat=None, bevel=0.0, subsurf=0, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name; o.scale = sz
    if mat: o.data.materials.append(mat)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = 2
    if subsurf > 0:
        s = o.modifiers.new('Subsurf', 'SUBSURF'); s.levels = subsurf; s.render_levels = subsurf
    return o


def cyl(name, loc, r, depth, mat=None, verts=32, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = 2
    return o


def cone(name, loc, r1, r2, depth, mat=None, verts=32, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth,
                                     location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def uv_sph(name, loc, r, mat=None, segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=rings)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def join_and_export(name):
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception: pass
    for o in meshes: o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        joined = bpy.context.active_object; joined.name = name
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    out = os.path.join(OUT_DIR, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
        export_apply=True, export_materials='EXPORT', export_yup=True)
    obj = bpy.context.active_object
    verts = len(obj.data.vertices) if obj and obj.type == 'MESH' else 0
    print(f'[OK] {name}.glb verts={verts}')


def build_chibi_variant(name, cloth_color, hair_color, hat_color, sash_color=(0.62, 0.15, 0.10), skin=(0.95, 0.78, 0.62)):
    """Build a chibi with a specific outfit/skin palette."""
    clear_scene()
    mat_skin = pbr('Skin', skin, 0.55)
    mat_cloth = pbr('Cloth', cloth_color, 0.78)
    mat_pants = pbr('Pants', (0.15, 0.10, 0.07), 0.85)
    mat_hair = pbr('Hair', hair_color, 0.55)
    mat_hat = pbr('Hat', hat_color, 0.88)
    mat_shoe = pbr('Shoe', (0.18, 0.10, 0.05), 0.88)
    mat_sash = pbr('Sash', sash_color, 0.78)
    mat_eye = pbr('Eye', (0.05, 0.03, 0.02), 0.40)
    mat_cheek = pbr('Cheek', (0.95, 0.50, 0.45), 0.55, emit=(1.0, 0.5, 0.5), emit_strength=0.1)

    # Feet
    box('FootL', (-0.10, 0.04, 0.05), (0.10, 0.20, 0.06), mat_shoe, bevel=0.015)
    box('FootR', (0.10, 0.04, 0.05), (0.10, 0.20, 0.06), mat_shoe, bevel=0.015)
    # Legs
    cyl('LegL', (-0.10, 0, 0.28), 0.08, 0.44, mat_pants, verts=14, bevel=0.012)
    cyl('LegR', (0.10, 0, 0.28), 0.08, 0.44, mat_pants, verts=14, bevel=0.012)
    # Torso
    uv_sph('Torso', (0, 0, 0.70), 0.24, mat_cloth, segs=22, rings=16)
    # Sash
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(0, 0, 0.62))
    bpy.context.active_object.data.materials.append(mat_sash)
    # Arms + hands
    cyl('ArmL', (-0.27, 0, 0.72), 0.065, 0.40, mat_cloth, verts=12, bevel=0.012)
    cyl('ArmR', (0.27, 0, 0.72), 0.065, 0.40, mat_cloth, verts=12, bevel=0.012)
    uv_sph('HandL', (-0.27, 0, 0.50), 0.065, mat_skin, segs=14, rings=10)
    uv_sph('HandR', (0.27, 0, 0.50), 0.065, mat_skin, segs=14, rings=10)
    # Head
    uv_sph('Head', (0, 0, 1.05), 0.24, mat_skin, segs=24, rings=20)
    # Hair cap
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.245, location=(0, 0, 1.05), segments=22, ring_count=18)
    o = bpy.context.active_object; o.name = 'HairCap'
    o.scale.z = 0.6; o.location.z = 1.13
    o.data.materials.append(mat_hair)
    # Hat
    cone('Hat', (0, 0, 1.30), 0.32, 0.04, 0.14, mat_hat, verts=18)
    # Hat rim
    bpy.ops.mesh.primitive_torus_add(major_radius=0.30, minor_radius=0.025, location=(0, 0, 1.27))
    bpy.context.active_object.data.materials.append(pbr('HatRim', tuple(c*0.7 for c in hat_color), 0.85))
    # Eyes
    uv_sph('EyeL', (-0.08, 0.18, 1.08), 0.022, mat_eye, segs=10, rings=8)
    uv_sph('EyeR', (0.08, 0.18, 1.08), 0.022, mat_eye, segs=10, rings=8)
    # Cheeks
    uv_sph('CheekL', (-0.13, 0.16, 1.02), 0.025, mat_cheek, segs=10, rings=8)
    uv_sph('CheekR', (0.13, 0.16, 1.02), 0.025, mat_cheek, segs=10, rings=8)
    join_and_export(name)


def build_chibi_monk():
    """Buddhist monk variant — shaved head, robe, prayer beads, no hat."""
    clear_scene()
    skin = pbr('MonkSkin', (0.90, 0.74, 0.58), 0.55)
    robe = pbr('MonkRobe', (0.62, 0.40, 0.18), 0.85)
    robe_dark = pbr('MonkRobeDark', (0.42, 0.26, 0.10), 0.85)
    sandal = pbr('MonkSandal', (0.20, 0.12, 0.06), 0.88)
    bead = pbr('MonkBead', (0.40, 0.18, 0.06), 0.55)
    eye = pbr('Eye', (0.05, 0.03, 0.02), 0.40)
    # Feet (sandals)
    box('SandalL', (-0.10, 0.04, 0.04), (0.12, 0.22, 0.04), sandal, bevel=0.012)
    box('SandalR', (0.10, 0.04, 0.04), (0.12, 0.22, 0.04), sandal, bevel=0.012)
    # Robe lower (cone-like skirt)
    bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.30, depth=0.55,
                                     location=(0, 0, 0.32), vertices=18)
    o = bpy.context.active_object; o.name = 'RobeLower'
    o.data.materials.append(robe)
    # Robe upper (chest)
    uv_sph('RobeTop', (0, 0, 0.70), 0.26, robe, segs=22, rings=16)
    # Belt sash
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.030, location=(0, 0, 0.62))
    bpy.context.active_object.data.materials.append(robe_dark)
    # Arms (sleeves wider — bell shape)
    bpy.ops.mesh.primitive_cone_add(radius1=0.07, radius2=0.12, depth=0.36,
                                     location=(-0.27, 0, 0.66), vertices=12,
                                     rotation=(0, 0, 0.1))
    bpy.context.active_object.data.materials.append(robe)
    bpy.ops.mesh.primitive_cone_add(radius1=0.07, radius2=0.12, depth=0.36,
                                     location=(0.27, 0, 0.66), vertices=12,
                                     rotation=(0, 0, -0.1))
    bpy.context.active_object.data.materials.append(robe)
    # Hands
    uv_sph('HandL', (-0.27, 0, 0.45), 0.06, skin, segs=14, rings=10)
    uv_sph('HandR', (0.27, 0, 0.45), 0.06, skin, segs=14, rings=10)
    # Head (slightly smaller for adult feel + shaved)
    uv_sph('Head', (0, 0, 1.02), 0.22, skin, segs=24, rings=20)
    # Eyes (gentle closed look — small horizontal boxes)
    box('EyeL', (-0.07, 0.18, 1.04), (0.04, 0.005, 0.012), eye)
    box('EyeR', (0.07, 0.18, 1.04), (0.04, 0.005, 0.012), eye)
    # Prayer beads necklace (small torus)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.02, location=(0, 0, 0.82))
    bpy.context.active_object.data.materials.append(bead)
    join_and_export('chibi_monk')


def build_chibi_woman():
    """Female chibi variant — longer hair, slightly slimmer body, no hat."""
    clear_scene()
    skin = pbr('WSkin', (0.96, 0.82, 0.68), 0.55)
    cloth = pbr('Cloth', (0.78, 0.32, 0.48), 0.78)
    pants = pbr('Pants', (0.12, 0.08, 0.06), 0.85)
    hair = pbr('Hair', (0.10, 0.05, 0.03), 0.55)
    sash = pbr('Sash', (0.92, 0.78, 0.30), 0.78)
    shoe = pbr('Shoe', (0.18, 0.10, 0.05), 0.88)
    eye = pbr('Eye', (0.05, 0.03, 0.02), 0.40)
    cheek = pbr('Cheek', (0.98, 0.55, 0.55), 0.55, emit=(1.0, 0.5, 0.5), emit_strength=0.15)
    flower = pbr('Flower', (1.0, 0.55, 0.78), 0.55, emit=(1.0, 0.5, 0.7), emit_strength=0.2)
    # Feet
    box('FootL', (-0.10, 0.04, 0.05), (0.09, 0.20, 0.06), shoe, bevel=0.012)
    box('FootR', (0.10, 0.04, 0.05), (0.09, 0.20, 0.06), shoe, bevel=0.012)
    cyl('LegL', (-0.09, 0, 0.28), 0.07, 0.44, pants, verts=14, bevel=0.012)
    cyl('LegR', (0.09, 0, 0.28), 0.07, 0.44, pants, verts=14, bevel=0.012)
    # Slightly slimmer torso
    uv_sph('Torso', (0, 0, 0.70), 0.22, cloth, segs=22, rings=16)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.21, minor_radius=0.030, location=(0, 0, 0.62))
    bpy.context.active_object.data.materials.append(sash)
    cyl('ArmL', (-0.25, 0, 0.72), 0.060, 0.40, cloth, verts=12, bevel=0.012)
    cyl('ArmR', (0.25, 0, 0.72), 0.060, 0.40, cloth, verts=12, bevel=0.012)
    uv_sph('HandL', (-0.25, 0, 0.50), 0.06, skin, segs=14, rings=10)
    uv_sph('HandR', (0.25, 0, 0.50), 0.06, skin, segs=14, rings=10)
    # Head
    uv_sph('Head', (0, 0, 1.04), 0.23, skin, segs=24, rings=20)
    # Long hair — extended cap that goes past the shoulders
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.245, location=(0, -0.04, 1.04), segments=22, ring_count=18)
    o = bpy.context.active_object; o.name = 'HairCap'
    o.scale.z = 0.85; o.location.z = 1.10
    o.data.materials.append(hair)
    # Long hair drape (longer cylinder behind)
    cyl('HairDrape', (0, -0.18, 0.78), 0.18, 0.55, hair, verts=14, bevel=0.018)
    # Bangs (front)
    box('Bangs', (0, 0.16, 1.16), (0.36, 0.08, 0.04), hair, bevel=0.012)
    # Hair flower (right side)
    uv_sph('HairFlower', (0.22, 0.08, 1.10), 0.06, flower, segs=12, rings=8)
    # Eyes
    uv_sph('EyeL', (-0.08, 0.18, 1.06), 0.024, eye, segs=10, rings=8)
    uv_sph('EyeR', (0.08, 0.18, 1.06), 0.024, eye, segs=10, rings=8)
    # Cheeks
    uv_sph('CheekL', (-0.13, 0.16, 1.00), 0.028, cheek, segs=10, rings=8)
    uv_sph('CheekR', (0.13, 0.16, 1.00), 0.028, cheek, segs=10, rings=8)
    join_and_export('chibi_woman')


def build_chibi_child():
    """Smaller chibi child variant."""
    clear_scene()
    skin = pbr('CSkin', (0.96, 0.80, 0.68), 0.55)
    cloth = pbr('Cloth', (0.95, 0.78, 0.32), 0.78)
    pants = pbr('Pants', (0.20, 0.30, 0.50), 0.85)
    hair = pbr('Hair', (0.20, 0.12, 0.06), 0.55)
    shoe = pbr('Shoe', (0.10, 0.06, 0.02), 0.88)
    eye = pbr('Eye', (0.05, 0.03, 0.02), 0.40)
    cheek = pbr('Cheek', (1.0, 0.55, 0.55), 0.55, emit=(1.0, 0.5, 0.5), emit_strength=0.2)
    # Whole figure scaled down — assemble at 0.75 scale relative to base chibi
    s = 0.78
    # Feet
    box('FootL', (-0.09*s, 0.03, 0.04), (0.09*s, 0.16*s, 0.05), shoe, bevel=0.012)
    box('FootR', (0.09*s, 0.03, 0.04), (0.09*s, 0.16*s, 0.05), shoe, bevel=0.012)
    cyl('LegL', (-0.09*s, 0, 0.22*s), 0.07*s, 0.36*s, pants, verts=14)
    cyl('LegR', (0.09*s, 0, 0.22*s), 0.07*s, 0.36*s, pants, verts=14)
    # Bigger relative head (chibi child proportions)
    uv_sph('Torso', (0, 0, 0.56*s), 0.20*s, cloth, segs=22, rings=16)
    cyl('ArmL', (-0.22*s, 0, 0.58*s), 0.055*s, 0.32*s, cloth, verts=12)
    cyl('ArmR', (0.22*s, 0, 0.58*s), 0.055*s, 0.32*s, cloth, verts=12)
    uv_sph('HandL', (-0.22*s, 0, 0.40*s), 0.055*s, skin, segs=14, rings=10)
    uv_sph('HandR', (0.22*s, 0, 0.40*s), 0.055*s, skin, segs=14, rings=10)
    # Huge head (chibi child!)
    uv_sph('Head', (0, 0, 0.92*s), 0.26*s, skin, segs=24, rings=20)
    # Hair cap (puffy/messy)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.27*s, location=(0, 0, 0.94*s), segments=22, ring_count=18)
    o = bpy.context.active_object; o.name = 'HairPoof'
    o.scale.z = 0.68
    o.data.materials.append(hair)
    # Cowlick tuft
    cone('Cowlick', (0, -0.10*s, 1.20*s), 0.05*s, 0.0, 0.10*s, hair, verts=8)
    # Big eyes
    uv_sph('EyeL', (-0.09*s, 0.22*s, 0.96*s), 0.030*s, eye, segs=12, rings=10)
    uv_sph('EyeR', (0.09*s, 0.22*s, 0.96*s), 0.030*s, eye, segs=12, rings=10)
    # Big rosy cheeks
    uv_sph('CheekL', (-0.15*s, 0.18*s, 0.86*s), 0.035*s, cheek, segs=10, rings=8)
    uv_sph('CheekR', (0.15*s, 0.18*s, 0.86*s), 0.035*s, cheek, segs=10, rings=8)
    join_and_export('chibi_child')


# ─── MAIN ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # 4 color-variant villagers (different cloth + hat tones)
    build_chibi_variant('chibi_red',
        cloth_color=(0.78, 0.18, 0.13), hair_color=(0.08, 0.05, 0.03),
        hat_color=(0.85, 0.66, 0.40), sash_color=(0.32, 0.16, 0.10))
    build_chibi_variant('chibi_blue',
        cloth_color=(0.20, 0.32, 0.62), hair_color=(0.06, 0.04, 0.02),
        hat_color=(0.72, 0.52, 0.30), sash_color=(0.16, 0.20, 0.40))
    build_chibi_variant('chibi_green',
        cloth_color=(0.22, 0.50, 0.28), hair_color=(0.08, 0.05, 0.03),
        hat_color=(0.85, 0.66, 0.40), sash_color=(0.50, 0.40, 0.18))
    build_chibi_variant('chibi_yellow',
        cloth_color=(0.92, 0.78, 0.18), hair_color=(0.16, 0.10, 0.05),
        hat_color=(0.42, 0.26, 0.10), sash_color=(0.62, 0.18, 0.13))
    # Specialty NPCs
    build_chibi_monk()
    build_chibi_woman()
    build_chibi_child()
    print('\n[DONE] pack v5 exported to', OUT_DIR)
