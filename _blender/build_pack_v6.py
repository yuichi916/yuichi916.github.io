"""
Pack v6 — festival / village kit. Original procedural Blender meshes.
Builds:
  sundial, well_bucket, koi, sake_barrel, banner, festival_lantern_string
Run headless:
  blender --background --python build_pack_v6.py
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


# ─── 1. SUNDIAL ───────────────────────────────────────────────────────
def build_sundial():
    """Stone pedestal + bronze dial plate + gnomon angled to point at the sun."""
    clear_scene()
    stone = pbr('SundialStone', (0.62, 0.58, 0.52), 0.95)
    stone_dark = pbr('SundialStoneDark', (0.40, 0.38, 0.34), 0.92)
    bronze = pbr('SundialBronze', (0.55, 0.40, 0.18), 0.45, metal=0.75)
    bronze_dark = pbr('SundialBronzeDark', (0.32, 0.22, 0.10), 0.55, metal=0.65)
    # Pedestal — wide base, narrower column, capital
    cyl('PedBase', (0, 0, 0.10), 0.45, 0.20, stone_dark, verts=24, bevel=0.02)
    cyl('PedCol',  (0, 0, 0.45), 0.30, 0.50, stone, verts=24, bevel=0.02)
    cyl('PedCap',  (0, 0, 0.78), 0.40, 0.10, stone_dark, verts=24, bevel=0.02)
    # Dial plate (bronze disk)
    cyl('Dial', (0, 0, 0.86), 0.36, 0.04, bronze, verts=48)
    # Inscribed ring (slight darker rim)
    torus('DialRim', (0, 0, 0.88), 0.34, 0.012, bronze_dark, maj=48, min_=8)
    # 12 hour ticks (small bronze cylinders)
    for i in range(12):
        ang = i / 12.0 * math.pi * 2
        x = math.cos(ang) * 0.30
        y = math.sin(ang) * 0.30
        cyl(f'Tick_{i}', (x, y, 0.89), 0.012, 0.025, bronze_dark, verts=6)
    # Gnomon (triangular blade pointing north, tilted)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 1.02))
    o = bpy.context.active_object; o.name = 'Gnomon'
    o.scale = (0.02, 0.26, 0.30)
    o.rotation_euler = (math.radians(35), 0, 0)
    o.data.materials.append(bronze)
    # Solidify gnomon
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.015
    # Decorative orb on top
    uv_sph('Orb', (0, -0.18, 1.20), 0.05, bronze, segs=16, rings=12)
    join_and_export('sundial')


# ─── 2. WELL BUCKET ──────────────────────────────────────────────────
def build_well_bucket():
    """Wooden bucket with iron bands and rope handle, water rim inside."""
    clear_scene()
    wood = pbr('BucketWood', (0.52, 0.34, 0.20), 0.85)
    wood_dark = pbr('BucketWoodDark', (0.32, 0.20, 0.10), 0.88)
    iron = pbr('BucketIron', (0.22, 0.20, 0.18), 0.45, metal=0.85)
    rope = pbr('BucketRope', (0.78, 0.68, 0.48), 0.95)
    water = pbr('BucketWater', (0.18, 0.36, 0.45), 0.25, metal=0.2)
    # Body (wood staves approximated with a cylinder)
    cyl('BucketBody', (0, 0, 0.20), 0.20, 0.36, wood, verts=24, bevel=0.005)
    # Slight taper — top wider than bottom: scale to taper
    o = bpy.context.active_object
    # Inner water disk
    cyl('Water', (0, 0, 0.36), 0.17, 0.01, water, verts=24)
    # Iron bands (top + bottom)
    torus('BandTop', (0, 0, 0.36), 0.205, 0.015, iron, maj=32, min_=8)
    torus('BandMid', (0, 0, 0.20), 0.205, 0.012, iron, maj=32, min_=8)
    torus('BandBot', (0, 0, 0.04), 0.205, 0.015, iron, maj=32, min_=8)
    # Bottom disk (cap)
    cyl('Bottom', (0, 0, 0.02), 0.20, 0.02, wood_dark, verts=24)
    # Handle — half torus on top
    torus('Handle', (0, 0, 0.42), 0.20, 0.012, iron, maj=24, min_=6, rot=(math.pi/2, 0, 0))
    # Rope wrapping the handle (3 small toruses)
    for i, t in enumerate([-0.10, 0, 0.10]):
        torus(f'Rope_{i}', (t, 0, 0.42), 0.022, 0.008, rope, maj=12, min_=6, rot=(0, math.pi/2, 0))
    join_and_export('well_bucket')


# ─── 3. KOI FISH ─────────────────────────────────────────────────────
def build_koi():
    """Stylized koi — elongated body with red/white pattern, fins."""
    clear_scene()
    body_white = pbr('KoiWhite', (0.95, 0.92, 0.88), 0.45)
    body_red = pbr('KoiRed', (0.90, 0.18, 0.10), 0.45)
    fin = pbr('KoiFin', (0.96, 0.94, 0.90), 0.35)
    eye = pbr('KoiEye', (0.08, 0.06, 0.04), 0.25)
    # Body — elongated sphere
    uv_sph('KoiBody', (0, 0, 0), 0.18, body_white, segs=24, rings=16)
    o = bpy.context.active_object; o.scale = (2.4, 0.85, 0.65)
    # Red patches (smaller spheres along the back)
    for i, x in enumerate([-0.20, 0.05, 0.25]):
        uv_sph(f'KoiPatch_{i}', (x, 0, 0.04), 0.10, body_red, segs=14, rings=10)
        o = bpy.context.active_object; o.scale = (0.9, 0.65, 0.4)
    # Tail (flat triangular pair)
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.0, depth=0.20,
                                     location=(-0.46, 0, 0), vertices=8)
    o = bpy.context.active_object; o.name = 'KoiTailUp'
    o.rotation_euler = (0, math.radians(-90), 0)
    o.scale = (1.0, 1.4, 0.15)
    o.data.materials.append(fin)
    # Dorsal fin
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, radius2=0.0, depth=0.10,
                                     location=(-0.05, 0, 0.16), vertices=8)
    o = bpy.context.active_object; o.name = 'KoiDorsal'
    o.scale = (1.0, 0.20, 1.0)
    o.data.materials.append(fin)
    # Side fins
    for y_sign in [-1, 1]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.07, radius2=0.0, depth=0.12,
                                         location=(0.10, 0.12*y_sign, -0.02), vertices=8)
        o = bpy.context.active_object
        o.rotation_euler = (math.radians(45*y_sign), 0, 0)
        o.scale = (1.2, 0.2, 0.9)
        o.data.materials.append(fin)
    # Eyes
    for y_sign in [-1, 1]:
        uv_sph(f'KoiEye_{y_sign}', (0.32, 0.10*y_sign, 0.04), 0.018, eye, segs=10, rings=8)
    join_and_export('koi')


# ─── 4. SAKE BARREL ──────────────────────────────────────────────────
def build_sake_barrel():
    """Straw-wrapped sake barrel (kazaridaru style) with red cloth ties."""
    clear_scene()
    straw = pbr('Straw', (0.82, 0.68, 0.32), 0.95)
    straw_dark = pbr('StrawDark', (0.55, 0.42, 0.18), 0.95)
    cloth_red = pbr('Cloth', (0.78, 0.12, 0.10), 0.85)
    wood = pbr('BarrelWood', (0.42, 0.28, 0.16), 0.90)
    # Outer straw barrel
    cyl('Barrel', (0, 0, 0.32), 0.36, 0.64, straw, verts=32, bevel=0.02)
    # Top + bottom darker rims
    torus('RimTop', (0, 0, 0.62), 0.36, 0.022, straw_dark, maj=40, min_=8)
    torus('RimBot', (0, 0, 0.02), 0.36, 0.022, straw_dark, maj=40, min_=8)
    # 4 cloth ties around the barrel (red bands)
    for i in range(3):
        z = 0.12 + i * 0.20
        torus(f'Tie_{i}', (0, 0, z), 0.362, 0.022, cloth_red, maj=40, min_=10)
    # Top lid (wooden disk inset)
    cyl('Lid', (0, 0, 0.64), 0.30, 0.04, wood, verts=24)
    # Vertical straw striations (8 thin cylinders to suggest weave)
    for i in range(8):
        ang = i / 8.0 * math.pi * 2
        x = math.cos(ang) * 0.365
        y = math.sin(ang) * 0.365
        cyl(f'Strand_{i}', (x, y, 0.32), 0.008, 0.60, straw_dark, verts=6)
    join_and_export('sake_barrel')


# ─── 5. FESTIVAL BANNER (Nobori-style vertical flag) ─────────────────
def build_banner():
    """Tall vertical cloth banner on bamboo pole with crossbar at top."""
    clear_scene()
    pole = pbr('BannerPole', (0.32, 0.55, 0.30), 0.85)
    pole_node = pbr('BannerNode', (0.22, 0.40, 0.18), 0.88)
    cloth = pbr('BannerCloth', (0.92, 0.92, 0.88), 0.95)
    accent = pbr('BannerAccent', (0.78, 0.12, 0.10), 0.90)
    ink = pbr('BannerInk', (0.10, 0.08, 0.06), 0.92)
    cap = pbr('BannerCap', (0.18, 0.16, 0.14), 0.55, metal=0.5)
    # Bamboo pole
    cyl('Pole', (0, 0, 1.10), 0.025, 2.20, pole, verts=12)
    # Bamboo nodes (rings every 0.4)
    for i, z in enumerate([0.50, 0.90, 1.30, 1.70, 2.10]):
        torus(f'Node_{i}', (0, 0, z), 0.028, 0.008, pole_node, maj=16, min_=6)
    # Pole cap (small dark sphere on top)
    uv_sph('Cap', (0, 0, 2.22), 0.035, cap, segs=12, rings=10)
    # Top crossbar
    cyl('Cross', (0.15, 0, 2.10), 0.012, 0.30, pole, verts=10, rot=(0, math.pi/2, 0))
    # Cloth banner — long thin plane on the side of pole
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.20, 0, 1.20))
    o = bpy.context.active_object; o.name = 'Cloth'
    o.scale = (0.28, 0.01, 1.80)
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(cloth)
    sm = o.modifiers.new('Solidify', 'SOLIDIFY'); sm.thickness = 0.008
    # Red top stripe
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.20, -0.005, 2.02))
    o = bpy.context.active_object; o.name = 'TopStripe'
    o.scale = (0.28, 0.01, 0.12)
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(accent)
    # Bottom red stripe
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.20, -0.005, 0.40))
    o = bpy.context.active_object; o.name = 'BotStripe'
    o.scale = (0.28, 0.01, 0.12)
    o.rotation_euler = (math.pi/2, 0, 0)
    o.data.materials.append(accent)
    # 3 ink "characters" (small dark boxes vertically)
    for i, z in enumerate([1.60, 1.30, 1.00]):
        box(f'Char_{i}', (0.20, -0.012, z), (0.14, 0.005, 0.14), ink)
    join_and_export('banner')


# ─── 6. FESTIVAL LANTERN STRING ──────────────────────────────────────
def build_festival_lantern_string():
    """A swag of 7 paper lanterns hanging from a slack rope — for matsuri scenes."""
    clear_scene()
    rope = pbr('LanternRope', (0.38, 0.28, 0.18), 0.92)
    paper_red = pbr('LanternRed', (0.92, 0.30, 0.18), 0.70,
                    emit=(1.0, 0.55, 0.30), emit_strength=0.55)
    paper_white = pbr('LanternWhite', (0.96, 0.92, 0.82), 0.70,
                      emit=(1.0, 0.92, 0.70), emit_strength=0.45)
    cap = pbr('LanternCap', (0.18, 0.14, 0.10), 0.75)
    tassel = pbr('LanternTassel', (0.78, 0.12, 0.10), 0.92)
    # Rope (slight catenary — approximate by segmented cylinders)
    N_LANTERNS = 7
    span_x = 3.2
    sag = 0.18
    cy_top = 1.40
    def rope_y(t):
        # parabolic sag
        return cy_top - sag * (1.0 - (2.0*t - 1.0)**2)
    # rope segments
    seg = 24
    last = None
    for i in range(seg):
        t1 = i / seg
        t2 = (i + 1) / seg
        x1 = -span_x/2 + t1 * span_x
        x2 = -span_x/2 + t2 * span_x
        y1 = rope_y(t1); y2 = rope_y(t2)
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        dx = x2 - x1; dy = y2 - y1
        L = math.hypot(dx, dy)
        ang = math.atan2(dy, dx)
        cyl(f'Rope_{i}', (mx, 0, my), 0.012, L, rope, verts=6, rot=(0, math.radians(90), -ang))
    # Lanterns
    for i in range(N_LANTERNS):
        t = (i + 0.5) / N_LANTERNS
        x = -span_x/2 + t * span_x
        y_rope = rope_y(t)
        y_lantern = y_rope - 0.30
        m = paper_red if i % 2 == 0 else paper_white
        # paper body
        uv_sph(f'Paper_{i}', (x, 0, y_lantern), 0.16, m, segs=18, rings=14)
        o = bpy.context.active_object; o.scale = (1.0, 1.0, 0.85)
        # top cap
        cyl(f'CapT_{i}', (x, 0, y_lantern + 0.135), 0.06, 0.025, cap, verts=12)
        # bottom cap
        cyl(f'CapB_{i}', (x, 0, y_lantern - 0.135), 0.06, 0.025, cap, verts=12)
        # short string from rope to lantern top
        cyl(f'Drop_{i}', (x, 0, y_rope - 0.08), 0.006, 0.16, rope, verts=6)
        # tassel below
        cyl(f'Tas_{i}', (x, 0, y_lantern - 0.20), 0.018, 0.08, tassel, verts=8)
    join_and_export('festival_lantern_string')


# ─── RUN ALL ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    build_sundial()
    build_well_bucket()
    build_koi()
    build_sake_barrel()
    build_banner()
    build_festival_lantern_string()
    print(f'[DONE] pack v6 exported to {OUT_DIR}')
