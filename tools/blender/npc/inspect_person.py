import bpy, sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/person.glb")
for o in bpy.data.objects:
    print("OBJ", o.name, o.type, tuple(round(x,3) for x in o.location), tuple(round(x,3) for x in o.rotation_euler), o.parent.name if o.parent else None)
    if o.type=='ARMATURE':
        for b in o.data.bones: print("  BONE", b.name, tuple(round(x,2) for x in (o.matrix_world@b.head_local)))
    if o.type=='MESH':
        cs=[o.matrix_world@Vector(c) for c in o.bound_box]
        print("  bbox min", [round(min(c[i] for c in cs),3) for i in range(3)], "max",[round(max(c[i] for c in cs),3) for i in range(3)])
        # nose direction: find verts at head height, extreme y
        vs=[o.matrix_world@v.co for v in o.data.vertices]
        zmax=max(v.z for v in vs)
        head=[v for v in vs if v.z>zmax-0.25*(zmax-min(v.z for v in vs))]
        print("  head y range", min(v.y for v in head), max(v.y for v in head))
for a in bpy.data.actions: print("ACT", a.name, a.frame_range[:])
