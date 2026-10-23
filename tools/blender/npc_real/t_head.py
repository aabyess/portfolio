import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import render_util as RU
from lib_real import *
from body_real import *
OUT = "/Users/sang/.claude/jobs/02a78233/tmp/npc_real/previews"
sc = RU.setup_scene((1200, 600), floor=False)

hair_m = SDF()
hair_m.add('ell', (0, 0.020, 1.710), (0.0875, 0.106, 0.104), k=0)
hair_m.sub('ell', (0, -0.084, 1.650), (0.082, 0.075, 0.090), k=0.004)
hair_m.sub('ell', (0.082, 0.012, 1.655), (0.024, 0.030, 0.036), k=0.004, mirror=True)
hair_m.sub('ell', (0, 0.06, 1.55), (0.1, 0.1, 0.075), k=0.01)
beard = SDF()
beard.add('ell', (0, -0.036, 1.598), (0.064, 0.066, 0.054), k=0)
beard.add('ell', (0, -0.072, 1.566), (0.034, 0.032, 0.034), k=0.02)
beard.add('cap', (0.008, -0.0985, 1.6205), (0.027, -0.090, 1.609), 0.0055, k=0.006, mirror=True)  # moustache
beard.sub('ell', (0, -0.040, 1.672), (0.080, 0.080, 0.052), k=0.004)
beard.sub('ell', (0, -0.100, 1.606), (0.017, 0.016, 0.0075), k=0.003)  # mouth
beard.sub('cap', (0, 0.03, 1.62), (0, 0.03, 1.50), 0.045, k=0.01)

hair_f = SDF()
hair_f.add('ell', (0, 0.020, 1.710), (0.088, 0.107, 0.105), k=0)
hair_f.add('ell', (0, 0.050, 1.620), (0.085, 0.075, 0.080), k=0.03)
hair_f.sub('ell', (0, -0.086, 1.640), (0.076, 0.070, 0.098), k=0.004)
hair_f.add('cap', (0.012, -0.086, 1.765), (0.062, -0.060, 1.715), 0.011, k=0.015, mirror=True)  # parted sweep

specs = [dict(skin=(0.64, 0.42, 0.27), brow_col=(0.25, 0.16, 0.09), stubble=(0.35, 0.28, 0.24),
              hair_sdf=hair_m, hair_col=(0.20, 0.12, 0.06), beard_sdf=beard, beard_col=(0.22, 0.13, 0.07)),
         dict(skin=(0.70, 0.49, 0.34), fem=True, brow_col=(0.40, 0.22, 0.10), iris=(0.15, 0.25, 0.35), jaw=0.92,
              hair_sdf=hair_f, hair_col=(0.45, 0.20, 0.07))]
for i, o in enumerate(specs):
    t = time.time()
    parts = head_parts(o)
    verts, faces, fmat, cols, wts, mats = merge(parts)
    print("TIME", time.time() - t)
    me = bpy.data.meshes.new("h"); me.from_pydata([tuple(v + Vector(((i - 0.5) * 0.3, 0, 0))) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new("h", me); sc.collection.objects.link(ob)
    for key in mats: me.materials.append(make_material(key, key))
    for j, p in enumerate(me.polygons): p.material_index = fmat[j]; p.use_smooth = True
    ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'POINT')
    for j, c in enumerate(cols): ca.data[j].color = (*c, 1)
    print("TRIS", sum(len(p.vertices) - 2 for p in me.polygons))
RU.cam(sc, (0.25, -0.75, 1.72), (0, 0, 1.66), 60)
RU.render(os.path.join(OUT, "t_head_v2_34.png"))
RU.cam(sc, (0.9, -0.05, 1.68), (0, 0, 1.66), 70)
RU.render(os.path.join(OUT, "t_head_v2_side.png"))
