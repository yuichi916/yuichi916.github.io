"""
Pack v11 — fine-grain detail props.
Builds:
  mailbox, bird_feeder, sake_cup_set, calligraphy_set,
  fan_holder, geta_rack, suikinkutsu, ceramic_pot_set
Run headless:
  blender --background --python build_pack_v11.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(11)


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


# ─── 1. MAILBOX (postbox cylinder on post) ────────────────────────────
def build_mailbox():
    """Vintage Japanese cylinder mailbox — red, on a wooden post w/ slot."""
    clear_scene()
    red = pbr('MbRed', (0.78, 0.12, 0.10), 0.50)
    red_d = pbr('MbRedD', (0.50, 0.08, 0.06), 0.55)
    cap = pbr('MbCap', (0.42, 0.08, 0.06), 0.55)
    wood = pbr('MbWood', (0.32, 0.20, 0.12), 0.92)
    white = pbr('MbWhite', (0.95, 0.92, 0.85), 0.65)
    slot = pbr('MbSlot', (0.10, 0.08, 0.06), 0.45)
    # Post
    cyl('Post', (0, 0, 0.45), 0.04, 0.90, wood, verts=10)
    # Box body (red cylinder, vertical)
    cyl('Body', (0, 0, 1.05), 0.15, 0.45, red, verts=20)
    # Top hemisphere cap
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, 0, 1.275),
                                          segments=20, ring_count=12)
    o = bpy.context.active_object; o.name = 'Cap'
    o.scale = (1.0, 1.0, 0.55)
    o.data.materials.append(cap)
    # Bottom dark band
    torus('BandB', (0, 0, 0.84), 0.155, 0.020, red_d, maj=24, min_=8)
    # Slot (horizontal dark line)
    box('Slot', (0, -0.151, 1.10), (0.10, 0.005, 0.02), slot)
    # White lettering plate (vertical small panel)
    box('Plate', (0, -0.152, 0.95), (0.06, 0.005, 0.08), white)
    # Pickup tag (small white square on front)
    box('Tag', (0, -0.152, 1.20), (0.05, 0.005, 0.04), white)
    # Top finial knob
    uv_sph('Knob', (0, 0, 1.42), 0.025, cap, segs=10, rings=8)
    join_and_export('mailbox')


# ─── 2. BIRD FEEDER ──────────────────────────────────────────────────
def build_bird_feeder():
    """Hanging birdhouse-style feeder with sloped roof, perch, seed."""
    clear_scene()
    wood = pbr('BfWood', (0.62, 0.42, 0.22), 0.90)
    wood_d = pbr('BfWoodD', (0.32, 0.20, 0.12), 0.92)
    roof = pbr('BfRoof', (0.45, 0.28, 0.16), 0.92)
    seed = pbr('BfSeed', (0.92, 0.78, 0.45), 0.85)
    rope = pbr('BfRope', (0.42, 0.32, 0.20), 0.95)
    # Box body
    box('Body', (0, 0, 0.65), (0.30, 0.30, 0.20), wood, bevel=0.005)
    # Sloped roof (4-sided pyramid)
    cone('Roof', (0, 0, 0.85), 0.28, 0.05, 0.20, roof, verts=4, rot=(0, 0, math.pi/4))
    # Floor below body (with seeds)
    box('Floor', (0, 0, 0.54), (0.36, 0.36, 0.02), wood_d)
    # 4 perches (small dowels sticking out)
    for x_sign in [-1, 1]:
        for y_sign in [-1, 1]:
            cyl(f'Perch_{x_sign}_{y_sign}', (x_sign*0.20, y_sign*0.20, 0.56),
                0.008, 0.10, wood_d, verts=4, rot=(0, math.pi/2, math.atan2(y_sign, x_sign)))
    # Entrance hole (dark cylinder on the front face)
    cyl('Hole', (0, -0.16, 0.65), 0.05, 0.04, pbr('BfHole', (0.10, 0.08, 0.06), 0.60),
        verts=12, rot=(math.pi/2, 0, 0))
    # 6 seeds on the floor
    rng = random.Random(101)
    for i in range(8):
        x = (rng.random()-0.5)*0.30
        y = (rng.random()-0.5)*0.30
        uv_sph(f'Seed_{i}', (x, y, 0.56), 0.015, seed, segs=8, rings=6)
    # Rope (hanging upwards from the roof apex)
    cyl('Rope', (0, 0, 1.10), 0.008, 0.50, rope, verts=4)
    # Knot at top
    uv_sph('Knot', (0, 0, 1.36), 0.020, rope, segs=8, rings=6)
    join_and_export('bird_feeder')


# ─── 3. SAKE CUP SET ─────────────────────────────────────────────────
def build_sake_cup_set():
    """Tokkuri sake bottle + 2 sakazuki cups on a wooden tray."""
    clear_scene()
    porcelain = pbr('ScPorcelain', (0.95, 0.92, 0.88), 0.40)
    porcelain_blue = pbr('ScPorcelainBlue', (0.85, 0.90, 0.95), 0.35)
    sake = pbr('ScSake', (0.94, 0.92, 0.78), 0.30,
               emit=(0.96, 0.92, 0.70), emit_strength=0.10)
    wood = pbr('ScWood', (0.42, 0.28, 0.16), 0.92)
    label = pbr('ScLabel', (0.18, 0.12, 0.08), 0.85)
    # Tray
    box('Tray', (0, 0, 0.025), (0.50, 0.32, 0.04), wood, bevel=0.005)
    # Tray inner border (slight darker rim)
    for x_sign, y_sign in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(x_sign) > abs(y_sign):
            box(f'TrimX_{x_sign}', (x_sign*0.245, 0, 0.05), (0.01, 0.32, 0.025),
                pbr(f'ScTrim_{x_sign}', (0.22, 0.14, 0.08), 0.90))
        else:
            box(f'TrimY_{y_sign}', (0, y_sign*0.155, 0.05), (0.50, 0.01, 0.025),
                pbr(f'ScTrim_y_{y_sign}', (0.22, 0.14, 0.08), 0.90))
    # Tokkuri (sake bottle — bulbous body with narrow neck)
    uv_sph('BotBody', (-0.10, 0, 0.13), 0.075, porcelain, segs=18, rings=12)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.3)
    cyl('BotNeck', (-0.10, 0, 0.23), 0.025, 0.06, porcelain, verts=12)
    cyl('BotLip', (-0.10, 0, 0.27), 0.030, 0.015, porcelain_blue, verts=12)
    # Label on bottle (small vertical strip)
    box('Label', (-0.10, -0.075, 0.13), (0.04, 0.005, 0.08), label)
    # 2 sakazuki cups
    for i, x in enumerate([0.08, 0.20]):
        cyl(f'Cup_{i}', (x, -0.04, 0.07), 0.030, 0.03, porcelain_blue, verts=14)
        # Cup interior (slightly darker rim)
        torus(f'CupRim_{i}', (x, -0.04, 0.085), 0.030, 0.004, porcelain, maj=14, min_=4)
        # Sake inside
        cyl(f'Sake_{i}', (x, -0.04, 0.082), 0.026, 0.005, sake, verts=14)
    # Chopstick rest (small ceramic bar)
    box('Rest', (0.18, 0.08, 0.06), (0.06, 0.015, 0.012), porcelain_blue)
    # 2 chopsticks
    for i in range(2):
        cyl(f'Chop_{i}', (0.18 + i*0.005, 0.04 + i*0.005, 0.07), 0.004, 0.16,
            wood, verts=4, rot=(0, math.pi/2, 0.2))
    join_and_export('sake_cup_set')


# ─── 4. CALLIGRAPHY SET ──────────────────────────────────────────────
def build_calligraphy_set():
    """Ink stone (suzuri) + ink stick + brush + paper roll on a wood mat."""
    clear_scene()
    wood = pbr('CaWood', (0.42, 0.28, 0.16), 0.92)
    stone = pbr('CaStone', (0.15, 0.13, 0.12), 0.85)
    stone_pol = pbr('CaStonePol', (0.10, 0.09, 0.08), 0.40, metal=0.2)
    ink = pbr('CaInk', (0.05, 0.05, 0.05), 0.35,
              emit=(0.10, 0.10, 0.15), emit_strength=0.05)
    bamboo = pbr('CaBamboo', (0.62, 0.50, 0.20), 0.85)
    bristle = pbr('CaBristle', (0.18, 0.12, 0.08), 0.85)
    paper = pbr('CaPaper', (0.95, 0.92, 0.85), 0.85)
    red = pbr('CaRed', (0.88, 0.16, 0.10), 0.50)
    # Wood mat
    box('Mat', (0, 0, 0.02), (0.55, 0.36, 0.04), wood, bevel=0.005)
    # Suzuri (ink stone — rectangular slab w/ shallow well)
    box('SuzuriBase', (-0.15, 0, 0.07), (0.18, 0.13, 0.04), stone)
    box('SuzuriWell', (-0.15, 0, 0.085), (0.12, 0.07, 0.015), stone_pol)
    # Ink puddle in the well
    box('InkPuddle', (-0.15, 0, 0.087), (0.10, 0.06, 0.010), ink)
    # Ink stick (small rectangular dark stick beside the suzuri)
    box('InkStick', (-0.08, -0.10, 0.07), (0.04, 0.012, 0.03), ink, bevel=0.002)
    # Gold accent on ink stick (small line)
    box('InkAccent', (-0.08, -0.10, 0.09), (0.03, 0.013, 0.003),
        pbr('CaGold', (0.85, 0.65, 0.18), 0.30, metal=0.7))
    # Brush — bamboo handle + black bristle tip
    cyl('BrushHandle', (0.08, 0, 0.08), 0.012, 0.24, bamboo, verts=10,
        rot=(0, math.pi/2, 0))
    cone('BrushTip', (0.22, 0, 0.08), 0.018, 0.0, 0.06, bristle, verts=10,
         rot=(0, math.pi/2, 0))
    # Red tassel at handle base
    uv_sph('BrushTassel', (-0.06, 0, 0.08), 0.018, red, segs=10, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.5)
    # Paper scroll (rolled up)
    cyl('Scroll', (0.18, 0.10, 0.08), 0.025, 0.18, paper, verts=12,
        rot=(0, math.pi/2, 0))
    # Scroll bands (decorative)
    torus('ScrollBand1', (0.10, 0.10, 0.08), 0.026, 0.005, red, maj=12, min_=4,
          rot=(0, math.pi/2, 0))
    torus('ScrollBand2', (0.26, 0.10, 0.08), 0.026, 0.005, red, maj=12, min_=4,
          rot=(0, math.pi/2, 0))
    # Small open paper sheet with one ink character (black box)
    box('PaperSheet', (0.05, 0.13, 0.045), (0.15, 0.10, 0.003), paper)
    box('Character', (0.05, 0.13, 0.047), (0.04, 0.04, 0.001), ink)
    join_and_export('calligraphy_set')


# ─── 5. FAN HOLDER ───────────────────────────────────────────────────
def build_fan_holder():
    """Wooden display stand holding an open folding fan."""
    clear_scene()
    wood = pbr('FhWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('FhWoodD', (0.22, 0.14, 0.08), 0.92)
    fan_red = pbr('FhFanRed', (0.85, 0.16, 0.12), 0.60)
    fan_gold = pbr('FhFanGold', (0.92, 0.78, 0.25), 0.50)
    bone = pbr('FhBone', (0.92, 0.85, 0.62), 0.85)
    # Base
    box('Base', (0, 0, 0.025), (0.30, 0.18, 0.05), wood, bevel=0.005)
    box('BaseTop', (0, 0, 0.06), (0.32, 0.20, 0.02), wood_d)
    # Vertical post
    cyl('Post', (0, 0, 0.25), 0.020, 0.40, wood, verts=8)
    # Cross support at top (small horizontal box)
    box('Support', (0, 0, 0.43), (0.04, 0.04, 0.04), wood_d)
    # Folding fan — 11 thin trapezoidal slats fanning outward
    N = 11
    for i in range(N):
        ang = math.radians(-65 + (130 * i / (N - 1)))
        # Each slat sits at the top of the post and rotates around the pivot
        # Slat length 0.30, varies thinness
        bpy.ops.mesh.primitive_plane_add(size=1, location=(math.sin(ang)*0.15, 0, 0.55 + math.cos(ang)*0.05))
        o = bpy.context.active_object; o.name = f'Slat_{i}'
        # Tilt: paper portion is wider at outer edge; we just use a thin rectangle
        o.scale = (0.04, 0.005, 0.32)
        o.rotation_euler = (0, ang, 0)
        # Color: alternate red and gold for visual richness
        if i % 2 == 0:
            o.data.materials.append(fan_red)
        else:
            o.data.materials.append(fan_gold)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.003
    # Pivot rivet (small dark cylinder where slats meet)
    cyl('Pivot', (0, 0, 0.48), 0.018, 0.04, bone, verts=10, rot=(math.pi/2, 0, 0))
    # 2 outer bones (thicker outer slats)
    for ang_deg in [-65, 65]:
        ang = math.radians(ang_deg)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.sin(ang)*0.15, 0, 0.55 + math.cos(ang)*0.05))
        o = bpy.context.active_object; o.name = f'OuterBone_{ang_deg}'
        o.scale = (0.012, 0.012, 0.36)
        o.rotation_euler = (0, ang, 0)
        o.data.materials.append(bone)
    join_and_export('fan_holder')


# ─── 6. GETA RACK (sandal rack at entrance) ──────────────────────────
def build_geta_rack():
    """Wooden shelf w/ 6 pairs of geta (wooden clogs) at a tatami entrance."""
    clear_scene()
    wood = pbr('GrWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('GrWoodD', (0.22, 0.14, 0.08), 0.92)
    strap_red = pbr('GrStrapR', (0.85, 0.16, 0.12), 0.85)
    strap_blue = pbr('GrStrapB', (0.18, 0.30, 0.55), 0.85)
    strap_white = pbr('GrStrapW', (0.95, 0.92, 0.85), 0.85)
    strap_yellow = pbr('GrStrapY', (0.92, 0.85, 0.25), 0.85)
    # Side panels
    box('SideL', (-0.60, 0, 0.30), (0.04, 0.32, 0.60), wood)
    box('SideR', ( 0.60, 0, 0.30), (0.04, 0.32, 0.60), wood)
    # 2 horizontal shelves
    box('ShelfTop', (0, 0, 0.40), (1.30, 0.32, 0.04), wood_d)
    box('ShelfMid', (0, 0, 0.15), (1.30, 0.32, 0.04), wood_d)
    # 6 pairs of geta — 3 on each shelf
    strap_colors = [strap_red, strap_blue, strap_white, strap_yellow, strap_red, strap_blue]
    pos_top = [(-0.40, 0.18), (0.0, 0.20), (0.40, 0.22)]
    pos_mid = [(-0.40, 0.43), (0.0, 0.45), (0.40, 0.47)]
    for i, (x, z_off) in enumerate(pos_top + pos_mid):
        # Each pair = 2 geta side by side
        for side_sign in [-1, 1]:
            base_y = -0.04 + side_sign * 0.04
            # Wooden sole
            box(f'Sole_{i}_{side_sign}', (x + side_sign*0.04, base_y, z_off + 0.015),
                (0.06, 0.14, 0.02), wood_d)
            # 2 small support blocks underneath (the "teeth" of geta)
            box(f'Tooth1_{i}_{side_sign}', (x + side_sign*0.04, base_y - 0.05, z_off + 0.005),
                (0.06, 0.014, 0.015), wood)
            box(f'Tooth2_{i}_{side_sign}', (x + side_sign*0.04, base_y + 0.05, z_off + 0.005),
                (0.06, 0.014, 0.015), wood)
            # V strap (2 small bands meeting at center)
            for strap_sign in [-1, 1]:
                box(f'Strap_{i}_{side_sign}_{strap_sign}',
                    (x + side_sign*0.04 + strap_sign*0.014, base_y, z_off + 0.030),
                    (0.006, 0.04, 0.015), strap_colors[i % len(strap_colors)],
                    rot=(0, 0, math.radians(strap_sign*15)))
    join_and_export('geta_rack')


# ─── 7. SUIKINKUTSU (water-harp basin) ───────────────────────────────
def build_suikinkutsu():
    """Stone basin w/ bamboo spout dripping water into pebbles — produces water harp sound."""
    clear_scene()
    stone = pbr('SkStone', (0.55, 0.52, 0.45), 0.95)
    stone_d = pbr('SkStoneD', (0.32, 0.30, 0.25), 0.95)
    bamboo = pbr('SkBamboo', (0.62, 0.55, 0.22), 0.85)
    water = pbr('SkWater', (0.28, 0.45, 0.55), 0.20, metal=0.3,
                emit=(0.30, 0.50, 0.60), emit_strength=0.15)
    moss = pbr('SkMoss', (0.32, 0.55, 0.24), 0.92)
    pebble_a = pbr('SkPebbleA', (0.65, 0.62, 0.55), 0.92)
    pebble_b = pbr('SkPebbleB', (0.42, 0.38, 0.32), 0.92)
    # Buried stone basin (just lip visible)
    cyl('Basin', (0, 0, 0.10), 0.30, 0.20, stone, verts=20)
    # Lip
    torus('Lip', (0, 0, 0.20), 0.31, 0.020, stone_d, maj=24, min_=8)
    # Water surface (slightly recessed)
    cyl('Water', (0, 0, 0.195), 0.27, 0.005, water, verts=18)
    # 30 pebbles around the basin
    rng = random.Random(111)
    for i in range(30):
        ang = rng.random() * math.pi * 2
        rad = 0.35 + rng.random() * 0.25
        x = math.cos(ang) * rad
        y = math.sin(ang) * rad
        z = 0.02 + rng.random() * 0.015
        m = pebble_a if i % 2 == 0 else pebble_b
        uv_sph(f'Pebble_{i}', (x, y, z), 0.02 + rng.random()*0.015, m, segs=8, rings=6)
    # Bamboo spout above basin (kakehi style — angled tube)
    cyl('Spout', (0.20, -0.18, 0.30), 0.025, 0.40, bamboo, verts=10,
        rot=(math.radians(20), 0, math.radians(45)))
    # Spout support post
    cyl('SpoutPost', (0.35, -0.30, 0.20), 0.022, 0.40, bamboo, verts=10)
    # Cross support
    cyl('SpoutCross', (0.28, -0.24, 0.40), 0.018, 0.16, bamboo, verts=8,
        rot=(0, math.radians(35), 0))
    # Water droplet from spout
    uv_sph('Drop', (0.10, -0.10, 0.22), 0.018, water, segs=10, rings=8)
    # Moss patches
    cyl('Moss1', (-0.40, 0.10, 0.025), 0.10, 0.012, moss, verts=12)
    cyl('Moss2', (0.20, 0.40, 0.025), 0.08, 0.012, moss, verts=12)
    join_and_export('suikinkutsu')


# ─── 8. CERAMIC POT SET ──────────────────────────────────────────────
def build_ceramic_pot_set():
    """3 ceramic pots on a wooden plank: tea kettle + tall jar + small bowl."""
    clear_scene()
    wood = pbr('CpWood', (0.42, 0.28, 0.16), 0.92)
    ceramic_b = pbr('CpCerB', (0.18, 0.30, 0.42), 0.50)   # blue glaze
    ceramic_g = pbr('CpCerG', (0.30, 0.52, 0.38), 0.50)   # green glaze
    ceramic_w = pbr('CpCerW', (0.95, 0.92, 0.88), 0.45)   # white porcelain
    rim = pbr('CpRim', (0.65, 0.55, 0.35), 0.55, metal=0.3)
    handle = pbr('CpHandle', (0.32, 0.24, 0.14), 0.85)
    # Plank
    box('Plank', (0, 0, 0.025), (0.80, 0.25, 0.04), wood, bevel=0.005)
    # Small bowl (left)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10, location=(-0.28, 0, 0.10),
                                          segments=20, ring_count=12)
    o = bpy.context.active_object; o.name = 'Bowl'
    o.scale = (1.0, 1.0, 0.55)
    o.data.materials.append(ceramic_w)
    torus('BowlRim', (-0.28, 0, 0.13), 0.10, 0.005, rim, maj=24, min_=4)
    # Tea kettle (middle)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, 0.16),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Kettle'
    o.scale = (1.0, 1.0, 0.85)
    o.data.materials.append(ceramic_b)
    # Spout
    cyl('KettleSpout', (0.14, 0, 0.18), 0.022, 0.12, ceramic_b, verts=10,
        rot=(0, math.radians(-50), 0))
    # Handle (bamboo arch)
    torus('KettleHandle', (0, 0, 0.24), 0.075, 0.012, handle, maj=14, min_=6,
          rot=(math.radians(90), 0, 0))
    # Lid
    cyl('KettleLid', (0, 0, 0.25), 0.06, 0.02, ceramic_b, verts=14)
    uv_sph('KettleKnob', (0, 0, 0.27), 0.020, rim, segs=10, rings=8)
    # Tall jar (right)
    cyl('Jar', (0.30, 0, 0.16), 0.10, 0.24, ceramic_g, verts=18)
    # Neck
    cyl('JarNeck', (0.30, 0, 0.30), 0.06, 0.04, ceramic_g, verts=12)
    cyl('JarLip', (0.30, 0, 0.33), 0.07, 0.012, rim, verts=12)
    # Decorative band on jar
    torus('JarBand', (0.30, 0, 0.18), 0.103, 0.012, rim, maj=18, min_=6)
    join_and_export('ceramic_pot_set')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_mailbox()
    build_bird_feeder()
    build_sake_cup_set()
    build_calligraphy_set()
    build_fan_holder()
    build_geta_rack()
    build_suikinkutsu()
    build_ceramic_pot_set()
    print(f'[DONE] pack v11 exported to {OUT_DIR}')
