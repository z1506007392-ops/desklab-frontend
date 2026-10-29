"""Open 15" laptop. Usage: blender -b --python laptop.py -- laptop-15"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import bpy

mid = 'laptop-15'
W, D, H = 0.36, 0.28, 0.22   # catalog defaultScale x, y, z
reset()
shell = mat('shell', '#607d8b', rough=0.4, metal=0.6)
deck = mat('deck', '#1f2937', rough=0.7)
keys_m = mat('keys', '#111827', rough=0.6)
pad = mat('touchpad', '#78909c', rough=0.3, metal=0.4)
screen = mat('screen', '#0b1220', rough=0.15, metal=0.1)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

bt = 0.018                    # base thickness
by1 = y1 - 0.03               # hinge line (back of base)
box('base', x0, x1, y0, by1, z0, z0 + bt, shell, bevel=0.004, segments=2)
# keyboard well + keys
kx0, kx1 = x0 + 0.03, x1 - 0.03
ky0, ky1 = y0 + 0.115, by1 - 0.02
box('kbwell', kx0, kx1, ky0, ky1, z0 + bt - 0.0005, z0 + bt + 0.0003, deck)
cols, rows = 14, 5
gap = 0.0025
kw = (kx1 - kx0 - gap * (cols + 1)) / cols
kh = (ky1 - ky0 - gap * (rows + 1)) / rows
for r in range(rows):
    for c in range(cols):
        if r == 0 and 4 <= c <= 9:      # spacebar row: merge middle keys
            if c == 4:
                box('space', kx0 + gap + 4 * (kw + gap), kx0 + gap + 9 * (kw + gap) + kw,
                    ky0 + gap, ky0 + gap + kh, z0 + bt, z0 + bt + 0.0015, keys_m)
            continue
        ax = kx0 + gap + c * (kw + gap); ay = ky0 + gap + r * (kh + gap)
        box(f'k{r}_{c}', ax, ax + kw, ay, ay + kh, z0 + bt, z0 + bt + 0.0015, keys_m)
# touchpad
box('pad', -0.055, 0.055, y0 + 0.02, y0 + 0.095, z0 + bt - 0.0004, z0 + bt + 0.0004, pad)
# hinge barrel
cyl('hinge', 0.006, W * 0.7, (0, by1 + 0.002, z0 + bt), deck, axis='X', verts=12)

# lid: built upright with pivot at hinge, tilted back
lt = 0.008
L = (H - bt) / math.cos(math.radians(8)) + 0.002
tilt = math.radians(8)
lid = box('lid', x0 + 0.002, x1 - 0.002, 0, lt, 0, L, shell, bevel=0.003, segments=2)
scr = box('lidscreen', x0 + 0.014, x1 - 0.014, -0.0008, 0.0002, 0.012, L - 0.012, screen)
bez = box('lidbezel', x0 + 0.006, x1 - 0.006, -0.0004, 0.0004, 0.004, L - 0.004, deck)
for o in (lid, scr, bez):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.rotation_euler = (-tilt, 0, 0)          # lean back toward +Y
    o.location = (0, by1 - 0.002, z0 + bt)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
finalize_and_export(mid, (W, D, H))
