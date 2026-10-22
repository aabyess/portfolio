import bpy, sys, os
out = "/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/tex"
for im in bpy.data.images:
    if im.size[0] > 0 and ('_base' in im.name or '_nrm' in im.name or '_orm' in im.name or 'hair' in im.name.lower()):
        im2 = im.copy()
        im2.filepath_raw = os.path.join(out, im.name + ".png")
        im2.file_format = 'PNG'
        im2.save()
        print("SAVED", im.name)
