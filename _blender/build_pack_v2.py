"""
Pack v2 — variations + props + chibi character. Original procedural Blender meshes.
Run headless:
  blender --background --python build_pack_v2.py
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


# ─── KOMINKA COLOR VARIANTS ───────────────────────────────────────────
def build_kominka_variant(name, wall_color, roof_color, beam_color=(0.10,0.06,0.04)):
    clear_scene()
    mat_foundation = pbr('Foundation', (0.18, 0.16, 0.13), 0.95)
    mat_wall = pbr('Wall', wall_color, 0.90)
    mat_beam = pbr('Beam', beam_color, 0.85)
    mat_roof = pbr('Roof', roof_color, 0.92)
    mat_roof_dark = pbr('RoofDark', tuple(c*0.55 for c in roof_color), 0.92)
    mat_shoji = pbr('Shoji', (0.96, 0.92, 0.78), 0.6, emit=(1.0, 0.85, 0.55), emit_strength=0.0)
    mat_door = pbr('Door', (0.30, 0.20, 0.12), 0.85)
    mat_chim = pbr('Chimney', (0.28, 0.26, 0.24), 0.92)

    box('Found', (0,0,0.15), (3.0,2.4,0.30), mat_foundation, bevel=0.02)
    box('Walls', (0,0,1.0), (2.7,2.1,1.40), mat_wall, bevel=0.015)
    for i,(x,y) in enumerate([(-1.30,-1.0),(1.30,-1.0),(-1.30,1.0),(1.30,1.0)]):
        box(f'Beam_{i}', (x,y,1.0), (0.10,0.10,1.40), mat_beam, bevel=0.01)
    for y_side in [-1.06, 1.06]:
        for x_off in [-0.7, 0.7]:
            box(f'Shoji_{y_side}_{x_off}', (x_off,y_side,1.10), (0.45,0.02,0.55), mat_shoji)
    box('Door', (0,-1.06,0.7), (0.6,0.05,0.95), mat_door, bevel=0.01)
    # Roof
    for sign in [-1, 1]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, sign*0.7, 2.30))
        s = bpy.context.active_object
        s.scale = (3.4, 1.5, 0.12); s.rotation_euler = (sign*0.55, 0, 0)
        s.data.materials.append(mat_roof)
        sm = s.modifiers.new('SS','SUBSURF'); sm.levels=1; sm.render_levels=1
    box('Ridge', (0,0,2.92), (3.4,0.20,0.18), mat_roof_dark, bevel=0.02)
    for x_side in [-1.55, 1.55]:
        box(f'Gable_{x_side}', (x_side,0,2.20), (0.05,2.10,0.55), mat_wall)
    box('Chim', (1.0,0,3.30), (0.30,0.30,0.70), mat_chim, bevel=0.015)
    join_and_export(name)


# ─── PROPS ────────────────────────────────────────────────────────────
def build_barrel():
    clear_scene()
    wood = pbr('BarrelWood', (0.36, 0.20, 0.10), 0.85)
    dark = pbr('BarrelBand', (0.10, 0.06, 0.03), 0.82)
    # body — barrel curve via 2 truncated cones meeting in middle
    cyl('TopHalf', (0,0,0.55), 0.32, 0.45, wood, verts=20, bevel=0.0)
    bpy.ops.mesh.primitive_cone_add(radius1=0.32, radius2=0.40, depth=0.5,
                                     location=(0,0,0.30), vertices=20)
    o = bpy.context.active_object; o.name='MidA'
    o.data.materials.append(wood)
    bpy.ops.mesh.primitive_cone_add(radius1=0.40, radius2=0.32, depth=0.5,
                                     location=(0,0,0.05), vertices=20)
    o = bpy.context.active_object; o.name='MidB'
    o.data.materials.append(wood)
    # Bands
    bpy.ops.mesh.primitive_torus_add(major_radius=0.40, minor_radius=0.025, location=(0,0,0.30))
    bpy.context.active_object.data.materials.append(dark)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.40, minor_radius=0.025, location=(0,0,0.60))
    bpy.context.active_object.data.materials.append(dark)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.025, location=(0,0,0.05))
    bpy.context.active_object.data.materials.append(dark)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.025, location=(0,0,0.85))
    bpy.context.active_object.data.materials.append(dark)
    # Top lid
    cyl('TopLid', (0,0,0.78), 0.32, 0.04, wood, verts=20)
    join_and_export('barrel')


def build_basket():
    clear_scene()
    weave = pbr('Weave', (0.72, 0.56, 0.32), 0.85)
    weave_dark = pbr('WeaveDark', (0.40, 0.28, 0.14), 0.85)
    # Conical basket
    bpy.ops.mesh.primitive_cone_add(radius1=0.32, radius2=0.22, depth=0.45,
                                     location=(0,0,0.225), vertices=24)
    o = bpy.context.active_object; o.name='BasketBody'
    o.data.materials.append(weave)
    sm = o.modifiers.new('SS', 'SUBSURF'); sm.levels=1; sm.render_levels=1
    # Rim
    bpy.ops.mesh.primitive_torus_add(major_radius=0.31, minor_radius=0.025, location=(0,0,0.45))
    bpy.context.active_object.data.materials.append(weave_dark)
    # Handle (half-torus arc)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.30, minor_radius=0.020,
                                      location=(0,0,0.55), major_segments=16, minor_segments=8)
    o = bpy.context.active_object; o.name='Handle'
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(weave_dark)
    join_and_export('basket')


def build_sign():
    clear_scene()
    wood = pbr('SignWood', (0.30, 0.18, 0.08), 0.88)
    panel = pbr('SignPanel', (0.92, 0.82, 0.56), 0.85)
    cap = pbr('SignCap', (0.10, 0.06, 0.03), 0.82)
    cyl('Post', (0,0,0.7), 0.06, 1.4, wood, verts=12)
    box('Panel', (0,0.06,1.0), (0.55,0.04,0.42), panel, bevel=0.012)
    box('PanelFrame', (0,0.04,1.0), (0.62,0.05,0.48), wood, bevel=0.012)
    # Top cap
    box('TopCap', (0,0,1.45), (0.18,0.18,0.06), cap, bevel=0.01)
    # bell hanging
    uv_sph('Bell', (0.30,0,1.10), 0.055, pbr('BellGold', (0.86, 0.62, 0.18), 0.40, 0.6), segs=12, rings=8)
    join_and_export('sign')


def build_jizo():
    """Roadside Jizo statue with red bib."""
    clear_scene()
    stone = pbr('StoneStatue', (0.66, 0.61, 0.52), 0.94)
    bib = pbr('JizoBib', (0.78, 0.20, 0.13), 0.78)
    hat = pbr('JizoHat', (0.62, 0.45, 0.20), 0.88)
    cyl('JizoBase', (0,0,0.08), 0.22, 0.16, stone, verts=14, bevel=0.02)
    # Body — slightly tapered cylinder
    cyl('JizoBody', (0,0,0.40), 0.16, 0.52, stone, verts=14, bevel=0.01)
    # Head — sphere
    uv_sph('JizoHead', (0,0,0.78), 0.16, stone, segs=22, rings=18)
    # Hat (conical kasa)
    cone('JizoHat', (0,0,0.95), 0.22, 0.05, 0.10, hat, verts=12)
    # Bib (front panel)
    box('JizoBib', (0,0.13,0.55), (0.20,0.02,0.16), bib, bevel=0.005)
    # Hands together at front (small box)
    box('JizoHands', (0,0.10,0.46), (0.10,0.06,0.10), stone, bevel=0.012)
    join_and_export('jizo')


def build_hedge():
    """Trimmed rectangular hedge."""
    clear_scene()
    leaf = pbr('HedgeLeaf', (0.18, 0.40, 0.18), 0.92)
    leaf_dark = pbr('HedgeShade', (0.10, 0.26, 0.10), 0.94)
    box('HedgeBody', (0,0,0.50), (2.0, 0.8, 1.0), leaf, bevel=0.05, subsurf=2)
    # Sprinkle small bushy lobes on top for organic feel
    for i in range(7):
        x = -0.9 + i * 0.30
        uv_sph(f'Lobe_{i}', (x, 0, 1.10), 0.18 + (i%2)*0.03, leaf_dark, segs=14, rings=10)
    join_and_export('hedge')


def build_lily_pad():
    """Single lily pad with flower (for ponds)."""
    clear_scene()
    leaf = pbr('LilyLeaf', (0.30, 0.62, 0.32), 0.65)
    flower = pbr('LilyFlower', (0.96, 0.86, 0.50), 0.55,
                 emit=(1.0, 0.85, 0.50), emit_strength=0.3)
    cyl('Pad', (0,0,0.02), 0.50, 0.03, leaf, verts=24)
    # Flower (5 petals + center)
    for i in range(5):
        ang = i * math.pi * 2 / 5
        uv_sph(f'Petal_{i}', (math.sin(ang)*0.06, math.cos(ang)*0.06, 0.10),
               0.06, flower, segs=14, rings=10)
    uv_sph('Center', (0,0,0.12), 0.05, pbr('LilyCenter', (1.0, 0.90, 0.42), 0.50), segs=14, rings=10)
    join_and_export('lily_pad')


# ─── CHIBI CHARACTER (avatar / NPC) ───────────────────────────────────
def build_chibi():
    """Stylized chibi humanoid character (~1.2m tall)."""
    clear_scene()
    skin = pbr('Skin', (0.95, 0.78, 0.62), 0.55)
    cloth = pbr('Cloth', (0.25, 0.42, 0.62), 0.78)
    pants = pbr('Pants', (0.15, 0.10, 0.07), 0.85)
    hair = pbr('Hair', (0.08, 0.05, 0.03), 0.55)
    hat = pbr('Hat', (0.85, 0.66, 0.40), 0.88)

    # Feet
    box('FootL', (-0.10, 0.04, 0.05), (0.10, 0.20, 0.06), pbr('Shoe', (0.18, 0.10, 0.05), 0.88), bevel=0.015)
    box('FootR', (0.10, 0.04, 0.05), (0.10, 0.20, 0.06), pbr('Shoe', (0.18, 0.10, 0.05), 0.88), bevel=0.015)
    # Legs (capsule-ish)
    cyl('LegL', (-0.10, 0, 0.28), 0.08, 0.44, pants, verts=14, bevel=0.012)
    cyl('LegR', (0.10, 0, 0.28), 0.08, 0.44, pants, verts=14, bevel=0.012)
    # Body — chubby torso
    uv_sph('Torso', (0, 0, 0.70), 0.24, cloth, segs=22, rings=16)
    # Belt (small sash)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(0, 0, 0.62))
    bpy.context.active_object.data.materials.append(pbr('Sash', (0.62, 0.15, 0.10), 0.78))
    # Arms
    cyl('ArmL', (-0.27, 0, 0.72), 0.065, 0.40, cloth, verts=12, bevel=0.012)
    cyl('ArmR', (0.27, 0, 0.72), 0.065, 0.40, cloth, verts=12, bevel=0.012)
    # Hands
    uv_sph('HandL', (-0.27, 0, 0.50), 0.065, skin, segs=14, rings=10)
    uv_sph('HandR', (0.27, 0, 0.50), 0.065, skin, segs=14, rings=10)
    # Big chibi head
    uv_sph('Head', (0, 0, 1.05), 0.24, skin, segs=24, rings=20)
    # Hair cap (top half sphere darker)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.245, location=(0, 0, 1.05), segments=22, ring_count=18)
    o = bpy.context.active_object; o.name = 'HairCap'
    # Cut bottom half by scaling
    o.scale.z = 0.6
    o.location.z = 1.13
    o.data.materials.append(hair)
    # Conical kasa hat
    cone('Hat', (0, 0, 1.30), 0.32, 0.04, 0.14, hat, verts=18)
    # Hat rim
    bpy.ops.mesh.primitive_torus_add(major_radius=0.30, minor_radius=0.025, location=(0, 0, 1.27))
    bpy.context.active_object.data.materials.append(pbr('HatRim', (0.65, 0.45, 0.20), 0.85))
    # Eyes — tiny dark dots
    uv_sph('EyeL', (-0.08, 0.18, 1.08), 0.022, pbr('Eye', (0.05, 0.03, 0.02), 0.40), segs=10, rings=8)
    uv_sph('EyeR', (0.08, 0.18, 1.08), 0.022, pbr('Eye2', (0.05, 0.03, 0.02), 0.40), segs=10, rings=8)
    # Cheek blush
    uv_sph('CheekL', (-0.13, 0.16, 1.02), 0.025, pbr('Cheek', (0.95, 0.50, 0.45), 0.55, emit=(1.0, 0.5, 0.5), emit_strength=0.1), segs=10, rings=8)
    uv_sph('CheekR', (0.13, 0.16, 1.02), 0.025, pbr('Cheek2', (0.95, 0.50, 0.45), 0.55, emit=(1.0, 0.5, 0.5), emit_strength=0.1), segs=10, rings=8)
    join_and_export('chibi')


# ─── MAIN ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('=== Kominka variants ===')
    build_kominka_variant('kominka_red',   (0.88, 0.82, 0.66), (0.45, 0.16, 0.10))
    build_kominka_variant('kominka_blue',  (0.82, 0.86, 0.90), (0.20, 0.30, 0.45))
    build_kominka_variant('kominka_green', (0.86, 0.84, 0.74), (0.22, 0.35, 0.20))
    print('\n=== Props ===')
    build_barrel()
    build_basket()
    build_sign()
    build_jizo()
    build_hedge()
    build_lily_pad()
    print('\n=== Chibi character ===')
    build_chibi()
    print('\n[DONE] all v2 assets exported to', OUT_DIR)
