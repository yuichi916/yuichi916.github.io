"""Inspect KB3D Enchanted .blend — list collections + object counts."""
import bpy, os

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
print(f'[INSPECT] Opening {BLEND}')
bpy.ops.wm.open_mainfile(filepath=BLEND)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f'TOTAL_MESHES: {len(meshes)}')
print(f'TOTAL_MATS:   {len(bpy.data.materials)}')
print(f'TOTAL_IMGS:   {len(bpy.data.images)}')
print(f'COLLECTIONS:')
for c in bpy.data.collections:
    print(f'  - {c.name}  meshes={len([o for o in c.all_objects if o.type == "MESH"])}')

# List all mesh names + verts
print('\nALL_MESHES:')
for o in sorted(meshes, key=lambda x: x.name):
    print(f'{o.name}\t{len(o.data.vertices)}')
print('[DONE]')
