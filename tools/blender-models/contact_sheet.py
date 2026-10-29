"""python3 contact_sheet.py [--cols N] id1 id2 ... -> preview_all.png (labelled grid, uses Pillow)"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d = os.environ.get("DESKLAB_OUT", "/workspace/desklab-models")
args = sys.argv[1:]
cols = 5
if args[:1] == ['--cols']:
    cols = int(args[1]); args = args[2:]
ids = args
w, h, lab = 480, 360, 34
rows = (len(ids) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, (h + lab) * rows), (236, 236, 238))
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("DejaVuSans.ttf", 20)
except Exception: font = ImageFont.load_default()
for k, i in enumerate(ids):
    im = Image.open(f"{d}/preview_{i}.png").convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (k % cols) * w, (k // cols) * (h + lab)
    sheet.paste(im, (x, y))
    dr.text((x + 12, y + h + 6), i, fill=(40, 40, 40), font=font)
sheet.save(f"{d}/preview_all.png"); print("saved", f"{d}/preview_all.png", sheet.size)
