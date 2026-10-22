import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/veh_real/horse_test.blend")
ob = bpy.data.objects['horse']; arm = bpy.data.objects['horse_rig']
print([ (b.name, tuple(round(x,2) for x in b.head_local), tuple(round(x,2) for x in b.tail_local)) for b in arm.data.bones if 'tail' in b.name])
me = ob.data
gi = {g.index: g.name for g in ob.vertex_groups}
mi = [i for i,m in enumerate(me.materials) if m.name=='Horse_Mane'][0]
vs=set()
for p in me.polygons:
    if p.material_index==mi and p.center.y>1.0: vs.update(p.vertices)
vs=sorted(vs)[:2000:200]
for i in vs:
    v=me.vertices[i]
    print(tuple(round(x,2) for x in v.co), [(gi[g.group], round(g.weight,2)) for g in v.groups])
ad = arm.animation_data
print("action", ad.action, [t.name for t in ad.nla_tracks])
