"""Usage: Blender -b --factory-startup --python pview.py -- <mode> <name> [...]
mode: booth <name>   -> verify + 3/4 front, back, side renders (group units shown x0.62 = real metres)
      set            -> table + 4 stools at r 1.75 (game layout) + variants
      lineup n1 n2.. -> booths side by side"""
import sys, os, math, json, struct
import bpy
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
MODE = argv[0]
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
PROPS = os.path.join(REPO, "models", "props")
PREV = "/Users/sang/.claude/jobs/02a78233/tmp/tavern/previews"
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def load(name, loc=(0, 0, 0), scale=1.0, rotz=0.0):
    path = os.path.join(PROPS, name + ".glb")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name + "_root", None)
    sc.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.scale = (scale,) * 3
    root.rotation_euler = (0, 0, rotz)
    bpy.context.view_layer.update()
    return root, new, path


def info(name, new, path, s=1.0):
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in new:
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    raw = open(path, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    G = json.loads(raw[20:20 + jl])
    print("FILE %s  %.1f KB  tris %d  objects %s" % (name, os.path.getsize(path) / 1024, tris,
                                                     sorted(o.name for o in new)))
    print("  materials", [m['name'] for m in G.get('materials', [])], "images", len(G.get('images', [])))
    print("  BBOX (file units) min (%.3f, %.3f, %.3f) max (%.3f, %.3f, %.3f)" % (*(mn / s), *(mx / s)))
    if s != 1.0:
        print("  BBOX (real m, x0.62) size (%.2f, %.2f, %.2f) min (%.2f, %.2f, %.2f) max (%.2f,%.2f,%.2f)" % (
            *(mx - mn), *mn, *mx))
    return mn, mx


def setup_render(res=(1000, 680)):
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError as e:
        print(e)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.eevee.taa_render_samples = 32
    w = bpy.data.worlds.new("W"); sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.55, 0.47, 0.40, 1); bg.inputs[1].default_value = 0.75
    ld = bpy.data.lights.new("sun", 'SUN'); ld.energy = 3.2
    lo = bpy.data.objects.new("sun", ld); sc.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(52), math.radians(8), math.radians(-30))
    bpy.ops.mesh.primitive_plane_add(size=80)
    g = bpy.context.active_object
    gm = bpy.data.materials.new("ground"); gm.use_nodes = True
    next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.22, 0.17, 0.10, 1)
    g.data.materials.append(gm)
    cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 40
    cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
    tgt = bpy.data.objects.new("tgt", None); sc.collection.objects.link(tgt)
    con = cam.constraints.new('TRACK_TO'); con.target = tgt; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
    return cam, tgt


def shot(cam, tgt, fname, center, dirv, dist):
    tgt.location = center
    cam.location = center + Vector(dirv).normalized() * dist
    sc.render.filepath = os.path.join(PREV, fname)
    bpy.ops.render.render(write_still=True)
    print("RENDER", sc.render.filepath)


if MODE == 'booth':
    name = argv[1]
    root, new, path = load(name, scale=0.62)
    mn, mx = info(name, new, path, 0.62)
    cam, tgt = setup_render()
    # reference: board posts + stools ring in front (real metres)
    for x in (-2.1, 2.1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 1.74, 1.6)); bpy.context.active_object.scale = (0.17, 0.17, 3.2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.62, 3.16 + 1.83)); bpy.context.active_object.scale = (6.3, 0.18, 3.66)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.42, location=(math.cos(a) * 1.75, -2.85 + math.sin(a) * 1.75, 0.21))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=0.7, location=(0, -2.85, 0.35))
    c = Vector((0, 0, 1.6))
    shot(cam, tgt, name + "_34.png", c, (0.75, -1.0, 0.42), 9.5)
    shot(cam, tgt, name + "_back.png", c, (-0.6, 1.0, 0.5), 9.5)
    shot(cam, tgt, name + "_front.png", c + Vector((0, 0, 0.3)), (0.0, -1.0, 0.25), 12.0)
    if len(argv) > 2:
        shot(cam, tgt, name + "_close.png", Vector((0.4, -0.6, 1.3)), (0.45, -1.0, 0.25), 4.2)
elif MODE == 'set':
    cam, tgt = setup_render()
    root, new, path = load("tavern-table", loc=(0, 0, 0)); info("tavern-table", new, path)
    names = ["tavern-stool", "tavern-stool-barrel", "tavern-stool-log", "tavern-stool"]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        r_, n_, p_ = load(names[k], loc=(math.cos(a) * 1.75, math.sin(a) * 1.75, 0), rotz=a)
        if k < 3:
            info(names[k], n_, p_)
    r_, n_, p_ = load("tavern-bench", loc=(0, 2.6, 0)); info("tavern-bench", n_, p_)
    shot(cam, tgt, "furniture_set.png", Vector((0, 0.3, 0.4)), (0.7, -1.0, 0.75), 5.8)
    shot(cam, tgt, "furniture_close.png", Vector((1.0, -1.0, 0.35)), (0.6, -1.0, 0.45), 2.2)
elif MODE == 'seats':
    cam, tgt = setup_render((1400, 560))
    names = ["tavern-stool", "tavern-stool-barrel", "tavern-stool-log", "tavern-stool-crate", "tavern-chair",
             "tavern-bench", "tavern-bierbank", "tavern-table"]
    x = -4.2
    for n in names:
        w = 1.4 if ('bench' in n or 'bierbank' in n or 'table' in n) else 0.8
        x += w / 2
        r_, n_, p_ = load(n, loc=(x, 0, 0))
        info(n, n_, p_)
        x += w / 2 + 0.25
    shot(cam, tgt, "seats_row.png", Vector((x / 2 - 2.1, 0, 0.4)), (0.25, -1.0, 0.45), 7.0)
elif MODE == 'lineup':
    names = argv[1:]
    cam, tgt = setup_render((2400, 560))
    sp = 6.6
    for i, n in enumerate(names):
        root, new, path = load(n, loc=((i - (len(names) - 1) / 2) * sp, 0, 0), scale=0.62)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = sp * len(names) * 1.02
    shot(cam, tgt, "taverns7_lineup.png", Vector((0, 0, 2.3)), (0.0, -1.0, 0.22), 60)
