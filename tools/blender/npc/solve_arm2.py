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
import random
random.seed(1)
VARS=[('UpperArm.R',0,-110,-30),('UpperArm.R',2,-10,80),('LowerArm.R',0,-160,-40),('LowerArm.R',2,-40,40),('Hand.R',0,-50,20),('Hand.R',2,-70,70),('Hand.R',1,-60,60)]
def mk(x):
    d={'UpperArm.R':[0,0,0],'LowerArm.R':[0,0,0],'Hand.R':[0,0,0]}
    for (b,ax,lo,hi),v in zip(VARS,x): d[b][ax]=v
    return {k:tuple(v) for k,v in d.items()}
def cost_drink(x):
    c, top, mouth = evalpose(mk(x), 1.3)
    rim = c + top*0.075
    tgt = mouth + Vector((0,-0.025,0))
    return (rim-tgt).length + 0.08*abs(top.x) + 0.1*max(0,0.75-top.y) + 0.05*max(0,-top.z)
def cost_cheers(x):
    c, top, mouth = evalpose(mk(x), 0.6)
    return (c-Vector((-0.06,-0.47,1.36))).length + 0.15*(1-top.z)
def opt(cost):
    best=None
    for s in range(12):
        x=[random.uniform(lo,hi) for (_,_,lo,hi) in VARS]; cx=cost(x); step=20
        while step>0.5:
            imp=False
            for i in range(len(x)):
                for dlt in (step,-step):
                    y=list(x); y[i]=max(VARS[i][2],min(VARS[i][3],y[i]+dlt)); cy=cost(y)
                    if cy<cx: x,cx,imp=y,cy,True
            if not imp: step/=2
        if best is None or cx<best[0]: best=(cx,x)
    return best
for nm,cf,h in (('DRINK',cost_drink,1.3),('CHEERS',cost_cheers,0.6)):
    b=opt(cf); c,top,mouth=evalpose(mk(b[1]),h)
    print(nm, round(b[0],4), {k:tuple(round(v) for v in vv) for k,vv in mk(b[1]).items()}, 'mug',tuple(round(v,3) for v in c),'top',tuple(round(v,2) for v in top),'mouth',tuple(round(v,3) for v in mouth))
