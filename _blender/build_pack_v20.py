"""
Pack v20 — way-finding & devotional.
Builds:
  signpost_painted, milestone_marker, prayer_flag_string,
  hokora_small_shrine, torii_white, scroll_holder, foot_path_marker, oboro_wheel
Run headless:
  blender --background --python build_pack_v20.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(20)


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


# ─── 1. SIGNPOST PAINTED (multi-arrow direction sign) ────────────────
def build_signpost_painted():
    """Painted wooden post w/ 3 arrow signs pointing in different directions."""
    clear_scene()
    wood = pbr('SpWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('SpWoodD', (0.22, 0.14, 0.08), 0.92)
    red = pbr('SpRed', (0.85, 0.18, 0.14), 0.65)
    blue = pbr('SpBlue', (0.20, 0.40, 0.70), 0.65)
    green = pbr('SpGreen', (0.32, 0.60, 0.32), 0.65)
    ink = pbr('SpInk', (0.10, 0.08, 0.06), 0.85)
    # Base + post
    box('Base', (0, 0, 0.06), (0.25, 0.25, 0.12), wood_d, bevel=0.005)
    cyl('Post', (0, 0, 0.95), 0.040, 1.70, wood, verts=12)
    # Top finial
    cone('PostFinial', (0, 0, 1.85), 0.040, 0.0, 0.10, wood_d, verts=8)
    # 3 arrows at different heights/angles
    arrows = [
        (1.40, 0, red, math.radians(0)),
        (1.10, 0, blue, math.radians(110)),
        (0.80, 0, green, math.radians(220)),
    ]
    for i, (z, _, m, ang) in enumerate(arrows):
        # Plank
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(ang)*0.25, math.sin(ang)*0.25, z))
        o = bpy.context.active_object; o.name = f'Arrow_{i}'
        o.scale = (0.50, 0.04, 0.16)
        o.rotation_euler = (0, 0, ang)
        o.data.materials.append(m)
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.005
        # Pointed tip (small cone in arrow direction)
        cone(f'ArrowTip_{i}',
             (math.cos(ang)*0.55, math.sin(ang)*0.55, z), 0.08, 0.0, 0.14, m, verts=4,
             rot=(0, 0, ang - math.pi/2))
        # Tail notch (small dark square at base end)
        box(f'ArrowTail_{i}',
            (math.cos(ang)*-0.04, math.sin(ang)*-0.04, z),
            (0.04, 0.05, 0.16), wood_d,
            rot=(0, 0, ang))
        # Painted character on arrow
        box(f'Char_{i}', (math.cos(ang)*0.25, math.sin(ang)*0.25, z),
            (0.30, 0.005, 0.10), ink, rot=(0, 0, ang))
    join_and_export('signpost_painted')


# ─── 2. MILESTONE MARKER (stone with engraved kanji) ─────────────────
def build_milestone_marker():
    """Weathered stone monolith w/ engraved kanji + moss cap."""
    clear_scene()
    stone = pbr('MmStone', (0.55, 0.52, 0.48), 0.95)
    stone_d = pbr('MmStoneD', (0.35, 0.32, 0.28), 0.95)
    moss = pbr('MmMoss', (0.32, 0.55, 0.24), 0.92)
    ink = pbr('MmInk', (0.10, 0.08, 0.06), 0.85)
    # Base block
    box('Base', (0, 0, 0.10), (0.45, 0.30, 0.20), stone_d, bevel=0.02)
    # Main monolith (tall narrow stone)
    box('Monolith', (0, 0, 0.85), (0.30, 0.20, 1.30), stone, bevel=0.02)
    # Cap (slightly larger top)
    box('Cap', (0, 0, 1.55), (0.35, 0.25, 0.06), stone_d, bevel=0.01)
    # Tilt slightly (weathered look)
    # Apply rotation by rotating top — actually rotate the whole thing slightly via creating tilt
    # Skip global tilt for simplicity
    # Moss patches on the base and lower body
    rng = random.Random(301)
    for i in range(4):
        x = (rng.random() - 0.5) * 0.4
        z = 0.10 + rng.random() * 0.30
        uv_sph(f'Moss_{i}', (x, 0.105, z), 0.06 + rng.random()*0.03, moss, segs=10, rings=6)
        o = bpy.context.active_object
        o.scale = (1.3, 0.3, 1.0)
    # Engraved characters (3 dark vertical boxes)
    for i, z in enumerate([1.30, 1.05, 0.80]):
        box(f'Char_{i}', (0, 0.105, z), (0.14, 0.005, 0.16), ink)
    # Decorative carved rim around top
    torus('TopRim', (0, 0, 1.58), 0.16, 0.008, stone_d, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Small offering plate at base front
    cyl('Plate', (0, 0.20, 0.21), 0.06, 0.012, stone_d, verts=14)
    # Tiny offering (small orb)
    uv_sph('Offering', (0, 0.20, 0.225), 0.018,
           pbr('MmOffer', (0.95, 0.92, 0.85), 0.65), segs=8, rings=6)
    join_and_export('milestone_marker')


# ─── 3. PRAYER FLAG STRING ───────────────────────────────────────────
def build_prayer_flag_string():
    """String of 10 colored prayer flags hanging between 2 wooden poles."""
    clear_scene()
    wood = pbr('PfWood', (0.32, 0.20, 0.12), 0.92)
    rope = pbr('PfRope', (0.78, 0.62, 0.42), 0.95)
    colors = [
        pbr('PfRed', (0.85, 0.18, 0.14), 0.85),
        pbr('PfBlue', (0.18, 0.40, 0.85), 0.85),
        pbr('PfYellow', (0.95, 0.85, 0.35), 0.85),
        pbr('PfGreen', (0.32, 0.65, 0.32), 0.85),
        pbr('PfWhite', (0.96, 0.94, 0.88), 0.85),
    ]
    ink = pbr('PfInk', (0.10, 0.08, 0.06), 0.85)
    # 2 vertical poles
    for x in [-1.6, 1.6]:
        cyl(f'Pole_{x}', (x, 0, 1.0), 0.04, 2.0, wood, verts=10)
        # Cap
        uv_sph(f'Cap_{x}', (x, 0, 2.02), 0.045, wood, segs=10, rings=8)
    # Rope sagging between (use 8 segments)
    SEG = 8
    SPAN = 3.2
    SAG = 0.18
    cy_top = 1.85
    def rope_y(t):
        return cy_top - SAG * (1.0 - (2*t - 1)**2)
    for i in range(SEG):
        t1 = i / SEG; t2 = (i + 1) / SEG
        x1 = -SPAN/2 + t1 * SPAN; x2 = -SPAN/2 + t2 * SPAN
        y1 = rope_y(t1); y2 = rope_y(t2)
        mx = (x1 + x2)/2; my = (y1 + y2)/2
        dx = x2 - x1; dy = y2 - y1
        L = math.sqrt(dx*dx + dy*dy)
        ang = math.atan2(dy, dx)
        cyl(f'Rope_{i}', (mx, 0, my), 0.008, L, rope, verts=4,
            rot=(0, math.radians(90), -ang))
    # 10 flags hanging from rope
    for i in range(10):
        t = (i + 0.5) / 10
        x = -SPAN/2 + t * SPAN
        z_top = rope_y(t) - 0.02
        # Flag panel
        m = colors[i % len(colors)]
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 0, z_top - 0.18))
        o = bpy.context.active_object; o.name = f'Flag_{i}'
        o.scale = (0.20, 0.005, 0.32)
        o.rotation_euler = (math.pi/2, 0, 0)
        o.data.materials.append(m)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.005
        # Ink character in center of flag
        box(f'FlagChar_{i}', (x, -0.008, z_top - 0.18), (0.07, 0.005, 0.10), ink)
    join_and_export('prayer_flag_string')


# ─── 4. HOKORA SMALL SHRINE ──────────────────────────────────────────
def build_hokora_small_shrine():
    """Tiny roadside shrine w/ slanted roof + offering platter + small statue + bell."""
    clear_scene()
    wood = pbr('HkWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('HkWoodD', (0.22, 0.14, 0.08), 0.92)
    stone = pbr('HkStone', (0.55, 0.52, 0.48), 0.95)
    stone_d = pbr('HkStoneD', (0.32, 0.30, 0.25), 0.95)
    moss = pbr('HkMoss', (0.32, 0.55, 0.24), 0.92)
    bronze = pbr('HkBronze', (0.55, 0.40, 0.18), 0.45, metal=0.7)
    red = pbr('HkRed', (0.85, 0.16, 0.10), 0.65)
    paper = pbr('HkPaper', (0.95, 0.92, 0.85), 0.85)
    # Stone foundation base
    box('Base', (0, 0, 0.08), (0.55, 0.45, 0.16), stone_d, bevel=0.01)
    # Wood pedestal (raised platform)
    box('Pedestal', (0, 0, 0.21), (0.45, 0.36, 0.10), wood_d, bevel=0.005)
    # Main shrine body (small open-front box)
    # Back + 2 sides + floor + roof
    box('Back', (0, -0.16, 0.45), (0.40, 0.04, 0.40), wood)
    box('FloorInner', (0, 0, 0.27), (0.36, 0.30, 0.04), wood_l := wood_d)
    box('SideL', (-0.20, 0, 0.45), (0.04, 0.34, 0.40), wood)
    box('SideR', ( 0.20, 0, 0.45), (0.04, 0.34, 0.40), wood)
    # Slanted hip roof (steep cone)
    cone('Roof', (0, 0, 0.72), 0.32, 0.08, 0.18, red, verts=4, rot=(0, 0, math.pi/4))
    # Roof ridge (small box on top)
    box('RoofRidge', (0, 0, 0.83), (0.10, 0.10, 0.04), wood_d)
    # Small stone statue inside (jizo-like)
    cyl('StatueBody', (0, 0, 0.40), 0.08, 0.22, stone, verts=14)
    uv_sph('StatueHead', (0, 0, 0.55), 0.08, stone, segs=14, rings=10)
    # Red bib on statue (cloth)
    box('Bib', (0, 0.085, 0.42), (0.10, 0.005, 0.08), red)
    # Offering platter in front of statue
    cyl('Platter', (0, 0.12, 0.275), 0.06, 0.010, wood_d, verts=12)
    # Tiny rice ball offering
    uv_sph('Rice', (0, 0.12, 0.285), 0.022, paper, segs=10, rings=6)
    # Small bronze bell hanging at the front
    uv_sph('Bell', (0, 0.20, 0.55), 0.035, bronze, segs=12, rings=8)
    # Bell cord
    cyl('BellCord', (0, 0.20, 0.62), 0.004, 0.16, paper, verts=4)
    # Moss patches on the foundation
    for i in range(3):
        ang = i / 3 * math.pi * 2
        cyl(f'Moss_{i}', (math.cos(ang)*0.22, math.sin(ang)*0.16, 0.165), 0.05, 0.008, moss,
            verts=10)
    join_and_export('hokora_small_shrine')


# ─── 5. TORII WHITE (Inari-style white torii) ────────────────────────
def build_torii_white():
    """White-painted Inari-style torii w/ accent ink characters on tablet."""
    clear_scene()
    white = pbr('TwWhite', (0.95, 0.92, 0.85), 0.55)
    accent = pbr('TwAccent', (0.32, 0.20, 0.12), 0.85)
    ink = pbr('TwInk', (0.10, 0.08, 0.06), 0.85)
    gold = pbr('TwGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # 2 pillars
    for x in [-0.85, 0.85]:
        cyl(f'Pillar_{x}', (x, 0, 1.10), 0.10, 2.20, white, verts=18)
    # Top kasagi beam
    box('Kasagi', (0, 0, 2.25), (2.10, 0.25, 0.18), white, bevel=0.005)
    # Curled ends
    for x_sign in [-1, 1]:
        cone(f'End_{x_sign}', (x_sign*1.10, 0, 2.30), 0.10, 0.16, 0.12, white, verts=6,
             rot=(0, math.pi/2, 0))
    # Lower beam (shimaki)
    box('Shimaki', (0, 0, 2.00), (1.90, 0.20, 0.10), white, bevel=0.005)
    # Crossbeam (nuki)
    box('Nuki', (0, 0, 1.55), (1.85, 0.12, 0.08), white, bevel=0.005)
    # Tablet (gakuzuka) hanging below kasagi
    box('Tablet', (0, 0, 1.85), (0.32, 0.04, 0.22), accent, bevel=0.005)
    box('TabletPanel', (0, -0.025, 1.85), (0.28, 0.005, 0.18), white)
    # Ink character on tablet
    box('TabletInk', (0, -0.030, 1.85), (0.16, 0.005, 0.12), ink)
    # Pillar caps
    for x in [-0.85, 0.85]:
        cyl(f'Cap_{x}', (x, 0, 2.07), 0.105, 0.05, accent, verts=18)
    # Gold accent ring around tops of pillars
    for x in [-0.85, 0.85]:
        torus(f'GoldRing_{x}', (x, 0, 1.95), 0.105, 0.008, gold, maj=18, min_=4)
    # Small fox statue (Inari guardian) at base
    for x_sign in [-1, 1]:
        uv_sph(f'FoxBody_{x_sign}', (x_sign*0.85, 0.30, 0.10), 0.06, white, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.4, 0.85)
        # Head
        uv_sph(f'FoxHead_{x_sign}', (x_sign*0.85, 0.40, 0.16), 0.045, white, segs=10, rings=8)
        # Ears
        for y_sign in [-1, 1]:
            cone(f'FoxEar_{x_sign}_{y_sign}', (x_sign*0.85 + y_sign*0.025, 0.40, 0.21),
                 0.020, 0.0, 0.04, white, verts=4)
        # Tail
        uv_sph(f'FoxTail_{x_sign}', (x_sign*0.85, 0.22, 0.13), 0.04, white, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (0.7, 1.5, 0.85)
        # Red bib on fox
        box(f'FoxBib_{x_sign}', (x_sign*0.85, 0.43, 0.15), (0.045, 0.005, 0.045),
            pbr(f'TwFoxRed_{x_sign}', (0.85, 0.18, 0.14), 0.65))
    join_and_export('torii_white')


# ─── 6. SCROLL HOLDER (kakemono / hanging scroll) ────────────────────
def build_scroll_holder():
    """Vertical wooden frame w/ hanging painted scroll showing ink-wash mountain."""
    clear_scene()
    wood = pbr('ShWood', (0.32, 0.20, 0.12), 0.92)
    wood_d = pbr('ShWoodD', (0.22, 0.14, 0.08), 0.92)
    paper = pbr('ShPaper', (0.95, 0.92, 0.82), 0.85,
                emit=(0.96, 0.93, 0.85), emit_strength=0.05)
    ink = pbr('ShInk', (0.12, 0.08, 0.06), 0.85)
    ink_l = pbr('ShInkL', (0.35, 0.26, 0.18), 0.88)
    silk_b = pbr('ShSilkB', (0.18, 0.30, 0.55), 0.65)
    silk_r = pbr('ShSilkR', (0.55, 0.10, 0.08), 0.65)
    gold = pbr('ShGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Top + bottom wooden rollers
    cyl('TopRoller', (0, 0, 1.95), 0.025, 0.65, wood_d, verts=12, rot=(0, math.pi/2, 0))
    cyl('BotRoller', (0, 0, 0.30), 0.030, 0.65, wood_d, verts=12, rot=(0, math.pi/2, 0))
    # Roller end caps
    for x_sign in [-1, 1]:
        uv_sph(f'TopCap_{x_sign}', (x_sign*0.33, 0, 1.95), 0.035, gold, segs=12, rings=8)
        uv_sph(f'BotCap_{x_sign}', (x_sign*0.33, 0, 0.30), 0.040, gold, segs=12, rings=8)
    # Paper scroll body (vertical thin panel)
    box('Paper', (0, 0, 1.13), (0.55, 0.005, 1.60), paper)
    sm = bpy.context.active_object.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.005
    # Outer silk border (4 thin strips around the paper)
    box('SilkT', (0, -0.004, 1.85), (0.55, 0.005, 0.20), silk_b)
    box('SilkB', (0, -0.004, 0.45), (0.55, 0.005, 0.16), silk_b)
    box('SilkL', (-0.27, -0.004, 1.20), (0.04, 0.005, 1.45), silk_r)
    box('SilkR', ( 0.27, -0.004, 1.20), (0.04, 0.005, 1.45), silk_r)
    # Sumi-e painting on the scroll
    # Mountain triangles
    for k in range(3):
        tx = (k - 1) * 0.10
        ty = 1.20 + k * 0.06
        tri_h = 0.30 + k * 0.06
        bpy.ops.mesh.primitive_cone_add(radius1=0.12 + k*0.02, radius2=0.0, depth=tri_h,
                                         location=(tx, -0.008, ty + tri_h/2), vertices=3)
        o = bpy.context.active_object; o.name = f'Mount_{k}'
        o.rotation_euler = (math.pi/2, 0, 0)
        o.data.materials.append(ink_l if k == 1 else ink)
    # Sun disc
    uv_sph('Sun', (0.10, -0.012, 1.65), 0.05, gold, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 0.2, 1.0)
    # Hanging cord at top
    cyl('Cord', (0, 0, 2.10), 0.004, 0.30, silk_r, verts=4)
    # Bottom weight beads (2 tassels)
    for x_sign in [-1, 1]:
        uv_sph(f'Bead_{x_sign}', (x_sign*0.30, 0, 0.18), 0.025, silk_r, segs=10, rings=8)
        cyl(f'BeadCord_{x_sign}', (x_sign*0.30, 0, 0.22), 0.003, 0.10, silk_r, verts=4)
    join_and_export('scroll_holder')


# ─── 7. FOOT PATH MARKER (small wooden directional plaque) ───────────
def build_foot_path_marker():
    """Short wooden plaque on legs — like the Edo-era road waypost (chōzu-styled)."""
    clear_scene()
    wood = pbr('FpmWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('FpmWoodD', (0.22, 0.14, 0.08), 0.92)
    ink = pbr('FpmInk', (0.10, 0.08, 0.06), 0.85)
    red = pbr('FpmRed', (0.85, 0.18, 0.14), 0.65)
    moss = pbr('FpmMoss', (0.32, 0.55, 0.24), 0.92)
    # 2 short legs sunk in ground
    for x_sign in [-1, 1]:
        cyl(f'Leg_{x_sign}', (x_sign*0.20, 0, 0.20), 0.030, 0.40, wood, verts=8)
    # Horizontal plaque
    box('Plaque', (0, 0, 0.42), (0.55, 0.04, 0.18), wood, bevel=0.005)
    # Frame (darker outer trim)
    for sx, sy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        if abs(sx) > abs(sy):
            box(f'Frame_h_{sx}', (0, sx*0.025, 0.42), (0.55, 0.005, 0.020), wood_d)
        else:
            box(f'Frame_v_{sy}', (sy*0.27, 0, 0.42), (0.020, 0.04, 0.18), wood_d)
    # 2 ink characters on plaque
    for i, x in enumerate([-0.12, 0.12]):
        box(f'Char_{i}', (x, -0.022, 0.42), (0.08, 0.005, 0.12), ink)
    # Red arrow accent at the right side
    cone('Arrow', (0.30, -0.025, 0.42), 0.04, 0.0, 0.08, red, verts=4,
         rot=(math.pi/2, 0, math.radians(-90)))
    # Moss at base
    cyl('Moss', (0, 0, 0.015), 0.18, 0.012, moss, verts=12)
    # Top decorative crossbeam
    box('TopBeam', (0, 0, 0.54), (0.65, 0.05, 0.04), wood_d)
    join_and_export('foot_path_marker')


# ─── 8. OBORO WHEEL (yokai cart wheel — single decorative wheel) ─────
def build_oboro_wheel():
    """Large standalone old wooden wheel — eerie folklore-themed prop covered in moss."""
    clear_scene()
    wood = pbr('OwWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('OwWoodD', (0.22, 0.14, 0.08), 0.92)
    wood_l = pbr('OwWoodL', (0.62, 0.42, 0.22), 0.90)
    iron = pbr('OwIron', (0.28, 0.24, 0.20), 0.55, metal=0.6)
    moss = pbr('OwMoss', (0.32, 0.55, 0.24), 0.92)
    crack = pbr('OwCrack', (0.10, 0.08, 0.06), 0.90)
    # Outer rim
    torus('Rim', (0, 0, 0.65), 0.55, 0.06, wood, maj=28, min_=8, rot=(math.pi/2, 0, 0))
    # Inner ring
    torus('Inner', (0, 0, 0.65), 0.40, 0.04, wood_d, maj=24, min_=8, rot=(math.pi/2, 0, 0))
    # 10 spokes
    for i in range(10):
        ang = i / 10 * math.pi * 2
        sz = 0.65 + math.sin(ang) * 0.28
        sx = math.cos(ang) * 0.28
        cyl(f'Spoke_{i}', (sx, 0, sz), 0.020, 0.55, wood_l, verts=6,
            rot=(0, ang, 0))
    # Hub
    cyl('Hub', (0, 0, 0.65), 0.08, 0.10, wood_d, verts=14, rot=(math.pi/2, 0, 0))
    # Iron hub cap
    uv_sph('HubCap', (0, 0.08, 0.65), 0.04, iron, segs=12, rings=8)
    # Crack lines (1-2 dark cracks in the rim)
    for i in range(2):
        ang = (0.3 + i * 0.7) * math.pi * 2
        cyl(f'Crack_{i}', (math.cos(ang)*0.55, 0, 0.65 + math.sin(ang)*0.55), 0.005, 0.18, crack,
            verts=4, rot=(0, ang + math.pi/2, 0))
    # Moss patches
    rng = random.Random(311)
    for i in range(5):
        ang = rng.random() * math.pi * 2
        r = 0.50 + rng.random() * 0.08
        uv_sph(f'Moss_{i}', (math.cos(ang)*r, 0.06, 0.65 + math.sin(ang)*r),
               0.06 + rng.random()*0.03, moss, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.5, 0.4, 1.5)
    # Ground tilt (the wheel leans against something — we suggest by small support stone)
    cyl('LeanStone', (0, 0.10, 0.10), 0.10, 0.20, pbr('OwStone', (0.45, 0.42, 0.38), 0.95), verts=12)
    join_and_export('oboro_wheel')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_signpost_painted()
    build_milestone_marker()
    build_prayer_flag_string()
    build_hokora_small_shrine()
    build_torii_white()
    build_scroll_holder()
    build_foot_path_marker()
    build_oboro_wheel()
    print(f'[DONE] pack v20 exported to {OUT_DIR}')
