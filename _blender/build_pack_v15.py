"""
Pack v15 — sacred / ritual kit.
Builds:
  omikoshi, shimenawa, temple_bell, wind_chime_set,
  sumi_e_panel, hanami_blanket, ofuda_box, shide_strips
Run headless:
  blender --background --python build_pack_v15.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(15)


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


# ─── 1. OMIKOSHI (portable festival shrine) ──────────────────────────
def build_omikoshi():
    """Black-and-gold ornate portable shrine carried at matsuri festivals."""
    clear_scene()
    black = pbr('OkBlack', (0.10, 0.06, 0.04), 0.30)
    gold = pbr('OkGold', (0.92, 0.72, 0.20), 0.30, metal=0.75)
    gold_d = pbr('OkGoldD', (0.62, 0.45, 0.10), 0.40, metal=0.65)
    red = pbr('OkRed', (0.78, 0.12, 0.10), 0.50)
    wood = pbr('OkWood', (0.32, 0.18, 0.10), 0.92)
    rope = pbr('OkRope', (0.95, 0.92, 0.85), 0.95)
    # 2 long carry poles
    box('PoleL', (0, -0.45, 0.30), (2.40, 0.06, 0.06), wood)
    box('PoleR', (0,  0.45, 0.30), (2.40, 0.06, 0.06), wood)
    # Connecting cross beams
    box('CrossF', (0.50, 0, 0.30), (0.04, 0.90, 0.05), wood)
    box('CrossB', (-0.50, 0, 0.30), (0.04, 0.90, 0.05), wood)
    # Base platform
    box('Base', (0, 0, 0.40), (0.55, 0.55, 0.08), black, bevel=0.005)
    box('BaseTop', (0, 0, 0.45), (0.60, 0.60, 0.02), gold_d)
    # 4 corner posts
    for x in [-0.25, 0.25]:
        for y in [-0.25, 0.25]:
            cyl(f'Post_{x}_{y}', (x, y, 0.75), 0.025, 0.55, black, verts=8)
    # Side panels (red lattice approximated as a solid red box)
    for sx, sy in [(0,-0.27),(0,0.27),(-0.27,0),(0.27,0)]:
        if abs(sx) > abs(sy):
            box(f'Panel_x_{sx}', (sx, 0, 0.75), (0.04, 0.50, 0.50), red)
        else:
            box(f'Panel_y_{sy}', (0, sy, 0.75), (0.50, 0.04, 0.50), red)
    # Gold trim around panels
    torus('TrimMid', (0, 0, 1.00), 0.36, 0.012, gold, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Roof — pyramid w/ flared edges
    cone('Roof', (0, 0, 1.18), 0.50, 0.10, 0.35, black, verts=4, rot=(0, 0, math.pi/4))
    # Gold roof trim
    box('RoofEaveF', (0, 0.42, 1.05), (0.85, 0.05, 0.04), gold)
    box('RoofEaveB', (0, -0.42, 1.05), (0.85, 0.05, 0.04), gold)
    box('RoofEaveL', (-0.42, 0, 1.05), (0.05, 0.85, 0.04), gold)
    box('RoofEaveR', ( 0.42, 0, 1.05), (0.05, 0.85, 0.04), gold)
    # Top finial — phoenix (approximated by gold orb + small wings)
    uv_sph('Finial1', (0, 0, 1.45), 0.06, gold, segs=14, rings=10)
    uv_sph('Finial2', (0, 0, 1.55), 0.05, gold, segs=12, rings=8)
    cone('FinTop', (0, 0, 1.65), 0.04, 0.0, 0.12, gold, verts=8)
    # Decorative ribbons hanging from corners (4 strands)
    for x_sign in [-1, 1]:
        for y_sign in [-1, 1]:
            cyl(f'Rib_{x_sign}_{y_sign}', (x_sign*0.30, y_sign*0.30, 0.70), 0.005, 0.40, red,
                verts=4)
            uv_sph(f'RibKnot_{x_sign}_{y_sign}', (x_sign*0.30, y_sign*0.30, 0.48), 0.020, red,
                   segs=8, rings=6)
    # Decorative gold bell hanging in front
    uv_sph('Bell', (0, 0.42, 0.92), 0.045, gold, segs=14, rings=10)
    # White rope around the bell
    torus('BellRope', (0, 0.42, 0.96), 0.05, 0.008, rope, maj=12, min_=4)
    join_and_export('omikoshi')


# ─── 2. SHIMENAWA (sacred rope) ──────────────────────────────────────
def build_shimenawa():
    """Thick twisted straw rope hung between two posts w/ shide paper streamers."""
    clear_scene()
    straw = pbr('SnStraw', (0.85, 0.68, 0.32), 0.95)
    straw_d = pbr('SnStrawD', (0.55, 0.42, 0.18), 0.95)
    paper = pbr('SnPaper', (0.96, 0.94, 0.88), 0.85)
    wood = pbr('SnWood', (0.32, 0.20, 0.12), 0.92)
    # 2 posts (anchoring the rope)
    for x in [-1.4, 1.4]:
        cyl(f'Post_{x}', (x, 0, 1.20), 0.06, 2.40, wood, verts=10)
    # Main rope (slight catenary sag — approximate w/ 8 segments)
    SEG = 8
    SPAN = 2.6
    SAG = 0.10
    for i in range(SEG):
        t = (i + 0.5) / SEG
        x = -SPAN/2 + t * SPAN
        # parabolic sag
        sag = SAG * (1.0 - (2*t - 1)**2)
        y = 0
        z = 2.10 - sag
        # Vary thickness — thicker in middle (typical shimenawa)
        thick = 0.10 + 0.05 * (1.0 - abs(2*t - 1))
        # Tangent
        slope = SAG * (-2.0 * (2*t - 1) * 2.0 / 1.0)
        ang = math.atan2(-slope / SPAN, 1.0)
        cyl(f'Rope_{i}', (x, y, z), thick, SPAN/SEG * 1.1, straw, verts=12,
            rot=(0, ang, math.pi/2))
        # Dark spiral binding (small dark torus)
        torus(f'Bind_{i}', (x, y, z), thick*1.05, thick*0.10, straw_d, maj=14, min_=4,
              rot=(0, ang, math.pi/2))
    # 2 tassel ends (cone-like at each end)
    for x_sign in [-1, 1]:
        cone(f'Tassel_{x_sign}', (x_sign*SPAN/2, 0, 2.05), 0.10, 0.16, 0.20, straw, verts=10,
             rot=(0, math.pi/2 * x_sign, 0))
    # 5 shide (lightning-shape paper streamers) hanging from rope
    for i in range(5):
        t = (i + 1) / 6
        x = -SPAN/2 + t * SPAN
        sag = SAG * (1.0 - (2*t - 1)**2)
        z_top = 2.10 - sag - 0.08
        # Approximate shide w/ a stack of 4 offset flat boxes
        for k in range(4):
            ox = ((k % 2) * 2 - 1) * 0.04
            box(f'Shide_{i}_{k}', (x + ox, 0, z_top - 0.08 - k * 0.10),
                (0.06, 0.005, 0.10), paper)
        # Connecting string
        cyl(f'ShideStr_{i}', (x, 0, z_top - 0.04), 0.003, 0.08, straw_d, verts=4)
    join_and_export('shimenawa')


# ─── 3. TEMPLE BELL (bonshō) ─────────────────────────────────────────
def build_temple_bell():
    """Large bronze temple bell hanging from a wooden frame w/ striking log."""
    clear_scene()
    bronze = pbr('TbBronze', (0.55, 0.40, 0.18), 0.45, metal=0.70)
    bronze_d = pbr('TbBronzeD', (0.30, 0.22, 0.10), 0.55, metal=0.65)
    wood = pbr('TbWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('TbWoodD', (0.22, 0.14, 0.08), 0.92)
    rope = pbr('TbRope', (0.78, 0.62, 0.42), 0.95)
    roof = pbr('TbRoof', (0.32, 0.18, 0.12), 0.92)
    # Frame — 4 thick wooden posts
    for x in [-0.85, 0.85]:
        for y in [-0.50, 0.50]:
            cyl(f'Post_{x}_{y}', (x, y, 1.30), 0.10, 2.60, wood, verts=14)
    # Top cross beam (where bell hangs)
    box('TopBeam', (0, 0, 2.55), (1.90, 0.18, 0.18), wood_d)
    # Side support beams
    box('SideBeamF', (0, 0.50, 2.55), (1.90, 0.12, 0.12), wood_d)
    box('SideBeamB', (0, -0.50, 2.55), (1.90, 0.12, 0.12), wood_d)
    # Slanted hip roof (4-sided pyramid)
    cone('Roof', (0, 0, 3.00), 1.30, 0.20, 0.60, roof, verts=4, rot=(0, 0, math.pi/4))
    # Bell — large hanging shape (curved hemisphere + cylindrical body)
    # Top knot (ryuzu — dragon-handle, simplified as torus + small dome)
    torus('Ryuzu', (0, 0, 2.40), 0.06, 0.020, bronze, maj=14, min_=6)
    uv_sph('RyuzuTop', (0, 0, 2.42), 0.040, bronze_d, segs=12, rings=8)
    # Bell body (tall cylinder, slightly bell-curve approximated)
    cyl('BellBody', (0, 0, 1.55), 0.35, 1.40, bronze, verts=28)
    # Lower lip ring (slightly flared)
    torus('BellLip', (0, 0, 0.85), 0.36, 0.020, bronze_d, maj=28, min_=8)
    # Top cap rounding
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.35, location=(0, 0, 2.25),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'BellTop'
    o.scale = (1.0, 1.0, 0.30)
    o.data.materials.append(bronze)
    # Engraved bands on the bell
    for z in [1.20, 1.55, 1.90]:
        torus(f'Band_{z}', (0, 0, z), 0.355, 0.010, bronze_d, maj=28, min_=4)
    # Vertical decorative ridges (8 small protrusions)
    for i in range(8):
        ang = i / 8 * math.pi * 2
        bx = math.cos(ang) * 0.36
        by = math.sin(ang) * 0.36
        cyl(f'Ridge_{i}', (bx, by, 1.55), 0.008, 0.80, bronze_d, verts=4)
    # Suspension chain (small bronze torus chain + thick rope hanger from top beam)
    for i, z in enumerate([2.45, 2.48, 2.52]):
        torus(f'Chain_{i}', (0, 0, z), 0.03, 0.005, bronze_d, maj=10, min_=4)
    # Striking log (shumoku — large horizontal log hanging from chains)
    cyl('Shumoku', (1.10, 0, 1.55), 0.07, 1.20, wood, verts=12, rot=(0, math.pi/2, 0))
    # Rope chains for the log (4 ropes from the frame down to log)
    for x_off in [0.7, 1.5]:
        for y_off in [-0.15, 0.15]:
            cyl(f'LogChain_{x_off}_{y_off}', (x_off, y_off, 2.05), 0.006, 1.00, rope, verts=4)
    join_and_export('temple_bell')


# ─── 4. WIND CHIME SET ───────────────────────────────────────────────
def build_wind_chime_set():
    """Hanging wooden ring w/ 5 furin-style glass chimes + paper tags."""
    clear_scene()
    wood = pbr('WcWood', (0.42, 0.28, 0.16), 0.92)
    rope = pbr('WcRope', (0.78, 0.62, 0.42), 0.95)
    glass_b = pbr('WcGlassB', (0.55, 0.80, 0.90), 0.20, emit=(0.55, 0.80, 0.92), emit_strength=0.15)
    glass_r = pbr('WcGlassR', (0.95, 0.55, 0.55), 0.20, emit=(0.95, 0.55, 0.55), emit_strength=0.15)
    glass_g = pbr('WcGlassG', (0.55, 0.92, 0.55), 0.20, emit=(0.55, 0.92, 0.55), emit_strength=0.15)
    paper = pbr('WcPaper', (0.95, 0.92, 0.85), 0.85)
    metal = pbr('WcMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Hanging hub (a wooden ring)
    torus('Hub', (0, 0, 1.10), 0.12, 0.018, wood, maj=20, min_=6)
    # Top rope going up
    cyl('TopRope', (0, 0, 1.40), 0.008, 0.60, rope, verts=4)
    # 5 bells hanging at different heights w/ small bowls + tags
    bell_colors = [glass_b, glass_r, glass_g, glass_b, glass_r]
    angles = [0, 1.2, 2.4, 3.6, 4.8]
    for i, ang in enumerate(angles):
        x = math.cos(ang) * 0.10
        y = math.sin(ang) * 0.10
        drop = 0.10 + (i % 3) * 0.05
        # Cord
        cyl(f'Cord_{i}', (x, y, 1.10 - drop/2 - 0.05), 0.005, drop + 0.05, rope, verts=4)
        # Bell (bowl-shaped — bottom half of a sphere)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(x, y, 1.10 - drop - 0.08),
                                              segments=16, ring_count=10)
        o = bpy.context.active_object; o.name = f'Bell_{i}'
        o.scale = (1.0, 1.0, 0.55)
        o.data.materials.append(bell_colors[i])
        # Rim
        torus(f'BellRim_{i}', (x, y, 1.10 - drop - 0.10), 0.061, 0.008, metal, maj=14, min_=4)
        # Clapper (small metal ball inside the bell)
        uv_sph(f'Clapper_{i}', (x, y, 1.10 - drop - 0.08), 0.015, metal, segs=8, rings=6)
        # Paper tag dangling
        cyl(f'TagCord_{i}', (x, y, 1.10 - drop - 0.15), 0.003, 0.08, rope, verts=4)
        box(f'Tag_{i}', (x, y, 1.10 - drop - 0.22), (0.04, 0.005, 0.06), paper)
    join_and_export('wind_chime_set')


# ─── 5. SUMI-E PANEL (painted folding panel) ─────────────────────────
def build_sumi_e_panel():
    """Standing painted ink screen on a wooden base — 3-panel byōbu w/ landscape."""
    clear_scene()
    paper = pbr('SePaper', (0.95, 0.92, 0.82), 0.85,
                emit=(0.96, 0.93, 0.85), emit_strength=0.05)
    ink = pbr('SeInk', (0.12, 0.08, 0.06), 0.85)
    ink_l = pbr('SeInkL', (0.35, 0.26, 0.18), 0.88)
    wood = pbr('SeWood', (0.32, 0.20, 0.12), 0.92)
    gold = pbr('SeGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Wooden base
    box('Base', (0, 0, 0.025), (1.30, 0.15, 0.05), wood, bevel=0.005)
    # 3 panels — zigzag w/ alternating tilt
    panel_w = 0.45; panel_h = 0.85; panel_d = 0.02
    cx = -0.50
    for i in range(3):
        ang = math.radians(15) if i % 2 == 0 else math.radians(-15)
        dx = math.cos(ang) * panel_w/2
        dy = math.sin(ang) * panel_w/2
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, 0.05 + panel_h/2))
        o = bpy.context.active_object; o.name = f'Panel_{i}'
        o.scale = (panel_w, panel_d, panel_h)
        o.rotation_euler = (0, 0, ang)
        o.data.materials.append(paper)
        # Outer frame (4 thin sides)
        for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
            if abs(sx) > abs(sy):
                ex = cx + dx + math.cos(ang) * sx * panel_w/2
                ey = dy + math.sin(ang) * sx * panel_w/2
                bpy.ops.mesh.primitive_cube_add(size=1, location=(ex, ey, 0.05 + panel_h/2))
                b = bpy.context.active_object; b.name = f'PanelF_{i}_{sx}'
                b.scale = (0.025, panel_d*1.3, panel_h)
                b.rotation_euler = (0, 0, ang)
                b.data.materials.append(wood)
            else:
                ez = 0.05 + (0 if sy < 0 else panel_h)
                bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + dx, dy, ez))
                b = bpy.context.active_object; b.name = f'PanelH_{i}_{sy}'
                b.scale = (panel_w, panel_d*1.3, 0.025)
                b.rotation_euler = (0, 0, ang)
                b.data.materials.append(wood)
        # Sumi-e mountain silhouette — 3 ink triangles per panel
        for k in range(3):
            tx = cx + dx + math.cos(ang) * ((k - 1) * 0.12)
            ty = dy + math.sin(ang) * ((k - 1) * 0.12) - 0.015
            tz = 0.20 + k * 0.05
            tri_h = 0.18 + (k * 0.04)
            bpy.ops.mesh.primitive_cone_add(radius1=0.07 + k*0.02, radius2=0.0, depth=tri_h,
                                             location=(tx, ty, tz + tri_h/2), vertices=3)
            o = bpy.context.active_object; o.name = f'Mount_{i}_{k}'
            o.rotation_euler = (math.pi/2, 0, ang)
            o.data.materials.append(ink_l if k == 1 else ink)
        # Sun/moon disk on one panel
        if i == 1:
            uv_sph(f'Sun_{i}', (cx + dx, dy - 0.020, 0.65), 0.05, gold, segs=14, rings=10)
            o = bpy.context.active_object; o.scale = (1.0, 0.3, 1.0)
        # Calligraphy column (vertical ink strokes)
        for k in range(3):
            box(f'Stroke_{i}_{k}', (cx + dx + math.cos(ang)*0.18, dy + math.sin(ang)*0.18 - 0.020,
                                     0.25 + k * 0.08), (0.020, 0.005, 0.05), ink,
                rot=(0, 0, ang))
        cx += math.cos(ang) * panel_w
    join_and_export('sumi_e_panel')


# ─── 6. HANAMI BLANKET ───────────────────────────────────────────────
def build_hanami_blanket():
    """Picnic scene — blue-and-white blanket w/ bento boxes, sake bottle, fan."""
    clear_scene()
    blanket = pbr('HbBlanket', (0.18, 0.30, 0.55), 0.85)
    blanket_w = pbr('HbBlanketW', (0.95, 0.92, 0.85), 0.85)
    wood = pbr('HbWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('HbWoodD', (0.22, 0.14, 0.08), 0.92)
    porcelain = pbr('HbPorcelain', (0.95, 0.92, 0.88), 0.40)
    rice = pbr('HbRice', (0.96, 0.94, 0.88), 0.70)
    fan_p = pbr('HbFan', (0.95, 0.65, 0.78), 0.65)
    pink = pbr('HbPink', (0.95, 0.78, 0.85), 0.85)
    # Blanket (flat slab — slightly larger than 1m)
    box('Blanket', (0, 0, 0.015), (1.40, 1.10, 0.025), blanket, bevel=0.005)
    # White checker stripes (6 across)
    for i, x in enumerate([-0.50, -0.20, 0.10, 0.40]):
        box(f'Stripe_x_{i}', (x, 0, 0.028), (0.04, 1.05, 0.005), blanket_w)
    for i, y in enumerate([-0.40, -0.10, 0.20]):
        box(f'Stripe_y_{i}', (0, y, 0.028), (1.35, 0.04, 0.005), blanket_w)
    # 2 bento boxes (lacquered, 2-tier)
    for j, (x, y) in enumerate([(-0.30, 0.10), (0.20, -0.20)]):
        box(f'BentoBot_{j}', (x, y, 0.06), (0.22, 0.18, 0.06), wood_d)
        box(f'BentoTop_{j}', (x, y, 0.12), (0.22, 0.18, 0.05), wood)
        box(f'BentoLid_{j}', (x, y, 0.155), (0.24, 0.20, 0.012), wood_d)
        # Visible food on bottom layer (small rice ball + something)
        uv_sph(f'BentoRice_{j}', (x, y, 0.085), 0.030, rice, segs=10, rings=8)
    # Sake bottle in middle (tokkuri)
    uv_sph('SakeBody', (0.45, 0.30, 0.10), 0.07, porcelain, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.3)
    cyl('SakeNeck', (0.45, 0.30, 0.20), 0.022, 0.05, porcelain, verts=10)
    # 2 cups
    for k, x in enumerate([0.30, 0.45]):
        cyl(f'Cup_{k}', (x, 0.42, 0.05), 0.030, 0.03, porcelain, verts=12)
    # Folding fan (open, lying flat)
    for k in range(8):
        ang = -math.pi/3 + (2*math.pi/3) * (k / 7)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.50 + math.cos(ang)*0.10,
                                                            -0.30 + math.sin(ang)*0.10, 0.035))
        o = bpy.context.active_object; o.name = f'FanSlat_{k}'
        o.scale = (0.020, 0.20, 0.004)
        o.rotation_euler = (math.pi/2, 0, ang)
        o.data.materials.append(fan_p)
    # Pivot
    uv_sph('FanPivot', (-0.50, -0.30, 0.04), 0.020, wood_d, segs=10, rings=8)
    # Scatter of cherry petals on the blanket (small pink discs)
    rng = random.Random(161)
    for i in range(15):
        x = (rng.random() - 0.5) * 1.20
        y = (rng.random() - 0.5) * 0.90
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, 0.031))
        o = bpy.context.active_object; o.name = f'Petal_{i}'
        o.scale = (0.04, 0.04, 0.005)
        o.rotation_euler = (0, 0, rng.random()*math.pi*2)
        o.data.materials.append(pink)
    join_and_export('hanami_blanket')


# ─── 7. OFUDA BOX (talisman shrine box) ──────────────────────────────
def build_ofuda_box():
    """Small wooden shrine box with white-paper ofuda standing inside."""
    clear_scene()
    wood = pbr('ObWood', (0.55, 0.38, 0.20), 0.92)
    wood_d = pbr('ObWoodD', (0.32, 0.22, 0.14), 0.92)
    paper = pbr('ObPaper', (0.96, 0.94, 0.88), 0.85)
    ink = pbr('ObInk', (0.10, 0.08, 0.06), 0.85)
    red = pbr('ObRed', (0.85, 0.16, 0.12), 0.65)
    gold = pbr('ObGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Outer cabinet box (open front)
    box('Back', (0, -0.08, 0.30), (0.40, 0.04, 0.55), wood)
    box('Bottom', (0, 0, 0.04), (0.40, 0.20, 0.04), wood_d)
    box('SideL', (-0.20, 0, 0.30), (0.04, 0.20, 0.55), wood)
    box('SideR', ( 0.20, 0, 0.30), (0.04, 0.20, 0.55), wood)
    box('Top', (0, 0, 0.575), (0.45, 0.22, 0.04), wood_d)
    # Steep roof (small hip roof)
    cone('Roof', (0, 0, 0.62), 0.30, 0.08, 0.12, red, verts=4, rot=(0, 0, math.pi/4))
    # 3 standing ofuda paper talismans
    for i, x in enumerate([-0.10, 0.0, 0.10]):
        # Paper rectangle (vertical strip)
        box(f'Ofuda_{i}', (x, 0.03, 0.30), (0.05, 0.005, 0.30), paper)
        # Pointed top
        cone(f'OfudaTop_{i}', (x, 0.03, 0.47), 0.025, 0.0, 0.05, paper, verts=4)
        # Ink character (small dark mark in center)
        box(f'OfudaInk_{i}', (x, 0.030, 0.30), (0.025, 0.005, 0.10), ink)
        # Red stamp
        box(f'OfudaSeal_{i}', (x, 0.029, 0.20), (0.012, 0.005, 0.012), red)
    # Gold trim above the roof
    torus('Trim', (0, 0, 0.58), 0.18, 0.008, gold, maj=4, min_=4, rot=(0, 0, math.pi/4))
    # Small offering platter inside (in front of ofuda)
    cyl('Platter', (0, 0.06, 0.075), 0.05, 0.012, wood_d, verts=14)
    # Small grain/rice on platter
    uv_sph('Offering', (0, 0.06, 0.085), 0.018,
           pbr('ObRice', (0.95, 0.92, 0.85), 0.65), segs=10, rings=6)
    o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.6)
    join_and_export('ofuda_box')


# ─── 8. SHIDE STRIPS (paper streamers) ───────────────────────────────
def build_shide_strips():
    """Vertical hanging pole with 5 large shide (lightning-shape paper streamers)."""
    clear_scene()
    wood = pbr('SsWood', (0.42, 0.28, 0.16), 0.92)
    paper = pbr('SsPaper', (0.96, 0.94, 0.88), 0.85,
                emit=(0.96, 0.94, 0.88), emit_strength=0.08)
    rope = pbr('SsRope', (0.85, 0.68, 0.32), 0.95)
    metal = pbr('SsMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Vertical pole (cane)
    cyl('Pole', (0, 0, 1.20), 0.030, 2.40, wood, verts=12)
    # Crown — bronze cap
    uv_sph('Cap', (0, 0, 2.42), 0.035, metal, segs=12, rings=8)
    # Horizontal cross at the top
    cyl('Cross', (0, 0, 2.25), 0.022, 0.50, wood, verts=8, rot=(math.pi/2, 0, 0))
    # 5 shide strips at different positions
    positions = [(0, -0.20), (0, -0.10), (0, 0), (0, 0.10), (0, 0.20)]
    for i, (x, y) in enumerate(positions):
        # Connecting cord
        cyl(f'Cord_{i}', (x, y, 2.00), 0.004, 0.18, rope, verts=4)
        # Shide — 4 stacked zigzag paper segments
        for k in range(4):
            ox = ((k % 2) * 2 - 1) * 0.05
            box(f'Strip_{i}_{k}', (x + ox, y, 1.85 - k * 0.12),
                (0.08, 0.005, 0.10), paper)
    # Decorative red knot at the base
    torus('Knot', (0, 0, 0.10), 0.04, 0.008, pbr('SsRed', (0.85, 0.16, 0.12), 0.65),
          maj=14, min_=4)
    join_and_export('shide_strips')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_omikoshi()
    build_shimenawa()
    build_temple_bell()
    build_wind_chime_set()
    build_sumi_e_panel()
    build_hanami_blanket()
    build_ofuda_box()
    build_shide_strips()
    print(f'[DONE] pack v15 exported to {OUT_DIR}')
