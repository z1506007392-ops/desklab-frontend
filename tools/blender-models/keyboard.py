"""Full-size keyboard. Cable leaves the back (catalog anchor y=-0.5).
Usage: blender -b --factory-startup --python keyboard.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'keyboard'
W, D, H = 0.44, 0.15, 0.032
reset()
body = mat('body', '#2c333a', rough=0.55)
deck = mat('deck', '#1b2026', rough=0.7)
keys = mat('keys', '#d5d8de', rough=0.45)
space = mat('space', '#eceff3', rough=0.4)
cable = mat('cable', '#111827', rough=0.8)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

box('base', x0, x1, y0, y1, z0, z0 + 0.012, body, bevel=0.002, segments=1)
box('deck', x0 + 0.008, x1 - 0.008, y0 + 0.01, y1 - 0.012, z0 + 0.011, z0 + 0.016, deck)
# Key rows. Front is Blender -Y.
for i, (y_a, y_b) in enumerate((
    (y0 + 0.016, y0 + 0.038),
    (y0 + 0.042, y0 + 0.066),
    (y0 + 0.070, y0 + 0.094),
    (y0 + 0.098, y0 + 0.122),
)):
    box(f'row{i}', x0 + 0.014, x1 - 0.014, y_a, y_b, z0 + 0.015, z1 - 0.001, keys, bevel=0.001, segments=1)
box('space', -0.09, 0.09, y0 + 0.018, y0 + 0.036, z0 + 0.016, z1, space, bevel=0.001, segments=1)
cyl('cable', 0.003, 0.012, (0, y1 - 0.004, z0 + 0.008), cable, axis='Y', verts=10)
finalize_and_export(mid, (W, D, H))
