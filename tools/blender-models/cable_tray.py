"""Under-desk cable tray. No ports, no brand marks.

A channel open upward. The long axis is catalog width (X). The seat side is
Blender -Y. Usage: blender -b --factory-startup --python cable_tray.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'cable-tray'
# Width, depth (front is -Y), height. Catalog defaultScale.
W, D, H = 0.70, 0.16, 0.08
reset()
body = mat('body', '#5c656d', rough=0.42, metal=0.55)
inner = mat('inner', '#3a424b', rough=0.55, metal=0.15)
x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2, -H / 2, H / 2

# Floor of the channel, ends left open so a cable can leave either side.
box('floor', x0, x1, y0 + 0.008, y1 - 0.008, z0, z0 + 0.012, inner, bevel=0.001, segments=1)
# Low lip toward the seat.
box('lip-front', x0, x1, y0, y0 + 0.012, z0, z0 + 0.042, body, bevel=0.001, segments=1)
# Taller lip at the back, under the desktop's rear edge.
box('lip-back', x0, x1, y1 - 0.014, y1, z0, z1, body, bevel=0.001, segments=1)
finalize_and_export(mid, (W, D, H))
