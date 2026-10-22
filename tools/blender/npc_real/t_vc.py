import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_uv_sphere_add()
ob = bpy.context.object; me = ob.data
ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'CORNER')
for i, d in enumerate(ca.data): d.color = (1, 0.2, 0.1, 1) if i % 2 else (0.1, 0.2, 1, 1)
m = bpy.data.materials.new("M")
nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
c = nt.nodes.new("ShaderNodeVertexColor"); c.layer_name = "Col"
nt.links.new(c.outputs["Color"], b.inputs["Base Color"])
me.materials.append(m)
props = bpy.ops.export_scene.gltf.get_rna_type().properties
print("PROPS", [p.identifier for p in props if 'color' in p.identifier.lower() or 'draco' in p.identifier.lower()])
for p in props:
    if 'vertex_color' in p.identifier:
        print("P", p.identifier, getattr(p, 'default', None), [e.identifier for e in getattr(p, 'enum_items', [])])
bpy.ops.export_scene.gltf(filepath="/Users/sang/.claude/jobs/02a78233/tmp/npc_real/t.glb", export_format='GLB', export_draco_mesh_compression_enable=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/Users/sang/.claude/jobs/02a78233/tmp/npc_real/t.glb")
o = [o for o in bpy.data.objects if o.type == 'MESH'][0]
print("ATTRS", [(a.name, a.domain, a.data_type) for a in o.data.color_attributes])
