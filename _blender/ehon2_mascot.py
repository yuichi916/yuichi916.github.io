"""マスコット立ち絵 → 紙人形ビルボードGLB
透過PNGを両面平面に貼り、僅かに傾けた「紙の立ち人形」として出力。
usage: blender -b --factory-startup --python ehon2_mascot.py -- <png> <out.glb>
"""
import bpy, sys, os

ARGV = sys.argv[sys.argv.index('--') + 1:]
PNG, OUT = ARGV[0], ARGV[1]

bpy.ops.wm.read_factory_settings(use_empty=True)

img = bpy.data.images.load(PNG)
w, h = img.size
aspect = w / h

# 高さ1.0の平面 (幅=aspect)。原点=足元中央
# plane(size=1) は中心原点・半幅0.5 → scale(aspect,1,1) で幅aspect×高さ1.0
bpy.ops.mesh.primitive_plane_add(size=1)
o = bpy.context.object
o.scale = (aspect, 1, 1)
bpy.ops.object.transform_apply(scale=True)
o.rotation_euler = (1.5707963, 0, 0)   # XY平面 → 立てる (法線±Y)
bpy.ops.object.transform_apply(rotation=True)
o.location = (0, 0, 0.5)               # 中心z=0.5 → 頂点z 0..1.0 = 足元原点
bpy.ops.object.transform_apply(location=True)

m = bpy.data.materials.new('mascot')
m.use_nodes = True
m.blend_method = 'BLEND'
nt = m.node_tree
nt.nodes.clear()
out_n = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
bsdf.inputs['Roughness'].default_value = 0.85
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
nt.links.new(bsdf.outputs['BSDF'], out_n.inputs['Surface'])
o.data.materials.append(m)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_image_format='WEBP', export_image_quality=88,
                          export_apply=True, export_yup=True)
print('MASCOT_GLB', round(os.path.getsize(OUT) / 1024), 'KB')
