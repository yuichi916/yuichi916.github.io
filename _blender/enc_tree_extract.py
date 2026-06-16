"""Extract real KB3D Enchanted foliage GLBs for the island forest.
Verified object names from kb3d_enchanted-native.blend (2026-06).
Run: blender -b --python enc_tree_extract.py
"""
import bpy, os

BLEND = r'C:\tmp\blends\enc\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       '..', 'assets', 'blender'))
TREE_JOBS = [
    ('enc_tree_green_lg', ['KB3D_ENC_BldgLgManor_A_Tree'], 512),
    ('enc_tree_green_md', ['KB3D_ENC_BldgSmUpperTownSquare_A_TreeA'], 512),
    ('enc_tree_fruit',    ['KB3D_ENC_BldgMdBookStore_A_Tree'], 512),
    ('enc_tree_autumn',   ['KB3D_ENC_BldgSmUpperTownSquare_A_TreeC'], 512),
]
_names = None
def list_objs():
    global _names
    if _names is None:
        with bpy.data.libraries.load(BLEND, link=False) as (df, _):
            _names = list(df.objects)
    return _names

_TEX_INDEX = None
def _texture_index():
    global _TEX_INDEX
    if _TEX_INDEX is not None: return _TEX_INDEX
    _TEX_INDEX = {}
    for d in (r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\KB3DTextures',
              r'C:\tmp\blends\enc\KB3DTextures'):
        if not os.path.isdir(d): continue
        for root, _dirs, files in os.walk(d):
            for fn in files: _TEX_INDEX.setdefault(fn.lower(), os.path.join(root, fn))
    print(f'  [tex index] {len(_TEX_INDEX)} files', flush=True)
    return _TEX_INDEX

def fix_image_paths():
    idx = _texture_index(); fixed=miss=0
    for img in bpy.data.images:
        try:
            if img.packed_file: continue
            ap = bpy.path.abspath(img.filepath)
            if ap and os.path.exists(ap): continue
            hit = idx.get(os.path.basename(ap or img.name).lower())
            if hit: img.filepath = hit; fixed+=1
            else: miss+=1
        except Exception: pass
    print(f'  [tex fix] remapped {fixed}, unresolved {miss}', flush=True)

def downscale(cap):
    fix_image_paths()
    for img in bpy.data.images:
        try: img.reload()
        except Exception: pass
        try:
            if img.has_data and (img.size[0] > cap or img.size[1] > cap):
                img.scale(cap, cap); img.update()
                if hasattr(img,'is_dirty') and not img.is_dirty:
                    try: img.pack()
                    except Exception: pass
        except Exception: pass

def export_sel(out_path):
    kwargs = dict(filepath=out_path, export_format='GLB', use_selection=True,
                  export_apply=True, export_materials='EXPORT', export_yup=True,
                  export_image_format='JPEG')
    for extra in ({'export_draco_mesh_compression_enable':True,'export_draco_mesh_compression_level':10},
                  {'export_jpeg_quality':80}):
        try: bpy.ops.export_scene.gltf(**dict(kwargs,**extra)); kwargs.update(extra); return
        except TypeError: continue
        except Exception: continue
    bpy.ops.export_scene.gltf(**kwargs)

def main():
    names = list_objs()
    print(f'[ENC] {len(names)} objects', flush=True)
    for out_name, sel, cap in TREE_JOBS:
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        wanted = [n for n in sel if n in names]
        if not wanted:
            print(f'[SKIP no match] {out_name} {sel}', flush=True); continue
        print(f'[START] {out_name}: {wanted}', flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ok=0
        for nm in wanted:
            try: bpy.ops.wm.append(directory=f"{BLEND}\\Object\\", filename=nm, link=False); ok+=1
            except Exception as e: print(f'  [warn] {nm}: {e}', flush=True)
        if not ok: continue
        downscale(cap)
        meshes=[o for o in bpy.data.objects if o.type=='MESH']
        if not meshes: continue
        from mathutils import Vector
        co=[]
        for o in meshes:
            for cn in o.bound_box: co.append(o.matrix_world @ Vector(cn))
        xs=[c.x for c in co]; ys=[c.y for c in co]; zs=[c.z for c in co]
        cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2; bz=min(zs)
        for o in meshes:
            if o.parent: continue
            o.location.x-=cx; o.location.y-=cy; o.location.z-=bz
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        try:
            if os.path.exists(out_path): os.remove(out_path)
            export_sel(out_path)
            print(f'[OK] {out_name}.glb {os.path.getsize(out_path)/1024/1024:.1f}MB', flush=True)
        except Exception as e: print(f'[FAIL] {out_name}: {e}', flush=True)
    print('[DONE enc_tree_extract]', flush=True)

if __name__ == '__main__':
    main()
