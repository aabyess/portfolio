import bpy
p = bpy.ops.export_scene.gltf.get_rna_type().properties
for k in p.keys():
    if any(s in k for s in ('color','image','jpeg','webp','texture','normal','tangent','shared','attributes')):
        pr = p[k]
        print(k, getattr(pr,'default',None), [i.identifier for i in pr.enum_items] if pr.type=='ENUM' else '')
print(hasattr(bpy.types.Mesh,'set_sharp_from_angle'))
