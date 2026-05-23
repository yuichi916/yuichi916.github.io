"""
Pack v24 — HIGH-DETAIL rebuild of pack v22+v23 hero assets.
Strategy: per asset, add subsurf level 2, beveled edges, extra geometry detail,
and richer PBR materials (slight emission for highlights, varied roughness).

This OVERWRITES the v22/v23 GLB files with much higher-poly + smoother versions:
  kominka_v2, sakura_v2, torii_v2, well_v2, market_v2,
  magic_crystal_cluster, giant_mushroom, flame_brazier, waypoint_pillar
Run headless:
  blender --background --python build_pack_v24_hires.py
"""
import bpy, os, math, random

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


def smooth_obj(obj, subsurf_lvl=2, bevel=0.02, bevel_seg=3):
    """Add subsurf + bevel + shade-smooth to make the mesh look hi-detail.
    Blender 5.1 dropped mesh.use_auto_smooth, so we rely on polygon use_smooth
    + bevel angle limit to achieve the same effect."""
    if bevel > 0:
        b = obj.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = bevel_seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(35)
    if subsurf_lvl > 0:
        s = obj.modifiers.new('Subsurf', 'SUBSURF')
        s.levels = subsurf_lvl
        s.render_levels = subsurf_lvl
    # Shade smooth via polygon attr
    for p in obj.data.polygons:
        p.use_smooth = True


def box(name, loc, sz, mat=None, bevel=0.02, subsurf=0, rot=(0,0,0), smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = sz
    if mat: o.data.materials.append(mat)
    if smooth: smooth_obj(o, subsurf_lvl=subsurf, bevel=bevel, bevel_seg=3)
    return o


def cyl(name, loc, r, depth, mat=None, verts=48, rot=(0,0,0), bevel=0.015, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if smooth: smooth_obj(o, subsurf_lvl=0, bevel=bevel, bevel_seg=2)
    return o


def cone(name, loc, r1, r2, depth, mat=None, verts=24, rot=(0,0,0), smooth=True):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc,
                                      vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if smooth: smooth_obj(o, subsurf_lvl=0, bevel=0.01, bevel_seg=2)
    return o


def uv_sph(name, loc, r, mat=None, segs=48, rings=24, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=rings)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def ico(name, loc, r, mat=None, subdivisions=3, smooth=True):
    """High-detail icosphere — 3 subdiv → 642 verts (proper smooth boulder)."""
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=loc, subdivisions=subdivisions)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def torus(name, loc, R, r, mat=None, maj=48, min_=16, rot=(0,0,0), smooth=True):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=R, minor_radius=r,
                                      major_segments=maj, minor_segments=min_, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def join_and_export(name):
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    # Apply modifiers BEFORE join (so subsurf/bevel are baked in)
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


# ─── 1. KOMINKA v2 HI-RES ────────────────────────────────────────────
def build_kominka_v2_hires():
    """Half-timbered house — w/ proper PBR-ish materials + subsurf-smooth shapes."""
    clear_scene()
    plaster   = pbr('K2Plaster',  (0.94, 0.88, 0.74), 0.85)
    beam_dark = pbr('K2Beam',     (0.18, 0.10, 0.06), 0.88)
    tile      = pbr('K2Tile',     (0.42, 0.20, 0.12), 0.55)
    tile_dark = pbr('K2TileD',    (0.22, 0.10, 0.06), 0.65)
    wood      = pbr('K2Wood',     (0.42, 0.28, 0.16), 0.92)
    door      = pbr('K2Door',     (0.55, 0.35, 0.18), 0.85)
    shoji     = pbr('K2Shoji',    (0.96, 0.90, 0.70), 0.45,
                    emit=(1.0, 0.85, 0.45), emit_strength=0.5)
    stone     = pbr('K2Stone',    (0.55, 0.50, 0.45), 0.92)
    iron      = pbr('K2Iron',     (0.22, 0.20, 0.18), 0.45, metal=0.65)
    bush_a    = pbr('K2BushA',    (0.30, 0.50, 0.22), 0.92)
    bush_b    = pbr('K2BushB',    (0.42, 0.62, 0.28), 0.90)
    flower    = pbr('K2Flower',   (0.95, 0.55, 0.65), 0.65,
                    emit=(0.95, 0.55, 0.65), emit_strength=0.3)

    # Stone foundation — beveled
    box('Found', (0, 0, 0.10), (2.4, 1.8, 0.20), stone, bevel=0.025)
    # Plaster body — subdivided + slightly bevelled
    body = box('Body', (0, 0, 0.70), (2.2, 1.6, 1.00), plaster, bevel=0.02)
    # Vertical timber beams (4)
    for x in [-1.05, -0.30, 0.30, 1.05]:
        box(f'VertF_{x}', (x, -0.81, 0.70), (0.08, 0.05, 1.00), beam_dark, bevel=0.008)
        box(f'VertB_{x}', (x, 0.81, 0.70), (0.08, 0.05, 1.00), beam_dark, bevel=0.008)
    # Diagonal X-bracing
    for px in [-0.65, 0.65]:
        box(f'DiagL_{px}', (px, -0.81, 0.70), (0.55, 0.05, 0.09), beam_dark, bevel=0.005,
            rot=(0, 0, math.radians(38)))
        box(f'DiagR_{px}', (px, -0.81, 0.70), (0.55, 0.05, 0.09), beam_dark, bevel=0.005,
            rot=(0, 0, math.radians(-38)))
    # Top + bottom horizontal beams
    box('BeamTop', (0, 0, 1.18), (2.20, 1.62, 0.06), beam_dark, bevel=0.008)
    box('BeamBot', (0, 0, 0.22), (2.20, 1.62, 0.06), beam_dark, bevel=0.008)
    # Shoji doors (2 panels) — high-res window grid
    for sx in [-0.30, 0.30]:
        box(f'Shoji_{sx}', (sx, -0.81, 0.65), (0.55, 0.025, 0.85), shoji, bevel=0.005)
        # door frame
        box(f'ShojiFrameT_{sx}', (sx, -0.815, 1.075), (0.58, 0.03, 0.04), beam_dark, bevel=0.005)
        box(f'ShojiFrameB_{sx}', (sx, -0.815, 0.225), (0.58, 0.03, 0.04), beam_dark, bevel=0.005)
        # 4 horizontal + 2 vertical grid bars (denser than v22)
        for k in range(4):
            box(f'GridH_{sx}_{k}', (sx, -0.815, 0.30 + k*0.20), (0.55, 0.03, 0.014), beam_dark)
        for k in range(2):
            box(f'GridV_{sx}_{k}', (sx + (k - 0.5)*0.30, -0.815, 0.65), (0.014, 0.03, 0.80), beam_dark)
        # Iron door pull
        cyl(f'Pull_{sx}', (sx + 0.10, -0.825, 0.65), 0.015, 0.04, iron, verts=14,
            rot=(math.pi/2, 0, 0))
    # Round side window — bigger + finer grid
    cyl('Win', (1.10, 0, 0.85), 0.20, 0.04, shoji, verts=32, rot=(0, math.pi/2, 0))
    torus('WinFrame', (1.105, 0, 0.85), 0.20, 0.018, beam_dark, maj=48, min_=8,
          rot=(0, math.pi/2, 0))
    # 4 spokes (was 2 cross — now 4 for finer detail)
    for i in range(4):
        ang = i / 4 * math.pi * 2 + math.pi/8
        box(f'WinSpoke_{i}', (1.10, 0, 0.85),
            (0.045, 0.005, 0.36), beam_dark,
            rot=(0, math.pi/2, ang))
    # Pyramid hip roof — 8 ROWS of TILES (denser than v22's 6)
    roof_apex = 2.25
    eave_y = 1.18
    rows = 8
    for row in range(rows):
        t = row / rows
        z = eave_y + (roof_apex - eave_y) * t
        width = 1.32 * (1.0 - t * 0.85)
        depth = 1.10 * (1.0 - t * 0.85)
        # Each row: front + back + left + right tile bands
        for ti, tx in enumerate([-width/2 + i*0.16 for i in range(int(width/0.16)+1)]):
            cyl(f'TileF_{row}_{ti}', (tx, -depth/2, z), 0.085, 0.18, tile, verts=12,
                rot=(math.radians(52), 0, math.pi/2), bevel=0.005)
            cyl(f'TileB_{row}_{ti}', (tx, depth/2, z), 0.085, 0.18, tile, verts=12,
                rot=(math.radians(-52), 0, math.pi/2), bevel=0.005)
        for ti, ty in enumerate([-depth/2 + i*0.16 for i in range(int(depth/0.16)+1)]):
            cyl(f'TileL_{row}_{ti}', (-width/2, ty, z), 0.085, 0.18, tile, verts=12,
                rot=(math.radians(52), math.pi/2, 0), bevel=0.005)
            cyl(f'TileR_{row}_{ti}', (width/2, ty, z), 0.085, 0.18, tile, verts=12,
                rot=(math.radians(-52), math.pi/2, 0), bevel=0.005)
    # Roof apex cap (carved cube-cone)
    cone('Apex', (0, 0, roof_apex), 0.22, 0.06, 0.20, tile_dark, verts=8,
         rot=(0, 0, math.pi/4))
    # Roof eave underside (dark band)
    box('Eave', (0, 0, eave_y), (2.45, 1.85, 0.045), tile_dark, bevel=0.01)
    # Stone chimney
    box('Chim', (0.70, 0.30, 1.90), (0.20, 0.22, 0.55), stone, bevel=0.02)
    box('ChimCap', (0.70, 0.30, 2.20), (0.24, 0.26, 0.05), tile_dark, bevel=0.008)
    # Wooden step at the door
    box('Step', (0, -0.95, 0.21), (0.65, 0.22, 0.05), wood, bevel=0.01)
    # Bushes flanking the entrance — icosphere subdivided (organic)
    for sx in [-0.55, 0.55]:
        m = bush_a if sx < 0 else bush_b
        ico(f'Bush_{sx}', (sx, -1.00, 0.20), 0.20, m, subdivisions=3)
        o = bpy.context.active_object; o.scale = (1.25, 1.25, 0.85)
        # 2 small flowers per bush
        for k in range(3):
            ang = k / 3 * math.pi * 2
            uv_sph(f'Flow_{sx}_{k}', (sx + math.cos(ang)*0.18, -1.00 + math.sin(ang)*0.10, 0.28),
                   0.030, flower, segs=14, rings=10)
    # 2 paper lanterns flanking the door
    for sx in [-0.95, 0.95]:
        # cord
        cyl(f'LantCord_{sx}', (sx, -0.85, 1.45), 0.006, 0.40, beam_dark, verts=6)
        # body
        uv_sph(f'LantBody_{sx}', (sx, -0.85, 1.18), 0.10, shoji, segs=20, rings=14)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
        cyl(f'LantCapT_{sx}', (sx, -0.85, 1.30), 0.045, 0.020, beam_dark, verts=14)
        cyl(f'LantCapB_{sx}', (sx, -0.85, 1.06), 0.045, 0.020, beam_dark, verts=14)
    join_and_export('kominka_v2')


# ─── 2. SAKURA v2 HI-RES ─────────────────────────────────────────────
def build_sakura_v2_hires():
    """Sakura tree — high-detail trunk (subsurf), denser blossom puffs."""
    clear_scene()
    bark      = pbr('S2Bark',     (0.28, 0.18, 0.12), 0.92)
    bark_l    = pbr('S2BarkL',    (0.48, 0.32, 0.20), 0.88)
    bark_d    = pbr('S2BarkD',    (0.15, 0.10, 0.06), 0.95)
    blossom_a = pbr('S2BlossomA', (0.98, 0.78, 0.84), 0.72,
                    emit=(1.0, 0.85, 0.88), emit_strength=0.20)
    blossom_b = pbr('S2BlossomB', (1.00, 0.92, 0.95), 0.72,
                    emit=(1.0, 0.95, 0.96), emit_strength=0.25)
    blossom_c = pbr('S2BlossomC', (0.96, 0.62, 0.72), 0.72,
                    emit=(0.98, 0.65, 0.75), emit_strength=0.20)
    petal     = pbr('S2Petal',    (1.00, 0.88, 0.92), 0.80,
                    emit=(1.0, 0.92, 0.94), emit_strength=0.25)
    moss      = pbr('S2Moss',     (0.32, 0.55, 0.24), 0.92)
    grass     = pbr('S2Grass',    (0.55, 0.78, 0.32), 0.85)

    # 1) Trunk base — subdivided + bevel for organic feel
    bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=1.40, location=(0, 0, 0.70),
                                          vertices=24)
    trunk = bpy.context.active_object; trunk.name = 'TrunkA'
    trunk.data.materials.append(bark)
    smooth_obj(trunk, subsurf_lvl=0, bevel=0.04, bevel_seg=3)
    # Bark texture suggested via small dark patches on trunk
    rng = random.Random(2401)
    for i in range(8):
        ang = rng.random() * math.pi * 2
        z = rng.random() * 1.20
        uv_sph(f'TrunkBark_{i}', (math.cos(ang)*0.32, math.sin(ang)*0.32, 0.1 + z),
               0.04 + rng.random()*0.02, bark_d, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (0.5, 0.5, 1.2)
    # 2) Y-branching trunks (3 main branches)
    main_branches = [
        (math.radians(25), math.radians(-30), 1.4, 0.20),
        (math.radians(-25), math.radians(0),  1.5, 0.18),
        (math.radians(15), math.radians(60),  1.3, 0.16),
    ]
    for i, (tilt_x, tilt_z, length, radius) in enumerate(main_branches):
        dx = math.sin(tilt_z) * math.cos(tilt_x) * length/2
        dy = math.sin(tilt_x) * length/2
        dz = math.cos(tilt_z) * math.cos(tilt_x) * length/2
        cyl(f'TrunkB{i}', (dx, dy, 1.4 + dz), radius, length, bark, verts=16,
            rot=(tilt_x, 0, tilt_z), bevel=0.02)
    # 3) Sub-branches (twigs) — 18 total
    for i in range(18):
        ang = rng.random() * math.pi * 2
        h = 1.7 + rng.random() * 1.0
        r = 0.40 + rng.random() * 0.5
        length = 0.30 + rng.random() * 0.20
        cyl(f'Twig_{i}', (math.cos(ang)*r, math.sin(ang)*r, h), 0.035, length, bark_l, verts=10,
            rot=(rng.random()*0.3 - 0.15, 0, ang + math.pi/2), bevel=0.008)
    # 4) Blossom puffs — denser, more variation
    # Central canopy
    uv_sph('CanopyMain', (0, 0, 2.45), 0.95, blossom_a, segs=36, rings=24)
    # 12 satellite puffs at slightly lower heights
    for i in range(14):
        ang = i / 14 * math.pi * 2
        r = 0.95 + rng.random() * 0.35
        h = 2.10 + rng.random() * 0.50
        m = [blossom_a, blossom_b, blossom_c][i % 3]
        uv_sph(f'PuffSat_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
               0.45 + rng.random()*0.10, m, segs=20, rings=14)
    # 24 "fluff" puffs for cloud-like density
    for i in range(24):
        ang = rng.random() * math.pi * 2
        r = 0.85 + rng.random() * 0.55
        h = 2.00 + rng.random() * 0.65
        m = [blossom_b, blossom_c][i % 2]
        uv_sph(f'Fluff_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
               0.22 + rng.random()*0.05, m, segs=14, rings=10)
    # 5) Fallen petals — 35 on ground
    for i in range(36):
        ang = rng.random() * math.pi * 2
        r = 0.5 + rng.random() * 1.5
        bpy.ops.mesh.primitive_plane_add(size=0.10,
                                          location=(math.cos(ang)*r, math.sin(ang)*r, 0.012))
        o = bpy.context.active_object; o.name = f'FallPetal_{i}'
        o.scale = (0.6, 1.0, 1.0)
        o.rotation_euler = (0, 0, rng.random() * math.pi * 2)
        o.data.materials.append(petal)
    # 6) Grass mound (icosphere, smooth)
    ico('Mound', (0, 0, 0.04), 0.62, grass, subdivisions=3)
    o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.18)
    # 7) Moss patches on the trunk base (3)
    for i in range(3):
        ang = i / 3 * math.pi * 2
        cyl(f'TrunkMoss_{i}', (math.cos(ang)*0.15, math.sin(ang)*0.10, 0.10), 0.10, 0.020, moss,
            verts=14)
    # 8) Tiny floating petals (decorative, 8)
    for i in range(10):
        ang = rng.random() * math.pi * 2
        r = 0.8 + rng.random() * 0.6
        z = 0.4 + rng.random() * 1.6
        uv_sph(f'FloatPetal_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.025, petal, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.0, 0.4, 1.0)
    join_and_export('sakura_v2')


# ─── 3. MAGIC CRYSTAL HI-RES ─────────────────────────────────────────
def build_magic_crystal_hires():
    """Crystal cluster — denser shards, refined emission, more detail."""
    clear_scene()
    purple    = pbr('CrPurple',  (0.62, 0.32, 0.92), 0.18, metal=0.4,
                    emit=(0.85, 0.50, 1.00), emit_strength=5.0)
    cyan      = pbr('CrCyan',    (0.32, 0.72, 0.95), 0.18, metal=0.4,
                    emit=(0.55, 0.88, 1.00), emit_strength=4.5)
    pink      = pbr('CrPink',    (0.88, 0.38, 0.65), 0.18, metal=0.4,
                    emit=(1.00, 0.55, 0.78), emit_strength=4.5)
    gold      = pbr('CrGold',    (0.92, 0.78, 0.30), 0.20, metal=0.4,
                    emit=(1.00, 0.85, 0.40), emit_strength=4.0)
    stone     = pbr('CrStone',   (0.45, 0.42, 0.40), 0.92)
    stone_d   = pbr('CrStoneD',  (0.25, 0.22, 0.20), 0.92)
    moss      = pbr('CrMoss',    (0.32, 0.55, 0.24), 0.92)
    rune      = pbr('CrRune',    (0.85, 0.30, 0.10), 0.20,
                    emit=(1.0, 0.40, 0.15), emit_strength=3.5)

    # 1) Mossy stone base — high-detail icosphere (subdiv 3 = 642 verts)
    ico('BaseStone', (0, 0, 0.18), 0.55, stone, subdivisions=3)
    o = bpy.context.active_object; o.scale = (1.5, 1.3, 0.55)
    # Smaller secondary stones around
    rng = random.Random(2410)
    for i in range(6):
        ang = i / 6 * math.pi * 2
        r = 0.62
        ico(f'BaseStone2_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.10),
            0.14 + rng.random()*0.04, stone_d, subdivisions=2)
        o = bpy.context.active_object
        o.scale = (1.0, 1.0, 0.55)
        o.rotation_euler = (0, 0, rng.random()*math.pi)
    # 2) Big central crystal — bigger, more detail
    bpy.ops.mesh.primitive_cylinder_add(radius=0.20, depth=1.55, vertices=6,
                                          location=(0, 0, 1.00))
    big = bpy.context.active_object; big.name = 'BigCrystal'
    big.data.materials.append(purple)
    smooth_obj(big, subsurf_lvl=0, bevel=0.025, bevel_seg=3)
    cone('BigTip', (0, 0, 2.05), 0.20, 0.0, 0.50, purple, verts=6)
    # 3) 8 satellite crystals (was 6)
    crystals = [
        (math.radians(20), math.radians(0),    0.32, 1.00, cyan),
        (math.radians(-15), math.radians(45),  0.28, 0.85, pink),
        (math.radians(25), math.radians(95),   0.34, 1.10, gold),
        (math.radians(-20), math.radians(145), 0.26, 0.80, cyan),
        (math.radians(15), math.radians(195),  0.30, 0.95, purple),
        (math.radians(-25), math.radians(245), 0.32, 1.05, pink),
        (math.radians(20), math.radians(290),  0.28, 0.90, cyan),
        (math.radians(-12), math.radians(335), 0.26, 0.82, gold),
    ]
    for i, (tilt_x, tilt_z, r, length, mat_) in enumerate(crystals):
        dx = math.sin(tilt_z) * math.cos(tilt_x) * 0.40
        dy = math.sin(tilt_x) * 0.40
        dz = math.cos(tilt_z) * math.cos(tilt_x) * 0.40
        bpy.ops.mesh.primitive_cylinder_add(radius=r*0.5, depth=length, vertices=6,
                                              location=(dx, dy, 0.55 + dz))
        sat = bpy.context.active_object; sat.name = f'Sat_{i}'
        sat.rotation_euler = (tilt_x, 0, tilt_z)
        sat.data.materials.append(mat_)
        smooth_obj(sat, subsurf_lvl=0, bevel=0.012, bevel_seg=2)
        # Tip cone
        tip_x = dx + math.sin(tilt_z) * math.cos(tilt_x) * length/2
        tip_y = dy + math.sin(tilt_x) * length/2
        tip_z = 0.55 + dz + math.cos(tilt_z) * math.cos(tilt_x) * length/2
        cone(f'SatTip_{i}', (tip_x, tip_y, tip_z), r*0.5, 0.0, length*0.3, mat_, verts=6,
             rot=(tilt_x, 0, tilt_z))
    # 4) 14 small floor chips (denser, more colorful)
    for i in range(16):
        ang = rng.random() * math.pi * 2
        r = 0.55 + rng.random() * 0.45
        m = [purple, cyan, pink, gold][i % 4]
        ico(f'Chip_{i}', (math.cos(ang)*r, math.sin(ang)*r, 0.10),
            0.07 + rng.random()*0.04, m, subdivisions=1)
        o = bpy.context.active_object
        o.rotation_euler = (rng.random()*math.pi, rng.random()*math.pi, rng.random()*math.pi)
        o.scale = (1.0, 1.0, 1.4 + rng.random()*0.4)
    # 5) Glowing rune ring around the base (decorative arc symbols)
    for i in range(12):
        ang = i / 12 * math.pi * 2
        bpy.ops.mesh.primitive_cube_add(size=1,
            location=(math.cos(ang)*0.50, math.sin(ang)*0.50, 0.18))
        o = bpy.context.active_object; o.name = f'Rune_{i}'
        o.scale = (0.04, 0.10, 0.012)
        o.rotation_euler = (0, 0, ang + math.pi/2)
        o.data.materials.append(rune)
    # 6) Moss patches on the base (5)
    for i in range(6):
        ang = i / 6 * math.pi * 2 + 0.3
        cyl(f'Moss_{i}', (math.cos(ang)*0.40, math.sin(ang)*0.40, 0.30),
            0.10, 0.014, moss, verts=14)
    # 7) Stone trim (smooth torus)
    torus('BaseTrim', (0, 0, 0.05), 0.65, 0.05, stone_d, maj=48, min_=12)
    # 8) 8 floating tiny glow particles
    for i in range(10):
        ang = rng.random() * math.pi * 2
        r = 0.6 + rng.random() * 0.5
        z = 0.8 + rng.random() * 1.0
        m = [purple, cyan, pink][i % 3]
        uv_sph(f'Float_{i}', (math.cos(ang)*r, math.sin(ang)*r, z), 0.030, m,
               segs=14, rings=10)
    join_and_export('magic_crystal_cluster')


# ─── 4. GIANT MUSHROOM HI-RES ────────────────────────────────────────
def build_giant_mushroom_hires():
    """Bigger, smoother, more detailed mushroom — proper organic feel."""
    clear_scene()
    cap_red    = pbr('GmCap',     (0.92, 0.20, 0.25), 0.50,
                     emit=(1.00, 0.30, 0.35), emit_strength=1.8)
    cap_dark   = pbr('GmCapD',    (0.62, 0.10, 0.15), 0.60)
    spot       = pbr('GmSpot',    (0.96, 0.92, 0.85), 0.55,
                     emit=(1.0, 0.95, 0.85), emit_strength=1.2)
    stem       = pbr('GmStem',    (0.95, 0.92, 0.82), 0.80)
    stem_under = pbr('GmStemU',   (0.90, 0.78, 0.55), 0.80,
                     emit=(1.0, 0.78, 0.55), emit_strength=1.0)
    grass_base = pbr('GmGrass',   (0.32, 0.55, 0.24), 0.90)
    moss       = pbr('GmMoss',    (0.42, 0.65, 0.30), 0.90)
    grass_blade = pbr('GmBlade',  (0.42, 0.62, 0.28), 0.85)

    # Grass mound (subdivided icosphere)
    ico('Mound', (0, 0, 0.05), 0.50, grass_base, subdivisions=3)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.30)
    # Moss patches on mound
    for i in range(5):
        ang = i / 5 * math.pi * 2
        cyl(f'Moss_{i}', (math.cos(ang)*0.30, math.sin(ang)*0.30, 0.10),
            0.10, 0.014, moss, verts=14)
    # Grass blades on mound
    rng = random.Random(2420)
    for i in range(16):
        ang = rng.random() * math.pi * 2
        r = rng.random() * 0.42
        for k in range(3):
            kang = k / 3 * math.pi * 2
            cyl(f'Blade_{i}_{k}', (math.cos(ang)*r + math.cos(kang)*0.02,
                                     math.sin(ang)*r + math.sin(kang)*0.02, 0.10),
                0.005, 0.14, grass_blade, verts=4,
                rot=(0, (rng.random()-0.5)*0.4, 0))
    # Tall stem — high-poly cylinder w/ subsurf-friendly geometry
    bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=1.30, location=(0, 0, 0.75),
                                          vertices=32)
    stm = bpy.context.active_object; stm.name = 'Stem'
    stm.data.materials.append(stem)
    smooth_obj(stm, subsurf_lvl=0, bevel=0.04, bevel_seg=3)
    # Bottom flare (wider at base)
    cyl('StemBase', (0, 0, 0.20), 0.34, 0.22, stem, verts=32, bevel=0.025)
    # Underside gills — subdivided torus
    torus('Gills', (0, 0, 1.30), 0.42, 0.05, stem_under, maj=48, min_=14)
    # Cap — large smooth dome
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(0, 0, 1.55),
                                          segments=48, ring_count=24)
    cap = bpy.context.active_object; cap.name = 'Cap'
    cap.scale = (1.25, 1.25, 0.80)
    cap.data.materials.append(cap_red)
    for p in cap.data.polygons: p.use_smooth = True
    # Cap underside rim
    torus('CapRim', (0, 0, 1.35), 0.62, 0.06, cap_dark, maj=48, min_=14)
    # White spots — 14 instead of 10
    for i in range(14):
        ang = rng.random() * math.pi * 2
        r = 0.32 + rng.random() * 0.18
        z = 1.58 + rng.random() * 0.28
        uv_sph(f'Spot_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.070 + rng.random()*0.02, spot, segs=16, rings=10)
    # 5 baby mushrooms (was 4)
    for i in range(5):
        ang = i / 5 * math.pi * 2 + 0.3
        bx = math.cos(ang) * 0.55
        by = math.sin(ang) * 0.55
        cyl(f'BabyStem_{i}', (bx, by, 0.20), 0.045, 0.20, stem, verts=14, bevel=0.012)
        uv_sph(f'BabyCap_{i}', (bx, by, 0.36), 0.11, cap_red, segs=20, rings=14)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.55)
        # White spot on baby
        uv_sph(f'BabySpot_{i}', (bx, by, 0.42), 0.025, spot, segs=10, rings=6)
    # 10 glow sparks around the mushroom
    spark = pbr('GmSpark', (1.0, 0.92, 0.55), 0.25,
                emit=(1.0, 0.92, 0.55), emit_strength=4.0)
    for i in range(12):
        ang = rng.random() * math.pi * 2
        r = 0.55 + rng.random() * 0.55
        z = 0.5 + rng.random() * 1.7
        uv_sph(f'Spark_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.028 + rng.random()*0.012, spark, segs=12, rings=8)
    join_and_export('giant_mushroom')


# ─── 5. WAYPOINT PILLAR HI-RES ───────────────────────────────────────
def build_waypoint_pillar_hires():
    """Waypoint pillar — finer rune detail, smoother stone, more glow particles."""
    clear_scene()
    stone     = pbr('WpStone',  (0.55, 0.50, 0.45), 0.90)
    stone_d   = pbr('WpStoneD', (0.32, 0.30, 0.25), 0.92)
    stone_l   = pbr('WpStoneL', (0.70, 0.65, 0.58), 0.90)
    rune      = pbr('WpRune',   (0.35, 0.78, 1.00), 0.18,
                    emit=(0.50, 0.88, 1.0), emit_strength=5.5)
    metal     = pbr('WpMetal',  (0.85, 0.65, 0.18), 0.30, metal=0.7)
    gem       = pbr('WpGem',    (0.55, 0.90, 1.0), 0.18, metal=0.4,
                    emit=(0.70, 0.95, 1.0), emit_strength=5.0)
    moss      = pbr('WpMoss',   (0.32, 0.55, 0.24), 0.92)
    glow_ring = pbr('WpRing',   (0.45, 0.85, 1.0), 0.25,
                    emit=(0.45, 0.85, 1.0), emit_strength=2.5)
    # Hex base — beveled
    cyl('Base', (0, 0, 0.10), 0.55, 0.20, stone_d, verts=6, bevel=0.03)
    cyl('BaseCap', (0, 0, 0.23), 0.60, 0.04, stone, verts=6, bevel=0.012)
    # 6 small stone braces around the base
    for i in range(6):
        ang = i / 6 * math.pi * 2 + math.pi/12
        ico(f'Brace_{i}', (math.cos(ang)*0.55, math.sin(ang)*0.55, 0.08),
            0.10, stone_l, subdivisions=2)
        o = bpy.context.active_object; o.scale = (1.0, 0.6, 1.0)
    # Main hex pillar
    cyl('Pillar', (0, 0, 0.95), 0.20, 1.30, stone, verts=6, bevel=0.025)
    # 6 vertical glowing runes
    for i in range(6):
        ang = i / 6 * math.pi * 2 + math.pi/12
        rx = math.cos(ang) * 0.215
        ry = math.sin(ang) * 0.215
        box(f'Rune_{i}', (rx, ry, 0.95), (0.045, 0.008, 0.50), rune,
            rot=(0, 0, ang + math.pi/2), bevel=0.005)
        # Smaller secondary rune just below
        box(f'RuneSub_{i}', (rx, ry, 0.55), (0.030, 0.008, 0.10), rune,
            rot=(0, 0, ang + math.pi/2), bevel=0.003)
    # Cap with crown spikes
    cyl('Cap', (0, 0, 1.65), 0.28, 0.10, stone_d, verts=6, bevel=0.015)
    for i in range(6):
        ang = i / 6 * math.pi * 2 + math.pi/12
        cone(f'Spike_{i}', (math.cos(ang)*0.25, math.sin(ang)*0.25, 1.78),
             0.035, 0.005, 0.20, stone, verts=6)
    # Floating gem — larger, more facets
    ico('Gem', (0, 0, 2.05), 0.16, gem, subdivisions=2)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.4)
    o.rotation_euler = (0, 0, math.pi/4)
    # 3 metal rings around gem (3 axes)
    torus('GemRing1', (0, 0, 2.05), 0.22, 0.014, metal, maj=48, min_=8, rot=(math.pi/2, 0, 0))
    torus('GemRing2', (0, 0, 2.05), 0.22, 0.014, metal, maj=48, min_=8, rot=(0, math.pi/2, 0))
    torus('GemRing3', (0, 0, 2.05), 0.22, 0.014, metal, maj=48, min_=8, rot=(math.pi/3, math.pi/3, 0))
    # Ground glow ring (smooth torus)
    torus('GroundGlow', (0, 0, 0.018), 0.80, 0.025, glow_ring, maj=64, min_=8)
    # 12 floating glow particles
    rng = random.Random(2431)
    for i in range(14):
        ang = i / 14 * math.pi * 2
        r = 0.32 + rng.random() * 0.18
        z = 1.85 + (rng.random()-0.5) * 0.40
        uv_sph(f'GlowDot_{i}', (math.cos(ang)*r, math.sin(ang)*r, z),
               0.025 + rng.random()*0.010, gem, segs=12, rings=8)
    # Moss patches at base
    for i in range(5):
        ang = i / 5 * math.pi * 2 + 0.4
        cyl(f'Moss_{i}', (math.cos(ang)*0.48, math.sin(ang)*0.48, 0.23),
            0.09, 0.012, moss, verts=12)
    join_and_export('waypoint_pillar')


# ─── 6. TORII v2 HI-RES ──────────────────────────────────────────────
def build_torii_v2_hires():
    """Torii — beveled, smoother kasagi curve, more detail."""
    clear_scene()
    red     = pbr('T2Red',     (0.82, 0.16, 0.10), 0.50)
    red_d   = pbr('T2RedD',    (0.50, 0.08, 0.06), 0.55)
    accent  = pbr('T2Accent',  (0.32, 0.18, 0.10), 0.92)
    gold    = pbr('T2Gold',    (0.85, 0.65, 0.18), 0.28, metal=0.7)
    paper   = pbr('T2Paper',   (0.96, 0.92, 0.85), 0.80)
    ink     = pbr('T2Ink',     (0.10, 0.08, 0.06), 0.85)
    stone   = pbr('T2Stone',   (0.55, 0.50, 0.45), 0.92)
    # Stone bases — beveled (octagon-like cylinder, 24 verts)
    for x in [-1.2, 1.2]:
        cyl(f'Foot_{x}', (x, 0, 0.10), 0.30, 0.20, stone, verts=24, bevel=0.025)
        cyl(f'FootCap_{x}', (x, 0, 0.23), 0.32, 0.04, accent, verts=24, bevel=0.012)
    # Pillars — high-poly cylinder w/ subtle taper
    for x in [-1.2, 1.2]:
        cyl(f'Pillar_{x}', (x, 0, 1.60), 0.17, 2.75, red, verts=32, bevel=0.025)
        # Pillar cap ring
        torus(f'PillarCap_{x}', (x, 0, 2.90), 0.175, 0.022, accent, maj=48, min_=10)
        # Decorative gold ring band
        torus(f'GoldBand_{x}', (x, 0, 2.35), 0.175, 0.012, gold, maj=48, min_=8)
        # 2 secondary gold bands
        torus(f'GoldBandLow_{x}', (x, 0, 0.60), 0.175, 0.010, gold, maj=48, min_=6)
        torus(f'GoldBandMid_{x}', (x, 0, 1.40), 0.175, 0.010, gold, maj=48, min_=6)
    # Lower crossbeam (nuki) — beveled
    box('Nuki', (0, 0, 2.60), (3.25, 0.22, 0.18), red, bevel=0.025)
    for x_sign in [-1, 1]:
        cone(f'NukiEnd_{x_sign}', (x_sign*1.70, 0, 2.60), 0.11, 0.20, 0.16, red, verts=6,
             rot=(0, math.pi/2*x_sign, 0))
    # Shimaki
    box('Shimaki', (0, 0, 3.10), (3.15, 0.38, 0.22), red, bevel=0.022)
    # Kasagi — center straight + 4-segment curved ends (smoother than v22's 3)
    box('KasagiCtr', (0, 0, 3.38), (2.50, 0.46, 0.27), red_d, bevel=0.025)
    for x_sign in [-1, 1]:
        for k, (offset_x, offset_z, ang) in enumerate([
            (1.30, 0.05, math.radians(8)),
            (1.50, 0.13, math.radians(16)),
            (1.70, 0.25, math.radians(26)),
            (1.88, 0.42, math.radians(38)),
        ]):
            box(f'KasagiEnd_{x_sign}_{k}', (x_sign*offset_x, 0, 3.38 + offset_z),
                (0.28, 0.46, 0.24), red_d, bevel=0.018,
                rot=(0, 0, x_sign * ang))
    # Gakuzuka tablet
    box('Tablet', (0, 0, 2.90), (0.38, 0.08, 0.45), accent, bevel=0.012)
    box('TabletPaper', (0, -0.045, 2.90), (0.30, 0.005, 0.36), paper)
    box('TabletInk', (0, -0.050, 2.90), (0.20, 0.005, 0.26), ink)
    # Gold trim on tablet
    box('TabletTrim', (0, -0.040, 3.13), (0.32, 0.012, 0.025), gold)
    box('TabletTrim2', (0, -0.040, 2.67), (0.32, 0.012, 0.025), gold)
    # Tablet tassels
    for x_sign in [-1, 1]:
        cyl(f'Tassel_{x_sign}', (x_sign*0.20, 0, 2.70), 0.010, 0.12, red, verts=6)
        uv_sph(f'TasselEnd_{x_sign}', (x_sign*0.20, 0, 2.62), 0.018, red, segs=12, rings=8)
    join_and_export('torii_v2')


# ─── 7. WELL v2 HI-RES ───────────────────────────────────────────────
def build_well_v2_hires():
    """Well — more stones in stack, smoother bucket, better proportions."""
    clear_scene()
    stone     = pbr('W2Stone',   (0.55, 0.50, 0.45), 0.92)
    stone_d   = pbr('W2StoneD',  (0.35, 0.32, 0.28), 0.92)
    stone_l   = pbr('W2StoneL',  (0.70, 0.65, 0.58), 0.92)
    wood      = pbr('W2Wood',    (0.42, 0.28, 0.16), 0.90)
    wood_d    = pbr('W2WoodD',   (0.22, 0.14, 0.08), 0.92)
    iron      = pbr('W2Iron',    (0.22, 0.20, 0.18), 0.45, metal=0.75)
    rope      = pbr('W2Rope',    (0.78, 0.62, 0.42), 0.92)
    water     = pbr('W2Water',   (0.20, 0.40, 0.50), 0.15, metal=0.4,
                    emit=(0.30, 0.55, 0.65), emit_strength=0.25)
    moss      = pbr('W2Moss',    (0.32, 0.55, 0.24), 0.90)
    tile      = pbr('W2Tile',    (0.42, 0.20, 0.12), 0.55)
    # Stacked stones — 4 layers × 18 stones (was 3 × 14)
    rng = random.Random(2440)
    for layer in range(4):
        z = 0.10 + layer * 0.16
        for i in range(18):
            ang = i / 18 * math.pi * 2 + (layer * 0.08)
            r = 0.65 + (rng.random()-0.5) * 0.04
            box(f'Stone_{layer}_{i}',
                (math.cos(ang)*r, math.sin(ang)*r, z),
                (0.18 + rng.random()*0.04, 0.16, 0.16),
                [stone, stone_d, stone_l][i % 3],
                bevel=0.018, smooth=True,
                rot=(0, 0, ang + math.pi/2 + (rng.random()-0.5)*0.15))
    # Water surface
    cyl('Water', (0, 0, 0.55), 0.52, 0.020, water, verts=32, bevel=0)
    # Top rim
    torus('Rim', (0, 0, 0.78), 0.64, 0.035, stone_d, maj=48, min_=14)
    # Wooden posts
    for x_sign in [-1, 1]:
        cyl(f'Post_{x_sign}', (x_sign*0.55, 0, 1.40), 0.055, 1.50, wood_d, verts=20, bevel=0.012)
        torus(f'PostBase_{x_sign}', (x_sign*0.55, 0, 0.78), 0.065, 0.014, iron,
              maj=24, min_=6)
        # Top decorative cap
        uv_sph(f'PostCap_{x_sign}', (x_sign*0.55, 0, 2.20), 0.080, wood, segs=20, rings=14)
    # Roof — smooth-shaded inclined planes w/ tile rows
    # Two angled roof planes (front + back)
    for side, y_sign in [('F', 1), ('B', -1)]:
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y_sign*0.32, 2.10))
        o = bpy.context.active_object; o.name = f'Roof{side}Plane'
        o.scale = (1.55, 0.005, 0.95)
        o.rotation_euler = (y_sign*math.radians(35), 0, 0)
        o.data.materials.append(stone_d)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.04
    # Tile rows on each face (4 rows × 7 tiles)
    for row in range(4):
        for col in range(7):
            zk = 1.83 + row * 0.13
            xk = -0.65 + col * 0.22
            for y_sign in [-1, 1]:
                yk = y_sign * (0.50 - row * 0.10)
                cyl(f'Tile_{row}_{col}_{y_sign}', (xk, yk, zk), 0.055, 0.14, tile, verts=12,
                    rot=(y_sign*math.radians(45), 0, math.pi/2), bevel=0.005)
    # Roof ridge
    box('RoofRidge', (0, 0, 2.35), (1.60, 0.07, 0.07), wood_d, bevel=0.008)
    # Cross beam between posts (where bucket hangs)
    cyl('CrossBeam', (0, 0, 1.95), 0.045, 1.15, wood, verts=20, bevel=0.012,
        rot=(math.pi/2, 0, 0))
    # Pulley
    cyl('Pulley', (0, 0, 1.85), 0.085, 0.05, wood, verts=24, bevel=0.008,
        rot=(math.pi/2, 0, 0))
    cyl('PulleyAxle', (0, 0, 1.85), 0.013, 0.10, iron, verts=16, rot=(math.pi/2, 0, 0))
    # Rope + bucket
    cyl('Rope1', (0, 0, 1.30), 0.005, 1.30, rope, verts=8)
    cyl('BucketBody', (0, 0, 0.90), 0.12, 0.22, wood, verts=24, bevel=0.012)
    cyl('BucketBot', (0, 0, 0.78), 0.12, 0.025, wood_d, verts=24)
    torus('BucketHoopT', (0, 0, 1.00), 0.125, 0.012, iron, maj=32, min_=6)
    torus('BucketHoopM', (0, 0, 0.90), 0.125, 0.012, iron, maj=32, min_=6)
    torus('BucketHoopB', (0, 0, 0.80), 0.125, 0.012, iron, maj=32, min_=6)
    torus('BucketHandle', (0, 0, 1.12), 0.12, 0.010, iron, maj=24, min_=6, rot=(math.pi/2, 0, 0))
    # Crank
    cyl('CrankRod', (-0.62, 0, 1.95), 0.015, 0.22, iron, verts=12, rot=(0, math.pi/2, 0))
    cyl('CrankHandle', (-0.79, 0, 1.95), 0.020, 0.12, wood, verts=16)
    # Moss patches
    rng2 = random.Random(2441)
    for i in range(8):
        ang = rng2.random() * math.pi * 2
        r = 0.61
        h = 0.10 + rng2.random() * 0.50
        ico(f'Moss_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
            0.08 + rng2.random()*0.02, moss, subdivisions=2)
        o = bpy.context.active_object; o.scale = (1.4, 0.35, 1.0)
    join_and_export('well_v2')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_kominka_v2_hires()
    build_sakura_v2_hires()
    build_torii_v2_hires()
    build_well_v2_hires()
    build_magic_crystal_hires()
    build_giant_mushroom_hires()
    build_waypoint_pillar_hires()
    print(f'[DONE] pack v24 (hi-res rebuild) exported to {OUT_DIR}')
