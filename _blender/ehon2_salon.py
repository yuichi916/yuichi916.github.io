"""salon 用: 渦巻銀河 diorama v2 (自作ジオメトリ、発光マテリアル)
usage: blender -b --factory-startup --python ehon2_salon.py
出力: C:\tmp\ehon2\salon_diorama.glb

v2 (2026-07-05): glTF の emissiveFactor は [0,1] クランプのため strength>1 は白飛びする。
→ strength 1.0 固定で彩度の高い色を使い、腕の内→外で gold→blue の色グラデーションにする。
"""
import bpy, os, math, random

random.seed(20260705)   # 再現性
OUT = r'C:\tmp\ehon2\salon_diorama.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def emissive(name, rgb):
    """strength=1.0 固定 (glTF emissiveFactor クランプ対策)。色で表現する"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*rgb, 1.0)
    em.inputs['Strength'].default_value = 1.0
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

# 内側 → 外側のグラデーションパレット (暖 → 寒)
GRAD = [
    emissive('core_gold',   (1.0, 0.82, 0.42)),
    emissive('warm_amber',  (1.0, 0.68, 0.38)),
    emissive('rose',        (1.0, 0.50, 0.55)),
    emissive('lavender',    (0.72, 0.55, 1.0)),
    emissive('ice_blue',    (0.45, 0.70, 1.0)),
]
ACCENT = emissive('white_star', (1.0, 0.97, 0.9))   # まばらな明星

def pick_mat(t):
    """t: 腕に沿った位置 0(内)→1(外)。1割は白い明星"""
    if random.random() < 0.10:
        return ACCENT
    idx = min(len(GRAD) - 1, int(t * len(GRAD) + random.uniform(-0.35, 0.35)))
    return GRAD[max(0, idx)]

# 3本腕の渦巻銀河: 対数螺旋に沿って小球 480 個
ARMS, PER_ARM = 3, 160
for arm in range(ARMS):
    base = arm * 2 * math.pi / ARMS
    for i in range(PER_ARM):
        t = i / PER_ARM
        r = 0.35 + 4.3 * t
        th = base + t * 3.6 + random.uniform(-0.14, 0.14)
        x = r * math.cos(th) + random.uniform(-0.12, 0.12)
        y = r * math.sin(th) + random.uniform(-0.12, 0.12)
        z = 0.55 + random.uniform(-0.15, 0.15) * (1.2 - t)
        sz = random.uniform(0.030, 0.080) * (1.35 - 0.55 * t)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=sz, location=(x, y, z))
        o = bpy.context.object
        bpy.ops.object.shade_smooth()
        o.data.materials.append(pick_mat(t))

# 中心コア: 大玉 + まわりの粒で「密度の高い核」を作る
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.30, location=(0, 0, 0.6))
bpy.ops.object.shade_smooth()
bpy.context.object.data.materials.append(GRAD[0])
for _ in range(60):
    a = random.uniform(0, 2 * math.pi)
    rr = abs(random.gauss(0, 0.28))
    zz = 0.6 + random.gauss(0, 0.09)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5,
        radius=random.uniform(0.03, 0.07), location=(rr * math.cos(a), rr * math.sin(a), zz))
    bpy.ops.object.shade_smooth()
    bpy.context.object.data.materials.append(GRAD[0] if random.random() < 0.7 else GRAD[1])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True)
print('SALON_EHON2_DONE', round(os.path.getsize(OUT) / 1048576, 2), 'MB')
