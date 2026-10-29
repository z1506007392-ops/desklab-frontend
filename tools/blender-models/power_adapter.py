"""Power adapter brick. Usage: blender -b --python power_adapter.py
AC inlet on the FRONT (three.js +Z, catalog anchor y=+0.5), DC cable on the BACK (anchor y=-0.5)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'power-adapter'
W, D, H = 0.1, 0.05, 0.03   # catalog defaultScale x, y, z
reset()
body = mat('body', '#263238', rough=0.6)
label = mat('label', '#475569', rough=0.7)
inlet = mat('inlet', '#0f172a', rough=0.7)
cable = mat('cable', '#111827', rough=0.8)
led = mat('led', '#ffffff', rough=0.4, emit='#22c55e', emit_strength=3.0)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

by0, by1 = y0 + 0.004, y1 - 0.012
box('body', x0, x1, by0, by1, z0, z1, body, bevel=0.005, segments=3)
box('label', -0.032, 0.032, by0 + 0.008, by1 - 0.008, z1 - 0.0006, z1 + 0.0003, label)
# figure-8 (C7) AC inlet recess on the front face
box('inlet', -0.012, 0.012, y0, by0 + 0.001, -0.005, 0.005, inlet, bevel=0.003, segments=2)
# LED
cyl('led', 0.0015, 0.001, (0.03, by0 - 0.0002, 0.006), led, axis='Y', verts=8)
# DC strain relief + cable stub out the back
cyl('relief', 0.0045, 0.008, (0, by1 + 0.004, 0), cable, axis='Y', verts=12)
cyl('cable', 0.0022, 0.006, (0, y1 - 0.003, 0), cable, axis='Y', verts=10)
finalize_and_export(mid, (W, D, H))
