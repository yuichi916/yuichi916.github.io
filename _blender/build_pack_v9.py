"""
Pack v9 — character & creature expansion.
Builds:
  crane, frog, kitsune_mask, oni_mask, monk_w_staff, kappa, tanuki, kabuki_doll
Run headless:
  blender --background --python build_pack_v9.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(9)


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


# ─── 1. CRANE ────────────────────────────────────────────────────────
def build_crane():
    """Standing red-crowned crane — slender body, long legs, hooked neck."""
    clear_scene()
    white = pbr('CraneWhite', (0.95, 0.93, 0.88), 0.55)
    black = pbr('CraneBlack', (0.12, 0.10, 0.08), 0.55)
    red = pbr('CraneRed', (0.88, 0.16, 0.10), 0.50)
    beak = pbr('CraneBeak', (0.30, 0.26, 0.18), 0.60)
    leg = pbr('CraneLeg', (0.20, 0.16, 0.10), 0.85)
    # Legs (long thin cylinders)
    for x_sign in [-1, 1]:
        cyl(f'Leg_{x_sign}', (x_sign*0.05, 0, 0.45), 0.018, 0.90, leg, verts=8)
        # Foot
        for k in range(3):
            ang = (k - 1) * 0.4
            cone(f'Toe_{x_sign}_{k}', (x_sign*0.05 + math.sin(ang)*0.04, math.cos(ang)*0.04, 0.005),
                 0.012, 0.0, 0.06, leg, verts=4, rot=(math.pi/2 + 0.1, 0, ang))
    # Body — egg-shaped oblique
    uv_sph('Body', (0, 0, 0.95), 0.18, white, segs=20, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.6, 1.0)
    # Black tail feathers (rear)
    uv_sph('Tail', (0, -0.28, 0.95), 0.10, black, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (0.9, 1.0, 0.7)
    # Wing feathers (2 flat planes on sides)
    for x_sign in [-1, 1]:
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x_sign*0.18, 0, 0.95))
        o = bpy.context.active_object; o.name = f'Wing_{x_sign}'
        o.scale = (0.15, 0.45, 0.005)
        o.rotation_euler = (math.radians(15)*x_sign, 0, math.radians(85*x_sign))
        o.data.materials.append(white)
        # Black wingtip
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x_sign*0.18, -0.20, 0.85))
        o = bpy.context.active_object; o.name = f'WingTip_{x_sign}'
        o.scale = (0.10, 0.12, 0.005)
        o.rotation_euler = (math.radians(15)*x_sign, 0, math.radians(85*x_sign))
        o.data.materials.append(black)
    # S-curve neck — 5 small spheres
    neck_pts = [(0, 0.10, 1.10), (0, 0.16, 1.30), (0, 0.10, 1.50), (0, 0.18, 1.65), (0, 0.30, 1.75)]
    for i, p in enumerate(neck_pts):
        uv_sph(f'Neck_{i}', p, 0.05, white, segs=10, rings=8)
    # Head
    uv_sph('Head', (0, 0.36, 1.78), 0.07, white, segs=12, rings=10)
    # Red crown
    uv_sph('Crown', (0, 0.36, 1.85), 0.05, red, segs=10, rings=8)
    o = bpy.context.active_object; o.scale = (0.7, 0.9, 0.5)
    # Beak
    cone('Beak', (0, 0.52, 1.74), 0.025, 0.0, 0.18, beak, verts=8, rot=(math.pi/2, 0, 0))
    # Eyes
    for x_sign in [-1, 1]:
        uv_sph(f'Eye_{x_sign}', (x_sign*0.04, 0.41, 1.79), 0.012, black, segs=6, rings=4)
    join_and_export('crane')


# ─── 2. FROG ─────────────────────────────────────────────────────────
def build_frog():
    """Small green frog sitting on a lily pad — bulgy eyes, hunched legs."""
    clear_scene()
    green = pbr('FrogGreen', (0.32, 0.55, 0.22), 0.70)
    green_d = pbr('FrogGreenD', (0.18, 0.32, 0.12), 0.78)
    belly = pbr('FrogBelly', (0.85, 0.88, 0.62), 0.65)
    eye = pbr('FrogEye', (0.94, 0.85, 0.28), 0.30,
              emit=(0.95, 0.85, 0.25), emit_strength=0.25)
    pupil = pbr('FrogPupil', (0.05, 0.05, 0.05), 0.40)
    # Body
    uv_sph('Body', (0, 0, 0.12), 0.14, green, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.1, 0.75)
    # Belly
    uv_sph('Belly', (0, 0, 0.06), 0.12, belly, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (0.85, 0.95, 0.45)
    # Hind legs (folded — small spheres + lower legs angled)
    for x_sign in [-1, 1]:
        uv_sph(f'HindThigh_{x_sign}', (x_sign*0.13, -0.05, 0.10), 0.07, green, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.3, 1.0, 0.7)
        # Lower hind leg pointing back
        cyl(f'HindCalf_{x_sign}', (x_sign*0.18, -0.13, 0.06), 0.025, 0.10, green_d, verts=8,
            rot=(math.radians(60), 0, x_sign*math.radians(20)))
        # Foot
        uv_sph(f'Foot_{x_sign}', (x_sign*0.22, -0.17, 0.04), 0.04, green_d, segs=8, rings=6)
        o = bpy.context.active_object; o.scale = (1.2, 1.4, 0.4)
    # Front legs (short, propping the body up)
    for x_sign in [-1, 1]:
        cyl(f'FrontLeg_{x_sign}', (x_sign*0.09, 0.10, 0.07), 0.02, 0.08, green_d, verts=8,
            rot=(0.4, 0, x_sign*0.3))
        uv_sph(f'FrontFoot_{x_sign}', (x_sign*0.10, 0.14, 0.03), 0.03, green_d, segs=8, rings=6)
    # Bulgy eyes on top of head
    for x_sign in [-1, 1]:
        uv_sph(f'EyeBump_{x_sign}', (x_sign*0.07, 0.10, 0.21), 0.05, green, segs=12, rings=10)
        uv_sph(f'Eye_{x_sign}', (x_sign*0.07, 0.10, 0.24), 0.035, eye, segs=10, rings=8)
        uv_sph(f'Pupil_{x_sign}', (x_sign*0.07, 0.13, 0.245), 0.013, pupil, segs=6, rings=4)
    # Spots on back (3 small dark spheres)
    for i, (x, y) in enumerate([(-0.06, -0.02), (0.05, -0.08), (0.02, 0.04)]):
        uv_sph(f'Spot_{i}', (x, y, 0.20), 0.020, green_d, segs=8, rings=6)
    join_and_export('frog')


# ─── 3. KITSUNE MASK ─────────────────────────────────────────────────
def build_kitsune_mask():
    """Stylized fox mask on a stand — white face with red markings, golden ears."""
    clear_scene()
    white = pbr('MaskWhite', (0.94, 0.92, 0.88), 0.45)
    red = pbr('MaskRed', (0.92, 0.18, 0.10), 0.45)
    gold = pbr('MaskGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    black = pbr('MaskBlack', (0.10, 0.08, 0.06), 0.55)
    wood = pbr('MaskWood', (0.32, 0.20, 0.12), 0.92)
    # Wooden stand
    box('Stand', (0, 0, 0.05), (0.40, 0.30, 0.10), wood, bevel=0.01)
    cyl('Post', (0, 0, 0.30), 0.025, 0.50, wood, verts=10)
    # Mask face — flat-ish oval
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, 0.04, 0.55), segments=24, ring_count=18)
    o = bpy.context.active_object; o.name = 'Face'
    o.scale = (1.0, 0.35, 1.3)
    o.data.materials.append(white)
    # Pointed chin (cone elongation)
    cone('Chin', (0, 0.08, 0.35), 0.10, 0.02, 0.20, white, verts=10, rot=(math.pi/2, 0, 0))
    # Red markings — cheek arcs (small flat ovals)
    for x_sign in [-1, 1]:
        uv_sph(f'CheekRed_{x_sign}', (x_sign*0.12, 0.04, 0.50), 0.04, red, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.4, 0.2, 0.7)
    # Forehead red mark
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.005, 0.65))
    o = bpy.context.active_object; o.name = 'ForeheadRed'
    o.scale = (0.08, 0.005, 0.06)
    o.data.materials.append(red)
    # Eyes — slit ovals
    for x_sign in [-1, 1]:
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x_sign*0.08, -0.01, 0.58))
        o = bpy.context.active_object; o.name = f'Eye_{x_sign}'
        o.scale = (0.06, 0.005, 0.03)
        o.rotation_euler = (math.pi/2, 0, x_sign*math.radians(-15))
        o.data.materials.append(black)
    # Snout outline (red curve at bottom of face)
    box('SnoutLine', (0, -0.04, 0.42), (0.04, 0.005, 0.02), red)
    # Gold tipped ears (2 pointed triangles)
    for x_sign in [-1, 1]:
        cone(f'Ear_{x_sign}', (x_sign*0.13, 0.04, 0.75), 0.05, 0.0, 0.15, white, verts=6)
        cone(f'EarGold_{x_sign}', (x_sign*0.13, 0.04, 0.79), 0.03, 0.0, 0.08, gold, verts=6)
    join_and_export('kitsune_mask')


# ─── 4. ONI MASK ─────────────────────────────────────────────────────
def build_oni_mask():
    """Red demon mask with horns, fangs, scowling brow."""
    clear_scene()
    red = pbr('OniRed', (0.78, 0.12, 0.08), 0.50)
    red_d = pbr('OniRedDark', (0.50, 0.08, 0.06), 0.55)
    gold = pbr('OniGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    white = pbr('OniFang', (0.95, 0.92, 0.85), 0.55)
    black = pbr('OniBlack', (0.10, 0.08, 0.06), 0.55)
    wood = pbr('OniWood', (0.20, 0.12, 0.08), 0.92)
    # Wooden stand
    box('Stand', (0, 0, 0.05), (0.40, 0.30, 0.10), wood, bevel=0.01)
    cyl('Post', (0, 0, 0.30), 0.025, 0.50, wood, verts=10)
    # Face base
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.20, location=(0, 0.04, 0.58), segments=22, ring_count=16)
    o = bpy.context.active_object; o.name = 'Face'
    o.scale = (1.05, 0.40, 1.2)
    o.data.materials.append(red)
    # Forehead bump (the scowl ridge)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0, 0.01, 0.70), segments=12, ring_count=8)
    o = bpy.context.active_object; o.name = 'Brow'
    o.scale = (1.8, 0.30, 0.55)
    o.data.materials.append(red_d)
    # Horns — 2 thick cones curving outward
    for x_sign in [-1, 1]:
        cone(f'Horn_{x_sign}', (x_sign*0.14, 0.02, 0.82), 0.04, 0.005, 0.20, white, verts=8,
             rot=(0, x_sign*math.radians(20), 0))
        # Horn base ring
        torus(f'HornBase_{x_sign}', (x_sign*0.14, 0.02, 0.73), 0.045, 0.012, gold, maj=12, min_=4)
    # Eyebrows — angry V (two angled boxes)
    for x_sign in [-1, 1]:
        box(f'Brow_{x_sign}', (x_sign*0.09, -0.01, 0.66), (0.07, 0.008, 0.02), black,
            rot=(0, 0, x_sign*math.radians(-25)))
    # Eyes — gold with black pupils
    for x_sign in [-1, 1]:
        uv_sph(f'Eye_{x_sign}', (x_sign*0.08, -0.02, 0.58), 0.03, gold, segs=10, rings=8)
        uv_sph(f'Pupil_{x_sign}', (x_sign*0.08, -0.04, 0.58), 0.012, black, segs=6, rings=4)
    # Nose — wide stub
    box('Nose', (0, -0.02, 0.50), (0.05, 0.04, 0.05), red_d, bevel=0.005)
    # Mouth (open, snarling) — wide dark box
    box('Mouth', (0, -0.03, 0.42), (0.12, 0.02, 0.04), black)
    # 4 fangs (2 upper, 2 lower)
    for x_sign in [-1, 1]:
        cone(f'FangUp_{x_sign}', (x_sign*0.05, -0.04, 0.42), 0.012, 0.0, 0.04, white, verts=6,
             rot=(math.pi, 0, 0))
        cone(f'FangDn_{x_sign}', (x_sign*0.05, -0.04, 0.40), 0.012, 0.0, 0.04, white, verts=6)
    join_and_export('oni_mask')


# ─── 5. MONK WITH STAFF ──────────────────────────────────────────────
def build_monk_w_staff():
    """Standing monk in robe holding a shakujo (ringed staff)."""
    clear_scene()
    robe = pbr('MonkRobe', (0.62, 0.32, 0.16), 0.85)
    robe_d = pbr('MonkRobeD', (0.42, 0.20, 0.10), 0.88)
    skin = pbr('MonkSkin', (0.88, 0.72, 0.55), 0.65)
    wood = pbr('MonkStaff', (0.42, 0.28, 0.16), 0.92)
    gold = pbr('MonkGold', (0.85, 0.65, 0.18), 0.30, metal=0.7)
    sash = pbr('MonkSash', (0.85, 0.70, 0.25), 0.85)
    # Robe — wide cone shape from waist to ground
    cone('Robe', (0, 0, 0.45), 0.40, 0.20, 0.90, robe, verts=18)
    # Upper torso
    cyl('Torso', (0, 0, 1.00), 0.20, 0.30, robe, verts=14)
    # Sash (yellow band at waist)
    torus('Sash', (0, 0, 0.85), 0.21, 0.025, sash, maj=24, min_=8)
    # Shoulders (cloak draped)
    uv_sph('ShoulderL', (-0.18, 0, 1.10), 0.10, robe_d, segs=12, rings=8)
    uv_sph('ShoulderR', ( 0.18, 0, 1.10), 0.10, robe_d, segs=12, rings=8)
    # Head (shaved monk)
    uv_sph('Head', (0, 0, 1.30), 0.13, skin, segs=18, rings=14)
    # Closed eyes (thin dark lines)
    box('EyeL', (-0.05, 0.10, 1.32), (0.03, 0.005, 0.005),
        pbr('MonkEye', (0.10, 0.06, 0.04), 0.55))
    box('EyeR', ( 0.05, 0.10, 1.32), (0.03, 0.005, 0.005),
        pbr('MonkEye2', (0.10, 0.06, 0.04), 0.55))
    # Ears (small)
    for x_sign in [-1, 1]:
        uv_sph(f'Ear_{x_sign}', (x_sign*0.13, 0, 1.30), 0.025, skin, segs=8, rings=6)
    # Arms emerging from sleeves (held in front)
    for x_sign in [-1, 1]:
        cyl(f'SleeveU_{x_sign}', (x_sign*0.20, 0.05, 0.90), 0.08, 0.30, robe, verts=10,
            rot=(0.4, 0, x_sign*0.2))
        cyl(f'SleeveL_{x_sign}', (x_sign*0.20, 0.20, 0.75), 0.06, 0.20, robe_d, verts=10,
            rot=(0.8, 0, x_sign*0.3))
        # Hand
        uv_sph(f'Hand_{x_sign}', (x_sign*0.20, 0.28, 0.65), 0.04, skin, segs=8, rings=6)
    # Shakujo staff (right hand)
    cyl('Staff', (0.30, 0.25, 1.10), 0.018, 1.50, wood, verts=8)
    # Gold head with 6 rings
    cyl('StaffHead', (0.30, 0.25, 1.78), 0.04, 0.10, gold, verts=12)
    for i in range(6):
        ang = i / 6 * math.pi * 2
        torus(f'Ring_{i}', (0.30 + math.cos(ang)*0.05, 0.25 + math.sin(ang)*0.05, 1.80),
              0.025, 0.006, gold, maj=12, min_=4, rot=(math.pi/2, 0, 0))
    # Top finial
    uv_sph('StaffOrb', (0.30, 0.25, 1.92), 0.025, gold, segs=10, rings=8)
    join_and_export('monk_w_staff')


# ─── 6. KAPPA ────────────────────────────────────────────────────────
def build_kappa():
    """River-imp kappa — green skin, turtle shell, water dish on head."""
    clear_scene()
    green = pbr('KappaGreen', (0.32, 0.55, 0.32), 0.75)
    green_d = pbr('KappaGreenD', (0.18, 0.35, 0.18), 0.80)
    shell = pbr('KappaShell', (0.42, 0.30, 0.18), 0.90)
    water = pbr('KappaWater', (0.18, 0.36, 0.45), 0.25, metal=0.2,
                emit=(0.20, 0.40, 0.50), emit_strength=0.20)
    eye = pbr('KappaEye', (0.92, 0.85, 0.42), 0.30,
              emit=(0.95, 0.85, 0.40), emit_strength=0.25)
    pupil = pbr('KappaPupil', (0.05, 0.05, 0.05), 0.40)
    beak = pbr('KappaBeak', (0.78, 0.65, 0.20), 0.65)
    # Legs (short)
    for x_sign in [-1, 1]:
        cyl(f'Leg_{x_sign}', (x_sign*0.10, 0, 0.18), 0.05, 0.30, green, verts=8)
        uv_sph(f'Foot_{x_sign}', (x_sign*0.10, 0.06, 0.04), 0.06, green_d, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.1, 1.4, 0.5)
    # Body (round)
    uv_sph('Body', (0, 0, 0.45), 0.20, green, segs=20, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.0)
    # Turtle shell on back (large hemisphere)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.24, location=(0, -0.12, 0.50),
                                          segments=24, ring_count=14)
    o = bpy.context.active_object; o.name = 'Shell'
    o.scale = (1.0, 0.55, 1.0)
    o.data.materials.append(shell)
    # Shell hexagon pattern (5 small darker patches)
    for i, (x, y, z) in enumerate([(-0.10, -0.15, 0.60), (0.10, -0.18, 0.55),
                                     (0, -0.15, 0.68), (-0.05, -0.18, 0.48),
                                     (0.08, -0.16, 0.45)]):
        uv_sph(f'ShellPatch_{i}', (x, y, z), 0.04, green_d, segs=8, rings=6)
    # Arms
    for x_sign in [-1, 1]:
        cyl(f'Arm_{x_sign}', (x_sign*0.20, 0.05, 0.45), 0.045, 0.28, green, verts=8,
            rot=(0.2, 0, x_sign*0.2))
        uv_sph(f'Hand_{x_sign}', (x_sign*0.24, 0.10, 0.30), 0.05, green_d, segs=10, rings=6)
    # Head
    uv_sph('Head', (0, 0.05, 0.78), 0.14, green, segs=18, rings=14)
    # Water dish on top (flat cylinder with water disk)
    cyl('Dish', (0, 0.04, 0.90), 0.08, 0.025, green_d, verts=14)
    cyl('Water', (0, 0.04, 0.915), 0.06, 0.005, water, verts=12)
    # Beak (turtle-like)
    cone('Beak', (0, 0.18, 0.74), 0.05, 0.0, 0.10, beak, verts=8, rot=(math.pi/2, 0, 0))
    # Eyes
    for x_sign in [-1, 1]:
        uv_sph(f'Eye_{x_sign}', (x_sign*0.06, 0.12, 0.82), 0.030, eye, segs=10, rings=8)
        uv_sph(f'Pupil_{x_sign}', (x_sign*0.06, 0.14, 0.82), 0.013, pupil, segs=6, rings=4)
    join_and_export('kappa')


# ─── 7. TANUKI ───────────────────────────────────────────────────────
def build_tanuki():
    """Standing raccoon-dog statue (Shigaraki style) — round belly, straw hat, sake bottle."""
    clear_scene()
    fur = pbr('TanFur', (0.55, 0.42, 0.28), 0.92)
    fur_d = pbr('TanFurD', (0.30, 0.22, 0.12), 0.92)
    cream = pbr('TanCream', (0.92, 0.85, 0.62), 0.88)
    straw = pbr('TanStraw', (0.85, 0.68, 0.32), 0.95)
    porcelain = pbr('TanPorcelain', (0.95, 0.92, 0.88), 0.40)
    label = pbr('TanLabel', (0.85, 0.20, 0.12), 0.65)
    eye = pbr('TanEye', (0.10, 0.08, 0.06), 0.45)
    # Feet (short stubby)
    for x_sign in [-1, 1]:
        uv_sph(f'Foot_{x_sign}', (x_sign*0.10, 0.05, 0.05), 0.08, fur, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.1, 1.4, 0.5)
    # Body — round belly
    uv_sph('Body', (0, 0, 0.40), 0.30, fur, segs=22, rings=16)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 1.0)
    # Cream belly patch
    uv_sph('Belly', (0, 0.18, 0.35), 0.20, cream, segs=18, rings=12)
    o = bpy.context.active_object; o.scale = (1.0, 0.45, 1.0)
    # Arms
    for x_sign in [-1, 1]:
        cyl(f'Arm_{x_sign}', (x_sign*0.26, 0.10, 0.42), 0.055, 0.30, fur, verts=8,
            rot=(0.3, 0, x_sign*0.4))
    # Head
    uv_sph('Head', (0, 0.08, 0.78), 0.18, fur, segs=20, rings=14)
    # Face mask (cream cheeks)
    for x_sign in [-1, 1]:
        uv_sph(f'Cheek_{x_sign}', (x_sign*0.08, 0.16, 0.74), 0.07, cream, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 0.4, 1.0)
    # Dark eye patches (raccoon-mask)
    for x_sign in [-1, 1]:
        uv_sph(f'EyePatch_{x_sign}', (x_sign*0.07, 0.18, 0.80), 0.045, fur_d, segs=10, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 0.3, 1.0)
        uv_sph(f'Eye_{x_sign}', (x_sign*0.07, 0.22, 0.80), 0.014, eye, segs=6, rings=4)
    # Nose
    uv_sph('Nose', (0, 0.25, 0.74), 0.025, eye, segs=8, rings=6)
    # Ears (rounded triangles)
    for x_sign in [-1, 1]:
        cone(f'Ear_{x_sign}', (x_sign*0.13, 0.04, 0.92), 0.07, 0.02, 0.12, fur, verts=6)
        cone(f'EarInner_{x_sign}', (x_sign*0.13, 0.04, 0.95), 0.04, 0.0, 0.06, cream, verts=6)
    # Straw hat — flat cone on head
    cone('Hat', (0, 0.04, 1.00), 0.30, 0.18, 0.08, straw, verts=20)
    cyl('HatTop', (0, 0.04, 1.05), 0.04, 0.04, fur_d, verts=10)
    # Sake bottle in right hand
    cyl('Bottle', (0.32, 0.18, 0.45), 0.045, 0.18, porcelain, verts=12)
    cyl('BottleNeck', (0.32, 0.18, 0.56), 0.018, 0.05, porcelain, verts=8)
    # Label
    box('Label', (0.32, 0.225, 0.45), (0.06, 0.005, 0.10), label)
    # Tail
    uv_sph('Tail', (0, -0.32, 0.45), 0.10, fur, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (0.7, 1.4, 0.9)
    uv_sph('TailTip', (0, -0.42, 0.45), 0.07, fur_d, segs=10, rings=8)
    join_and_export('tanuki')


# ─── 8. KABUKI DOLL ──────────────────────────────────────────────────
def build_kabuki_doll():
    """Stylized kabuki actor doll on a stand — kimono pose, red kumadori face."""
    clear_scene()
    kimono_red = pbr('KdRed', (0.78, 0.18, 0.14), 0.65)
    kimono_white = pbr('KdWhite', (0.94, 0.92, 0.88), 0.65)
    kimono_gold = pbr('KdGold', (0.85, 0.68, 0.20), 0.50)
    face = pbr('KdFace', (0.95, 0.94, 0.90), 0.55)
    face_red = pbr('KdFaceRed', (0.88, 0.16, 0.12), 0.55)
    hair = pbr('KdHair', (0.08, 0.06, 0.04), 0.55)
    wood = pbr('KdWood', (0.32, 0.20, 0.12), 0.92)
    skin = pbr('KdSkin', (0.92, 0.78, 0.62), 0.65)
    # Stand
    box('Stand', (0, 0, 0.05), (0.45, 0.35, 0.10), wood, bevel=0.01)
    # Lower kimono — wide cone shape
    cone('Hakama', (0, 0, 0.40), 0.32, 0.20, 0.60, kimono_red, verts=18)
    # Mid kimono panel (white inner)
    box('KimonoInner', (0, 0.18, 0.40), (0.18, 0.04, 0.50), kimono_white, bevel=0.005)
    # Upper kimono (torso wrap)
    cyl('TorsoWrap', (0, 0, 0.85), 0.20, 0.30, kimono_red, verts=14)
    # Gold sash
    torus('Sash', (0, 0, 0.72), 0.215, 0.030, kimono_gold, maj=24, min_=8)
    # Wide sleeve cuffs (extending outward)
    for x_sign in [-1, 1]:
        box(f'Sleeve_{x_sign}', (x_sign*0.30, 0, 0.78), (0.20, 0.18, 0.32),
            kimono_red, bevel=0.01)
        # White cuff
        box(f'Cuff_{x_sign}', (x_sign*0.40, 0, 0.65), (0.05, 0.18, 0.10), kimono_white)
    # Neck + head
    cyl('Neck', (0, 0, 1.05), 0.04, 0.06, skin, verts=8)
    uv_sph('Head', (0, 0, 1.18), 0.12, face, segs=18, rings=14)
    # Red kumadori stripes (3 red lines on face)
    for i, z in enumerate([1.24, 1.18, 1.12]):
        box(f'Kumadori_{i}', (0, 0.105, z), (0.18, 0.005, 0.012), face_red,
            rot=(0, 0, math.radians(8 - i*8)))
    # Eyes — dramatic black slits
    for x_sign in [-1, 1]:
        box(f'Eye_{x_sign}', (x_sign*0.04, 0.115, 1.19), (0.035, 0.005, 0.008), hair,
            rot=(0, 0, x_sign*math.radians(-15)))
    # Mouth — small red O
    box('Mouth', (0, 0.115, 1.10), (0.025, 0.005, 0.008), face_red)
    # Topknot hair
    uv_sph('HairBack', (0, -0.06, 1.22), 0.13, hair, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 0.85, 0.95)
    cyl('Topknot', (0, -0.04, 1.32), 0.04, 0.10, hair, verts=8)
    uv_sph('TopknotEnd', (0, -0.04, 1.39), 0.045, hair, segs=10, rings=6)
    join_and_export('kabuki_doll')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_crane()
    build_frog()
    build_kitsune_mask()
    build_oni_mask()
    build_monk_w_staff()
    build_kappa()
    build_tanuki()
    build_kabuki_doll()
    print(f'[DONE] pack v9 exported to {OUT_DIR}')
