"""diorama 用の自作追加パーツ (ehon2_diorama.py から呼ばれる)
pages.json の "extras": [{"kind": ..., ...params}] で指定。
すべて bpy プリミティブ+マテリアルで完結 (テクスチャ不要、Draco 圧縮に優しい)。
座標系: diorama は center 後 (原点=接地中心)。pos は [x, y, z] (z=上)。
"""
import bpy, math, random
from mathutils import Vector


def _mat(name, rgb, emissive=False, strength=1.0, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if emissive:
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (*rgb, 1.0)
        em.inputs['Strength'].default_value = strength   # glTF は 1.0 でクランプ相当
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    else:
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (*rgb, 1.0)
        b.inputs['Roughness'].default_value = rough
        nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m


def _assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def clock_face(params):
    """時計盤: 石色の円盤 + 金の縁/目盛り + 針。塔の壁面に貼る想定 (法線 +Y)"""
    pos = Vector(params.get('pos', [0, 0, 10]))
    r = params.get('radius', 2.0)
    yaw = math.radians(params.get('yaw', 0))
    face_mat = _mat('clock_face', (0.04, 0.07, 0.14), rough=0.5)  # 夜空色: 石壁と対比
    rim_mat = _mat('clock_rim', (0.85, 0.65, 0.25), rough=0.35)
    hand_mat = _mat('clock_hand', (0.92, 0.88, 0.75), rough=0.4)  # 明るい針
    grp = []
    # 盤面 (薄い円柱を横倒し: 軸=Y)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=0.08, location=pos)
    face = bpy.context.object
    face.rotation_euler = (math.radians(90), 0, yaw)
    _assign(face, face_mat); grp.append(face)
    # 縁
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=r * 0.06, location=pos,
                                     major_segments=48, minor_segments=8)
    rim = bpy.context.object
    rim.rotation_euler = (math.radians(90), 0, yaw)
    _assign(rim, rim_mat); grp.append(rim)
    # 目盛り (12個の小箱)
    fwd = Vector((math.sin(yaw), -math.cos(yaw), 0)) * 0.14
    for k in range(12):
        a = k * math.pi / 6
        off = Vector((math.cos(a) * r * 0.85, 0, math.sin(a) * r * 0.85))
        off = Vector((off.x * math.cos(yaw), off.x * math.sin(yaw), off.z))
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos + off + fwd)
        t = bpy.context.object
        t.scale = (r * 0.03, 0.03, r * 0.08) if k % 3 else (r * 0.05, 0.03, r * 0.12)
        t.rotation_euler = (0, 0, yaw)
        _assign(t, rim_mat); grp.append(t)
    # 針 (時針+分針) — 10:08 の絵本的配置
    for ang, ln, wd in [(math.radians(60), r * 0.5, r * 0.07), (math.radians(-35), r * 0.75, r * 0.05)]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos + fwd * 1.5)
        h = bpy.context.object
        h.scale = (wd, 0.03, ln)
        h.rotation_euler = (ang, 0, yaw)
        # 針の根元を中心に: ピボット調整の代わりに位置を針方向へ半分ずらす
        d = Vector((math.sin(0) , 0, 1))
        h.location = pos + fwd * 1.5 + Vector((math.sin(ang) * ln / 2 * math.cos(yaw),
                                               math.sin(ang) * ln / 2 * math.sin(yaw),
                                               math.cos(ang) * ln / 2))
        _assign(h, hand_mat); grp.append(h)
    return grp


RUNE_STROKES = [   # 簡易ルーン形状 (線分ペアのリスト、単位正方形内)
    [((0.5, 0.0), (0.5, 1.0)), ((0.5, 0.6), (0.9, 0.9)), ((0.5, 0.6), (0.1, 0.9))],   # ᛉ風
    [((0.2, 0.0), (0.2, 1.0)), ((0.2, 0.9), (0.8, 0.55)), ((0.2, 0.55), (0.8, 0.2))], # ᚠ風
    [((0.2, 0.0), (0.8, 1.0)), ((0.8, 0.0), (0.2, 1.0))],                               # ᚷ風
    [((0.5, 0.0), (0.5, 1.0)), ((0.5, 1.0), (0.15, 0.6)), ((0.5, 1.0), (0.85, 0.6))],  # ᛏ風
    [((0.2, 0.0), (0.2, 1.0)), ((0.2, 0.35), (0.8, 0.65)), ((0.8, 0.35), (0.8, 1.0))], # ᚺ風
]


def floating_runes(params):
    """浮遊する発光ルーン: 大聖堂のまわりに金色のルーンが漂う"""
    rnd = random.Random(params.get('seed', 3))
    count = params.get('count', 7)
    area = params.get('area', [10, 10])
    zr = params.get('z_range', [4, 14])
    size = params.get('size', 1.2)
    mat = _mat('rune_glow', (1.0, 0.82, 0.42), emissive=True, strength=1.0)
    grp = []
    rr = params.get('radius_range')   # [r0, r1] 指定時は環状 (建物の外周) に配置
    for i in range(count):
        strokes = RUNE_STROKES[i % len(RUNE_STROKES)]
        if rr:
            a = rnd.uniform(0, math.pi * 2)
            rad0 = rnd.uniform(rr[0], rr[1])
            cx, cy = math.cos(a) * rad0, math.sin(a) * rad0
        else:
            cx = rnd.uniform(-area[0], area[0])
            cy = rnd.uniform(-area[1], area[1])
        cz = rnd.uniform(zr[0], zr[1])
        yaw = rnd.uniform(0, math.pi * 2)
        s = size * rnd.uniform(0.7, 1.3)
        for (x1, y1), (x2, y2) in strokes:
            mx, mz = (x1 + x2) / 2 - 0.5, (y1 + y2) / 2 - 0.5
            ln = math.hypot(x2 - x1, y2 - y1)
            ang = math.atan2(x2 - x1, y2 - y1)   # z軸(縦)基準の傾き
            bpy.ops.mesh.primitive_cube_add(size=1)
            seg = bpy.context.object
            seg.scale = (0.07 * s, 0.05 * s, ln * s / 2 * 1.05)
            seg.rotation_euler = (0, ang, yaw)
            lx = mx * s * math.cos(yaw)
            ly = mx * s * math.sin(yaw)
            seg.location = (cx + lx, cy + ly, cz + mz * s)
            _assign(seg, mat)
            grp.append(seg)
    return grp


def flame(params):
    """おき火 (残り火): 薪の間で光る小さな発光半球クラスタ。
    炎ジオメトリは絵本スケールで嘘くさくなるため、静かな残り火で「消えない火」を表す"""
    pos = Vector(params.get('pos', [0, 0, 0.3]))
    s = params.get('scale', 0.8)
    rnd = random.Random(params.get('seed', 6))
    cols = [(0.55, 0.10, 0.02), (0.75, 0.22, 0.04), (0.95, 0.42, 0.08)]  # 暗赤の熾き
    mats = [_mat(f'ember{i}', c, emissive=True, strength=1.0) for i, c in enumerate(cols)]
    grp = []
    for i in range(6):
        a = rnd.uniform(0, math.pi * 2)
        rr = abs(rnd.gauss(0, 0.24)) * s
        r = rnd.uniform(0.06, 0.13) * s
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r,
            location=pos + Vector((math.cos(a) * rr, math.sin(a) * rr, r * 0.35)))
        e = bpy.context.object
        e.scale = (1, 1, 0.45)
        _assign(e, mats[i % 3])
        grp.append(e)
    return grp


def floor_disc(params):
    """石畳風の円形床: セグメント分割した円盤 (単色2トーンでタイル感)"""
    r = params.get('radius', 5.0)
    pos = Vector(params.get('pos', [0, 0, 0]))
    m1 = _mat('floor_a', (0.20, 0.17, 0.13), rough=0.95)
    m2 = _mat('floor_b', (0.15, 0.13, 0.10), rough=0.95)
    rnd = random.Random(9)
    grp = []
    rings = 4
    for ri in range(rings):
        r0 = r * ri / rings
        r1 = r * (ri + 1) / rings
        segs = max(6, ri * 8)
        for si in range(segs):
            a0 = si * 2 * math.pi / segs
            a1 = (si + 1) * 2 * math.pi / segs
            am = (a0 + a1) / 2
            rm = (r0 + r1) / 2
            bpy.ops.mesh.primitive_cube_add(size=1)
            tile = bpy.context.object
            tile.scale = ((r1 - r0) * 0.985, rm * (a1 - a0) * 0.985, 0.05)
            tile.rotation_euler = (0, 0, am)
            tile.location = pos + Vector((math.cos(am) * rm, math.sin(am) * rm, 0.03))
            _assign(tile, m1 if rnd.random() < 0.6 else m2)
            grp.append(tile)
    return grp


def map_table(params):
    """地図テーブル: 木の机 + 羊皮紙 (少し丸まった平面) + 小さな島マーカー"""
    pos = Vector(params.get('pos', [0, 0, 0]))
    s = params.get('scale', 1.0)
    wood = _mat('table_wood', (0.36, 0.24, 0.14), rough=0.8)
    parch = _mat('map_parch', (0.88, 0.80, 0.62), rough=0.9)
    ink = _mat('map_ink', (0.55, 0.38, 0.20), rough=0.7)
    grp = []
    # 天板+脚
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos + Vector((0, 0, 1.0 * s)))
    top = bpy.context.object
    top.scale = (2.2 * s, 1.4 * s, 0.08 * s)
    _assign(top, wood); grp.append(top)
    for dx in (-1, 1):
        for dy in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=pos + Vector((dx * 1.9 * s, dy * 1.1 * s, 0.5 * s)))
            leg = bpy.context.object
            leg.scale = (0.12 * s, 0.12 * s, 0.5 * s)
            _assign(leg, wood); grp.append(leg)
    # 地図 (羊皮紙)
    bpy.ops.mesh.primitive_plane_add(size=1, location=pos + Vector((0, 0, 1.06 * s)))
    mp = bpy.context.object
    mp.scale = (1.8 * s, 1.1 * s, 1)
    _assign(mp, parch); grp.append(mp)
    # 島 (小さな不規則ブロブ) と航路 (細い棒)
    rnd = random.Random(4)
    for _ in range(5):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,
            radius=rnd.uniform(0.08, 0.2) * s,
            location=pos + Vector((rnd.uniform(-1.4, 1.4) * s, rnd.uniform(-0.8, 0.8) * s, 1.09 * s)))
        isl = bpy.context.object
        isl.scale = (1, 1, 0.25)
        _assign(isl, ink); grp.append(isl)
    return grp


KINDS = {
    'clock_face': clock_face,
    'floating_runes': floating_runes,
    'flame': flame,
    'floor_disc': floor_disc,
    'map_table': map_table,
}


def apply_extras(extras_list):
    created = []
    for spec in extras_list or []:
        fn = KINDS.get(spec.get('kind'))
        if fn:
            created += fn(spec)
        else:
            print('[extras] unknown kind:', spec.get('kind'))
    print(f'[extras] created {len(created)} objects')
    return created
