# Render previews of a character glb (EEVEE, NPC preview lighting).
# Blender -b --factory-startup --python preview_player.py -- in.glb outdir shot1 shot2 ...
# Optionally env CMP=/path/person.glb puts the original next to it (x = +0.9) for scale/foot checks.
import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "npc_real"))
import bpy
from mathutils import Vector
import render_util as RU

args = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)

def imp(path, x=0.0, action=None, frame=0):
    before = set(bpy.data.objects); ba = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    acts = [a for a in bpy.data.actions if a not in ba]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    root = arm
    while root.parent: root = root.parent
    root.location.x = x
    if action:
        a = next(a for a in acts if a.name.split('|')[-1].split('.')[0] == action)
        arm.animation_data.action = a
        if a.slots: arm.animation_data.action_slot = a.slots[0]
    else:
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    for o in objs:
        if o.type == 'MESH' and not o.parent: o.hide_render = True   # stray Icosphere in person.glb
    return objs, arm

def mesh_bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in objs:
        if o.type != 'MESH' or o.hide_render: continue
        e = o.evaluated_get(dg); me = e.to_mesh()
        for v in me.vertices:
            w = e.matrix_world @ v.co
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        e.to_mesh_clear()
    return lo, hi

SHOTS = {  # name: (action, frame, cam loc, target, lens, res)
    "front34":  ("Idle", 0, (1.7, -3.6, 1.45), (0, 0, 0.95), 50, (900, 1200)),
    "back34":   ("Idle", 0, (-1.6, 3.6, 1.55), (0, 0, 0.95), 50, (900, 1200)),
    "tpose":    (None, 0, (0.0, -4.2, 1.2), (0, 0, 1.0), 45, (1200, 1000)),
    "hips":     ("Idle", 0, (0.6, -2.2, 1.0), (0, 0, 0.95), 60, (900, 900)),
    "face":     ("Idle", 0, (0.35, -1.25, 1.62), (0, -0.05, 1.58), 70, (900, 900)),
    "walk8":    ("Walk", 8, (3.6, -0.6, 1.2), (0, 0, 0.9), 50, (1000, 1100)),
    "walk24":   ("Walk", 24, (2.6, -2.6, 1.3), (0, 0, 0.9), 50, (1000, 1100)),
    "run5":     ("Run", 5, (3.4, -1.4, 1.2), (0, 0, 0.9), 50, (1000, 1100)),
    "run12":    ("Run", 12, (-2.4, -2.8, 1.3), (0, 0, 0.9), 50, (1000, 1100)),
    "sword":    ("Sword_Slash", 10, (2.2, -3.0, 1.4), (0, 0, 0.95), 50, (1000, 1100)),
    "punch":    ("Punch_Right", 8, (2.2, -3.0, 1.4), (0, 0, 0.95), 50, (1000, 1100)),
    "roll":     ("Roll", 12, (3.0, -2.0, 1.2), (0, 0, 0.6), 50, (1000, 1000)),
    "death":    ("Death", 25, (2.5, -2.5, 1.8), (0, 0.3, 0.3), 50, (1000, 1000)),
    "kick":     ("Kick_Right", 10, (2.6, -2.6, 1.3), (0, 0, 0.9), 50, (1000, 1100)),
    "wave":     ("Wave", 20, (1.4, -3.4, 1.4), (0, 0, 1.0), 50, (1000, 1100)),
}
for name in args[2:]:
    act, fr, loc, tgt, lens, res = SHOTS[name]
    sc = RU.setup_scene(res)
    objs, arm = imp(GLB, 0.0, act, fr)
    cmp = os.environ.get("CMP")
    cobjs = None
    if cmp:
        cobjs, _ = imp(cmp, 0.9, act, fr)
    sc.frame_set(fr)
    lo, hi = mesh_bounds(objs)
    print("BOUNDS", name, [round(x, 3) for x in lo], [round(x, 3) for x in hi])
    if cobjs:
        lo2, hi2 = mesh_bounds(cobjs)
        print("BOUNDS_CMP", name, [round(x, 3) for x in lo2], [round(x, 3) for x in hi2])
        loc = (loc[0] + 0.45, loc[1] * 1.35, loc[2]); tgt = (tgt[0] + 0.45, tgt[1], tgt[2])
    RU.cam(sc, loc, tgt, lens)
    RU.render(os.path.join(OUT, name + ".png"))
