"""
Pack v23 — magical fantasy props (painted-game-art level).
Targets the visual density of the user's reference painted-fantasy map image:
  - glowing crystal clusters
  - giant neon mushrooms
  - flame braziers w/ urn
  - glow-eye totems
  - mossy boulders
  - stream segments w/ foam
  - dragon idol statue
  - waypoint pillar (lit beacon)
Run headless:
  blender --background --python build_pack_v23.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(23)


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


def box(name, loc, sz, mat=None, bevel=0.0, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = sz
    if mat: o.data.materials.append(mat)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = 2
    return o


def cyl(name, loc, r, depth, mat=None, verts=32, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def cone(name, loc, r1, r2, depth, mat=None, verts=16, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def uv_sph(name, loc, r, mat=None, segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=rings)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def torus(name, loc, R, r, mat=None, maj=24, min_=8, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=R, minor_radius=r,
                                      major_segments=maj, minor_segments=min_, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    return o


def ico(name, loc, r, mat=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=loc, subdivisions=subdivisions)
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


# ─── 1. MAGIC CRYSTAL CLUSTER ────────────────────────────────────────
def build_magic_crystal_cluster():
    """Large central crystal + 6 satellite shards, all heavily emissive (purple/cyan mix)."""
    clear_scene()
    purple    = pbr('CrPurple',  (0.55, 0.30, 0.85), 0.20, metal=0.3,
                    emit=(0.78, 0.45, 1.00), emit_strength=4.5)
    cyan      = pbr('CrCyan',    (0.30, 0.65, 0.90), 0.20, metal=0.3,
                    emit=(0.50, 0.85, 1.00), emit_strength=4.0)
    pink      = pbr('CrPink',    (0.85, 0.35, 0.60), 0.20, metal=0.3,
                    emit=(1.00, 0.50, 0.75), emit_strength=4.0)
    stone     = pbr('CrStone',   (0.42, 0.40, 0.38), 0.92)
    stone_d   = pbr('CrStoneD',  (0.22, 0.20, 0.18), 0.92)
    moss      = pbr('CrMoss',    (0.32, 0.55, 0.24), 0.92)
    # 1) Mossy stone base — irregular boulder
    ico('Base', (0, 0, 0.20), 0.55, stone, subdivisions=2)
    o = bpy.context.active_object; o.scale = (1.4, 1.2, 0.5)
    # 2) Big central crystal (sharp hex pillar)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=1.40, vertices=6,
                                          location=(0, 0, 0.90))
    o = bpy.context.active_object; o.name = 'BigCrystal'
    o.data.materials.append(purple)
    # Tapered tip cone
    cone('BigTip', (0, 0, 1.85), 0.18, 0.0, 0.40, purple, verts=6)
    # 3) 6 satellite crystals at various angles + colors
    rng = random.Random(2301)
    crystals = [
        (math.radians(20), math.radians(0),   0.30, 0.90, cyan),
        (math.radians(-15), math.radians(50), 0.25, 0.75, pink),
        (math.radians(25), math.radians(110), 0.32, 1.00, purple),
        (math.radians(-20), math.radians(160), 0.22, 0.70, cyan),
        (math.radians(15), math.radians(220), 0.28, 0.85, pink),
        (math.radians(-25), math.radians(290), 0.30, 0.95, purple),
    ]
    for i, (tilt_x, tilt_z, r, length, mat_) in enumerate(crystals):
        dx = math.sin(tilt_z) * math.cos(tilt_x) * 0.35
        dy = math.sin(tilt_x) * 0.35
        dz = math.cos(tilt_z) * math.cos(tilt_x) * 0.35
        bpy.ops.mesh.primitive_cylinder_add(radius=r*0.5, depth=length, vertices=6,
                                              location=(dx, dy, 0.50 + dz))
        o = bpy.context.active_object; o.name = f'Sat_{i}'
        o.rotation_euler = (tilt_x, 0, tilt_z)
        o.data.materials.append(mat_)
        # Tip cone for each
        tip_x = dx + math.sin(tilt_z) * math.cos(tilt_x) * length/2
        tip_y = dy + math.sin(tilt_x) * length/2
        tip_z = 0.50 + dz + math.cos(tilt_z) * math.cos(tilt_x) * length/2
        cone(f'SatTip_{i}', (tip_x, tip_y, tip_z), r*0.5, 0.0, length*0.3, mat_, verts=6,
             rot=(tilt_x, 0, tilt_z))
    # 4) 8 small glowing chips around the base
    for i in range(10):
        ang = rng.random() * math.pi * 2
        r = 0.50 + rng.random() * 0.40
        m = [purple, cyan, pink][i % 3]
        ico(f'Chip_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.10), 0.08 + rng.random()*0.04,
            m, subdivisions=1)
        o = bpy.context.active_object
        o.rotation_euler = (rng.random()*math.pi, rng.random()*math.pi, rng.random()*math.pi)
        o.scale = (1.0, 1.0, 1.6)
    # 5) Moss patches on the base
    for i in range(5):
        ang = i / 5 * math.pi * 2
        cyl(f'Moss_{i}', (math.cos(ang)*0.50, math.sin(ang)*0.50, 0.21),
            0.10, 0.012, moss, verts=12)
    # 6) Stone trim around base
    torus('BaseTrim', (0, 0, 0.05), 0.55, 0.04, stone_d, maj=24, min_=8)
    join_and_export('magic_crystal_cluster')


# ─── 2. GIANT MUSHROOM ───────────────────────────────────────────────
def build_giant_mushroom():
    """Oversized neon glowing mushroom — fantasy art style."""
    clear_scene()
    cap_red    = pbr('GmCap',     (0.92, 0.20, 0.25), 0.55,
                     emit=(1.00, 0.30, 0.35), emit_strength=1.5)
    cap_dark   = pbr('GmCapD',    (0.62, 0.10, 0.15), 0.65)
    spot       = pbr('GmSpot',    (0.96, 0.92, 0.85), 0.60,
                     emit=(1.0, 0.95, 0.85), emit_strength=1.0)
    stem       = pbr('GmStem',    (0.95, 0.92, 0.82), 0.85)
    stem_under = pbr('GmStemU',   (0.90, 0.78, 0.55), 0.85,
                     emit=(1.0, 0.78, 0.55), emit_strength=0.8)
    grass_base = pbr('GmGrass',   (0.32, 0.55, 0.24), 0.92)
    # 1) Grass mound
    cyl('Mound', (0, 0, 0.05), 0.45, 0.10, grass_base, verts=18)
    # 2) Tall fat stem (slightly tapered)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.20,
                                          location=(0, 0, 0.70), vertices=20)
    o = bpy.context.active_object; o.name = 'Stem'
    o.data.materials.append(stem)
    # Bottom flare (wider at base)
    cyl('StemBase', (0, 0, 0.18), 0.30, 0.20, stem, verts=20)
    # 3) Underside gills (lit ring under the cap)
    torus('Gills', (0, 0, 1.25), 0.36, 0.04, stem_under, maj=24, min_=8)
    # 4) Cap — large dome with rolled edge
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(0, 0, 1.50),
                                          segments=28, ring_count=14)
    o = bpy.context.active_object; o.name = 'Cap'
    o.scale = (1.2, 1.2, 0.85)
    o.data.materials.append(cap_red)
    # Cut top half — keep just the lower hemisphere visible by adding a small lid
    # Cap underside (darker red rim peeking out)
    torus('CapRim', (0, 0, 1.35), 0.55, 0.05, cap_dark, maj=28, min_=8)
    # 5) White spots on cap (8 small spheres)
    rng = random.Random(2311)
    for i in range(10):
        ang = rng.random() * math.pi * 2
        r = 0.30 + rng.random() * 0.15
        z = 1.55 + rng.random() * 0.25
        uv_sph(f'Spot_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.06 + rng.random()*0.02, spot, segs=10, rings=8)
    # 6) 3 baby mushrooms at the base (small variants)
    for i in range(4):
        ang = i / 4 * math.pi * 2 + 0.4
        bx = math.cos(ang) * 0.50
        by = math.sin(ang) * 0.50
        cyl(f'BabyStem_{i}', (bx, by, 0.18), 0.04, 0.18, stem, verts=10)
        uv_sph(f'BabyCap_{i}', (bx, by, 0.32), 0.10, cap_red, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.55)
    # 7) Small glow particles around the mushroom (5 emissive dots floating)
    spark = pbr('GmSpark', (1.0, 0.92, 0.55), 0.30,
                emit=(1.0, 0.92, 0.55), emit_strength=3.0)
    for i in range(7):
        ang = rng.random() * math.pi * 2
        r = 0.6 + rng.random() * 0.4
        z = 0.5 + rng.random() * 1.5
        uv_sph(f'Spark_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.025, spark, segs=8, rings=6)
    join_and_export('giant_mushroom')


# ─── 3. FLAME BRAZIER ────────────────────────────────────────────────
def build_flame_brazier():
    """Golden urn on stone pedestal w/ leaping flame + glow base — image-2 style."""
    clear_scene()
    gold       = pbr('FbGold',   (0.85, 0.65, 0.18), 0.40, metal=0.7)
    gold_d     = pbr('FbGoldD',  (0.55, 0.40, 0.10), 0.50, metal=0.6)
    stone      = pbr('FbStone',  (0.55, 0.50, 0.45), 0.95)
    stone_d    = pbr('FbStoneD', (0.32, 0.30, 0.25), 0.95)
    flame_y    = pbr('FbFlameY', (1.00, 0.90, 0.35), 0.20,
                     emit=(1.0, 0.85, 0.25), emit_strength=5.0)
    flame_o    = pbr('FbFlameO', (1.00, 0.55, 0.15), 0.20,
                     emit=(1.0, 0.55, 0.15), emit_strength=4.5)
    coal       = pbr('FbCoal',   (0.10, 0.06, 0.04), 0.95,
                     emit=(0.85, 0.30, 0.10), emit_strength=1.8)
    moss       = pbr('FbMoss',   (0.32, 0.55, 0.24), 0.92)
    # 1) Stone pedestal (3 stacked steps)
    cyl('Ped1', (0, 0, 0.08), 0.55, 0.16, stone, verts=24)
    cyl('Ped2', (0, 0, 0.26), 0.45, 0.16, stone_d, verts=24)
    cyl('Ped3', (0, 0, 0.44), 0.35, 0.12, stone, verts=24)
    # Trim ring
    torus('PedTrim', (0, 0, 0.50), 0.36, 0.018, gold_d, maj=24, min_=8)
    # 2) Golden urn — chalice shape
    cyl('UrnBase', (0, 0, 0.55), 0.18, 0.04, gold_d, verts=20)
    cyl('UrnStem', (0, 0, 0.65), 0.10, 0.12, gold, verts=18)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0, 0, 0.85),
                                          segments=24, ring_count=14)
    o = bpy.context.active_object; o.name = 'UrnBowl'
    o.scale = (1.0, 1.0, 0.85)
    o.data.materials.append(gold)
    # Urn rim
    torus('UrnRim', (0, 0, 1.05), 0.28, 0.025, gold_d, maj=24, min_=8)
    # Decorative bands on urn
    for z in [0.72, 0.88]:
        torus(f'UrnBand_{z}', (0, 0, z), 0.225, 0.008, gold_d, maj=24, min_=4)
    # 3) Coal bed inside urn (glow)
    cyl('Coals', (0, 0, 1.05), 0.22, 0.025, coal, verts=20)
    # 4) Flame — 5 stacked offset ellipsoids (the leaping shape)
    flames = [
        (0.00, 0.00, 1.15, 0.25, 0.30, flame_o),
        (0.04, -0.02, 1.32, 0.20, 0.25, flame_y),
        (-0.03, 0.01, 1.50, 0.15, 0.22, flame_y),
        (0.02, 0.00, 1.68, 0.10, 0.20, flame_y),
        (0.00, 0.00, 1.85, 0.06, 0.14, flame_y),
    ]
    for i, (x, y, z, r, h, mat_) in enumerate(flames):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z),
                                              segments=16, ring_count=10)
        o = bpy.context.active_object; o.name = f'Flame_{i}'
        o.scale = (1.0, 1.0, h/r)
        o.data.materials.append(mat_)
    # 5) 4 stone supports around the pedestal
    for i in range(4):
        ang = i / 4 * math.pi * 2 + math.pi/4
        cyl(f'Sup_{i}', (math.cos(ang)*0.50, math.sin(ang)*0.50, 0.18),
            0.06, 0.30, stone_d, verts=10)
    # 6) Glow ring on the ground (lit-up area indicator)
    glow_ring = pbr('FbGlowRing', (1.0, 0.55, 0.15), 0.30,
                    emit=(1.0, 0.55, 0.15), emit_strength=1.5)
    torus('GroundGlow', (0, 0, 0.015), 0.80, 0.020, glow_ring, maj=32, min_=4)
    # 7) Embers (5 small bright dots around the urn base)
    rng = random.Random(2321)
    for i in range(7):
        ang = rng.random() * math.pi * 2
        r = 0.30 + rng.random() * 0.30
        z = 0.6 + rng.random() * 0.5
        uv_sph(f'Ember_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.018, flame_y, segs=8, rings=6)
    # 8) Moss patches at base
    for i in range(4):
        ang = i / 4 * math.pi * 2 + 0.6
        cyl(f'Moss_{i}', (math.cos(ang)*0.55, math.sin(ang)*0.55, 0.16),
            0.08, 0.010, moss, verts=10)
    join_and_export('flame_brazier')


# ─── 4. GLOW EYE TOTEM ───────────────────────────────────────────────
def build_glow_eye_totem():
    """Stone pillar w/ carved eye sigil that glows."""
    clear_scene()
    stone     = pbr('GeStone',  (0.42, 0.40, 0.38), 0.92)
    stone_d   = pbr('GeStoneD', (0.22, 0.20, 0.18), 0.92)
    moss      = pbr('GeMoss',   (0.32, 0.55, 0.24), 0.92)
    rune      = pbr('GeRune',   (0.10, 0.08, 0.06), 0.92)
    eye_glow  = pbr('GeEye',    (1.0, 0.85, 0.25), 0.20,
                    emit=(1.0, 0.85, 0.25), emit_strength=4.5)
    eye_iris  = pbr('GeIris',   (0.85, 0.30, 0.10), 0.30,
                    emit=(1.0, 0.40, 0.15), emit_strength=2.5)
    pupil     = pbr('GePupil',  (0.05, 0.04, 0.04), 0.40)
    # Wider stone base
    box('Base', (0, 0, 0.08), (0.65, 0.50, 0.16), stone_d, bevel=0.01)
    box('BaseCap', (0, 0, 0.18), (0.72, 0.55, 0.04), stone)
    # Main pillar
    box('Pillar', (0, 0, 0.85), (0.42, 0.30, 1.20), stone, bevel=0.01)
    # Top cap
    box('Cap', (0, 0, 1.50), (0.50, 0.35, 0.08), stone_d, bevel=0.005)
    cone('CapTop', (0, 0, 1.58), 0.22, 0.05, 0.16, stone_d, verts=4, rot=(0, 0, math.pi/4))
    # Carved eye sigil (large, on the front face)
    # Eye outline (oval) — flat almond shape
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, -0.155, 1.0),
                                          segments=20, ring_count=14)
    o = bpy.context.active_object; o.name = 'EyeWhite'
    o.scale = (1.4, 0.05, 0.7)
    o.data.materials.append(eye_glow)
    # Iris (smaller circle)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0, -0.16, 1.0),
                                          segments=14, ring_count=10)
    o = bpy.context.active_object; o.name = 'EyeIris'
    o.scale = (1.0, 0.1, 1.0)
    o.data.materials.append(eye_iris)
    # Pupil
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0, -0.165, 1.0),
                                          segments=12, ring_count=8)
    o = bpy.context.active_object; o.name = 'Pupil'
    o.scale = (0.5, 0.1, 1.0)
    o.data.materials.append(pupil)
    # Rune marks below eye (3 dark horizontal slashes)
    for i, z in enumerate([0.65, 0.55, 0.45]):
        box(f'Rune_{i}', (0, -0.155, z), (0.20, 0.005, 0.02), rune)
    # Curling rune on sides
    box('SideRuneL', (-0.20, 0, 1.0), (0.005, 0.30, 0.30), rune)
    box('SideRuneR', ( 0.20, 0, 1.0), (0.005, 0.30, 0.30), rune)
    # Moss patches
    rng = random.Random(2331)
    for i in range(4):
        x = (rng.random()-0.5) * 0.6
        z = 0.20 + rng.random() * 0.5
        cyl(f'Moss_{i}', (x, 0.155, z), 0.06, 0.010, moss, verts=10)
    # Ground glow
    torus('GroundGlow', (0, 0, 0.015), 0.55, 0.018,
          pbr('GeGroundGlow', (1.0, 0.85, 0.25), 0.30,
              emit=(1.0, 0.85, 0.25), emit_strength=1.2), maj=28, min_=4)
    join_and_export('glow_eye_totem')


# ─── 5. MOSSY BOULDER ────────────────────────────────────────────────
def build_mossy_boulder():
    """Large organic mossy boulder cluster — 4 stones w/ moss caps."""
    clear_scene()
    stone_a = pbr('MbStoneA', (0.45, 0.42, 0.38), 0.95)
    stone_b = pbr('MbStoneB', (0.32, 0.30, 0.26), 0.95)
    stone_c = pbr('MbStoneC', (0.58, 0.52, 0.45), 0.95)
    moss    = pbr('MbMoss',   (0.32, 0.55, 0.24), 0.92)
    moss_l  = pbr('MbMossL',  (0.50, 0.68, 0.30), 0.90)
    grass   = pbr('MbGrass',  (0.42, 0.65, 0.32), 0.85)
    # 4 stones of decreasing size in a cluster
    rng = random.Random(2341)
    stones_data = [
        (0.0, 0.0, 0.50, 0.65, stone_a, (1.4, 1.1, 0.85)),
        (0.5, 0.3, 0.30, 0.40, stone_b, (1.2, 1.0, 0.75)),
        (-0.45, -0.2, 0.25, 0.35, stone_c, (1.1, 1.3, 0.75)),
        (0.2, -0.45, 0.20, 0.28, stone_a, (1.0, 1.1, 0.65)),
    ]
    for i, (x, y, z, r, mat_, scale) in enumerate(stones_data):
        ico(f'Stone_{i}', (x, y, z), r, mat_, subdivisions=2)
        o = bpy.context.active_object; o.scale = scale
        o.rotation_euler = (rng.random()*0.4, rng.random()*0.4, rng.random()*math.pi)
    # Moss caps on top of each stone
    moss_caps = [
        (0.0, 0.0, 0.85, 0.55, moss),
        (0.5, 0.3, 0.55, 0.32, moss_l),
        (-0.45, -0.2, 0.48, 0.30, moss),
        (0.2, -0.45, 0.36, 0.22, moss_l),
    ]
    for i, (x, y, z, r, mat_) in enumerate(moss_caps):
        ico(f'MossCap_{i}', (x, y, z), r, mat_, subdivisions=2)
        o = bpy.context.active_object; o.scale = (1.4, 1.4, 0.5)
    # 6 grass tufts at the base
    for i in range(8):
        ang = rng.random() * math.pi * 2
        r = 0.6 + rng.random() * 0.4
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        for k in range(3):
            kang = k / 3 * math.pi * 2
            cyl(f'Grass_{i}_{k}', (x + math.cos(kang)*0.04, y + math.sin(kang)*0.04, 0.08),
                0.005, 0.16, grass, verts=4,
                rot=(0, (rng.random()-0.5)*0.4, 0))
    # 2 small flowers
    flower = pbr('MbFlower', (0.95, 0.78, 0.32), 0.65,
                 emit=(0.95, 0.78, 0.32), emit_strength=0.4)
    for i in range(3):
        ang = rng.random() * math.pi * 2
        r = 0.7
        uv_sph(f'Flower_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.18),
               0.025, flower, segs=8, rings=6)
    join_and_export('mossy_boulder')


# ─── 6. STREAM SEGMENT ───────────────────────────────────────────────
def build_stream_segment():
    """Stream piece — water with foam edges, mossy bank stones."""
    clear_scene()
    water    = pbr('SmWater',  (0.30, 0.58, 0.72), 0.20, metal=0.3,
                   emit=(0.40, 0.68, 0.82), emit_strength=0.30)
    foam     = pbr('SmFoam',   (0.95, 0.95, 0.96), 0.50,
                   emit=(0.95, 0.95, 0.96), emit_strength=0.40)
    foam_d   = pbr('SmFoamD',  (0.85, 0.88, 0.90), 0.55)
    stone_a  = pbr('SmStoneA', (0.45, 0.42, 0.38), 0.95)
    stone_b  = pbr('SmStoneB', (0.58, 0.52, 0.45), 0.95)
    moss     = pbr('SmMoss',   (0.32, 0.55, 0.24), 0.92)
    sand     = pbr('SmSand',   (0.78, 0.68, 0.45), 0.88)
    # Earth bed (recessed)
    box('Bed', (0, 0, -0.05), (2.50, 0.80, 0.10), sand, bevel=0.005)
    # Water surface (slightly above bed)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.02))
    o = bpy.context.active_object; o.name = 'WaterSurface'
    o.scale = (2.40, 0.70, 0.005)
    o.data.materials.append(water)
    # Foam streaks along edges (top + bottom)
    box('FoamN', (0, 0.32, 0.03), (2.40, 0.10, 0.005), foam)
    box('FoamS', (0, -0.32, 0.03), (2.40, 0.10, 0.005), foam)
    # 6 foam swirls across the stream
    rng = random.Random(2351)
    for i in range(8):
        x = -1.10 + i * 0.32
        y = (rng.random()-0.5) * 0.5
        cyl(f'FoamSw_{i}', (x, y, 0.025), 0.06 + rng.random()*0.04, 0.004,
            foam_d, verts=10)
    # Bank stones — 6 on each side
    for side in [-1, 1]:
        for i in range(7):
            x = -1.0 + i * 0.35
            sy = side * (0.42 + rng.random()*0.08)
            sz = 0.06 + rng.random() * 0.06
            m = stone_a if i % 2 == 0 else stone_b
            ico(f'Bank_{side}_{i}', (x, sy, sz), 0.10 + rng.random()*0.04, m,
                subdivisions=1)
            o = bpy.context.active_object
            o.scale = (1.0 + rng.random()*0.3, 0.8, 0.7)
            o.rotation_euler = (0, 0, rng.random()*math.pi)
    # Moss on every other bank stone
    for side in [-1, 1]:
        for i in range(0, 7, 2):
            x = -1.0 + i * 0.35
            sy = side * 0.42
            cyl(f'BankMoss_{side}_{i}', (x, sy, 0.13), 0.05, 0.008, moss, verts=8)
    # 3 lily pads on the water
    pad_m = pbr('SmLily', (0.38, 0.65, 0.32), 0.80)
    flower_m = pbr('SmLilyF', (0.96, 0.85, 0.55), 0.70,
                   emit=(1.0, 0.78, 0.42), emit_strength=0.6)
    for i in range(4):
        x = -0.9 + i * 0.55
        y = (rng.random()-0.5) * 0.4
        cyl(f'Pad_{i}', (x, y, 0.026), 0.12, 0.005, pad_m, verts=12)
        # Lily flower on some
        if i % 2 == 0:
            uv_sph(f'PadFlower_{i}', (x, y, 0.05), 0.04, flower_m, segs=10, rings=6)
            o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.6)
    # 2 glow particles floating above (fireflies)
    glow = pbr('SmGlow', (1.0, 0.92, 0.55), 0.30,
               emit=(1.0, 0.92, 0.55), emit_strength=4.0)
    for i in range(3):
        x = -0.6 + i * 0.6
        uv_sph(f'Glow_{i}', (x, (rng.random()-0.5)*0.3, 0.18),
               0.025, glow, segs=8, rings=6)
    join_and_export('stream_segment')


# ─── 7. DRAGON IDOL ──────────────────────────────────────────────────
def build_dragon_idol():
    """Stylized dragon statue — coiled body, raised head, glowing eyes."""
    clear_scene()
    stone     = pbr('DiStone',  (0.42, 0.40, 0.38), 0.92)
    stone_d   = pbr('DiStoneD', (0.25, 0.22, 0.20), 0.92)
    scale_m   = pbr('DiScale',  (0.45, 0.20, 0.18), 0.65)  # dragon-red scales
    scale_d   = pbr('DiScaleD', (0.25, 0.10, 0.08), 0.70)
    eye_glow  = pbr('DiEye',    (1.0, 0.30, 0.10), 0.30,
                    emit=(1.0, 0.30, 0.10), emit_strength=5.0)
    horn      = pbr('DiHorn',   (0.85, 0.78, 0.65), 0.85)
    moss      = pbr('DiMoss',   (0.32, 0.55, 0.24), 0.92)
    fire      = pbr('DiFire',   (1.0, 0.55, 0.15), 0.20,
                    emit=(1.0, 0.55, 0.15), emit_strength=4.0)
    # Stone pedestal (low rocky base)
    ico('Base', (0, 0, 0.20), 0.70, stone_d, subdivisions=2)
    o = bpy.context.active_object; o.scale = (1.4, 1.1, 0.35)
    # Body — coiled (3 segments curving up)
    body_pts = [
        (-0.30, 0.10, 0.45, 0.25),
        (0.10, 0.20, 0.55, 0.22),
        (0.35, -0.05, 0.70, 0.18),
        (0.20, -0.25, 0.90, 0.15),
        (-0.05, -0.10, 1.10, 0.13),
    ]
    for i, (x, y, z, r) in enumerate(body_pts):
        ico(f'Body_{i}', (x, y, z), r, scale_m, subdivisions=2)
        o = bpy.context.active_object; o.scale = (1.4, 1.0, 1.0)
        # Scale ridge on top
        if i < 4:
            uv_sph(f'Ridge_{i}', (x, y, z + r*0.7), r*0.5, scale_d, segs=10, rings=8)
    # Head (larger, raised, facing forward)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(-0.10, -0.30, 1.30),
                                          segments=20, ring_count=14)
    o = bpy.context.active_object; o.name = 'Head'
    o.scale = (1.0, 1.4, 0.95)
    o.data.materials.append(scale_m)
    # Snout
    box('Snout', (-0.10, -0.48, 1.28), (0.16, 0.18, 0.10), scale_m, bevel=0.01)
    # 2 horns curving back
    for x_sign in [-1, 1]:
        cyl(f'Horn_{x_sign}', (-0.10 + x_sign*0.10, -0.22, 1.50), 0.025, 0.30, horn, verts=10,
            rot=(math.radians(-30), 0, x_sign*math.radians(15)))
        cone(f'HornTip_{x_sign}', (-0.10 + x_sign*0.16, -0.10, 1.65), 0.025, 0.005, 0.15, horn, verts=6,
             rot=(math.radians(-45), 0, x_sign*math.radians(20)))
    # 2 glowing eyes
    for x_sign in [-1, 1]:
        uv_sph(f'Eye_{x_sign}', (-0.10 + x_sign*0.08, -0.40, 1.34),
               0.025, eye_glow, segs=10, rings=8)
    # Open jaw — small fire breath effect (3 stacked flames)
    for i, z_off in enumerate([0.0, 0.05, 0.10]):
        uv_sph(f'Fire_{i}', (-0.10, -0.65 - i*0.04, 1.22 - z_off),
               0.06 - i*0.012, fire, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.4, 1.0)
    # Tail (curving back)
    for i, (x, y, z, r) in enumerate([(-0.45, 0.30, 0.35, 0.10),
                                        (-0.60, 0.45, 0.30, 0.08),
                                        (-0.72, 0.60, 0.28, 0.06)]):
        ico(f'Tail_{i}', (x, y, z), r, scale_m, subdivisions=1)
    # Tail tip (sharp)
    cone('TailTip', (-0.80, 0.72, 0.28), 0.06, 0.0, 0.12, scale_m, verts=6,
         rot=(0, math.radians(80), 0))
    # 4 small leg / claw
    for i, (x, y) in enumerate([(-0.20, 0.20), (0.30, 0.10), (-0.10, -0.15), (0.25, -0.25)]):
        cyl(f'Leg_{i}', (x, y, 0.30), 0.04, 0.20, scale_d, verts=8)
        uv_sph(f'Claw_{i}', (x, y, 0.18), 0.05, scale_d, segs=8, rings=6)
        o = bpy.context.active_object; o.scale = (1.4, 1.0, 0.6)
    # Moss patches on the statue (eroded ancient look)
    rng = random.Random(2361)
    for i in range(6):
        ang = rng.random() * math.pi * 2
        r = rng.random() * 0.5
        z = rng.random() * 1.0 + 0.3
        cyl(f'StatueMoss_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
            0.04 + rng.random()*0.03, 0.008, moss, verts=8)
    join_and_export('dragon_idol')


# ─── 8. WAYPOINT PILLAR ──────────────────────────────────────────────
def build_waypoint_pillar():
    """Lit stone beacon pillar — fantasy fast-travel marker w/ floating rune."""
    clear_scene()
    stone     = pbr('WpStone',  (0.55, 0.50, 0.45), 0.95)
    stone_d   = pbr('WpStoneD', (0.32, 0.30, 0.25), 0.95)
    rune      = pbr('WpRune',   (0.30, 0.70, 1.00), 0.20,
                    emit=(0.40, 0.80, 1.0), emit_strength=5.0)
    metal     = pbr('WpMetal',  (0.85, 0.65, 0.18), 0.30, metal=0.7)
    gem       = pbr('WpGem',    (0.50, 0.85, 1.0), 0.20, metal=0.3,
                    emit=(0.60, 0.90, 1.0), emit_strength=4.5)
    moss      = pbr('WpMoss',   (0.32, 0.55, 0.24), 0.92)
    glow_ring = pbr('WpRing',   (0.40, 0.80, 1.0), 0.30,
                    emit=(0.40, 0.80, 1.0), emit_strength=2.0)
    # Hexagonal base
    cyl('Base', (0, 0, 0.10), 0.50, 0.20, stone_d, verts=6)
    cyl('BaseCap', (0, 0, 0.21), 0.55, 0.04, stone, verts=6)
    # Main pillar (slim hex column)
    cyl('Pillar', (0, 0, 0.90), 0.18, 1.20, stone, verts=6)
    # Carved runes on the pillar (6 vertical glowing slashes)
    for i in range(6):
        ang = i / 6 * math.pi * 2 + math.pi/12
        rx = math.cos(ang) * 0.19
        ry = math.sin(ang) * 0.19
        box(f'Rune_{i}', (rx, ry, 0.90), (0.04, 0.005, 0.40), rune,
            rot=(0, 0, ang + math.pi/2))
    # Cap with crown of small spikes
    cyl('Cap', (0, 0, 1.55), 0.25, 0.08, stone_d, verts=6)
    for i in range(6):
        ang = i / 6 * math.pi * 2 + math.pi/12
        cone(f'Spike_{i}', (math.cos(ang)*0.22, math.sin(ang)*0.22, 1.66),
             0.030, 0.005, 0.16, stone, verts=4)
    # Floating gem above (the waypoint icon)
    ico('Gem', (0, 0, 1.95), 0.13, gem, subdivisions=1)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.4)
    o.rotation_euler = (0, 0, math.pi/4)
    # Metal ring around gem
    torus('GemRing', (0, 0, 1.95), 0.18, 0.012, metal, maj=24, min_=4, rot=(math.pi/2, 0, 0))
    torus('GemRing2', (0, 0, 1.95), 0.18, 0.012, metal, maj=24, min_=4, rot=(0, math.pi/2, 0))
    # Glow ring on the ground
    torus('GroundGlow', (0, 0, 0.015), 0.70, 0.020, glow_ring, maj=32, min_=4)
    # 6 small floating glow particles around the gem
    rng = random.Random(2371)
    for i in range(8):
        ang = i / 8 * math.pi * 2
        r = 0.30 + rng.random() * 0.10
        z = 1.85 + (rng.random()-0.5) * 0.20
        uv_sph(f'GlowDot_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.022, gem, segs=8, rings=6)
    # Moss at base
    for i in range(4):
        ang = i / 4 * math.pi * 2 + 0.4
        cyl(f'Moss_{i}', (math.cos(ang)*0.48, math.sin(ang)*0.48, 0.21),
            0.08, 0.010, moss, verts=10)
    join_and_export('waypoint_pillar')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_magic_crystal_cluster()
    build_giant_mushroom()
    build_flame_brazier()
    build_glow_eye_totem()
    build_mossy_boulder()
    build_stream_segment()
    build_dragon_idol()
    build_waypoint_pillar()
    print(f'[DONE] pack v23 exported to {OUT_DIR}')
