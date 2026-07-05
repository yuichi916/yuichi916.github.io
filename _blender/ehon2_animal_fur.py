"""動物GLBに毛色を頂点カラーでベイクして再エクスポート
- STL由来メッシュはUVが縮退しやすいため、UVベイクではなく頂点カラー (COLOR_0) に焼く。
  glTF/three.js は頂点カラー対応、テクスチャ画像不要でサイズ増もない。
usage: blender -b --factory-startup --python ehon2_animal_fur.py -- [animalId ...]
省略時は全10体。GLB を上書き + 図鑑レンダ C:\tmp\ehon2\zukan3_<id>.png
"""
import bpy, math, os, sys
from mathutils import Vector

GLB_DIR = r'C:\projects\yuichi916.github.io\_ehon_assets\ehon'
OUT_DIR = r'C:\tmp\ehon2'

# 動物ごとの毛色レシピ (base/dark=ノイズ混合, belly=腹側色(Z下), spots=(色,スケール,閾値))
RECIPES = {
    'wolfpup':    dict(base=(0.44, 0.37, 0.30), dark=(0.26, 0.21, 0.17), belly=(0.72, 0.66, 0.58), spots=None, noise=6.0),
    'warthog':    dict(base=(0.38, 0.31, 0.26), dark=(0.22, 0.17, 0.14), belly=None, spots=None, noise=9.0),
    'penguin':    dict(base=(0.08, 0.09, 0.11), dark=(0.05, 0.05, 0.07), belly=(0.93, 0.93, 0.90), spots=None, noise=3.0, belly_sharp=True),
    'binturong':  dict(base=(0.16, 0.14, 0.13), dark=(0.08, 0.07, 0.07), belly=None, spots=((0.32, 0.28, 0.24), 5.0, 0.30), noise=8.0),
    'snowleopard':dict(base=(0.88, 0.86, 0.82), dark=(0.70, 0.66, 0.60), belly=(0.96, 0.95, 0.92), spots=((0.13, 0.11, 0.10), 7.0, 0.28), noise=4.0),
    'polecat':    dict(base=(0.30, 0.24, 0.19), dark=(0.14, 0.11, 0.09), belly=(0.78, 0.72, 0.60), spots=None, noise=7.0),
    'lioncub':    dict(base=(0.70, 0.53, 0.32), dark=(0.48, 0.35, 0.20), belly=(0.88, 0.78, 0.62), spots=None, noise=5.0),
    'toad':       dict(base=(0.36, 0.38, 0.24), dark=(0.22, 0.24, 0.14), belly=(0.72, 0.70, 0.52), spots=((0.20, 0.22, 0.12), 9.0, 0.30), noise=10.0),
    'turtle':     dict(base=(0.30, 0.38, 0.44), dark=(0.16, 0.22, 0.27), belly=(0.72, 0.70, 0.60), spots=((0.55, 0.58, 0.55), 10.0, 0.35), noise=6.0),
    'dingo':      dict(base=(0.60, 0.43, 0.27), dark=(0.40, 0.27, 0.16), belly=(0.85, 0.76, 0.60), spots=None, noise=5.0),
}

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
IDS = ARGV if ARGV else list(RECIPES.keys())


def hash3(ix, iy, iz):
    n = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff


def value_noise(p, scale):
    """軽量 value noise (3D)。p はローカル座標"""
    x, y, z = p.x * scale * 0.1, p.y * scale * 0.1, p.z * scale * 0.1
    ix, iy, iz = int(math.floor(x)), int(math.floor(y)), int(math.floor(z))
    fx, fy, fz = x - ix, y - iy, z - iz
    def s(t): return t * t * (3 - 2 * t)
    fx, fy, fz = s(fx), s(fy), s(fz)
    v = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy) * (fz if dz else 1 - fz)
                v += w * hash3(ix + dx, iy + dy, iz + dz)
    return v


def voronoi_dist(p, scale):
    """F1 距離 (0..~1)"""
    x, y, z = p.x * scale * 0.1, p.y * scale * 0.1, p.z * scale * 0.1
    ix, iy, iz = int(math.floor(x)), int(math.floor(y)), int(math.floor(z))
    best = 9.9
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx, cy, cz = ix + dx, iy + dy, iz + dz
                px = cx + hash3(cx, cy, cz)
                py = cy + hash3(cy, cz, cx)
                pz = cz + hash3(cz, cx, cy)
                d = math.sqrt((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2)
                best = min(best, d)
    return best


def fur_color(recipe, co, dims, n3, vd):
    """頂点1つの毛色を Python で直接評価 (ノードベイク不要・UV不要)"""
    t = min(1.0, max(0.0, (n3 - 0.35) / 0.30))
    c = [recipe['dark'][i] + (recipe['base'][i] - recipe['dark'][i]) * t for i in range(3)]
    if recipe.get('belly'):
        zn = (co.z + dims.z / 2.0) / max(0.001, dims.z)   # 0(下)..1(上) メッシュ原点=中心前提
        if recipe.get('belly_sharp'):
            f = 1.0 if zn < 0.44 else (0.0 if zn > 0.52 else (0.52 - zn) / 0.08)
        else:
            f = 1.0 if zn < 0.15 else (0.0 if zn > 0.55 else (0.55 - zn) / 0.40)
        b = recipe['belly']
        c = [c[i] + (b[i] - c[i]) * f for i in range(3)]
    if recipe.get('spots') and vd < recipe['spots'][2]:
        s_col = recipe['spots'][0]
        edge = min(1.0, (recipe['spots'][2] - vd) / 0.06)
        c = [c[i] + (s_col[i] - c[i]) * edge for i in range(3)]
    # レシピ値は sRGB 感覚 → 頂点カラーはリニア解釈されるためガンマ変換して沈める
    return [pow(max(0.0, v), 2.2) for v in c]


for aid in IDS:
    path = os.path.join(GLB_DIR, f'animal_{aid}_v1.glb')
    recipe = RECIPES[aid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    obj = objs[0]
    me = obj.data
    dims = obj.dimensions

    # 頂点カラー属性 (CORNER/BYTE) に Python で直接彩色
    if 'Col' in me.color_attributes:
        me.color_attributes.remove(me.color_attributes['Col'])
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    vcols = []
    for v in me.vertices:
        p = v.co
        n3 = value_noise(p, recipe['noise'])
        vd = voronoi_dist(p, recipe['spots'][1]) if recipe.get('spots') else 9.9
        vcols.append((*fur_color(recipe, p, dims, n3, vd), 1.0))
    for loop in me.loops:
        ca.data[loop.index].color = vcols[loop.vertex_index]

    # マテリアル: Color Attribute → Base Color
    m = bpy.data.materials.new('fur')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    me.materials.clear()
    me.materials.append(m)

    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6,
                              export_apply=True, export_yup=True)
    kb = os.path.getsize(path) / 1024
    print(f'{aid}: vertex-colored, {kb:.0f} KB')
    assert kb <= 1024, f'{aid} over 1MB'

    # 図鑑レンダ
    sc = bpy.context.scene
    for old in [o for o in bpy.data.objects if o.type in ('CAMERA', 'LIGHT')]:
        bpy.data.objects.remove(old, do_unlink=True)
    mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
    for o in objs:
        for c2 in o.bound_box:
            w = o.matrix_world @ Vector(c2)
            mn = Vector((min(mn[i], w[i]) for i in range(3)))
            mx = Vector((max(mx[i], w[i]) for i in range(3)))
    sz = mx - mn; ctr = (mn + mx) / 2
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), 0, math.radians(30))
    wd = bpy.data.worlds.new('w'); wd.use_nodes = True
    bg = wd.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.94, 0.90, 0.82, 1.0)
        bg.inputs[1].default_value = 1.0
    sc.world = wd
    cd = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cd)
    sc.collection.objects.link(co); sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.render.resolution_x = 512
    sc.render.resolution_y = 512
    rad = max(sz) * 1.7
    el = math.radians(14); az = math.radians(35)
    co.location = ctr + Vector((rad*math.cos(el)*math.sin(az), -rad*math.cos(el)*math.cos(az), rad*math.sin(el)))
    d = ctr - co.location
    co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT_DIR, f'zukan3_{aid}.png')
    bpy.ops.render.render(write_still=True)

print('FUR_DONE')
