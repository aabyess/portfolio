"""Blender -b --factory-startup --python verify.py -- <mode> name [name...]
mode: info | close | lineup.   Prints stats from the re-imported GLB; renders previews."""
import sys, os, math, json, struct
import bpy
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
MODE, NAMES = argv[0], argv[1:]
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
PREV = "/Users/sang/.claude/jobs/02a78233/tmp/weapons/previews"
os.makedirs(PREV, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
POSE = {}   # name -> frame to show for animated ones


def glb_json(path):
    raw = open(path, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    return json.loads(raw[20:20 + jl])


def wbox(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
        ev.to_mesh_clear()
    return mn, mx


groups = {}
for name in NAMES:
    path = os.path.join(REPO, "models", "weapons", name + ".glb")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    G = glb_json(path)
    gnames = {n.get('name') for n in G['nodes']}
    for o in new:   # importer helper objects (bone shapes etc.)
        if o.name not in gnames and o.type != 'ARMATURE':
            print("  (importer helper removed:", o.name, o.type, ")")
            bpy.data.objects.remove(o)
    new = [o for o in bpy.data.objects if o not in before]
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in new:
        if o.type == 'MESH':
            me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
            o.evaluated_get(dg).to_mesh_clear()
    mn, mx = wbox(new)
    sz = mx - mn
    imgs = [(im.get('name'), im.get('mimeType')) for im in G.get('images', [])]
    print("=" * 70)
    print("ITEM %-8s file %.1f KB  tris %d  mats %d  images %d  ext %s" % (
        name, os.path.getsize(path) / 1024, tris, len(G.get('materials', [])), len(imgs), G.get('extensionsUsed')))
    print("  cameras %d  lights %s" % (len(G.get('cameras', [])), 'KHR_lights_punctual' in G.get('extensionsUsed', [])))
    print("  BBOX blender min (%.3f %.3f %.3f) max (%.3f %.3f %.3f)  size X%.3f Y%.3f Z%.3f  longest %.3f" % (
        *mn, *mx, *sz, max(sz)))
    for o in sorted(new, key=lambda o: o.name):
        if o.type in ('EMPTY', 'ARMATURE'):
            w = o.matrix_world
            f = -(w.to_3x3() @ Vector((0, 1, 0))).normalized()
            print("  %-8s %-12s at (%.3f %.3f %.3f) fwd(glTF+Z, blender)=(%.2f %.2f %.2f) parent=%s/%s" % (
                o.type, o.name, *w.translation, *f, o.parent.name if o.parent else '-', o.parent_bone or ''))
        if o.type == 'ARMATURE':
            print("  BONES", [(b.name, tuple(round(x, 3) for x in b.head_local)) for b in o.data.bones])
    print("  ANIMS", [(a['name'], len(a['channels'])) for a in G.get('animations', [])])
    for m in G.get('materials', []):
        p = m.get('pbrMetallicRoughness', {})
        print("   mat %-18s metal %.2f rough %.2f tex %s nrm %s" % (m['name'], p.get('metallicFactor', 1), p.get('roughnessFactor', 1),
              'baseColorTexture' in p, 'normalTexture' in m))
    root = bpy.data.objects.new("grp_" + name, None); sc.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    groups[name] = (root, new, mn, mx)

if MODE == 'info':
    sys.exit(0)

# animated: set requested pose
for name in NAMES:
    for o in groups[name][1]:
        if o.type == 'ARMATURE' and o.animation_data is not None and bpy.data.actions:
            pass

# ------------------------------------------------------------------ render setup
try:
    sc.render.engine = 'BLENDER_EEVEE'
except TypeError as e:
    print(e)
sc.eevee.taa_render_samples = 48
w = bpy.data.worlds.new("W"); sc.world = w
w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.42, 0.36, 0.30, 1); bg.inputs[1].default_value = 0.7


def light(name, kind, energy, rot, loc=(0, 0, 3), size=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy
    if size and kind == 'AREA':
        ld.size = size
    lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo)
    lo.rotation_euler = [math.radians(a) for a in rot]; lo.location = loc
    return lo


light("key", 'SUN', 3.2, (45, 0, 60))
light("rim", 'SUN', 1.6, (60, 0, -130))
# backdrop
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
g = bpy.context.active_object
gm = bpy.data.materials.new("ground"); gm.use_nodes = True
gb = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
gb.inputs['Base Color'].default_value = (0.20, 0.15, 0.10, 1); gb.inputs['Roughness'].default_value = 0.9
g.data.materials.append(gm)

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
tgt = bpy.data.objects.new("tgt", None); sc.collection.objects.link(tgt)
con = cam.constraints.new('TRACK_TO'); con.target = tgt; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'


def render(fname, rx, ry):
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.filepath = os.path.join(PREV, fname)
    bpy.ops.render.render(write_still=True)
    print("RENDER", sc.render.filepath)


if MODE == 'lineup':
    # stand every item upright (+Y -> +Z), flats facing the camera on +X... lay them on the floor instead
    x = 0.0
    gap = 0.12
    items = []
    for name in NAMES:
        root, objs, mn, mx = groups[name]
        root.rotation_euler = (math.radians(90), 0, 0)   # grip axis Y -> Z (upright)
        bpy.context.view_layer.update()
        a, b = wbox(objs)
        root.location = (0, x - a.y + 0.0, -a.z + 0.001)
        bpy.context.view_layer.update()
        a, b = wbox(objs)
        x = b.y + gap
        items.append((a, b))
    allmn = Vector(map(min, *[i[0] for i in items])); allmx = Vector(map(max, *[i[1] for i in items]))
    c = (allmn + allmx) / 2
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = max(allmx.y - allmn.y, (allmx.z - allmn.z) * 2.0) * 1.06
    tgt.location = c
    cam.location = c + Vector((4, 0, 0.0))
    g.location.z = 0; g.rotation_euler = (0, 0, 0)
    # vertical backdrop behind
    bpy.ops.mesh.primitive_plane_add(size=30, location=(-0.4, 0, 0), rotation=(0, math.radians(90), 0))
    bpy.context.active_object.data.materials.append(gm)
    render("weapons_lineup.png", 1800, 900)
    # perspective 3/4 version
    cam_d.type = 'PERSP'; cam_d.lens = 50
    cam.location = c + Vector((3.2, -1.6, 1.4))
    render("weapons_lineup_34.png", 1800, 900)
else:
    for name in NAMES:
        for n2, (root, objs, mn, mx) in groups.items():
            root.hide_render = n2 != name
            for o in objs:
                o.hide_render = n2 != name
        root, objs, mn, mx = groups[name]
        # lift above floor
        root.location = (0, 0, -mn.z + 0.3)
        bpy.context.view_layer.update()
        a, b = wbox(objs)
        c = (a + b) / 2
        L = (b - a).length
        cam_d.type = 'ORTHO'; cam_d.ortho_scale = max(b.y - a.y, (b.z - a.z) * 1.5) * 1.08
        tgt.location = c
        cam.location = c + Vector((3.0, 0.0, 0.0))
        render(name + "_side.png", 1200, 800)
        cam.location = c + Vector((-3.0, 0.0, 0.0))
        render(name + "_side2.png", 1200, 800)
        cam_d.type = 'PERSP'; cam_d.lens = 60
        cam.location = c + Vector((0.9, -0.6, 0.7)).normalized() * L * 1.5
        render(name + "_34.png", 1200, 800)
        # close-ups at the head (top 30 %) and grip (origin)
        org = root.matrix_world.translation
        tgt.location = Vector((c.x, b.y - (b.y - a.y) * 0.18, c.z)) if (b.y - a.y) > (b.z - a.z) else c
        cam_d.lens = 85
        cam.location = tgt.location + Vector((0.8, -0.4, 0.45)).normalized() * max(0.35, L * 0.42)
        render(name + "_head.png", 1000, 750)
        tgt.location = org
        cam.location = org + Vector((0.7, 0.5, 0.45)).normalized() * max(0.35, L * 0.38)
        render(name + "_grip.png", 1000, 750)
