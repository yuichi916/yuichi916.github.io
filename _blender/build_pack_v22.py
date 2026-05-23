"""
Pack v22 — village hero assets at commercial Captain-Toad / Settlers level.
Builds:
  kominka_v2, sakura_v2, torii_v2, well_v2, market_v2, cobble_path,
  hedge_v2, signpost_v2
Far higher geometric + material density than the earlier procedural primitives.
Run headless:
  blender --background --python build_pack_v22.py
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


# ─── 1. KOMINKA v2 ───────────────────────────────────────────────────
def build_kominka_v2():
    """Half-timbered house w/ individual roof tile rows, sliding doors, windows, chimney."""
    clear_scene()
    plaster   = pbr('K2Plaster',  (0.94, 0.88, 0.74), 0.92)
    beam_dark = pbr('K2Beam',     (0.20, 0.12, 0.06), 0.88)
    tile      = pbr('K2Tile',     (0.32, 0.16, 0.10), 0.65)
    tile_dark = pbr('K2TileD',    (0.18, 0.10, 0.06), 0.70)
    wood      = pbr('K2Wood',     (0.42, 0.28, 0.16), 0.92)
    door      = pbr('K2Door',     (0.62, 0.42, 0.22), 0.90)
    shoji     = pbr('K2Shoji',    (0.95, 0.88, 0.62), 0.65,
                    emit=(1.0, 0.85, 0.50), emit_strength=0.6)
    stone     = pbr('K2Stone',    (0.55, 0.50, 0.45), 0.95)
    # 1) Stone foundation
    box('Found', (0, 0, 0.10), (2.4, 1.8, 0.20), stone, bevel=0.01)
    # 2) Plaster body
    box('Body', (0, 0, 0.70), (2.2, 1.6, 1.00), plaster, bevel=0.005)
    # 3) Half-timbered beams (fachwerk look) — 4 vertical + 2 diagonal + 1 top + 1 bottom
    for x in [-1.05, -0.30, 0.30, 1.05]:
        box(f'Vert_{x}', (x, -0.81, 0.70), (0.08, 0.04, 1.00), beam_dark)
        box(f'VertB_{x}', (x, 0.81, 0.70), (0.08, 0.04, 1.00), beam_dark)
    # Diagonal X-bracing on front face (2 panels)
    for px in [-0.65, 0.65]:
        box(f'DiagL_{px}', (px, -0.81, 0.70), (0.55, 0.04, 0.08), beam_dark,
            rot=(0, 0, math.radians(38)))
        box(f'DiagR_{px}', (px, -0.81, 0.70), (0.55, 0.04, 0.08), beam_dark,
            rot=(0, 0, math.radians(-38)))
    # Top + bottom horizontal beams
    box('BeamTop', (0, 0, 1.18), (2.20, 1.62, 0.06), beam_dark)
    box('BeamBot', (0, 0, 0.22), (2.20, 1.62, 0.06), beam_dark)
    # 4) Sliding shoji doors at front (2 panels)
    for sx in [-0.30, 0.30]:
        box(f'Shoji_{sx}', (sx, -0.81, 0.65), (0.55, 0.02, 0.85), shoji)
        # door frame
        box(f'ShojiFrameT_{sx}', (sx, -0.815, 1.075), (0.58, 0.025, 0.04), beam_dark)
        box(f'ShojiFrameB_{sx}', (sx, -0.815, 0.225), (0.58, 0.025, 0.04), beam_dark)
        # 3 horizontal grid bars per door
        for k in range(3):
            box(f'Grid_{sx}_{k}', (sx, -0.815, 0.30 + k*0.20), (0.55, 0.025, 0.012), beam_dark)
    # 5) Side window (round paper shoji)
    cyl('Win', (1.10, 0, 0.85), 0.18, 0.04, shoji, verts=16, rot=(0, math.pi/2, 0))
    torus('WinFrame', (1.105, 0, 0.85), 0.18, 0.015, beam_dark, maj=20, min_=4,
          rot=(0, math.pi/2, 0))
    # Cross grid on the window
    box('WinCrossH', (1.10, 0, 0.85), (0.04, 0.005, 0.32), beam_dark, rot=(0, math.pi/2, 0))
    box('WinCrossV', (1.10, 0, 0.85), (0.04, 0.32, 0.005), beam_dark, rot=(0, math.pi/2, 0))
    # 6) Pyramid hip roof — built from 5 ROWS of TILES (commercial detail)
    roof_apex = 2.20
    eave_y = 1.18
    rows = 6
    for row in range(rows):
        t = row / rows
        z = eave_y + (roof_apex - eave_y) * t
        # Row sits at z, with a square footprint that tapers from 1.32 to 0.30 width
        width = 1.32 * (1.0 - t * 0.78)
        depth = 1.10 * (1.0 - t * 0.78)
        # Each row is a thin shell of 18 individual cylindrical tiles facing front/back
        # Front edge tile-row
        for ti, tx in enumerate([-width/2 + i*0.20 for i in range(int(width/0.20)+1)]):
            # Two-sided tiles per row (front + back)
            cyl(f'TileF_{row}_{ti}', (tx, -depth/2, z), 0.10, 0.20, tile, verts=8,
                rot=(math.radians(50), 0, math.pi/2))
            cyl(f'TileB_{row}_{ti}', (tx, depth/2, z), 0.10, 0.20, tile, verts=8,
                rot=(math.radians(-50), 0, math.pi/2))
        # Side tile rows (left + right)
        for ti, ty in enumerate([-depth/2 + i*0.20 for i in range(int(depth/0.20)+1)]):
            cyl(f'TileL_{row}_{ti}', (-width/2, ty, z), 0.10, 0.20, tile, verts=8,
                rot=(math.radians(50), math.pi/2, 0))
            cyl(f'TileR_{row}_{ti}', (width/2, ty, z), 0.10, 0.20, tile, verts=8,
                rot=(math.radians(-50), math.pi/2, 0))
    # Roof ridge cap (top of pyramid — slightly tapered cube)
    cone('Apex', (0, 0, roof_apex), 0.20, 0.06, 0.18, tile_dark, verts=4,
         rot=(0, 0, math.pi/4))
    # Roof eave underside (visible dark band)
    box('Eave', (0, 0, eave_y), (2.45, 1.85, 0.04), tile_dark)
    # 7) Stone chimney
    box('Chim', (0.70, 0.30, 1.90), (0.18, 0.20, 0.50), stone)
    box('ChimCap', (0.70, 0.30, 2.18), (0.22, 0.24, 0.04), tile_dark)
    # 8) Wooden step at the door
    box('Step', (0, -0.95, 0.21), (0.60, 0.20, 0.04), wood)
    # 9) Small bushes flanking the entrance
    for sx in [-0.55, 0.55]:
        uv_sph(f'Bush_{sx}', (sx, -1.00, 0.16), 0.16, pbr(f'K2Bush_{sx}', (0.32, 0.55, 0.24), 0.9),
               segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.85)
    join_and_export('kominka_v2')


# ─── 2. SAKURA v2 ────────────────────────────────────────────────────
def build_sakura_v2():
    """Proper sakura tree — Y-branching trunk, sub-branches w/ twigs, dense blossom puffs."""
    clear_scene()
    bark      = pbr('S2Bark',     (0.28, 0.18, 0.12), 0.92)
    bark_l    = pbr('S2BarkL',    (0.48, 0.32, 0.20), 0.88)
    blossom_a = pbr('S2BlossomA', (0.98, 0.78, 0.84), 0.78)
    blossom_b = pbr('S2BlossomB', (1.00, 0.92, 0.95), 0.78)
    blossom_c = pbr('S2BlossomC', (0.96, 0.62, 0.72), 0.78)
    petal     = pbr('S2Petal',    (1.00, 0.88, 0.92), 0.85)
    moss      = pbr('S2Moss',     (0.32, 0.55, 0.24), 0.92)
    grass     = pbr('S2Grass',    (0.55, 0.78, 0.32), 0.92)
    # 1) Trunk base (thicker at bottom, slightly tapered)
    cyl('TrunkA', (0, 0, 0.65), 0.30, 1.30, bark, verts=16)
    # 2) Y-branching — split into 3 main branches at height 1.2
    main_branches = [
        (math.radians(25), math.radians(-30), 1.3, 0.18, 'TrunkB1'),
        (math.radians(-25), math.radians(0),  1.4, 0.16, 'TrunkB2'),
        (math.radians(15), math.radians(60),  1.2, 0.14, 'TrunkB3'),
    ]
    for tilt_x, tilt_z, length, radius, name in main_branches:
        # Compute branch midpoint by tilting from start (0,0,1.2)
        dx = math.sin(tilt_z) * math.cos(tilt_x) * length/2
        dy = math.sin(tilt_x) * length/2
        dz = math.cos(tilt_z) * math.cos(tilt_x) * length/2
        cyl(name, (dx, dy, 1.2 + dz), radius, length, bark, verts=10,
            rot=(tilt_x, 0, tilt_z))
    # 3) Sub-branches off each main branch (12 twigs total)
    rng = random.Random(701)
    for i in range(14):
        ang = rng.random() * math.pi * 2
        # Pick a height along the upper canopy
        h = 1.6 + rng.random() * 0.8
        r = 0.35 + rng.random() * 0.5
        length = 0.30 + rng.random() * 0.20
        cyl(f'Twig_{i}', (math.cos(ang)*r, math.sin(ang)*r, h), 0.04, length, bark_l, verts=6,
            rot=(rng.random()*0.3 - 0.15, 0, ang + math.pi/2))
    # 4) Blossom puffs — large central + 8 satellite + 16 small leaves
    # Central canopy
    uv_sph('CanopyA', (0, 0, 2.30), 0.85, blossom_a, segs=24, rings=18)
    # 8 satellite puffs at slightly lower heights
    for i in range(10):
        ang = i / 10 * math.pi * 2
        r = 0.85 + rng.random() * 0.30
        h = 1.95 + rng.random() * 0.50
        m = [blossom_a, blossom_b, blossom_c][i % 3]
        uv_sph(f'PuffSat_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
               0.40 + rng.random()*0.10, m, segs=14, rings=10)
    # 12 small "fluff" puffs in clusters (close to satellites)
    for i in range(16):
        ang = rng.random() * math.pi * 2
        r = 0.85 + rng.random() * 0.40
        h = 1.85 + rng.random() * 0.55
        m = [blossom_b, blossom_c][i % 2]
        uv_sph(f'Fluff_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
               0.18 + rng.random()*0.05, m, segs=10, rings=8)
    # 5) Fallen petals on ground (20 small flat planes)
    for i in range(24):
        ang = rng.random() * math.pi * 2
        r = 0.5 + rng.random() * 1.5
        bpy.ops.mesh.primitive_plane_add(size=0.10,
                                          location=(math.cos(ang)*r, math.sin(ang)*r, 0.012))
        o = bpy.context.active_object; o.name = f'FallPetal_{i}'
        o.scale = (0.6, 1.0, 1.0)
        o.rotation_euler = (0, 0, rng.random() * math.pi * 2)
        o.data.materials.append(petal)
    # 6) Grass mound at base
    cyl('Mound', (0, 0, 0.04), 0.55, 0.08, grass, verts=18)
    # 7) Moss patch on the trunk base
    cyl('TrunkMoss', (0.15, 0.10, 0.10), 0.10, 0.018, moss, verts=12)
    join_and_export('sakura_v2')


# ─── 3. TORII v2 ─────────────────────────────────────────────────────
def build_torii_v2():
    """Proper torii w/ upturned kasagi, shimaki, nuki, gakuzuka tablet, gold caps."""
    clear_scene()
    red     = pbr('T2Red',     (0.82, 0.16, 0.10), 0.55)
    red_d   = pbr('T2RedD',    (0.50, 0.08, 0.06), 0.60)
    accent  = pbr('T2Accent',  (0.32, 0.18, 0.10), 0.92)
    gold    = pbr('T2Gold',    (0.85, 0.65, 0.18), 0.30, metal=0.7)
    paper   = pbr('T2Paper',   (0.96, 0.92, 0.85), 0.85)
    ink     = pbr('T2Ink',     (0.10, 0.08, 0.06), 0.85)
    stone   = pbr('T2Stone',   (0.55, 0.50, 0.45), 0.95)
    # 1) 2 stone bases (musobashira foot)
    for x in [-1.2, 1.2]:
        cyl(f'Foot_{x}', (x, 0, 0.10), 0.28, 0.20, stone, verts=18)
        cyl(f'FootCap_{x}', (x, 0, 0.22), 0.30, 0.04, accent, verts=18)
    # 2) 2 vertical pillars (slight taper, painted red)
    for x in [-1.2, 1.2]:
        cyl(f'Pillar_{x}', (x, 0, 1.60), 0.16, 2.70, red, verts=22)
        # Pillar cap (small dark ring near top)
        torus(f'PillarCap_{x}', (x, 0, 2.85), 0.165, 0.018, accent, maj=22, min_=4)
        # Gold ring band at upper third (Inari accent)
        torus(f'GoldBand_{x}', (x, 0, 2.30), 0.165, 0.010, gold, maj=22, min_=4)
    # 3) Lower crossbeam (nuki) — passes through both pillars
    box('Nuki', (0, 0, 2.55), (3.20, 0.20, 0.16), red, bevel=0.01)
    # Wedge ends (extend past pillars w/ slight taper)
    for x_sign in [-1, 1]:
        cone(f'NukiEnd_{x_sign}', (x_sign*1.65, 0, 2.55), 0.10, 0.18, 0.14, red, verts=4,
             rot=(0, math.pi/2*x_sign, 0))
    # 4) Shimaki — lower heavy beam (just under kasagi)
    box('Shimaki', (0, 0, 3.05), (3.10, 0.34, 0.20), red, bevel=0.01)
    # 5) Kasagi — top crossbeam w/ upturned curved ends (the iconic torii silhouette)
    # Center straight section
    box('KasagiCtr', (0, 0, 3.30), (2.40, 0.42, 0.25), red_d, bevel=0.01)
    # Curved ends — approximate w/ 3 segments per side, each tilted slightly more
    for x_sign in [-1, 1]:
        for k, (offset_x, offset_z, ang) in enumerate([
            (1.30, 0.04, math.radians(8)),
            (1.55, 0.14, math.radians(18)),
            (1.78, 0.32, math.radians(32)),
        ]):
            box(f'KasagiEnd_{x_sign}_{k}', (x_sign*offset_x, 0, 3.30 + offset_z),
                (0.30, 0.42, 0.22), red_d, bevel=0.005,
                rot=(0, 0, x_sign * ang))
    # 6) Gakuzuka — vertical tablet hanging from kasagi to shimaki
    box('Tablet', (0, 0, 2.85), (0.35, 0.07, 0.40), accent, bevel=0.005)
    # Paper panel inside tablet
    box('TabletPaper', (0, -0.04, 2.85), (0.28, 0.005, 0.32), paper)
    # Ink character on paper
    box('TabletInk', (0, -0.045, 2.85), (0.18, 0.005, 0.22), ink)
    # Tablet ribbons (red tassels at each end)
    for x_sign in [-1, 1]:
        cyl(f'Tassel_{x_sign}', (x_sign*0.18, 0, 2.65), 0.008, 0.10, red, verts=4)
    join_and_export('torii_v2')


# ─── 4. WELL v2 ──────────────────────────────────────────────────────
def build_well_v2():
    """Stacked-stone well w/ wooden roof, bucket on rope, pulley + crank."""
    clear_scene()
    stone     = pbr('W2Stone',   (0.55, 0.50, 0.45), 0.95)
    stone_d   = pbr('W2StoneD',  (0.35, 0.32, 0.28), 0.95)
    stone_l   = pbr('W2StoneL',  (0.70, 0.65, 0.58), 0.95)
    wood      = pbr('W2Wood',    (0.42, 0.28, 0.16), 0.92)
    wood_d    = pbr('W2WoodD',   (0.22, 0.14, 0.08), 0.92)
    iron      = pbr('W2Iron',    (0.22, 0.20, 0.18), 0.55, metal=0.7)
    rope      = pbr('W2Rope',    (0.78, 0.62, 0.42), 0.95)
    water     = pbr('W2Water',   (0.22, 0.38, 0.45), 0.20, metal=0.3,
                    emit=(0.25, 0.42, 0.50), emit_strength=0.15)
    moss      = pbr('W2Moss',    (0.32, 0.55, 0.24), 0.92)
    # 1) Stacked-stone ring — 24 individual stones in 3 layers
    rng = random.Random(801)
    for layer in range(3):
        z = 0.10 + layer * 0.18
        for i in range(14):
            ang = i / 14 * math.pi * 2 + (layer * 0.10)
            r = 0.62 + (rng.random()-0.5) * 0.04
            bpy.ops.mesh.primitive_cube_add(size=1,
                location=(math.cos(ang)*r, math.sin(ang)*r, z))
            o = bpy.context.active_object; o.name = f'Stone_{layer}_{i}'
            o.scale = (0.22 + rng.random()*0.04, 0.16, 0.18)
            o.rotation_euler = (0, 0, ang + math.pi/2 + (rng.random()-0.5)*0.2)
            m = [stone, stone_d, stone_l][i % 3]
            o.data.materials.append(m)
            b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.015; b.segments = 2
    # 2) Water surface (inside the ring)
    cyl('Water', (0, 0, 0.50), 0.50, 0.020, water, verts=24)
    # 3) Top rim (smooth cap)
    torus('Rim', (0, 0, 0.70), 0.62, 0.030, stone_d, maj=24, min_=8)
    # 4) 2 wooden posts holding up the roof
    for x_sign in [-1, 1]:
        cyl(f'Post_{x_sign}', (x_sign*0.55, 0, 1.30), 0.05, 1.30, wood_d, verts=12)
        # Decorative ring around post base
        torus(f'PostBase_{x_sign}', (x_sign*0.55, 0, 0.70), 0.06, 0.012, iron,
              maj=14, min_=4)
    # 5) Sloped tile roof over the well
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.30, 2.05))
    o = bpy.context.active_object; o.name = 'RoofF'
    o.scale = (1.50, 0.005, 0.85)
    o.rotation_euler = (math.radians(30), 0, 0)
    o.data.materials.append(pbr('W2Tile', (0.32, 0.16, 0.10), 0.65))
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.03
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.30, 2.05))
    o = bpy.context.active_object; o.name = 'RoofB'
    o.scale = (1.50, 0.005, 0.85)
    o.rotation_euler = (math.radians(-30), 0, 0)
    o.data.materials.append(pbr('W2TileB', (0.32, 0.16, 0.10), 0.65))
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.03
    # Roof ridge bar
    box('RoofRidge', (0, 0, 2.28), (1.55, 0.06, 0.06), wood_d)
    # Tile rows on each roof face (4 rows × 6 tiles per face — front face)
    for row in range(4):
        for col in range(6):
            zk = 1.78 + row * 0.13
            xk = -0.60 + col * 0.24
            yk = 0.45 - row * 0.10
            cyl(f'TileF_{row}_{col}', (xk, yk, zk), 0.05, 0.12, pbr(f'W2TileR_{row}_{col}', (0.42, 0.20, 0.12), 0.7),
                verts=6, rot=(math.radians(40), 0, math.pi/2))
    # 6) Cross beam between posts (where the pulley hangs)
    cyl('CrossBeam', (0, 0, 1.85), 0.04, 1.10, wood, verts=10, rot=(math.pi/2, 0, 0))
    # 7) Pulley (small wood disc on iron axle)
    cyl('Pulley', (0, 0, 1.75), 0.08, 0.05, wood, verts=14, rot=(math.pi/2, 0, 0))
    cyl('PulleyAxle', (0, 0, 1.75), 0.012, 0.10, iron, verts=8, rot=(math.pi/2, 0, 0))
    # 8) Bucket hanging on rope
    # Rope (vertical)
    cyl('Rope1', (0, 0, 1.20), 0.005, 1.20, rope, verts=6)
    # Bucket
    cyl('BucketBody', (0, 0, 0.85), 0.10, 0.18, wood, verts=14)
    cyl('BucketBot', (0, 0, 0.75), 0.10, 0.020, wood_d, verts=14)
    torus('BucketHoopT', (0, 0, 0.94), 0.105, 0.010, iron, maj=14, min_=4)
    torus('BucketHoopB', (0, 0, 0.76), 0.105, 0.010, iron, maj=14, min_=4)
    # Bucket handle
    torus('BucketHandle', (0, 0, 1.05), 0.10, 0.008, iron, maj=12, min_=4, rot=(math.pi/2, 0, 0))
    # 9) Crank handle on the post side
    cyl('CrankRod', (-0.62, 0, 1.85), 0.014, 0.20, iron, verts=6, rot=(0, math.pi/2, 0))
    cyl('CrankHandle', (-0.78, 0, 1.85), 0.018, 0.10, wood, verts=8)
    # 10) Moss patches on the stone
    rng2 = random.Random(802)
    for i in range(5):
        ang = rng2.random() * math.pi * 2
        r = 0.61
        h = 0.10 + rng2.random() * 0.35
        uv_sph(f'Moss_{i}', (math.cos(ang)*r, math.sin(ang)*r, h),
               0.08 + rng2.random()*0.03, moss, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.4, 0.4, 1.0)
    join_and_export('well_v2')


# ─── 5. MARKET v2 ────────────────────────────────────────────────────
def build_market_v2():
    """Market stall w/ striped awning, hanging goods, wooden counter w/ displayed wares."""
    clear_scene()
    wood        = pbr('M2Wood',     (0.42, 0.28, 0.16), 0.92)
    wood_d      = pbr('M2WoodD',    (0.22, 0.14, 0.08), 0.92)
    wood_l      = pbr('M2WoodL',    (0.62, 0.42, 0.22), 0.90)
    cloth_red   = pbr('M2ClothR',   (0.85, 0.18, 0.14), 0.80)
    cloth_white = pbr('M2ClothW',   (0.95, 0.92, 0.85), 0.80)
    cloth_blue  = pbr('M2ClothB',   (0.20, 0.40, 0.70), 0.80)
    iron        = pbr('M2Iron',     (0.22, 0.20, 0.18), 0.55, metal=0.7)
    rope        = pbr('M2Rope',     (0.78, 0.62, 0.42), 0.95)
    apple       = pbr('M2Apple',    (0.85, 0.16, 0.12), 0.60)
    pear        = pbr('M2Pear',     (0.85, 0.78, 0.32), 0.65)
    bread       = pbr('M2Bread',    (0.78, 0.58, 0.28), 0.85)
    barrel      = pbr('M2Barrel',   (0.55, 0.38, 0.20), 0.92)
    # 1) Wooden floor platform
    box('Floor', (0, 0, 0.04), (1.80, 1.20, 0.08), wood_l, bevel=0.005)
    # 2) Plank grooves on floor
    for i in range(5):
        x = -0.72 + i * 0.36
        box(f'Plank_{i}', (x, 0, 0.085), (0.02, 1.18, 0.005), wood_d)
    # 3) 4 corner posts
    for x_sign in [-1, 1]:
        for y_sign in [-1, 1]:
            cyl(f'Post_{x_sign}_{y_sign}', (x_sign*0.80, y_sign*0.50, 1.10), 0.05, 2.00, wood_d, verts=10)
    # 4) Top crossbeams (where awning hangs)
    box('BeamLong', (0, 0, 2.05), (1.70, 0.06, 0.08), wood_d)
    box('BeamCross', (0, 0, 2.10), (0.06, 1.10, 0.08), wood_d)
    # 5) Sloped striped awning — 6 red+white stripes per side
    # Front-facing slope
    for i in range(8):
        m = cloth_red if i % 2 == 0 else cloth_white
        x = -0.80 + i * 0.20
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 0.40, 1.85))
        o = bpy.context.active_object; o.name = f'AwningF_{i}'
        o.scale = (0.20, 0.005, 0.80)
        o.rotation_euler = (math.radians(35), 0, 0)
        o.data.materials.append(m)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.008
    # Back-facing slope
    for i in range(8):
        m = cloth_white if i % 2 == 0 else cloth_red
        x = -0.80 + i * 0.20
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -0.40, 1.85))
        o = bpy.context.active_object; o.name = f'AwningB_{i}'
        o.scale = (0.20, 0.005, 0.80)
        o.rotation_euler = (math.radians(-35), 0, 0)
        o.data.materials.append(m)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.008
    # 6) Awning trim — blue band along front edge
    box('AwningTrim', (0, 0.78, 1.50), (1.65, 0.04, 0.10), cloth_blue)
    # 7) Wooden counter (display surface)
    box('Counter', (0, 0.30, 0.50), (1.50, 0.50, 0.90), wood, bevel=0.005)
    box('CounterTop', (0, 0.30, 0.97), (1.55, 0.55, 0.04), wood_l)
    # 8) Displayed wares on counter
    # Apple basket
    cyl('BasketA', (-0.50, 0.30, 1.05), 0.16, 0.10, wood_d, verts=14)
    # 6 apples piled in basket
    rng = random.Random(901)
    for i in range(7):
        ang = rng.random() * math.pi * 2
        r = rng.random() * 0.10
        uv_sph(f'Apple_{i}', (-0.50 + math.cos(ang)*r, 0.30 + math.sin(ang)*r,
                                1.12 + rng.random()*0.04), 0.030, apple, segs=10, rings=8)
    # Pear basket
    cyl('BasketB', (0.00, 0.30, 1.05), 0.16, 0.10, wood_d, verts=14)
    for i in range(6):
        ang = rng.random() * math.pi * 2
        r = rng.random() * 0.10
        uv_sph(f'Pear_{i}', (math.cos(ang)*r, 0.30 + math.sin(ang)*r,
                              1.12 + rng.random()*0.04), 0.028, pear, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.4)
    # Bread loaves
    for i in range(4):
        x = 0.30 + i * 0.10
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(x, 0.30, 1.02),
                                              segments=12, ring_count=8)
        o = bpy.context.active_object; o.name = f'Bread_{i}'
        o.scale = (1.5, 1.0, 0.6)
        o.data.materials.append(bread)
    # 9) Hanging goods from the crossbeam (3 cured-ham / sausage shapes)
    for i, x in enumerate([-0.50, 0.0, 0.50]):
        cyl(f'Rope_{i}', (x, 0, 1.85), 0.005, 0.20, rope, verts=4)
        # Cured ham
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(x, 0, 1.65),
                                              segments=12, ring_count=8)
        o = bpy.context.active_object; o.name = f'Ham_{i}'
        o.scale = (1.0, 1.0, 2.0)
        o.data.materials.append(pbr(f'M2Ham_{i}', (0.65, 0.20, 0.12), 0.75))
    # 10) Barrel beside the stall
    cyl('Barrel', (-1.00, 0.50, 0.30), 0.20, 0.50, barrel, verts=18)
    for k in range(2):
        torus(f'BarrelHoop_{k}', (-1.00, 0.50, 0.18 + k*0.24), 0.205, 0.012, iron,
              maj=18, min_=6)
    # 11) Front edge banner — striped flag hanging
    box('Banner', (0, 0.82, 1.20), (0.40, 0.005, 0.40), cloth_red)
    join_and_export('market_v2')


# ─── 6. COBBLE PATH SEGMENT ──────────────────────────────────────────
def build_cobble_path():
    """5-stone cobblestone path segment — tile it along scene paths."""
    clear_scene()
    s1 = pbr('CpStone1', (0.55, 0.50, 0.45), 0.92)
    s2 = pbr('CpStone2', (0.42, 0.38, 0.32), 0.92)
    s3 = pbr('CpStone3', (0.68, 0.62, 0.55), 0.92)
    s4 = pbr('CpStone4', (0.32, 0.28, 0.22), 0.92)
    grass_seam = pbr('CpGrass', (0.32, 0.55, 0.22), 0.90)
    base = pbr('CpBase', (0.18, 0.14, 0.10), 0.95)
    # Base earth
    box('Base', (0, 0, -0.02), (1.50, 0.50, 0.04), base)
    # 12 irregular cobblestones in 2 rows
    rng = random.Random(951)
    stones = [s1, s2, s3, s4]
    for row in range(2):
        for col in range(6):
            x = -0.55 + col * 0.22 + (rng.random()-0.5)*0.04
            y = -0.18 + row * 0.36 + (rng.random()-0.5)*0.06
            sz = 0.18 + rng.random() * 0.06
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.04))
            o = bpy.context.active_object; o.name = f'Cob_{row}_{col}'
            o.scale = (sz, sz, 0.06)
            o.rotation_euler = (0, 0, rng.random() * math.pi * 0.4)
            o.data.materials.append(stones[(row + col) % 4])
            b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.012; b.segments = 2
    # 6 grass seams between stones
    for i in range(6):
        ang = rng.random() * math.pi * 2
        x = -0.5 + rng.random() * 1.0
        y = -0.18 + rng.random() * 0.36
        cyl(f'Grass_{i}', (x, y, 0.08), 0.012, 0.03, grass_seam, verts=4)
    join_and_export('cobble_path')


# ─── 7. HEDGE v2 ─────────────────────────────────────────────────────
def build_hedge_v2():
    """Dense topiary hedge — layered green spheres on a wooden base."""
    clear_scene()
    leaf_a = pbr('H2LeafA', (0.32, 0.55, 0.24), 0.92)
    leaf_b = pbr('H2LeafB', (0.42, 0.65, 0.30), 0.92)
    leaf_d = pbr('H2LeafD', (0.22, 0.42, 0.18), 0.92)
    wood   = pbr('H2Wood',  (0.42, 0.28, 0.16), 0.92)
    # Wooden box base
    box('Base', (0, 0, 0.05), (0.55, 0.30, 0.10), wood, bevel=0.005)
    # 14 leaf clumps in 3 layers
    rng = random.Random(961)
    for layer in range(3):
        z = 0.20 + layer * 0.12
        for i in range(6 - layer):
            x = -0.22 + i * (0.44 / max(1, 5 - layer))
            y = (rng.random()-0.5) * 0.20
            m = [leaf_a, leaf_b, leaf_d][i % 3]
            uv_sph(f'Leaf_{layer}_{i}', (x, y, z), 0.14 + rng.random()*0.03, m, segs=12, rings=8)
            o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.85)
    # 3 small flowers peeking out
    flower = pbr('H2Flower', (0.95, 0.78, 0.32), 0.65)
    for i in range(4):
        ang = rng.random() * math.pi * 2
        r = 0.20
        uv_sph(f'Flow_{i}', (math.cos(ang)*r, math.sin(ang)*r*0.5, 0.36),
               0.030, flower, segs=8, rings=6)
    join_and_export('hedge_v2')


# ─── 8. SIGNPOST v2 ──────────────────────────────────────────────────
def build_signpost_v2():
    """Wooden signpost w/ painted plaque + ink character + roof + iron brackets."""
    clear_scene()
    wood    = pbr('Sg2Wood',   (0.42, 0.28, 0.16), 0.92)
    wood_d  = pbr('Sg2WoodD',  (0.22, 0.14, 0.08), 0.92)
    plaque  = pbr('Sg2Plaque', (0.85, 0.72, 0.45), 0.85)
    ink     = pbr('Sg2Ink',    (0.10, 0.08, 0.06), 0.85)
    iron    = pbr('Sg2Iron',   (0.22, 0.20, 0.18), 0.55, metal=0.7)
    stone   = pbr('Sg2Stone',  (0.55, 0.50, 0.45), 0.95)
    # Stone foot
    cyl('Foot', (0, 0, 0.06), 0.15, 0.12, stone, verts=14)
    # Main post
    cyl('Post', (0, 0, 0.85), 0.04, 1.50, wood, verts=12)
    # Roof on top
    cone('Roof', (0, 0, 1.74), 0.18, 0.06, 0.16, wood_d, verts=4, rot=(0, 0, math.pi/4))
    uv_sph('RoofOrb', (0, 0, 1.83), 0.025, iron, segs=10, rings=8)
    # Plaque — main rectangular sign
    box('Plaque', (0, 0.10, 1.15), (0.32, 0.04, 0.40), plaque, bevel=0.005)
    # Frame around plaque
    for sx, sy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        if abs(sx) > abs(sy):
            box(f'Fr_h_{sx}', (0, 0.10, 1.15 + sx*0.20), (0.34, 0.045, 0.02), wood_d)
        else:
            box(f'Fr_v_{sy}', (sy*0.17, 0.10, 1.15), (0.02, 0.045, 0.42), wood_d)
    # Ink character (large central)
    box('Char', (0, 0.085, 1.15), (0.18, 0.005, 0.24), ink)
    # Iron bracket holding plaque to post
    for sx in [-0.04, 0.04]:
        box(f'Bracket_{sx}', (sx, 0.05, 0.95), (0.012, 0.06, 0.04), iron)
    join_and_export('signpost_v2')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_kominka_v2()
    build_sakura_v2()
    build_torii_v2()
    build_well_v2()
    build_market_v2()
    build_cobble_path()
    build_hedge_v2()
    build_signpost_v2()
    print(f'[DONE] pack v22 exported to {OUT_DIR}')
