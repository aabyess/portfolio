# Inspect the old bridge inside models/autumn-world.glb (headless)
#   Blender -b --factory-startup --python tools/blender/bridge/inspect_world.py
import bpy, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'autumn-world.glb'))
for o in bpy.data.objects:
    print('OBJ', o.name, o.type, len(o.data.vertices) if o.type == 'MESH' else '')
p = bpy.data.objects['EX_Path']
vs = [p.matrix_world @ v.co for v in p.data.vertices]
reg = [v for v in vs if 28 < v.y < 45]
print('PATH verts in region', len(reg), sorted(set(round(v.y, 1) for v in reg)))
b = bpy.data.objects['EX_Bridge']
print('BRIDGE verts', len(b.data.vertices), 'faces', len(b.data.polygons))
for f in p.data.polygons:
    ys = [(p.matrix_world @ p.data.vertices[i].co).y for i in f.vertices]
    if max(ys) > 30 and min(ys) < 45:
        print('PATHFACE', [round(y, 1) for y in ys])
