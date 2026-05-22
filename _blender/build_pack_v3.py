"""
Pack v3 — environment kit. Original procedural Blender meshes.
Run headless:
  blender --background --python build_pack_v3.py
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


def cone(name, loc, r1, r2, depth, mat=None, verts=32, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth,
                                     location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if mat: o.data.materials.append(mat)
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


# ─── ENVIRONMENT KIT ──────────────────────────────────────────────────
def build_cart():
    clear_scene()
    wood = pbr('CartWood', (0.38, 0.22, 0.10), 0.88)
    dark = pbr('CartDark', (0.16, 0.08, 0.03), 0.88)
    metal = pbr('CartMetal', (0.22, 0.18, 0.14), 0.42, 0.5)
    sack = pbr('CartSack', (0.78, 0.62, 0.40), 0.92)
    # Bed
    box('Bed', (0, 0, 0.42), (1.4, 0.85, 0.10), wood, bevel=0.015)
    # Sides
    box('SideF', (0, 0.40, 0.55), (1.4, 0.06, 0.32), wood, bevel=0.012)
    box('SideB', (0, -0.40, 0.55), (1.4, 0.06, 0.32), wood, bevel=0.012)
    box('SideL', (-0.68, 0, 0.55), (0.06, 0.85, 0.32), wood, bevel=0.012)
    box('SideR', (0.68, 0, 0.55), (0.06, 0.85, 0.32), wood, bevel=0.012)
    # Wheels
    for x in [-0.55, 0.55]:
        for y in [-0.42, 0.42]:
            cyl(f'Wheel_{x}_{y}', (x, y, 0.26), 0.26, 0.08, dark, verts=24, rot=(math.pi/2, 0, 0))
            # spokes (4 thin boxes)
            for k in range(4):
                ang = k * math.pi / 4
                box(f'Spk_{x}_{y}_{k}', (x, y, 0.26),
                    (0.04, 0.06, 0.42), metal, rot=(math.pi/2, ang, 0))
    # Axles
    box('AxleF', (0, 0.42, 0.26), (1.2, 0.04, 0.04), metal)
    box('AxleB', (0, -0.42, 0.26), (1.2, 0.04, 0.04), metal)
    # Tongue/handle
    cyl('Tongue', (0, 0.85, 0.46), 0.03, 0.90, wood, verts=10, rot=(math.pi/2, 0, 0))
    # 3 hay sacks on top
    for i in range(3):
        uv_sph(f'Sack_{i}', (-0.42 + i*0.42, 0, 0.78), 0.20, sack, segs=18, rings=12)
    join_and_export('cart')


def build_market_stall():
    clear_scene()
    wood = pbr('StallWood', (0.50, 0.32, 0.16), 0.85)
    dark = pbr('StallDark', (0.20, 0.10, 0.04), 0.85)
    cloth = pbr('StallCloth', (0.62, 0.18, 0.13), 0.78)
    cloth_alt = pbr('StallClothAlt', (0.86, 0.78, 0.52), 0.78)
    # Counter
    box('Counter', (0, 0, 0.50), (1.6, 0.6, 0.08), wood, bevel=0.012)
    box('CounterFront', (0, -0.30, 0.30), (1.6, 0.05, 0.42), wood, bevel=0.01)
    # 4 corner posts
    for x in [-0.75, 0.75]:
        for y in [-0.28, 0.28]:
            box(f'Post_{x}_{y}', (x, y, 1.10), (0.07, 0.07, 1.30), dark, bevel=0.01)
    # Roof — striped awning
    for i in range(5):
        c = cloth if i % 2 == 0 else cloth_alt
        box(f'Awning_{i}', (-0.64 + i*0.32, 0, 1.85), (0.32, 0.85, 0.04), c, rot=(0.18, 0, 0))
    # Top ridge beam
    box('Ridge', (0, 0, 1.95), (1.7, 0.04, 0.05), dark)
    # Items on counter
    uv_sph('Fruit1', (-0.40, 0.10, 0.62), 0.07, pbr('Fruit', (0.95, 0.32, 0.18), 0.55), segs=14, rings=10)
    uv_sph('Fruit2', (-0.25, 0.05, 0.62), 0.07, pbr('Fruit2', (0.92, 0.78, 0.20), 0.55), segs=14, rings=10)
    uv_sph('Fruit3', (-0.10, 0.10, 0.62), 0.07, pbr('Fruit3', (0.78, 0.18, 0.38), 0.55), segs=14, rings=10)
    # Loaf / bread block
    box('Bread', (0.30, 0.05, 0.61), (0.20, 0.10, 0.08), pbr('Bread', (0.78, 0.55, 0.30), 0.85), bevel=0.01)
    box('Bread2', (0.30, -0.10, 0.61), (0.20, 0.10, 0.08), pbr('Bread2', (0.82, 0.60, 0.32), 0.85), bevel=0.01)
    # Sign hanging from front
    box('SignBoard', (-0.55, -0.32, 0.18), (0.30, 0.03, 0.20),
        pbr('SignSlat', (0.96, 0.86, 0.58), 0.85), bevel=0.008)
    join_and_export('market_stall')


def build_stone_wall():
    """Long stacked-stone wall segment."""
    clear_scene()
    stone1 = pbr('StoneA', (0.62, 0.55, 0.42), 0.92)
    stone2 = pbr('StoneB', (0.54, 0.46, 0.34), 0.94)
    stone3 = pbr('StoneC', (0.66, 0.58, 0.44), 0.92)
    # Foundation
    box('WallBase', (0, 0, 0.10), (3.0, 0.5, 0.20), stone2, bevel=0.02)
    # Stacked stones (3 rows of varying stones)
    rows = 4
    cols = 10
    for r in range(rows):
        for c in range(cols):
            x = -1.35 + c * 0.30 + (r % 2) * 0.10
            if x > 1.45: continue
            sz = (0.28 + (c % 3) * 0.02, 0.42, 0.20 + (r % 2) * 0.04)
            mat_choice = [stone1, stone2, stone3][(r*cols + c) % 3]
            box(f'Stone_{r}_{c}', (x, 0, 0.30 + r * 0.22), sz, mat_choice, bevel=0.015)
    # Top cap stones
    for c in range(6):
        x = -1.30 + c * 0.50
        box(f'TopCap_{c}', (x, 0, 1.30), (0.45, 0.42, 0.10),
            pbr('Cap', (0.46, 0.40, 0.30), 0.92), bevel=0.02)
    join_and_export('stone_wall')


def build_gate_arch():
    """Stone gate archway (larger than torii)."""
    clear_scene()
    stone = pbr('GateStone', (0.66, 0.60, 0.48), 0.92)
    dark = pbr('GateDark', (0.32, 0.26, 0.20), 0.92)
    # Two thick pillars (square)
    for x in [-1.5, 1.5]:
        box(f'Pillar_{x}', (x, 0, 1.30), (0.50, 0.55, 2.60), stone, bevel=0.025)
        # Decorative cap
        box(f'PillarCap_{x}', (x, 0, 2.65), (0.65, 0.70, 0.18), dark, bevel=0.02)
        # Base ring
        box(f'PillarBase_{x}', (x, 0, 0.10), (0.65, 0.70, 0.20), dark, bevel=0.02)
    # Arch (half torus)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.5, minor_radius=0.22,
                                      location=(0, 0, 2.80), major_segments=24)
    o = bpy.context.active_object; o.name = 'Arch'
    o.rotation_euler = (math.pi/2, 0, 0)
    o.scale.z = 1.2
    o.data.materials.append(stone)
    # Keystone (decorative center stone)
    box('KeyStone', (0, 0, 4.25), (0.32, 0.60, 0.42), dark, bevel=0.02)
    # Crown beam at top
    box('Crown', (0, 0, 4.55), (3.6, 0.50, 0.30), stone, bevel=0.03)
    join_and_export('gate_arch')


def build_pot():
    """Decorative ceramic pot."""
    clear_scene()
    ceramic = pbr('Ceramic', (0.42, 0.32, 0.28), 0.45, 0.0)
    plant = pbr('PotPlant', (0.28, 0.50, 0.22), 0.85)
    # Pot body — wider top, narrower base
    cyl('PotBase', (0,0,0.05), 0.22, 0.10, ceramic, verts=22, bevel=0.012)
    bpy.ops.mesh.primitive_cone_add(radius1=0.22, radius2=0.38, depth=0.50,
                                     location=(0,0,0.35), vertices=22)
    o = bpy.context.active_object; o.name='PotMid'
    o.data.materials.append(ceramic)
    cyl('PotRim', (0,0,0.62), 0.38, 0.06, ceramic, verts=22, bevel=0.01)
    # Plant (3 spheres for foliage)
    for i in range(3):
        ang = i * math.pi * 2 / 3
        uv_sph(f'Leaves_{i}', (math.sin(ang)*0.15, math.cos(ang)*0.15, 0.85),
               0.20, plant, segs=18, rings=14)
    uv_sph('LeavesTop', (0, 0, 1.00), 0.16, plant, segs=18, rings=14)
    join_and_export('pot')


def build_chochin():
    """Hanging paper chochin lantern."""
    clear_scene()
    paper = pbr('ChochinPaper', (0.92, 0.80, 0.46), 0.55,
                emit=(1.0, 0.70, 0.36), emit_strength=1.4)
    cap = pbr('ChochinCap', (0.18, 0.06, 0.02), 0.85)
    cord = pbr('ChochinCord', (0.12, 0.06, 0.03), 0.92)
    # Spherical body (oblate)
    uv_sph('ChochinBody', (0,0,0), 0.28, paper, segs=22, rings=18)
    o = bpy.context.active_object; o.scale.z = 1.25
    # Top cap
    cyl('ChochinTop', (0, 0, 0.36), 0.12, 0.04, cap, verts=14)
    cyl('ChochinTop2', (0, 0, 0.40), 0.08, 0.04, cap, verts=14)
    # Bottom cap
    cyl('ChochinBot', (0, 0, -0.36), 0.10, 0.04, cap, verts=14)
    # Hanging cord (going up)
    cyl('Cord', (0, 0, 0.65), 0.012, 0.50, cord, verts=8)
    # Horizontal ring bands
    bpy.ops.mesh.primitive_torus_add(major_radius=0.27, minor_radius=0.008, location=(0,0,-0.15))
    bpy.context.active_object.data.materials.append(cap)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.27, minor_radius=0.008, location=(0,0,0.15))
    bpy.context.active_object.data.materials.append(cap)
    join_and_export('chochin')


def build_crate_stack():
    """Stack of 3 wooden crates."""
    clear_scene()
    wood = pbr('CrateWood', (0.42, 0.26, 0.12), 0.88)
    dark = pbr('CrateDark', (0.16, 0.08, 0.03), 0.85)
    # Three crates of varying size
    def make_crate(z, w):
        box(f'C_{z}_box', (0, 0, z), (w, w, w*0.7), wood, bevel=0.02)
        # Slats (visible plank gaps)
        for s in range(3):
            box(f'Slat_{z}_{s}', (0, 0, z), (w*1.02, w*0.04, 0.04), dark, rot=(0, 0, s*math.pi/3))
    make_crate(0.25, 0.50)
    make_crate(0.75, 0.40)
    make_crate(1.05, 0.30)
    join_and_export('crate_stack')


def build_wood_fence():
    """Wooden picket fence segment."""
    clear_scene()
    wood = pbr('FenceWood', (0.62, 0.42, 0.22), 0.88)
    # 2 horizontal rails
    box('RailT', (0, 0, 0.95), (2.4, 0.06, 0.06), wood, bevel=0.005)
    box('RailB', (0, 0, 0.35), (2.4, 0.06, 0.06), wood, bevel=0.005)
    # 7 picket boards (pointed top)
    for i in range(7):
        x = -1.0 + i * 0.34
        box(f'Picket_{i}', (x, 0, 0.6), (0.10, 0.04, 1.20), wood, bevel=0.008)
        # Point tip (small triangle approximated by a cube)
        bpy.ops.mesh.primitive_cone_add(radius1=0.07, radius2=0.0, depth=0.14,
                                         location=(x, 0, 1.27), vertices=4)
        bpy.context.active_object.data.materials.append(wood)
    join_and_export('wood_fence')


def build_brazier():
    """Iron brazier with embers (decorative fire prop)."""
    clear_scene()
    iron = pbr('BrazierIron', (0.18, 0.12, 0.08), 0.45, 0.35)
    coal = pbr('BrazierCoal', (0.20, 0.10, 0.05), 0.85,
               emit=(1.0, 0.42, 0.10), emit_strength=2.0)
    leg = pbr('BrazierLeg', (0.10, 0.06, 0.04), 0.50, 0.35)
    # Bowl
    cyl('BowlOuter', (0,0,0.65), 0.42, 0.20, iron, verts=20)
    cyl('BowlInner', (0,0,0.72), 0.38, 0.10, coal, verts=20)
    # Lip
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.025, location=(0,0,0.74))
    bpy.context.active_object.data.materials.append(iron)
    # 3 legs splayed
    for i in range(3):
        ang = i * math.pi * 2 / 3
        cyl(f'Leg_{i}', (math.sin(ang)*0.25, math.cos(ang)*0.25, 0.32),
            0.04, 0.65, leg, verts=8,
            rot=(math.cos(ang)*0.2, -math.sin(ang)*0.2, 0))
    # Coals visible above
    for i in range(5):
        ang = i * math.pi * 2 / 5
        uv_sph(f'Coal_{i}', (math.sin(ang)*0.12, math.cos(ang)*0.12, 0.80),
               0.06, coal, segs=12, rings=8)
    join_and_export('brazier')


def build_lily_pad_blue():
    """Lily pad with blue flower variant."""
    clear_scene()
    leaf = pbr('LilyLeaf2', (0.22, 0.50, 0.28), 0.65)
    flower = pbr('LilyBlue', (0.55, 0.65, 0.95), 0.55,
                 emit=(0.55, 0.70, 1.0), emit_strength=0.3)
    cyl('Pad', (0,0,0.02), 0.50, 0.03, leaf, verts=24)
    for i in range(5):
        ang = i * math.pi * 2 / 5
        uv_sph(f'Petal_{i}', (math.sin(ang)*0.06, math.cos(ang)*0.06, 0.10),
               0.06, flower, segs=14, rings=10)
    uv_sph('Center', (0,0,0.12), 0.05,
           pbr('LilyCenterY', (1.0, 0.90, 0.42), 0.50), segs=14, rings=10)
    join_and_export('lily_pad_blue')


def build_tea_pavilion():
    """Small open-air tea pavilion (4 posts, hipped roof, raised floor)."""
    clear_scene()
    wood = pbr('PavWood', (0.42, 0.25, 0.13), 0.85)
    dark = pbr('PavDark', (0.16, 0.08, 0.02), 0.85)
    roof = pbr('PavRoof', (0.22, 0.14, 0.08), 0.92)
    tatami = pbr('Tatami', (0.78, 0.68, 0.42), 0.90)
    # Stone base
    box('PavBase', (0,0,0.12), (2.0, 2.0, 0.20), pbr('PavStone', (0.50, 0.44, 0.36), 0.92), bevel=0.02)
    # Tatami floor on top
    box('PavFloor', (0,0,0.24), (1.85, 1.85, 0.04), tatami)
    # 4 corner posts
    for x in [-0.85, 0.85]:
        for y in [-0.85, 0.85]:
            box(f'PavPost_{x}_{y}', (x, y, 1.35), (0.12, 0.12, 2.2), wood, bevel=0.012)
    # Beams connecting posts at top
    for axis in ['x','y']:
        for s in [-1, 1]:
            if axis=='x':
                box(f'PavBeam_x_{s}', (0, s*0.85, 2.40), (2.0, 0.12, 0.12), dark, bevel=0.01)
            else:
                box(f'PavBeam_y_{s}', (s*0.85, 0, 2.40), (0.12, 2.0, 0.12), dark, bevel=0.01)
    # Hipped roof (pyramid)
    cone('PavRoof', (0, 0, 3.0), 1.35, 0.0, 1.0, roof, verts=4, rot=(0,0,math.pi/4))
    # Roof skirt
    box('PavRoofSkirt', (0,0,2.55), (2.4, 2.4, 0.10), roof, bevel=0.01)
    # Center finial
    cyl('PavFinial', (0,0,3.65), 0.05, 0.30, dark, verts=8)
    join_and_export('tea_pavilion')


# ─── MAIN ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    builders = [
        ('cart',          build_cart),
        ('market_stall',  build_market_stall),
        ('stone_wall',    build_stone_wall),
        ('gate_arch',     build_gate_arch),
        ('pot',           build_pot),
        ('chochin',       build_chochin),
        ('crate_stack',   build_crate_stack),
        ('wood_fence',    build_wood_fence),
        ('brazier',       build_brazier),
        ('lily_pad_blue', build_lily_pad_blue),
        ('tea_pavilion',  build_tea_pavilion),
    ]
    for name, fn in builders:
        try: fn()
        except Exception as e: print(f'[ERROR] {name}:', e)
    print('\n[DONE] pack v3 exported to', OUT_DIR)
