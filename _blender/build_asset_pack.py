"""
Procedurally build a 13-asset commercial-RPG GLB pack for niwa.html.
All assets are constructed from Blender primitives + subsurf + bevel for clean PBR-ready meshes.
Run headless:
  blender --background --python build_asset_pack.py
Outputs:
  ../assets/blender/{name}.glb  (one file per asset)
"""
import bpy
import os
import math

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)


# ─── Helpers ──────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images]:
        for item in list(block):
            block.remove(item)


def pbr_mat(name, base, rough=0.85, metal=0.0, emit=None, emit_strength=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit is not None:
        em_input = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        if em_input is not None:
            em_input.default_value = (*emit, 1.0)
        es = bsdf.inputs.get('Emission Strength')
        if es is not None:
            es.default_value = emit_strength
    return m


def box(name, loc, sz, mat=None, bevel=0.0, subsurf=0, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = sz
    if mat: o.data.materials.append(mat)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel; b.segments = 2
    if subsurf > 0:
        s = o.modifiers.new('Subsurf', 'SUBSURF')
        s.levels = subsurf; s.render_levels = subsurf
    return o


def cyl(name, loc, r, depth, mat=None, verts=32, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if mat: o.data.materials.append(mat)
    if bevel > 0:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel; b.segments = 2
    return o


def cone(name, loc, r1, r2, depth, mat=None, verts=32, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth,
                                     location=loc, vertices=verts, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if mat: o.data.materials.append(mat)
    return o


def sph(name, loc, r, mat=None, subdivs=3):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=loc, subdivisions=subdivs)
    o = bpy.context.active_object
    o.name = name
    if mat: o.data.materials.append(mat)
    return o


def uv_sph(name, loc, r, mat=None, segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=rings)
    o = bpy.context.active_object
    o.name = name
    if mat: o.data.materials.append(mat)
    return o


def apply_all_and_join(name):
    """Bake modifiers, join all meshes, set origin to floor center, return joined obj."""
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes: return None
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception:
                pass
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return joined


def export_glb(name):
    out = os.path.join(OUT_DIR, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB',
        export_apply=True, export_materials='EXPORT', export_yup=True,
    )
    obj = bpy.context.active_object
    verts = len(obj.data.vertices) if obj and obj.type == 'MESH' else 0
    print(f'[OK] {name}.glb verts={verts}')
    return out


# ─── Asset builders ───────────────────────────────────────────────────

def build_pagoda():
    clear_scene()
    base = pbr_mat('Base', (0.18, 0.16, 0.13), 0.9)
    red = pbr_mat('Vermilion', (0.55, 0.13, 0.08), 0.82)
    dark = pbr_mat('DarkBeam', (0.08, 0.05, 0.03), 0.85)
    gold = pbr_mat('Gold', (0.90, 0.62, 0.20), 0.30, 0.7)
    win = pbr_mat('Window', (0.96, 0.85, 0.55), 0.55, emit=(1.0, 0.78, 0.42), emit_strength=0.8)

    box('Foundation', (0, 0, 0.2), (3.8, 3.8, 0.4), base, bevel=0.03)

    tiers = [(2.6, 1.0, 0.6), (2.1, 0.95, 1.85), (1.6, 0.90, 3.10), (1.1, 0.80, 4.20)]
    for i, (sw, sh, sy) in enumerate(tiers):
        box(f'TierWall_{i}', (0, 0, sy), (sw, sw, sh), red, bevel=0.02, subsurf=0)
        # roof — wide curved-looking via short cone with subsurf
        roof = cone(f'TierRoof_{i}', (0, 0, sy + sh/2 + 0.3),
                    sw*0.92, sw*0.55, 0.6, dark, verts=8)
        sm = roof.modifiers.new('Subsurf', 'SUBSURF')
        sm.levels = 2; sm.render_levels = 2
        # Window strips per face
        for f in range(4):
            ang = f * math.pi / 2
            wx = math.sin(ang) * sw/2 * 1.01
            wz = math.cos(ang) * sw/2 * 1.01
            box(f'Win_{i}_{f}', (wx, wz, sy + 0.05),
                (0.25 if f%2==0 else 0.04, 0.04 if f%2==0 else 0.25, 0.35), win)
    # Finial spike + ball
    cyl('Finial', (0, 0, 5.0), 0.05, 0.6, gold, verts=12)
    uv_sph('FinialBall', (0, 0, 5.4), 0.10, gold, segs=16, rings=10)
    cyl('FinialTop', (0, 0, 5.55), 0.025, 0.30, gold, verts=10)

    apply_all_and_join('Pagoda')
    export_glb('pagoda')


def build_torii():
    clear_scene()
    red = pbr_mat('ToriiRed', (0.62, 0.13, 0.09), 0.78)
    dark = pbr_mat('ToriiDark', (0.07, 0.04, 0.02), 0.85)
    rope = pbr_mat('Shimenawa', (0.92, 0.86, 0.62), 0.92)

    # Two main pillars (cylinders)
    for x in [-1.6, 1.6]:
        cyl(f'Pillar_{x}', (x, 0, 2.3), 0.22, 4.6, red, verts=24, bevel=0.0)

    # Lower beam (nuki)
    box('Nuki', (0, 0, 3.6), (4.0, 0.30, 0.30), red, bevel=0.02)

    # Upper beam (kasagi) — dark and slightly wider, with curved swoops on ends
    box('Kasagi', (0, 0, 4.6), (5.0, 0.35, 0.50), dark, bevel=0.04, subsurf=1)
    # Swoop tips
    box('SwoopL', (-2.65, 0, 4.7), (0.55, 0.30, 0.36), dark, rot=(0, 0.35, 0), bevel=0.03)
    box('SwoopR', (2.65, 0, 4.7), (0.55, 0.30, 0.36), dark, rot=(0, -0.35, 0), bevel=0.03)

    # Shimenawa (sacred rope ring)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.07, location=(0, 0, 4.0))
    o = bpy.context.active_object
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(rope)

    # Small offering box behind
    box('OfferingBox', (0, -2.3, 0.7), (1.6, 1.2, 1.4), pbr_mat('OfferingWood', (0.18, 0.10, 0.05), 0.85), bevel=0.02)
    cone('OfferingRoof', (0, -2.3, 1.8), 1.1, 0.05, 0.6, red, verts=4)

    apply_all_and_join('Torii')
    export_glb('torii')


def build_fountain():
    clear_scene()
    stone = pbr_mat('LightStone', (0.78, 0.72, 0.58), 0.88)
    stone_dark = pbr_mat('DarkStone', (0.46, 0.40, 0.32), 0.92)
    water = pbr_mat('Water', (0.22, 0.55, 0.70), 0.15, 0.1,
                    emit=(0.05, 0.30, 0.45), emit_strength=0.2)

    # Octagonal basin: cylinder with 8 vertices
    cyl('BasinOuter', (0, 0, 0.32), 1.6, 0.64, stone, verts=8, bevel=0.04)
    cyl('BasinRim', (0, 0, 0.66), 1.5, 0.10, stone_dark, verts=8)
    # Water surface
    cyl('WaterSurface', (0, 0, 0.62), 1.40, 0.04, water, verts=24)

    # Central column
    cyl('Column', (0, 0, 1.3), 0.20, 1.0, stone, verts=16, bevel=0.02)
    cyl('MidBowl', (0, 0, 1.85), 0.55, 0.10, stone, verts=16, bevel=0.02)
    cyl('UpperCol', (0, 0, 2.20), 0.13, 0.5, stone, verts=12, bevel=0.02)
    cone('Finial', (0, 0, 2.65), 0.14, 0.02, 0.30, stone, verts=12)

    # 4 water-jet arcs (cones angling outward)
    for f in range(4):
        ang = f * math.pi / 2 + math.pi/4
        cyl(f'Jet_{f}',
            (math.sin(ang)*0.35, math.cos(ang)*0.35, 1.55),
            0.035, 0.55, water, verts=10,
            rot=(math.cos(ang)*0.5, math.sin(ang)*0.5, 0))

    apply_all_and_join('Fountain')
    export_glb('fountain')


def build_stone_lantern():
    clear_scene()
    stone = pbr_mat('LanternStone', (0.66, 0.61, 0.50), 0.92)
    paper = pbr_mat('LanternLight', (0.96, 0.85, 0.55), 0.5,
                    emit=(1.0, 0.78, 0.42), emit_strength=1.2)

    cyl('Base', (0, 0, 0.10), 0.34, 0.20, stone, verts=8, bevel=0.02)
    cyl('Shaft', (0, 0, 0.65), 0.10, 0.90, stone, verts=6, bevel=0.01)
    cyl('MidPlate', (0, 0, 1.20), 0.30, 0.10, stone, verts=8, bevel=0.02)

    # Light chamber (box with cutouts implied by 4 paper windows)
    box('Chamber', (0, 0, 1.42), (0.34, 0.34, 0.36), stone, bevel=0.02)
    # 4 paper windows on each face
    for f in range(4):
        ang = f * math.pi / 2
        wx = math.sin(ang) * 0.175
        wz = math.cos(ang) * 0.175
        box(f'PaperWin_{f}', (wx, wz, 1.42),
            (0.18 if f%2==0 else 0.01, 0.01 if f%2==0 else 0.18, 0.26), paper)

    # Roof cap
    cyl('Cap', (0, 0, 1.66), 0.38, 0.10, stone, verts=8, bevel=0.02)
    cone('CapRoof', (0, 0, 1.82), 0.34, 0.02, 0.22, stone, verts=8)
    uv_sph('Jewel', (0, 0, 1.99), 0.06, stone, segs=12, rings=8)

    apply_all_and_join('StoneLantern')
    export_glb('stone_lantern')


def build_tree_pine():
    clear_scene()
    trunk_mat = pbr_mat('PineTrunk', (0.18, 0.10, 0.05), 0.92)
    pine1 = pbr_mat('PineCanopy1', (0.16, 0.36, 0.18), 0.85)
    pine2 = pbr_mat('PineCanopy2', (0.20, 0.42, 0.22), 0.85)
    pine3 = pbr_mat('PineCanopy3', (0.24, 0.48, 0.26), 0.85)

    cyl('Trunk', (0, 0, 0.50), 0.14, 1.0, trunk_mat, verts=12, bevel=0.0)
    # 4 cone tiers
    tiers = [(0.85, 1.0, 1.10, pine1),
             (0.70, 0.95, 1.55, pine2),
             (0.55, 0.85, 1.95, pine3),
             (0.35, 0.65, 2.30, pine3)]
    for i, (r, h, y, m) in enumerate(tiers):
        c = cone(f'Tier_{i}', (0, 0, y), r, r*0.30, h, m, verts=18)
        sm = c.modifiers.new('Subsurf', 'SUBSURF')
        sm.levels = 1; sm.render_levels = 1
    # Offshoot mini-cones for organic break
    for i in range(6):
        ang = i * math.pi * 2 / 6 + 0.2
        h = 1.3 + (i % 3) * 0.35
        r = math.sin(ang) * 0.45
        z = math.cos(ang) * 0.45
        c = cone(f'Off_{i}', (r, z, h), 0.18, 0.04, 0.32, pine2, verts=10)
        c.rotation_euler = (math.sin(ang) * 0.4, math.cos(ang) * 0.4, 0)

    apply_all_and_join('TreePine')
    export_glb('tree_pine')


def build_tree_sakura():
    clear_scene()
    trunk_mat = pbr_mat('SakuraTrunk', (0.16, 0.09, 0.04), 0.92)
    pinks = [
        pbr_mat('Pink1', (0.94, 0.72, 0.80), 0.78),
        pbr_mat('Pink2', (0.97, 0.82, 0.85), 0.78),
        pbr_mat('Pink3', (0.92, 0.62, 0.72), 0.78),
        pbr_mat('Pink4', (0.99, 0.88, 0.92), 0.75),
    ]

    # Slightly curved trunk (two cylinders at slight angles)
    cyl('TrunkBase', (0, 0, 0.40), 0.12, 0.80, trunk_mat, verts=12)
    cyl('TrunkUpper', (0.08, 0, 1.05), 0.10, 0.55, trunk_mat, verts=12, rot=(0, 0.15, 0))

    # Cluster of 10 puffy spheres (canopy)
    centers = []
    for i in range(8):
        ang = i * math.pi * 2 / 8
        cx = math.sin(ang) * 0.45
        cz = math.cos(ang) * 0.45
        cy = 1.6 + math.sin(ang*2) * 0.18
        centers.append((cx, cz, cy))
    # 3 upper puffs
    for i in range(3):
        ang = i * math.pi * 2 / 3
        centers.append((math.sin(ang)*0.20, math.cos(ang)*0.20, 1.95))

    for i, (cx, cz, cy) in enumerate(centers):
        uv_sph(f'Puff_{i}', (cx, cz, cy), 0.42 + (i%3)*0.04, pinks[i % 4], segs=18, rings=14)

    apply_all_and_join('TreeSakura')
    export_glb('tree_sakura')


def build_tree_momiji():
    clear_scene()
    trunk_mat = pbr_mat('MomijiTrunk', (0.14, 0.08, 0.04), 0.92)
    reds = [
        pbr_mat('MomijiRed1', (0.78, 0.22, 0.13), 0.82),
        pbr_mat('MomijiRed2', (0.85, 0.32, 0.15), 0.82),
        pbr_mat('MomijiRed3', (0.92, 0.45, 0.18), 0.82),
        pbr_mat('MomijiOrange', (0.95, 0.55, 0.22), 0.82),
    ]
    cyl('MomijiTrunk', (0, 0, 0.32), 0.10, 0.65, trunk_mat, verts=12)
    # Layered ball cluster
    for i in range(7):
        ang = i * math.pi * 2 / 7
        r = 0.32 + (i % 2) * 0.05
        cy = 0.95 + math.sin(ang*1.5) * 0.20
        cx = math.sin(ang) * 0.32
        cz = math.cos(ang) * 0.32
        uv_sph(f'Ball_{i}', (cx, cz, cy), r, reds[i % 4], segs=16, rings=12)
    uv_sph('Crown', (0, 0, 1.30), 0.36, reds[0], segs=18, rings=12)

    apply_all_and_join('TreeMomiji')
    export_glb('tree_momiji')


def build_tree_broad():
    clear_scene()
    trunk = pbr_mat('BroadTrunk', (0.18, 0.10, 0.05), 0.92)
    leaf1 = pbr_mat('BroadLeaf1', (0.22, 0.50, 0.22), 0.85)
    leaf2 = pbr_mat('BroadLeaf2', (0.30, 0.58, 0.30), 0.85)
    cyl('BTrunk', (0, 0, 0.50), 0.14, 1.0, trunk, verts=12)
    uv_sph('Canopy1', (0, 0, 1.45), 0.85, leaf1, segs=24, rings=18)
    uv_sph('Canopy2', (0.30, 0, 1.60), 0.55, leaf2, segs=20, rings=14)
    uv_sph('Canopy3', (-0.25, 0.15, 1.35), 0.48, leaf2, segs=20, rings=14)
    apply_all_and_join('TreeBroad')
    export_glb('tree_broad')


def build_well():
    clear_scene()
    stone = pbr_mat('WellStone', (0.66, 0.61, 0.50), 0.90)
    wood = pbr_mat('WellWood', (0.36, 0.22, 0.12), 0.85)
    water = pbr_mat('WellWater', (0.10, 0.20, 0.30), 0.15, 0.1)
    rope = pbr_mat('WellRope', (0.86, 0.78, 0.56), 0.92)

    cyl('WellRing', (0, 0, 0.25), 0.75, 0.50, stone, verts=20, bevel=0.04)
    cyl('WellWater', (0, 0, 0.46), 0.60, 0.04, water, verts=20)
    # Posts
    box('PostL', (-0.65, 0, 1.20), (0.12, 0.12, 1.40), wood, bevel=0.01)
    box('PostR', (0.65, 0, 1.20), (0.12, 0.12, 1.40), wood, bevel=0.01)
    # Beam + roof
    box('Beam', (0, 0, 1.90), (1.55, 0.10, 0.10), wood, bevel=0.01)
    cone('Roof', (0, 0, 2.20), 1.0, 0.10, 0.55, pbr_mat('WellRoof', (0.10, 0.07, 0.04), 0.85), verts=4)
    # Rope (cylinder)
    cyl('Rope', (0, 0, 1.25), 0.02, 1.20, rope, verts=8)
    # Bucket
    cyl('Bucket', (0, 0, 0.55), 0.17, 0.22, wood, verts=14, bevel=0.01)

    apply_all_and_join('Well')
    export_glb('well')


def build_watchtower():
    clear_scene()
    stone = pbr_mat('TowerStone', (0.62, 0.55, 0.42), 0.92)
    dark = pbr_mat('TowerDark', (0.32, 0.27, 0.20), 0.92)
    win = pbr_mat('TowerWin', (0.96, 0.78, 0.42), 0.6,
                  emit=(1.0, 0.62, 0.30), emit_strength=0.8)
    flag = pbr_mat('Flag', (0.78, 0.14, 0.08), 0.78)

    # base
    cyl('TowerBase', (0, 0, 0.30), 1.10, 0.60, dark, verts=16, bevel=0.02)
    # 4 stacked stone segments
    for i in range(4):
        cyl(f'Seg_{i}', (0, 0, 0.60 + 1.3*i + 0.6), 0.85 - i*0.05, 1.2, stone, verts=16, bevel=0.01)
        # 4 narrow arrow slits per segment
        for f in range(4):
            ang = f * math.pi / 2
            wx = math.sin(ang) * (0.86 - i*0.05)
            wz = math.cos(ang) * (0.86 - i*0.05)
            box(f'Slit_{i}_{f}', (wx, wz, 0.60 + 1.3*i + 0.6),
                (0.08 if f%2==0 else 0.04, 0.04 if f%2==0 else 0.08, 0.50), win)
    # Crenellated top — ring + 8 small crenellations
    cyl('TopRing', (0, 0, 5.50), 1.0, 0.20, stone, verts=16, bevel=0.02)
    for i in range(8):
        ang = i * math.pi * 2 / 8
        x = math.sin(ang) * 0.95
        z = math.cos(ang) * 0.95
        box(f'Crenel_{i}', (x, z, 5.85), (0.22, 0.20, 0.40), stone, bevel=0.02)
    # Flag pole + flag
    cyl('FlagPole', (0, 0, 6.50), 0.04, 0.90, dark, verts=10)
    box('FlagCloth', (0.30, 0, 6.65), (0.40, 0.03, 0.22), flag)

    apply_all_and_join('Watchtower')
    export_glb('watchtower')


def build_windmill():
    clear_scene()
    stone = pbr_mat('MillStone', (0.78, 0.68, 0.55), 0.90)
    wood = pbr_mat('MillWood', (0.36, 0.22, 0.12), 0.85)
    cloth = pbr_mat('MillCloth', (0.92, 0.86, 0.66), 0.78)

    # Round tower (slightly tapered)
    cyl('MillTower', (0, 0, 1.40), 0.85, 2.80, stone, verts=20, bevel=0.02)
    cyl('MillTowerTop', (0, 0, 2.90), 0.75, 0.20, stone, verts=20, bevel=0.02)
    # Cap (conical)
    cone('MillCap', (0, 0, 3.30), 0.90, 0.20, 0.70, pbr_mat('MillCap', (0.32, 0.18, 0.10), 0.85), verts=16)

    # Hub for sails
    sph('MillHub', (0, 0.90, 3.05), 0.18, wood, subdivs=3)
    # 4 sail arms
    for i in range(4):
        ang = i * math.pi * 2 / 4
        # arm
        box(f'SailArm_{i}', (math.sin(ang)*0.85, 0.90, 3.05 + math.cos(ang)*0.85),
            (0.10, 0.06, 1.80), wood, rot=(0, 0, ang))
        # sail (rectangle)
        box(f'SailCloth_{i}', (math.sin(ang)*0.85, 0.95, 3.05 + math.cos(ang)*0.85),
            (0.50, 0.02, 1.50), cloth, rot=(0, 0, ang))

    # Door + window
    box('MillDoor', (0, -0.86, 0.40), (0.40, 0.03, 0.80), wood)
    box('MillWin', (0, -0.86, 1.85), (0.30, 0.03, 0.36),
        pbr_mat('MillWin', (0.96, 0.78, 0.42), 0.5, emit=(1.0, 0.6, 0.3), emit_strength=0.8))

    apply_all_and_join('Windmill')
    export_glb('windmill')


def build_bridge():
    clear_scene()
    stone = pbr_mat('BridgeStone', (0.70, 0.64, 0.50), 0.90)
    wood = pbr_mat('BridgeWood', (0.42, 0.26, 0.14), 0.85)

    # Arched deck — series of small box segments along a parabola
    L = 4.5
    H = 0.6
    N = 14
    for i in range(N):
        t = (i + 0.5) / N
        x = (t - 0.5) * L
        y_arch = H * (1 - (2*t - 1)**2)
        seg = box(f'BridgeSeg_{i}', (x, 0, y_arch + 0.30), (L/N * 1.04, 1.2, 0.16), stone, bevel=0.02)
    # Side railings (curved series of posts)
    for side in [-1, 1]:
        for i in range(N+1):
            t = i / N
            x = (t - 0.5) * L
            y_arch = H * (1 - (2*t - 1)**2)
            cyl(f'Post_{side}_{i}', (x, side*0.62, y_arch + 0.60), 0.05, 0.50, wood, verts=8)
        # Top rail (curved through points — approximate with 1 long beveled box)
        box(f'TopRail_{side}', (0, side*0.62, H*0.7 + 0.85),
            (L, 0.05, 0.05), wood, bevel=0.01)

    apply_all_and_join('Bridge')
    export_glb('bridge')


def build_shrine():
    clear_scene()
    red = pbr_mat('ShrineRed', (0.62, 0.13, 0.09), 0.78)
    dark = pbr_mat('ShrineDark', (0.07, 0.04, 0.02), 0.85)
    stone = pbr_mat('ShrineStone', (0.66, 0.61, 0.50), 0.90)
    gold = pbr_mat('ShrineGold', (0.90, 0.62, 0.20), 0.30, 0.7)

    # Stone base
    box('ShrineBase', (0, 0, 0.18), (2.6, 2.0, 0.36), stone, bevel=0.03)
    # Main shrine box
    box('ShrineBody', (0, 0, 1.10), (2.0, 1.4, 1.40), red, bevel=0.02)
    # Roof (sloped)
    box('ShrineRoofL', (0, -0.55, 2.10), (2.4, 1.0, 0.10), dark, rot=(0.5, 0, 0), bevel=0.02)
    box('ShrineRoofR', (0, 0.55, 2.10), (2.4, 1.0, 0.10), dark, rot=(-0.5, 0, 0), bevel=0.02)
    box('ShrineRidge', (0, 0, 2.40), (2.5, 0.18, 0.18), dark, bevel=0.02)
    # Offering box
    box('ShrineOffering', (0, -0.95, 0.55), (0.9, 0.5, 0.5),
        pbr_mat('OfferingBoxWood', (0.18, 0.10, 0.05), 0.85), bevel=0.02)
    # Door
    box('ShrineDoor', (0, -0.71, 1.0), (0.55, 0.03, 0.95), gold)
    # Steps in front
    for i in range(3):
        box(f'ShrineStep_{i}', (0, -1.10 - i*0.35, 0.18 + i*0.08),
            (2.0 - i*0.20, 0.30, 0.10), stone, bevel=0.02)

    apply_all_and_join('Shrine')
    export_glb('shrine')


# ─── Main ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    builders = [
        ('pagoda',         build_pagoda),
        ('torii',          build_torii),
        ('fountain',       build_fountain),
        ('stone_lantern',  build_stone_lantern),
        ('tree_pine',      build_tree_pine),
        ('tree_sakura',    build_tree_sakura),
        ('tree_momiji',    build_tree_momiji),
        ('tree_broad',     build_tree_broad),
        ('well',           build_well),
        ('watchtower',     build_watchtower),
        ('windmill',       build_windmill),
        ('bridge',         build_bridge),
        ('shrine',         build_shrine),
    ]
    for name, fn in builders:
        print(f'\n=== Building {name} ===')
        try:
            fn()
        except Exception as e:
            print(f'[ERROR] {name}:', e)
    print('\n[DONE] all assets exported to', OUT_DIR)
