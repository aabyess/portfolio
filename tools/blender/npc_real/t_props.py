import bpy
props = bpy.ops.export_scene.gltf.get_rna_type().properties
for p in props:
    if 'image' in p.identifier or 'tangent' in p.identifier or 'texture' in p.identifier:
        print("P", p.identifier, getattr(p, 'default', None), [e.identifier for e in getattr(p, 'enum_items', [])])
