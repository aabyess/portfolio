# Compatibility + spike check for NPC GLBs.
# Blender -b --factory-startup --python verify_polish.py -- <new_dir> [<ref_dir>] [names...]
# Prints per model: tris, height, bones, clips (frame ranges), Sit hips z, max edge stretch in Walk/Sit/Fall/Run/GetUp.
import bpy, os, sys
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
NEW = args[0]
REF = args[1] if len(args) > 1 and os.path.isdir(args[1]) else None
NAMES = [a for a in args[1:] if not os.path.isdir(a)] or ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk", "maid", "baker", "noble", "herbalist"]

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    return arm, meshes

def set_act(arm, a):
    arm.animation_data_create()
    arm.animation_data.action = a
    if a and a.slots: arm.animation_data.action_slot = a.slots[0]

def coords(meshes):
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    for o in meshes:
        e = o.evaluated_get(dg); m = e.to_mesh()
        a = np.empty(len(m.vertices) * 3); m.vertices.foreach_get("co", a)
        a = a.reshape(-1, 3) @ np.array(e.matrix_world.to_3x3()).T + np.array(e.matrix_world.translation)
        out.append(a); e.to_mesh_clear()
    return out

def info(path):
    arm, meshes = load(path)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    bones = [b.name for b in arm.data.bones]
    acts = {a.name.split('.')[0]: (int(a.frame_range[0]), int(a.frame_range[1])) for a in bpy.data.actions}
    edges = [np.array([e.vertices[:] for e in o.data.edges]) for o in meshes]
    set_act(arm, None)
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.scene.frame_set(0)
    rest = coords(meshes)
    allz = np.concatenate([c[:, 2] for c in rest])
    restlen = [np.linalg.norm(c[e[:, 0]] - c[e[:, 1]], axis=1) + 1e-5 for c, e in zip(rest, edges)]
    res = dict(tris=tris, height=float(allz.max() - allz.min()), zmin=float(allz.min()), bones=bones, acts=acts, stretch={})
    imgs = [(i.name, i.size[0], i.size[1]) for i in bpy.data.images]
    res["imgs"] = imgs
    amap = {a.name.split('.')[0]: a for a in bpy.data.actions}
    for an in ("Walk", "Sit", "Fall", "Run", "GetUp", "Struggle", "Drink"):
        a = amap.get(an)
        if not a: continue
        set_act(arm, a)
        worst = 0.0; nbad = 0
        for f in range(int(a.frame_range[0]), int(a.frame_range[1]) + 1, 2):
            bpy.context.scene.frame_set(f)
            for c, e, rl in zip(coords(meshes), edges, restlen):
                if not len(e): continue
                l = np.linalg.norm(c[e[:, 0]] - c[e[:, 1]], axis=1)
                r = l / rl
                r = r[rl > 0.002]
                worst = max(worst, float(r.max())); nbad = max(nbad, int((r > 2.0).sum()))
            if an == "Sit" and f == 0:
                res["sit_hips"] = float((arm.matrix_world @ arm.pose.bones["Hips"].head).z)
        res["stretch"][an] = (round(worst, 2), nbad)
    return res

for n in NAMES:
    r = info(os.path.join(NEW, f"npc-{n}.glb"))
    line = f"VER {n}: tris={r['tris']} h={r['height']:.3f} zmin={r['zmin']:.3f} bones={len(r['bones'])} clips={len(r['acts'])} sit_hips={r.get('sit_hips', -1):.3f} imgs={r['imgs']}"
    print(line)
    print(f"VER {n}: stretch(max ratio, #edges>2x) {r['stretch']}")
    if REF:
        q = info(os.path.join(REF, f"npc-{n}.glb"))
        same_b = q["bones"] == r["bones"]; same_a = q["acts"] == r["acts"]
        print(f"VER {n}: REF tris={q['tris']} h={q['height']:.3f} sit_hips={q.get('sit_hips', -1):.3f} bones_same={same_b} clips_same={same_a} ref_stretch={q['stretch']}")
        if not same_a: print("   clips new", r["acts"], "\n   clips ref", q["acts"])
        if not same_b: print("   bones new", r["bones"], "\n   bones ref", q["bones"])
