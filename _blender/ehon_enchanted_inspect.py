"""Enchanted シーン棚卸し: コレクション/オブジェクト/bbox/カメラを inspect.json に出力。
   bpy.data.libraries.load() を使いオブジェクト名だけを取得し、フルロードを回避。
   blender -b --factory-startup --python ehon_enchanted_inspect.py
"""
import bpy, json, os

BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT   = r'C:\tmp\ehon\inspect.json'

os.makedirs(os.path.dirname(OUT), exist_ok=True)

print(f'[INSPECT] Using library.load to enumerate objects from {BLEND}', flush=True)

with bpy.data.libraries.load(BLEND, link=False) as (data_from, data_to):
    all_obj_names = list(data_from.objects)
    all_col_names = list(data_from.collections)
    all_mesh_names = list(data_from.meshes)

print(f'[INSPECT] Found {len(all_obj_names)} objects, {len(all_col_names)} collections, {len(all_mesh_names)} meshes', flush=True)

# Categorize objects by name prefix
def categorize(names):
    cats = {}
    for n in names:
        parts = n.split('_')
        # KB3D_ENC_BldgXxx -> category = BldgXxx type
        if len(parts) >= 3 and parts[0] == 'KB3D':
            cat = parts[2] if len(parts) > 2 else 'Other'
            cats.setdefault(cat, []).append(n)
        else:
            cats.setdefault('Other', []).append(n)
    return cats

obj_cats = categorize(all_obj_names)

data = {
    'blend': BLEND,
    'object_count': len(all_obj_names),
    'collection_count': len(all_col_names),
    'mesh_count': len(all_mesh_names),
    'collection_names': sorted(all_col_names),
    'object_categories': {k: sorted(v) for k, v in sorted(obj_cats.items())},
    'all_object_names': sorted(all_obj_names),
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'INSPECT_DONE {len(all_obj_names)} objects, {len(all_col_names)} collections', flush=True)
print(f'Written to {OUT}', flush=True)
