"""Shared helpers for DeskLab low-poly models (Blender 4.2, run headless).

Convention (matches desklab-frontend FallbackBox / Generic*Model):
  * units = metres
  * origin = CENTRE of the bounding box (boxGeometry is centred on the group origin)
  * Blender axes while modelling: X = catalog x (width), Y = catalog y (depth),
    Z = catalog z (height, up). Device FRONT faces Blender -Y.
  * glTF export with +Y up => three.js X = width, Y = height, Z = depth, front faces +Z
    (same as the generic models, whose screens / front panels sit at +z).
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

OUT_DIR = os.environ.get("DESKLAB_OUT", "/workspace/desklab-models")

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for d in list(c):
            c.remove(d)

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexcol(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1.0,)

_mats = {}
def mat(name, color, rough=0.6, metal=0.0, emit=None, emit_strength=1.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexcol(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = hexcol(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    m.diffuse_color = b.inputs["Base Color"].default_value  # viewport/workbench colour
    _mats[name] = m
    return m

def _finish(obj, material, bevel, segments):
    obj.data.materials.append(material)
    if bevel and bevel > 0:
        mod = obj.modifiers.new("bevel", 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
        mod.harden_normals = False
    return obj

def box(name, x0, x1, y0, y1, z0, z1, material, bevel=0.0, segments=2):
    """Axis-aligned box given by its min/max extents (metres)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)  # mesh in world coords, origin at 0
    return _finish(o, material, bevel, segments)

def cyl(name, radius, depth, location, material, axis='Z', verts=16, bevel=0.0, segments=1, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.location = location
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return _finish(o, material, bevel, segments)

def finalize_and_export(model_id, dims, smooth_angle=35):
    """Apply modifiers, join, fit EXACTLY to catalog dims (x,y,z), centre at origin, export GLB."""
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = model_id
    o.data.name = model_id
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # merge duplicate verts from bevel seams, recalc normals
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    # exact fit to catalog dims, bbox centre at origin
    vs = [v.co for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    size = mx - mn; ctr = (mx + mn) / 2
    s = Vector((dims[0] / size.x, dims[1] / size.y, dims[2] / size.z))
    print(f"[{model_id}] raw bbox {tuple(round(c,4) for c in size)} -> fit factors {tuple(round(c,4) for c in s)}")
    for v in o.data.vertices:
        d = v.co - ctr
        v.co = Vector((d.x * s.x, d.y * s.y, d.z * s.z))
    o.data.update()
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    o.data.calc_loop_triangles()
    tris = len(o.data.loop_triangles)
    print(f"[{model_id}] triangles: {tris}")
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{model_id}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True,
                              export_apply=True, use_selection=False,
                              export_materials='EXPORT', export_texcoords=False)
    print(f"[{model_id}] exported {path}")
    return path, tris
