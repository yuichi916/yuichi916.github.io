"""Verify each enc_*.glb actually contains textures."""
import bpy, os, glob

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))

files = sorted(glob.glob(os.path.join(OUT_DIR, 'enc_*.glb')))
print(f'[VERIFY] {len(files)} ENC GLBs')
for fp in files:
    name = os.path.basename(fp)
    sz = os.path.getsize(fp) / 1024
    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for b in [bpy.data.meshes, bpy.data.materials, bpy.data.images]:
        for it in list(b): b.remove(it)
    try:
        bpy.ops.import_scene.gltf(filepath=fp)
    except Exception as e:
        print(f'[FAIL] {name}: {e}'); continue
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        print(f'[EMPTY] {name}'); continue
    # bbox
    co = []
    for o in meshes:
        for v in o.data.vertices: co.append(o.matrix_world @ v.co)
    if co:
        xs=[c.x for c in co]; ys=[c.y for c in co]; zs=[c.z for c in co]
        bx = max(xs)-min(xs); by = max(ys)-min(ys); bz = max(zs)-min(zs)
    else: bx=by=bz=0
    print(f'{name}  sz={sz:.0f}KB  bbox=({bx:.1f},{by:.1f},{bz:.1f})m  '
          f'mats={len(bpy.data.materials)}  imgs={len(bpy.data.images)}')

print('[DONE]')
