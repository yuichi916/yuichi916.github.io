"""v647 - Mega-Island: bake all 10 KB3D Enchanted prefabs into a SINGLE
GLB so the niwa world is ONE connected landmass instead of 10 floating
discs.

Layout matches SCENE_WORLD_POS in niwa.html — plaza at the centre and
the other 9 prefabs placed in a 3×3 grid around it.  Each prefab is
appended from the master blend, recentred at its grid cell, cobble-top
normalised to z = 0 so all 10 cobble discs share one ground plane.

Aggressive texture cap (256 px) keeps the merged GLB small enough to
serve from GitHub Pages directly.  Output:

    assets/blender/enc_megaisland_v647.glb
"""
import bpy, os, math

BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, 'enc_megaisland_v647.glb')

SEPARATION = 20.0   # metres between adjacent grid cells (cobble discs are ~16-18 m)
TEX_CAP = 256

# (scene_name, prefab prefix, grid_dx, grid_dz)
PREFABS = [
    ('plaza',    'KB3D_ENC_BldgSmLowerTownSquare_A_',   0,  0),
    ('monlight', 'KB3D_ENC_BldgMdBookStore_A_',        -1,  0),
    ('oto',      'KB3D_ENC_BldgSmWatermill_A_',         0, -1),
    ('tabi',     'KB3D_ENC_BldgMdInn_A_',               1, -1),
    ('toki',     'KB3D_ENC_BldgMdClockTower_A_',        1,  0),
    ('hoshi',    'KB3D_ENC_BldgMdAntiquarian_A_',       0,  1),
    ('takibi',   'KB3D_ENC_BldgMdCandleMaker_A_',      -1,  1),
    ('mizube',   'KB3D_ENC_BldgSmWeaver_A_',            1,  1),
    ('amaoto',   'KB3D_ENC_BldgSmChurch_A_',           -1, -1),
    # heya shares plaza's centre — for the mega-island we tuck it just
    # next to plaza at +0.6 so its building doesn't overlap the well.
    ('heya',     'KB3D_ENC_BldgMdBaker_A_',             0,  0),
]

GROUND_TOKENS = ('Ground', 'Floor', 'Cobble', 'Paving', 'Path',
                 'Terrain', 'Street', 'Plaza')


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


def list_prefab_objects(prefix):
    objs = []
    with bpy.data.libraries.load(BLEND, link=False) as (data_from, _):
        for name in data_from.objects:
            if name.startswith(prefix):
                objs.append(name)
    return objs


def cobble_top_z(objects):
    zs = []
    for o in objects:
        if o.type != 'MESH': continue
        if not any(t.lower() in o.name.lower() for t in GROUND_TOKENS):
            continue
        for v in o.data.vertices:
            wc = o.matrix_world @ v.co
            zs.append(wc.z)
    if not zs: return 0.0
    return max(zs)


def downscale_all_images(cap):
    for img in bpy.data.images:
        fp = img.filepath
        if fp:
            new_fp = fp.replace('\\4k\\', '\\2k\\').replace('/4k/', '/2k/')
            if new_fp != fp:
                img.filepath = new_fp
        try: img.reload()
        except Exception: pass
        try:
            if img.has_data and (img.size[0] > cap or img.size[1] > cap):
                img.scale(cap, cap)
        except Exception: pass


def main():
    print(f'[MEGA-ISLAND v647] target {OUT_PATH}')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for scene_name, prefix, gx, gz in PREFABS:
        print(f'\n[append] {scene_name}  prefix={prefix}  cell=({gx},{gz})')
        try:
            names_to_append = list_prefab_objects(prefix)
        except Exception as e:
            print(f'  [FAIL list] {e}')
            continue
        if not names_to_append:
            print(f'  [SKIP no objects]')
            continue
        before_objs = set(o.name for o in bpy.data.objects)
        for nm in names_to_append:
            try:
                bpy.ops.wm.append(directory=f"{BLEND}\\Object\\",
                                   filename=nm, link=False)
            except Exception:
                pass
        # Identify newly appended objects (so each scene's offset/rename
        # only affects its own meshes).
        appended = [o for o in bpy.data.objects if o.name not in before_objs]
        if not appended:
            print(f'  [SKIP nothing appended]')
            continue
        # Compute cobble-top Z so we can normalise this prefab's cobble
        # to z = 0 in world coords.
        ctop = cobble_top_z(appended)
        # Compute XY centroid of cobble so we can shift to grid cell
        xs, ys = [], []
        for o in appended:
            if o.type != 'MESH': continue
            for v in o.data.vertices:
                wc = o.matrix_world @ v.co
                xs.append(wc.x); ys.append(wc.y)
        if not xs:
            print(f'  [SKIP no verts]')
            continue
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        offX = gx * SEPARATION - cx
        offY = gz * SEPARATION - cy
        offZ = -ctop
        # Rename + shift each appended object into its slot
        for o in appended:
            try:
                o.name = f'{scene_name}__{o.name}'
            except Exception: pass
            try:
                o.location.x += offX
                o.location.y += offY
                o.location.z += offZ
            except Exception: pass
        print(f'  appended {len(appended)} objs, offset=({offX:.1f},{offY:.1f},{offZ:.1f})')

    print(f'\n[downscale] capping textures at {TEX_CAP}px')
    downscale_all_images(TEX_CAP)

    print('[rewire] simplifying materials')
    for mat in bpy.data.materials:
        try: rewire(mat)
        except Exception: pass

    print('[export] writing mega GLB')
    bpy.ops.object.select_all(action='DESELECT')
    survivors = [o for o in bpy.data.objects if o.type == 'MESH']
    if not survivors:
        print('[FAIL] no meshes to export')
        return
    for o in survivors: o.select_set(True)
    bpy.context.view_layer.objects.active = survivors[0]
    try:
        bpy.ops.export_scene.gltf(
            filepath=OUT_PATH, export_format='GLB',
            use_selection=True, export_apply=True,
            export_materials='EXPORT', export_yup=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=10,
            export_image_format='JPEG', export_jpeg_quality=70,
        )
        sz = os.path.getsize(OUT_PATH) / 1024 / 1024
        print(f'[OK] enc_megaisland_v647.glb  meshes={len(survivors)}  size={sz:.1f}MB')
    except Exception as e:
        print(f'[FAIL export] {e}')


if __name__ == '__main__':
    main()
