"""Home game console. HDMI, ethernet, and the power lead leave the back.
Usage: blender -b --factory-startup --python game_console.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

mid = 'game-console'
W, D, H = 0.30, 0.24, 0.08
reset()
body = mat('body', '#1c2127', rough=0.45)
lid = mat('lid', '#2c333a', rough=0.4)
slot = mat('slot', '#111418', rough=0.6)
port = mat('port', '#0e1114', rough=0.5)
led = mat('led', '#1a3a2a', rough=0.3, emit='#3dd68c', emit_strength=0.4)
x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, -D / 2, D / 2, -H / 2, H / 2

box('shell', x0, x1, y0, y1, z0, z1 - 0.004, body, bevel=0.004, segments=2)
box('top', x0 + 0.012, x1 - 0.012, y0 + 0.02, y1 - 0.03, z1 - 0.006, z1, lid, bevel=0.002, segments=1)
# Disc slot on the front (-Y).
box('slot', -0.06, 0.06, y0, y0 + 0.004, -0.004, 0.004, slot)
box('led', x1 - 0.03, x1 - 0.018, y0 + 0.01, y0 + 0.018, z1 - 0.008, z1, led)
# Connectors on the back (+Y): HDMI, ethernet, power.
box('hdmi', -0.05, -0.02, y1 - 0.006, y1, -0.004, 0.008, port)
box('lan', -0.008, 0.016, y1 - 0.006, y1, -0.004, 0.008, port)
box('power', 0.04, 0.07, y1 - 0.006, y1, -0.016, -0.004, port)
finalize_and_export(mid, (W, D, H))
