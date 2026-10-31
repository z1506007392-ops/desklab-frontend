"""A small powered pair. Audio and AC sit on the back of the right cabinet.
Usage: blender -b --factory-startup --python speakers.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'speakers'
W, D, H = 0.32, 0.12, 0.18
reset()
cab = mat('cab', '#1f2428', rough=0.55)
driver = mat('driver', '#3d4450', rough=0.4)
cone = mat('cone', '#111827', rough=0.5)
port = mat('port', '#0f172a', rough=0.6)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

def cabinet(name, cx):
    box(f'{name}-body', cx - 0.055, cx + 0.055, y0 + 0.008, y1 - 0.008, z0, z1, cab, bevel=0.003, segments=1)
    cyl(f'{name}-woofer', 0.028, 0.006, (cx, y0 + 0.006, -0.01), driver, axis='Y', verts=16)
    cyl(f'{name}-cone', 0.016, 0.004, (cx, y0 + 0.004, -0.01), cone, axis='Y', verts=12)
    cyl(f'{name}-tweet', 0.01, 0.004, (cx, y0 + 0.005, 0.045), driver, axis='Y', verts=12)

cabinet('left', -0.09)
cabinet('right', 0.09)
# Jacks on the back face of the right cabinet (Blender +Y).
box('audio', 0.07, 0.085, y1 - 0.01, y1, 0.01, 0.028, port)
box('power', 0.095, 0.11, y1 - 0.01, y1, -0.03, -0.01, port)
finalize_and_export(mid, (W, D, H))
