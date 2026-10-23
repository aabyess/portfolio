import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import render_util as RU
from lib_real import *
from body_real import *
import build_real as BR
OUT = "/Users/sang/.claude/jobs/02a78233/tmp/npc_real/test_prev"
sc = RU.setup_scene((1800, 640), floor=False)

def spec(o):
    return o
specs = [
    dict(skin=(0.70, 0.48, 0.34), fem=True, jaw=0.92, iris=(0.14, 0.22, 0.12), brow_col=(0.34, 0.14, 0.05), blush=0.35,
         hair_sdf=BR.hair_cap(0.002, front_z=1.640, front_y=-0.090), hair_col=(0.40, 0.14, 0.04)),
    dict(skin=(0.76, 0.56, 0.44), fem=True, belly=-0.05, jaw=0.90, iris=(0.12, 0.20, 0.30), brow_col=(0.45, 0.32, 0.14),
         hair_sdf=BR.hair_cap(0.002, front_z=1.640, front_y=-0.092, nape=None), hair_col=(0.55, 0.38, 0.15)),
    dict(skin=(0.68, 0.46, 0.32), iris=(0.10, 0.16, 0.10), brow_col=(0.42, 0.28, 0.11), hair_sdf=BR.hair_cap(0.0, front_z=1.655), hair_col=(0.48, 0.30, 0.10)),
    dict(skin=(0.66, 0.40, 0.27), age=1.0, cheek=1.15, iris=(0.10, 0.07, 0.04), brow_col=(0.30, 0.25, 0.20), brow_thick=1.5),
]
for i, o in enumerate(specs):
    parts = head_parts(o)
    verts, faces, fmat, cols, wts, mats = merge(parts)
    me = bpy.data.meshes.new("h"); me.from_pydata([tuple(v + Vector(((i - 1.5) * 0.24, 0, 0))) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new("h", me); sc.collection.objects.link(ob)
    for key in mats: me.materials.append(make_material(key, key))
    for j, p in enumerate(me.polygons): p.material_index = fmat[j]; p.use_smooth = True
    ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'POINT')
    for j, c in enumerate(cols): ca.data[j].color = (*c, 1)
RU.cam(sc, (0.0, -1.35, 1.69), (0, 0, 1.665), 60)
RU.render(os.path.join(OUT, "h3_front.png"))
RU.cam(sc, (0.75, -1.15, 1.70), (0.05, 0, 1.665), 60)
RU.render(os.path.join(OUT, "h3_34.png"))
