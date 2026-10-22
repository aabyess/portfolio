p = '/Users/sang/.claude/jobs/02a78233/tmp/weapons/wcommon.py'
s = open(p).read()
s = s.replace("""    im = bpy.data.images.new(name, w, h, alpha=False)
    rgba""", """    im = bpy.data.images.new(name, w, h, alpha=False, is_data=noncolor)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    rgba""")
s = s.replace("""    im.pixels.foreach_set(rgba.ravel())
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    im.pack()""", """    im.pixels.foreach_set(rgba.ravel())
    im.update()
    im.pack()""")
open(p, 'w').write(s)
