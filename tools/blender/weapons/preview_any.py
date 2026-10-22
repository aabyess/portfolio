"""Blender -b --factory-startup --python preview_any.py -- out_dir file.glb [file.glb ...]
Renders <name>_side.png (ortho from +X) and <name>_34.png (perspective) for each GLB, EEVEE, neutral studio."""
import sys, os, math
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
OUT, FILES = a[0], a[1:]
os.makedirs(OUT, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 32
    w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.55, 0.6, 0.66, 1); bg.inputs[1].default_value = 0.8
    for nm, en, rot in (("key", 3.5, (40, 0, 50)), ("rim", 1.5, (60, 0, -140))):
        ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en
        lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo)
        lo.rotation_euler = [math.radians(x) for x in rot]
    return sc


def bbox(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh()
        for v in me.vertices:
            p = o.matrix_world @ v.co
            mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
        o.evaluated_get(dg).to_mesh_clear()
    return mn, mx


for f in FILES:
    sc = setup()
    bpy.ops.import_scene.gltf(filepath=f)
    objs = list(bpy.data.objects)
    bpy.context.view_layer.update()
    mn, mx = bbox(objs)
    c = (mn + mx) / 2; L = (mx - mn).length
    name = os.path.splitext(os.path.basename(f))[0]
    cd = bpy.data.cameras.new("c"); cd.clip_start = 0.005; cd.clip_end = 200
    cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    views = [("side", 'ORTHO', Vector((1, 0, 0))), ("34", "PERSP", Vector((float(os.environ.get("PX", 0.8)), float(os.environ.get("PY", -0.9)), float(os.environ.get("PZ", 0.6))))),
             ("back34", 'PERSP', Vector((-0.8, 0.9, 0.5)))]
    for tag, kind, d in views:
        d = d.normalized()
        cd.type = kind
        if kind == 'ORTHO':
            s = mx - mn
            cd.ortho_scale = max(s.y, s.z * 1.4) * 1.1
            cam.location = c + d * L * 3
        else:
            cd.lens = 50
            cam.location = c + d * L * 1.7
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = 900, 640
        sc.render.filepath = os.path.join(OUT, name + "_" + tag + ".png")
        bpy.ops.render.render(write_still=True)
    print("PREVIEW", name, "bbox", tuple(round(x, 3) for x in mn), tuple(round(x, 3) for x in mx))
