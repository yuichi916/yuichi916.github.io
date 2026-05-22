"""
Pack v12 — vehicles & transport.
Builds:
  rowboat, palanquin, ox_cart, sled,
  rickshaw, raft, ferry_boat, fishing_boat
Run headless:
  blender --background --python build_pack_v12.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(12)


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


# ─── 1. ROWBOAT ──────────────────────────────────────────────────────
def build_rowboat():
    """Small wooden rowboat — flat hull, single seat, 2 oars."""
    clear_scene()
    wood = pbr('RbWood', (0.62, 0.42, 0.22), 0.92)
    wood_d = pbr('RbWoodD', (0.32, 0.22, 0.14), 0.92)
    seat = pbr('RbSeat', (0.42, 0.28, 0.16), 0.90)
    metal = pbr('RbMetal', (0.30, 0.26, 0.22), 0.55, metal=0.6)
    rope = pbr('RbRope', (0.78, 0.62, 0.42), 0.95)
    # Hull (long oval — combine 2 boxes + a pointed front)
    box('Hull', (0, 0, 0.08), (1.80, 0.55, 0.18), wood, bevel=0.04)
    # Bow (pointed front)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.95, 0, 0.10))
    o = bpy.context.active_object; o.name = 'Bow'
    o.scale = (0.40, 0.20, 0.20)
    o.rotation_euler = (0, 0, math.radians(0))
    o.data.materials.append(wood)
    cone('BowTip', (1.10, 0, 0.10), 0.18, 0.04, 0.30, wood, verts=8,
         rot=(0, math.pi/2, 0))
    # Stern (rear, slightly squared off)
    box('Stern', (-0.92, 0, 0.10), (0.18, 0.45, 0.18), wood_d, bevel=0.01)
    # Rim (gunwale)
    for x_sign in [-1, 1]:
        box(f'Rim_{x_sign}', (0, x_sign*0.28, 0.18), (1.80, 0.04, 0.04), wood_d)
    # 2 seats (planks across)
    for x in [-0.45, 0.40]:
        box(f'Seat_{x}', (x, 0, 0.18), (0.10, 0.50, 0.03), seat)
    # 2 oars (long thin cylinders with paddle ends)
    for x_sign in [-1, 1]:
        cyl(f'Oar_{x_sign}', (-0.20, x_sign*0.30, 0.22), 0.018, 1.20, wood, verts=8,
            rot=(0, math.radians(10), x_sign*math.radians(20)))
        # Paddle blade at the outer end
        box(f'Paddle_{x_sign}', (-0.62, x_sign*0.62, 0.04), (0.20, 0.10, 0.015), wood,
            rot=(0, 0, x_sign*math.radians(15)))
    # Iron oarlock rings (on each rim)
    for x_sign in [-1, 1]:
        torus(f'OarLock_{x_sign}', (0, x_sign*0.30, 0.22), 0.025, 0.006, metal,
              maj=10, min_=4, rot=(math.pi/2, 0, 0))
    # Rope coiled at bow
    for i in range(3):
        torus(f'Coil_{i}', (0.85, 0.15, 0.18 + i*0.012), 0.06, 0.008, rope,
              maj=14, min_=4)
    join_and_export('rowboat')


# ─── 2. PALANQUIN (kago) ─────────────────────────────────────────────
def build_palanquin():
    """Roofed sedan chair carried by 2 poles — covered passenger seat."""
    clear_scene()
    wood = pbr('PqWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('PqWoodD', (0.22, 0.14, 0.08), 0.92)
    roof = pbr('PqRoof', (0.32, 0.18, 0.12), 0.92)
    panel = pbr('PqPanel', (0.62, 0.18, 0.14), 0.65)
    gold = pbr('PqGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    curtain = pbr('PqCurtain', (0.92, 0.78, 0.42), 0.85)
    # Floor
    box('Floor', (0, 0, 0.40), (0.85, 0.65, 0.06), wood, bevel=0.005)
    # 4 corner posts
    for x in [-0.40, 0.40]:
        for y in [-0.30, 0.30]:
            cyl(f'Post_{x}_{y}', (x, y, 0.70), 0.025, 0.60, wood, verts=8)
    # Side panels (red)
    box('PanelL', (-0.40, 0, 0.70), (0.04, 0.60, 0.50), panel)
    box('PanelR', ( 0.40, 0, 0.70), (0.04, 0.60, 0.50), panel)
    box('PanelB', (0, -0.30, 0.70), (0.85, 0.04, 0.50), panel)
    # Front panel is curtain (partially up, see-through)
    box('Curtain', (0, 0.30, 0.78), (0.85, 0.04, 0.30), curtain)
    # Gold trim around panels
    torus('PanelTrim', (0, 0, 0.95), 0.45, 0.012, gold, maj=24, min_=4,
          rot=(0, 0, 0))
    # Steep roof (pyramid)
    cone('Roof', (0, 0, 1.10), 0.55, 0.10, 0.30, roof, verts=4, rot=(0, 0, math.pi/4))
    # Gold finial
    uv_sph('RoofOrb', (0, 0, 1.32), 0.04, gold, segs=12, rings=8)
    # 2 carrying poles (sticking out front + back)
    cyl('PoleL', (-1.10, 0, 0.95), 0.025, 1.30, wood_d, verts=8,
        rot=(0, math.pi/2, 0))
    cyl('PoleR', ( 1.10, 0, 0.95), 0.025, 1.30, wood_d, verts=8,
        rot=(0, math.pi/2, 0))
    # Wait — poles should be continuous through the cabin. Replace with 2 longer poles on top:
    # Actually, kago poles run on top — one each side
    box('PoleTopL', (0, -0.32, 1.05), (2.40, 0.04, 0.04), wood_d)
    box('PoleTopR', (0,  0.32, 1.05), (2.40, 0.04, 0.04), wood_d)
    join_and_export('palanquin')


# ─── 3. OX CART ──────────────────────────────────────────────────────
def build_ox_cart():
    """Wooden ox cart — bed, 2 large wheels, yoke + 1 lashed ox."""
    clear_scene()
    wood = pbr('OcWood', (0.52, 0.34, 0.18), 0.92)
    wood_d = pbr('OcWoodD', (0.32, 0.22, 0.14), 0.92)
    iron = pbr('OcIron', (0.28, 0.24, 0.20), 0.55, metal=0.6)
    hide = pbr('OcHide', (0.42, 0.30, 0.20), 0.90)
    hide_d = pbr('OcHideD', (0.22, 0.16, 0.10), 0.92)
    horn = pbr('OcHorn', (0.85, 0.78, 0.60), 0.65)
    # Cart bed (rectangular)
    box('Bed', (0, 0, 0.55), (1.20, 0.85, 0.10), wood, bevel=0.01)
    # Side rails (4)
    for x_sign, y_sign in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(x_sign) > abs(y_sign):
            box(f'Rail_x_{x_sign}', (x_sign*0.62, 0, 0.65), (0.04, 0.85, 0.10), wood_d)
        else:
            box(f'Rail_y_{y_sign}', (0, y_sign*0.43, 0.65), (1.20, 0.04, 0.10), wood_d)
    # 2 large wheels (vertical, on each side)
    for y_sign in [-1, 1]:
        # Wheel rim
        torus(f'Wheel_{y_sign}', (-0.10, y_sign*0.50, 0.30), 0.32, 0.04, wood, maj=24, min_=8,
              rot=(0, math.pi/2, 0))
        # Inner ring
        torus(f'WheelIn_{y_sign}', (-0.10, y_sign*0.50, 0.30), 0.22, 0.025, wood_d, maj=20, min_=8,
              rot=(0, math.pi/2, 0))
        # 8 spokes
        for i in range(8):
            ang = i / 8 * math.pi * 2
            sx = -0.10 + math.cos(ang) * 0.16
            sz = 0.30 + math.sin(ang) * 0.16
            cyl(f'Spoke_{y_sign}_{i}', (sx, y_sign*0.50, sz), 0.012, 0.30, wood_d, verts=4,
                rot=(0, ang, 0))
        # Iron hub
        cyl(f'Hub_{y_sign}', (-0.10, y_sign*0.50, 0.30), 0.05, 0.10, iron, verts=10,
            rot=(0, math.pi/2, 0))
    # Axle (long cylinder under bed)
    cyl('Axle', (-0.10, 0, 0.30), 0.025, 1.10, iron, verts=8, rot=(math.pi/2, 0, 0))
    # Yoke poles (extending forward)
    box('Yoke', (1.00, 0, 0.50), (1.20, 0.04, 0.04), wood_d)
    box('YokeT', (1.50, 0, 0.45), (0.04, 0.50, 0.04), wood_d)
    # Ox standing in front (simplified — body + legs + head + horns)
    # Body
    uv_sph('OxBody', (2.10, 0, 0.55), 0.30, hide, segs=20, rings=14)
    o = bpy.context.active_object; o.scale = (1.4, 0.85, 0.85)
    # Legs (4 short cyl)
    for x in [1.85, 2.30]:
        for y in [-0.15, 0.15]:
            cyl(f'OxLeg_{x}_{y}', (x, y, 0.25), 0.045, 0.50, hide_d, verts=8)
    # Neck
    cyl('OxNeck', (2.45, 0, 0.65), 0.10, 0.30, hide, verts=10,
        rot=(0, math.radians(-30), 0))
    # Head
    uv_sph('OxHead', (2.65, 0, 0.70), 0.16, hide, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.2, 0.85, 0.95)
    # Horns
    for y_sign in [-1, 1]:
        cone(f'Horn_{y_sign}', (2.65, y_sign*0.10, 0.85), 0.03, 0.005, 0.16, horn, verts=6,
             rot=(0, 0, y_sign*math.radians(30)))
    # Tail
    cyl('OxTail', (1.85, 0, 0.50), 0.015, 0.20, hide, verts=6,
        rot=(0, math.radians(70), 0))
    # 3 round bales on the cart bed (load)
    for i, x in enumerate([-0.30, 0.0, 0.30]):
        cyl(f'Bale_{i}', (x, 0, 0.75), 0.18, 0.30, pbr(f'OcBale_{i}', (0.85, 0.68, 0.32), 0.95), verts=14,
            rot=(math.pi/2, 0, 0))
    join_and_export('ox_cart')


# ─── 4. SLED ─────────────────────────────────────────────────────────
def build_sled():
    """Small wooden sled w/ rope handle and 2 curved runners."""
    clear_scene()
    wood = pbr('SlWood', (0.62, 0.42, 0.22), 0.92)
    wood_d = pbr('SlWoodD', (0.32, 0.22, 0.14), 0.92)
    rope = pbr('SlRope', (0.78, 0.62, 0.42), 0.95)
    metal = pbr('SlMetal', (0.30, 0.26, 0.22), 0.55, metal=0.6)
    # Deck (the seat board)
    box('Deck', (0, 0, 0.12), (0.60, 0.30, 0.04), wood, bevel=0.005)
    # 5 deck planks (visual grooves)
    for i, x in enumerate([-0.24, -0.12, 0.0, 0.12, 0.24]):
        box(f'Plank_{i}', (x, 0, 0.142), (0.04, 0.28, 0.005), wood_d)
    # 2 curved runners (long thin boxes with rotation for the front upturn)
    for y_sign in [-1, 1]:
        # Main runner
        box(f'Runner_{y_sign}', (0, y_sign*0.13, 0.05), (0.55, 0.04, 0.05), wood_d, bevel=0.005)
        # Front upturn
        box(f'RunnerFront_{y_sign}', (0.32, y_sign*0.13, 0.10), (0.18, 0.04, 0.05), wood_d,
            rot=(0, math.radians(-30), 0))
    # Support struts between deck and runners (4)
    for x_sign, y_sign in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        cyl(f'Strut_{x_sign}_{y_sign}', (x_sign*0.22, y_sign*0.13, 0.085), 0.015, 0.07,
            wood, verts=6)
    # Rope handle (loops up from front)
    cyl('Rope1', (0.42, -0.10, 0.18), 0.008, 0.20, rope, verts=4,
        rot=(0, math.radians(-30), 0))
    cyl('Rope2', (0.42,  0.10, 0.18), 0.008, 0.20, rope, verts=4,
        rot=(0, math.radians(-30), 0))
    # Rope handle bar
    cyl('RopeHandle', (0.55, 0, 0.26), 0.012, 0.20, wood_d, verts=8,
        rot=(math.pi/2, 0, 0))
    # Metal tip caps on runners
    for y_sign in [-1, 1]:
        uv_sph(f'TipCap_{y_sign}', (0.42, y_sign*0.13, 0.13), 0.025, metal, segs=8, rings=6)
    join_and_export('sled')


# ─── 5. RICKSHAW ─────────────────────────────────────────────────────
def build_rickshaw():
    """2-wheel hand-pulled rickshaw w/ canopy, plush seat, lacquer finish."""
    clear_scene()
    lacquer = pbr('RsLacquer', (0.10, 0.04, 0.04), 0.30)
    lacquer_red = pbr('RsLacquerR', (0.65, 0.10, 0.08), 0.40)
    wood = pbr('RsWood', (0.42, 0.28, 0.16), 0.92)
    canopy = pbr('RsCanopy', (0.18, 0.10, 0.08), 0.65)
    seat = pbr('RsSeat', (0.78, 0.18, 0.14), 0.75)
    iron = pbr('RsIron', (0.28, 0.24, 0.20), 0.55, metal=0.6)
    gold = pbr('RsGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Carriage body (curved trunk)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30, location=(0, 0, 0.55),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Body'
    o.scale = (1.3, 0.85, 0.85)
    o.data.materials.append(lacquer)
    # Seat cushion
    box('Seat', (0, 0, 0.65), (0.40, 0.40, 0.10), seat, bevel=0.02)
    # Backrest
    box('Back', (-0.25, 0, 0.85), (0.05, 0.42, 0.40), lacquer_red, bevel=0.01)
    # 2 large wheels
    for y_sign in [-1, 1]:
        torus(f'Wheel_{y_sign}', (0, y_sign*0.45, 0.30), 0.30, 0.04, lacquer, maj=24, min_=8,
              rot=(0, math.pi/2, 0))
        # Inner ring + spokes
        torus(f'WheelIn_{y_sign}', (0, y_sign*0.45, 0.30), 0.20, 0.025, lacquer_red, maj=20, min_=8,
              rot=(0, math.pi/2, 0))
        for i in range(10):
            ang = i / 10 * math.pi * 2
            sx = math.cos(ang) * 0.15
            sz = 0.30 + math.sin(ang) * 0.15
            cyl(f'Spoke_{y_sign}_{i}', (sx, y_sign*0.45, sz), 0.010, 0.28, lacquer, verts=4,
                rot=(0, ang, 0))
        # Hub
        cyl(f'Hub_{y_sign}', (0, y_sign*0.45, 0.30), 0.045, 0.10, iron, verts=10,
            rot=(0, math.pi/2, 0))
    # Pull poles (extending forward)
    box('PoleL', (0.70, -0.18, 0.35), (1.30, 0.03, 0.03), wood)
    box('PoleR', (0.70,  0.18, 0.35), (1.30, 0.03, 0.03), wood)
    # Handles at front
    cyl('HandleL', (1.32, -0.18, 0.35), 0.018, 0.10, wood, verts=6,
        rot=(math.pi/2, 0, 0))
    cyl('HandleR', (1.32,  0.18, 0.35), 0.018, 0.10, wood, verts=6,
        rot=(math.pi/2, 0, 0))
    # Canopy (folded down style — a curved arc above seat)
    for i in range(5):
        t = i / 4
        # Position on arc from front to back over the seat
        ang = math.radians(-30 + t * 90)
        cx = 0.0 + math.cos(ang) * 0.30
        cz = 1.10 + math.sin(ang) * 0.20 - 0.05
        box(f'CanopyRib_{i}', (cx, 0, cz), (0.04, 0.50, 0.03), canopy)
    # Canopy fabric (dark drape)
    box('CanopyDrape', (0, 0, 1.15), (0.55, 0.50, 0.02), canopy)
    # Gold corner trim
    for x_sign, y_sign in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        uv_sph(f'Trim_{x_sign}_{y_sign}', (x_sign*0.30, y_sign*0.25, 1.16), 0.025, gold,
               segs=10, rings=6)
    join_and_export('rickshaw')


# ─── 6. RAFT ─────────────────────────────────────────────────────────
def build_raft():
    """Bamboo log raft with rope lashings and a single pole."""
    clear_scene()
    bamboo = pbr('RfBamboo', (0.62, 0.50, 0.20), 0.85)
    bamboo_d = pbr('RfBambooD', (0.32, 0.22, 0.10), 0.92)
    rope = pbr('RfRope', (0.78, 0.62, 0.42), 0.95)
    # 7 bamboo logs side by side
    LOGS = 7
    log_R = 0.075
    for i in range(LOGS):
        x = -((LOGS-1) * log_R * 1.05) / 2 + i * log_R * 2.1
        cyl(f'Log_{i}', (x, 0, 0.075), log_R, 1.80, bamboo, verts=12,
            rot=(math.pi/2, 0, 0))
        # Bamboo nodes (ring every ~0.40)
        for k in range(4):
            zk = -0.7 + k * 0.45
            torus(f'Node_{i}_{k}', (x, zk, 0.075), log_R*1.08, log_R*0.18, bamboo_d, maj=10, min_=4,
                  rot=(math.pi/2, 0, 0))
    # 2 cross beams (lashed across the top of logs)
    for z_off in [-0.65, 0.65]:
        cyl(f'Beam_{z_off}', (0, z_off, 0.16), 0.018, ((LOGS-1) * log_R * 2.1) + log_R * 2, bamboo_d,
            verts=8, rot=(0, math.pi/2, 0))
    # Rope wrapping the beams (decorative knots at each log intersection)
    for i in range(LOGS):
        x = -((LOGS-1) * log_R * 1.05) / 2 + i * log_R * 2.1
        for z_off in [-0.65, 0.65]:
            torus(f'Lash_{i}_{z_off}', (x, z_off, 0.16), 0.030, 0.008, rope, maj=10, min_=4)
    # Pole (long thin bamboo pole laid diagonally)
    cyl('Pole', (0.3, 0.3, 0.18), 0.020, 2.40, bamboo, verts=10,
        rot=(0, math.radians(35), math.radians(15)))
    join_and_export('raft')


# ─── 7. FERRY BOAT ───────────────────────────────────────────────────
def build_ferry_boat():
    """Long flat-bottomed ferry — passenger benches, mooring rope, ferryman's pole."""
    clear_scene()
    wood = pbr('FbWood', (0.55, 0.38, 0.20), 0.92)
    wood_d = pbr('FbWoodD', (0.32, 0.22, 0.14), 0.92)
    bench = pbr('FbBench', (0.42, 0.30, 0.18), 0.90)
    iron = pbr('FbIron', (0.28, 0.24, 0.20), 0.55, metal=0.6)
    rope = pbr('FbRope', (0.78, 0.62, 0.42), 0.95)
    canopy = pbr('FbCanopy', (0.62, 0.18, 0.14), 0.65)
    # Hull (longer than rowboat)
    box('Hull', (0, 0, 0.10), (3.20, 0.80, 0.22), wood, bevel=0.04)
    # Bow point
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.70, 0, 0.12))
    o = bpy.context.active_object; o.name = 'Bow'
    o.scale = (0.40, 0.30, 0.22)
    o.data.materials.append(wood)
    cone('BowTip', (1.95, 0, 0.12), 0.18, 0.04, 0.40, wood, verts=8,
         rot=(0, math.pi/2, 0))
    # Stern (squared off)
    box('Stern', (-1.65, 0, 0.12), (0.20, 0.70, 0.22), wood_d, bevel=0.02)
    # Side rims
    for y_sign in [-1, 1]:
        box(f'Rim_{y_sign}', (0, y_sign*0.40, 0.22), (3.20, 0.06, 0.04), wood_d)
    # 4 passenger benches (planks across)
    for x in [-1.00, -0.30, 0.40, 1.10]:
        box(f'Bench_{x}', (x, 0, 0.22), (0.10, 0.74, 0.04), bench)
    # Ferryman's pole (long pole resting on stern)
    cyl('Pole', (-0.50, 0.30, 0.40), 0.020, 3.20, wood, verts=8,
        rot=(0, math.radians(25), math.radians(-15)))
    # Canopy structure (small mid-section roof for shade)
    # 4 short posts
    for x_sign in [-1, 1]:
        for y_sign in [-1, 1]:
            cyl(f'CnPost_{x_sign}_{y_sign}', (x_sign*0.30, y_sign*0.30, 0.50), 0.015, 0.50,
                wood, verts=6)
    # Canopy roof (red flat)
    box('Canopy', (0, 0, 0.78), (0.85, 0.80, 0.04), canopy, bevel=0.005)
    # Mooring rope coiled at stern
    for i in range(4):
        torus(f'Coil_{i}', (-1.60, -0.30, 0.24 + i*0.012), 0.07, 0.008, rope,
              maj=14, min_=4)
    # Iron ring on bow (for mooring)
    torus('MoorRing', (1.95, 0, 0.22), 0.030, 0.008, iron, maj=12, min_=4,
          rot=(math.pi/2, 0, 0))
    join_and_export('ferry_boat')


# ─── 8. FISHING BOAT ─────────────────────────────────────────────────
def build_fishing_boat():
    """Small fishing skiff w/ net, basket of fish, single mast."""
    clear_scene()
    wood = pbr('FishWood', (0.55, 0.38, 0.20), 0.92)
    wood_d = pbr('FishWoodD', (0.32, 0.22, 0.14), 0.92)
    net = pbr('FishNet', (0.78, 0.72, 0.55), 0.95)
    cloth = pbr('FishCloth', (0.92, 0.88, 0.72), 0.88)
    basket = pbr('FishBasket', (0.62, 0.42, 0.22), 0.95)
    fish = pbr('FishScale', (0.65, 0.78, 0.85), 0.45)
    rope = pbr('FishRope', (0.78, 0.62, 0.42), 0.95)
    # Hull (mid-sized skiff)
    box('Hull', (0, 0, 0.10), (2.20, 0.65, 0.20), wood, bevel=0.04)
    # Bow point
    cone('BowTip', (1.20, 0, 0.10), 0.20, 0.04, 0.30, wood, verts=8,
         rot=(0, math.pi/2, 0))
    # Stern
    box('Stern', (-1.15, 0, 0.10), (0.18, 0.55, 0.20), wood_d, bevel=0.02)
    # Side rims
    for y_sign in [-1, 1]:
        box(f'Rim_{y_sign}', (0, y_sign*0.32, 0.20), (2.20, 0.05, 0.04), wood_d)
    # 2 benches
    for x in [-0.5, 0.5]:
        box(f'Bench_{x}', (x, 0, 0.20), (0.10, 0.58, 0.03), wood_d)
    # Mast (vertical pole near front)
    cyl('Mast', (0.6, 0, 0.80), 0.022, 1.40, wood, verts=8)
    # Furled sail (cloth wrapped around the mast)
    cyl('Sail', (0.6, 0, 0.95), 0.06, 0.40, cloth, verts=10)
    # Rope from mast top to stern
    cyl('Rigging', (0, 0, 0.80), 0.006, 1.60, rope, verts=4,
        rot=(0, math.radians(35), 0))
    # Fishing net draped over side
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.4, 0.35, 0.18))
    o = bpy.context.active_object; o.name = 'Net'
    o.scale = (0.70, 0.30, 0.005)
    o.rotation_euler = (math.radians(-20), 0, 0)
    o.data.materials.append(net)
    # Basket of fish at stern
    cyl('Basket', (-0.85, 0, 0.25), 0.10, 0.14, basket, verts=14)
    # 3 fish visible in basket
    for i, x in enumerate([-0.92, -0.80, -0.85]):
        uv_sph(f'Fish_{i}', (x, (i-1)*0.04, 0.30), 0.04, fish, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (2.0, 0.6, 0.4)
        o.rotation_euler = (0, 0, math.radians(i*20))
    # Lantern at the bow (for night fishing)
    cyl('Lantern', (1.15, 0, 0.30), 0.04, 0.10, pbr('FishLantern', (0.95, 0.78, 0.45), 0.55,
                                                     emit=(1.0, 0.78, 0.45), emit_strength=1.5),
        verts=10)
    cyl('LantTop', (1.15, 0, 0.36), 0.045, 0.02, wood_d, verts=10)
    join_and_export('fishing_boat')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_rowboat()
    build_palanquin()
    build_ox_cart()
    build_sled()
    build_rickshaw()
    build_raft()
    build_ferry_boat()
    build_fishing_boat()
    print(f'[DONE] pack v12 exported to {OUT_DIR}')
