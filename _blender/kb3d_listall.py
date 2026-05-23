"""Full inventory of every mesh in KB3D Dark Fantasy."""
import bpy

BLEND = r'P:\CG fanbook\KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'
bpy.ops.wm.open_mainfile(filepath=BLEND)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f'TOTAL_MESHES: {len(meshes)}')
for o in sorted(meshes, key=lambda x: x.name):
    print(f'{o.name}\t{len(o.data.vertices)}')
print('[DONE]')
