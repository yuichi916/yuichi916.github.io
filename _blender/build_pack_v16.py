"""
Pack v16 — seasonal decorations.
Builds:
  kadomatsu, hina_dolls, koinobori, shimekazari,
  sasa_tanabata, momiji_lantern_pair, oshogatsu_kazari, mizuhiki_ornament
Run headless:
  blender --background --python build_pack_v16.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(16)


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


# ─── 1. KADOMATSU (New Year bamboo arrangement) ──────────────────────
def build_kadomatsu():
    """3 angled bamboo poles bundled w/ pine + plum + straw wrap (New Year)."""
    clear_scene()
    straw = pbr('KdStraw', (0.85, 0.68, 0.32), 0.95)
    straw_d = pbr('KdStrawD', (0.55, 0.42, 0.18), 0.95)
    bamboo = pbr('KdBamboo', (0.42, 0.62, 0.32), 0.85)
    bamboo_in = pbr('KdBambooIn', (0.62, 0.82, 0.42), 0.85)
    pine = pbr('KdPine', (0.20, 0.42, 0.22), 0.88)
    plum_r = pbr('KdPlumR', (0.92, 0.30, 0.45), 0.65)
    plum_y = pbr('KdPlumY', (0.95, 0.85, 0.35), 0.65)
    base = pbr('KdBase', (0.32, 0.20, 0.12), 0.92)
    rope = pbr('KdRope', (0.95, 0.92, 0.85), 0.95)
    # Base — short wooden container wrapped in straw mat
    cyl('Base', (0, 0, 0.20), 0.20, 0.40, base, verts=20)
    # Straw mat wrap (slightly larger cylinder)
    cyl('StrawWrap', (0, 0, 0.20), 0.21, 0.40, straw, verts=24)
    # Vertical strands suggested
    for i in range(12):
        ang = i / 12 * math.pi * 2
        cyl(f'Strand_{i}', (math.cos(ang)*0.215, math.sin(ang)*0.215, 0.20), 0.012, 0.40,
            straw_d, verts=4)
    # Top dark rim
    torus('RimTop', (0, 0, 0.40), 0.21, 0.020, straw_d, maj=24, min_=8)
    # 3 bamboo poles cut diagonally — different heights
    heights = [0.95, 1.20, 0.75]
    positions = [(-0.07, -0.04), (0.0, 0.07), (0.07, -0.04)]
    for i, (x, y) in enumerate(positions):
        h = heights[i]
        # Main bamboo pole
        cyl(f'Bamboo_{i}', (x, y, 0.30 + h/2), 0.04, h, bamboo, verts=14)
        # Open hollow top (small darker disc)
        cyl(f'BambooIn_{i}', (x, y, 0.30 + h + 0.01), 0.030, 0.005, bamboo_in, verts=12)
        # Bamboo nodes
        for k in range(int(h / 0.30)):
            zk = 0.30 + k * 0.30 + 0.15
            torus(f'Node_{i}_{k}', (x, y, zk), 0.043, 0.006, bamboo_in, maj=12, min_=4)
    # Pine sprigs surrounding bamboo (8 small dark-green spheres around base)
    for i in range(10):
        ang = i / 10 * math.pi * 2
        r = 0.13
        uv_sph(f'Pine_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.45), 0.06, pine, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.7)
    # Plum blossoms (small red + yellow spheres in front)
    plums = [(0.18, 0.12, 0.50, plum_r), (0.20, 0.0, 0.46, plum_y),
             (-0.18, 0.10, 0.48, plum_r), (-0.15, -0.10, 0.45, plum_y),
             (0.14, -0.14, 0.42, plum_r)]
    for i, (x, y, z, m) in enumerate(plums):
        uv_sph(f'Plum_{i}', (x, y, z), 0.025, m, segs=10, rings=6)
    # White rope wrap around the bundle at 2 heights
    for z in [0.55, 0.75]:
        torus(f'Rope_{z}', (0, 0, z), 0.07, 0.010, rope, maj=14, min_=4)
    join_and_export('kadomatsu')


# ─── 2. HINA DOLLS (top 2 of the 7-tier doll display) ────────────────
def build_hina_dolls():
    """Emperor + Empress (odairi-sama and ohina-sama) on a red-stepped tier."""
    clear_scene()
    red = pbr('HdRed', (0.85, 0.18, 0.12), 0.65)
    red_d = pbr('HdRedD', (0.55, 0.10, 0.08), 0.70)
    black = pbr('HdBlack', (0.10, 0.08, 0.06), 0.40)
    gold = pbr('HdGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    face = pbr('HdFace', (0.95, 0.92, 0.85), 0.55)
    hair = pbr('HdHair', (0.08, 0.06, 0.04), 0.50)
    purple = pbr('HdPurple', (0.42, 0.20, 0.55), 0.65)
    white = pbr('HdWhite', (0.96, 0.94, 0.88), 0.65)
    # Tier base
    box('Tier', (0, 0, 0.05), (0.85, 0.40, 0.10), red, bevel=0.005)
    box('TierTop', (0, 0, 0.105), (0.90, 0.42, 0.012), gold)
    # Folding screen backdrop (gold)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.18, 0.50))
    o = bpy.context.active_object; o.name = 'Screen'
    o.scale = (0.85, 0.005, 0.45)
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(gold)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.01
    # Gold frame around screen
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(sx) > abs(sy):
            box(f'Frame_x_{sx}', (sx*0.43, -0.18, 0.50), (0.015, 0.015, 0.45), red_d)
        else:
            box(f'Frame_y_{sy}', (0, -0.18, 0.50 + sy*0.225), (0.85, 0.015, 0.015), red_d)
    # Emperor doll (right)
    # Robe — wide cone
    cone('EmpRobe', (0.20, 0.08, 0.25), 0.13, 0.07, 0.30, black, verts=16)
    # Inner robe (red layer peeking)
    cyl('EmpRobeIn', (0.20, 0.08, 0.30), 0.085, 0.10, red, verts=12)
    # Head
    uv_sph('EmpHead', (0.20, 0.08, 0.45), 0.06, face, segs=14, rings=10)
    # Tall hat (eboshi — pointed black hat)
    box('EmpHat', (0.20, 0.08, 0.52), (0.08, 0.06, 0.04), black, bevel=0.005)
    cone('EmpHatTop', (0.20, 0.08, 0.58), 0.025, 0.0, 0.08, black, verts=4)
    # Eyes
    for x_off in [-0.018, 0.018]:
        box(f'EmpEye_{x_off}', (0.20 + x_off, 0.135, 0.46), (0.008, 0.005, 0.003), black)
    # Empress doll (left)
    cone('EmpressRobe', (-0.20, 0.08, 0.25), 0.13, 0.07, 0.30, purple, verts=16)
    # Layered red collar
    torus('EmpressCollar', (-0.20, 0.08, 0.36), 0.07, 0.025, red, maj=14, min_=6)
    # Head
    uv_sph('EmpressHead', (-0.20, 0.08, 0.45), 0.06, face, segs=14, rings=10)
    # Long black hair
    uv_sph('EmpressHair', (-0.20, 0.04, 0.46), 0.07, hair, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.1, 0.6, 1.1)
    # Gold crown
    torus('EmpressCrown', (-0.20, 0.08, 0.51), 0.05, 0.012, gold, maj=14, min_=4)
    cone('EmpressCrownTop', (-0.20, 0.08, 0.55), 0.025, 0.0, 0.06, gold, verts=8)
    # Eyes
    for x_off in [-0.018, 0.018]:
        box(f'EmpressEye_{x_off}', (-0.20 + x_off, 0.135, 0.46), (0.008, 0.005, 0.003), black)
    # 2 small bonbori lamps (red lanterns on poles between dolls)
    for x_sign in [-1, 1]:
        # Pole
        cyl(f'BonPole_{x_sign}', (x_sign*0.38, 0.10, 0.30), 0.010, 0.50, black, verts=6)
        # Lantern body
        uv_sph(f'Bonbori_{x_sign}', (x_sign*0.38, 0.10, 0.48), 0.045, red,
               segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
    # Center tray w/ peach blossoms (between dolls)
    cyl('Tray', (0, 0.10, 0.13), 0.06, 0.012, white, verts=12)
    for i in range(3):
        ang = i / 3 * math.pi * 2
        uv_sph(f'Peach_{i}', (math.cos(ang)*0.030, 0.10 + math.sin(ang)*0.020, 0.15),
               0.018, pbr(f'HdPeach_{i}', (0.95, 0.55, 0.78), 0.65), segs=8, rings=6)
    join_and_export('hina_dolls')


# ─── 3. KOINOBORI (carp streamers) ───────────────────────────────────
def build_koinobori():
    """Tall pole w/ 3 koi-shaped wind streamers + black + red + blue."""
    clear_scene()
    wood = pbr('KbWood', (0.32, 0.20, 0.12), 0.92)
    metal = pbr('KbMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    koi_b = pbr('KbBlack', (0.18, 0.16, 0.16), 0.65)
    koi_r = pbr('KbRed', (0.92, 0.18, 0.14), 0.65)
    koi_blue = pbr('KbBlue', (0.18, 0.45, 0.78), 0.65)
    white = pbr('KbWhite', (0.95, 0.92, 0.85), 0.85)
    eye = pbr('KbEye', (0.95, 0.92, 0.85), 0.55,
              emit=(0.95, 0.92, 0.85), emit_strength=0.5)
    pupil = pbr('KbPupil', (0.10, 0.08, 0.06), 0.55)
    # Tall pole
    cyl('Pole', (0, 0, 1.80), 0.030, 3.60, wood, verts=10)
    # Top finial — gold orb + crown
    uv_sph('Orb1', (0, 0, 3.65), 0.035, metal, segs=12, rings=8)
    cone('OrbTop', (0, 0, 3.75), 0.030, 0.0, 0.10, metal, verts=8)
    # Decorative pinwheel at top (matsukaze-guruma simplified as small windmill)
    for i in range(4):
        ang = i / 4 * math.pi * 2
        box(f'Vane_{i}', (math.cos(ang)*0.08, math.sin(ang)*0.08, 3.50), (0.04, 0.005, 0.04),
            white, rot=(0, 0, ang))
    # Crossbar at top of pole (where streamers attach)
    cyl('CrossT', (0, 0, 3.30), 0.025, 0.40, wood, verts=8, rot=(math.pi/2, 0, 0))
    # 3 koi streamers — black on top, red mid, blue bottom (largest is parent)
    koi_data = [
        (3.05, 1.40, koi_b, 'black'),
        (2.40, 1.20, koi_r, 'red'),
        (1.75, 1.00, koi_blue, 'blue'),
    ]
    for i, (z, length, m, label) in enumerate(koi_data):
        # Koi body — long tapered cylinder (head end larger)
        cyl(f'Body_{label}', (0.30 + length/2, 0, z), 0.12 + (i==0)*0.04, length, m, verts=18,
            rot=(0, math.pi/2, 0))
        # Tail end (smaller cylinder + flared cone)
        cone(f'Tail_{label}', (0.30 + length + 0.10, 0, z), 0.10, 0.04, 0.20, m, verts=10,
             rot=(0, math.pi/2, 0))
        # Head (slightly bulbous front)
        uv_sph(f'Head_{label}', (0.30, 0, z), 0.13 + (i==0)*0.04, m, segs=18, rings=14)
        # White mouth ring
        torus(f'Mouth_{label}', (0.18, 0, z), 0.09, 0.018, white, maj=18, min_=6,
              rot=(math.pi/2, 0, 0))
        # Eyes
        for y_sign in [-1, 1]:
            uv_sph(f'Eye_{label}_{y_sign}', (0.30, y_sign*0.09, z + 0.06), 0.030, eye,
                   segs=10, rings=8)
            uv_sph(f'Pup_{label}_{y_sign}', (0.30, y_sign*0.10, z + 0.06), 0.015, pupil,
                   segs=8, rings=6)
        # Scales — 5 small darker dots along the body
        for k in range(5):
            kx = 0.55 + k * 0.18
            for y_sign in [-1, 1]:
                uv_sph(f'Scale_{label}_{k}_{y_sign}', (kx, y_sign*0.09, z + 0.06), 0.014,
                       white, segs=6, rings=4)
        # Connecting cord to crossbar
        cyl(f'Cord_{label}', (0.30, 0, (z + 3.30)/2), 0.005, 3.30 - z, wood, verts=4)
    join_and_export('koinobori')


# ─── 4. SHIMEKAZARI (New Year wreath) ────────────────────────────────
def build_shimekazari():
    """Round shimenawa wreath w/ orange daidai, white shide, pine sprigs (door decoration)."""
    clear_scene()
    straw = pbr('SkStraw', (0.85, 0.68, 0.32), 0.95)
    straw_d = pbr('SkStrawD', (0.55, 0.42, 0.18), 0.95)
    paper = pbr('SkPaper', (0.96, 0.94, 0.88), 0.85)
    orange = pbr('SkOrange', (0.95, 0.55, 0.18), 0.55)
    leaf = pbr('SkLeaf', (0.30, 0.55, 0.22), 0.85)
    red = pbr('SkRed', (0.85, 0.16, 0.10), 0.65)
    gold = pbr('SkGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Wreath — large twisted rope ring
    torus('Wreath', (0, 0, 0.40), 0.30, 0.04, straw, maj=32, min_=10)
    # Spiral binding (a smaller torus laid on top)
    torus('WreathBind', (0, 0, 0.40), 0.31, 0.012, straw_d, maj=32, min_=4)
    # Daidai (large orange citrus at the bottom)
    uv_sph('Daidai', (0, 0, 0.10), 0.10, orange, segs=20, rings=14)
    # Leaf above the daidai
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.02, 0.20))
    o = bpy.context.active_object; o.name = 'DaidaiLeaf'
    o.scale = (0.06, 0.005, 0.10)
    o.rotation_euler = (math.radians(30), 0, 0)
    o.data.materials.append(leaf)
    # Pine sprigs (3 small clusters at the bottom of wreath)
    for i in range(4):
        ang = -math.pi/2 + (i - 1.5) * 0.4
        x = math.cos(ang) * 0.30
        z = 0.40 + math.sin(ang) * 0.30
        uv_sph(f'Pine_{i}', (x, 0.03, z), 0.06, leaf, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.7)
    # 3 shide white paper streamers hanging down
    for i, x in enumerate([-0.12, 0.0, 0.12]):
        # zigzag w/ 3 boxes
        for k in range(3):
            ox = ((k % 2) * 2 - 1) * 0.03
            box(f'Shide_{i}_{k}', (x + ox, 0.04, 0.05 - k * 0.06), (0.04, 0.005, 0.06), paper)
    # Red mizuhiki cords (decorative knots)
    for i, ang in enumerate([0.5, -0.5]):
        torus(f'Mizuhiki_{i}', (math.cos(math.pi/2 + ang)*0.25, 0.02,
                                  0.40 + math.sin(math.pi/2 + ang)*0.25),
              0.04, 0.008, red, maj=14, min_=4)
    # Gold accent in center
    uv_sph('Center', (0, 0.03, 0.40), 0.04, gold, segs=14, rings=10)
    join_and_export('shimekazari')


# ─── 5. SASA TANABATA (bamboo branch with wish strips) ───────────────
def build_sasa_tanabata():
    """Bamboo branch w/ 20 colorful tanabata wish strips + paper origami chains."""
    clear_scene()
    bamboo = pbr('StBamboo', (0.42, 0.62, 0.32), 0.85)
    bamboo_in = pbr('StBambooIn', (0.62, 0.82, 0.42), 0.85)
    leaf = pbr('StLeaf', (0.30, 0.55, 0.25), 0.85)
    # Tanzaku colors (5 colors of wish strips)
    strip_colors = [
        pbr('StStripR', (0.92, 0.20, 0.16), 0.85),
        pbr('StStripB', (0.18, 0.40, 0.85), 0.85),
        pbr('StStripG', (0.32, 0.72, 0.42), 0.85),
        pbr('StStripY', (0.96, 0.85, 0.30), 0.85),
        pbr('StStripP', (0.85, 0.55, 0.88), 0.85),
    ]
    paper = pbr('StPaper', (0.96, 0.94, 0.88), 0.85)
    # Main bamboo branch (vertical with bend at top)
    cyl('Branch', (0, 0, 1.20), 0.06, 2.40, bamboo, verts=14)
    # Bamboo nodes
    for k in range(5):
        torus(f'Node_{k}', (0, 0, 0.30 + k * 0.45), 0.063, 0.010, bamboo_in, maj=14, min_=4)
    # Open hollow top
    cyl('BranchTop', (0, 0, 2.41), 0.050, 0.005, bamboo_in, verts=12)
    # 8 side branches (smaller) sticking out at various heights
    rng = random.Random(170)
    side_branches = []
    for i in range(8):
        ang = rng.random() * math.pi * 2
        z = 0.8 + rng.random() * 1.5
        length = 0.4 + rng.random() * 0.3
        # Main side branch
        cyl(f'SideBr_{i}', (math.cos(ang)*length/2, math.sin(ang)*length/2, z), 0.020, length,
            bamboo, verts=8, rot=(0, math.pi/2, ang + math.pi/2))
        side_branches.append((ang, z, length))
    # Leaves on main + side branches (clusters of 3 leaves per spot)
    for i in range(20):
        if i < len(side_branches):
            ang, z, length = side_branches[i]
            ex = math.cos(ang) * length
            ey = math.sin(ang) * length
        else:
            ang = rng.random() * math.pi * 2
            z = 0.5 + rng.random() * 1.8
            ex = math.cos(ang) * 0.20
            ey = math.sin(ang) * 0.20
        for k in range(3):
            bpy.ops.mesh.primitive_plane_add(size=0.20, location=(ex + (k-1)*0.04, ey + rng.random()*0.05, z))
            o = bpy.context.active_object; o.name = f'Leaf_{i}_{k}'
            o.scale = (0.30, 0.005, 0.55)
            o.rotation_euler = (math.radians(rng.random()*60 - 30),
                                math.radians(rng.random()*60 - 30),
                                ang)
            o.data.materials.append(leaf)
    # 20 tanzaku (wish strips) hanging from branches w/ thin string
    for i in range(20):
        ang = rng.random() * math.pi * 2
        r = 0.15 + rng.random() * 0.20
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        z_top = 0.8 + rng.random() * 1.5
        m = strip_colors[i % len(strip_colors)]
        # String
        cyl(f'String_{i}', (x, y, z_top - 0.10), 0.003, 0.20, bamboo_in, verts=4)
        # Strip — vertical thin rectangle
        strip_obj = box(f'Strip_{i}', (x, y, z_top - 0.30), (0.04, 0.005, 0.25), m)
        sm = strip_obj.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.003
    # 4 origami paper chains (kusudama balls dangling)
    for i in range(4):
        ang = i / 4 * math.pi * 2 + 0.3
        r = 0.18
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        z_top = 1.5 + (i % 2) * 0.30
        cyl(f'KusuStr_{i}', (x, y, z_top - 0.05), 0.003, 0.10, bamboo_in, verts=4)
        uv_sph(f'Kusu_{i}', (x, y, z_top - 0.16), 0.05, paper, segs=12, rings=8)
        # Faceted look — 3 colored hexagons attached as small flat planes
        for k in range(3):
            kang = k / 3 * math.pi * 2
            bpy.ops.mesh.primitive_plane_add(size=0.04, location=(x + math.cos(kang)*0.045,
                                                                    y + math.sin(kang)*0.045,
                                                                    z_top - 0.16))
            o = bpy.context.active_object; o.name = f'KusuFace_{i}_{k}'
            o.rotation_euler = (math.pi/2, 0, kang)
            o.data.materials.append(strip_colors[k % len(strip_colors)])
    join_and_export('sasa_tanabata')


# ─── 6. MOMIJI LANTERN PAIR ──────────────────────────────────────────
def build_momiji_lantern_pair():
    """2 stone lanterns w/ maple-leaf carved tops + autumn leaves piled around."""
    clear_scene()
    stone = pbr('MlStone', (0.55, 0.52, 0.45), 0.95)
    stone_d = pbr('MlStoneD', (0.32, 0.30, 0.25), 0.95)
    moss = pbr('MlMoss', (0.32, 0.55, 0.24), 0.92)
    leaf_r = pbr('MlLeafR', (0.88, 0.30, 0.12), 0.85)
    leaf_o = pbr('MlLeafO', (0.92, 0.55, 0.18), 0.85)
    leaf_y = pbr('MlLeafY', (0.94, 0.78, 0.20), 0.85)
    glow = pbr('MlGlow', (1.0, 0.78, 0.45), 0.40,
               emit=(1.0, 0.78, 0.45), emit_strength=1.5)
    # 2 lanterns side by side
    positions = [(-0.45, 0), (0.45, 0)]
    for j, (cx, cy) in enumerate(positions):
        # Base
        cyl(f'Base_{j}', (cx, cy, 0.05), 0.20, 0.10, stone_d, verts=12)
        # Lower pillar
        cyl(f'Pillar_{j}', (cx, cy, 0.30), 0.08, 0.40, stone, verts=14)
        # Mid disc
        cyl(f'Mid_{j}', (cx, cy, 0.53), 0.14, 0.05, stone_d, verts=14)
        # Light chamber (box w/ open windows)
        box(f'Chamber_{j}', (cx, cy, 0.65), (0.18, 0.18, 0.18), stone, bevel=0.005)
        # Window openings (4 dark slits)
        for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
            box(f'Win_{j}_{sx}_{sy}', (cx + sx*0.09, cy + sy*0.09, 0.65), (0.04, 0.04, 0.10), glow)
        # Roof — wide flared shape
        cone(f'Roof_{j}', (cx, cy, 0.80), 0.20, 0.05, 0.15, stone, verts=8, rot=(0, 0, math.pi/8))
        # Top finial — small ball + small spike + maple-leaf shape (flat plane)
        uv_sph(f'Orb_{j}', (cx, cy, 0.92), 0.030, stone, segs=10, rings=8)
        # Maple leaf carving on roof
        bpy.ops.mesh.primitive_plane_add(size=0.10, location=(cx + 0.06, cy, 0.78))
        o = bpy.context.active_object; o.name = f'Maple_{j}'
        o.rotation_euler = (math.radians(80), 0, math.radians(45))
        o.data.materials.append(leaf_r)
        # Moss at base
        cyl(f'Moss_{j}', (cx, cy, 0.105), 0.16, 0.012, moss, verts=12)
    # Scattered maple leaves between lanterns (15 small flat planes)
    rng = random.Random(176)
    for i in range(20):
        x = (rng.random() - 0.5) * 1.40
        y = (rng.random() - 0.5) * 0.60
        z = 0.012 + (rng.random() * 0.005)
        m = [leaf_r, leaf_o, leaf_y][i % 3]
        bpy.ops.mesh.primitive_plane_add(size=0.07, location=(x, y, z))
        o = bpy.context.active_object; o.name = f'FallenLeaf_{i}'
        o.rotation_euler = (math.radians(rng.random()*15 - 7),
                            math.radians(rng.random()*15 - 7),
                            rng.random() * math.pi * 2)
        o.data.materials.append(m)
    join_and_export('momiji_lantern_pair')


# ─── 7. OSHOGATSU KAZARI (New Year arrangement) ─────────────────────
def build_oshogatsu_kazari():
    """New Year display: kagamimochi rice-cake stack + daidai + mikan + sake set."""
    clear_scene()
    wood = pbr('OkWood', (0.32, 0.20, 0.12), 0.92)
    wood_d = pbr('OkWoodD', (0.22, 0.14, 0.08), 0.92)
    mochi = pbr('OkMochi', (0.95, 0.92, 0.85), 0.65)
    daidai = pbr('OkDaidai', (0.95, 0.55, 0.18), 0.55)
    leaf = pbr('OkLeaf', (0.30, 0.55, 0.22), 0.85)
    paper = pbr('OkPaper', (0.96, 0.94, 0.88), 0.85)
    red = pbr('OkRed', (0.85, 0.16, 0.10), 0.65)
    gold = pbr('OkGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Wooden offering stand (sanpou)
    box('StandBot', (0, 0, 0.04), (0.32, 0.32, 0.08), wood)
    box('StandTop', (0, 0, 0.11), (0.40, 0.40, 0.04), wood_d)
    # Cutout holes on the stand sides (decorative)
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(sx) > abs(sy):
            box(f'Hole_x_{sx}', (sx*0.17, 0, 0.05), (0.02, 0.12, 0.06), wood_d)
        else:
            box(f'Hole_y_{sy}', (0, sy*0.17, 0.05), (0.12, 0.02, 0.06), wood_d)
    # White paper on top of stand
    box('Paper', (0, 0, 0.135), (0.34, 0.34, 0.005), paper)
    # Kagamimochi — 2 stacked rice cakes (bottom larger)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(0, 0, 0.21),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'MochiBot'
    o.scale = (1.0, 1.0, 0.65)
    o.data.materials.append(mochi)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10, location=(0, 0, 0.34),
                                          segments=20, ring_count=12)
    o = bpy.context.active_object; o.name = 'MochiTop'
    o.scale = (1.0, 1.0, 0.65)
    o.data.materials.append(mochi)
    # Daidai (large orange on top)
    uv_sph('Daidai', (0, 0, 0.43), 0.06, daidai, segs=18, rings=12)
    # Leaf on daidai
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.02, 0.49))
    o = bpy.context.active_object; o.name = 'DaidaiLeaf'
    o.scale = (0.04, 0.005, 0.08)
    o.rotation_euler = (math.radians(30), 0, 0)
    o.data.materials.append(leaf)
    # Red-white mizuhiki (decorative cord around base of mochi)
    torus('Mizuhiki', (0, 0, 0.16), 0.14, 0.008, red, maj=20, min_=4)
    torus('Mizuhiki2', (0, 0, 0.165), 0.14, 0.008, paper, maj=20, min_=4)
    # 2 small mikan on the sides
    for x_sign in [-1, 1]:
        uv_sph(f'Mikan_{x_sign}', (x_sign*0.20, -0.10, 0.16), 0.045, daidai,
               segs=14, rings=10)
    # Small gold accent at the back (folded paper or fan)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.16, 0.32))
    o = bpy.context.active_object; o.name = 'GoldFan'
    o.scale = (0.18, 0.005, 0.12)
    o.rotation_euler = (math.radians(70), 0, 0)
    o.data.materials.append(gold)
    join_and_export('oshogatsu_kazari')


# ─── 8. MIZUHIKI ORNAMENT (decorative cord ornament) ─────────────────
def build_mizuhiki_ornament():
    """Elaborate mizuhiki cord knot ornament — crane + turtle motifs on a base."""
    clear_scene()
    paper = pbr('MzPaper', (0.96, 0.94, 0.88), 0.85)
    red = pbr('MzRed', (0.85, 0.16, 0.10), 0.65)
    white = pbr('MzWhite', (0.96, 0.94, 0.88), 0.85)
    gold = pbr('MzGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    wood = pbr('MzWood', (0.32, 0.20, 0.12), 0.92)
    green = pbr('MzGreen', (0.32, 0.55, 0.22), 0.85)
    # Wood base
    box('Base', (0, 0, 0.025), (0.40, 0.22, 0.05), wood, bevel=0.005)
    box('BaseTop', (0, 0, 0.055), (0.42, 0.24, 0.012), paper)
    # Central knot — pair of overlapping toruses (red + white)
    torus('KnotR', (0, 0, 0.12), 0.06, 0.012, red, maj=16, min_=4)
    torus('KnotW', (0, 0, 0.13), 0.06, 0.012, white, maj=16, min_=4)
    # Left "crane" knot — elliptical loop (rotated torus)
    torus('CraneLoop', (-0.12, 0, 0.10), 0.045, 0.008, white, maj=14, min_=4,
          rot=(0, 0, math.radians(30)))
    # Crane body (small white sphere shaped like elongated)
    uv_sph('CraneBody', (-0.12, 0, 0.13), 0.030, white, segs=12, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 0.5, 0.8)
    # Crane head + beak
    uv_sph('CraneHead', (-0.16, 0, 0.16), 0.018, white, segs=8, rings=6)
    cone('CraneBeak', (-0.19, 0, 0.16), 0.008, 0.0, 0.030, gold, verts=4,
         rot=(0, math.radians(-90), 0))
    # Right "turtle" knot — torus + small turtle shell shape
    torus('TurtleLoop', (0.12, 0, 0.10), 0.045, 0.008, red, maj=14, min_=4)
    uv_sph('TurtleShell', (0.12, 0, 0.11), 0.030, green, segs=12, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 0.7, 0.5)
    # Small turtle head sticking out
    uv_sph('TurtleHead', (0.16, 0, 0.10), 0.014, green, segs=8, rings=6)
    # 4 small legs (small dots)
    for sx_sign in [-1, 1]:
        for sy_sign in [-1, 1]:
            uv_sph(f'TurtleLeg_{sx_sign}_{sy_sign}',
                   (0.12 + sx_sign*0.025, sy_sign*0.020, 0.08), 0.010, green, segs=6, rings=4)
    # Trailing cord strands hanging down from the base
    for i, x in enumerate([-0.15, -0.05, 0.05, 0.15]):
        m = red if i % 2 == 0 else white
        cyl(f'Strand_{i}', (x, 0.08, 0.05), 0.004, 0.10, m, verts=4,
            rot=(math.radians(45), 0, 0))
    # Pine sprigs on the sides
    for x_sign in [-1, 1]:
        uv_sph(f'Pine_{x_sign}', (x_sign*0.18, 0.04, 0.10), 0.040, green, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.4, 0.8, 0.8)
    # Gold accent — small medallion behind the central knot
    cyl('Medal', (0, -0.05, 0.10), 0.040, 0.006, gold, verts=14)
    join_and_export('mizuhiki_ornament')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_kadomatsu()
    build_hina_dolls()
    build_koinobori()
    build_shimekazari()
    build_sasa_tanabata()
    build_momiji_lantern_pair()
    build_oshogatsu_kazari()
    build_mizuhiki_ornament()
    print(f'[DONE] pack v16 exported to {OUT_DIR}')
