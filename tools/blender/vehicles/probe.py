import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/car-red.glb")
for o in bpy.data.objects:
    print(o.name,o.type,tuple(round(v,2) for v in o.location),tuple(round(v,2) for v in o.dimensions))
for m in bpy.data.materials:
    n=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    print('MAT',m.name, tuple(round(v,2) for v in n.inputs['Base Color'].default_value) if n else None)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
print([p.identifier for p in props if any(k in p.identifier for k in ('draco','anim','apply','camera','light','yup','sampl','skin','frame','force','optimize','merge','nla','negative'))])
print([i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])
