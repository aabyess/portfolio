import bpy
print("VER", bpy.app.version_string)
p = bpy.ops.export_scene.gltf.get_rna_type().properties
print([i.identifier for i in p['export_image_format'].enum_items])
print([k for k in p.keys() if 'webp' in k.lower() or 'image' in k.lower() or 'jpeg' in k.lower()])
print([i.identifier for i in bpy.types.BakeSettings.bl_rna.properties['target'].enum_items] if 'target' in bpy.types.BakeSettings.bl_rna.properties else '')
print([i.identifier for i in bpy.types.Scene.bl_rna.properties['render'].fixed_type.bl_rna.properties['engine'].enum_items])
