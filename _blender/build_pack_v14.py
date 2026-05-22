"""
Pack v14 — food / market kit.
Builds:
  food_stall, ramen_cart, dango_skewers, taiyaki,
  onigiri_set, tsukimi_tray, bonsai, incense_burner
Run headless:
  blender --background --python build_pack_v14.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(14)


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


# ─── 1. FOOD STALL (yatai) ───────────────────────────────────────────
def build_food_stall():
    """Festival food yatai — red awning, counter w/ ingredients, hanging chochin."""
    clear_scene()
    wood = pbr('FsWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('FsWoodD', (0.22, 0.14, 0.08), 0.92)
    awning = pbr('FsAwning', (0.85, 0.18, 0.14), 0.65)
    awning_d = pbr('FsAwningD', (0.55, 0.12, 0.10), 0.70)
    cloth_white = pbr('FsCloth', (0.95, 0.92, 0.85), 0.85)
    paper = pbr('FsPaper', (0.95, 0.78, 0.45), 0.65,
                emit=(1.0, 0.78, 0.40), emit_strength=1.2)
    ink = pbr('FsInk', (0.10, 0.08, 0.06), 0.85)
    metal = pbr('FsMetal', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    food_color = pbr('FsFood', (0.85, 0.65, 0.30), 0.70)
    # Counter base
    box('Counter', (0, 0, 0.45), (2.20, 0.90, 0.90), wood, bevel=0.01)
    # Counter top
    box('CTop', (0, 0, 0.92), (2.30, 1.00, 0.06), wood_d)
    # 4 corner posts (slimmer, going up)
    for x in [-1.05, 1.05]:
        for y in [-0.42, 0.42]:
            cyl(f'Post_{x}_{y}', (x, y, 1.50), 0.04, 1.20, wood_d, verts=8)
    # Awning ridge bar
    cyl('Ridge', (0, 0, 2.20), 0.04, 2.30, wood_d, verts=8, rot=(0, 0, math.pi/2))
    # Sloped red awning (2 panels)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.55, 1.90))
    o = bpy.context.active_object; o.name = 'AwningF'
    o.scale = (2.30, 0.005, 0.85)
    o.rotation_euler = (math.radians(35), 0, 0)
    o.data.materials.append(awning)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.01
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.55, 1.90))
    o = bpy.context.active_object; o.name = 'AwningB'
    o.scale = (2.30, 0.005, 0.85)
    o.rotation_euler = (math.radians(-35), 0, 0)
    o.data.materials.append(awning)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.01
    # Dark trim band along eaves
    box('TrimF', (0, 0.88, 1.65), (2.40, 0.04, 0.04), awning_d)
    box('TrimB', (0, -0.88, 1.65), (2.40, 0.04, 0.04), awning_d)
    # 2 hanging chochin lanterns
    for i, x in enumerate([-0.7, 0.7]):
        # Lantern body
        uv_sph(f'Chochin_{i}', (x, 0.50, 1.55), 0.14, paper, segs=16, rings=12)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
        # Top + bottom caps
        cyl(f'CapT_{i}', (x, 0.50, 1.66), 0.05, 0.02, wood_d, verts=10)
        cyl(f'CapB_{i}', (x, 0.50, 1.44), 0.05, 0.02, wood_d, verts=10)
        # Hanging cord
        cyl(f'Cord_{i}', (x, 0.50, 1.78), 0.005, 0.20, wood_d, verts=4)
        # Ink character on lantern (small dark box on front)
        box(f'Ink_{i}', (x, 0.36, 1.55), (0.05, 0.005, 0.06), ink)
    # Counter front cloth banner (noren)
    box('Noren', (0, -0.45, 1.20), (2.20, 0.005, 0.40), cloth_white)
    # 2 ink characters on noren
    for i, x in enumerate([-0.5, 0.5]):
        box(f'NorenInk_{i}', (x, -0.453, 1.20), (0.12, 0.005, 0.20), ink)
    # 3 food items on counter
    for i, x in enumerate([-0.6, 0.0, 0.6]):
        uv_sph(f'Food_{i}', (x, 0.20, 1.02), 0.08, food_color, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.55)
    # Pot at one end (with steam)
    cyl('Pot', (0.80, -0.20, 1.05), 0.12, 0.18, pbr('FsPot', (0.18, 0.14, 0.10), 0.55, metal=0.65),
        verts=14)
    cyl('PotLid', (0.80, -0.20, 1.16), 0.10, 0.02, metal, verts=12)
    join_and_export('food_stall')


# ─── 2. RAMEN CART (yatai noodle stand) ──────────────────────────────
def build_ramen_cart():
    """Mobile ramen cart on 2 wheels w/ small chimney + steaming bowl + hanging sign."""
    clear_scene()
    wood = pbr('RcWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('RcWoodD', (0.22, 0.14, 0.08), 0.92)
    red = pbr('RcRed', (0.85, 0.18, 0.14), 0.65)
    iron = pbr('RcIron', (0.18, 0.14, 0.10), 0.55, metal=0.65)
    paper = pbr('RcPaper', (0.95, 0.78, 0.45), 0.65,
                emit=(1.0, 0.78, 0.40), emit_strength=1.0)
    ink = pbr('RcInk', (0.10, 0.08, 0.06), 0.85)
    ceramic = pbr('RcCeramic', (0.95, 0.92, 0.88), 0.45)
    broth = pbr('RcBroth', (0.85, 0.68, 0.32), 0.65)
    noodle = pbr('RcNoodle', (0.95, 0.85, 0.55), 0.80)
    # Cart base (rectangular)
    box('CartBase', (0, 0, 0.65), (1.20, 0.65, 0.50), wood, bevel=0.01)
    # Cart top counter
    box('Counter', (0, 0, 0.92), (1.30, 0.75, 0.04), wood_d)
    # 2 wheels (smaller than ox cart)
    for y_sign in [-1, 1]:
        torus(f'Wheel_{y_sign}', (-0.40, y_sign*0.40, 0.20), 0.20, 0.04, wood, maj=20, min_=8,
              rot=(0, math.pi/2, 0))
        # 6 spokes
        for i in range(6):
            ang = i / 6 * math.pi * 2
            sx = -0.40 + math.cos(ang) * 0.10
            sz = 0.20 + math.sin(ang) * 0.10
            cyl(f'Spoke_{y_sign}_{i}', (sx, y_sign*0.40, sz), 0.010, 0.20, wood_d, verts=4,
                rot=(0, ang, 0))
        cyl(f'Hub_{y_sign}', (-0.40, y_sign*0.40, 0.20), 0.030, 0.10, iron, verts=8,
            rot=(0, math.pi/2, 0))
    # Pull handles
    box('HandleL', (0.70, 0, 0.55), (1.10, 0.03, 0.03), wood_d)
    cyl('HandleEnd', (1.25, 0, 0.55), 0.018, 0.20, wood_d, verts=6, rot=(math.pi/2, 0, 0))
    # 2 vertical posts (back of counter) for hanging awning
    for x in [-0.55, 0.55]:
        cyl(f'AwPost_{x}', (x, -0.30, 1.40), 0.025, 0.95, wood_d, verts=8)
    # Red awning (single front panel)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.30, 1.75))
    o = bpy.context.active_object; o.name = 'Awning'
    o.scale = (1.15, 0.005, 0.45)
    o.rotation_euler = (math.radians(20), 0, 0)
    o.data.materials.append(red)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.01
    # 3 hanging white characters on the awning (sign)
    for i, x in enumerate([-0.3, 0.0, 0.3]):
        box(f'Char_{i}', (x, -0.30, 1.55), (0.10, 0.005, 0.12), pbr(f'RcChar_{i}', (0.95, 0.92, 0.85), 0.85))
        box(f'CharInk_{i}', (x, -0.305, 1.55), (0.06, 0.005, 0.08), ink)
    # Steaming ramen bowl
    cyl('Bowl', (0.30, 0.10, 0.97), 0.10, 0.06, ceramic, verts=18)
    cyl('Broth', (0.30, 0.10, 1.00), 0.085, 0.020, broth, verts=16)
    # Noodle swirl (small flat torus on top of broth)
    torus('Noodles', (0.30, 0.10, 1.015), 0.05, 0.010, noodle, maj=14, min_=4)
    # Egg half on the noodles
    uv_sph('Egg', (0.30, 0.10, 1.025), 0.020, pbr('RcEgg', (0.95, 0.85, 0.55), 0.55), segs=8, rings=6)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.6)
    # Small chimney pipe + steam pot at the other end
    cyl('StovePot', (-0.30, 0.10, 0.98), 0.10, 0.10, iron, verts=14)
    cyl('Chimney', (-0.30, -0.10, 1.20), 0.025, 0.40, iron, verts=8)
    # Hanging chochin
    uv_sph('Chochin', (-0.55, -0.30, 1.20), 0.10, paper, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
    cyl('ChochinCord', (-0.55, -0.30, 1.32), 0.005, 0.16, wood_d, verts=4)
    join_and_export('ramen_cart')


# ─── 3. DANGO SKEWERS ────────────────────────────────────────────────
def build_dango_skewers():
    """Tray of 4 dango skewers (3 dumplings on each stick) in 3 colors."""
    clear_scene()
    wood = pbr('DgWood', (0.42, 0.28, 0.16), 0.92)
    stick = pbr('DgStick', (0.62, 0.50, 0.20), 0.85)
    dango_w = pbr('DgWhite', (0.95, 0.92, 0.85), 0.55)
    dango_p = pbr('DgPink', (0.95, 0.65, 0.78), 0.55)
    dango_g = pbr('DgGreen', (0.55, 0.78, 0.42), 0.55)
    # Wooden tray
    box('Tray', (0, 0, 0.025), (0.50, 0.30, 0.05), wood, bevel=0.005)
    box('TrayRim', (0, 0, 0.055), (0.52, 0.32, 0.012),
        pbr('DgTrayRim', (0.22, 0.14, 0.08), 0.90))
    # 4 skewers laid across the tray
    for i, y in enumerate([-0.10, -0.04, 0.04, 0.10]):
        # Skewer stick
        cyl(f'Stick_{i}', (0, y, 0.075), 0.005, 0.46, stick, verts=4,
            rot=(0, math.pi/2, 0))
        # 3 dango (different color combos for variety)
        if i == 0:    # hanami dango (pink/white/green)
            colors = [dango_p, dango_w, dango_g]
        elif i == 1:  # mitarashi/all white
            colors = [dango_w, dango_w, dango_w]
        elif i == 2:
            colors = [dango_g, dango_g, dango_g]
        else:
            colors = [dango_p, dango_p, dango_p]
        for k in range(3):
            x = -0.10 + k * 0.10
            uv_sph(f'Ball_{i}_{k}', (x, y, 0.085), 0.030, colors[k], segs=12, rings=10)
    # Optional sauce drizzle (small yellow sphere on one set)
    for k in range(3):
        x = -0.10 + k * 0.10
        uv_sph(f'Sauce_{k}', (x, 0.10, 0.115), 0.018,
               pbr(f'DgSauce_{k}', (0.92, 0.78, 0.30), 0.45),
               segs=8, rings=6)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.4)
    join_and_export('dango_skewers')


# ─── 4. TAIYAKI ──────────────────────────────────────────────────────
def build_taiyaki():
    """Fish-shaped pastry on a paper wrapper — 2 taiyaki stacked."""
    clear_scene()
    pastry = pbr('TyPastry', (0.85, 0.65, 0.30), 0.75)
    pastry_d = pbr('TyPastryD', (0.55, 0.38, 0.18), 0.85)
    paper = pbr('TyPaper', (0.95, 0.92, 0.85), 0.85)
    red = pbr('TyRed', (0.85, 0.16, 0.10), 0.65)
    # Paper wrapper (flat triangle-ish base)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.005))
    o = bpy.context.active_object; o.name = 'Paper'
    o.scale = (0.45, 0.35, 0.005)
    o.data.materials.append(paper)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.005
    # Red printed pattern on paper (small stripes)
    for i, y in enumerate([-0.10, 0.0, 0.10]):
        box(f'Stripe_{i}', (0, y, 0.012), (0.40, 0.005, 0.003), red)
    # Bottom taiyaki — fish shape approximated by an elongated bevelled box
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.05, 0, 0.07))
    o = bpy.context.active_object; o.name = 'Taiyaki1Body'
    o.scale = (0.32, 0.16, 0.10)
    o.data.materials.append(pastry)
    b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.04; b.segments = 3
    # Tail fin
    cone('Taiyaki1Tail', (-0.20, 0, 0.07), 0.10, 0.0, 0.10, pastry, verts=4,
         rot=(0, math.radians(-90), 0))
    # Eye (small dark dot)
    uv_sph('Taiyaki1Eye', (0.10, 0.07, 0.10), 0.012,
           pbr('TyEye1', (0.10, 0.08, 0.06), 0.55), segs=6, rings=4)
    uv_sph('Taiyaki1Eye2', (0.10, -0.07, 0.10), 0.012,
           pbr('TyEye2', (0.10, 0.08, 0.06), 0.55), segs=6, rings=4)
    # Scale marks (3 small darker patches)
    for i, x in enumerate([-0.05, 0.02, 0.08]):
        box(f'Scale_{i}', (x, 0, 0.125), (0.04, 0.05, 0.005), pastry_d)
    # Top taiyaki — slightly offset, rotated
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.05, 0.03, 0.20))
    o = bpy.context.active_object; o.name = 'Taiyaki2Body'
    o.scale = (0.32, 0.16, 0.10)
    o.rotation_euler = (0, 0, math.radians(20))
    o.data.materials.append(pastry)
    b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.04; b.segments = 3
    # Tail
    cone('Taiyaki2Tail', (-0.10, -0.07, 0.20), 0.10, 0.0, 0.10, pastry, verts=4,
         rot=(0, math.radians(-90), math.radians(20)))
    # Eye
    uv_sph('Taiyaki2Eye', (0.20, 0.10, 0.23), 0.012,
           pbr('TyEye3', (0.10, 0.08, 0.06), 0.55), segs=6, rings=4)
    join_and_export('taiyaki')


# ─── 5. ONIGIRI SET ──────────────────────────────────────────────────
def build_onigiri_set():
    """Bento-tray of 3 onigiri rice balls + pickled plum + chopsticks."""
    clear_scene()
    wood = pbr('OnWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('OnWoodD', (0.22, 0.14, 0.08), 0.92)
    rice = pbr('OnRice', (0.96, 0.94, 0.88), 0.70)
    nori = pbr('OnNori', (0.18, 0.22, 0.16), 0.85)
    umeboshi = pbr('OnUme', (0.85, 0.18, 0.14), 0.55)
    pickle = pbr('OnPickle', (0.78, 0.50, 0.20), 0.75)
    # Tray
    box('Tray', (0, 0, 0.025), (0.55, 0.35, 0.05), wood, bevel=0.005)
    box('TrayRim', (0, 0, 0.055), (0.57, 0.37, 0.015), wood_d)
    # 3 onigiri — pyramidal rice balls (cones with flat tops)
    for i, (x, y) in enumerate([(-0.18, -0.05), (0.0, 0.08), (0.18, -0.05)]):
        # Use a pyramid-ish cone with 3-sided base (triangle)
        cone(f'Onigiri_{i}', (x, y, 0.10), 0.10, 0.04, 0.10, rice, verts=3)
        # Apply slight rotation for variety
        o = bpy.context.active_object; o.rotation_euler = (0, 0, i * math.radians(45))
        # Nori wrap (black band around the bottom)
        box(f'Nori_{i}', (x, y, 0.065), (0.18, 0.18, 0.025), nori,
            rot=(0, 0, i * math.radians(45)))
        # Umeboshi pickled plum on top (only on first onigiri)
        if i == 0:
            uv_sph(f'Ume_{i}', (x, y, 0.155), 0.020, umeboshi, segs=10, rings=8)
    # Pickle slices on the side
    for i in range(3):
        x = 0.18 + i * 0.005
        y = 0.10
        cyl(f'Pickle_{i}', (x, y, 0.06), 0.025, 0.015, pickle, verts=10)
    # 2 chopsticks
    for i in range(2):
        cyl(f'Chop_{i}', (-0.20 - i*0.005, -0.13 + i*0.005, 0.07), 0.005, 0.30,
            wood, verts=4, rot=(0, math.pi/2, 0.05))
    # Chopstick rest
    box('ChopRest', (-0.30, -0.13, 0.06), (0.05, 0.020, 0.012),
        pbr('OnChopRest', (0.85, 0.16, 0.10), 0.55))
    join_and_export('onigiri_set')


# ─── 6. TSUKIMI TRAY (moon-viewing platter) ──────────────────────────
def build_tsukimi_tray():
    """Black lacquer tray w/ pyramid of dango + susuki grass + sake bottle."""
    clear_scene()
    lacquer = pbr('TmLacquer', (0.10, 0.06, 0.06), 0.30)
    lacquer_red = pbr('TmLacquerR', (0.55, 0.10, 0.08), 0.40)
    dango_w = pbr('TmDango', (0.95, 0.93, 0.88), 0.55)
    grass = pbr('TmGrass', (0.85, 0.78, 0.55), 0.95)
    porcelain = pbr('TmPorcelain', (0.95, 0.92, 0.88), 0.40)
    sake = pbr('TmSake', (0.94, 0.92, 0.78), 0.30,
               emit=(0.95, 0.92, 0.70), emit_strength=0.10)
    # Tray (black lacquer)
    box('Tray', (0, 0, 0.025), (0.55, 0.35, 0.05), lacquer)
    # Red inner trim
    box('TrayInner', (0, 0, 0.052), (0.45, 0.28, 0.005), lacquer_red)
    # Dango pyramid — 9 dango stacked (bottom 5, mid 3, top 1)
    rng = random.Random(141)
    # Bottom layer 5 (pentagon)
    for i in range(5):
        ang = i / 5 * math.pi * 2
        x = -0.15 + math.cos(ang) * 0.045
        y = math.sin(ang) * 0.045
        uv_sph(f'D1_{i}', (x, y, 0.090), 0.030, dango_w, segs=12, rings=10)
    # Mid layer 3 (triangle)
    for i in range(3):
        ang = i / 3 * math.pi * 2 + 0.5
        x = -0.15 + math.cos(ang) * 0.030
        y = math.sin(ang) * 0.030
        uv_sph(f'D2_{i}', (x, y, 0.150), 0.030, dango_w, segs=12, rings=10)
    # Top 1
    uv_sph('D3', (-0.15, 0, 0.205), 0.030, dango_w, segs=12, rings=10)
    # Susuki grass (5 tall thin tufts of grass arching upward)
    for i in range(5):
        ang = i / 5 * math.pi * 2 + 0.3
        x = 0.10 + math.cos(ang) * 0.04
        y = math.sin(ang) * 0.04
        # Stem
        cyl(f'Stem_{i}', (x, y, 0.22), 0.005, 0.40, grass, verts=4)
        # Plume top (3 small spheres in fan)
        for k in range(3):
            kang = (k - 1) * 0.25
            uv_sph(f'Plume_{i}_{k}', (x + math.sin(kang)*0.03, y + math.cos(kang)*0.03, 0.42),
                   0.020, grass, segs=8, rings=6)
            o = bpy.context.active_object; o.scale = (0.6, 0.6, 2.0)
    # Small sake bottle (right side)
    uv_sph('BotBody', (0.18, -0.05, 0.10), 0.045, porcelain, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.3)
    cyl('BotNeck', (0.18, -0.05, 0.16), 0.015, 0.04, porcelain, verts=10)
    cyl('BotLip', (0.18, -0.05, 0.19), 0.018, 0.012, lacquer_red, verts=10)
    # Sake cup
    cyl('Cup', (0.18, 0.10, 0.06), 0.025, 0.025, porcelain, verts=12)
    cyl('CupSake', (0.18, 0.10, 0.073), 0.022, 0.005, sake, verts=12)
    join_and_export('tsukimi_tray')


# ─── 7. BONSAI ───────────────────────────────────────────────────────
def build_bonsai():
    """Miniature pine bonsai in a glazed pot — 3 stylized canopy puffs."""
    clear_scene()
    pot = pbr('BoPot', (0.32, 0.42, 0.30), 0.55)
    pot_rim = pbr('BoPotRim', (0.22, 0.30, 0.20), 0.65)
    soil = pbr('BoSoil', (0.18, 0.12, 0.08), 0.92)
    bark = pbr('BoBark', (0.32, 0.20, 0.12), 0.92)
    leaf = pbr('BoLeaf', (0.30, 0.55, 0.32), 0.85)
    leaf_d = pbr('BoLeafD', (0.22, 0.42, 0.22), 0.88)
    moss = pbr('BoMoss', (0.32, 0.55, 0.24), 0.92)
    # Glazed shallow pot (rectangular for bonsai look)
    box('Pot', (0, 0, 0.07), (0.35, 0.22, 0.10), pot, bevel=0.01)
    # Pot rim
    box('PotRim', (0, 0, 0.12), (0.36, 0.23, 0.012), pot_rim)
    # 4 small feet
    for x_sign, y_sign in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        box(f'Foot_{x_sign}_{y_sign}', (x_sign*0.14, y_sign*0.08, 0.02),
            (0.025, 0.025, 0.020), pot_rim)
    # Soil
    box('Soil', (0, 0, 0.12), (0.32, 0.20, 0.02), soil)
    # Moss patch
    cyl('Moss', (0.05, 0.05, 0.132), 0.04, 0.005, moss, verts=10)
    # Bonsai trunk — gnarled, swept to one side
    # Bottom thick segment
    cyl('Trunk1', (-0.05, 0, 0.18), 0.025, 0.12, bark, verts=8,
        rot=(0, 0, math.radians(15)))
    # Mid bend
    cyl('Trunk2', (0.0, 0, 0.28), 0.022, 0.12, bark, verts=8,
        rot=(0, 0, math.radians(-20)))
    # Top
    cyl('Trunk3', (0.06, 0, 0.38), 0.018, 0.10, bark, verts=8,
        rot=(0, 0, math.radians(10)))
    # 3 canopy puffs (cloud forms typical of bonsai)
    uv_sph('Puff1', (-0.10, 0, 0.32), 0.08, leaf, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.55)
    uv_sph('Puff2', (0.10, 0, 0.40), 0.10, leaf_d, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.50)
    uv_sph('Puff3', (0.04, 0, 0.50), 0.09, leaf, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.55)
    # Tiny decorative rocks
    uv_sph('Rock1', (-0.10, -0.06, 0.14), 0.025,
           pbr('BoRock1', (0.42, 0.40, 0.38), 0.95), segs=8, rings=6)
    uv_sph('Rock2', (0.12, 0.08, 0.14), 0.020,
           pbr('BoRock2', (0.55, 0.52, 0.48), 0.95), segs=8, rings=6)
    join_and_export('bonsai')


# ─── 8. INCENSE BURNER ───────────────────────────────────────────────
def build_incense_burner():
    """Bronze incense burner (koro) w/ legged base, ash, smoldering sticks."""
    clear_scene()
    bronze = pbr('IbBronze', (0.55, 0.40, 0.18), 0.50, metal=0.65)
    bronze_d = pbr('IbBronzeD', (0.30, 0.22, 0.10), 0.55, metal=0.65)
    ash = pbr('IbAsh', (0.65, 0.62, 0.55), 0.92)
    stick = pbr('IbStick', (0.32, 0.20, 0.12), 0.92)
    glow = pbr('IbGlow', (1.0, 0.55, 0.20), 0.30,
               emit=(1.0, 0.55, 0.20), emit_strength=3.0)
    # Body — bowl
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, 0, 0.22),
                                          segments=22, ring_count=14)
    o = bpy.context.active_object; o.name = 'Body'
    o.scale = (1.0, 1.0, 0.55)
    o.data.materials.append(bronze)
    # Lower band
    torus('BandLow', (0, 0, 0.15), 0.135, 0.018, bronze_d, maj=20, min_=8)
    # Upper rim
    torus('Rim', (0, 0, 0.27), 0.145, 0.020, bronze_d, maj=20, min_=8)
    # Ash inside (flat disc)
    cyl('Ash', (0, 0, 0.260), 0.13, 0.005, ash, verts=18)
    # 3 short legs (tripod)
    for i in range(3):
        ang = i / 3 * math.pi * 2
        lx = math.cos(ang) * 0.10
        ly = math.sin(ang) * 0.10
        cyl(f'Leg_{i}', (lx, ly, 0.06), 0.018, 0.12, bronze, verts=8)
        # Foot pad
        uv_sph(f'Foot_{i}', (lx, ly, 0.005), 0.025, bronze_d, segs=8, rings=6)
        o = bpy.context.active_object; o.scale = (1.2, 1.2, 0.5)
    # 3 incense sticks at angles, w/ glowing tips
    rng = random.Random(151)
    for i in range(3):
        ang_x = math.radians(rng.random()*30 - 15)
        ang_y = math.radians(rng.random()*30 - 15)
        ox = (rng.random()-0.5)*0.06
        oy = (rng.random()-0.5)*0.06
        # Stick
        cyl(f'Stick_{i}', (ox, oy, 0.36), 0.005, 0.20, stick, verts=4,
            rot=(ang_x, ang_y, 0))
        # Glowing tip
        uv_sph(f'Glow_{i}', (ox + ang_y*0.10, oy - ang_x*0.10, 0.45), 0.008, glow,
               segs=6, rings=4)
    # Knob on lid (decorative — no actual lid here, but ornamental orb above)
    # Skip — bowl is open
    # Decorative engraved ring
    torus('Engraving', (0, 0, 0.22), 0.155, 0.005, bronze_d, maj=24, min_=4)
    join_and_export('incense_burner')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_food_stall()
    build_ramen_cart()
    build_dango_skewers()
    build_taiyaki()
    build_onigiri_set()
    build_tsukimi_tray()
    build_bonsai()
    build_incense_burner()
    print(f'[DONE] pack v14 exported to {OUT_DIR}')
