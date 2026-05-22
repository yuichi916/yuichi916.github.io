"""
Pack v17 — tools / armor / craft.
Builds:
  samurai_armor_stand, katana_rack, farmer_tools, blacksmith_anvil,
  scarecrow, fishing_rod, abacus, shoji_lamp
Run headless:
  blender --background --python build_pack_v17.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(17)


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


# ─── 1. SAMURAI ARMOR STAND ──────────────────────────────────────────
def build_samurai_armor_stand():
    """Display stand w/ full samurai armor — helmet (kabuto), torso (do), arms, skirt."""
    clear_scene()
    lacquer = pbr('SaLacquer', (0.10, 0.06, 0.04), 0.30)
    red = pbr('SaRed', (0.78, 0.18, 0.14), 0.45)
    gold = pbr('SaGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    cord = pbr('SaCord', (0.85, 0.65, 0.18), 0.85)
    cord_orange = pbr('SaCordO', (0.92, 0.55, 0.18), 0.85)
    wood = pbr('SaWood', (0.32, 0.20, 0.12), 0.92)
    silver = pbr('SaSilver', (0.65, 0.62, 0.60), 0.40, metal=0.5)
    face = pbr('SaFace', (0.18, 0.10, 0.06), 0.55)
    # Wooden display stand
    box('Stand', (0, 0, 0.05), (0.40, 0.30, 0.10), wood, bevel=0.005)
    # Central pole
    cyl('Pole', (0, 0, 0.85), 0.025, 1.50, wood, verts=8)
    # Skirt / kusazuri (hanging plates of armor below torso)
    for i in range(7):
        ang = -math.pi/2 + (i / 6) * math.pi  # spans 180° front
        x = math.cos(ang) * 0.28
        y = math.sin(ang) * 0.28
        box(f'Skirt_{i}', (x, y, 0.50), (0.12, 0.04, 0.30), red,
            rot=(0, 0, ang + math.pi/2))
        # Gold rivets
        for k in range(3):
            uv_sph(f'SkirtRivet_{i}_{k}', (x*1.02, y*1.02, 0.40 + k*0.10), 0.008, gold,
                   segs=6, rings=4)
    # Torso (do) — barrel-like body
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.20, location=(0, 0, 0.95),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Torso'
    o.scale = (1.3, 0.85, 1.0)
    o.data.materials.append(red)
    # Torso plates (horizontal armor bands w/ gold cord lacing)
    for i, z in enumerate([0.82, 0.92, 1.02, 1.12]):
        torus(f'Band_{i}', (0, 0, z), 0.22, 0.012, lacquer, maj=24, min_=6)
    # Front chest plate (large gold accent)
    box('ChestGold', (0, 0.17, 0.95), (0.18, 0.04, 0.15), gold, bevel=0.005)
    # Shoulder guards (sode) — large rectangular shoulder plates
    for x_sign in [-1, 1]:
        box(f'Sode_{x_sign}', (x_sign*0.28, 0, 1.05), (0.04, 0.20, 0.28), red,
            bevel=0.005)
        # Gold rivets on sode
        for k in range(3):
            uv_sph(f'SodeRivet_{x_sign}_{k}', (x_sign*0.30, 0, 0.95 + k*0.10), 0.010, gold,
                   segs=8, rings=6)
    # Arms (kote — armored sleeves)
    for x_sign in [-1, 1]:
        cyl(f'Arm_{x_sign}', (x_sign*0.30, 0, 0.85), 0.05, 0.40, lacquer, verts=10)
    # Neck guard (shikoro hanging from helmet)
    # Kabuto helmet — large bowl shape
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0, 0, 1.35),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Kabuto'
    o.scale = (1.0, 1.0, 0.65)
    o.data.materials.append(lacquer)
    # Helmet plates (radial)
    for i in range(8):
        ang = i / 8 * math.pi * 2
        cyl(f'KbPlate_{i}', (math.cos(ang)*0.12, math.sin(ang)*0.12, 1.36),
            0.005, 0.18, gold, verts=4, rot=(math.cos(ang)*0.3, math.sin(ang)*0.3, ang))
    # Curved horns (kuwagata — large gold crescent horns)
    for x_sign in [-1, 1]:
        cyl(f'Horn_{x_sign}', (x_sign*0.12, 0.06, 1.45), 0.018, 0.22, gold, verts=8,
            rot=(0, 0, x_sign*math.radians(45)))
        # Tip
        cone(f'HornTip_{x_sign}', (x_sign*0.22, 0.06, 1.55), 0.025, 0.0, 0.10, gold, verts=6,
             rot=(0, 0, x_sign*math.radians(60)))
    # Neck shikoro (hanging plates below helmet)
    for i in range(5):
        ang = -math.pi/2 + (i / 4) * math.pi
        x = math.cos(ang) * 0.16
        y = math.sin(ang) * 0.16
        box(f'Shikoro_{i}', (x, y, 1.22), (0.06, 0.03, 0.08), red,
            rot=(0, 0, ang + math.pi/2))
    # Face mask (menpo — dark)
    box('Menpo', (0, 0.14, 1.28), (0.16, 0.06, 0.10), face, bevel=0.005)
    # Top crest (kuwagata center ornament — small ball)
    uv_sph('Crest', (0, 0.06, 1.48), 0.025, gold, segs=12, rings=8)
    # Decorative cord (agemaki — orange tassel on back)
    uv_sph('AgemakBall', (0, -0.16, 1.05), 0.040, cord_orange, segs=12, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.2)
    join_and_export('samurai_armor_stand')


# ─── 2. KATANA RACK ──────────────────────────────────────────────────
def build_katana_rack():
    """Wooden 3-tier sword rack holding 3 katana/wakizashi at different heights."""
    clear_scene()
    wood = pbr('KrWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('KrWoodD', (0.22, 0.14, 0.08), 0.92)
    saya_b = pbr('KrSayaB', (0.10, 0.08, 0.06), 0.30)  # black lacquer
    saya_r = pbr('KrSayaR', (0.45, 0.10, 0.08), 0.40)  # red lacquer
    saya_g = pbr('KrSayaG', (0.20, 0.32, 0.20), 0.40)  # green lacquer
    tsuka = pbr('KrTsuka', (0.55, 0.42, 0.20), 0.85)
    tsuba = pbr('KrTsuba', (0.18, 0.16, 0.14), 0.45, metal=0.65)
    gold = pbr('KrGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Base
    box('Base', (0, 0, 0.04), (0.30, 0.45, 0.08), wood, bevel=0.005)
    box('BaseTop', (0, 0, 0.085), (0.32, 0.47, 0.010), wood_d)
    # 2 side pillars
    for y_sign in [-1, 1]:
        box(f'Side_{y_sign}', (0, y_sign*0.21, 0.35), (0.06, 0.04, 0.55), wood)
    # 3 horizontal crossbars (one per sword)
    for i, z in enumerate([0.20, 0.40, 0.60]):
        cyl(f'Bar_{i}', (0, 0, z), 0.012, 0.42, wood_d, verts=8,
            rot=(math.pi/2, 0, 0))
        # 2 small fork supports on each bar
        for y_off in [-0.10, 0.10]:
            cyl(f'Fork_{i}_{y_off}', (0, y_off, z + 0.02), 0.005, 0.05, wood_d, verts=4)
    # 3 katana lying horizontally on the bars
    saya_mats = [saya_b, saya_r, saya_g]
    for i, z in enumerate([0.20, 0.40, 0.60]):
        # Saya (scabbard)
        cyl(f'Saya_{i}', (0, -0.05, z + 0.04), 0.018, 0.30, saya_mats[i], verts=12,
            rot=(math.pi/2, 0, 0))
        # Tip cone
        cone(f'SayaTip_{i}', (0, -0.22, z + 0.04), 0.018, 0.005, 0.04, saya_mats[i], verts=10,
             rot=(math.pi/2, 0, 0))
        # Tsuba (guard)
        cyl(f'Tsuba_{i}', (0, 0.12, z + 0.04), 0.04, 0.012, tsuba, verts=14,
            rot=(math.pi/2, 0, 0))
        # Tsuka (handle wrap — light wood)
        cyl(f'Tsuka_{i}', (0, 0.20, z + 0.04), 0.018, 0.14, tsuka, verts=10,
            rot=(math.pi/2, 0, 0))
        # Wraps on tsuka (3 small darker bands)
        for k in range(4):
            torus(f'Wrap_{i}_{k}', (0, 0.14 + k*0.038, z + 0.04), 0.020, 0.005, wood_d,
                  maj=10, min_=4, rot=(math.pi/2, 0, 0))
        # Pommel (kashira) — small gold ball
        uv_sph(f'Pommel_{i}', (0, 0.28, z + 0.04), 0.022, gold, segs=10, rings=8)
    join_and_export('katana_rack')


# ─── 3. FARMER TOOLS ─────────────────────────────────────────────────
def build_farmer_tools():
    """Bundle of farm tools — hoe, sickle, woven basket, straw rope, all leaning on a wall."""
    clear_scene()
    wood = pbr('FtWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('FtWoodD', (0.22, 0.14, 0.08), 0.92)
    iron = pbr('FtIron', (0.28, 0.24, 0.20), 0.55, metal=0.55)
    iron_l = pbr('FtIronL', (0.42, 0.40, 0.38), 0.45, metal=0.55)
    straw = pbr('FtStraw', (0.85, 0.68, 0.32), 0.95)
    straw_d = pbr('FtStrawD', (0.55, 0.42, 0.18), 0.95)
    rope = pbr('FtRope', (0.78, 0.62, 0.42), 0.95)
    # Hoe (kuwa) — wooden handle + flat iron blade
    cyl('HoeShaft', (0, 0, 0.85), 0.025, 1.60, wood, verts=10,
        rot=(0, math.radians(15), math.radians(8)))
    # Flat blade at bottom (perpendicular to shaft)
    box('HoeBlade', (-0.05, 0, 0.10), (0.20, 0.08, 0.04), iron,
        rot=(0, math.radians(70), 0))
    # Hoe handle binding
    torus('HoeBind', (-0.04, 0, 0.20), 0.030, 0.008, rope, maj=12, min_=4,
          rot=(math.radians(80), 0, 0))
    # Sickle (kama) — curved blade + handle leaning beside
    cyl('SickleHandle', (0.18, 0.10, 0.30), 0.022, 0.40, wood, verts=10,
        rot=(0, 0, math.radians(45)))
    # Curved blade (use a torus segment approximated by a flat plane)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.40, 0.10, 0.50))
    o = bpy.context.active_object; o.name = 'SickleBlade'
    o.scale = (0.20, 0.04, 0.005)
    o.rotation_euler = (math.radians(85), 0, math.radians(70))
    o.data.materials.append(iron_l)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.005
    # Sickle binding cord
    torus('SickleBind', (0.30, 0.10, 0.45), 0.025, 0.006, rope, maj=10, min_=4,
          rot=(math.radians(80), 0, math.radians(60)))
    # Woven basket on the ground
    cyl('Basket', (-0.30, 0.18, 0.10), 0.16, 0.18, straw, verts=18)
    # Basket rim
    torus('BasketRim', (-0.30, 0.18, 0.19), 0.165, 0.012, straw_d, maj=18, min_=6)
    # Vertical weave strands (12 thin lines)
    for i in range(12):
        ang = i / 12 * math.pi * 2
        cyl(f'WeaveV_{i}', (-0.30 + math.cos(ang)*0.165, 0.18 + math.sin(ang)*0.165, 0.10),
            0.005, 0.18, straw_d, verts=4)
    # Horizontal bands
    for k in range(3):
        torus(f'WeaveH_{k}', (-0.30, 0.18, 0.04 + k*0.07), 0.165, 0.006, straw_d, maj=18, min_=4)
    # Basket handle
    torus('BasketHandle', (-0.30, 0.18, 0.24), 0.16, 0.010, straw_d, maj=12, min_=4,
          rot=(math.pi/2, 0, 0))
    # Coiled straw rope on the ground
    for k in range(4):
        torus(f'CoilRope_{k}', (0.32, -0.18, 0.04 + k*0.020), 0.08, 0.015, rope, maj=16, min_=6)
    # Iron sickle hanging from a wood peg on the wall (use wall implied by left-leaning items)
    # Already represented by sickle above.
    join_and_export('farmer_tools')


# ─── 4. BLACKSMITH ANVIL ─────────────────────────────────────────────
def build_blacksmith_anvil():
    """Anvil on a tree-stump base + hammer + tongs + glowing horseshoe."""
    clear_scene()
    iron = pbr('BaIron', (0.18, 0.16, 0.16), 0.55, metal=0.65)
    iron_d = pbr('BaIronD', (0.10, 0.08, 0.08), 0.65, metal=0.55)
    wood = pbr('BaWood', (0.42, 0.28, 0.16), 0.92)
    wood_l = pbr('BaWoodL', (0.62, 0.42, 0.22), 0.90)
    glow_orange = pbr('BaGlow', (1.0, 0.45, 0.10), 0.30,
                      emit=(1.0, 0.45, 0.10), emit_strength=2.5)
    glow_yellow = pbr('BaGlowY', (1.0, 0.85, 0.30), 0.30,
                      emit=(1.0, 0.85, 0.30), emit_strength=2.0)
    rope = pbr('BaRope', (0.78, 0.62, 0.42), 0.95)
    # Tree-stump base
    cyl('Stump', (0, 0, 0.30), 0.22, 0.60, wood, verts=20)
    # Top ring of stump (rings visible)
    cyl('StumpTop', (0, 0, 0.60), 0.215, 0.005, wood_l, verts=18)
    # Anvil body (horizontal flat block with curved horn)
    box('AnvilBody', (0, 0, 0.75), (0.45, 0.18, 0.08), iron, bevel=0.005)
    # Anvil waist (narrower)
    box('AnvilWaist', (0, 0, 0.68), (0.20, 0.16, 0.06), iron_d)
    # Horn (pointed conical tip on one end)
    cone('Horn', (0.30, 0, 0.78), 0.06, 0.020, 0.20, iron, verts=10,
         rot=(0, math.radians(-90), 0))
    # Hammer (sledgehammer-style head + wooden handle, lying across anvil)
    box('HammerHead', (0.0, 0.12, 0.85), (0.12, 0.06, 0.06), iron, bevel=0.005)
    cyl('HammerHandle', (-0.25, 0.12, 0.85), 0.020, 0.40, wood_l, verts=8,
        rot=(0, math.radians(90), 0))
    # Tongs (long pair of pliers leaning on anvil)
    cyl('TongHandleL', (0.10, -0.20, 0.40), 0.012, 0.40, iron_d, verts=6,
        rot=(math.radians(75), 0, math.radians(8)))
    cyl('TongHandleR', (0.18, -0.20, 0.40), 0.012, 0.40, iron_d, verts=6,
        rot=(math.radians(75), 0, math.radians(-8)))
    # Tong jaws (small bent boxes at the top)
    box('TongJawL', (0.10, -0.25, 0.60), (0.012, 0.10, 0.012), iron, rot=(0, 0, math.radians(20)))
    box('TongJawR', (0.18, -0.25, 0.60), (0.012, 0.10, 0.012), iron, rot=(0, 0, math.radians(-20)))
    # Hinge bolt
    cyl('TongHinge', (0.14, -0.22, 0.55), 0.014, 0.015, iron, verts=8, rot=(math.pi/2, 0, 0))
    # Glowing horseshoe on the anvil surface (work in progress)
    torus('Horseshoe', (-0.10, 0.05, 0.81), 0.05, 0.012, glow_orange, maj=14, min_=5,
          rot=(math.pi/2, 0, 0))
    # Glowing sparks (3 small bright dots around the horseshoe)
    for i, (dx, dz) in enumerate([(-0.05, 0.04), (0.04, 0.05), (0.02, -0.03)]):
        uv_sph(f'Spark_{i}', (-0.10 + dx, 0.05, 0.81 + dz), 0.010, glow_yellow, segs=6, rings=4)
    # Coiled rope hanging from stump
    for k in range(3):
        torus(f'Rope_{k}', (0.18, 0.18, 0.40 + k*0.020), 0.04, 0.008, rope, maj=12, min_=4)
    join_and_export('blacksmith_anvil')


# ─── 5. SCARECROW ────────────────────────────────────────────────────
def build_scarecrow():
    """Rustic scarecrow — cross frame, straw hat, patched clothes, sleeves billowing."""
    clear_scene()
    wood = pbr('ScWood', (0.32, 0.20, 0.12), 0.92)
    cloth_b = pbr('ScClothB', (0.18, 0.30, 0.55), 0.85)
    cloth_p = pbr('ScClothP', (0.42, 0.20, 0.45), 0.85)
    patch = pbr('ScPatch', (0.62, 0.42, 0.22), 0.85)
    straw = pbr('ScStraw', (0.85, 0.68, 0.32), 0.95)
    straw_d = pbr('ScStrawD', (0.55, 0.42, 0.18), 0.95)
    face = pbr('ScFace', (0.92, 0.78, 0.55), 0.65)
    ink = pbr('ScInk', (0.10, 0.08, 0.06), 0.55)
    rope = pbr('ScRope', (0.78, 0.62, 0.42), 0.95)
    # Vertical pole
    cyl('Pole', (0, 0, 0.90), 0.025, 1.80, wood, verts=10)
    # Horizontal cross bar (arms)
    cyl('CrossBar', (0, 0, 1.40), 0.020, 1.20, wood, verts=8,
        rot=(0, math.pi/2, 0))
    # Body shirt — wide cloth draping the central pole + crossbar
    box('Shirt', (0, 0, 1.20), (0.55, 0.06, 0.60), cloth_b, bevel=0.01)
    # Sleeves draping from crossbar ends
    for x_sign in [-1, 1]:
        cyl(f'Sleeve_{x_sign}', (x_sign*0.45, 0, 1.25), 0.05, 0.40, cloth_b, verts=8,
            rot=(0, 0, x_sign*math.radians(-12)))
        # Cloth flare at end of sleeve
        uv_sph(f'SleeveEnd_{x_sign}', (x_sign*0.55, 0, 1.05), 0.07, cloth_p, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.2, 1.4)
    # Patches on the shirt (3 different-color rectangles)
    for i, (x, y, z, sx, sz) in enumerate([
        (-0.15, 0.04, 1.30, 0.12, 0.10),
        (0.20, 0.04, 1.10, 0.10, 0.10),
        (0.0, 0.04, 0.95, 0.16, 0.08)
    ]):
        box(f'Patch_{i}', (x, y, z), (sx, 0.005, sz), patch)
    # Straw skirt (lower body)
    for i in range(10):
        ang = i / 10 * math.pi * 2
        cyl(f'StrawStr_{i}', (math.cos(ang)*0.20, math.sin(ang)*0.20, 0.75), 0.010, 0.40, straw_d,
            verts=4)
    # Straw "hands" sticking out of sleeve ends
    for x_sign in [-1, 1]:
        for k in range(4):
            ang = (k - 1.5) * 0.25
            cyl(f'StrawHand_{x_sign}_{k}', (x_sign*(0.60 + math.cos(ang)*0.05), 0,
                                              0.97 + math.sin(ang)*0.04), 0.005, 0.10,
                straw, verts=4, rot=(0, x_sign*math.pi/2 + ang, 0))
    # Burlap head sack
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0, 0, 1.65),
                                          segments=20, ring_count=14)
    o = bpy.context.active_object; o.name = 'Head'
    o.scale = (1.0, 1.0, 1.1)
    o.data.materials.append(face)
    # Triangle button-eyes
    for x_sign in [-1, 1]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.020, radius2=0.0, depth=0.005,
                                         location=(x_sign*0.05, 0.14, 1.70), vertices=3)
        o = bpy.context.active_object; o.name = f'Eye_{x_sign}'
        o.rotation_euler = (math.pi/2, 0, 0)
        o.data.materials.append(ink)
    # Stitched mouth (zigzag)
    for i in range(4):
        x = -0.04 + i*0.025
        ox = ((i % 2) * 2 - 1) * 0.01
        box(f'Mouth_{i}', (x + ox, 0.155, 1.60), (0.010, 0.005, 0.004), ink)
    # Straw hat (wide cone)
    cone('Hat', (0, 0, 1.78), 0.22, 0.08, 0.08, straw, verts=20)
    cyl('HatTop', (0, 0, 1.84), 0.025, 0.04, straw_d, verts=10)
    # Rope tying the head sack to the pole
    torus('NeckRope', (0, 0, 1.48), 0.06, 0.008, rope, maj=14, min_=4)
    join_and_export('scarecrow')


# ─── 6. FISHING ROD ──────────────────────────────────────────────────
def build_fishing_rod():
    """Bamboo fishing rod resting on a wood frame w/ tackle box + bobbing float."""
    clear_scene()
    bamboo = pbr('FrBamboo', (0.62, 0.50, 0.20), 0.85)
    bamboo_d = pbr('FrBambooD', (0.32, 0.22, 0.10), 0.92)
    wood = pbr('FrWood', (0.42, 0.28, 0.16), 0.92)
    metal = pbr('FrMetal', (0.65, 0.55, 0.30), 0.40, metal=0.55)
    line = pbr('FrLine', (0.92, 0.88, 0.72), 0.95)
    float_r = pbr('FrFloatR', (0.92, 0.18, 0.14), 0.55)
    float_w = pbr('FrFloatW', (0.95, 0.92, 0.85), 0.65)
    tackle_d = pbr('FrTackle', (0.42, 0.28, 0.16), 0.92)
    # Wood frame holder (V-shape on the ground)
    box('FrameBase', (0, 0, 0.025), (0.40, 0.12, 0.05), wood, bevel=0.005)
    cyl('FrameL', (-0.15, 0, 0.18), 0.018, 0.30, wood, verts=8,
        rot=(0, 0, math.radians(15)))
    cyl('FrameR', ( 0.15, 0, 0.18), 0.018, 0.30, wood, verts=8,
        rot=(0, 0, math.radians(-15)))
    # Bamboo rod resting in the V
    cyl('Rod', (0, 0, 0.32), 0.020, 2.20, bamboo, verts=12,
        rot=(0, math.pi/2, math.radians(5)))
    # Bamboo nodes on rod
    for k in range(5):
        torus(f'RodNode_{k}', (-1.0 + k*0.50, 0, 0.32 - k*0.04), 0.022, 0.006, bamboo_d, maj=10, min_=4,
              rot=(0, math.pi/2, 0))
    # Rod tip ring (small metal ring)
    torus('RodTipRing', (1.10, 0, 0.40), 0.015, 0.003, metal, maj=10, min_=4,
          rot=(0, math.pi/2, 0))
    # Fishing line trailing from tip
    cyl('Line', (1.40, 0, 0.20), 0.002, 0.50, line, verts=4,
        rot=(0, math.radians(-30), 0))
    # Float (red+white bobber)
    cyl('FloatR', (1.60, 0, 0.06), 0.018, 0.05, float_r, verts=10)
    cyl('FloatW', (1.60, 0, 0.10), 0.018, 0.04, float_w, verts=10)
    cone('FloatTop', (1.60, 0, 0.135), 0.018, 0.0, 0.04, float_r, verts=8)
    # Small wooden tackle box on the side
    box('Tackle', (-0.30, 0.15, 0.08), (0.15, 0.10, 0.10), tackle_d, bevel=0.005)
    box('TackleLid', (-0.30, 0.15, 0.135), (0.16, 0.11, 0.012), wood)
    # Metal latch on box
    box('Latch', (-0.30, 0.10, 0.135), (0.02, 0.005, 0.020), metal)
    # 2 lures inside (small bumps on top of lid)
    uv_sph('Lure1', (-0.30, 0.18, 0.145), 0.012, float_r, segs=8, rings=6)
    uv_sph('Lure2', (-0.30, 0.13, 0.145), 0.012, float_w, segs=8, rings=6)
    join_and_export('fishing_rod')


# ─── 7. ABACUS ───────────────────────────────────────────────────────
def build_abacus():
    """Traditional Japanese soroban — 5 beads + 1 bead per rod across 13 rods."""
    clear_scene()
    wood = pbr('AbWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('AbWoodD', (0.22, 0.14, 0.08), 0.92)
    bead = pbr('AbBead', (0.32, 0.20, 0.12), 0.85)
    bead_d = pbr('AbBeadD', (0.20, 0.12, 0.06), 0.92)
    metal = pbr('AbMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    # Frame
    box('FrameTop', (0, 0, 0.20), (0.55, 0.04, 0.02), wood_d)
    box('FrameBot', (0, 0, 0.005), (0.55, 0.04, 0.02), wood_d)
    box('FrameL', (-0.27, 0, 0.10), (0.025, 0.04, 0.22), wood_d)
    box('FrameR', ( 0.27, 0, 0.10), (0.025, 0.04, 0.22), wood_d)
    # Reckoning bar (divider rod between heaven & earth beads)
    box('Reckoning', (0, 0, 0.155), (0.50, 0.05, 0.008), wood)
    # 13 vertical rods
    for i in range(13):
        x = -0.24 + i * 0.04
        cyl(f'Rod_{i}', (x, 0, 0.10), 0.003, 0.22, metal, verts=6)
    # Beads — top row (1 bead per rod, "heaven" bead), bottom (4 beads per rod, "earth")
    rng = random.Random(171)
    for i in range(13):
        x = -0.24 + i * 0.04
        # Heaven bead (above reckoning bar)
        m = bead if i % 2 == 0 else bead_d
        # Approximate bead as a flattened sphere (lens shape)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.015, location=(x, 0, 0.185),
                                              segments=10, ring_count=8)
        o = bpy.context.active_object; o.name = f'Heaven_{i}'
        o.scale = (1.0, 1.0, 0.45)
        o.data.materials.append(m)
        # Earth beads (4 below)
        # Stagger heights slightly for "in use" feel
        bottom_z_offsets = [0.02, 0.045, 0.07, 0.095]
        if rng.random() > 0.7:
            bottom_z_offsets = [0.05, 0.075, 0.10, 0.125]  # some pushed up
        for k, z_off in enumerate(bottom_z_offsets):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.015, location=(x, 0, 0.020 + z_off),
                                                  segments=10, ring_count=8)
            o = bpy.context.active_object; o.name = f'Earth_{i}_{k}'
            o.scale = (1.0, 1.0, 0.45)
            o.data.materials.append(m)
    join_and_export('abacus')


# ─── 8. SHOJI LAMP ───────────────────────────────────────────────────
def build_shoji_lamp():
    """Tall floor lamp — wooden frame w/ rice-paper panel + soft warm glow."""
    clear_scene()
    wood = pbr('SlpWood', (0.32, 0.20, 0.12), 0.92)
    wood_d = pbr('SlpWoodD', (0.22, 0.14, 0.08), 0.92)
    paper = pbr('SlpPaper', (0.95, 0.85, 0.55), 0.55,
                emit=(1.0, 0.85, 0.55), emit_strength=1.5)
    grid = pbr('SlpGrid', (0.22, 0.14, 0.08), 0.90)
    base = pbr('SlpBase', (0.18, 0.14, 0.08), 0.85)
    # Base (heavy square)
    box('Base', (0, 0, 0.04), (0.18, 0.18, 0.08), base, bevel=0.005)
    box('BaseTop', (0, 0, 0.085), (0.20, 0.20, 0.012), wood_d)
    # 4 corner posts
    for x in [-0.07, 0.07]:
        for y in [-0.07, 0.07]:
            cyl(f'Post_{x}_{y}', (x, y, 0.55), 0.012, 0.85, wood_d, verts=6)
    # Top cap
    box('Cap', (0, 0, 1.00), (0.18, 0.18, 0.012), wood_d)
    box('CapTop', (0, 0, 1.025), (0.14, 0.14, 0.05), wood)
    cone('CapFinial', (0, 0, 1.085), 0.06, 0.0, 0.06, wood, verts=8)
    # 4 paper panels (one per side)
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        if abs(sx) > abs(sy):
            box(f'Panel_x_{sx}', (sx*0.075, 0, 0.55), (0.005, 0.14, 0.85), paper)
        else:
            box(f'Panel_y_{sy}', (0, sy*0.075, 0.55), (0.14, 0.005, 0.85), paper)
    # Grid (cross of thin dark bars)
    for sx, sy in [(-1,0),(1,0),(0,-1),(0,1)]:
        for k in range(4):
            zk = 0.20 + k * 0.20
            if abs(sx) > abs(sy):
                box(f'Grid_h_{sx}_{k}', (sx*0.078, 0, zk), (0.005, 0.14, 0.006), grid)
            else:
                box(f'Grid_h_{sy}_{k}', (0, sy*0.078, zk), (0.14, 0.005, 0.006), grid)
        # Vertical grid (one center bar)
        if abs(sx) > abs(sy):
            box(f'Grid_v_{sx}', (sx*0.078, 0, 0.55), (0.005, 0.005, 0.85), grid)
        else:
            box(f'Grid_v_{sy}', (0, sy*0.078, 0.55), (0.005, 0.005, 0.85), grid)
    join_and_export('shoji_lamp')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_samurai_armor_stand()
    build_katana_rack()
    build_farmer_tools()
    build_blacksmith_anvil()
    build_scarecrow()
    build_fishing_rod()
    build_abacus()
    build_shoji_lamp()
    print(f'[DONE] pack v17 exported to {OUT_DIR}')
