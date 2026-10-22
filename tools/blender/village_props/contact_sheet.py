# Tile preview PNGs into one contact sheet (no PIL needed).
#   Blender -b --factory-startup --python contact_sheet.py -- OUT.png COLS SCALE a.png b.png ...
import bpy, sys
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
import os
out, cols, step = os.path.abspath(argv[0]), int(argv[1]), int(argv[2])
tiles = []
for p in argv[3:]:
    im = bpy.data.images.load(os.path.abspath(p))
    w, h = im.size
    a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::step, ::step]
    tiles.append(a)
th = max(t.shape[0] for t in tiles); tw = max(t.shape[1] for t in tiles)
rows = (len(tiles) + cols - 1) // cols
sheet = np.ones((rows * th, cols * tw, 4), np.float32)
for i, t in enumerate(tiles):
    r, c = divmod(i, cols); r = rows - 1 - r          # Blender pixels are bottom-up
    sheet[r * th:r * th + t.shape[0], c * tw:c * tw + t.shape[1]] = t
img = bpy.data.images.new('sheet', cols * tw, rows * th, alpha=True)
img.pixels.foreach_set(sheet.ravel())
img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('SHEET', out, img.size[:])
