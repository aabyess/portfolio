"""Raw (unposed) vertex extents of person.glb parts vs. rest bones, and what action is active after import."""
import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
print("active action", arm.animation_data and arm.animation_data.action)
print("arm matrix_world", arm.matrix_world)
print("pose_position", arm.data.pose_position)
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.parent: continue
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    print(o.name, "parent_type", o.parent_type, "mw", [round(x, 3) for x in o.matrix_world.to_translation()], o.matrix_world.to_scale())
    print("  raw min", [round(min(v[i] for v in vs), 3) for i in range(3)], "max", [round(max(v[i] for v in vs), 3) for i in range(3)])
    # vertices most weighted to Wrist.R
    gi = o.vertex_groups.get('Wrist.R')
    if gi:
        pts = [o.matrix_world @ v.co for v in o.data.vertices if any(g.group == gi.index and g.weight > 0.5 for g in v.groups)]
        if pts: print("  Wrist.R verts", len(pts), "center", [round(sum(p[i] for p in pts) / len(pts), 3) for i in range(3)])
    gi = o.vertex_groups.get('Middle3.R')
    if gi:
        pts = [o.matrix_world @ v.co for v in o.data.vertices if any(g.group == gi.index and g.weight > 0.5 for g in v.groups)]
        if pts: print("  Middle3.R verts", len(pts), "center", [round(sum(p[i] for p in pts) / len(pts), 3) for i in range(3)])
    used = set()
    for v in o.data.vertices:
        for g in v.groups:
            if g.weight > 0.01: used.add(o.vertex_groups[g.group].name)
    print("  used groups", sorted(used))
