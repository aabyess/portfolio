# 빠른 모양 확인: 메타볼 메쉬 + 꼭짓점 색만으로 종마다 렌더해서 격자로 붙인다 (굽기·뼈 없음)
# Blender -b --factory-startup --python preview_shapes.py -- out.png [종 이름들]
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from mathutils import Vector
import numpy as np
import lib, species, render_util as R

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = argv[0] if argv else '/tmp/shapes.png'
names = argv[1:] or list(species.SPECIES)
TW, TH = 640, 480
tiles = []
for nm in names:
    sc = R.setup_scene(res=(TW, TH))
    S, B = species.SPECIES[nm]()
    o = lib.metaball_mesh(B, S['size'] * 0.012, nm)
    lib.vertex_colors(B, o.data)
    m = bpy.data.materials.new(nm); nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.85
    o.data.materials.append(m)
    e = S['eye']; hc = Vector((0, *S['head']['c']))
    for sx in (1, -1):
        t = Vector((sx * e['t'][0], e['t'][1], e['t'][2]))
        sp = lib.surface_point(B, hc, t - hc)
        d = (t - hc).normalized()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=e['r'], location=sp - d * e['r'] * 0.45, segments=12, ring_count=8)
        bpy.context.object.data.materials.append(lib.mat_plain('eye', e['col'], 0.15))
    for kind, (vs, fs), bone in S.get('extras', []):
        me = bpy.data.meshes.new(kind); me.from_pydata([tuple(v) for v in vs], [], fs); me.update()
        eo = bpy.data.objects.new(kind, me); sc.collection.objects.link(eo)
        eo.data.materials.append(lib.mat_plain(kind, (0.75, 0.68, 0.55) if kind == 'Horn' else (0.9, 0.88, 0.8), 0.5))
    bb = [Vector(c) for c in o.bound_box]
    ctr = sum(bb, Vector()) / 8; size = max(o.dimensions) * 1.0
    if S.get('extras'): ctr.z += 0.15 * size
    ang = -0.9
    d = size * 2.2
    R.cam(sc, ctr + Vector((math.sin(ang) * d, -math.cos(ang) * d, size * 0.45)), ctr, lens=50)
    p = f"/tmp/_tile_{nm}.png"; R.render(p); tiles.append(p)
cols = 3; rows = math.ceil(len(tiles) / cols)
big = np.zeros((rows * TH, cols * TW, 4), dtype=np.float32)
for i, p in enumerate(tiles):
    im = bpy.data.images.load(p); a = np.array(im.pixels[:], dtype=np.float32).reshape(TH, TW, 4)
    r, c = i // cols, i % cols
    big[(rows - 1 - r) * TH:(rows - r) * TH, c * TW:(c + 1) * TW] = a
img = bpy.data.images.new("grid", cols * TW, rows * TH, alpha=True)
img.pixels[:] = big.ravel(); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print("GRID", out)
