"""
Pack v19 — terrain features.
Builds:
  waterfall, rocky_cliff, cave_entrance, fishing_pier,
  mountain_silhouette, stone_curve_steps, cherry_branch_overhang, root_bench
Run headless:
  blender --background --python build_pack_v19.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(19)


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


# ─── 1. WATERFALL ────────────────────────────────────────────────────
def build_waterfall():
    """Tall cliff w/ cascading water column, mist pool, surrounding moss + rocks."""
    clear_scene()
    rock = pbr('WfRock', (0.42, 0.38, 0.32), 0.95)
    rock_d = pbr('WfRockD', (0.22, 0.20, 0.18), 0.95)
    moss = pbr('WfMoss', (0.32, 0.55, 0.24), 0.92)
    water = pbr('WfWater', (0.55, 0.78, 0.88), 0.20, metal=0.3,
                emit=(0.65, 0.85, 0.92), emit_strength=0.25)
    foam = pbr('WfFoam', (0.95, 0.95, 0.96), 0.40)
    foam_dim = pbr('WfFoamD', (0.85, 0.88, 0.90), 0.50)
    # Cliff backdrop (large jagged wall)
    rng = random.Random(201)
    # 3-tier vertical cliff face (large staggered boxes)
    for k in range(3):
        z = 1.4 + k * 1.0
        offset_x = (rng.random() - 0.5) * 0.4
        box(f'Cliff_{k}', (offset_x, -1.0, z), (2.2 + rng.random()*0.4, 0.6, 1.0), rock, bevel=0.05)
    # 8 jagged rock outcrops on the cliff face
    for i in range(10):
        x = (rng.random() - 0.5) * 2.0
        y = -0.7 + (rng.random() - 0.5) * 0.4
        z = 0.5 + rng.random() * 3.5
        uv_sph(f'Outcrop_{i}', (x, y, z), 0.18 + rng.random()*0.10, rock_d, segs=10, rings=8)
        o = bpy.context.active_object
        o.scale = (1.0 + rng.random()*0.5, 0.7, 1.0 + rng.random()*0.5)
    # Moss patches on cliff
    for i in range(6):
        x = (rng.random() - 0.5) * 1.6
        z = 0.8 + rng.random() * 3.0
        uv_sph(f'Moss_{i}', (x, -0.50, z), 0.15 + rng.random()*0.08, moss, segs=10, rings=8)
        o = bpy.context.active_object
        o.scale = (1.0 + rng.random()*0.4, 0.3, 1.0 + rng.random()*0.4)
    # Water column — vertical thick band from top to pool
    for k in range(5):
        z = 4.0 - k * 0.8
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.20, z))
        o = bpy.context.active_object; o.name = f'WaterSheet_{k}'
        o.scale = (0.45 + k*0.04, 0.20, 0.80)
        o.rotation_euler = (math.pi/2, 0, 0)
        o.data.materials.append(water)
        sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.04
    # Foam streaks along the falling water
    for i in range(8):
        z = 1.0 + i * 0.40
        ox = (rng.random() - 0.5) * 0.30
        cyl(f'Foam_{i}', (ox, -0.10, z), 0.025, 0.35, foam, verts=8,
            rot=(0, 0, math.radians(rng.random()*15 - 7)))
    # Mist cloud at base
    for i in range(8):
        ang = rng.random() * math.pi * 2
        r = 0.5 + rng.random() * 0.5
        uv_sph(f'Mist_{i}', (math.cos(ang)*r, 0.1 + math.sin(ang)*0.3*r, 0.35),
               0.18 + rng.random()*0.08, foam_dim, segs=10, rings=8)
        o = bpy.context.active_object
        o.scale = (1.4, 0.8, 0.6)
    # Pool (flat oval water at base)
    cyl('Pool', (0, 0.2, 0.05), 1.10, 0.08, water, verts=30)
    o = bpy.context.active_object; o.scale = (1.2, 0.95, 1.0)
    # Pool rim (rocks)
    for i in range(14):
        ang = i / 14 * math.pi * 2
        r = 1.05 + rng.random()*0.10
        uv_sph(f'PoolRock_{i}', (math.cos(ang)*r, 0.2 + math.sin(ang)*r*0.85, 0.07),
               0.10 + rng.random()*0.06, rock, segs=10, rings=6)
    # Falling-water splash ring (concentric foam discs)
    for k in range(3):
        torus(f'Splash_{k}', (0, 0.1, 0.10 + k*0.020), 0.30 + k*0.10, 0.020,
              foam, maj=24, min_=6)
    join_and_export('waterfall')


# ─── 2. ROCKY CLIFF ──────────────────────────────────────────────────
def build_rocky_cliff():
    """Standalone cliff outcrop — jagged stone formation w/ moss + grass tufts at top."""
    clear_scene()
    rock = pbr('RcRock', (0.45, 0.40, 0.34), 0.95)
    rock_d = pbr('RcRockD', (0.25, 0.22, 0.18), 0.95)
    moss = pbr('RcMoss', (0.32, 0.55, 0.24), 0.92)
    grass = pbr('RcGrass', (0.42, 0.65, 0.32), 0.85)
    bone = pbr('RcBone', (0.95, 0.92, 0.85), 0.85)  # weathered stone highlight
    rng = random.Random(211)
    # Base — large angular blob
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.80))
    o = bpy.context.active_object; o.name = 'CliffBase'
    o.scale = (2.2, 1.6, 1.60)
    o.rotation_euler = (0, 0, math.radians(12))
    o.data.materials.append(rock)
    b = o.modifiers.new('Bevel', 'BEVEL'); b.width = 0.10; b.segments = 3
    s = o.modifiers.new('Subsurf', 'SUBSURF'); s.levels = 1; s.render_levels = 1
    # 4 mid-level outcrops (staggered jagged blocks)
    for i in range(5):
        sx = (rng.random() - 0.5) * 1.8
        sy = (rng.random() - 0.5) * 1.2
        sz = 0.5 + rng.random() * 1.0
        box(f'Outcrop_{i}', (sx, sy, sz),
            (0.55 + rng.random()*0.30, 0.50 + rng.random()*0.30, 0.45 + rng.random()*0.30),
            rock, bevel=0.04,
            rot=(rng.random()*0.3, rng.random()*0.3, rng.random()*math.pi))
    # Top peak (cone-like)
    cone('Peak', (0, 0, 2.20), 0.80, 0.20, 0.70, rock_d, verts=8)
    # Stratification lines (3 horizontal narrow bands)
    for k in range(3):
        z = 0.40 + k * 0.40
        box(f'Strata_{k}', (0, 0, z), (2.20, 1.55, 0.06), rock_d)
    # Moss patches at base
    for i in range(6):
        ang = i / 6 * math.pi * 2
        r = 1.0 + rng.random() * 0.20
        uv_sph(f'Moss_{i}', (math.cos(ang)*r, math.sin(ang)*r*0.7, 0.15), 0.14, moss,
               segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.5, 1.5, 0.4)
    # Grass tufts on top (small protrusions)
    for i in range(6):
        ang = i / 6 * math.pi * 2 + rng.random()*0.5
        r = 0.4 * rng.random()
        for k in range(3):
            kx = math.cos(ang) * r + (rng.random()-0.5)*0.04
            ky = math.sin(ang) * r + (rng.random()-0.5)*0.04
            cyl(f'GrassBl_{i}_{k}', (kx, ky, 2.20 + 0.06), 0.005, 0.12, grass, verts=4,
                rot=(0, (rng.random()-0.5)*0.3, 0))
    # 2 weathered stones on top (bone-colored highlights)
    for i in range(2):
        uv_sph(f'WhiteStone_{i}', ((i-0.5)*0.5, (rng.random()-0.5)*0.4, 1.95), 0.08, bone,
               segs=10, rings=6)
    join_and_export('rocky_cliff')


# ─── 3. CAVE ENTRANCE ────────────────────────────────────────────────
def build_cave_entrance():
    """Arched rock cave opening — jagged frame around a dark interior, vines + ferns."""
    clear_scene()
    rock = pbr('CeRock', (0.42, 0.38, 0.32), 0.95)
    rock_d = pbr('CeRockD', (0.22, 0.20, 0.18), 0.95)
    moss = pbr('CeMoss', (0.32, 0.55, 0.24), 0.92)
    vine = pbr('CeVine', (0.30, 0.55, 0.22), 0.85)
    flower = pbr('CeFlower', (0.92, 0.85, 0.35), 0.65)
    dark = pbr('CeDark', (0.05, 0.04, 0.04), 0.85)
    rng = random.Random(221)
    # Outer arch — large box w/ arched cutout (approximate w/ 2 side pillars + top)
    # Left pillar
    box('PillarL', (-0.85, 0, 1.10), (0.60, 1.20, 2.20), rock, bevel=0.04)
    # Right pillar
    box('PillarR', ( 0.85, 0, 1.10), (0.60, 1.20, 2.20), rock, bevel=0.04)
    # Top arch (horizontal slab)
    box('Top', (0, 0, 2.30), (2.20, 1.20, 0.40), rock, bevel=0.04)
    # Inner dark cave (large dark plane recessed)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.55, 1.10))
    o = bpy.context.active_object; o.name = 'Dark'
    o.scale = (1.10, 0.005, 2.10)
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(dark)
    # Jagged rock chunks at the top of opening (stalactites)
    for i in range(5):
        x = -0.7 + i * 0.35
        cone(f'Stal_{i}', (x, 0.55, 2.05 - rng.random()*0.10), 0.10 + rng.random()*0.04,
             0.0, 0.16 + rng.random()*0.08, rock_d, verts=6, rot=(math.pi, 0, 0))
    # Jagged outcrops on the outside (3 per side)
    for x_sign in [-1, 1]:
        for k in range(4):
            sx = x_sign * (1.15 + rng.random()*0.20)
            sz = 0.50 + k * 0.55
            sy = (rng.random()-0.5) * 0.4
            uv_sph(f'OutOC_{x_sign}_{k}', (sx, sy, sz), 0.18 + rng.random()*0.08, rock,
                   segs=10, rings=8)
            o = bpy.context.active_object
            o.scale = (1.0 + rng.random()*0.5, 0.6, 1.0 + rng.random()*0.5)
    # Moss patches around the opening
    for i in range(8):
        ang = rng.random() * math.pi * 2
        r = 1.25 + rng.random()*0.2
        x = math.cos(ang) * r
        z = 1.10 + math.sin(ang) * 1.20
        uv_sph(f'Moss_{i}', (x, 0.04, z), 0.15 + rng.random()*0.06, moss, segs=10, rings=6)
        o = bpy.context.active_object
        o.scale = (1.4, 0.3, 1.0)
    # Vines hanging from the top arch
    for i in range(6):
        x = -0.7 + i * 0.28
        # Vine stem (cylinder hanging)
        L = 0.4 + rng.random() * 0.4
        cyl(f'Vine_{i}', (x, 0.10, 2.10 - L/2), 0.008, L, vine, verts=4)
        # Leaves dangling
        for k in range(3):
            zk = 2.10 - L + k * (L/3)
            bpy.ops.mesh.primitive_plane_add(size=1, location=(x + (rng.random()-0.5)*0.05,
                                                                0.08, zk))
            o = bpy.context.active_object; o.name = f'VineLeaf_{i}_{k}'
            o.scale = (0.04, 0.005, 0.08)
            o.rotation_euler = (math.radians(rng.random()*30 - 15),
                                math.radians(rng.random()*60 - 30), 0)
            o.data.materials.append(vine)
        # Small flower at the tip
        uv_sph(f'VineFlower_{i}', (x, 0.10, 2.10 - L - 0.02), 0.018, flower, segs=8, rings=6)
    # Small fern tufts at the base
    for i in range(5):
        sx = -1.0 + i * 0.5
        for k in range(4):
            kang = k / 4 * math.pi * 2
            bpy.ops.mesh.primitive_plane_add(size=1, location=(sx + math.cos(kang)*0.04, 0.08,
                                                                0.10 + math.sin(kang)*0.04))
            o = bpy.context.active_object; o.name = f'Fern_{i}_{k}'
            o.scale = (0.04, 0.005, 0.18)
            o.rotation_euler = (math.radians(20 + rng.random()*15), 0, kang)
            o.data.materials.append(vine)
    join_and_export('cave_entrance')


# ─── 4. FISHING PIER ─────────────────────────────────────────────────
def build_fishing_pier():
    """Wooden pier extending over water w/ railing, 2 mooring posts, hanging lantern."""
    clear_scene()
    wood = pbr('FpWood', (0.42, 0.28, 0.16), 0.92)
    wood_d = pbr('FpWoodD', (0.22, 0.14, 0.08), 0.92)
    wood_l = pbr('FpWoodL', (0.62, 0.42, 0.22), 0.90)
    rope = pbr('FpRope', (0.78, 0.62, 0.42), 0.95)
    paper = pbr('FpPaper', (0.95, 0.78, 0.45), 0.55,
                emit=(1.0, 0.78, 0.40), emit_strength=1.2)
    # Pier deck (long flat planks)
    box('Deck', (0, 0, 0.50), (3.20, 1.00, 0.06), wood, bevel=0.005)
    # 8 deck plank grooves (visual)
    for i in range(8):
        x = -1.40 + i * 0.40
        box(f'PlankLine_{i}', (x, 0, 0.532), (0.02, 0.95, 0.005), wood_d)
    # Underside support beams
    box('BeamL', (0, -0.40, 0.42), (3.10, 0.06, 0.10), wood_d)
    box('BeamR', (0, 0.40, 0.42), (3.10, 0.06, 0.10), wood_d)
    # 6 vertical pier posts (down into water)
    for i in range(3):
        x = -1.20 + i * 1.20
        for y_sign in [-1, 1]:
            cyl(f'Post_{i}_{y_sign}', (x, y_sign*0.42, 0.20), 0.05, 0.80, wood_d, verts=10)
            # Wet algae line at bottom (moss-like ring)
            torus(f'AlgaeRing_{i}_{y_sign}', (x, y_sign*0.42, -0.05), 0.055, 0.012,
                  pbr(f'FpAlgae_{i}_{y_sign}', (0.25, 0.40, 0.20), 0.95), maj=12, min_=4)
    # Railing — 4 vertical posts on the right side (left side open)
    for i in range(4):
        x = -1.30 + i * 0.85
        cyl(f'RailPost_{i}', (x, -0.45, 0.78), 0.020, 0.50, wood, verts=8)
        # Cap on top
        uv_sph(f'RailCap_{i}', (x, -0.45, 1.04), 0.025, wood_l, segs=10, rings=6)
    # Top rail bar
    box('RailBar', (0, -0.45, 1.00), (3.20, 0.04, 0.04), wood_l)
    # 2 large mooring posts at end (thicker)
    for i, y_sign in enumerate([-1, 1]):
        cyl(f'MoorPost_{i}', (1.50, y_sign*0.42, 0.80), 0.08, 0.70, wood_d, verts=12)
        # Coiled rope around top
        for k in range(3):
            torus(f'MoorRope_{i}_{k}', (1.50, y_sign*0.42, 1.05 + k*0.020), 0.090, 0.010,
                  rope, maj=14, min_=4)
        # Top dome
        uv_sph(f'MoorCap_{i}', (1.50, y_sign*0.42, 1.155), 0.085, wood_l, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.55)
    # Hanging paper lantern on a pole at the end of the pier
    cyl('LantPole', (1.55, 0, 1.20), 0.020, 0.80, wood, verts=8)
    uv_sph('Lantern', (1.55, -0.20, 1.45), 0.10, paper, segs=14, rings=10)
    o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
    cyl('LantCord', (1.55, -0.20, 1.56), 0.005, 0.12, wood_d, verts=4)
    # 3 small ripples in the water (toruses below)
    for k in range(3):
        torus(f'Ripple_{k}', (-0.50, 0.20, 0.05), 0.18 + k*0.10, 0.008,
              pbr(f'FpRipple_{k}', (0.55, 0.78, 0.85), 0.30,
                  emit=(0.65, 0.85, 0.92), emit_strength=0.20), maj=24, min_=4)
    join_and_export('fishing_pier')


# ─── 5. MOUNTAIN SILHOUETTE ──────────────────────────────────────────
def build_mountain_silhouette():
    """Distant 3-peak mountain backdrop — large dark silhouette w/ snow caps."""
    clear_scene()
    rock = pbr('MsRock', (0.32, 0.30, 0.32), 0.95)
    rock_d = pbr('MsRockD', (0.18, 0.18, 0.20), 0.95)
    snow = pbr('MsSnow', (0.92, 0.95, 0.98), 0.55)
    cloud = pbr('MsCloud', (0.95, 0.92, 0.95), 0.85,
                emit=(0.95, 0.92, 0.95), emit_strength=0.10)
    # 3 mountain peaks (cones at different sizes)
    peaks = [
        (-1.60, 0, 1.50, 1.20, 2.60),    # left mid-size
        (0, 0, 1.80, 1.50, 3.20),         # center tall
        (1.80, 0, 1.40, 1.10, 2.40),      # right
    ]
    for i, (x, y, z, r_base, h) in enumerate(peaks):
        cone(f'Peak_{i}', (x, y, z), r_base, 0.30, h, rock, verts=8)
        # Snow cap (smaller cone on top)
        cone(f'Snow_{i}', (x, y, z + h*0.40), r_base*0.45, 0.0, h*0.35, snow, verts=8)
        # Shadow side (smaller darker cone offset)
        cone(f'Shadow_{i}', (x + r_base*0.30, y, z), r_base*0.65, 0.20, h*0.85, rock_d, verts=8)
    # 4 distant smaller peaks behind
    rng = random.Random(231)
    for i in range(5):
        x = -2.5 + i * 1.30 + (rng.random()-0.5)*0.5
        z = 1.0 + rng.random()*0.6
        h = 1.5 + rng.random()*0.8
        r = 0.6 + rng.random()*0.4
        cone(f'BgPeak_{i}', (x, -0.5, z), r, 0.20, h, rock_d, verts=6)
    # 3 cloud bands floating in front of the mountains
    for i, (x, z) in enumerate([(-1.2, 2.5), (0.5, 3.0), (1.8, 2.4)]):
        uv_sph(f'Cloud_{i}', (x, 0.50, z), 0.45 + rng.random()*0.10, cloud, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (1.8, 0.6, 0.55)
    join_and_export('mountain_silhouette')


# ─── 6. STONE CURVE STEPS ────────────────────────────────────────────
def build_stone_curve_steps():
    """Curving stone staircase climbing a slope w/ railing posts + lanterns at top."""
    clear_scene()
    stone = pbr('CsStone', (0.62, 0.58, 0.50), 0.95)
    stone_d = pbr('CsStoneD', (0.42, 0.38, 0.32), 0.95)
    moss = pbr('CsMoss', (0.32, 0.55, 0.24), 0.92)
    wood = pbr('CsWood', (0.32, 0.20, 0.12), 0.92)
    # 12 stone steps curving from left to right
    rng = random.Random(241)
    for i in range(12):
        t = i / 11
        # Curving arc
        cx = math.sin(t * math.pi * 0.8) * 1.8
        cy = math.cos(t * math.pi * 0.8) * 1.0 - 1.0
        cz = t * 1.20
        # Tangent angle
        ang = math.atan2(math.cos(t * math.pi * 0.8) * math.pi * 0.8,
                          -math.sin(t * math.pi * 0.8) * math.pi * 0.8)
        # Slab
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
        o = bpy.context.active_object; o.name = f'Step_{i}'
        o.scale = (0.80, 0.40, 0.10)
        o.rotation_euler = (0, 0, ang)
        o.data.materials.append(stone if i % 2 == 0 else stone_d)
        # Moss on step edges (occasional)
        if rng.random() > 0.5:
            cyl(f'StepMoss_{i}', (cx + math.sin(ang)*0.25, cy - math.cos(ang)*0.25, cz + 0.06),
                0.06, 0.012, moss, verts=10)
    # 5 railing posts on the right side
    for i in range(5):
        t = i / 4
        cx = math.sin(t * math.pi * 0.8) * 1.8 + math.sin(math.atan2(math.cos(t * math.pi * 0.8) * math.pi * 0.8, -math.sin(t * math.pi * 0.8) * math.pi * 0.8)) * 0.42
        cy = math.cos(t * math.pi * 0.8) * 1.0 - 1.0 - math.cos(math.atan2(math.cos(t * math.pi * 0.8) * math.pi * 0.8, -math.sin(t * math.pi * 0.8) * math.pi * 0.8)) * 0.42
        cz = t * 1.20
        cyl(f'RailPost_{i}', (cx, cy, cz + 0.35), 0.030, 0.60, wood, verts=8)
    # Top lantern at the end of the staircase
    cyl('LantBase', (1.5, -1.1, 1.30), 0.10, 0.15, stone_d, verts=14)
    cyl('LantPillar', (1.5, -1.1, 1.45), 0.05, 0.20, stone, verts=12)
    cyl('LantMid', (1.5, -1.1, 1.60), 0.09, 0.05, stone_d, verts=14)
    box('LantChamber', (1.5, -1.1, 1.70), (0.13, 0.13, 0.16), stone, bevel=0.005)
    cone('LantRoof', (1.5, -1.1, 1.85), 0.15, 0.04, 0.10, stone, verts=8)
    uv_sph('LantOrb', (1.5, -1.1, 1.93), 0.025, stone, segs=10, rings=8)
    join_and_export('stone_curve_steps')


# ─── 7. CHERRY BRANCH OVERHANG ───────────────────────────────────────
def build_cherry_branch_overhang():
    """Single thick sakura branch extending horizontally w/ blossom clusters + petals dripping."""
    clear_scene()
    bark = pbr('CbBark', (0.32, 0.20, 0.12), 0.92)
    bark_l = pbr('CbBarkL', (0.55, 0.38, 0.20), 0.92)
    blossom = pbr('CbBlossom', (0.96, 0.82, 0.88), 0.78,
                  emit=(0.98, 0.86, 0.90), emit_strength=0.15)
    blossom_l = pbr('CbBlossomL', (1.0, 0.94, 0.95), 0.78,
                    emit=(1.0, 0.96, 0.95), emit_strength=0.18)
    petal = pbr('CbPetal', (1.0, 0.88, 0.92), 0.85)
    leaf = pbr('CbLeaf', (0.45, 0.65, 0.32), 0.85)
    # Main branch (long curved cylinder)
    cyl('Branch', (0, 0, 1.50), 0.10, 3.20, bark, verts=14,
        rot=(0, math.radians(85), math.radians(8)))
    # Branch knot accents (slight bulges)
    for i in range(3):
        t = i / 2
        x = -1.5 + t * 3.0
        uv_sph(f'Knot_{i}', (x, 0, 1.50 + (i-1)*0.1), 0.13, bark_l, segs=12, rings=8)
        o = bpy.context.active_object; o.scale = (0.7, 0.85, 0.9)
    # 4 sub-branches splaying out (smaller cylinders)
    rng = random.Random(251)
    for i in range(5):
        bx = -1.4 + i * 0.7
        bz = 1.50 + (rng.random()-0.5)*0.10
        # Sub-branch going up-out
        cyl(f'SubBr_{i}', (bx, 0, bz + 0.25), 0.04, 0.50, bark, verts=8,
            rot=(0, math.radians(rng.random()*30 - 15),
                  math.radians(rng.random()*40 - 20)))
        # Twigs from each sub-branch
        for k in range(3):
            cyl(f'Twig_{i}_{k}', (bx + (rng.random()-0.5)*0.20, 0,
                                    bz + 0.4 + rng.random()*0.15),
                0.020, 0.20, bark, verts=4,
                rot=(0, rng.random()*math.pi, 0))
    # Blossom clusters along the branch (10 large puffs)
    for i in range(12):
        bx = -1.5 + i * 0.30 + (rng.random()-0.5)*0.10
        bz = 1.55 + (rng.random()-0.5)*0.30
        by = (rng.random()-0.5)*0.30
        m = blossom if i % 2 == 0 else blossom_l
        uv_sph(f'BlossomPuff_{i}', (bx, by, bz), 0.18 + rng.random()*0.06, m,
               segs=14, rings=10)
    # 6 individual flower clusters above
    for i in range(6):
        bx = -1.2 + i * 0.50
        uv_sph(f'TopFlower_{i}', (bx, 0.05, 1.85), 0.12 + rng.random()*0.04, blossom_l,
               segs=12, rings=8)
    # Few green leaves mixed in
    for i in range(8):
        x = -1.4 + rng.random()*2.8
        z = 1.45 + (rng.random()-0.5)*0.20
        bpy.ops.mesh.primitive_plane_add(size=0.15, location=(x, 0.08, z))
        o = bpy.context.active_object; o.name = f'Leaf_{i}'
        o.rotation_euler = (rng.random()*math.pi, rng.random()*math.pi, rng.random()*math.pi)
        o.data.materials.append(leaf)
    # Petals falling below the branch (15 small flat planes)
    for i in range(20):
        x = -1.5 + rng.random()*3.0
        y = (rng.random()-0.5)*0.4
        z = 0.5 + rng.random()*0.8
        bpy.ops.mesh.primitive_plane_add(size=0.10, location=(x, y, z))
        o = bpy.context.active_object; o.name = f'FallPetal_{i}'
        o.scale = (0.6, 1.0, 1.0)
        o.rotation_euler = (rng.random()*math.pi, rng.random()*math.pi, rng.random()*math.pi)
        o.data.materials.append(petal)
    join_and_export('cherry_branch_overhang')


# ─── 8. ROOT BENCH ───────────────────────────────────────────────────
def build_root_bench():
    """Tree-root carved natural bench — gnarled wood seat w/ moss + tiny mushrooms."""
    clear_scene()
    wood = pbr('RbWood', (0.42, 0.28, 0.16), 0.92)
    wood_l = pbr('RbWoodL', (0.62, 0.42, 0.22), 0.90)
    wood_d = pbr('RbWoodD', (0.22, 0.14, 0.08), 0.92)
    moss = pbr('RbMoss', (0.32, 0.55, 0.24), 0.92)
    mushroom_r = pbr('RbMushR', (0.85, 0.16, 0.10), 0.65)
    mushroom_w = pbr('RbMushW', (0.95, 0.92, 0.85), 0.70)
    # Main seat (large horizontal log-like shape)
    cyl('Seat', (0, 0, 0.40), 0.22, 1.60, wood, verts=18, rot=(0, math.pi/2, 0))
    # Carved seat surface (flat top)
    box('SeatTop', (0, 0, 0.55), (1.60, 0.42, 0.05), wood_l, bevel=0.01)
    # 2 root legs (curving down at each end)
    for x_sign in [-1, 1]:
        # Big root mass
        cyl(f'Root_{x_sign}', (x_sign*0.70, 0, 0.20), 0.20, 0.40, wood, verts=14)
        # Splaying root "fingers" (3 each side)
        for k in range(3):
            ang = (k - 1) * 0.6 + math.pi/2
            cyl(f'RootFinger_{x_sign}_{k}', (x_sign*0.75 + math.cos(ang)*0.15, math.sin(ang)*0.15,
                                              0.10), 0.030, 0.20, wood_d, verts=6,
                rot=(0, math.radians(60), ang))
    # Backrest (smaller bent branch sticking up behind)
    cyl('Back', (0, -0.18, 0.85), 0.05, 0.55, wood, verts=8)
    # Backrest splays into 3 small branches
    for i in range(3):
        ang = (i - 1) * 0.5
        cyl(f'BackBr_{i}', (math.sin(ang)*0.10, -0.18, 1.10), 0.025, 0.20, wood, verts=6,
            rot=(0.3, 0, ang))
    # Moss patches on top of seat
    rng = random.Random(261)
    for i in range(5):
        x = (rng.random()-0.5) * 1.20
        y = (rng.random()-0.5) * 0.30
        cyl(f'Moss_{i}', (x, y, 0.585), 0.10 + rng.random()*0.04, 0.008, moss, verts=12)
    # Small mushrooms beside the bench
    for i in range(4):
        x = (rng.random()-0.5) * 1.50
        y = 0.35 + rng.random()*0.10
        # Stem
        cyl(f'MushStem_{i}', (x, y, 0.04), 0.015, 0.08, mushroom_w, verts=8)
        # Cap
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(x, y, 0.09),
                                              segments=12, ring_count=8)
        o = bpy.context.active_object; o.name = f'MushCap_{i}'
        o.scale = (1.0, 1.0, 0.55)
        o.data.materials.append(mushroom_r if i % 2 == 0 else mushroom_w)
        # White spots on red caps
        if i % 2 == 0:
            for k in range(3):
                kang = k / 3 * math.pi * 2
                uv_sph(f'Spot_{i}_{k}', (x + math.cos(kang)*0.02, y + math.sin(kang)*0.02, 0.115),
                       0.008, mushroom_w, segs=6, rings=4)
    join_and_export('root_bench')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_waterfall()
    build_rocky_cliff()
    build_cave_entrance()
    build_fishing_pier()
    build_mountain_silhouette()
    build_stone_curve_steps()
    build_cherry_branch_overhang()
    build_root_bench()
    print(f'[DONE] pack v19 exported to {OUT_DIR}')
