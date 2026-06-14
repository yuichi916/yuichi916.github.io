# Export an ornate fantasy table from KitBash3D Enchanted Interiors to a
# self-contained GLB (textures embedded) for the 2D sudoku "卓上" placement.
#
#   blender -b --factory-startup --python sudoku_table.py
#
# Output: <repo>/assets/sudoku/table.glb

import bpy, os

ASSETS = r'P:\CG fanbook\3D assets'
REPO = r'C:\projects\yuichi916.github.io'
BLEND = os.path.join(ASSETS, r'Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors-native.blend')
# Ornate banquet table body (exact object). Chalices are linked duplicates that
# can't take transform_apply, so we export the table alone for clean geometry.
TARGET = 'KB3D_ECI_IntKingsHall_A_TableA'

print('[open]', BLEND, flush=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)

# relink textures: actual files live in <kit>\Textures\
def relink():
    bdir = os.path.dirname(BLEND)
    for d in [os.path.join(bdir, 'Textures'), os.path.join(bdir, 'textures')]:
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

out = os.path.join(REPO, 'assets', 'sudoku', 'table.glb')
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_image_format='AUTO',
)
print('[done]', out, os.path.getsize(out) if os.path.exists(out) else 'MISSING', flush=True)
