# 내보낸 GLB 를 다시 읽어 렌더해 본다.
#   lineup:  Blender -b --factory-startup --python preview_glb.py -- lineup out.png
#   pose:    ... -- pose out.png <clip> <frame> [종...]      (종마다 칸 하나, 격자)
#   clips:   ... -- clips out.png <종>                        (그 종의 동작마다 칸 하나)
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from mathutils import Vector
import numpy as np
import render_util as R

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
ALL = ['panda', 'bear', 'deer', 'fox', 'rabbit', 'sheep', 'boar', 'dog', 'cat']
argv = sys.argv[sys.argv.index('--') + 1:]
mode, out = argv[0], argv[1]
TW, TH = 640, 480

def load(nm):
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=f"{REPO}/models/animals/{nm}.glb")
    objs = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    acts = {a.name.split('.')[0].split('_')[0]: a for a in bpy.data.actions if a not in acts0}
    if arm.animation_data:
        for tr in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(tr)
    return arm, objs, acts

def pose(arm, acts, clip, frame):
    act = acts.get(clip)
    if not act: return False
    arm.animation_data_create(); arm.animation_data.action = act
    try:
        if act.slots: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    bpy.context.scene.frame_set(int(frame))
    return True

def bbox(objs):
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != 'MESH' or not o.vertex_groups: continue
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        pts += [o.matrix_world @ v.co for v in me.vertices]
        oe.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

def tile(nm, clip, frame, path, ang=-0.9, label=None):
    sc = R.setup_scene(res=(TW, TH))
    arm, objs, acts = load(nm)
    ok = pose(arm, acts, clip, frame)
    lo, hi = bbox(objs)
    ctr = (lo + hi) / 2; size = max(hi - lo)
    d = size * 2.3
    R.cam(sc, ctr + Vector((math.sin(ang) * d, -math.cos(ang) * d, size * 0.35)), ctr, lens=50)
    R.render(path)
    return path

def grid(paths, out, cols=3):
    rows = math.ceil(len(paths) / cols)
    big = np.zeros((rows * TH, cols * TW, 4), dtype=np.float32)
    for i, p in enumerate(paths):
        im = bpy.data.images.load(p); a = np.array(im.pixels[:], dtype=np.float32).reshape(TH, TW, 4)
        r, c = i // cols, i % cols
        big[(rows - 1 - r) * TH:(rows - r) * TH, c * TW:(c + 1) * TW] = a
    img = bpy.data.images.new("grid", cols * TW, rows * TH, alpha=True)
    img.pixels[:] = big.ravel(); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
    print("GRID", out)

if mode == 'lineup':
    sc = R.setup_scene(res=(2200, 800))
    x = 0.0; allo = []
    for nm in ALL:
        arm, objs, acts = load(nm)
        pose(arm, acts, 'Idle', 0)
        lo, hi = bbox(objs)
        w = hi.y - lo.y
        arm.rotation_euler = (0, 0, -0.6)
        arm.location.x = x + w / 2 + 0.0
        x += w + 0.25
    cx = x / 2
    R.cam(sc, (cx, -21.0, 2.0), (cx, 0, 0.6), lens=40)
    R.render(out)
elif mode == 'pose':
    clip, frame = argv[2], int(argv[3]); names = argv[4:] or ALL
    grid([tile(nm, clip, frame, f"/tmp/_pt_{nm}.png") for nm in names], out)
elif mode == 'clips':
    nm = argv[2]
    frames = [('Idle', 20), ('Walk', 6), ('Walk', 18), ('Run', 4), ('Run', 10), ('Eat', 12), ('Sit', 10), ('Stand', 36), ('Stand', 12)]
    ps = []
    for i, (c, f) in enumerate(frames):
        ps.append(tile(nm, c, f, f"/tmp/_pc_{nm}_{i}.png"))
    grid(ps, out)
