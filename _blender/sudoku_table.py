# Export an ornate fantasy table from KitBash3D Enchanted Interiors to a
# self-contained GLB (textures embedded) for the 2D sudoku "卓上" placement.
#
#   blender -b --factory-startup --python sudoku_table.py
#
# Output: <repo>/assets/sudoku/table.glb

import bpy, os

ASSETS = r'P:\CG fanbook\3D assets'
REPO = r'C:\projects\yuichi916.github.io'
BLEND = os.path.join(ASSETS, r'KitBash3D - Valhalla\Blender\KB3D_Valhalla-Native.blend')
# Rustic Viking solid-wood table — reads as an antique table from a top-down view.
TARGET = 'KB3D_VAL_BldgMD_H_Table'

print('[open]', BLEND, flush=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)

# relink textures: actual files live in <kit>\Textures\
def relink():
    bdir = os.path.dirname(BLEND)
    roots = [bdir, os.path.dirname(bdir), os.path.dirname(os.path.dirname(bdir))]
    for r in roots:
        for sub in ('Textures', 'textures'):
            d = os.path.join(r, sub)
            if os.path.isdir(d):
                try: bpy.ops.file.find_missing_files(find_all=True, directory=d)
                except Exception as e: print('[tex] fail', e, flush=True)
relink()

obj = bpy.data.objects.get(TARGET)
if obj is None:
    raise SystemExit('table object not found: ' + TARGET)
print('[target]', obj.name, 'scale', tuple(round(s, 3) for s in obj.scale), flush=True)

bpy.ops.object.select_all(action='DESELECT')
obj.hide_set(False); obj.hide_viewport = False; obj.hide_render = False
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
# bake object scale/rotation into mesh so gltf export keeps true proportions
try:
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
except Exception as e:
    print('[apply] fail', e, flush=True)
from mathutils import Vector
mins = Vector((1e18,) * 3); maxs = Vector((-1e18,) * 3)
for c in obj.bound_box:
    w = obj.matrix_world @ Vector(c)
    for i in range(3):
        mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
print('[bbox]', tuple(round(v, 2) for v in (maxs - mins)), flush=True)

# count images actually used by the table's materials
used = set()
for slot in obj.material_slots:
    m = slot.material
    if not m or not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            used.add(n.image)
print('[mats]', len(obj.material_slots), 'slots,', len(used), 'images', flush=True)

# downscale textures so the embedded GLB stays small enough for the web.
# force-load each image first (file refs report has_data=False until loaded).
CAP = 512
scaled = 0
for img in used:
    try:
        img.reload()
        if max(img.size) > CAP:
            img.scale(CAP, CAP); scaled += 1
    except Exception as e:
        print('[scale] fail', img.name, e, flush=True)
print('[scale] downscaled', scaled, 'of', len(used), 'to', CAP, flush=True)

out = os.path.join(REPO, 'assets', 'sudoku', 'table.glb')
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_image_format='JPEG',
    export_draco_mesh_compression_enable=False,
)
print('[done]', out, os.path.getsize(out) if os.path.exists(out) else 'MISSING', flush=True)
