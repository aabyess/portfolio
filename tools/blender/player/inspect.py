"""Dump structure of a glb: objects, mesh tris/vgroups/materials/images, bones (world head/tail), actions.
usage: Blender -b --factory-startup --python inspect.py -- file.glb"""
import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
R = lambda v: tuple(round(x, 3) for x in v)
for o in bpy.data.objects:
    print("OBJ", o.name, o.type, o.parent.name if o.parent else None, "dim", R(o.dimensions), "loc", R(o.location), "rot", R(o.rotation_euler), "scl", R(o.scale))
    if o.type == 'MESH':
        me = o.data; me.calc_loop_triangles()
        cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
        print("  tris", len(me.loop_triangles), "verts", len(me.vertices), "vgroups", len(o.vertex_groups), "mats", [m.name for m in me.materials])
        print("  bbox", [round(min(c[i] for c in cs), 3) for i in range(3)], [round(max(c[i] for c in cs), 3) for i in range(3)])
        print("  mods", [(m.type, getattr(m, 'object', None) and m.object.name) for m in o.modifiers])
        for m in me.materials:
            if m and m.node_tree:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image: print("   img", m.name, n.image.name, n.image.size[:])
    if o.type == 'ARMATURE':
        print("  nbones", len(o.data.bones))
        for b in o.data.bones:
            print("  BONE", b.name, b.parent.name if b.parent else None, R(o.matrix_world @ b.head_local), R(o.matrix_world @ b.tail_local))
for a in bpy.data.actions:
    print("ACT", a.name, a.frame_range[:])
