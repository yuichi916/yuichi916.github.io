"""
Pack v7 — dynamic / atmospheric kit.
Builds:
  butterfly, firefly_cluster, bamboo_grove, wishing_tree, snow_kominka,
  ema_board, daruma, omikuji_box
Run headless:
  blender --background --python build_pack_v7.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(7)


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


# ─── 1. BUTTERFLY ────────────────────────────────────────────────────
def build_butterfly():
    """Small butterfly — body + 4 wing planes (named so Three.js can flap)."""
    clear_scene()
    body = pbr('BFBody', (0.16, 0.10, 0.08), 0.75)
    wing_a = pbr('BFWingA', (0.92, 0.45, 0.18), 0.55,
                 emit=(1.0, 0.55, 0.20), emit_strength=0.30)
    wing_b = pbr('BFWingB', (0.94, 0.86, 0.32), 0.55,
                 emit=(1.0, 0.95, 0.40), emit_strength=0.30)
    # Body
    uv_sph('Body', (0, 0, 0), 0.04, body, segs=10, rings=8)
    o = bpy.context.active_object; o.scale = (0.6, 2.5, 0.6)
    # Head
    uv_sph('Head', (0, 0.10, 0.01), 0.025, body, segs=8, rings=6)
    # Antennae (2 thin tubes curling forward)
    for x_sign in [-1, 1]:
        cyl(f'Ant_{x_sign}', (x_sign*0.012, 0.13, 0.025), 0.003, 0.06, body,
            verts=4, rot=(math.radians(-30), 0, 0))
        uv_sph(f'AntTip_{x_sign}', (x_sign*0.018, 0.16, 0.04), 0.005, body, segs=6, rings=4)
    # Wings — 4 flat ovals attached at hinge, named WingFL / WingFR / WingBL / WingBR
    def wing(name, side, front, mat_):
        # Plane scaled to oval-ish via two stacked ellipses
        bpy.ops.mesh.primitive_plane_add(size=1, location=(side*0.06, front*0.04, 0))
        o = bpy.context.active_object; o.name = name
        o.scale = (0.12, 0.10, 0.005)
        # Slight tilt for stylization
        o.rotation_euler = (0, 0, side * math.radians(-12))
        o.data.materials.append(mat_)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.003
    wing('WingFL', -1,  1, wing_a)
    wing('WingFR',  1,  1, wing_a)
    wing('WingBL', -1, -1, wing_b)
    wing('WingBR',  1, -1, wing_b)
    join_and_export('butterfly')


# ─── 2. FIREFLY CLUSTER ──────────────────────────────────────────────
def build_firefly_cluster():
    """Cluster of 16 emissive specks around a tiny floating glow — a swarm in one GLB."""
    clear_scene()
    body = pbr('FFBody', (0.32, 0.28, 0.18), 0.80)
    glow = pbr('FFGlow', (1.0, 0.95, 0.55), 0.30,
               emit=(1.0, 0.95, 0.50), emit_strength=2.0)
    glow_cool = pbr('FFGlowCool', (0.8, 0.95, 1.0), 0.30,
                    emit=(0.7, 0.95, 1.0), emit_strength=1.6)
    # 16 little firefly bodies in a roughly spherical cluster
    rng = random.Random(7)
    for i in range(16):
        # cluster radius up to 0.6
        r = (rng.random()**0.5) * 0.6
        t = rng.random() * math.pi * 2
        p = (rng.random() - 0.5) * math.pi
        x = r * math.cos(t) * math.cos(p)
        y = r * math.sin(p) + 0.4  # cluster hovers slightly off-ground
        z = r * math.sin(t) * math.cos(p)
        uv_sph(f'FFBody_{i}', (x, y, z), 0.015, body, segs=6, rings=6)
        # glow halo
        m = glow if i % 3 != 0 else glow_cool
        uv_sph(f'FFGlow_{i}', (x, y, z), 0.035, m, segs=8, rings=6)
    join_and_export('firefly_cluster')


# ─── 3. BAMBOO GROVE ─────────────────────────────────────────────────
def build_bamboo_grove():
    """Dense cluster of 9 bamboo stalks with leaves at the top — one prefab."""
    clear_scene()
    stalk = pbr('BambooStalk', (0.38, 0.62, 0.32), 0.85)
    stalk_node = pbr('BambooNode', (0.20, 0.38, 0.18), 0.88)
    leaf = pbr('BambooLeaf', (0.32, 0.62, 0.28), 0.85)
    rng = random.Random(11)
    # Cluster of stalks — different heights, slight tilt
    for i in range(9):
        # Position in a 1.6×1.6 patch
        x = (rng.random() - 0.5) * 1.4
        z = (rng.random() - 0.5) * 1.4
        h = 2.5 + rng.random() * 1.5
        r = 0.045 + rng.random() * 0.020
        tilt_x = (rng.random() - 0.5) * 0.12
        tilt_z = (rng.random() - 0.5) * 0.12
        # Main stalk
        cyl(f'Stalk_{i}', (x, z, h/2), r, h, stalk, verts=10,
            rot=(tilt_x, tilt_z, 0))
        # Bamboo nodes every ~0.5
        nodes = max(3, int(h / 0.5))
        for k in range(nodes):
            zk = (k + 1) * (h / (nodes + 1))
            torus(f'Node_{i}_{k}', (x + tilt_z*(zk-h/2)*0.1, z - tilt_x*(zk-h/2)*0.1, zk),
                  r * 1.15, r * 0.18, stalk_node, maj=10, min_=4)
        # 3-5 leaf clusters near the top
        leaves = 3 + rng.randint(0, 2)
        for k in range(leaves):
            ang = rng.random() * math.pi * 2
            zk = h - 0.1 - k * 0.18
            lx = x + math.cos(ang) * 0.18
            lz = z + math.sin(ang) * 0.18
            bpy.ops.mesh.primitive_plane_add(size=1, location=(lx, lz, zk))
            o = bpy.context.active_object; o.name = f'Leaf_{i}_{k}'
            o.scale = (0.04, 0.22, 0.005)
            o.rotation_euler = (math.radians(rng.random()*40 - 20),
                                math.radians(rng.random()*40 - 20),
                                ang)
            o.data.materials.append(leaf)
    join_and_export('bamboo_grove')


# ─── 4. WISHING TREE ─────────────────────────────────────────────────
def build_wishing_tree():
    """Small sakura tree with multi-coloured wishing strips (tanzaku) tied to branches."""
    clear_scene()
    bark = pbr('WTBark', (0.28, 0.18, 0.12), 0.92)
    leaf = pbr('WTLeaf', (0.96, 0.76, 0.84), 0.80,
               emit=(1.0, 0.8, 0.86), emit_strength=0.18)
    leaf_blossom = pbr('WTBlossom', (1.0, 0.92, 0.95), 0.78,
                       emit=(1.0, 0.94, 0.95), emit_strength=0.20)
    strip_colors = [
        pbr('Tanzaku_red', (0.92, 0.20, 0.16), 0.85),
        pbr('Tanzaku_blue', (0.18, 0.40, 0.85), 0.85),
        pbr('Tanzaku_green', (0.32, 0.72, 0.42), 0.85),
        pbr('Tanzaku_yellow', (0.96, 0.85, 0.30), 0.85),
        pbr('Tanzaku_pink', (0.96, 0.55, 0.78), 0.85),
        pbr('Tanzaku_white', (0.96, 0.94, 0.90), 0.85),
    ]
    # Trunk
    cyl('Trunk', (0, 0, 0.6), 0.12, 1.2, bark, verts=14, bevel=0.01)
    # 4 angled main branches
    for ang_i in range(4):
        ang = ang_i / 4 * math.pi * 2
        sx = math.cos(ang) * 0.15
        sy = math.sin(ang) * 0.15
        cyl(f'Br_{ang_i}', (sx*1.5, sy*1.5, 1.30), 0.06, 0.7, bark, verts=8,
            rot=(math.cos(ang)*0.6, math.sin(ang)*0.6, 0))
        # Smaller twigs from each branch
        for k in range(3):
            t = k / 2.0
            tx = sx * (1.0 + t*1.0); ty = sy * (1.0 + t*1.0); tz = 1.30 + t*0.45
            cyl(f'Tw_{ang_i}_{k}', (tx*1.5, ty*1.5, tz), 0.025, 0.30, bark, verts=6,
                rot=(math.cos(ang)*1.0, math.sin(ang)*1.0, 0))
    # Blossom cloud (a few large spheres for canopy)
    uv_sph('Canopy_C', (0, 0, 1.80), 0.55, leaf, segs=20, rings=14)
    uv_sph('Canopy_A', (-0.45, 0.25, 1.65), 0.40, leaf_blossom, segs=16, rings=12)
    uv_sph('Canopy_B', (0.50, -0.20, 1.70), 0.42, leaf, segs=16, rings=12)
    uv_sph('Canopy_D', (-0.20, -0.45, 1.75), 0.38, leaf_blossom, segs=16, rings=12)
    uv_sph('Canopy_E', (0.30, 0.45, 1.82), 0.40, leaf, segs=16, rings=12)
    # 14 hanging tanzaku strips — small thin planes dangling from canopy
    rng = random.Random(13)
    for i in range(14):
        ang = rng.random() * math.pi * 2
        rad = 0.30 + rng.random() * 0.30
        x = math.cos(ang) * rad
        y = math.sin(ang) * rad
        z = 1.50 + rng.random() * 0.30
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z - 0.20))
        o = bpy.context.active_object; o.name = f'Tanzaku_{i}'
        o.scale = (0.05, 0.005, 0.30)
        o.rotation_euler = (0, math.radians(rng.random()*30 - 15), ang)
        o.data.materials.append(strip_colors[i % len(strip_colors)])
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.003
    join_and_export('wishing_tree')


# ─── 5. SNOW KOMINKA ─────────────────────────────────────────────────
def build_snow_kominka():
    """Variant of the village house with snow-piled roof + icicles + warm window glow."""
    clear_scene()
    wood = pbr('SKWood', (0.30, 0.20, 0.14), 0.92)
    wall = pbr('SKWall', (0.85, 0.78, 0.62), 0.92)
    roof_thatch = pbr('SKThatch', (0.42, 0.30, 0.18), 0.95)
    snow = pbr('SKSnow', (0.96, 0.97, 1.00), 0.55)
    ice = pbr('SKIce', (0.85, 0.92, 1.00), 0.20)
    glow_window = pbr('SKWindow', (1.0, 0.78, 0.42), 0.30,
                      emit=(1.0, 0.78, 0.42), emit_strength=2.5)
    door_wood = pbr('SKDoor', (0.18, 0.12, 0.08), 0.90)
    # Foundation
    box('Found', (0, 0, 0.10), (2.4, 1.8, 0.20), wood, bevel=0.01)
    # Walls
    box('Wall', (0, 0, 0.70), (2.2, 1.6, 1.00), wall, bevel=0.02)
    # Beams (4 horizontal posts)
    for x in [-1.05, 1.05]:
        cyl(f'PostV_{x}', (x, 0, 0.70), 0.06, 1.00, wood, verts=8)
    for y in [-0.75, 0.75]:
        cyl(f'PostV_y_{y}', (0, y, 0.70), 0.06, 1.00, wood, verts=8, rot=(0, 0, math.pi/2))
    # Roof (steep pyramid + side panels for thatch look)
    cone('Roof', (0, 0, 1.60), 1.80, 0.20, 0.95, roof_thatch, verts=4, rot=(0, 0, math.pi/4))
    # Snow on the roof — slightly larger pyramid sitting on top
    cone('RoofSnow', (0, 0, 1.78), 1.95, 0.10, 0.85, snow, verts=4, rot=(0, 0, math.pi/4))
    # Eaves snow piles (4 small drifts at corners of roof base)
    for x in [-1.0, 1.0]:
        for y in [-0.75, 0.75]:
            uv_sph(f'Drift_{x}_{y}', (x, y, 1.22), 0.18, snow, segs=10, rings=8)
            o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.55)
    # 6 icicles hanging from eaves
    rng = random.Random(17)
    for i in range(6):
        ax = (rng.random() - 0.5) * 2.0
        ay = (rng.random() - 0.5) * 1.5 if abs(ax) < 0.9 else (1 if rng.random() > 0.5 else -1) * 0.85
        depth = 0.10 + rng.random() * 0.14
        cone(f'Ice_{i}', (ax, ay, 1.16 - depth/2), 0.025, 0.0, depth, ice, verts=6,
             rot=(math.pi, 0, 0))
    # Glowing window
    box('Window', (0.55, -0.81, 0.85), (0.50, 0.04, 0.32), glow_window)
    # Door
    box('Door', (-0.55, -0.81, 0.50), (0.36, 0.04, 0.80), door_wood)
    # Ground snow patch underneath
    cyl('GroundSnow', (0, 0, 0.005), 1.7, 0.02, snow, verts=24)
    join_and_export('snow_kominka')


# ─── 6. EMA BOARD (Wishing Plaque Rack) ──────────────────────────────
def build_ema_board():
    """Wooden frame holding 12 small wishing plaques (ema) tied with strings."""
    clear_scene()
    frame = pbr('EmaFrame', (0.48, 0.30, 0.18), 0.92)
    ema_a = pbr('EmaA', (0.92, 0.85, 0.58), 0.85)
    ema_b = pbr('EmaB', (0.92, 0.50, 0.30), 0.85)
    ema_c = pbr('EmaC', (0.32, 0.60, 0.45), 0.85)
    ink = pbr('EmaInk', (0.10, 0.08, 0.06), 0.92)
    string = pbr('EmaString', (0.92, 0.92, 0.88), 0.95)
    # Two vertical posts + top crossbar
    cyl('LPost', (-0.90, 0, 0.85), 0.05, 1.70, frame, verts=10)
    cyl('RPost', ( 0.90, 0, 0.85), 0.05, 1.70, frame, verts=10)
    cyl('Top',   ( 0,    0, 1.65), 0.06, 1.90, frame, verts=10, rot=(0, math.pi/2, 0))
    # 12 ema plaques in 2 rows × 6 columns
    palette = [ema_a, ema_b, ema_c]
    rng = random.Random(19)
    for col in range(6):
        for row in range(2):
            x = -0.75 + col * 0.30
            z = 1.30 - row * 0.32
            m = palette[(col + row) % 3]
            # Pentagon-ish plaque approximated as a tilted thin box
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -0.04, z))
            o = bpy.context.active_object; o.name = f'Ema_{col}_{row}'
            o.scale = (0.13, 0.018, 0.10)
            o.rotation_euler = (math.radians(rng.random()*8 - 4), 0, math.radians(rng.random()*8 - 4))
            o.data.materials.append(m)
            # Top peak (small tri prism on top)
            cone(f'EmaTop_{col}_{row}', (x, -0.04, z + 0.11),
                 0.13, 0.0, 0.05, m, verts=3, rot=(math.pi/2, 0, 0))
            # Ink character (dark box on the front)
            box(f'Ink_{col}_{row}', (x, -0.05, z), (0.06, 0.005, 0.05), ink)
            # String from plaque to crossbar
            cyl(f'Str_{col}_{row}', (x, -0.02, (1.65 + z)/2), 0.005, 1.65 - z, string, verts=4)
    join_and_export('ema_board')


# ─── 7. DARUMA ───────────────────────────────────────────────────────
def build_daruma():
    """Stylized red daruma doll — round body, painted face, gold rim."""
    clear_scene()
    red = pbr('DarumaRed', (0.85, 0.16, 0.12), 0.55)
    gold = pbr('DarumaGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    white = pbr('DarumaWhite', (0.96, 0.92, 0.85), 0.55)
    black = pbr('DarumaBlack', (0.10, 0.08, 0.06), 0.50)
    skin = pbr('DarumaSkin', (0.88, 0.72, 0.55), 0.65)
    # Body — egg shape
    uv_sph('Body', (0, 0, 0.22), 0.22, red, segs=24, rings=18)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.15)
    # Gold rim around bottom
    torus('Rim', (0, 0, 0.05), 0.20, 0.012, gold, maj=24, min_=8)
    # White face oval (front of body)
    uv_sph('Face', (0, -0.10, 0.28), 0.13, white, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 0.30, 1.05)
    # Painted face — eyes (one filled = wish made), brows, mouth
    uv_sph('EyeL', (-0.05, -0.21, 0.32), 0.015, black, segs=8, rings=6)
    uv_sph('EyeR', ( 0.05, -0.21, 0.32), 0.015, white, segs=8, rings=6)
    # Brows (thick black lines as small boxes)
    box('BrowL', (-0.05, -0.21, 0.37), (0.04, 0.004, 0.012), black,
        rot=(0, 0, math.radians(8)))
    box('BrowR', ( 0.05, -0.21, 0.37), (0.04, 0.004, 0.012), black,
        rot=(0, 0, math.radians(-8)))
    # Mouth — small dark curve via flat cylinder slice
    box('Mouth', (0, -0.225, 0.24), (0.04, 0.004, 0.006), black)
    # Gold curls on side (eyebrows/whiskers)
    for x_sign in [-1, 1]:
        torus(f'Whisker_{x_sign}', (x_sign*0.18, -0.10, 0.28), 0.03, 0.008,
              gold, maj=12, min_=4, rot=(0, math.radians(x_sign*30), 0))
    join_and_export('daruma')


# ─── 8. OMIKUJI BOX ──────────────────────────────────────────────────
def build_omikuji_box():
    """Hexagonal wooden box for paper fortunes — used in shrine scenes."""
    clear_scene()
    wood = pbr('OmiWood', (0.42, 0.28, 0.16), 0.90)
    wood_dark = pbr('OmiWoodDark', (0.22, 0.14, 0.08), 0.92)
    paper = pbr('OmiPaper', (0.95, 0.92, 0.85), 0.85)
    red = pbr('OmiRed', (0.85, 0.16, 0.12), 0.70)
    # Hex prism (cylinder with 6 sides)
    cyl('BoxBody', (0, 0, 0.36), 0.20, 0.72, wood, verts=6)
    # Cap
    cyl('Cap', (0, 0, 0.74), 0.21, 0.04, wood_dark, verts=6)
    # Hole on top
    cyl('Hole', (0, 0, 0.76), 0.04, 0.04, wood_dark, verts=12)
    # Decorative band 1/3 from top
    torus('Band1', (0, 0, 0.55), 0.205, 0.015, wood_dark, maj=24, min_=6)
    torus('Band2', (0, 0, 0.20), 0.205, 0.015, wood_dark, maj=24, min_=6)
    # Red cord wrapping the top
    torus('Cord', (0, 0, 0.78), 0.07, 0.012, red, maj=12, min_=6)
    # 2 omikuji papers sticking out of the hole
    cyl('Paper1', (0.015, 0.005, 0.86), 0.012, 0.18, paper, verts=4, rot=(0.1, 0.05, 0))
    cyl('Paper2', (-0.015, 0.010, 0.84), 0.012, 0.16, paper, verts=4, rot=(-0.05, -0.1, 0))
    # Slot for ink character on side (small dark plate)
    box('Plate', (0.18, 0, 0.40), (0.005, 0.06, 0.18), wood_dark, rot=(0, math.pi/2, 0))
    # Red ink stamp
    box('Stamp', (0.182, 0, 0.40), (0.003, 0.04, 0.12), red, rot=(0, math.pi/2, 0))
    join_and_export('omikuji_box')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_butterfly()
    build_firefly_cluster()
    build_bamboo_grove()
    build_wishing_tree()
    build_snow_kominka()
    build_ema_board()
    build_daruma()
    build_omikuji_box()
    print(f'[DONE] pack v7 exported to {OUT_DIR}')
