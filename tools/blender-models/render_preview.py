"""Render a 3/4 preview of an exported GLB.
Usage: blender -b --python render_preview.py -- /path/model.glb /path/out.png [engine]
engine: CYCLES (default, CPU, always works headless) | BLENDER_EEVEE_NEXT | BLENDER_WORKBENCH"""
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
glb, out = argv[0], argv[1]
engine = argv[2] if len(argv) > 2 else 'CYCLES'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector([min(p[i] for p in pts) for i in range(3)])
mx = Vector([max(p[i] for p in pts) for i in range(3)])
ctr, size = (mn + mx) / 2, mx - mn
radius = size.length / 2
sc = bpy.context.scene
# ground plane (shadow catcher-ish, light neutral)
bpy.ops.mesh.primitive_plane_add(size=radius * 30, location=(ctr.x, ctr.y, mn.z))
g = bpy.context.active_object
gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.56, 0.58, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
g.data.materials.append(gm)
# world: neutral light grey
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.8, 0.8, 0.82, 1); bg.inputs['Strength'].default_value = 0.6
# lights: key + fill
def sun(rot, energy):
    l = bpy.data.lights.new('sun', 'SUN'); l.energy = energy; l.angle = math.radians(8)
    o = bpy.data.objects.new('sun', l); o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o)
sun((50, 0, -35), 3.0)
sun((70, 0, 140), 1.0)
# camera: front-left, above (device front = -Y in Blender)
cam = bpy.data.cameras.new('cam'); cam.lens = 50
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
d = Vector((-0.75, -1.0, 0.65)).normalized()
fov = 2 * math.atan(36 / 2 / cam.lens) * 0.75  # vertical-ish fov for 4:3
dist = radius / math.sin(fov / 2) * 1.0
co.location = ctr + d * dist
co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 800, 600
sc.render.engine = engine
if engine == 'CYCLES':
    sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'AgX'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
