"""Mid-tower desktop PC. Usage: blender -b --python desktop_pc.py -- desktop-pc"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'desktop-pc'
W, D, H = 0.25, 0.50, 0.50   # catalog defaultScale x, y, z
reset()
case = mat('case', '#424242', rough=0.5, metal=0.3)
front = mat('front', '#20252b', rough=0.7)
dark = mat('dark', '#0f172a', rough=0.6)
glass = mat('glass', '#1c2a3a', rough=0.08, metal=0.2)
fan = mat('fan', '#111827', rough=0.8)
glow = mat('glow', '#60a5fa', rough=0.4, emit='#60a5fa', emit_strength=3.0)
foot = mat('foot', '#111111', rough=0.9)
x0, x1, y0, y1, z0, z1 = -W/2, W/2, -D/2, D/2, -H/2, H/2

fh = 0.012                       # feet height
box('body', x0, x1, y0 + 0.008, y1, z0 + fh, z1, case, bevel=0.008, segments=2)
# front bezel (slightly proud, darker)
box('bezel', x0 + 0.006, x1 - 0.006, y0, y0 + 0.012, z0 + fh + 0.008, z1 - 0.008, front, bevel=0.004)
# intake fan ring + hub on front
fz = z0 + fh + (H - fh) * 0.62
cyl('fan_ring', W * 0.30, 0.004, (0, y0 - 0.0005, fz), glow, axis='Y', verts=28)
cyl('fan', W * 0.27, 0.005, (0, y0 - 0.001, fz), fan, axis='Y', verts=28)
cyl('hub', W * 0.07, 0.006, (0, y0 - 0.0015, fz), dark, axis='Y', verts=16)
# top I/O strip: power button, LED, two USB ports
iz = z1 - 0.04
cyl('power', 0.009, 0.004, (-W * 0.25, y0 - 0.001, iz), dark, axis='Y', verts=16)
cyl('pled', 0.0025, 0.004, (-W * 0.25, y0 - 0.0015, iz), glow, axis='Y', verts=8)
for i in range(2):
    ux = W * 0.06 + i * 0.022
    box(f'usb{i}', ux, ux + 0.014, y0 - 0.001, y0 + 0.002, iz - 0.003, iz + 0.003, dark)
# tinted glass side panel on the -X side (visible from front-left 3/4 view)
box('glass', x0 - 0.0005, x0 + 0.002, y0 + 0.05, y1 - 0.03, z0 + fh + 0.03, z1 - 0.03, glass)
# top exhaust vent slots
for i in range(6):
    vy = y0 + 0.14 + i * 0.045
    box(f'vent{i}', -W * 0.3, W * 0.3, vy, vy + 0.02, z1 - 0.0015, z1 + 0.0005, dark)
# feet
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot{sx}{sy}', 0.014, fh, (sx * (W/2 - 0.03), sy * (D/2 - 0.05), z0 + fh/2), foot, verts=12)
finalize_and_export(mid, (W, D, H))
