"""Flat-panel monitor. Usage: blender -b --python monitor.py -- monitor-24
Works for monitor-24 / monitor-27 / ultrawide-monitor (dims from catalog.js)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CATALOG = {  # defaultScale {x: width, y: depth, z: height} in metres, body colour
    'monitor-24':        ((0.54, 0.05, 0.32), '#212121'),
    'monitor-27':        ((0.62, 0.06, 0.37), '#111111'),
    'ultrawide-monitor': ((0.82, 0.24, 0.46), '#000000'),
}
mid = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'monitor-24'
(W, D, H), body_hex = CATALOG[mid]
reset()
# keep pure-black catalog colours from reading as a void
body = mat('body', body_hex if body_hex not in ('#000000', '#111111') else '#1a1a1a', rough=0.55)
screen = mat('screen', '#18222f', rough=0.12, metal=0.35)
stand_m = mat('stand', '#3b4652', rough=0.45, metal=0.5)
led = mat('led', '#ffffff', rough=0.4, emit='#4fc3f7', emit_strength=2.0)

x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2
bev = min(W, H) * 0.012
# panel occupies the top ~72% of the height, front at -Y, ~45% of depth
pz0 = z0 + H * 0.20
pd = D * 0.42
box('panel', x0, x1, y0 + 0.0015, y0 + 0.0015 + pd, pz0, z1, body, bevel=bev, segments=2)
# glossy screen inset into the front face (bezel ~ 2.5% of width / top & sides, thicker chin)
bz = W * 0.012
box('screen', x0 + bz, x1 - bz, y0, y0 + 0.003, pz0 + H * 0.045, z1 - bz, screen)
# rear housing bump
box('rear', -W * 0.26, W * 0.26, y0 + pd, y0 + pd + D * 0.18, pz0 + H * 0.12, z1 - H * 0.12, body, bevel=bev * 0.8)
# stand neck (behind panel centre, runs from base up into the rear housing)
nd = D * 0.22
ny0 = y0 + pd + D * 0.05
box('neck', -W * 0.045, W * 0.045, ny0, ny0 + nd, z0 + H * 0.03, pz0 + H * 0.3, stand_m, bevel=0.004)
# flat oval-ish base plate filling the footprint depth
cyl('base', 0.5, H * 0.03, (0, 0, z0 + H * 0.015), stand_m, verts=32, bevel=0.002,
    scale=(W * 0.40, D, 1))
# small power LED on the chin
box('led', x1 - W * 0.06, x1 - W * 0.05, y0 + 0.0005, y0 + 0.002, pz0 + H * 0.012, pz0 + H * 0.02, led)

if mid == 'ultrawide-monitor':
    # gentle curve: slice the panel parts along X, then push the middle back (edges stay at the front)
    import bpy, bmesh
    sag = D * 0.28
    for name in ('panel', 'screen', 'rear', 'led'):
        o = bpy.data.objects[name]
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        bm = bmesh.new(); bm.from_mesh(o.data)
        for i in range(1, 16):
            x = x0 + W * i / 16
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
        for v in bm.verts:
            t = v.co.x / (W / 2)
            v.co.y += sag * (1 - t * t)
        bm.to_mesh(o.data); bm.free()
finalize_and_export(mid, (W, D, H))
