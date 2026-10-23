# Render the hands with the finger bones curled like weapons.js grip() (Index/Middle/Ring/Pinky 2-4: 62/88/58 deg,
# Thumb1 25, Thumb2-3 35). Blender -b --factory-startup --python grip_test.py -- in.glb out.png
import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "npc_real"))
import bpy
from mathutils import Vector, Quaternion
import render_util as RU
a = sys.argv[sys.argv.index("--") + 1:]
sc = RU.setup_scene((1400, 700))
bpy.ops.import_scene.gltf(filepath=a[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data.action = None
for o in bpy.data.objects:
    if o.type == 'MESH' and not o.parent: o.hide_render = True
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0)
curl = float(os.environ.get("CURL", "1"))
for s in ("L", "R"):
    for f in ("Index", "Middle", "Ring", "Pinky"):
        for j, ang in zip((2, 3, 4), (62, 88, 58)):
            pb = arm.pose.bones[f"{f}{j}.{s}"]
            pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), math.radians(ang * curl * (1 if s == "L" else 1)))
    for j, ang in ((1, 25), (2, 35), (3, 35)):
        arm.pose.bones[f"Thumb{j}.{s}"].rotation_quaternion = Quaternion(Vector((1, 0, 0)), math.radians(ang * curl))
bpy.context.view_layer.update()
RU.cam(sc, (-0.62, -0.55, 1.62), (-0.66, -0.08, 1.43), 60)
RU.render(a[1].replace(".png", "_R.png"))
RU.cam(sc, (-0.66, -0.20, 1.05), (-0.66, -0.08, 1.43), 60)
RU.render(a[1].replace(".png", "_Rbelow.png"))
