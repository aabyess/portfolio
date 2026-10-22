import bpy, sys, math, itertools
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/npc")
import build_npcs as N
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath="/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/src/npc-innkeeper.blend")
arm = bpy.data.objects["Armature"]; arm.animation_data.action = None
for t in arm.animation_data.nla_tracks: t.mute = True
A = N.Anim(arm)
def posed_point(bn, p):
    pb = arm.pose.bones[bn]
    return pb.matrix @ pb.bone.matrix_local.inverted() @ Vector(p)
def evalpose(arm_rot, head_h):
    r = N.sit_base(0, 96); r.update(arm_rot)
    r["Head"] = (-2 - 14 * head_h, 0, 0); r["Neck"] = (-3 - 5 * head_h, 0, 0); r["Chest"] = (3 - 4 * head_h, 0, 0)
    A.prevq = {}; A.pose(r, hips_loc=N.SIT_HIPS); bpy.context.view_layer.update()
    pr = arm.pose.bones["Prop.R"]
    c = pr.head.copy(); top = (pr.tail - pr.head).normalized()
    mouth = posed_point("Head", (0, -0.115, 1.625))
    return c, top, mouth
best = None
for ux, uz, lx, hx in itertools.product(range(-90, -30, 5), range(0, 60, 6), range(-140, -50, 6), range(-40, 5, 8)):
    c, top, mouth = evalpose({"UpperArm.R": (ux, 0, uz), "LowerArm.R": (lx, 0, 0), "Hand.R": (hx, 0, 0)}, 1.3)
    rim = c + top * 0.075
    target = mouth + Vector((0, -0.025, 0))
    err = (rim - target).length + 0.05 * max(0, 0.5 - top.y)
    if best is None or err < best[0]: best = (err, ux, uz, lx, hx, tuple(round(x, 3) for x in c), tuple(round(x, 3) for x in top), tuple(round(x, 3) for x in mouth))
print("DRINK2", best)
best = None
for ux, uz, lx, hx in itertools.product(range(-130, -60, 5), range(0, 40, 5), range(-60, 1, 6), range(-30, 31, 10)):
    c, top, mouth = evalpose({"UpperArm.R": (ux, 0, uz), "LowerArm.R": (lx, 0, 0), "Hand.R": (hx, 0, 0)}, 0.6)
    target = Vector((-0.06, -0.48, 1.36))
    err = (c - target).length + 0.1 * (1 - top.z)
    if best is None or err < best[0]: best = (err, ux, uz, lx, hx, tuple(round(x, 3) for x in c), tuple(round(x, 3) for x in top))
print("CHEERS", best)
