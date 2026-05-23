"""Check KB3D image data block status — are textures embedded or external links?"""
import bpy

BLEND = r'P:\CG fanbook\KitBash3D - Dark Fantasy\Blender\KB3D_DarkFantasy-Native.blend'
bpy.ops.wm.open_mainfile(filepath=BLEND)

print(f'Total images: {len(bpy.data.images)}')
print(f'Total materials: {len(bpy.data.materials)}')
print()
for img in bpy.data.images:
    has_data = img.has_data
    filepath = img.filepath
    packed = img.packed_file is not None
    sz = img.size
    print(f'  [{img.name}]  has_data={has_data}  packed={packed}  size={sz}  filepath={filepath!r}')

# Check what nodes each material actually uses
print('\n== MATERIAL NODES ==')
for mat in list(bpy.data.materials)[:6]:
    if not mat.use_nodes:
        print(f'[{mat.name}]  no nodes')
        continue
    types = set()
    img_node_count = 0
    for n in mat.node_tree.nodes:
        types.add(n.type)
        if n.type == 'TEX_IMAGE':
            img_node_count += 1
    print(f'[{mat.name}]  img_nodes={img_node_count}  types={types}')
