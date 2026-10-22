"""Blender -b --factory-startup --python closeup.py -- out.png tx ty tz dx dy dz dist   (Blender coords)
Close-up render of models/vehicles/tank.glb."""
import bpy, math, sys, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.import_scene.gltf(filepath=os.path.join(here, "..", "..", "..", "models", "vehicles", "tank.glb"))
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.55, 0.6, 0.66, 1)
ld = bpy.data.lights.new("k", 'SUN'); ld.energy = 3.5
lo = bpy.data.objects.new("k", ld); sc.collection.objects.link(lo); lo.rotation_euler = (math.radians(50), 0, math.radians(70))
cd = bpy.data.cameras.new("c"); cd.lens = 50
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
T = Vector(tuple(map(float, a[1:4]))); D = Vector(tuple(map(float, a[4:7]))).normalized()
cam.location = T + D * float(a[7]); cam.rotation_euler = (-D).to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 800, 600
sc.render.filepath = a[0]
bpy.ops.render.render(write_still=True)
