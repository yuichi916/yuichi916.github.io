"""Open each KB3D GLB and inspect: bbox size, materials, textures embedded?"""
import bpy, os, glob

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.images]:
    for item in list(block):
        block.remove(item)

files = sorted(glob.glob(os.path.join(OUT_DIR, 'kb3d_*.glb')))
print(f'[VERIFY] {len(files)} KB3D GLBs')
for fp in files:
    name = os.path.basename(fp)
    sz = os.path.getsize(fp) / 1024
    # Clear scene before each import
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for b in [bpy.data.meshes, bpy.data.materials, bpy.data.images]:
        for it in list(b): b.remove(it)
    try:
        bpy.ops.import_scene.gltf(filepath=fp)
    except Exception as e:
        print(f'[FAIL import] {name}: {e}')
        continue
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        print(f'[EMPTY] {name}')
        continue
    # Get unified bbox
    all_co = []
    for o in meshes:
        for v in o.data.vertices:
            all_co.append(o.matrix_world @ v.co)
    if all_co:
        xs = [c.x for c in all_co]; ys = [c.y for c in all_co]; zs = [c.z for c in all_co]
        bx = max(xs) - min(xs)
        by = max(ys) - min(ys)
        bz = max(zs) - min(zs)
    else:
        bx = by = bz = 0
    mats = bpy.data.materials
    imgs = bpy.data.images
    print(f'{name}  size={sz:.0f}KB  bbox=({bx:.1f},{by:.1f},{bz:.1f})m  '
          f'mats={len(mats)}  imgs={len(imgs)}')

print('[DONE VERIFY]')
