import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/npc/npc-noble.glb")
ob = next(o for o in bpy.data.objects if o.type == 'MESH')
ca = ob.data.color_attributes[0]
print("ATTR", ca.name, ca.domain, ca.data_type)
import collections
vals = collections.Counter()
for d in list(ca.data)[::200]:
    vals[tuple(round(x, 2) for x in d.color[:3])] += 1
print("SAMPLE", vals.most_common(8))
for m in ob.data.materials:
    print("MAT", m.name, [n.type for n in m.node_tree.nodes])
