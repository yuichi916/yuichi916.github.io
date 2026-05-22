"""
Pack v8 — architecture extras.
Builds:
  drum_bridge, pagoda_3tier, tea_garden_set, shoji_screen,
  zen_garden, kura_storage, torii_grand, koma_inu
Run headless:
  blender --background --python build_pack_v8.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(8)


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
    o = bpy.context.active_object; o.name = name; o.scale = sz
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


# ─── 1. DRUM BRIDGE (taiko-bashi) ────────────────────────────────────
def build_drum_bridge():
    """Curved Japanese arched pond bridge with railing — classic taiko-bashi."""
    clear_scene()
    paint = pbr('BridgePaint', (0.80, 0.18, 0.14), 0.50)
    paint_dark = pbr('BridgePaintDark', (0.55, 0.10, 0.08), 0.55)
    wood = pbr('BridgeWood', (0.35, 0.22, 0.14), 0.92)
    rail = pbr('BridgeRail', (0.85, 0.20, 0.16), 0.55)
    # 12 deck slats forming the arch — each tilted to follow the curve
    SPAN = 4.0
    HEIGHT = 1.10
    N = 14
    for i in range(N):
        t = (i + 0.5) / N
        # Position on a parabola arch
        x = -SPAN/2 + t * SPAN
        # Height above ground
        y = HEIGHT * (1.0 - (2*t - 1)**2)
        # Tangent angle (derivative)
        slope = HEIGHT * (-2.0 * (2*t - 1) * 2.0 / 1.0)   # dy/dt scaled
        ang = math.atan2(-slope / SPAN, 1.0)              # rotation about y axis... but bridge runs along x. We use rot_y? Actually slats rotate about z
        # Each slat: small box following the slope
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, y + 0.06))
        o = bpy.context.active_object; o.name = f'Slat_{i}'
        # Slat shape: long across z, narrow along x, thin in y
        o.scale = (SPAN/N * 1.1, 1.6, 0.10)
        o.rotation_euler = (0, ang, 0)
        o.data.materials.append(wood)
    # Underside arch beam (two long curves)
    for z_off in [-0.7, 0.7]:
        for i in range(N):
            t = (i + 0.5) / N
            x = -SPAN/2 + t * SPAN
            y = HEIGHT * (1.0 - (2*t - 1)**2) - 0.08
            slope = HEIGHT * (-2.0 * (2*t - 1) * 2.0 / 1.0)
            ang = math.atan2(-slope / SPAN, 1.0)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, z_off, y))
            o = bpy.context.active_object; o.name = f'UnderBeam_{z_off}_{i}'
            o.scale = (SPAN/N * 1.1, 0.10, 0.08)
            o.rotation_euler = (0, ang, 0)
            o.data.materials.append(paint_dark)
    # Railings — vertical posts at intervals on both sides
    POSTS = 8
    for z_off in [-0.85, 0.85]:
        for i in range(POSTS):
            t = (i + 0.5) / POSTS
            x = -SPAN/2 + t * SPAN
            y = HEIGHT * (1.0 - (2*t - 1)**2) + 0.55
            cyl(f'Post_{z_off}_{i}', (x, z_off, y), 0.04, 0.6, paint, verts=8)
            # Cap orb
            uv_sph(f'PostOrb_{z_off}_{i}', (x, z_off, y + 0.32), 0.045, paint, segs=10, rings=6)
    # Top rail (one slab per side)
    for z_off in [-0.85, 0.85]:
        # Approximate the curve with 14 small slabs along the arch
        for i in range(N):
            t = (i + 0.5) / N
            x = -SPAN/2 + t * SPAN
            y = HEIGHT * (1.0 - (2*t - 1)**2) + 0.85
            slope = HEIGHT * (-2.0 * (2*t - 1) * 2.0 / 1.0)
            ang = math.atan2(-slope / SPAN, 1.0)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, z_off, y))
            o = bpy.context.active_object; o.name = f'TopRail_{z_off}_{i}'
            o.scale = (SPAN/N * 1.1, 0.06, 0.04)
            o.rotation_euler = (0, ang, 0)
            o.data.materials.append(rail)
    # End posts (taller, at both bridge ends)
    for x_end in [-SPAN/2, SPAN/2]:
        for z_off in [-0.85, 0.85]:
            cyl(f'EndPost_{x_end}_{z_off}', (x_end, z_off, 0.5), 0.08, 1.00, paint_dark, verts=10)
            # Decorative finial
            uv_sph(f'Finial_{x_end}_{z_off}', (x_end, z_off, 1.05), 0.07, paint_dark, segs=12, rings=8)
            cone(f'Cap_{x_end}_{z_off}', (x_end, z_off, 1.15), 0.06, 0.0, 0.10, paint_dark, verts=8)
    join_and_export('drum_bridge')


# ─── 2. PAGODA 3-TIER ────────────────────────────────────────────────
def build_pagoda_3tier():
    """3-tier wooden pagoda — more compact than the 5-tier hero pagoda."""
    clear_scene()
    wood = pbr('PagWood', (0.40, 0.18, 0.10), 0.92)
    wall = pbr('PagWall', (0.92, 0.86, 0.72), 0.92)
    roof = pbr('PagRoof', (0.18, 0.10, 0.08), 0.92)
    roof_trim = pbr('PagTrim', (0.62, 0.22, 0.16), 0.85)
    spire = pbr('PagSpire', (0.75, 0.55, 0.20), 0.40, metal=0.65)
    # Foundation
    box('Found', (0, 0, 0.20), (2.6, 2.6, 0.40), wood, bevel=0.02)
    # Tier 1
    box('T1', (0, 0, 1.10), (2.0, 2.0, 1.20), wall, bevel=0.02)
    cone('R1', (0, 0, 2.10), 1.80, 0.40, 0.60, roof, verts=4, rot=(0, 0, math.pi/4))
    # Eave trim ring 1
    torus('Trim1', (0, 0, 1.75), 1.30, 0.04, roof_trim, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Tier 2
    box('T2', (0, 0, 2.70), (1.5, 1.5, 1.00), wall, bevel=0.02)
    cone('R2', (0, 0, 3.55), 1.35, 0.30, 0.55, roof, verts=4, rot=(0, 0, math.pi/4))
    torus('Trim2', (0, 0, 3.20), 0.95, 0.04, roof_trim, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Tier 3
    box('T3', (0, 0, 4.05), (1.0, 1.0, 0.85), wall, bevel=0.02)
    cone('R3', (0, 0, 4.80), 0.90, 0.20, 0.55, roof, verts=4, rot=(0, 0, math.pi/4))
    torus('Trim3', (0, 0, 4.48), 0.65, 0.04, roof_trim, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Spire (sourin)
    cyl('Spire', (0, 0, 5.30), 0.05, 0.80, spire, verts=10)
    # 3 rings on the spire
    for i in range(3):
        torus(f'SpRing_{i}', (0, 0, 5.10 + i*0.15), 0.11, 0.012, spire, maj=16, min_=4)
    # Top orb
    uv_sph('SpOrb', (0, 0, 5.80), 0.08, spire, segs=14, rings=10)
    # Doors (on each tier — small dark boxes on front face)
    box('Door1', (0, -1.01, 0.85), (0.55, 0.05, 1.10), roof)
    box('Door2', (0, -0.76, 2.55), (0.45, 0.05, 0.85), roof)
    # Wood support pillars at corners of tier 1 (4 visible columns)
    for x in [-0.95, 0.95]:
        for y in [-0.95, 0.95]:
            cyl(f'Pillar1_{x}_{y}', (x, y, 1.10), 0.07, 1.20, wood, verts=8)
    join_and_export('pagoda_3tier')


# ─── 3. TEA GARDEN SET (low table + cushion + 2 cups + teapot) ───────
def build_tea_garden_set():
    """Outdoor tea ceremony tableau on a tatami square."""
    clear_scene()
    tatami = pbr('TGTatami', (0.75, 0.65, 0.42), 0.95)
    tatami_trim = pbr('TGTatamiTrim', (0.18, 0.12, 0.06), 0.90)
    wood = pbr('TGWood', (0.42, 0.28, 0.16), 0.92)
    cushion = pbr('TGCushion', (0.78, 0.18, 0.14), 0.80)
    cushion_b = pbr('TGCushionB', (0.18, 0.30, 0.55), 0.80)
    porcelain = pbr('TGPorcelain', (0.95, 0.92, 0.88), 0.35)
    matcha = pbr('TGMatcha', (0.45, 0.62, 0.20), 0.65,
                 emit=(0.50, 0.65, 0.22), emit_strength=0.10)
    iron = pbr('TGIron', (0.22, 0.18, 0.14), 0.55, metal=0.7)
    # Tatami mat (2 tatami panels side by side)
    for i in range(2):
        box(f'Tatami_{i}', (i*0.95 - 0.475, 0, 0.02), (0.95, 1.4, 0.04), tatami)
    # Trim around tatami
    for x_sign, z_sign in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(x_sign) > abs(z_sign):
            box(f'Trim_x_{x_sign}', (x_sign*1.0, 0, 0.025), (0.03, 1.40, 0.06), tatami_trim)
        else:
            box(f'Trim_z_{z_sign}', (0, z_sign*0.72, 0.025), (1.95, 0.03, 0.06), tatami_trim)
    # Low wooden table
    box('TableTop', (0, 0, 0.20), (0.80, 0.55, 0.04), wood, bevel=0.005)
    for x in [-0.34, 0.34]:
        for y in [-0.22, 0.22]:
            cyl(f'TableLeg_{x}_{y}', (x, y, 0.10), 0.025, 0.20, wood, verts=8)
    # Teapot — squat sphere with spout + handle on table
    uv_sph('TeapotBody', (0, 0, 0.28), 0.10, iron, segs=18, rings=12)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.80)
    cyl('TeapotSpout', (0.13, 0, 0.30), 0.020, 0.10, iron, verts=8,
        rot=(0, math.radians(-60), 0))
    torus('TeapotHandle', (-0.12, 0, 0.32), 0.04, 0.012, iron, maj=12, min_=6,
          rot=(0, 0, math.radians(90)))
    cyl('TeapotLid', (0, 0, 0.36), 0.04, 0.02, iron, verts=12)
    uv_sph('TeapotKnob', (0, 0, 0.38), 0.015, iron, segs=8, rings=6)
    # 2 tea cups with matcha
    for i, x in enumerate([-0.22, 0.22]):
        cyl(f'Cup_{i}', (x, 0.10, 0.25), 0.04, 0.05, porcelain, verts=14)
        cyl(f'Tea_{i}', (x, 0.10, 0.275), 0.035, 0.005, matcha, verts=14)
    # 2 floor cushions on either side
    box('CushionA', (-0.55, 0, 0.10), (0.40, 0.35, 0.08), cushion, bevel=0.02)
    box('CushionB', ( 0.55, 0, 0.10), (0.40, 0.35, 0.08), cushion_b, bevel=0.02)
    # Small flower in bud vase
    cyl('Vase', (0.32, -0.18, 0.24), 0.022, 0.10, porcelain, verts=10)
    uv_sph('VaseFlower', (0.32, -0.18, 0.32), 0.022, pbr('TGFlower', (0.92, 0.55, 0.78), 0.80),
           segs=10, rings=8)
    cyl('VaseStem', (0.32, -0.18, 0.32), 0.005, 0.08,
        pbr('TGStem', (0.32, 0.55, 0.22), 0.85), verts=4)
    join_and_export('tea_garden_set')


# ─── 4. SHOJI SCREEN (folding paper screen) ──────────────────────────
def build_shoji_screen():
    """4-panel folding shoji screen with wooden grid + paper, slightly zigzag."""
    clear_scene()
    frame = pbr('ShojiFrame', (0.35, 0.22, 0.14), 0.92)
    paper = pbr('ShojiPaper', (0.96, 0.94, 0.88), 0.85,
                emit=(0.96, 0.94, 0.88), emit_strength=0.10)
    grid = pbr('ShojiGrid', (0.22, 0.14, 0.08), 0.90)
    # 4 panels arranged in zigzag (alternating ±15° rotation around z, hinged at top edge)
    panel_w = 0.6; panel_h = 1.6; panel_d = 0.04
    rng = random.Random(23)
    cx = -0.9
    for i in range(4):
        # Panel rotation (alternating sign)
        ang = (math.radians(20) if i % 2 == 0 else math.radians(-20))
        # Compute panel midpoint
        dx = math.cos(ang) * panel_w/2
        dy = math.sin(ang) * panel_w/2
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, panel_h/2))
        o = bpy.context.active_object; o.name = f'Panel_{i}'
        o.scale = (panel_w, panel_d, panel_h)
        o.rotation_euler = (0, 0, ang)
        o.data.materials.append(paper)
        # Outer frame (4 sides — sit on the panel)
        # Top
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, panel_h - 0.04))
        b = bpy.context.active_object; b.name = f'FrameT_{i}'
        b.scale = (panel_w, panel_d*1.3, 0.04); b.rotation_euler = (0, 0, ang)
        b.data.materials.append(frame)
        # Bottom
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, 0.04))
        b = bpy.context.active_object; b.name = f'FrameB_{i}'
        b.scale = (panel_w, panel_d*1.3, 0.04); b.rotation_euler = (0, 0, ang)
        b.data.materials.append(frame)
        # Left / right edges
        for sx in [-1, 1]:
            ex = cx + dx + math.cos(ang) * sx * panel_w/2 - math.sin(ang) * 0
            ey = dy + math.sin(ang) * sx * panel_w/2
            bpy.ops.mesh.primitive_cube_add(size=1, location=(ex, ey, panel_h/2))
            b = bpy.context.active_object; b.name = f'FrameS_{i}_{sx}'
            b.scale = (0.04, panel_d*1.3, panel_h); b.rotation_euler = (0, 0, ang)
            b.data.materials.append(frame)
        # 5 horizontal + 3 vertical grid bars (thin dark)
        for k in range(1, 5):
            z = panel_h * k / 5
            bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, z))
            g = bpy.context.active_object; g.name = f'GridH_{i}_{k}'
            g.scale = (panel_w*0.98, panel_d*0.7, 0.012); g.rotation_euler = (0, 0, ang)
            g.data.materials.append(grid)
        for k in range(1, 3):
            sx = -1 + k * (2/3)
            ex = cx + dx + math.cos(ang) * sx * panel_w/2
            ey = dy + math.sin(ang) * sx * panel_w/2
            bpy.ops.mesh.primitive_cube_add(size=1, location=(ex, ey, panel_h/2))
            g = bpy.context.active_object; g.name = f'GridV_{i}_{k}'
            g.scale = (0.012, panel_d*0.7, panel_h*0.98); g.rotation_euler = (0, 0, ang)
            g.data.materials.append(grid)
        # Move cx by the rotated panel width
        cx += math.cos(ang) * panel_w
    join_and_export('shoji_screen')


# ─── 5. ZEN GARDEN ───────────────────────────────────────────────────
def build_zen_garden():
    """Raked sand rectangle with 3 boulders and surrounding low wood frame."""
    clear_scene()
    sand = pbr('ZenSand', (0.92, 0.88, 0.78), 0.92)
    rock = pbr('ZenRock', (0.32, 0.28, 0.24), 0.95)
    rock_l = pbr('ZenRockLight', (0.55, 0.50, 0.42), 0.95)
    wood = pbr('ZenWood', (0.32, 0.20, 0.12), 0.92)
    moss = pbr('ZenMoss', (0.32, 0.55, 0.24), 0.90)
    # Sand bed
    box('Sand', (0, 0, 0.05), (3.0, 2.0, 0.10), sand)
    # Wooden frame around sand
    box('FrameN', (0, 1.05, 0.10), (3.15, 0.10, 0.20), wood)
    box('FrameS', (0, -1.05, 0.10), (3.15, 0.10, 0.20), wood)
    box('FrameE', (1.55, 0, 0.10), (0.10, 2.20, 0.20), wood)
    box('FrameW', (-1.55, 0, 0.10), (0.10, 2.20, 0.20), wood)
    # 3 boulders forming a Mt-Horai trinity (large + 2 small)
    uv_sph('Boulder_main', (0.4, 0.2, 0.30), 0.32, rock, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 0.85, 0.65)
    uv_sph('Boulder_small1', (-0.6, -0.3, 0.18), 0.18, rock_l, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 0.95, 0.55)
    uv_sph('Boulder_small2', (-0.9, 0.4, 0.14), 0.14, rock, segs=12, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.50)
    # Moss patches at base of boulders
    cyl('Moss1', (0.4, 0.2, 0.11), 0.30, 0.02, moss, verts=16)
    cyl('Moss2', (-0.6, -0.3, 0.11), 0.18, 0.02, moss, verts=14)
    # Raked sand grooves — concentric ovals around main boulder (thin torus rings)
    for i, R in enumerate([0.50, 0.70, 0.90]):
        torus(f'Rake_{i}', (0.4, 0.2, 0.105), R, 0.008, pbr(f'ZRake_{i}', (0.65, 0.60, 0.50), 0.95),
              maj=48, min_=4)
    # Parallel rake lines through the rest of sand (thin shallow boxes)
    for i in range(8):
        x = -1.4 + i * 0.4
        if abs(x - 0.4) < 0.95:  # skip the region under main boulder grooves
            continue
        box(f'Line_{i}', (x, 0, 0.105), (0.01, 1.85, 0.005),
            pbr(f'ZLine_{i}', (0.65, 0.60, 0.50), 0.95))
    join_and_export('zen_garden')


# ─── 6. KURA STORAGE (white-plaster storehouse) ──────────────────────
def build_kura_storage():
    """Traditional white-plaster kura — sloped tile roof, dark trim, small window."""
    clear_scene()
    plaster = pbr('KuraPlaster', (0.92, 0.90, 0.86), 0.90)
    trim = pbr('KuraTrim', (0.18, 0.12, 0.08), 0.85)
    roof_tile = pbr('KuraRoof', (0.18, 0.20, 0.22), 0.65)
    door = pbr('KuraDoor', (0.22, 0.14, 0.08), 0.92)
    iron = pbr('KuraIron', (0.18, 0.18, 0.20), 0.45, metal=0.7)
    found = pbr('KuraFound', (0.30, 0.26, 0.22), 0.92)
    # Stone foundation
    box('Found', (0, 0, 0.15), (2.6, 2.0, 0.30), found, bevel=0.02)
    # Plaster body
    box('Body', (0, 0, 1.10), (2.4, 1.8, 1.60), plaster, bevel=0.02)
    # Dark trim (a wide band 0.20m thick around the top)
    box('TrimTop', (0, 0, 1.86), (2.5, 1.9, 0.10), trim)
    # Dark trim around base
    box('TrimBase', (0, 0, 0.32), (2.5, 1.9, 0.06), trim)
    # Dark corner posts (4 vertical strips visible from outside)
    for x in [-1.2, 1.2]:
        for y in [-0.90, 0.90]:
            box(f'Corner_{x}_{y}', (x, y, 1.10), (0.10, 0.10, 1.60), trim)
    # Hipped tile roof (steep pyramid)
    cone('Roof', (0, 0, 2.45), 1.55, 0.30, 0.80, roof_tile, verts=4, rot=(0, 0, math.pi/4))
    # Roof ridge accent (small box at top edges)
    for x in [-1.0, 1.0]:
        for y in [-0.7, 0.7]:
            box(f'RoofRidge_{x}_{y}', (x, y, 1.95), (0.16, 0.16, 0.06), trim)
    # Heavy iron-clad door on front
    box('Door', (0, -0.92, 0.85), (0.70, 0.04, 1.10), door)
    # Iron studs on the door (3x3 grid)
    for ix in range(3):
        for iz in range(3):
            uv_sph(f'Stud_{ix}_{iz}', (-0.25 + ix*0.25, -0.94, 0.50 + iz*0.30), 0.022,
                   iron, segs=8, rings=6)
    # Iron lock plate
    box('LockPlate', (0, -0.945, 0.85), (0.16, 0.005, 0.16), iron)
    # Small high window with dark grate
    box('Window', (0.7, -0.92, 1.45), (0.30, 0.04, 0.22), trim)
    for k in range(3):
        cyl(f'Grate_v{k}', (0.55 + k*0.15, -0.94, 1.45), 0.010, 0.22, iron, verts=4)
    join_and_export('kura_storage')


# ─── 7. TORII GRAND (large 2-pillar gate) ────────────────────────────
def build_torii_grand():
    """Larger painted torii with double crossbeam, suited as a hero gateway."""
    clear_scene()
    paint = pbr('ToriiPaint', (0.82, 0.18, 0.10), 0.45)
    wood = pbr('ToriiWood', (0.32, 0.10, 0.06), 0.90)
    accent = pbr('ToriiAccent', (0.10, 0.06, 0.04), 0.85)
    base = pbr('ToriiBase', (0.45, 0.42, 0.38), 0.92)
    # Two stone bases at the foot of each pillar
    for x in [-2.0, 2.0]:
        box(f'Base_{x}', (x, 0, 0.10), (0.50, 0.50, 0.20), base, bevel=0.02)
    # 2 tall pillars (slightly tapered — approximated with cylinder)
    for x in [-2.0, 2.0]:
        cyl(f'Pillar_{x}', (x, 0, 2.10), 0.20, 4.00, paint, verts=18, bevel=0.01)
    # Top thick crossbeam (kasagi) — slightly upturned at ends
    box('Kasagi', (0, 0, 4.30), (5.0, 0.50, 0.30), paint, bevel=0.02)
    # Wedge ends (cone-like) to suggest the upturned curves
    for x_sign in [-1, 1]:
        cone(f'KasagiEnd_{x_sign}', (x_sign*2.55, 0, 4.36), 0.18, 0.30, 0.20,
             paint, verts=4, rot=(0, math.pi/2, 0))
    # Lower crossbeam (shimaki) — beneath kasagi
    box('Shimaki', (0, 0, 4.00), (4.6, 0.40, 0.20), paint, bevel=0.02)
    # Mid horizontal beam (nuki) through the pillars
    box('Nuki', (0, 0, 3.40), (4.2, 0.25, 0.18), paint, bevel=0.02)
    # Tablet (gakuzuka) hanging below kasagi
    box('Tablet', (0, 0, 3.75), (0.5, 0.06, 0.40), accent, bevel=0.005)
    box('TabletInner', (0, -0.04, 3.75), (0.42, 0.02, 0.32), wood, bevel=0.005)
    # Caps on top of pillars (joining caps where they meet kasagi)
    for x in [-2.0, 2.0]:
        cyl(f'Cap_{x}', (x, 0, 4.13), 0.22, 0.06, wood, verts=18)
    join_and_export('torii_grand')


# ─── 8. KOMA INU (guardian lion-dog statue) ──────────────────────────
def build_koma_inu():
    """Stylized stone guardian dog — on a pedestal, fierce mane, paws forward."""
    clear_scene()
    stone = pbr('KIStone', (0.55, 0.52, 0.48), 0.95)
    stone_d = pbr('KIStoneD', (0.42, 0.40, 0.36), 0.95)
    moss = pbr('KIMoss', (0.32, 0.50, 0.24), 0.90)
    # Pedestal
    box('Pedestal', (0, 0, 0.20), (0.70, 0.50, 0.40), stone_d, bevel=0.02)
    box('PedTop', (0, 0, 0.42), (0.78, 0.58, 0.04), stone, bevel=0.01)
    # Body — crouched/sitting pose
    uv_sph('Body', (0, 0, 0.70), 0.22, stone, segs=20, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.4, 1.0)
    # Chest
    uv_sph('Chest', (0, 0.25, 0.65), 0.16, stone, segs=16, rings=12)
    # Front legs (vertical, paws forward)
    for x_sign in [-1, 1]:
        cyl(f'Leg_{x_sign}', (x_sign*0.10, 0.30, 0.55), 0.06, 0.30, stone, verts=10)
        # Paw
        uv_sph(f'Paw_{x_sign}', (x_sign*0.10, 0.38, 0.42), 0.07, stone, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.0, 1.4, 0.6)
    # Hind legs (folded under body)
    for x_sign in [-1, 1]:
        uv_sph(f'HindLeg_{x_sign}', (x_sign*0.15, -0.18, 0.55), 0.12, stone, segs=12, rings=10)
        o = bpy.context.active_object; o.scale = (1.0, 1.4, 0.85)
    # Head
    uv_sph('Head', (0, 0.30, 0.95), 0.16, stone, segs=18, rings=14)
    # Snout
    box('Snout', (0, 0.46, 0.92), (0.12, 0.12, 0.10), stone, bevel=0.01)
    # Open jaw (suggested by darker box inside snout)
    box('Jaw', (0, 0.50, 0.88), (0.10, 0.04, 0.04), stone_d)
    # Mane — curly fluff around head (8 small spheres in a ring)
    for i in range(8):
        ang = i / 8 * math.pi * 2
        x = math.sin(ang) * 0.20
        y = 0.18 + math.cos(ang) * 0.10
        uv_sph(f'Mane_{i}', (x, y, 0.96), 0.08, stone_d, segs=10, rings=6)
    # Curly tail (spiral approximation)
    uv_sph('Tail', (0, -0.35, 0.85), 0.12, stone, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (0.7, 1.0, 1.2)
    # Eyes (small dark spheres)
    for x_sign in [-1, 1]:
        uv_sph(f'Eye_{x_sign}', (x_sign*0.06, 0.42, 1.00), 0.020, stone_d, segs=8, rings=6)
    # Ears (small triangular cones)
    for x_sign in [-1, 1]:
        cone(f'Ear_{x_sign}', (x_sign*0.10, 0.22, 1.10), 0.05, 0.0, 0.10, stone, verts=6)
    # Moss patches on pedestal
    cyl('Moss1', (-0.30, -0.15, 0.405), 0.08, 0.01, moss, verts=10)
    cyl('Moss2', (0.25, 0.20, 0.405), 0.06, 0.01, moss, verts=10)
    join_and_export('koma_inu')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_drum_bridge()
    build_pagoda_3tier()
    build_tea_garden_set()
    build_shoji_screen()
    build_zen_garden()
    build_kura_storage()
    build_torii_grand()
    build_koma_inu()
    print(f'[DONE] pack v8 exported to {OUT_DIR}')
