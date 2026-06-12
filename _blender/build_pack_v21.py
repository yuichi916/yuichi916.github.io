"""
Pack v21 — onsen (hot spring) / bath house kit.
Builds:
  yukimi_lantern, onsen_pool, yu_bucket, towel_rack,
  yukata_rack, hot_spring_rocks, steam_post, bath_stool
Run headless:
  blender --background --python build_pack_v21.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(21)


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


# ─── 1. YUKIMI LANTERN ───────────────────────────────────────────────
def build_yukimi_lantern():
    """Squat 3-leg snow-viewing stone lantern w/ wide top umbrella + 4 leg supports."""
    clear_scene()
    stone = pbr('YlStone', (0.55, 0.52, 0.48), 0.95)
    stone_d = pbr('YlStoneD', (0.32, 0.30, 0.25), 0.95)
    moss = pbr('YlMoss', (0.32, 0.55, 0.24), 0.92)
    glow = pbr('YlGlow', (1.0, 0.78, 0.42), 0.30,
               emit=(1.0, 0.78, 0.42), emit_strength=2.5)
    # 3 curved legs (the iconic yukimi tripod stance)
    for i in range(3):
        ang = i / 3 * math.pi * 2
        # Outer foot pad
        cyl(f'Foot_{i}', (math.cos(ang)*0.30, math.sin(ang)*0.30, 0.05), 0.07, 0.10, stone_d, verts=12)
        # Leg (curved cylinder approximated by 2 angled cylinders)
        cyl(f'LegLow_{i}', (math.cos(ang)*0.22, math.sin(ang)*0.22, 0.15), 0.04, 0.25, stone, verts=8,
            rot=(math.sin(ang)*0.3, -math.cos(ang)*0.3, 0))
        cyl(f'LegMid_{i}', (math.cos(ang)*0.12, math.sin(ang)*0.12, 0.30), 0.04, 0.20, stone, verts=8,
            rot=(math.sin(ang)*0.15, -math.cos(ang)*0.15, 0))
    # Central platform (where light chamber sits)
    cyl('Platform', (0, 0, 0.45), 0.18, 0.05, stone_d, verts=18)
    # Light chamber (round)
    cyl('Chamber', (0, 0, 0.55), 0.13, 0.16, stone, verts=18)
    # Window openings (4 dark slits revealing glow)
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        box(f'Window_{sx}_{sy}', (sx*0.135, sy*0.135, 0.55), (0.04, 0.04, 0.10), glow,
            rot=(0, 0, 0))
    # Wide flat snow-collecting top (the "snow-viewing" disc)
    cyl('Umbrella', (0, 0, 0.72), 0.32, 0.04, stone, verts=24)
    # Decorative ridge under umbrella
    torus('Ridge', (0, 0, 0.69), 0.32, 0.012, stone_d, maj=20, min_=4)
    # Small finial
    uv_sph('Finial', (0, 0, 0.78), 0.04, stone_d, segs=12, rings=8)
    cone('FinialTop', (0, 0, 0.84), 0.030, 0.0, 0.06, stone_d, verts=6)
    # Moss patches
    rng = random.Random(401)
    for i in range(4):
        ang = rng.random() * math.pi * 2
        r = 0.30 + rng.random() * 0.05
        uv_sph(f'Moss_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.08), 0.05, moss, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.4, 1.4, 0.4)
    join_and_export('yukimi_lantern')


# ─── 2. ONSEN POOL ───────────────────────────────────────────────────
def build_onsen_pool():
    """Outdoor rotemburo — natural stone-rim pool w/ steaming water + rocks + bamboo spout."""
    clear_scene()
    rock = pbr('OpRock', (0.42, 0.38, 0.32), 0.95)
    rock_d = pbr('OpRockD', (0.22, 0.20, 0.18), 0.95)
    rock_l = pbr('OpRockL', (0.55, 0.52, 0.45), 0.95)
    moss = pbr('OpMoss', (0.32, 0.55, 0.24), 0.92)
    water = pbr('OpWater', (0.45, 0.72, 0.82), 0.20, metal=0.3,
                emit=(0.50, 0.78, 0.88), emit_strength=0.30)
    steam = pbr('OpSteam', (0.92, 0.93, 0.95), 0.85,
                emit=(0.92, 0.93, 0.95), emit_strength=0.15)
    bamboo = pbr('OpBamboo', (0.62, 0.50, 0.20), 0.85)
    # Excavated pool — oval depression in the ground
    bpy.ops.mesh.primitive_cylinder_add(radius=1.30, depth=0.40, location=(0, 0, -0.10),
                                          vertices=32)
    o = bpy.context.active_object; o.name = 'Excav'
    o.scale = (1.0, 0.85, 1.0)
    o.data.materials.append(rock_d)
    # Water disc inside
    bpy.ops.mesh.primitive_cylinder_add(radius=1.20, depth=0.02, location=(0, 0, 0.06),
                                          vertices=32)
    o = bpy.context.active_object; o.name = 'Water'
    o.scale = (1.0, 0.85, 1.0)
    o.data.materials.append(water)
    # Pool rim — 20 large rocks around the edge
    rng = random.Random(411)
    for i in range(22):
        ang = i / 22 * math.pi * 2
        rad_x = 1.30 + rng.random() * 0.12
        rad_y = 1.10 + rng.random() * 0.12
        cx = math.cos(ang) * rad_x
        cy = math.sin(ang) * rad_y
        z = 0.08 + rng.random() * 0.04
        size = 0.14 + rng.random() * 0.10
        m = rock if i % 3 != 0 else rock_l
        uv_sph(f'Rim_{i}', (cx, cy, z), size, m, segs=10, rings=8)
        o = bpy.context.active_object
        o.scale = (1.0 + rng.random()*0.5, 0.7 + rng.random()*0.3, 0.8 + rng.random()*0.4)
        o.rotation_euler = (rng.random()*0.5, rng.random()*0.5, rng.random()*math.pi)
    # 3 large interior rocks (sitting submerged)
    for i, (x, y) in enumerate([(0.6, 0.3), (-0.5, -0.4), (-0.2, 0.6)]):
        uv_sph(f'Submerged_{i}', (x, y, 0.05), 0.18, rock, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.2, 1.0, 0.6)
    # Moss on rim rocks (3 patches)
    for i in range(5):
        ang = rng.random() * math.pi * 2
        cx = math.cos(ang) * 1.25
        cy = math.sin(ang) * 1.0
        uv_sph(f'Moss_{i}', (cx, cy, 0.18), 0.10, moss, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.5, 1.5, 0.4)
    # Bamboo water spout (kakehi) — angled tube delivering water to pool
    cyl('SpoutPost', (1.45, -0.8, 0.40), 0.025, 0.80, bamboo, verts=10)
    cyl('Spout', (1.15, -0.65, 0.65), 0.030, 0.50, bamboo, verts=10,
        rot=(0, math.radians(75), math.radians(35)))
    # Water droplet from spout
    uv_sph('Drop', (0.85, -0.50, 0.30), 0.025, water, segs=10, rings=8)
    # Steam puffs above water (5 large soft spheres)
    for i, (x, y, z, s) in enumerate([
        (0.3, 0.1, 0.45, 0.20),
        (-0.4, 0.2, 0.40, 0.18),
        (0.0, -0.3, 0.50, 0.22),
        (0.6, -0.4, 0.45, 0.18),
        (-0.5, -0.2, 0.42, 0.20),
    ]):
        uv_sph(f'Steam_{i}', (x, y, z), s, steam, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (1.4, 1.2, 0.65)
    # Tiny water ripples (3 small toruses on water surface)
    for k in range(3):
        torus(f'Ripple_{k}', (0.3, 0.2, 0.075), 0.08 + k*0.04, 0.005, water, maj=20, min_=4)
    join_and_export('onsen_pool')


# ─── 3. YU BUCKET (wash water pail) ──────────────────────────────────
def build_yu_bucket():
    """Small wooden yu bucket w/ rope handle, ladle inside, slatted construction."""
    clear_scene()
    wood = pbr('YbWood', (0.62, 0.42, 0.22), 0.92)
    wood_d = pbr('YbWoodD', (0.42, 0.28, 0.16), 0.92)
    rope = pbr('YbRope', (0.78, 0.62, 0.42), 0.95)
    bamboo = pbr('YbBamboo', (0.85, 0.75, 0.35), 0.85)
    water = pbr('YbWater', (0.55, 0.78, 0.88), 0.20, metal=0.3,
                emit=(0.60, 0.82, 0.92), emit_strength=0.15)
    # Bucket body
    cyl('Body', (0, 0, 0.12), 0.14, 0.20, wood, verts=20)
    # 8 vertical wood slats suggested
    for i in range(10):
        ang = i / 10 * math.pi * 2
        cyl(f'Slat_{i}', (math.cos(ang)*0.142, math.sin(ang)*0.142, 0.12), 0.010, 0.20,
            wood_d, verts=4)
    # 2 iron-band style horizontal rings (suggesting hoops)
    torus('HoopTop', (0, 0, 0.21), 0.145, 0.012, wood_d, maj=20, min_=6)
    torus('HoopBot', (0, 0, 0.03), 0.145, 0.012, wood_d, maj=20, min_=6)
    # Bottom disc
    cyl('Bottom', (0, 0, 0.02), 0.14, 0.020, wood_d, verts=20)
    # Water inside
    cyl('Water', (0, 0, 0.20), 0.13, 0.005, water, verts=18)
    # Bamboo ladle (hishaku) leaning inside the bucket
    cyl('LadleHandle', (0.10, 0.06, 0.30), 0.012, 0.40, bamboo, verts=8,
        rot=(0, math.radians(20), math.radians(-25)))
    # Ladle cup (small bowl shape)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(-0.04, 0.0, 0.20),
                                          segments=16, ring_count=10)
    o = bpy.context.active_object; o.name = 'LadleCup'
    o.scale = (1.0, 1.0, 0.55)
    o.data.materials.append(bamboo)
    # Rope handle (arch over bucket)
    torus('Handle', (0, 0, 0.30), 0.14, 0.012, rope, maj=14, min_=4, rot=(math.pi/2, 0, 0))
    join_and_export('yu_bucket')


# ─── 4. TOWEL RACK ───────────────────────────────────────────────────
def build_towel_rack():
    """Wood rack w/ 4 hanging folded towels in different colors."""
    clear_scene()
    wood = pbr('TrWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('TrWoodD', (0.22, 0.14, 0.08), 0.92)
    towel_w = pbr('TrTowelW', (0.96, 0.94, 0.88), 0.90)
    towel_b = pbr('TrTowelB', (0.18, 0.40, 0.65), 0.90)
    towel_g = pbr('TrTowelG', (0.32, 0.62, 0.42), 0.90)
    towel_r = pbr('TrTowelR', (0.78, 0.18, 0.20), 0.90)
    stripe = pbr('TrStripe', (0.18, 0.14, 0.10), 0.85)
    # Base
    box('Base', (0, 0, 0.04), (0.45, 0.18, 0.08), wood_d, bevel=0.005)
    # 2 vertical posts
    for x_sign in [-1, 1]:
        cyl(f'Post_{x_sign}', (x_sign*0.20, 0, 0.50), 0.020, 0.85, wood, verts=8)
    # Top crossbar
    cyl('Cross', (0, 0, 0.90), 0.020, 0.50, wood, verts=8, rot=(0, math.pi/2, 0))
    # End caps
    for x_sign in [-1, 1]:
        uv_sph(f'CrossCap_{x_sign}', (x_sign*0.25, 0, 0.90), 0.025, wood_d, segs=10, rings=8)
    # 4 folded towels hanging over the bar
    towels = [towel_w, towel_b, towel_g, towel_r]
    for i, m in enumerate(towels):
        x = -0.18 + i * 0.12
        # Folded towel — a small bent panel
        box(f'TowelTop_{i}', (x, 0, 0.83), (0.10, 0.08, 0.04), m)
        box(f'TowelFront_{i}', (x, 0.04, 0.60), (0.10, 0.005, 0.22), m)
        box(f'TowelBack_{i}', (x, -0.04, 0.60), (0.10, 0.005, 0.22), m)
        sm = bpy.context.active_object.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.005
        # Decorative stripe (single horizontal line on each towel front)
        box(f'Stripe_{i}', (x, 0.045, 0.55), (0.08, 0.005, 0.010), stripe)
    join_and_export('towel_rack')


# ─── 5. YUKATA RACK ──────────────────────────────────────────────────
def build_yukata_rack():
    """T-shaped wood rack w/ 2 hanging yukata robes folded over crossbar."""
    clear_scene()
    wood = pbr('YkWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('YkWoodD', (0.22, 0.14, 0.08), 0.92)
    yukata_b = pbr('YkBlue', (0.22, 0.35, 0.65), 0.85)
    yukata_p = pbr('YkPink', (0.92, 0.55, 0.65), 0.85)
    obi_w = pbr('YkObiW', (0.96, 0.92, 0.85), 0.85)
    obi_g = pbr('YkObiG', (0.85, 0.65, 0.18), 0.55, metal=0.4)
    pattern_w = pbr('YkPat', (0.95, 0.92, 0.85), 0.85)
    # Base
    box('Base', (0, 0, 0.04), (0.45, 0.30, 0.08), wood_d, bevel=0.005)
    # Vertical post
    cyl('Post', (0, 0, 1.00), 0.025, 1.80, wood, verts=10)
    # Top crossbar
    cyl('Cross', (0, 0, 1.85), 0.020, 1.05, wood, verts=8, rot=(math.pi/2, 0, 0))
    # End caps
    for y_sign in [-1, 1]:
        uv_sph(f'CrossCap_{y_sign}', (0, y_sign*0.52, 1.85), 0.030, wood_d, segs=10, rings=8)
    # 2 yukata robes
    yukatas = [(yukata_b, -0.25), (yukata_p, 0.25)]
    for i, (m, y) in enumerate(yukatas):
        # Robe body (tapered shape)
        cone(f'Robe_{i}', (0, y, 1.10), 0.20, 0.05, 1.40, m, verts=14)
        # Sleeves (cylinders to the sides w/ slight bend)
        for x_sign in [-1, 1]:
            cyl(f'Sleeve_{i}_{x_sign}', (x_sign*0.22, y, 1.55), 0.10, 0.42, m, verts=10,
                rot=(0, 0, x_sign*math.radians(-10)))
        # Pattern accents (small white circles)
        for k in range(5):
            ang = k / 5 * math.pi * 2
            uv_sph(f'Pat_{i}_{k}', (math.sin(ang)*0.16, y + math.cos(ang)*0.04, 0.85),
                   0.020, pattern_w, segs=8, rings=6)
        # Obi sash (yellow band at waist)
        cyl(f'Obi_{i}', (0, y, 1.10), 0.205, 0.10, obi_g, verts=14)
        # Obi white inner edge
        cyl(f'ObiW_{i}', (0, y, 1.15), 0.207, 0.020, obi_w, verts=14)
    join_and_export('yukata_rack')


# ─── 6. HOT SPRING ROCKS ─────────────────────────────────────────────
def build_hot_spring_rocks():
    """Cluster of moss-covered river rocks w/ small steam rising — placed beside the pool."""
    clear_scene()
    rock_a = pbr('HsrA', (0.42, 0.38, 0.32), 0.95)
    rock_b = pbr('HsrB', (0.55, 0.50, 0.45), 0.95)
    rock_c = pbr('HsrC', (0.25, 0.22, 0.20), 0.95)
    moss = pbr('HsrMoss', (0.32, 0.55, 0.24), 0.92)
    moss_l = pbr('HsrMossL', (0.50, 0.65, 0.30), 0.90)
    water = pbr('HsrWet', (0.35, 0.40, 0.42), 0.40)
    steam = pbr('HsrSteam', (0.92, 0.93, 0.95), 0.85,
                emit=(0.92, 0.93, 0.95), emit_strength=0.15)
    rng = random.Random(421)
    # 7 large rocks arranged in a cluster
    positions = [
        (-0.6, -0.2, 0.20, rock_a, 0.35, (1.2, 0.85, 0.85)),
        (0.4, 0.3, 0.22, rock_b, 0.30, (1.0, 1.3, 0.75)),
        (0.0, -0.5, 0.15, rock_a, 0.25, (1.4, 0.95, 0.6)),
        (-0.3, 0.5, 0.18, rock_c, 0.22, (0.9, 1.1, 0.85)),
        (0.6, -0.5, 0.16, rock_b, 0.20, (1.0, 0.85, 0.7)),
        (-0.8, 0.3, 0.10, rock_a, 0.16, (1.2, 0.85, 0.55)),
        (0.8, 0.4, 0.12, rock_c, 0.14, (1.1, 1.1, 0.75)),
    ]
    for i, (x, y, z, m, r, scale) in enumerate(positions):
        uv_sph(f'Rock_{i}', (x, y, z), r, m, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = scale
        o.rotation_euler = (rng.random()*math.pi*0.3, rng.random()*math.pi*0.3, rng.random()*math.pi)
    # Moss patches on tops of rocks
    for i in range(8):
        x = (rng.random() - 0.5) * 1.4
        y = (rng.random() - 0.5) * 1.0
        z = 0.30 + rng.random() * 0.15
        m_use = moss if i % 2 == 0 else moss_l
        uv_sph(f'Moss_{i}', (x, y, z), 0.10 + rng.random()*0.04, m_use, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.5, 1.5, 0.4)
    # 4 small wet streaks (slight specular spots — flat dark patches)
    for i in range(5):
        x = (rng.random() - 0.5) * 1.2
        y = (rng.random() - 0.5) * 0.9
        z = 0.04
        bpy.ops.mesh.primitive_plane_add(size=0.20, location=(x, y, z))
        o = bpy.context.active_object; o.name = f'Wet_{i}'
        o.scale = (1.3, 0.85, 0.005)
        o.rotation_euler = (0, 0, rng.random()*math.pi)
        o.data.materials.append(water)
    # 3 steam wisps rising from between rocks
    for i, (x, y, z) in enumerate([(-0.2, 0.0, 0.50), (0.4, -0.1, 0.55), (-0.5, 0.4, 0.48)]):
        uv_sph(f'Steam_{i}', (x, y, z), 0.18, steam, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.4, 1.2, 0.7)
    join_and_export('hot_spring_rocks')


# ─── 7. STEAM POST (vertical steam vent / outdoor heater) ────────────
def build_steam_post():
    """Tall bamboo pole w/ rising steam plume + decorative red ribbon — outdoor onsen marker."""
    clear_scene()
    bamboo = pbr('SpBamboo', (0.42, 0.62, 0.32), 0.85)
    bamboo_d = pbr('SpBambooD', (0.22, 0.40, 0.18), 0.88)
    rope = pbr('SpRope', (0.78, 0.62, 0.42), 0.95)
    red = pbr('SpRed', (0.85, 0.18, 0.14), 0.65)
    steam = pbr('SpSteam', (0.92, 0.93, 0.95), 0.85,
                emit=(0.92, 0.93, 0.95), emit_strength=0.20)
    metal = pbr('SpMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    rock = pbr('SpRock', (0.42, 0.38, 0.32), 0.95)
    # Stone base
    cyl('Base', (0, 0, 0.08), 0.22, 0.16, rock, verts=18)
    cyl('BaseTop', (0, 0, 0.18), 0.20, 0.02, pbr('SpBaseT', (0.32, 0.30, 0.25), 0.95), verts=18)
    # Tall bamboo pole
    cyl('Pole', (0, 0, 1.50), 0.05, 2.60, bamboo, verts=14)
    # Bamboo nodes
    for k in range(5):
        torus(f'Node_{k}', (0, 0, 0.50 + k*0.50), 0.053, 0.010, bamboo_d, maj=14, min_=4)
    # Top cap
    uv_sph('Cap', (0, 0, 2.81), 0.055, bamboo_d, segs=12, rings=8)
    # Brass ring at top
    torus('Ring', (0, 0, 2.70), 0.058, 0.008, metal, maj=14, min_=4)
    # Red cloth ribbon tied around upper post
    torus('Ribbon', (0, 0, 2.40), 0.065, 0.025, red, maj=14, min_=6)
    # Trailing ribbon ends
    box('RibEnd1', (0.06, 0, 2.20), (0.03, 0.005, 0.30), red, rot=(0, 0, math.radians(15)))
    box('RibEnd2', (-0.06, 0, 2.18), (0.03, 0.005, 0.32), red, rot=(0, 0, math.radians(-12)))
    # Steam plume rising — 5 stacked spheres above the post
    rng = random.Random(431)
    for i in range(6):
        z = 2.95 + i * 0.18
        ox = (rng.random() - 0.5) * 0.20 * (1 + i*0.15)
        oy = (rng.random() - 0.5) * 0.18
        uv_sph(f'Plume_{i}', (ox, oy, z), 0.16 + i*0.025, steam, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (1.0 + i*0.1, 0.9, 0.6)
    # Decorative bell at the top
    uv_sph('Bell', (0, 0.10, 2.60), 0.030, metal, segs=10, rings=8)
    cyl('BellCord', (0, 0.10, 2.65), 0.003, 0.10, rope, verts=4)
    join_and_export('steam_post')


# ─── 8. BATH STOOL (small wooden onsen stool) ────────────────────────
def build_bath_stool():
    """Low wooden bath stool + folded face towel on top."""
    clear_scene()
    wood = pbr('BsWood', (0.62, 0.42, 0.22), 0.92)
    wood_d = pbr('BsWoodD', (0.42, 0.28, 0.16), 0.92)
    towel = pbr('BsTowel', (0.96, 0.94, 0.88), 0.90)
    stripe = pbr('BsStripe', (0.18, 0.40, 0.65), 0.85)
    # Seat top
    cyl('Seat', (0, 0, 0.21), 0.16, 0.04, wood, verts=20)
    # Slats radiating on seat (decorative)
    for i in range(8):
        ang = i / 8 * math.pi * 2
        box(f'Slat_{i}', (math.cos(ang)*0.08, math.sin(ang)*0.08, 0.232),
            (0.16, 0.015, 0.005), wood_d, rot=(0, 0, ang))
    # 4 legs (splaying slightly outward)
    for i in range(4):
        ang = i / 4 * math.pi * 2 + math.pi/4
        lx = math.cos(ang) * 0.10
        ly = math.sin(ang) * 0.10
        cyl(f'Leg_{i}', (lx, ly, 0.10), 0.015, 0.20, wood, verts=8,
            rot=(math.sin(ang)*0.1, -math.cos(ang)*0.1, 0))
    # Cross brace between legs (lower)
    for i in range(2):
        ang = i * math.pi / 2 + math.pi/4
        cyl(f'Brace_{i}', (0, 0, 0.05), 0.008, 0.20, wood_d, verts=4,
            rot=(0, math.pi/2, ang))
    # Folded face towel on top of the stool
    box('Towel', (0, 0, 0.245), (0.14, 0.10, 0.025), towel)
    # Stripes on the towel (3 small)
    for i in range(3):
        y = -0.03 + i*0.03
        box(f'TowelStripe_{i}', (0, y, 0.258), (0.12, 0.006, 0.004), stripe)
    join_and_export('bath_stool')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_yukimi_lantern()
    build_onsen_pool()
    build_yu_bucket()
    build_towel_rack()
    build_yukata_rack()
    build_hot_spring_rocks()
    build_steam_post()
    build_bath_stool()
    print(f'[DONE] pack v21 exported to {OUT_DIR}')
