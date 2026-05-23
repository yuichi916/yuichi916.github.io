"""Inspect KitBash3D Dark Fantasy .blend file — list collections + object counts."""
import bpy
import os

# Open the .blend file
BLEND = r'P:\CG fanbook\KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'
print(f'[INSPECT] Opening {BLEND}')

# Use bpy.ops.wm.open_mainfile to load the file
try:
    bpy.ops.wm.open_mainfile(filepath=BLEND)
except Exception as e:
    print(f'[ERROR] Could not open: {e}')
    raise

# 1) List all collections (KitBash3D usually organizes by collection: Buildings, Props, etc.)
print('\n=== COLLECTIONS ===')
for coll in bpy.data.collections:
    obj_count = len([o for o in coll.all_objects if o.type == 'MESH'])
    print(f'  [{coll.name}] mesh-objects={obj_count}')

# 2) List top-level scene collections
print('\n=== SCENE TREE ===')
def walk(coll, depth=0):
    indent = '  ' * depth
    mesh_count = len([o for o in coll.objects if o.type == 'MESH'])
    print(f'{indent}{coll.name} (mesh={mesh_count})')
    for child in coll.children:
        walk(child, depth + 1)
walk(bpy.context.scene.collection)

# 3) Count objects by type
type_counts = {}
for o in bpy.data.objects:
    type_counts[o.type] = type_counts.get(o.type, 0) + 1
print(f'\n=== OBJECT TYPES === {type_counts}')

# 4) Sample 30 first mesh objects to understand naming
print('\n=== SAMPLE MESH OBJECTS (first 50) ===')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f'Total meshes: {len(meshes)}')
for o in meshes[:50]:
    print(f'  {o.name}  verts={len(o.data.vertices)}')

# 5) Sample distinct prefixes (group by underscore)
prefix_map = {}
for o in meshes:
    parts = o.name.split('_')
    pref = parts[0]
    prefix_map[pref] = prefix_map.get(pref, 0) + 1
print(f'\n=== TOP 30 NAME PREFIXES ===')
for k, v in sorted(prefix_map.items(), key=lambda kv: -kv[1])[:30]:
    print(f'  {k}: {v}')

# 6) Material count
print(f'\n=== MATERIALS ===')
print(f'Total materials: {len(bpy.data.materials)}')
print(f'Total images: {len(bpy.data.images)}')

print('\n[DONE INSPECT]')
