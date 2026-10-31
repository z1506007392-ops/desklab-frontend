"""Desk lamp. AC cord leaves the back of the base (anchor y=-0.5, low).
Usage: blender -b --factory-startup --python desk_lamp.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'desk-lamp'
W, D, H = 0.16, 0.16, 0.42
reset()
base_m = mat('base', '#2c3338', rough=0.45, metal=0.2)
stem_m = mat('stem', '#c4b8a5', rough=0.4, metal=0.35)
shade_m = mat('shade', '#f4f1ea', rough=0.7)
glow = mat('glow', '#fff4d6', rough=0.5, emit='#ffd27a', emit_strength=2.5)
cord = mat('cord', '#111827', rough=0.8)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

box('base', -0.06, 0.06, -0.06, 0.06, z0, z0 + 0.018, base_m, bevel=0.003, segments=2)
cyl('stem', 0.008, 0.28, (0, 0, z0 + 0.158), stem_m, axis='Z', verts=12)
# Shade hangs toward the front (Blender -Y) so the light faces the desk.
box('shade', -0.07, 0.07, -0.07, 0.02, z1 - 0.07, z1, shade_m, bevel=0.004, segments=1)
box('bulb', -0.04, 0.04, -0.05, 0.0, z1 - 0.055, z1 - 0.02, glow)
cyl('cord', 0.003, 0.02, (0, y1 - 0.01, z0 + 0.01), cord, axis='Y', verts=8)
finalize_and_export(mid, (W, D, H))
