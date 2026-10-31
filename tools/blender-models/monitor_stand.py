"""Clamp-on monitor stand. No cable: the top plate is what a monitor rests on.
Usage: blender -b --factory-startup --python monitor_stand.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'monitor-stand'
# Width, depth (front is -Y), height. The plate reaches the top of the box.
W, D, H = 0.18, 0.28, 0.45
reset()
body = mat('body', '#2a3036', rough=0.5)
jaw = mat('jaw', '#1b2026', rough=0.45)
plate = mat('plate', '#3a4149', rough=0.4)
x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2, -H / 2, H / 2

# Clamp sits on the back edge of the desk. Front of the arm is -Y.
box('clamp-base', -0.045, 0.045, y1 - 0.07, y1, z0, z0 + 0.018, jaw, bevel=0.002, segments=1)
box('clamp-jaw', -0.04, 0.04, y1 - 0.055, y1 - 0.012, z0 + 0.03, z0 + 0.055, jaw, bevel=0.001, segments=1)
box('pole', -0.014, 0.014, y1 - 0.05, y1 - 0.022, z0 + 0.012, z1 - 0.02, body, bevel=0.001, segments=1)
box('arm', -0.012, 0.012, y0 + 0.05, y1 - 0.03, z1 - 0.028, z1 - 0.012, body, bevel=0.001, segments=1)
box('plate', -0.09, 0.09, y0, y0 + 0.09, z1 - 0.01, z1, plate, bevel=0.002, segments=1)
finalize_and_export(mid, (W, D, H))
