"""
Pack v10 — nature & flora expansion.
Builds:
  cherry_grove, maple_grove, weeping_willow, wisteria_arbor,
  mushroom_cluster, ivy_arch, snow_pine, hydrangea
Run headless:
  blender --background --python build_pack_v10.py
"""
import bpy, os, math, random

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
random.seed(10)


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


# ─── 1. CHERRY GROVE ─────────────────────────────────────────────────
def build_cherry_grove():
    """Cluster of 5 sakura trees forming a small grove patch."""
    clear_scene()
    bark = pbr('CGBark', (0.32, 0.20, 0.12), 0.92)
    pink = pbr('CGPink', (0.96, 0.82, 0.88), 0.78,
               emit=(0.98, 0.86, 0.90), emit_strength=0.15)
    pink_l = pbr('CGPinkL', (1.0, 0.94, 0.95), 0.78,
                 emit=(1.0, 0.96, 0.95), emit_strength=0.18)
    petal = pbr('CGPetal', (1.0, 0.88, 0.92), 0.85)
    rng = random.Random(31)
    for i in range(5):
        # Tree position in a 3x3 cluster
        ang = i / 5 * math.pi * 2 + rng.random()*0.5
        r = 0.4 + rng.random() * 1.0 if i > 0 else 0
        cx = math.cos(ang) * r
        cy = math.sin(ang) * r
        h = 1.4 + rng.random() * 0.6
        tr = 0.10 + rng.random() * 0.04
        # Trunk
        cyl(f'Trunk_{i}', (cx, cy, h/2), tr, h, bark, verts=10)
        # 3 main branches
        for k in range(3):
            bang = k / 3 * math.pi * 2 + rng.random()*0.3
            bx = cx + math.cos(bang) * 0.25
            by = cy + math.sin(bang) * 0.25
            bz = h * 0.65
            cyl(f'Branch_{i}_{k}', (bx, by, bz), 0.04, 0.40, bark, verts=6,
                rot=(math.cos(bang)*0.5, math.sin(bang)*0.5, 0))
        # Blossom canopy — 3 puffs per tree
        cm = pink if i % 2 == 0 else pink_l
        uv_sph(f'PuffMain_{i}', (cx, cy, h + 0.20), 0.42 + rng.random()*0.08, cm, segs=16, rings=12)
        for k in range(2):
            ox = (rng.random() - 0.5) * 0.4
            oy = (rng.random() - 0.5) * 0.4
            uv_sph(f'Puff_{i}_{k}', (cx + ox, cy + oy, h + 0.08), 0.28, cm, segs=14, rings=10)
    # Fallen petals scattered on the ground (small flat planes)
    for i in range(20):
        x = (rng.random() - 0.5) * 3.0
        y = (rng.random() - 0.5) * 3.0
        bpy.ops.mesh.primitive_plane_add(size=0.10, location=(x, y, 0.015))
        o = bpy.context.active_object; o.name = f'Petal_{i}'
        o.scale = (0.6, 1.0, 1.0)
        o.rotation_euler = (0, 0, rng.random() * math.pi * 2)
        o.data.materials.append(petal)
    join_and_export('cherry_grove')


# ─── 2. MAPLE GROVE ──────────────────────────────────────────────────
def build_maple_grove():
    """Cluster of 4 momiji maples in autumn red."""
    clear_scene()
    bark = pbr('MGBark', (0.28, 0.16, 0.08), 0.92)
    red = pbr('MGRed', (0.88, 0.30, 0.12), 0.85)
    red_o = pbr('MGOrange', (0.92, 0.55, 0.18), 0.85)
    red_y = pbr('MGYellow', (0.94, 0.78, 0.20), 0.85)
    leaf_mats = [red, red_o, red_y]
    rng = random.Random(33)
    for i in range(4):
        ang = i / 4 * math.pi * 2
        r = 0.6 if i > 0 else 0
        cx = math.cos(ang) * r
        cy = math.sin(ang) * r
        h = 1.6 + rng.random() * 0.5
        tr = 0.10 + rng.random() * 0.03
        # Trunk
        cyl(f'Trunk_{i}', (cx, cy, h/2), tr, h, bark, verts=10)
        # 4 branches splaying out (maples are spreading)
        for k in range(4):
            bang = k / 4 * math.pi * 2 + rng.random()*0.3
            cyl(f'Branch_{i}_{k}', (cx + math.cos(bang)*0.3, cy + math.sin(bang)*0.3, h*0.7),
                0.035, 0.5, bark, verts=6, rot=(math.cos(bang)*0.7, math.sin(bang)*0.7, 0))
        # Canopy puffs — multiple smaller spheres for layered leaves
        for k in range(6):
            ox = (rng.random() - 0.5) * 0.7
            oy = (rng.random() - 0.5) * 0.7
            oz = (rng.random() - 0.5) * 0.3
            m = leaf_mats[k % 3]
            uv_sph(f'Puff_{i}_{k}', (cx + ox, cy + oy, h + 0.1 + oz),
                   0.28 + rng.random()*0.10, m, segs=14, rings=10)
    # Fallen leaves on ground (12 colored spots)
    for i in range(14):
        x = (rng.random() - 0.5) * 3.0
        y = (rng.random() - 0.5) * 3.0
        m = leaf_mats[i % 3]
        bpy.ops.mesh.primitive_plane_add(size=0.10, location=(x, y, 0.012))
        o = bpy.context.active_object; o.name = f'Leaf_{i}'
        o.scale = (1.0, 1.0, 1.0)
        o.rotation_euler = (0, 0, rng.random() * math.pi * 2)
        o.data.materials.append(m)
    join_and_export('maple_grove')


# ─── 3. WEEPING WILLOW ───────────────────────────────────────────────
def build_weeping_willow():
    """Tall willow with cascading branches — leaves hang down in long curtains."""
    clear_scene()
    bark = pbr('WWBark', (0.30, 0.22, 0.14), 0.92)
    leaf = pbr('WWLeaf', (0.55, 0.72, 0.30), 0.78)
    leaf_d = pbr('WWLeafD', (0.32, 0.50, 0.18), 0.82)
    H = 2.6
    # Trunk
    cyl('Trunk', (0, 0, H/2), 0.15, H, bark, verts=14)
    # Slight lean
    o = bpy.context.active_object; o.rotation_euler = (0, 0, 0.10)
    # Top canopy ball
    uv_sph('Canopy', (0, 0, H + 0.20), 0.55, leaf, segs=22, rings=16)
    # 12 weeping branches — each a thin curved cylinder with a sphere cluster at the end
    rng = random.Random(41)
    for i in range(12):
        ang = i / 12 * math.pi * 2
        # Start point on canopy
        sx = math.cos(ang) * 0.45
        sy = math.sin(ang) * 0.45
        sz = H + 0.05
        # End point hanging down
        ex = math.cos(ang) * (0.7 + rng.random()*0.3)
        ey = math.sin(ang) * (0.7 + rng.random()*0.3)
        ez = sz - (1.4 + rng.random()*0.5)
        # Midpoint
        mx = (sx + ex)/2
        my = (sy + ey)/2
        mz = (sz + ez)/2
        # Approximate the cascade with 4 small segments
        prev = (sx, sy, sz)
        for k in range(1, 5):
            t = k / 4.0
            # Parabolic-ish path
            px = sx + (ex - sx) * t
            py = sy + (ey - sy) * t
            pz = sz + (ez - sz) * t - math.sin(t * math.pi) * 0.10  # slight sag
            # Segment
            dx = px - prev[0]; dy = py - prev[1]; dz = pz - prev[2]
            L = math.sqrt(dx*dx + dy*dy + dz*dz)
            cx = (prev[0] + px)/2
            cy = (prev[1] + py)/2
            cz = (prev[2] + pz)/2
            # Compute orientation: cylinder by default is along Z, rotate so its
            # local-Z aligns with (dx,dy,dz). We approximate via rotation_euler.
            # Simpler: use just an angled small cylinder.
            ang_xy = math.atan2(dy, dx)
            ang_z = math.atan2(math.sqrt(dx*dx + dy*dy), dz)
            cyl(f'WW_{i}_{k}', (cx, cy, cz), 0.012, L, bark, verts=4,
                rot=(0, ang_z, ang_xy + math.pi/2))
            prev = (px, py, pz)
        # Leaf cluster at the bottom of each cascade
        m = leaf if i % 2 == 0 else leaf_d
        uv_sph(f'LeafEnd_{i}', (ex, ey, ez), 0.18 + rng.random()*0.05, m, segs=12, rings=10)
        # Mid-cascade leaf bunch
        uv_sph(f'LeafMid_{i}', ((sx+ex)/2, (sy+ey)/2, sz - 0.5), 0.15, m, segs=10, rings=8)
    join_and_export('weeping_willow')


# ─── 4. WISTERIA ARBOR ───────────────────────────────────────────────
def build_wisteria_arbor():
    """Wooden pergola with cascading purple wisteria blooms."""
    clear_scene()
    wood = pbr('WisWood', (0.42, 0.30, 0.18), 0.92)
    wood_d = pbr('WisWoodD', (0.22, 0.16, 0.10), 0.92)
    purple = pbr('WisPurple', (0.62, 0.38, 0.85), 0.80,
                 emit=(0.65, 0.40, 0.88), emit_strength=0.15)
    purple_d = pbr('WisPurpleD', (0.42, 0.22, 0.65), 0.85)
    leaf = pbr('WisLeaf', (0.32, 0.55, 0.32), 0.82)
    # 4 posts (rectangle pergola)
    for x in [-1.5, 1.5]:
        for y in [-0.8, 0.8]:
            cyl(f'Post_{x}_{y}', (x, y, 1.20), 0.08, 2.40, wood, verts=10)
            box(f'PostCap_{x}_{y}', (x, y, 2.42), (0.20, 0.20, 0.06), wood_d)
    # Top crossbeams along long axis (3 beams)
    for y in [-0.8, 0.0, 0.8]:
        box(f'BeamX_{y}', (0, y, 2.45), (3.4, 0.10, 0.10), wood)
    # Top crossbeams along short axis (5 beams)
    for x in [-1.4, -0.7, 0.0, 0.7, 1.4]:
        box(f'BeamY_{x}', (x, 0, 2.50), (0.10, 1.80, 0.08), wood)
    # Cascading wisteria — 14 hanging cylinders (purple flower drops)
    rng = random.Random(53)
    for i in range(16):
        # Position on the pergola top
        gx = (rng.random() - 0.5) * 2.8
        gy = (rng.random() - 0.5) * 1.6
        # Length of cascade
        L = 0.6 + rng.random() * 0.7
        # Main cascade — a stack of purple spheres
        N = 4
        for k in range(N):
            t = k / (N - 1)
            sz = 0.10 - t * 0.04
            m = purple if k < N - 1 else purple_d
            uv_sph(f'Bloom_{i}_{k}', (gx, gy, 2.40 - 0.10 - t*L), sz, m, segs=10, rings=8)
        # Leaf cluster at the top of the cascade
        uv_sph(f'WisLeaf_{i}', (gx, gy, 2.42), 0.07, leaf, segs=8, rings=6)
    # Sub-arch climbing vine on one post (vertical creeper)
    for k in range(5):
        z = 0.3 + k * 0.4
        uv_sph(f'Climber_{k}', (-1.5 + 0.10, 0.8 + 0.05, z), 0.06, leaf, segs=8, rings=6)
    join_and_export('wisteria_arbor')


# ─── 5. MUSHROOM CLUSTER ─────────────────────────────────────────────
def build_mushroom_cluster():
    """A patch of forest mushrooms — red caps with white spots + smaller browns."""
    clear_scene()
    red = pbr('MushRed', (0.85, 0.16, 0.10), 0.65)
    white = pbr('MushWhite', (0.95, 0.92, 0.88), 0.70)
    stem = pbr('MushStem', (0.92, 0.88, 0.75), 0.80)
    brown = pbr('MushBrown', (0.55, 0.38, 0.22), 0.85)
    moss = pbr('MushMoss', (0.32, 0.50, 0.24), 0.92)
    rng = random.Random(61)
    # Moss patch base
    cyl('Moss', (0, 0, 0.015), 0.45, 0.03, moss, verts=20)
    # 4 large red-and-white mushrooms (fly agaric / amanita style)
    positions = [(-0.18, 0.15), (0.20, 0.10), (-0.10, -0.15), (0.18, -0.18)]
    for i, (x, y) in enumerate(positions):
        h = 0.18 + rng.random()*0.06
        sr = 0.04 + rng.random()*0.01
        # Stem
        cyl(f'Stem_{i}', (x, y, h/2), sr, h, stem, verts=10)
        # Cap (hemisphere)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.10, location=(x, y, h+0.02),
                                              segments=16, ring_count=10)
        o = bpy.context.active_object; o.name = f'Cap_{i}'
        o.scale = (1.0, 1.0, 0.55)
        o.data.materials.append(red)
        # White spots on cap (4 small spheres)
        for k in range(4):
            ang = k / 4 * math.pi * 2 + rng.random()*0.5
            sx = x + math.cos(ang) * 0.045
            sy = y + math.sin(ang) * 0.045
            uv_sph(f'Spot_{i}_{k}', (sx, sy, h + 0.06), 0.020, white, segs=6, rings=4)
    # 6 smaller brown mushrooms
    for i in range(6):
        ang = i / 6 * math.pi * 2 + rng.random()*0.4
        rad = 0.20 + rng.random()*0.15
        x = math.cos(ang) * rad
        y = math.sin(ang) * rad
        h = 0.06 + rng.random()*0.03
        cyl(f'BrStem_{i}', (x, y, h/2), 0.015, h, stem, verts=8)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(x, y, h+0.005),
                                              segments=12, ring_count=8)
        o = bpy.context.active_object; o.name = f'BrCap_{i}'
        o.scale = (1.0, 1.0, 0.55)
        o.data.materials.append(brown)
    join_and_export('mushroom_cluster')


# ─── 6. IVY ARCH ─────────────────────────────────────────────────────
def build_ivy_arch():
    """Wood-frame arch covered with ivy/vine leaves — perfect garden gate."""
    clear_scene()
    wood = pbr('IvyWood', (0.38, 0.26, 0.16), 0.92)
    leaf_a = pbr('IvyLeafA', (0.30, 0.55, 0.22), 0.85)
    leaf_b = pbr('IvyLeafB', (0.42, 0.62, 0.30), 0.85)
    leaf_y = pbr('IvyLeafY', (0.62, 0.65, 0.20), 0.85)  # autumn ivy
    flower = pbr('IvyFlower', (0.95, 0.85, 0.45), 0.80,
                 emit=(0.95, 0.85, 0.45), emit_strength=0.15)
    # Posts
    for x in [-0.9, 0.9]:
        cyl(f'Post_{x}', (x, 0, 1.10), 0.07, 2.20, wood, verts=10)
    # Top arch — approximate semi-circle with 7 small cylinders
    N = 7
    for i in range(N):
        ang = i / (N - 1) * math.pi
        cx = -0.9 + (1 - math.cos(ang)) * 0.9
        cz = 2.20 + math.sin(ang) * 0.40 - 0.20
        rot_y = -(ang - math.pi/2)
        cyl(f'Arch_{i}', (cx, 0, cz), 0.05, 0.30, wood, verts=8,
            rot=(0, rot_y, 0))
    # 60 leaves clustered along the arch + posts
    rng = random.Random(71)
    for i in range(60):
        # Choose location along arch+posts
        if i < 40:
            # On the arch
            t = i / 39
            ang = t * math.pi
            cx = -0.9 + (1 - math.cos(ang)) * 0.9
            cz = 2.20 + math.sin(ang) * 0.40 - 0.20
            # Random offset around the arch curve
            cx += (rng.random() - 0.5) * 0.10
            cy = (rng.random() - 0.5) * 0.20
            cz += (rng.random() - 0.5) * 0.06
        else:
            # On the posts
            side = -1 if (i % 2 == 0) else 1
            cx = side * 0.9 + (rng.random() - 0.5) * 0.16
            cy = (rng.random() - 0.5) * 0.20
            cz = 0.2 + rng.random() * 1.8
        m = [leaf_a, leaf_b, leaf_y][i % 3]
        bpy.ops.mesh.primitive_plane_add(size=0.12, location=(cx, cy, cz))
        o = bpy.context.active_object; o.name = f'Leaf_{i}'
        o.rotation_euler = (rng.random()*math.pi, rng.random()*math.pi, rng.random()*math.pi)
        o.data.materials.append(m)
    # 8 small yellow flowers scattered
    for i in range(8):
        t = (i + 0.5) / 8
        ang = t * math.pi
        cx = -0.9 + (1 - math.cos(ang)) * 0.9
        cz = 2.20 + math.sin(ang) * 0.40 - 0.10
        cy = (rng.random() - 0.5) * 0.20
        uv_sph(f'Flower_{i}', (cx, cy, cz), 0.030, flower, segs=8, rings=6)
    join_and_export('ivy_arch')


# ─── 7. SNOW PINE ────────────────────────────────────────────────────
def build_snow_pine():
    """Tall pine tree with snow piled on its layered branches."""
    clear_scene()
    bark = pbr('SPBark', (0.28, 0.18, 0.10), 0.92)
    needle = pbr('SPNeedle', (0.20, 0.42, 0.22), 0.88)
    snow = pbr('SPSnow', (0.96, 0.97, 1.00), 0.55)
    H = 3.2
    # Trunk
    cyl('Trunk', (0, 0, H/2 - 0.2), 0.13, H - 0.4, bark, verts=12)
    # 5 layered cone discs (pine canopy), each smaller as we go up,
    # with a snow disc capping each tier
    tiers = [
        (0.0, 1.10, 0.55),  # bottom
        (0.5, 0.95, 0.50),
        (1.0, 0.80, 0.45),
        (1.5, 0.65, 0.40),
        (2.0, 0.50, 0.35),
        (2.5, 0.35, 0.30),
    ]
    for i, (z, r_outer, depth) in enumerate(tiers):
        cz = 0.6 + z
        # Pine cone disc
        cone(f'Tier_{i}', (0, 0, cz), r_outer, r_outer*0.35, depth, needle, verts=18)
        # Snow on top of disc
        cone(f'Snow_{i}', (0, 0, cz + depth*0.4), r_outer*0.85, r_outer*0.30, depth*0.30,
             snow, verts=14)
    # Top spire of snow
    cone('TopSnow', (0, 0, 0.6 + 2.5 + 0.20), 0.18, 0.0, 0.22, snow, verts=8)
    # 6 small snow drifts on lower branches (sphere clusters)
    rng = random.Random(81)
    for i in range(6):
        ang = rng.random() * math.pi * 2
        r = 0.5 + rng.random() * 0.4
        z = 0.7 + rng.random() * 1.4
        uv_sph(f'Drift_{i}', (math.cos(ang)*r, math.sin(ang)*r, z), 0.10, snow, segs=10, rings=6)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.55)
    # Snow on ground
    cyl('GroundSnow', (0, 0, 0.01), 1.30, 0.02, snow, verts=20)
    join_and_export('snow_pine')


# ─── 8. HYDRANGEA ────────────────────────────────────────────────────
def build_hydrangea():
    """Hydrangea bush — multiple flower-balls in blue/purple/pink atop green foliage."""
    clear_scene()
    leaf = pbr('HyLeaf', (0.28, 0.55, 0.25), 0.85)
    stem = pbr('HyStem', (0.35, 0.60, 0.28), 0.85)
    blue = pbr('HyBlue', (0.45, 0.55, 0.85), 0.78,
               emit=(0.50, 0.58, 0.88), emit_strength=0.12)
    purple = pbr('HyPurple', (0.65, 0.45, 0.85), 0.78,
                 emit=(0.68, 0.48, 0.88), emit_strength=0.12)
    pink = pbr('HyPink', (0.92, 0.55, 0.75), 0.78,
               emit=(0.95, 0.58, 0.78), emit_strength=0.12)
    rng = random.Random(91)
    # Base foliage — 5-7 leaf clusters
    for i in range(7):
        ang = i / 7 * math.pi * 2
        r = 0.18 + rng.random()*0.15
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        z = 0.10 + rng.random()*0.05
        uv_sph(f'Foliage_{i}', (x, y, z), 0.18, leaf, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.6)
    # 6 flower balls floating above the foliage (alternating colors)
    flower_mats = [blue, purple, pink]
    for i in range(6):
        ang = i / 6 * math.pi * 2 + 0.3
        r = 0.15 + rng.random()*0.10
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        z = 0.30 + rng.random()*0.10
        m = flower_mats[i % 3]
        # Stem connecting foliage to flower
        cyl(f'Stem_{i}', (x*0.7, y*0.7, z*0.6), 0.012, z*0.8, stem, verts=4)
        # Flower ball (cluster of small balls = hydrangea)
        for k in range(8):
            kang = k / 8 * math.pi * 2 + rng.random()*0.5
            rr = 0.06
            sx = math.cos(kang) * rr
            sy = math.sin(kang) * rr
            sz = (rng.random() - 0.5) * 0.04
            uv_sph(f'FlBall_{i}_{k}', (x + sx, y + sy, z + sz), 0.035, m, segs=8, rings=6)
        # Center top sphere
        uv_sph(f'FlTop_{i}', (x, y, z + 0.05), 0.04, m, segs=10, rings=8)
    # 12 small individual leaves below as droopy detail
    for i in range(12):
        ang = i / 12 * math.pi * 2 + rng.random()*0.3
        r = 0.20 + rng.random()*0.15
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        bpy.ops.mesh.primitive_plane_add(size=0.15, location=(x, y, 0.10))
        o = bpy.context.active_object; o.name = f'BigLeaf_{i}'
        o.scale = (1.0, 1.5, 1.0)
        o.rotation_euler = (math.radians(15 + rng.random()*15),
                            math.radians(rng.random()*30 - 15),
                            ang)
        o.data.materials.append(leaf)
    join_and_export('hydrangea')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_cherry_grove()
    build_maple_grove()
    build_weeping_willow()
    build_wisteria_arbor()
    build_mushroom_cluster()
    build_ivy_arch()
    build_snow_pine()
    build_hydrangea()
    print(f'[DONE] pack v10 exported to {OUT_DIR}')
