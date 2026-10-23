import sys, os
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/npc_real")
import bpy
import render_util as RU
from lib_real import *
from body2 import *
sc = RU.setup_scene((1200, 800), floor=False)
o = dict(skin=(0.64, 0.42, 0.27))
parts = hands_parts(o) + tankard_parts()
verts, faces, fmat, cols, wts, mats = merge(parts)
me = bpy.data.meshes.new("h"); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
ob = bpy.data.objects.new("h", me); sc.collection.objects.link(ob)
for key in mats: me.materials.append(make_material(key, key))
for j, p in enumerate(me.polygons): p.material_index = fmat[j]; p.use_smooth = True
ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'POINT')
for j, c in enumerate(cols): ca.data[j].color = (*c, 1)
RU.cam(sc, (-0.55, -0.45, 1.0), (-0.21, 0, 0.86), 70)
RU.render("/Users/sang/.claude/jobs/02a78233/tmp/npc_real/test_prev/hand_out.png")
RU.cam(sc, (0.15, -0.35, 0.80), (-0.24, 0, 0.85), 70)
RU.render("/Users/sang/.claude/jobs/02a78233/tmp/npc_real/test_prev/hand.png")
