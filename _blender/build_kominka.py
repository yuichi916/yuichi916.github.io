"""
Procedurally build a commercial-RPG-quality kominka (Japanese traditional house) in Blender,
export as kominka.glb for use in niwa.html via three.js GLTFLoader.

Run headless:
  blender --background --python build_kominka.py
"""
import bpy
import os
import math

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'blender')
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    """Remove all objects from the default scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images]:
        for item in list(block):
            block.remove(item)


def make_pbr_material(name, base_color, roughness=0.85, metallic=0.0, emission=None):
    """Create a Principled-BSDF PBR material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        em_input = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        if em_input is not None:
            em_input.default_value = (*emission, 1.0)
        strength = bsdf.inputs.get('Emission Strength')
        if strength is not None:
            strength.default_value = 0.5
    return mat


def add_box(name, location, size, material=None, subsurf=0, bevel=0.0):
    """Add a box at location with size (sx,sy,sz). Optionally subsurface + bevel."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    if material:
        obj.data.materials.append(material)
    if bevel > 0:
        bm = obj.modifiers.new(name='Bevel', type='BEVEL')
        bm.width = bevel
        bm.segments = 2
    if subsurf > 0:
        sm = obj.modifiers.new(name='Subsurf', type='SUBSURF')
        sm.levels = subsurf
        sm.render_levels = subsurf
    return obj


def add_cylinder(name, location, radius, depth, material=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=location, vertices=vertices)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def build_kominka():
    """Build one detailed kominka model."""
    clear_scene()

    # --- Materials (PBR) ---
    mat_foundation = make_pbr_material('Foundation', (0.18, 0.16, 0.13), roughness=0.95)
    mat_wall = make_pbr_material('Plaster', (0.88, 0.82, 0.66), roughness=0.92)
    mat_beam = make_pbr_material('DarkBeam', (0.10, 0.06, 0.04), roughness=0.85)
    mat_thatch = make_pbr_material('Thatch', (0.27, 0.18, 0.10), roughness=0.95)
    mat_thatch_dark = make_pbr_material('ThatchDark', (0.15, 0.10, 0.06), roughness=0.95)
    mat_shoji = make_pbr_material('Shoji', (0.96, 0.92, 0.78), roughness=0.6,
                                  emission=(1.0, 0.85, 0.55))
    mat_door = make_pbr_material('Door', (0.30, 0.20, 0.12), roughness=0.85)
    mat_chimney = make_pbr_material('ChimneyStone', (0.28, 0.26, 0.24), roughness=0.92)

    # --- Foundation (stone base) ---
    foundation = add_box('Foundation', (0, 0, 0.15), (3.0, 2.4, 0.30), mat_foundation, bevel=0.02)

    # --- Main walls (plaster body) ---
    walls = add_box('Walls', (0, 0, 1.0), (2.7, 2.1, 1.40), mat_wall, bevel=0.015)

    # --- Vertical timber beams at corners ---
    beam_locations = [(-1.30, -1.0, 1.0), (1.30, -1.0, 1.0),
                       (-1.30, 1.0, 1.0), (1.30, 1.0, 1.0)]
    for i, loc in enumerate(beam_locations):
        add_box(f'CornerBeam_{i}', loc, (0.10, 0.10, 1.40), mat_beam, bevel=0.01)

    # --- Horizontal trim beams (top and bottom) ---
    for y in [-1.05, 1.05]:
        add_box(f'TrimH_{y}', (0, y, 1.70), (2.85, 0.10, 0.10), mat_beam, bevel=0.01)
        add_box(f'TrimH_{y}_low', (0, y, 0.35), (2.85, 0.10, 0.10), mat_beam, bevel=0.01)
    for x in [-1.35, 1.35]:
        add_box(f'TrimV_{x}', (x, 0, 1.70), (0.10, 2.10, 0.10), mat_beam, bevel=0.01)
        add_box(f'TrimV_{x}_low', (x, 0, 0.35), (0.10, 2.10, 0.10), mat_beam, bevel=0.01)

    # --- Shoji windows (front & back) ---
    for y_side in [-1.06, 1.06]:
        for x_off in [-0.7, 0.7]:
            shoji = add_box(f'Shoji_{y_side}_{x_off}', (x_off, y_side, 1.10),
                            (0.45, 0.02, 0.55), mat_shoji)
            # Frame grid (thin overlay lattice)
            for gx in [-0.18, 0, 0.18]:
                add_box(f'ShojiV', (x_off+gx, y_side+(0.01 if y_side>0 else -0.01), 1.10),
                        (0.012, 0.005, 0.55), mat_beam)
            for gz in [0.85, 1.10, 1.35]:
                add_box(f'ShojiH', (x_off, y_side+(0.01 if y_side>0 else -0.01), gz),
                        (0.45, 0.005, 0.012), mat_beam)

    # --- Front door ---
    door = add_box('Door', (0, -1.06, 0.7), (0.6, 0.05, 0.95), mat_door, bevel=0.01)

    # --- Roof (hipped gable) ---
    # Two slope panels meeting at a ridge
    import mathutils
    slope_height = 1.0
    for sign in [-1, 1]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, sign*0.7, 2.30))
        slope = bpy.context.active_object
        slope.name = f'RoofSlope_{sign}'
        slope.scale = (3.4, 1.5, 0.12)
        slope.rotation_euler = (sign * 0.55, 0, 0)
        slope.data.materials.append(mat_thatch)
        # subsurf for smoother edge
        sm = slope.modifiers.new(name='Subsurf', type='SUBSURF')
        sm.levels = 1
        sm.render_levels = 1

    # Roof ridge cap
    add_box('RoofRidge', (0, 0, 2.92), (3.4, 0.20, 0.18), mat_thatch_dark, bevel=0.02)

    # Roof side gable triangles (closing the gable ends)
    for x_side in [-1.55, 1.55]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x_side, 0, 2.20))
        gable = bpy.context.active_object
        gable.name = f'Gable_{x_side}'
        gable.scale = (0.05, 2.10, 0.55)
        gable.data.materials.append(mat_wall)

    # Chimney
    chim = add_box('Chimney', (1.0, 0, 3.30), (0.30, 0.30, 0.70), mat_chimney, bevel=0.015)
    chim_cap = add_box('ChimneyCap', (1.0, 0, 3.70), (0.40, 0.40, 0.06), mat_beam)

    # Engawa (wooden veranda along front)
    engawa = add_box('Engawa', (0, -1.50, 0.40), (3.20, 0.80, 0.10),
                     make_pbr_material('EngawaWood', (0.50, 0.32, 0.18), roughness=0.85),
                     bevel=0.005)

    # Engawa support posts
    for ex in [-1.40, 0, 1.40]:
        add_box(f'EngawaPost_{ex}', (ex, -1.78, 0.20), (0.08, 0.08, 0.40), mat_beam)

    # --- Join everything for cleaner export ---
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = walls
    # Apply modifiers first to bake in subsurf/bevel
    for obj in list(bpy.context.selected_objects):
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            for mod in list(obj.modifiers):
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception as e:
                    print(f'  modifier apply failed: {mod.name}: {e}')

    # Select all again and join
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            obj.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in bpy.data.objects if o.type == 'MESH')
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = 'Kominka'

    # Set origin to floor center
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    # Export
    out_path = os.path.join(OUT_DIR, 'kominka.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    print('[OK] Exported', out_path, 'verts=', len(joined.data.vertices))


if __name__ == '__main__':
    build_kominka()
