import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
for t, s in (('BALL', 2.0), ('BALL', 6.0), ('ELLIPSOID', 2.0), ('CAPSULE', 2.0)):
    mb = bpy.data.metaballs.new("M"); mb.resolution = 0.02; mb.render_resolution = 0.02; mb.threshold = 0.6
    ob = bpy.data.objects.new("mbT" + t + str(int(s)), mb); bpy.context.scene.collection.objects.link(ob)
    e = mb.elements.new(type=t); e.co = (0, 0, 0); e.radius = 1.0; e.stiffness = s
    if t == 'ELLIPSOID': e.size_x, e.size_y, e.size_z = 1.0, 0.5, 0.25
    if t == 'CAPSULE': e.size_x = 1.0
    print("RADIUS PROPS", e.radius, getattr(e, 'size_x', None))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    print("MB", t, s, len(me.vertices), round(max(xs), 3), round(max(ys), 3), round(max(zs), 3), len(me.polygons), set(len(p.vertices) for p in me.polygons))
    bpy.data.objects.remove(ob)
print("ENGINES", [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items])
