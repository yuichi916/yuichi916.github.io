"""salon 用: 渦巻銀河 diorama (自作ジオメトリ、発光マテリアル)
usage: blender -b --factory-startup --python ehon2_salon.py
出力: C:\tmp\ehon2\salon_diorama.glb
"""
import bpy, os, math, random

random.seed(20260705)   # 再現性
OUT = r'C:\tmp\ehon2\salon_diorama.glb'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def emissive(name, rgb, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*rgb, 1.0)
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

PALETTE = [((1.0,0.85,0.55), 5.0), ((0.65,0.8,1.0), 5.0), ((1.0,0.6,0.7), 4.0), ((0.85,0.7,1.0), 4.0)]
mats = [emissive(f'star{i}', c, s) for i, (c, s) in enumerate(PALETTE)]

# 3本腕の渦巻銀河: 対数螺旋に沿って小球 420 個
ARMS, PER_ARM = 3, 140
for arm in range(ARMS):
    base = arm * 2 * math.pi / ARMS
    for i in range(PER_ARM):
        t = i / PER_ARM
        r = 0.35 + 4.3 * t
        th = base + t * 3.6 + random.uniform(-0.16, 0.16)
        x = r * math.cos(th) + random.uniform(-0.12, 0.12)
        y = r * math.sin(th) + random.uniform(-0.12, 0.12)
        z = 0.55 + random.uniform(-0.16, 0.16) * (1.2 - t)
        sz = random.uniform(0.028, 0.085) * (1.35 - 0.6 * t)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=sz, location=(x, y, z))
        o = bpy.context.object
        o.data.materials.append(random.choice(mats))
# 中心コア
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.34, location=(0, 0, 0.6))
bpy.context.object.data.materials.append(emissive('core', (1.0, 0.95, 0.8), 9.0))

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_apply=True, export_yup=True)
print('SALON_EHON2_DONE', os.path.getsize(OUT) / 1048576, 'MB')
