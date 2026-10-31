"""Desktop mouse. Cable leaves the back, toward the keyboard (anchor y=-0.5).
Usage: blender -b --factory-startup --python mouse.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'mouse'
W, D, H = 0.062, 0.115, 0.038
reset()
body = mat('body', '#3a4149', rough=0.45)
buttons = mat('buttons', '#4b5560', rough=0.4)
wheel = mat('wheel', '#111827', rough=0.35)
cable = mat('cable', '#111827', rough=0.8)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

box('shell', x0 + 0.004, x1 - 0.004, y0 + 0.008, y1 - 0.006, z0, z1 - 0.004, body, bevel=0.004, segments=2)
box('left', x0 + 0.006, -0.001, y0 + 0.02, y1 - 0.03, z1 - 0.006, z1, buttons, bevel=0.001, segments=1)
box('right', 0.001, x1 - 0.006, y0 + 0.02, y1 - 0.03, z1 - 0.006, z1, buttons, bevel=0.001, segments=1)
cyl('wheel', 0.004, 0.012, (0, y0 + 0.03, z1 - 0.002), wheel, axis='X', verts=12)
cyl('cable', 0.0022, 0.01, (0, y1 - 0.003, z0 + 0.008), cable, axis='Y', verts=8)
finalize_and_export(mid, (W, D, H))
