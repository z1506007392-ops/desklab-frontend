"""Wall outlet (CN 5-hole: 2-pin above 3-pin). Usage: blender -b --python wall_outlet.py
Face points to three.js +Z (Blender -Y)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'wall-outlet'
W, D, H = 0.08, 0.02, 0.08   # catalog defaultScale x, y (depth), z
reset()
# catalog colour #ffeb3b is a UI swatch; use it for the back box, keep the face plate white
backbox = mat('backbox', '#ffeb3b', rough=0.6)
plate = mat('plate', '#f5f5f4', rough=0.4)
insert = mat('insert', '#e7e5e4', rough=0.5)
hole = mat('hole', '#1f2937', rough=0.7)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

box('backbox', x0 + 0.006, x1 - 0.006, y0 + 0.008, y1, z0 + 0.006, z1 - 0.006, backbox, bevel=0.002, segments=1)
box('plate', x0, x1, y0 + 0.001, y0 + 0.009, z0, z1, plate, bevel=0.003, segments=3)
box('insert', x0 + 0.012, x1 - 0.012, y0 + 0.0002, y0 + 0.002, z0 + 0.012, z1 - 0.012, insert, bevel=0.002, segments=2)
f0, f1 = y0, y0 + 0.0006
# upper 2-pin (two vertical slots)
for sx in (-0.0065, 0.0065):
    box('pin2', sx - 0.0012, sx + 0.0012, f0, f1, 0.011, 0.019, hole)
# lower 3-pin: earth vertical at top, L/N angled-ish slots below
box('earth', -0.0012, 0.0012, f0, f1, -0.006, 0.002, hole)
box('live', -0.012, -0.005, f0, f1, -0.017, -0.0145, hole)
box('neutral', 0.005, 0.012, f0, f1, -0.017, -0.0145, hole)
finalize_and_export(mid, (W, D, H))
