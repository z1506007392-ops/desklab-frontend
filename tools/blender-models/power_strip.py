"""6-way power strip (插排). Usage: blender -b --python power_strip.py
Sockets on top (catalog anchors z=+0.5); input cable stub at -X end."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'power-strip'
W, D, H = 0.8, 0.08, 0.05   # catalog defaultScale x, y, z
reset()
body = mat('body', '#f44336', rough=0.55)
plate = mat('plate', '#f8fafc', rough=0.45)
hole = mat('hole', '#202124', rough=0.7)
cable = mat('cable', '#1f2937', rough=0.8)
sw = mat('switch', '#ff5252', rough=0.3, emit='#ff1744', emit_strength=1.5)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

cx0 = x0 + 0.05                    # body starts after the cable stub
box('body', cx0, x1, y0, y1, z0, z1 - 0.002, body, bevel=0.01, segments=3)
box('plate', cx0 + 0.035, x1 - 0.01, y0 + 0.008, y1 - 0.008, z1 - 0.004, z1, plate, bevel=0.002, segments=1)
# 6 combo sockets: a 2-pin pair (slots) above a 3-pin triangle
n = 6
sx0, sx1 = cx0 + 0.11, x1 - 0.05
for i in range(n):
    sx = sx0 + i * (sx1 - sx0) / (n - 1)
    zt = z1 - 0.0005
    box(f's{i}a', sx - 0.024, sx - 0.020, -0.004, 0.006, zt, z1 + 0.0002, hole)   # 2-pin (left)
    box(f's{i}b', sx - 0.013, sx - 0.009, -0.004, 0.006, zt, z1 + 0.0002, hole)
    box(f's{i}c', sx + 0.016, sx + 0.020, 0.004, 0.012, zt, z1 + 0.0002, hole)   # 3-pin: earth (back)
    box(f's{i}d', sx + 0.006, sx + 0.014, -0.013, -0.009, zt, z1 + 0.0002, hole)  # 3-pin: L
    box(f's{i}e', sx + 0.022, sx + 0.030, -0.013, -0.009, zt, z1 + 0.0002, hole)  # 3-pin: N
# rocker switch with red light near the input end
box('switch', cx0 + 0.012, cx0 + 0.03, y0 + 0.018, y1 - 0.018, z1 - 0.004, z1, sw, bevel=0.002, segments=1)
# input cable strain relief + stub
cyl('relief', 0.009, 0.03, (cx0 - 0.012, 0, z0 + H * 0.4), cable, axis='X', verts=12)
cyl('cable', 0.004, 0.03, (x0 + 0.015, 0, z0 + H * 0.4), cable, axis='X', verts=10)
finalize_and_export(mid, (W, D, H))
