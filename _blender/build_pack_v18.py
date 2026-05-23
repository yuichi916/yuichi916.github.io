"""
Pack v18 — merchant district.
Builds:
  shop_facade, kanban_sign, kimono_rack, kimono_mannequin,
  paper_screen_window, oil_lamp, charcoal_brazier, soba_bowls
Run headless:
  blender --background --python build_pack_v18.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(18)


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


# ─── 1. SHOP FACADE (Edo-period machiya storefront) ──────────────────
def build_shop_facade():
    """Edo-period machiya merchant facade — koshi lattice front, half-curtain noren, sign."""
    clear_scene()
    wall = pbr('SfWall', (0.82, 0.72, 0.55), 0.92)
    wood = pbr('SfWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('SfWoodD', (0.22, 0.14, 0.08), 0.92)
    roof_tile = pbr('SfRoofTile', (0.18, 0.20, 0.22), 0.65)
    noren = pbr('SfNoren', (0.18, 0.30, 0.55), 0.85)
    ink = pbr('SfInk', (0.95, 0.92, 0.85), 0.85)
    paper = pbr('SfPaper', (0.95, 0.85, 0.55), 0.55,
                emit=(1.0, 0.85, 0.55), emit_strength=0.8)
    # Foundation
    box('Found', (0, 0, 0.15), (3.20, 1.80, 0.30), wood_d, bevel=0.01)
    # Walls (back + side suggestions)
    box('BackWall', (0, -0.88, 1.10), (3.10, 0.06, 1.70), wall, bevel=0.005)
    box('SideL', (-1.55, 0, 1.10), (0.06, 1.80, 1.70), wall, bevel=0.005)
    box('SideR', ( 1.55, 0, 1.10), (0.06, 1.80, 1.70), wall, bevel=0.005)
    # Floor inside (raised tatami platform)
    box('Floor', (0, -0.30, 0.32), (2.80, 1.20, 0.04), wood, bevel=0.005)
    # Koshi lattice front (vertical wood slats across front opening)
    for i in range(16):
        x = -1.40 + i * 0.187
        cyl(f'Lat_{i}', (x, 0.85, 1.20), 0.015, 1.40, wood_d, verts=6)
    # Horizontal lattice bars (3 across the slats)
    for k in range(3):
        z = 0.60 + k * 0.50
        box(f'LatH_{k}', (0, 0.85, z), (2.90, 0.04, 0.025), wood_d)
    # Eave (sloped roof above front)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.55, 2.10))
    o = bpy.context.active_object; o.name = 'EaveF'
    o.scale = (3.40, 0.005, 1.05)
    o.rotation_euler = (math.radians(25), 0, 0)
    o.data.materials.append(roof_tile)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.02
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.55, 2.10))
    o = bpy.context.active_object; o.name = 'EaveB'
    o.scale = (3.40, 0.005, 1.05)
    o.rotation_euler = (math.radians(-25), 0, 0)
    o.data.materials.append(roof_tile)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.02
    # Roof ridge
    box('Ridge', (0, 0, 2.42), (3.50, 0.20, 0.06), wood_d)
    # Hanging noren curtain (blue) across the front
    box('NorenL', (-0.50, 0.92, 1.60), (0.80, 0.005, 0.50), noren)
    box('NorenR', ( 0.50, 0.92, 1.60), (0.80, 0.005, 0.50), noren)
    # 2 white characters on noren
    box('NorenInkL', (-0.50, 0.918, 1.60), (0.20, 0.005, 0.25), ink)
    box('NorenInkR', ( 0.50, 0.918, 1.60), (0.20, 0.005, 0.25), ink)
    # 2 paper lanterns hanging at eaves
    for x_sign in [-1, 1]:
        uv_sph(f'LantBody_{x_sign}', (x_sign*1.20, 0.65, 1.92), 0.14, paper, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
        cyl(f'LantCapT_{x_sign}', (x_sign*1.20, 0.65, 2.04), 0.05, 0.02, wood_d, verts=10)
        cyl(f'LantCapB_{x_sign}', (x_sign*1.20, 0.65, 1.80), 0.05, 0.02, wood_d, verts=10)
        cyl(f'LantCord_{x_sign}', (x_sign*1.20, 0.65, 2.12), 0.005, 0.16, wood_d, verts=4)
    # Sign (wooden plaque above noren)
    box('SignPlaque', (0, 0.96, 1.95), (1.20, 0.04, 0.20), wood, bevel=0.005)
    box('SignInk', (0, 0.958, 1.95), (0.95, 0.005, 0.12), wood_d)
    # Open shoji on the side (visible paper panel)
    box('Shoji', (-1.30, 0.85, 1.20), (0.30, 0.04, 0.60), paper, bevel=0.005)
    join_and_export('shop_facade')


# ─── 2. KANBAN SIGN (Edo wooden shop sign) ───────────────────────────
def build_kanban_sign():
    """Tall wooden sign on a stand w/ vertical text panel + decorative metal hardware."""
    clear_scene()
    wood = pbr('KsWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('KsWoodD', (0.22, 0.14, 0.08), 0.92)
    panel = pbr('KsPanel', (0.95, 0.85, 0.55), 0.65)
    ink = pbr('KsInk', (0.10, 0.08, 0.06), 0.85)
    metal = pbr('KsMetal', (0.65, 0.55, 0.30), 0.40, metal=0.55)
    red = pbr('KsRed', (0.85, 0.16, 0.10), 0.65)
    # Heavy base
    box('Base', (0, 0, 0.08), (0.45, 0.20, 0.15), wood_d, bevel=0.01)
    # Vertical post
    cyl('Post', (0, 0, 0.90), 0.04, 1.50, wood_d, verts=12)
    # Decorative metal cap on post top
    uv_sph('PostCap', (0, 0, 1.66), 0.05, metal, segs=14, rings=10)
    cone('PostFinial', (0, 0, 1.75), 0.04, 0.0, 0.10, metal, verts=8)
    # Hanging cross arm
    box('Arm', (0.08, 0, 1.55), (0.20, 0.04, 0.04), wood)
    # Decorative iron hangers (2 small loops)
    for x_off in [-0.06, 0.10]:
        torus(f'Hang_{x_off}', (x_off + 0.10, 0, 1.45), 0.018, 0.004, metal, maj=12, min_=4,
              rot=(math.pi/2, 0, 0))
    # Main wooden sign panel
    box('Panel', (0.20, 0, 1.00), (0.04, 0.30, 0.90), panel, bevel=0.005)
    # Sign frame (darker outer trim)
    for sx, sy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        if abs(sx) > abs(sy):
            box(f'Frame_x_{sx}', (0.20, sx*0.16, 1.00), (0.05, 0.02, 0.90), wood_d,
                rot=(0, 0, 0))
        else:
            box(f'Frame_y_{sy}', (0.20, 0, 1.00 + sy*0.45), (0.05, 0.32, 0.02), wood_d)
    # 3 ink characters running vertically on the panel
    for i, z in enumerate([1.30, 1.00, 0.70]):
        box(f'Char_{i}', (0.215, 0, z), (0.005, 0.18, 0.22), ink)
    # Red stamp (small red square at bottom of sign)
    box('Stamp', (0.215, 0, 0.55), (0.005, 0.06, 0.06), red)
    # Decorative ribbons hanging from the arm
    for i, x_off in enumerate([0.10, 0.20]):
        cyl(f'Ribbon_{i}', (0.20, x_off, 1.40), 0.004, 0.18, red, verts=4)
        uv_sph(f'RibbonEnd_{i}', (0.20, x_off, 1.30), 0.012, red, segs=8, rings=6)
    join_and_export('kanban_sign')


# ─── 3. KIMONO RACK ──────────────────────────────────────────────────
def build_kimono_rack():
    """T-shaped wooden rack w/ 3 folded kimonos draped over the crossbar."""
    clear_scene()
    wood = pbr('KrWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('KrWoodD', (0.22, 0.14, 0.08), 0.92)
    kimono_r = pbr('KrKimR', (0.85, 0.20, 0.30), 0.85)
    kimono_b = pbr('KrKimB', (0.20, 0.30, 0.55), 0.85)
    kimono_g = pbr('KrKimG', (0.32, 0.55, 0.30), 0.85)
    obi = pbr('KrObi', (0.85, 0.65, 0.18), 0.85)
    pattern = pbr('KrPattern', (0.95, 0.92, 0.85), 0.85)
    # Base
    box('Base', (0, 0, 0.04), (0.40, 0.30, 0.08), wood_d, bevel=0.005)
    # Vertical post
    cyl('Post', (0, 0, 0.95), 0.025, 1.75, wood, verts=10)
    # Horizontal crossbar
    cyl('Cross', (0, 0, 1.80), 0.020, 1.10, wood, verts=8, rot=(math.pi/2, 0, 0))
    # Decorative end caps on crossbar
    for y_sign in [-1, 1]:
        uv_sph(f'CrossCap_{y_sign}', (0, y_sign*0.55, 1.80), 0.030, wood_d, segs=10, rings=8)
    # 3 kimonos draped (each a wide tapered cone w/ obi belt)
    kimono_mats = [kimono_r, kimono_b, kimono_g]
    positions = [-0.30, 0.0, 0.30]
    for i, y in enumerate(positions):
        # Kimono body — wide flared shape (tall cone)
        cone(f'Kim_{i}', (0, y, 1.10), 0.18, 0.05, 1.20, kimono_mats[i], verts=14)
        # Sleeves (cylinders flaring outward at top)
        for x_sign in [-1, 1]:
            cyl(f'Sleeve_{i}_{x_sign}', (x_sign*0.18, y, 1.60), 0.10, 0.30, kimono_mats[i], verts=10,
                rot=(0, 0, x_sign*math.radians(-12)))
            # Sleeve cuff (white)
            box(f'Cuff_{i}_{x_sign}', (x_sign*0.30, y, 1.50), (0.04, 0.10, 0.06), pattern)
        # Obi belt (yellow horizontal band)
        cyl(f'Obi_{i}', (0, y, 1.05), 0.182, 0.10, obi, verts=14)
        # Pattern accents (3 small white dots on each kimono)
        for k in range(4):
            ang = k / 4 * math.pi * 2
            uv_sph(f'Dot_{i}_{k}', (math.sin(ang)*0.15, y + math.cos(ang)*0.05, 0.85),
                   0.025, pattern, segs=8, rings=6)
    join_and_export('kimono_rack')


# ─── 4. KIMONO MANNEQUIN ─────────────────────────────────────────────
def build_kimono_mannequin():
    """Standing torso form on stand wearing a single kimono w/ sash + simple head form."""
    clear_scene()
    wood = pbr('KmWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('KmWoodD', (0.22, 0.14, 0.08), 0.92)
    body = pbr('KmBody', (0.95, 0.88, 0.78), 0.85)
    kimono_main = pbr('KmKimMain', (0.18, 0.30, 0.55), 0.85)
    kimono_inner = pbr('KmKimInner', (0.95, 0.92, 0.85), 0.85)
    obi = pbr('KmObi', (0.85, 0.18, 0.14), 0.65)
    obi_d = pbr('KmObiD', (0.85, 0.65, 0.18), 0.50, metal=0.4)
    pattern = pbr('KmPattern', (0.95, 0.78, 0.45), 0.85)
    # Base
    cyl('Base', (0, 0, 0.04), 0.18, 0.08, wood_d, verts=20)
    # Vertical post (hidden inside mannequin)
    cyl('Post', (0, 0, 0.50), 0.025, 0.90, wood, verts=8)
    # Torso form — vase shape (egg widening upward)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.20, location=(0, 0, 0.80),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Torso'
    o.scale = (1.1, 0.7, 1.6)
    o.data.materials.append(kimono_main)
    # Inner white collar
    box('Collar', (0, 0.10, 1.15), (0.16, 0.05, 0.06), kimono_inner)
    # Kimono opens at front — vertical inner panel visible
    box('Inner', (0, 0.135, 0.85), (0.08, 0.005, 0.45), kimono_inner)
    # Obi sash (wide red band at waist)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.21, location=(0, 0, 0.75),
                                          segments=20, ring_count=10)
    o = bpy.context.active_object; o.name = 'Obi'
    o.scale = (1.15, 0.78, 0.4)
    o.data.materials.append(obi)
    # Obi bow at the back (large box behind)
    box('ObiBow', (0, -0.14, 0.80), (0.20, 0.06, 0.18), obi, bevel=0.005)
    # Obi center clasp (decorative)
    box('ObiClasp', (0, 0.14, 0.75), (0.10, 0.005, 0.06), obi_d)
    # Pattern flowers on kimono (5 small dots scattered)
    rng = random.Random(181)
    for i in range(8):
        ang = rng.random() * math.pi * 2
        zk = 0.40 + rng.random() * 0.50
        r = 0.20 * (1 - abs(zk - 0.80) * 0.4)
        uv_sph(f'Flower_{i}', (math.sin(ang)*r, 0.135 * math.cos(ang)*0.5,
                                zk if abs(math.cos(ang)) > 0.2 else 0.85 - 0.5),
               0.025, pattern, segs=8, rings=6)
    # Skirt — wide cone bottom of kimono
    cone('Skirt', (0, 0, 0.30), 0.30, 0.18, 0.40, kimono_main, verts=18)
    # Sleeves (flat boxes hanging on sides)
    for x_sign in [-1, 1]:
        box(f'Sleeve_{x_sign}', (x_sign*0.30, 0, 0.90), (0.18, 0.06, 0.38), kimono_main,
            bevel=0.005)
        box(f'SleeveCuff_{x_sign}', (x_sign*0.30, 0, 0.71), (0.18, 0.06, 0.06), kimono_inner)
    # Wooden head ball
    uv_sph('Head', (0, 0, 1.32), 0.10, body, segs=14, rings=10)
    # Hair (top knot)
    uv_sph('HairBack', (0, -0.04, 1.34), 0.11, pbr('KmHair', (0.10, 0.08, 0.06), 0.55),
           segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 0.85, 1.0)
    cyl('Topknot', (0, -0.02, 1.42), 0.025, 0.06, pbr('KmHair2', (0.10, 0.08, 0.06), 0.55),
        verts=8)
    join_and_export('kimono_mannequin')


# ─── 5. PAPER SCREEN WINDOW ──────────────────────────────────────────
def build_paper_screen_window():
    """Wall-mounted rectangular shoji window — wooden frame + grid + emissive paper."""
    clear_scene()
    wood = pbr('PsWood', (0.32, 0.20, 0.12), 0.92)
    wood_d = pbr('PsWoodD', (0.22, 0.14, 0.08), 0.92)
    paper = pbr('PsPaper', (0.95, 0.85, 0.55), 0.55,
                emit=(1.0, 0.85, 0.55), emit_strength=2.0)
    grid = pbr('PsGrid', (0.22, 0.14, 0.08), 0.90)
    # Outer frame (rectangular, 1.4×0.9)
    box('FrameTop', (0, 0, 0.95), (1.40, 0.06, 0.06), wood_d)
    box('FrameBot', (0, 0, 0.05), (1.40, 0.06, 0.06), wood_d)
    box('FrameL', (-0.67, 0, 0.50), (0.06, 0.06, 0.95), wood_d)
    box('FrameR', ( 0.67, 0, 0.50), (0.06, 0.06, 0.95), wood_d)
    # Paper panel (set slightly behind frame)
    box('Paper', (0, -0.02, 0.50), (1.30, 0.005, 0.90), paper)
    # Inner grid bars — horizontal (5) + vertical (8)
    for k in range(5):
        z = 0.10 + k * 0.20
        box(f'GridH_{k}', (0, -0.022, z), (1.32, 0.005, 0.012), grid)
    for k in range(7):
        x = -0.585 + k * 0.195
        box(f'GridV_{k}', (x, -0.022, 0.50), (0.012, 0.005, 0.92), grid)
    # Decorative corner blocks
    for x_sign in [-1, 1]:
        for z_pos in [0.05, 0.95]:
            box(f'Corner_{x_sign}_{z_pos}', (x_sign*0.67, 0, z_pos), (0.08, 0.075, 0.08), wood)
    # Window sill (small ledge)
    box('Sill', (0, -0.04, -0.01), (1.50, 0.16, 0.04), wood)
    join_and_export('paper_screen_window')


# ─── 6. OIL LAMP (andon) ─────────────────────────────────────────────
def build_oil_lamp():
    """Square Edo-style floor oil lamp (andon) — square shoji column + base + glow."""
    clear_scene()
    wood = pbr('OlWood', (0.32, 0.20, 0.12), 0.92)
    wood_d = pbr('OlWoodD', (0.22, 0.14, 0.08), 0.92)
    paper = pbr('OlPaper', (0.95, 0.78, 0.42), 0.55,
                emit=(1.0, 0.78, 0.40), emit_strength=2.5)
    grid = pbr('OlGrid', (0.22, 0.14, 0.08), 0.90)
    flame = pbr('OlFlame', (1.0, 0.55, 0.20), 0.30,
                emit=(1.0, 0.55, 0.15), emit_strength=4.0)
    metal = pbr('OlMetal', (0.18, 0.16, 0.14), 0.55, metal=0.55)
    # Wide base
    box('Base', (0, 0, 0.04), (0.30, 0.30, 0.08), wood_d, bevel=0.005)
    box('BaseTop', (0, 0, 0.085), (0.32, 0.32, 0.012), wood)
    # 4 corner posts
    for x in [-0.12, 0.12]:
        for y in [-0.12, 0.12]:
            cyl(f'Post_{x}_{y}', (x, y, 0.50), 0.015, 0.80, wood, verts=6)
    # 4 paper panels w/ grid
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(sx) > abs(sy):
            box(f'Panel_x_{sx}', (sx*0.115, 0, 0.50), (0.005, 0.24, 0.80), paper)
            # Grid bars on this panel — 3 horizontal + 2 vertical
            for k in range(4):
                zk = 0.20 + k * 0.20
                box(f'GridH_x_{sx}_{k}', (sx*0.118, 0, zk), (0.005, 0.24, 0.006), grid)
            for k in range(2):
                yk = -0.06 + k * 0.12
                box(f'GridV_x_{sx}_{k}', (sx*0.118, yk, 0.50), (0.005, 0.006, 0.80), grid)
        else:
            box(f'Panel_y_{sy}', (0, sy*0.115, 0.50), (0.24, 0.005, 0.80), paper)
            for k in range(4):
                zk = 0.20 + k * 0.20
                box(f'GridH_y_{sy}_{k}', (0, sy*0.118, zk), (0.24, 0.005, 0.006), grid)
            for k in range(2):
                xk = -0.06 + k * 0.12
                box(f'GridV_y_{sy}_{k}', (xk, sy*0.118, 0.50), (0.006, 0.005, 0.80), grid)
    # Top cap
    box('Cap', (0, 0, 0.94), (0.30, 0.30, 0.025), wood_d)
    box('CapTop', (0, 0, 0.97), (0.20, 0.20, 0.04), wood)
    # Small smoke vent on top
    cyl('Vent', (0, 0, 1.005), 0.04, 0.020, metal, verts=12)
    # Tiny inner flame (small bright sphere visible through paper)
    uv_sph('Flame', (0, 0, 0.50), 0.04, flame, segs=10, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.6)
    join_and_export('oil_lamp')


# ─── 7. CHARCOAL BRAZIER (hibachi) ───────────────────────────────────
def build_charcoal_brazier():
    """Wooden hibachi w/ ceramic interior + glowing charcoal + iron kettle + tongs."""
    clear_scene()
    wood = pbr('CbWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('CbWoodD', (0.22, 0.14, 0.08), 0.92)
    ceramic = pbr('CbCeramic', (0.25, 0.20, 0.18), 0.55)
    ash = pbr('CbAsh', (0.65, 0.62, 0.55), 0.92)
    charcoal_b = pbr('CbCharcoal', (0.10, 0.08, 0.06), 0.95)
    charcoal_g = pbr('CbGlow', (1.0, 0.55, 0.15), 0.30,
                     emit=(1.0, 0.55, 0.15), emit_strength=4.0)
    iron = pbr('CbIron', (0.18, 0.16, 0.14), 0.55, metal=0.65)
    handle = pbr('CbHandle', (0.55, 0.42, 0.20), 0.85)
    # Outer wooden box (square)
    box('OuterT', (0, 0, 0.20), (0.45, 0.45, 0.40), wood, bevel=0.01)
    # Wood grain accent (darker stripes on top)
    for i in range(3):
        box(f'Plank_{i}', (-0.15 + i*0.15, 0, 0.405), (0.10, 0.45, 0.005), wood_d)
    # Lip rim around the top (lighter band)
    box('Rim', (0, 0, 0.385), (0.47, 0.47, 0.02), wood_d)
    # Inner ceramic well (slightly smaller box w/ open top)
    box('CeramicWell', (0, 0, 0.30), (0.36, 0.36, 0.20), ceramic, bevel=0.005)
    # Ash bed
    box('Ash', (0, 0, 0.385), (0.34, 0.34, 0.005), ash)
    # Charcoal pieces (6 dark lumps + 3 glowing embers)
    rng = random.Random(191)
    for i in range(7):
        x = (rng.random() - 0.5) * 0.28
        y = (rng.random() - 0.5) * 0.28
        z = 0.395 + rng.random() * 0.005
        m = charcoal_b if i < 5 else charcoal_g
        uv_sph(f'Coal_{i}', (x, y, z), 0.035 + rng.random()*0.010, m, segs=8, rings=6)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.65)
    # Iron kettle on top (large pot)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0, 0, 0.50),
                                          segments=20, ring_count=14)
    o = bpy.context.active_object; o.name = 'Kettle'
    o.scale = (1.0, 1.0, 0.65)
    o.data.materials.append(iron)
    # Kettle lid
    cyl('KettleLid', (0, 0, 0.61), 0.10, 0.020, iron, verts=14)
    uv_sph('KettleKnob', (0, 0, 0.625), 0.020, iron, segs=10, rings=8)
    # Kettle spout
    cyl('KettleSpout', (0.18, 0, 0.50), 0.025, 0.10, iron, verts=10,
        rot=(0, math.radians(-60), 0))
    # Bamboo handle (curved bar arching over kettle)
    torus('KettleHandle', (0, 0, 0.64), 0.13, 0.012, handle, maj=14, min_=6,
          rot=(math.pi/2, 0, 0))
    # 2 iron tongs in the ash
    cyl('TongL', (-0.05, -0.20, 0.42), 0.008, 0.16, iron, verts=6,
        rot=(math.radians(70), 0, 0))
    cyl('TongR', (-0.05, -0.20, 0.42), 0.008, 0.16, iron, verts=6,
        rot=(math.radians(70), 0, math.radians(10)))
    join_and_export('charcoal_brazier')


# ─── 8. SOBA BOWLS ───────────────────────────────────────────────────
def build_soba_bowls():
    """2 lacquer soba bowls w/ noodles + dipping cup + chopsticks + grated daikon."""
    clear_scene()
    lacquer = pbr('SbLacquer', (0.18, 0.10, 0.08), 0.30)
    lacquer_red = pbr('SbLacquerR', (0.55, 0.10, 0.08), 0.40)
    wood = pbr('SbWood', (0.42, 0.28, 0.16), 0.92)
    noodle = pbr('SbNoodle', (0.85, 0.78, 0.55), 0.80)
    soba = pbr('SbSoba', (0.62, 0.50, 0.32), 0.80)
    broth = pbr('SbBroth', (0.22, 0.15, 0.08), 0.40)
    daikon = pbr('SbDaikon', (0.96, 0.92, 0.85), 0.55)
    onion = pbr('SbOnion', (0.42, 0.78, 0.32), 0.85)
    tempura = pbr('SbTempura', (0.95, 0.65, 0.20), 0.75)
    # Wooden tray
    box('Tray', (0, 0, 0.025), (0.65, 0.40, 0.05), wood, bevel=0.005)
    # Tray rim
    box('TrayRim', (0, 0, 0.055), (0.67, 0.42, 0.012), pbr('SbRim', (0.22, 0.14, 0.08), 0.90))
    # 2 large bowls of soba noodles (left + right)
    for j, x in enumerate([-0.20, 0.20]):
        # Bowl
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10, location=(x, 0, 0.13),
                                              segments=20, ring_count=12)
        o = bpy.context.active_object; o.name = f'Bowl_{j}'
        o.scale = (1.0, 1.0, 0.55)
        o.data.materials.append(lacquer if j == 0 else lacquer_red)
        # Bowl rim
        torus(f'BowlRim_{j}', (x, 0, 0.165), 0.10, 0.006, lacquer_red if j == 0 else lacquer,
              maj=18, min_=4)
        # Soba noodles inside (small flat torus + spiral suggestions)
        cyl(f'Noodles_{j}', (x, 0, 0.16), 0.085, 0.010, noodle, verts=18)
        # 4 noodle strand suggestions (small thin curls)
        for k in range(4):
            ang = k / 4 * math.pi * 2
            cyl(f'Strand_{j}_{k}', (x + math.cos(ang)*0.04, math.sin(ang)*0.04, 0.17),
                0.005, 0.04, soba, verts=4, rot=(math.radians(20), 0, ang))
    # Dipping cup (small black lacquer)
    cyl('DipCup', (0, 0, 0.10), 0.05, 0.05, lacquer, verts=14)
    cyl('Broth', (0, 0, 0.115), 0.045, 0.01, broth, verts=14)
    # Grated daikon dish on the side
    cyl('DaikonDish', (-0.15, 0.15, 0.08), 0.06, 0.018, lacquer_red, verts=14)
    uv_sph('DaikonPile', (-0.15, 0.15, 0.10), 0.04, daikon, segs=12, rings=8)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.4)
    # Small dish of green onion
    cyl('OnionDish', (0.15, 0.15, 0.08), 0.05, 0.015, lacquer_red, verts=12)
    uv_sph('OnionPile', (0.15, 0.15, 0.095), 0.025, onion, segs=10, rings=6)
    # 2 tempura pieces on a side dish
    cyl('TempuraDish', (0, -0.15, 0.08), 0.06, 0.015, wood, verts=14)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.030, location=(-0.015, -0.155, 0.10),
                                          segments=10, ring_count=8)
    o = bpy.context.active_object; o.name = 'Tempura1'
    o.scale = (1.4, 1.0, 0.55)
    o.data.materials.append(tempura)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.030, location=(0.020, -0.150, 0.10),
                                          segments=10, ring_count=8)
    o = bpy.context.active_object; o.name = 'Tempura2'
    o.scale = (1.4, 1.0, 0.55)
    o.data.materials.append(tempura)
    # Chopsticks (2 sticks)
    cyl('Chop1', (0.30, -0.05, 0.07), 0.005, 0.30, wood, verts=4,
        rot=(0, math.pi/2, math.radians(8)))
    cyl('Chop2', (0.30, -0.04, 0.075), 0.005, 0.30, wood, verts=4,
        rot=(0, math.pi/2, math.radians(5)))
    # Chopstick rest
    box('ChopRest', (0.30, -0.05, 0.07), (0.05, 0.020, 0.012), lacquer_red)
    join_and_export('soba_bowls')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_shop_facade()
    build_kanban_sign()
    build_kimono_rack()
    build_kimono_mannequin()
    build_paper_screen_window()
    build_oil_lamp()
    build_charcoal_brazier()
    build_soba_bowls()
    print(f'[DONE] pack v18 exported to {OUT_DIR}')
