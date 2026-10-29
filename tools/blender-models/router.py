"""Wi-Fi router. Usage: blender -b --python router.py
LAN ports on the FRONT face (+Z in three.js) to match catalog port anchors (y=+0.5) and the generic layout."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import bpy

mid = 'router'
W, D, H = 0.35, 0.25, 0.08   # catalog defaultScale x, y, z
reset()
body = mat('body', '#4caf50', rough=0.5)
top_m = mat('top', '#388e3c', rough=0.8)
dark = mat('dark', '#102027', rough=0.7)
ant = mat('antenna', '#263238', rough=0.6)
led = mat('led', '#ffffff', rough=0.4, emit='#76ff03', emit_strength=3.0)
foot = mat('foot', '#111111', rough=0.9)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

fh = 0.003
bh = 0.032                         # body height
by1 = y1 - 0.013                   # body back; antenna hinges fill the rest
box('body', x0, x1, y0, by1, z0 + fh, z0 + fh + bh, body, bevel=0.008, segments=3)
box('topinset', x0 + 0.03, x1 - 0.03, y0 + 0.03, by1 - 0.04, z0 + fh + bh - 0.001, z0 + fh + bh + 0.0008, top_m)
# vent slots on the top inset
for i in range(7):
    vx = -0.09 + i * 0.03
    box(f'vent{i}', vx - 0.006, vx + 0.006, y0 + 0.06, by1 - 0.07, z0 + fh + bh, z0 + fh + bh + 0.0012, dark)
# front: 4 LAN ports + WAN, LEDs
pz = z0 + fh + bh * 0.42
for i in range(4):
    px = -0.09 + i * 0.045
    box(f'lan{i}', px - 0.008, px + 0.008, y0 - 0.0006, y0 + 0.004, pz - 0.006, pz + 0.006, dark)
for i in range(4):
    lx = x1 - 0.06 + i * 0.011
    cyl(f'led{i}', 0.0022, 0.002, (lx, y0 - 0.0004, z0 + fh + bh * 0.72), led, axis='Y', verts=8)
# four paddle antennas at the back, slightly splayed
for k, ax in enumerate((-0.13, -0.045, 0.045, 0.13)):
    a = box(f'ant{k}', -0.008, 0.008, -0.003, 0.003, 0, H - fh - 0.012, ant, bevel=0.0025, segments=2)
    bpy.context.view_layer.objects.active = a
    for m in list(a.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    a.rotation_euler = (0, math.radians(-14 if ax < 0 else 14) * (1 if abs(ax) > 0.1 else 0.4), 0)
    a.location = (ax, by1 + 0.006, z0 + fh + 0.012)
    bpy.ops.object.select_all(action='DESELECT'); a.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    cyl(f'hinge{k}', 0.007, 0.018, (ax, by1 + 0.006, z0 + fh + 0.014), ant, axis='X', verts=10)
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot{sx}{sy}', 0.008, fh, (sx * (W/2 - 0.03), sy * 0.07 - 0.015, z0 + fh/2), foot, verts=10)
finalize_and_export(mid, (W, D, H))
