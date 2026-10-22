# Tile PNGs into one contact sheet (Blender -b --python montage.py -- out.png cols cell_h a.png b.png ...)
import bpy, sys
import numpy as np
a = sys.argv[sys.argv.index("--") + 1:]
out, cols, ch = a[0], int(a[1]), int(a[2])
imgs = []
for p in a[3:]:
    im = bpy.data.images.load(p)
    w, h = im.size
    nw = int(w * ch / h)
    im.scale(nw, ch)
    px = np.array(im.pixels[:]).reshape(ch, nw, 4)
    imgs.append(px)
rows = (len(imgs) + cols - 1) // cols
cw = max(i.shape[1] for i in imgs)
sheet = np.ones((rows * ch, cols * cw, 4))
for i, px in enumerate(imgs):
    r, c = divmod(i, cols)
    y0 = (rows - 1 - r) * ch
    sheet[y0:y0 + ch, c * cw:c * cw + px.shape[1]] = px
o = bpy.data.images.new("sheet", cols * cw, rows * ch)
o.pixels[:] = sheet.ravel()
o.filepath_raw = out; o.file_format = 'PNG'; o.save()
print("SHEET", out)
