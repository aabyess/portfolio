"""Usage: Blender -b --factory-startup --python verify.py -- <name> [render]"""
import sys, os, math
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
NAME = argv[0]
RENDER = len(argv) > 1
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
PATH = os.path.join(REPO, "models", "vehicles", NAME + ".glb")
PREV = "/Users/sang/.claude/jobs/02a78233/tmp/vehicles/previews"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
sc = bpy.context.scene
# ---- ground truth straight from the GLB JSON
import json, struct
from mathutils import Matrix, Quaternion
raw = open(PATH, 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]
G = json.loads(raw[20:20 + jl])
print("GLB extensionsUsed", G.get('extensionsUsed'), "required", G.get('extensionsRequired'))
print("GLB cameras", len(G.get('cameras', [])), "lights", 'KHR_lights_punctual' in G.get('extensionsUsed', []), "images", len(G.get('images', [])))
print("GLB animations", [(a['name'], len(a['channels'])) for a in G.get('animations', [])])
par = {}
for i, n in enumerate(G['nodes']):
    for c in n.get('children', []):
        par[c] = i
def lm(n):
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s_ = n.get('scale', [1, 1, 1])
    return Matrix.Translation(t) @ Quaternion((r[3], r[0], r[1], r[2])).to_matrix().to_4x4() @ Matrix.Diagonal((*s_, 1))
def wm(i):
    m = lm(G['nodes'][i])
    while i in par:
        i = par[i]; m = lm(G['nodes'][i]) @ m
    return m
for i, n in enumerate(G['nodes']):
    p = G['nodes'][par[i]]['name'] if i in par else '-'
    w = wm(i).translation
    print("NODE %-14s parent=%-12s gltf_world=(%.3f, %.3f, %.3f) localrot=%s %s" % (n.get('name'), p, w.x, w.y, w.z,
          [round(x, 3) for x in n.get('rotation', [0, 0, 0, 1])], "mesh" if 'mesh' in n else ("skin" if 'skin' in n else "")))
gmn = Vector((1e9,) * 3); gmx = Vector((-1e9,) * 3)
for i, n in enumerate(G['nodes']):
    if 'mesh' not in n:
        continue
    for prim in G['meshes'][n['mesh']]['primitives']:
        acc = G['accessors'][prim['attributes']['POSITION']]
        a, b_ = acc['min'], acc['max']
        for cx in (a[0], b_[0]):
            for cy in (a[1], b_[1]):
                for cz in (a[2], b_[2]):
                    w = wm(i) @ Vector((cx, cy, cz))
                    w = Vector((w.x, -w.z, w.y))  # -> Blender axes
                    gmn = Vector(map(min, gmn, w)); gmx = Vector(map(max, gmx, w))
print("REST_BBOX(blender axes) min (%.3f, %.3f, %.3f) max (%.3f, %.3f, %.3f)" % (*gmn, *gmx))
print("REST_SIZE  width X=%.3f  length Y=%.3f  height Z=%.3f   center xy=(%.3f, %.3f)" % (*(gmx - gmn), (gmn.x + gmx.x) / 2, (gmn.y + gmx.y) / 2))
SKIP = {o.name for o in bpy.data.objects if o.name not in {n.get('name') for n in G['nodes']}}
print("importer-only objects ignored:", SKIP)
for o in list(bpy.data.objects):
    if o.name in SKIP:
        bpy.data.objects.remove(o)
dg = bpy.context.evaluated_depsgraph_get()


def wbox(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


def r3(v):
    return "(%.3f, %.3f, %.3f)" % tuple(v)


print("=" * 60)
print("FILE", PATH, "size %.1f KB" % (os.path.getsize(PATH) / 1024))
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
print("TRIS", tris)
for o in sorted(bpy.data.objects, key=lambda o: o.name):
    extra = ""
    if o.parent:
        extra = " parent=%s%s" % (o.parent.name, ("/" + o.parent_bone) if o.parent_bone else "")
    print("OBJ %-14s %-9s world=%s rot=%s scale=%s%s" % (
        o.name, o.type, r3(o.matrix_world.translation), r3(o.rotation_euler), r3(o.scale), extra))
mn, mx = wbox(bpy.data.objects)
print("BBOX min", r3(mn), "max", r3(mx), "size", r3(mx - mn), "center xy (%.3f, %.3f)" % ((mn.x + mx.x) / 2, (mn.y + mx.y) / 2))
for key in ('wheel', 'steer', 'pedals', 'seat'):
    for o in bpy.data.objects:
        if o.name.startswith(key):
            info = "origin=%s" % r3(o.matrix_world.translation)
            if o.type == 'MESH':
                bmn, bmx = wbox([o])
                c = (bmn + bmx) / 2
                info += " geomcenter=%s offset=%s size=%s" % (r3(c), r3(c - o.matrix_world.translation), r3(bmx - bmn))
                info += " lowestZ=%.3f" % bmn.z
            print("PART", o.name, info)
for a in bpy.data.actions:
    print("ACTION %-8s frames %s -> %.3fs" % (a.name, tuple(a.frame_range), (a.frame_range[1] - a.frame_range[0]) / sc.render.fps))
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm:
    print("BONES", [b.name for b in arm.data.bones])
    hb = arm.data.bones.get('head'); tb = arm.data.bones.get('tail')
    if hb and tb:
        hy = (arm.matrix_world @ hb.head_local).y; ty = (arm.matrix_world @ tb.head_local).y
        print("FRONT (horse head y=%.2f, tail y=%.2f) -> front is %s" % (hy, ty, "-Y (glTF +Z)" if hy < ty else "+Y WRONG"))
s = bpy.data.objects.get('steer')
if s and bpy.data.objects.get('wheel_rear'):
    print("FRONT marker %s y=%.2f -> front is %s" % (s.name, s.matrix_world.translation.y, "-Y (glTF +Z)" if s.matrix_world.translation.y < 0 else "+Y WRONG"))

if not RENDER:
    sys.exit(0)

# ---------------------------------------------------------------- preview renders
try:
    sc.render.engine = 'BLENDER_EEVEE'
except TypeError as e:
    print(e)
sc.render.resolution_x, sc.render.resolution_y = 900, 640
sc.render.film_transparent = False
w = bpy.data.worlds.new("W"); sc.world = w
w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.55, 0.45, 0.38, 1); bg.inputs[1].default_value = 0.8
ld = bpy.data.lights.new("sun", 'SUN'); ld.energy = 3.5
lo = bpy.data.objects.new("sun", ld); sc.collection.objects.link(lo)
lo.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
# ground
bpy.ops.mesh.primitive_plane_add(size=40)
g = bpy.context.active_object
gm = bpy.data.materials.new("ground"); gm.use_nodes = True
next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.25, 0.2, 0.12, 1)
g.data.materials.append(gm)

center = (mn + mx) / 2
L = (mx - mn).length
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 50
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
tgt = bpy.data.objects.new("tgt", None); sc.collection.objects.link(tgt); tgt.location = center
con = cam.constraints.new('TRACK_TO'); con.target = tgt; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'


def shot(fname, dirv, dist=1.25):
    cam.location = center + Vector(dirv).normalized() * L * dist
    sc.render.filepath = os.path.join(PREV, fname)
    bpy.ops.render.render(write_still=True)
    print("RENDER", sc.render.filepath)


shot(NAME + "_34.png", (0.9, -1.1, 0.6))       # 3/4 front-left
shot(NAME + "_side.png", (-1.0, 0.25, 0.25))   # right side / slightly rear
if arm and 'Gallop' in bpy.data.actions:
    ad = arm.animation_data or arm.animation_data_create()
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    for act_name, frames in (('Gallop', (0, 4, 8)), ('Walk', (0, 7))):
        act = bpy.data.actions[act_name]
        ad.action = act
        try:
            if act.slots and ad.action_slot is None:
                ad.action_slot = act.slots[0]
        except Exception as e:
            print("slot", e)
        for f in frames:
            sc.frame_set(f)
            shot("%s_%s_f%02d.png" % (NAME, act_name.lower(), f), (-1.0, 0.0, 0.15), 1.45)
