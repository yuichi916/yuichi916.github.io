"""ehon2 diorama GLB ビルダー (明示 prefix 選定方式)
usage: blender -b --factory-startup --python ehon2_diorama.py -- <pageId>
入力: _blender/ehon2_pages.json の <pageId> エントリ
出力: C:\tmp\ehon2\<pageId>_diorama.glb + thumb_<pageId>.png
"""
import bpy, sys, os, json, math
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PAGE = ARGV[0]
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'ehon2_pages.json'), encoding='utf-8'))[PAGE]
OUT_DIR = r'C:\tmp\ehon2'
os.makedirs(OUT_DIR, exist_ok=True)
SLUG = PAGE.replace('-', '')   # hollow-tale → hollowtale (PAGES の diorama 名・toc 名と一致させる)
OUT = os.path.join(OUT_DIR, f'{SLUG}_diorama.glb')

bpy.ops.wm.open_mainfile(filepath=CFG['blend'])
if CFG.get('tex') and os.path.isdir(CFG['tex']):
    try: bpy.ops.file.find_missing_files(directory=CFG['tex'])
    except Exception as e: print('[ehon2] ffm err', e)

def center(o):
    acc = Vector((0,0,0))
    for c in o.bound_box: acc += o.matrix_world @ Vector(c)
    return acc / 8

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
keep = []
prefixes = CFG.get('include_prefixes') or []
excl = CFG.get('exclude_substr') or []
if prefixes:
    keep = [o for o in meshes
            if any(o.name.startswith(p) for p in prefixes)
            and not any(x.lower() in o.name.lower() for x in excl)]
if CFG.get('focal') and CFG.get('radius'):   # prefix に加えて焦点半径でも拾える (併用可)
    focal = None
    for o in meshes:
        if CFG['focal'].lower() in o.name.lower(): focal = center(o); break
    if focal is not None:
        for o in meshes:
            c = center(o)
            if math.hypot(c.x-focal.x, c.y-focal.y) <= CFG['radius'] and o not in keep \
               and not any(x.lower() in o.name.lower() for x in excl):
                keep.append(o)
assert keep, f'[ehon2] no objects selected for {PAGE}'
print(f'[ehon2] {PAGE} keep={len(keep)}')

keepset = set(keep)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o not in keepset:
        bpy.data.objects.remove(o, do_unlink=True)

DEC_HEAVY = float(CFG.get('decimate_heavy', 0.25))
for o in keep:
    if len(o.data.vertices) > 5000:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = DEC_HEAVY
    elif len(o.data.vertices) > 1000:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.5

mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector((min(mn[i], w[i]) for i in range(3)))
        mx = Vector((max(mx[i], w[i]) for i in range(3)))
ctr = (mn + mx) / 2
for o in keep:
    o.location -= Vector((ctr.x, ctr.y, mn.z))

MAXTEX = int(CFG.get('max_tex', 1024))
for im in bpy.data.images:
    try:
        w, h = im.size
        if w > MAXTEX or h > MAXTEX:
            s = MAXTEX / max(w, h)
            im.scale(max(1, int(w*s)), max(1, int(h*s)))
    except Exception: pass

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=10,
                          export_image_format='WEBP', export_image_quality=40,
                          export_apply=True, export_yup=True)
size_mb = os.path.getsize(OUT) / 1048576
print(f'[ehon2] {OUT} = {size_mb:.2f} MB')
assert size_mb <= 4.0, f'GLB over budget: {size_mb:.2f} MB > 4 MB — include_prefixes を絞るか max_tex を下げる'

# ---- サムネレンダ (目次用) ----
tc = CFG.get('thumb_cam', {'dist': 30, 'elev_deg': 28, 'azim_deg': 35})
sz = (mx - mn)
rad = max(sz.x, sz.y, sz.z) * 1.15 if max(sz.x, sz.y, sz.z) > 0 else tc['dist']
el = math.radians(tc['elev_deg']); az = math.radians(tc['azim_deg'])
cam_d = bpy.data.cameras.new('thumbcam'); cam_o = bpy.data.objects.new('thumbcam', cam_d)
bpy.context.scene.collection.objects.link(cam_o)
tgt = Vector((0, 0, sz.z * 0.35))
cam_o.location = tgt + Vector((rad*math.cos(el)*math.cos(az), -rad*math.cos(el)*math.sin(az), rad*math.sin(el)))
d = tgt - cam_o.location
cam_o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam_o
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5
sun_o = bpy.data.objects.new('sun', sun); bpy.context.scene.collection.objects.link(sun_o)
sun_o.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.scene.render.engine = 'CYCLES'   # 前回実績 (ehon_world_render.py)。EEVEE系はBlender5.1で名称流動のため使わない
bpy.context.scene.cycles.samples = 64
bpy.context.scene.render.resolution_x = 640
bpy.context.scene.render.resolution_y = 400
bpy.context.scene.render.filepath = os.path.join(OUT_DIR, f'thumb_{SLUG}.png')
bpy.ops.render.render(write_still=True)
print(f'{SLUG.upper()}_EHON2_DONE')
