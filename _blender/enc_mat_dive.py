"""Dive into KB3D ENC material structure."""
import bpy

BLEND = r'P:\CG fanbook\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
bpy.ops.wm.open_mainfile(filepath=BLEND)

mats = list(bpy.data.materials)
print(f'TOTAL_MATS: {len(mats)}')

# Walk first 5 materials in detail
for mat in mats[:5]:
    print(f'\n=== Material: {mat.name} ===')
    if not mat.use_nodes:
        print('  NO NODES')
        continue
    nt = mat.node_tree
    for n in nt.nodes:
        print(f'  node[{n.type}] name={n.name!r}')
        if n.type == 'GROUP' and n.node_tree:
            print(f'    -> group: {n.node_tree.name}')
            # peek into group
            for sub in n.node_tree.nodes:
                if sub.type == 'TEX_IMAGE':
                    img = sub.image
                    print(f'       TEX_IMAGE  img={img.name if img else None}  '
                          f'has_data={img.has_data if img else False}  '
                          f'filepath={img.filepath if img else None}')
        if n.type == 'TEX_IMAGE':
            img = n.image
            print(f'    TEX_IMAGE  img={img.name if img else None}  '
                  f'has_data={img.has_data if img else False}  '
                  f'filepath={img.filepath if img else None}')
