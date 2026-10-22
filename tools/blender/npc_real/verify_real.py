import bpy, os, sys
from mathutils import Vector
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
NAMES = ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk", "maid", "baker", "noble", "herbalist"]
only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else NAMES

def world_verts(obs):
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    for ob in obs:
        e = ob.evaluated_get(dg); m = e.to_mesh()
        out += [e.matrix_world @ v.co for v in m.vertices]
        e.to_mesh_clear()
    return out

for n in only:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    p = os.path.join(REPO, "models", "npc", f"npc-{n}.glb")
    bpy.ops.import_scene.gltf(filepath=p)
    objs = list(bpy.data.objects)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    meshes = [o for o in objs if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    tris = sum(sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in meshes)
    arm.animation_data_create(); arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    vs = world_verts(meshes)
    zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
    feet = [v for v in vs if v.z < 0.05]
    fwd = "-Y(Blender)=+Z(glTF)" if -min(v.y for v in feet) > max(v.y for v in feet) else "+Y?"
    print(f"STAT {n}: size={os.path.getsize(p)}B tris={tris} meshes={len(meshes)} height={zmax - zmin:.3f} zmin={zmin:.3f} forward={fwd}")
    print(f"STAT {n}: bones={len(arm.data.bones)} {[b.name for b in arm.data.bones]}")
    acts = sorted(bpy.data.actions, key=lambda a: a.name)
    print(f"STAT {n}: actions={[(a.name, tuple(int(x) for x in a.frame_range)) for a in acts]}")
    for a in acts:
        arm.animation_data.action = a
        if a.slots: arm.animation_data.action_slot = a.slots[0]
        f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
        mins = []
        for f in range(f0, f1 + 1, 2):
            bpy.context.scene.frame_set(f)
            mins.append(min(v.z for v in world_verts(meshes)))
        pr = arm.pose.bones["Prop.R"]
        bpy.context.scene.frame_set(f0)
        hips = arm.matrix_world @ arm.pose.bones["Hips"].head
        extra = ""
        if a.name == "Drink":
            bpy.context.scene.frame_set(40)
            mug = arm.matrix_world @ pr.head; hd = arm.matrix_world @ arm.pose.bones["Head"].head
            extra = f" f40 mug={tuple(round(c, 3) for c in mug)} headbase={tuple(round(c, 3) for c in hd)}"
        if a.name == "Cheers":
            bpy.context.scene.frame_set(14); mug = arm.matrix_world @ pr.head
            extra = f" f14 mug={tuple(round(c, 3) for c in mug)}"
        if a.name in ("GetUp", "Fall"):
            bpy.context.scene.frame_set(0 if a.name == "GetUp" else f1)
            hd = arm.matrix_world @ arm.pose.bones["Head"].tail; hp = arm.matrix_world @ arm.pose.bones["Hips"].head
            extra = f" lying(frame {'0' if a.name == 'GetUp' else f1}): head_tip={tuple(round(c, 2) for c in hd)} hips={tuple(round(c, 2) for c in hp)}"
            bpy.context.scene.frame_set(f1)
            hp1 = arm.matrix_world @ arm.pose.bones["Hips"].head
            extra += f" last hips={tuple(round(c, 2) for c in hp1)}"
        bpy.context.scene.frame_set(f0)
        print(f"  ACT {a.name}: {f0}-{f1} minZ[{min(mins):.3f},{max(mins):.3f}] hips@f0 z={hips.z:.3f} prop_scale@f0={pr.scale[0]:.3f}{extra}")
