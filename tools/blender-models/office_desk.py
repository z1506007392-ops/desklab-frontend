"""Office desk. Usage: blender -b --python office_desk.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'office-desk'
W, D, H = 1.4, 0.7, 0.75   # catalog defaultScale x, y, z
reset()
# catalog colour #1e88e5 is a UI swatch; a real desk reads better as light oak + steel frame
top_m = mat('top', '#c9a77c', rough=0.65)
edge_m = mat('edge', '#a9865d', rough=0.6)
frame = mat('frame', '#3d4651', rough=0.45, metal=0.6)
tray = mat('tray', '#2a313a', rough=0.7)
foot = mat('foot', '#111111', rough=0.9)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

tt = 0.028
box('top', x0, x1, y0, y1, z1 - tt, z1, top_m, bevel=0.006, segments=2)
box('edgeband', x0 + 0.004, x1 - 0.004, y0 + 0.004, y1 - 0.004, z1 - tt - 0.004, z1 - tt + 0.001, edge_m)
# steel frame: two side "T" legs (upright + foot bar + top bar) joined by a back crossbar
lw = 0.06          # leg section
for sx in (-1, 1):
    cx = sx * (W/2 - 0.09)
    box(f'leg{sx}', cx - lw/2, cx + lw/2, -0.025, 0.025, z0 + 0.03, z1 - tt - 0.03, frame, bevel=0.004)
    box(f'footbar{sx}', cx - lw/2, cx + lw/2, y0 + 0.03, y1 - 0.03, z0 + 0.008, z0 + 0.04, frame, bevel=0.004)
    box(f'topbar{sx}', cx - lw/2, cx + lw/2, y0 + 0.06, y1 - 0.06, z1 - tt - 0.035, z1 - tt, frame, bevel=0.003)
    for sy in (-1, 1):
        cyl(f'glide{sx}{sy}', 0.018, 0.008, (cx, sy * (D/2 - 0.045), z0 + 0.004), foot, verts=12)
box('crossbar', x0 + 0.09, x1 - 0.09, y1 - 0.12, y1 - 0.08, z1 - tt - 0.06, z1 - tt - 0.02, frame, bevel=0.003)
# cable tray under the back edge
tz0 = z1 - tt - 0.13
box('tray_bottom', -0.42, 0.42, y1 - 0.2, y1 - 0.07, tz0, tz0 + 0.006, tray)
box('tray_front', -0.42, 0.42, y1 - 0.2, y1 - 0.194, tz0, tz0 + 0.07, tray)
box('tray_back', -0.42, 0.42, y1 - 0.076, y1 - 0.07, tz0, z1 - tt, tray)
finalize_and_export(mid, (W, D, H))
