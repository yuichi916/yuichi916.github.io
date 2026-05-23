"""Extract KB3D Enchanted Interiors as themed room prefabs.

Mirrors the per-scene approach of enc_extract_prefabs.py but for interior
furniture/architecture pieces. Each interior scene of niwa.html gets one
GLB that contains the typical objects for its theme:

  monlight (BookStore)   → shelves + reading chair + desk + scrolls
  oto      (Watermill)   → water wheel mechanism + workbench
  tabi     (Inn)         → fireplace + beds + tables + chairs
  toki     (ClockTower)  → pendulum + gears + meditation cushion
  hoshi    (Antiquarian) → orrery + globes + bookshelves + chest
  takibi   (CandleMaker) → candles + table + iron stand + bench
  mizube   (Weaver)      → loom + spinning wheel + workbench
  amaoto   (Church)      → pews + altar + candelabra + arches
  heya     (Bakery)      → oven + table + bread basket + window

Each output is enc_int_<scene>.glb in assets/blender/. Same Draco / JPEG
texture compression pipeline as enc_extract_prefabs.py.

If the interiors .blend doesn't ship per-scene prefixes, we fall back to
picking a curated set of objects by name match (Bed*, Chair*, Fireplace*,
etc.) and grouping them.
"""
import bpy, os, math

BLEND = r'P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)


def list_objs():
    """Peek at .blend object names without loading mesh data."""
    objs = []
    with bpy.data.libraries.load(BLEND, link=False) as (data_from, _):
        for name in data_from.objects:
            objs.append(name)
    return objs


# Each scene → list of object-name *substrings* (lowercase) to include.
# We'll grep the .blend object names and grab everything that matches.
# Aim for 8-20 objects per scene for a busy interior.
SCENE_FILTERS = {
    'monlight': ['bookshelf', 'shelf', 'book', 'reading', 'chair', 'desk',
                 'scroll', 'candle', 'lantern', 'rug'],
    'oto':      ['watermill', 'wheel', 'workbench', 'barrel', 'crate',
                 'cog', 'bucket', 'pipe', 'lamp'],
    'tabi':     ['inn', 'bed', 'fireplace', 'hearth', 'table', 'chair',
                 'tankard', 'pot', 'rug', 'beam'],
    'toki':     ['pendulum', 'gear', 'cog', 'clock', 'cushion', 'pillar',
                 'arch', 'sphere'],
    'hoshi':    ['orrery', 'globe', 'astrolabe', 'bookshelf', 'chest',
                 'desk', 'shelf', 'candle', 'rug'],
    'takibi':   ['candle', 'wax', 'iron', 'stand', 'table', 'crate',
                 'bench', 'bowl'],
    'mizube':   ['loom', 'spinning', 'wheel', 'workbench', 'basket',
                 'cloth', 'rug', 'chair'],
    'amaoto':   ['pew', 'altar', 'candelabra', 'cross', 'arch', 'pillar',
                 'organ', 'banner'],
    'heya':     ['oven', 'kitchen', 'table', 'bread', 'basket',
                 'window', 'rug', 'bowl', 'shelf'],
}


def find_images_by_role(nt):
    found = {}
    def walk(t):
        for n in t.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                nm = n.image.name.lower()
                if 'basecolor' in nm or 'diffuse' in nm or 'albedo' in nm:
                    found.setdefault('basecolor', n.image)
                elif 'roughness' in nm: found.setdefault('roughness', n.image)
                elif 'metallic' in nm or 'metal' in nm: found.setdefault('metallic', n.image)
                elif 'normal' in nm or '_n.' in nm: found.setdefault('normal', n.image)
                elif 'opacity' in nm: found.setdefault('opacity', n.image)
            elif n.type == 'GROUP' and n.node_tree: walk(n.node_tree)
    walk(nt)
    return found


def rewire(mat):
    if not mat.use_nodes: mat.use_nodes = True
    nt = mat.node_tree
    imgs = find_images_by_role(nt)
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (0, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if 'basecolor' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['basecolor']
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
        if 'opacity' in imgs:
            try: nt.links.new(tx.outputs['Alpha'], bsdf.inputs['Alpha'])
            except Exception: pass
    else:
        bsdf.inputs['Base Color'].default_value = (0.55, 0.50, 0.45, 1.0)
    if 'roughness' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['roughness']
        tx.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Roughness'])
    if 'normal' in imgs:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imgs['normal']
        tx.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tx.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    print(f'[INTERIORS EXTRACT] start')
    print(f'[INTERIORS EXTRACT] discovering objects in .blend ...')
    try:
        all_objs = list_objs()
        print(f'[INTERIORS EXTRACT] found {len(all_objs)} objects total')
    except Exception as e:
        print(f'[FAIL list] {e}')
        return

    for scene_name, filters in SCENE_FILTERS.items():
        out_path = os.path.join(OUT_DIR, f'enc_int_{scene_name}.glb')
        if os.path.exists(out_path):
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[SKIP exists] enc_int_{scene_name}.glb  ({sz:.1f} MB)')
            continue
        # Find matching objects
        matched = []
        for nm in all_objs:
            low = nm.lower()
            if any(f in low for f in filters):
                matched.append(nm)
        if not matched:
            print(f'[SKIP no match] enc_int_{scene_name}  filters={filters}')
            continue
        # Cap to top 20 objects (avoid bloat)
        matched = matched[:20]
        print(f'\n[START] enc_int_{scene_name}  ({len(matched)} objects)')

        reset_scene()
        appended = 0
        for nm in matched:
            try:
                bpy.ops.wm.append(
                    directory=f"{BLEND}\\Object\\",
                    filename=nm,
                    link=False,
                )
                appended += 1
            except Exception:
                pass
        print(f'  appended {appended}/{len(matched)}')

        # Image fix + downscale
        for img in bpy.data.images:
            fp = img.filepath
            if not fp: continue
            new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
            if new_fp != fp: img.filepath = new_fp
            try:
                img.reload()
                if img.has_data and (img.size[0] > 1024 or img.size[1] > 1024):
                    img.scale(1024, 1024)
            except Exception: pass

        for mat in bpy.data.materials:
            try: rewire(mat)
            except Exception: pass

        bpy.ops.object.select_all(action='DESELECT')
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        if not meshes:
            print(f'  [SKIP no meshes] enc_int_{scene_name}')
            continue
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]

        # Centre + base at z=0 (same as enc_extract_prefabs.py)
        all_co = []
        for o in meshes:
            for v in o.data.vertices:
                all_co.append(o.matrix_world @ v.co)
        if all_co:
            xs=[c.x for c in all_co]; ys=[c.y for c in all_co]; zs=[c.z for c in all_co]
            cx = (min(xs)+max(xs))/2; cy = (min(ys)+max(ys))/2; bz = min(zs)
            bbox = (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
            for o in meshes:
                o.location.x -= cx
                o.location.y -= cy
                o.location.z -= bz
        else:
            bbox = (0,0,0)

        try:
            bpy.ops.export_scene.gltf(
                filepath=out_path, export_format='GLB',
                use_selection=True, export_apply=True,
                export_materials='EXPORT', export_yup=True,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=6,
                export_image_format='JPEG', export_jpeg_quality=85,
            )
            sz = os.path.getsize(out_path) / 1024 / 1024
            print(f'[OK] enc_int_{scene_name}.glb  meshes={len(meshes)}  size={sz:.1f}MB  bbox={bbox[0]:.1f}×{bbox[1]:.1f}×{bbox[2]:.1f}m')
        except Exception as e:
            print(f'[FAIL export] enc_int_{scene_name}: {e}')

    print('\n[DONE INTERIORS EXTRACT]')


if __name__ == '__main__':
    main()
