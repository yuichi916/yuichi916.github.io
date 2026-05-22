"""
Pack v4 — nature/animal kit. Original procedural Blender meshes.
Run headless:
  blender --background --python build_pack_v4.py
"""
import bpy, os, math

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


def box(name, loc, sz, mat=None, bevel=0.0, subsurf=0, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name; o.scale = sz
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


def uv_sph(name, loc, r, mat=None, segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=rings)
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


# ─── ANIMALS (stylized chibi-proportioned) ────────────────────────────
def build_deer():
    """Stylized deer — slim legs, oval body, small head with antlers."""
    clear_scene()
    fur = pbr('DeerFur', (0.65, 0.45, 0.25), 0.92)
    fur_dark = pbr('DeerDark', (0.32, 0.20, 0.10), 0.92)
    antler = pbr('Antler', (0.78, 0.68, 0.42), 0.85)
    nose = pbr('DeerNose', (0.18, 0.10, 0.08), 0.50)
    # Body
    uv_sph('DeerBody', (0, 0, 0.65), 0.28, fur, segs=24, rings=18)
    o = bpy.context.active_object; o.scale = (1.4, 0.85, 0.85)
    # Chest
    uv_sph('DeerChest', (0, 0.34, 0.68), 0.22, fur, segs=18, rings=14)
    # 4 thin legs
    for x in [-0.18, 0.18]:
        for y in [-0.22, 0.22]:
            cyl(f'Leg_{x}_{y}', (x, y, 0.30), 0.04, 0.55, fur_dark, verts=8)
    # Neck
    cyl('DeerNeck', (0, 0.40, 0.92), 0.07, 0.35, fur, verts=12, rot=(0.35, 0, 0))
    # Head
    uv_sph('DeerHead', (0, 0.55, 1.10), 0.13, fur, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.15, 0.95)
    # Snout
    box('DeerSnout', (0, 0.70, 1.05), (0.10, 0.10, 0.08), fur, bevel=0.01)
    uv_sph('DeerNose', (0, 0.76, 1.04), 0.025, nose, segs=10, rings=8)
    # Ears
    for x in [-0.08, 0.08]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.0, depth=0.10,
                                         location=(x, 0.50, 1.20), vertices=8)
        bpy.context.active_object.data.materials.append(fur_dark)
    # Antlers (2 branching cylinders each side)
    for x_sign in [-1, 1]:
        cyl(f'Antler_main_{x_sign}', (x_sign*0.05, 0.50, 1.25), 0.012, 0.20, antler, verts=8,
            rot=(0.4, 0, x_sign*0.3))
        cyl(f'Antler_branch_{x_sign}', (x_sign*0.10, 0.52, 1.35), 0.010, 0.14, antler, verts=8,
            rot=(0.6, 0, x_sign*0.6))
    # Tail (small puff)
    uv_sph('DeerTail', (0, -0.40, 0.72), 0.06, fur, segs=10, rings=8)
    join_and_export('deer')


def build_fox():
    """Stylized fox — orange fur, pointed ears, bushy tail."""
    clear_scene()
    fur = pbr('FoxFur', (0.86, 0.42, 0.16), 0.90)
    fur_white = pbr('FoxWhite', (0.94, 0.92, 0.86), 0.88)
    fur_dark = pbr('FoxDark', (0.32, 0.16, 0.04), 0.85)
    nose = pbr('FoxNose', (0.12, 0.06, 0.04), 0.45)
    # Body
    uv_sph('FoxBody', (0, 0, 0.32), 0.22, fur, segs=22, rings=16)
    o = bpy.context.active_object; o.scale = (1.3, 0.85, 0.85)
    # Chest white
    uv_sph('FoxChest', (0, 0.20, 0.28), 0.13, fur_white, segs=16, rings=12)
    # 4 small legs
    for x in [-0.13, 0.13]:
        for y in [-0.15, 0.15]:
            cyl(f'FLeg_{x}_{y}', (x, y, 0.14), 0.035, 0.24, fur_dark, verts=8)
    # Head
    uv_sph('FoxHead', (0, 0.32, 0.40), 0.14, fur, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.2, 0.95)
    # Snout (pointed)
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, radius2=0.03, depth=0.12,
                                     location=(0, 0.46, 0.38), vertices=10)
    o = bpy.context.active_object; o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(fur)
    uv_sph('FoxNose', (0, 0.52, 0.38), 0.02, nose, segs=8, rings=6)
    # Ears (pointed cones)
    for x in [-0.08, 0.08]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.0, depth=0.14,
                                         location=(x, 0.28, 0.52), vertices=8)
        bpy.context.active_object.data.materials.append(fur)
    # Bushy tail (sphere)
    uv_sph('FoxTail', (0, -0.30, 0.38), 0.13, fur, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (0.7, 1.5, 0.7)
    # Tail tip white
    uv_sph('FoxTailTip', (0, -0.45, 0.42), 0.07, fur_white, segs=12, rings=8)
    join_and_export('fox')


def build_cat():
    """Stylized cat — sleek body, perked ears, long tail."""
    clear_scene()
    fur = pbr('CatFur', (0.20, 0.16, 0.12), 0.92)
    fur_belly = pbr('CatBelly', (0.86, 0.82, 0.78), 0.92)
    nose = pbr('CatNose', (0.92, 0.62, 0.66), 0.50)
    # Body
    uv_sph('CatBody', (0, 0, 0.22), 0.16, fur, segs=20, rings=14)
    o = bpy.context.active_object; o.scale = (1.3, 0.85, 0.85)
    uv_sph('CatBelly', (0, 0.12, 0.18), 0.10, fur_belly, segs=14, rings=10)
    # Legs (short)
    for x in [-0.08, 0.08]:
        for y in [-0.12, 0.12]:
            cyl(f'CLeg_{x}_{y}', (x, y, 0.09), 0.03, 0.18, fur, verts=8)
    # Head
    uv_sph('CatHead', (0, 0.22, 0.30), 0.10, fur, segs=18, rings=14)
    # Ears (triangular cones)
    for x in [-0.06, 0.06]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.035, radius2=0.0, depth=0.08,
                                         location=(x, 0.18, 0.40), vertices=6)
        bpy.context.active_object.data.materials.append(fur)
    # Tiny nose
    uv_sph('CatNose', (0, 0.32, 0.28), 0.015, nose, segs=8, rings=6)
    # Whiskers (4 thin boxes — 2 each side)
    for s in [-1, 1]:
        for y in [-0.01, 0.02]:
            box(f'Whisker_{s}_{y}', (s*0.08, 0.31, 0.27+y), (0.08, 0.003, 0.003), fur_belly)
    # Long curled tail (sequence of cylinders)
    for i in range(5):
        t = i / 5
        cyl(f'CatTail_{i}', (math.sin(i*0.5)*0.04, -0.20 - i*0.07, 0.20 + i*0.05),
            0.025 - i*0.002, 0.10, fur, verts=8)
    join_and_export('cat')


def build_bird_perched():
    """Small perched songbird (chickadee-like)."""
    clear_scene()
    body = pbr('BirdBody', (0.45, 0.35, 0.20), 0.85)
    belly = pbr('BirdBelly', (0.92, 0.85, 0.60), 0.85)
    beak = pbr('BirdBeak', (0.18, 0.10, 0.04), 0.40)
    eye = pbr('BirdEye', (0.04, 0.02, 0.02), 0.30)
    uv_sph('BirdBody', (0, 0, 0.15), 0.10, body, segs=18, rings=14)
    o = bpy.context.active_object; o.scale = (1.0, 1.25, 0.95)
    uv_sph('BirdBelly', (0, 0.05, 0.13), 0.07, belly, segs=14, rings=10)
    # Head
    uv_sph('BirdHead', (0, 0.10, 0.22), 0.07, body, segs=16, rings=12)
    # Beak
    bpy.ops.mesh.primitive_cone_add(radius1=0.02, radius2=0.0, depth=0.05,
                                     location=(0, 0.17, 0.22), vertices=6,
                                     rotation=(math.pi/2, 0, 0))
    bpy.context.active_object.data.materials.append(beak)
    # Eyes
    uv_sph('BirdEyeL', (-0.04, 0.14, 0.24), 0.012, eye, segs=8, rings=6)
    uv_sph('BirdEyeR', (0.04, 0.14, 0.24), 0.012, eye, segs=8, rings=6)
    # Wings (flat planes folded against body)
    box('WingL', (-0.08, 0.0, 0.16), (0.025, 0.13, 0.08), body, rot=(0, 0, 0.2))
    box('WingR', (0.08, 0.0, 0.16), (0.025, 0.13, 0.08), body, rot=(0, 0, -0.2))
    # Tail
    box('BirdTail', (0, -0.13, 0.16), (0.05, 0.08, 0.015), body, rot=(0.3, 0, 0))
    # Feet
    for x in [-0.03, 0.03]:
        cyl(f'BirdFoot_{x}', (x, 0.0, 0.07), 0.005, 0.05, beak, verts=6)
    join_and_export('bird_perched')


# ─── FLORA ────────────────────────────────────────────────────────────
def build_lotus():
    """Standing lotus flower (open bloom on stalk)."""
    clear_scene()
    petal_pink = pbr('LotusPink', (0.98, 0.78, 0.86), 0.55,
                     emit=(1.0, 0.62, 0.72), emit_strength=0.2)
    petal_inner = pbr('LotusInner', (1.0, 0.92, 0.82), 0.55)
    center = pbr('LotusCenter', (0.96, 0.88, 0.36), 0.65,
                 emit=(1.0, 0.85, 0.30), emit_strength=0.4)
    stem = pbr('LotusStem', (0.18, 0.42, 0.18), 0.85)
    leaf = pbr('LotusLeaf', (0.22, 0.55, 0.28), 0.65)
    # Stem (tall)
    cyl('LotusStem', (0, 0, 0.50), 0.025, 1.00, stem, verts=10)
    # Pad/leaf at water level (slightly tilted)
    cyl('LotusPad', (0.30, 0.05, 0.02), 0.45, 0.02, leaf, verts=20)
    # Outer petals (8 pointed, splayed outward)
    for i in range(8):
        ang = i * math.pi * 2 / 8
        bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.0, depth=0.18,
                                         location=(math.sin(ang)*0.08, math.cos(ang)*0.08, 1.05),
                                         vertices=8,
                                         rotation=(math.cos(ang)*0.6, -math.sin(ang)*0.6, 0))
        bpy.context.active_object.data.materials.append(petal_pink)
    # Inner petals (4 vertical, lighter)
    for i in range(4):
        ang = i * math.pi * 2 / 4 + math.pi/4
        bpy.ops.mesh.primitive_cone_add(radius1=0.035, radius2=0.0, depth=0.14,
                                         location=(math.sin(ang)*0.03, math.cos(ang)*0.03, 1.10),
                                         vertices=8,
                                         rotation=(math.cos(ang)*0.3, -math.sin(ang)*0.3, 0))
        bpy.context.active_object.data.materials.append(petal_inner)
    # Center pod
    uv_sph('LotusCenter', (0, 0, 1.13), 0.05, center, segs=14, rings=10)
    join_and_export('lotus')


def build_azalea_bush():
    """Flowering azalea bush — green foliage with pink blossom dots."""
    clear_scene()
    leaf = pbr('AzaleaLeaf', (0.18, 0.35, 0.20), 0.92)
    pink = pbr('AzaleaPink', (0.95, 0.30, 0.45), 0.78,
               emit=(1.0, 0.30, 0.50), emit_strength=0.15)
    pink_pale = pbr('AzaleaPalePink', (1.0, 0.62, 0.70), 0.75)
    # Cluster of 5 green spheres
    centers = []
    for i in range(5):
        ang = i * math.pi * 2 / 5
        cx, cy = math.sin(ang)*0.32, math.cos(ang)*0.32
        centers.append((cx, cy, 0.30 + (i % 2) * 0.08))
    centers.append((0, 0, 0.42))  # center top
    for i, (cx, cy, cz) in enumerate(centers):
        uv_sph(f'AzLeaf_{i}', (cx, cy, cz), 0.24, leaf, segs=18, rings=14)
    # 12 pink flower dots scattered on top
    for i in range(12):
        ang = i * math.pi * 2 / 12 + 0.3
        r = 0.20 + (i % 3) * 0.08
        cx = math.sin(ang) * r
        cy = math.cos(ang) * r
        cz = 0.45 + (i % 3) * 0.04
        c = pink if i % 2 == 0 else pink_pale
        uv_sph(f'AzFlower_{i}', (cx, cy, cz), 0.06, c, segs=12, rings=8)
    join_and_export('azalea_bush')


def build_bamboo_bundle():
    """Cluster of bamboo stalks (vertical)."""
    clear_scene()
    bamboo = pbr('Bamboo', (0.42, 0.66, 0.22), 0.78)
    bamboo_dark = pbr('BambooNode', (0.28, 0.50, 0.14), 0.82)
    leaf = pbr('BambooLeaf', (0.35, 0.62, 0.28), 0.78)
    # 5 stalks at varying heights and slight offsets
    for i in range(5):
        ang = i * math.pi * 2 / 5
        x = math.sin(ang) * 0.15
        y = math.cos(ang) * 0.15
        height = 2.4 + (i % 3) * 0.4
        cyl(f'Stalk_{i}', (x, y, height/2), 0.06, height, bamboo, verts=12)
        # Node rings
        for n in range(int(height / 0.45)):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.065, minor_radius=0.008,
                                              location=(x, y, n*0.45 + 0.10))
            bpy.context.active_object.data.materials.append(bamboo_dark)
        # Leaves at the top (4 angled planes)
        for k in range(4):
            kang = k * math.pi/2
            box(f'Leaf_{i}_{k}',
                (x + math.sin(kang)*0.15, y + math.cos(kang)*0.15, height - 0.1),
                (0.18, 0.04, 0.03), leaf,
                rot=(0.3, kang, 0))
    join_and_export('bamboo_bundle')


def build_moss_stone():
    """Large mossy boulder."""
    clear_scene()
    stone = pbr('MossStone', (0.45, 0.40, 0.32), 0.95)
    moss = pbr('MossGreen', (0.22, 0.42, 0.20), 0.95)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.45, location=(0, 0, 0.30), subdivisions=3)
    o = bpy.context.active_object; o.name = 'BoulderBody'
    o.scale = (1.4, 1.0, 0.85)
    o.data.materials.append(stone)
    # Moss patches (smaller spheres on top)
    for i in range(5):
        ang = i * math.pi * 2 / 5
        uv_sph(f'Moss_{i}', (math.sin(ang)*0.30, math.cos(ang)*0.20, 0.55),
               0.18, moss, segs=14, rings=10)
        o = bpy.context.active_object; o.scale.z = 0.4
    uv_sph('MossTop', (0, 0, 0.62), 0.22, moss, segs=18, rings=14)
    o = bpy.context.active_object; o.scale.z = 0.45
    join_and_export('moss_stone')


def build_water_basin():
    """Stone water basin (tsukubai) with bamboo dipper."""
    clear_scene()
    stone = pbr('BasinStone', (0.50, 0.44, 0.36), 0.94)
    water = pbr('BasinWater', (0.18, 0.42, 0.55), 0.10, 0.15,
                emit=(0.10, 0.30, 0.45), emit_strength=0.15)
    bamboo = pbr('BasinBamboo', (0.50, 0.36, 0.18), 0.85)
    cyl('BasinOuter', (0,0,0.20), 0.40, 0.40, stone, verts=18, bevel=0.02)
    cyl('BasinInner', (0,0,0.38), 0.32, 0.04, water, verts=18)
    cyl('BasinLip', (0,0,0.40), 0.40, 0.04, stone, verts=18)
    # Bamboo spout (angled cylinder over basin)
    cyl('SpoutPost', (-0.55, 0, 0.45), 0.025, 0.95, bamboo, verts=8)
    cyl('Spout', (-0.30, 0, 0.65), 0.025, 0.50, bamboo, verts=8, rot=(0, math.pi/2, 0))
    # Stones around basin
    for i in range(4):
        ang = i * math.pi/2 + math.pi/4
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.14, location=(math.sin(ang)*0.55, math.cos(ang)*0.55, 0.06), subdivisions=2)
        bpy.context.active_object.data.materials.append(stone)
        bpy.context.active_object.scale = (1.2, 0.95, 0.7)
    join_and_export('water_basin')


# ─── MAIN ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    builders = [
        ('deer',           build_deer),
        ('fox',            build_fox),
        ('cat',            build_cat),
        ('bird_perched',   build_bird_perched),
        ('lotus',          build_lotus),
        ('azalea_bush',    build_azalea_bush),
        ('bamboo_bundle',  build_bamboo_bundle),
        ('moss_stone',     build_moss_stone),
        ('water_basin',    build_water_basin),
    ]
    for name, fn in builders:
        try: fn()
        except Exception as e: print(f'[ERROR] {name}:', e)
    print('\n[DONE] pack v4 exported to', OUT_DIR)
