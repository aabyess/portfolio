"""Blender -b --python shot.py -- name out.png tx ty tz dx dy dz dist [lens] [frame]
Close-up of an exported GLB at target (Blender coords, model space) seen from direction d."""
import sys, os, math
import bpy
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
name, out = a[0], a[1]
T = Vector(tuple(map(float, a[2:5]))); D = Vector(tuple(map(float, a[5:8]))).normalized(); dist = float(a[8])
lens = float(a[9]) if len(a) > 9 else 70
frame = int(a[10]) if len(a) > 10 else None
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, "models", "weapons", name + ".glb"))
if frame is not None:
    sc.frame_set(frame)
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 48
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.42, 0.36, 0.30, 1); bg.inputs[1].default_value = 0.7
for nm, en, rot in (("key", 3.2, (45, 0, 60)), ("rim", 1.6, (60, 0, -130)), ("fill", 1.0, (120, 0, 200))):
    ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en
    lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo)
    lo.rotation_euler = [math.radians(x) for x in rot]
cd = bpy.data.cameras.new("c"); cd.lens = lens; cd.clip_start = 0.005
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = T + D * dist
cam.rotation_euler = (-D).to_track_quat('-Z', 'Z' if abs(D.z) < 0.95 else 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 1000, 750
sc.render.filepath = os.path.join("/Users/sang/.claude/jobs/02a78233/tmp/weapons/previews", out)
bpy.ops.render.render(write_still=True)
