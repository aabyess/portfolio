"""Joint world positions of person.glb at rest and in a few clip frames; torso cross-section widths of the original body."""
import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
R = lambda v: tuple(round(x, 3) for x in v)
for e in bpy.data.objects:
    if e.type == 'EMPTY' and e.name.endswith('_end'):
        print("END", e.name, e.parent_type, e.parent_bone, R(e.matrix_world.to_translation()))
JOINTS = ['Shoulder.R', 'UpperArm.R', 'LowerArm.R', 'Wrist.R', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R', 'Hips', 'Chest', 'Head']
def dump(tag):
    bpy.context.view_layer.update()
    print(tag, {j: R(arm.matrix_world @ arm.pose.bones[j].head) for j in JOINTS})
arm.animation_data.action = None
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
dump("REST")
for an, fr in (("Idle", 0), ("Walk", 8), ("Walk", 24), ("Run", 5), ("Idle_Sword", 0)):
    a = bpy.data.actions["CharacterArmature|" + an]
    arm.animation_data.action = a
    if a.slots: arm.animation_data.action_slot = a.slots[0]
    bpy.context.scene.frame_set(fr)
    dump(f"{an}@{fr}")
body = bpy.data.objects['Casual2_Body']
vs = [body.matrix_world @ v.co for v in body.data.vertices]
for z in (0.95, 1.05, 1.15, 1.25, 1.35, 1.42, 1.5):
    sl = [v for v in vs if abs(v.z - z) < 0.012 and abs(v.x) < 0.2]
    if sl: print("BODY z", z, "x", round(max(abs(v.x) for v in sl), 3), "y", round(min(v.y for v in sl), 3), round(max(v.y for v in sl), 3))
legs = bpy.data.objects['Casual2_Legs']
vs = [legs.matrix_world @ v.co for v in legs.data.vertices]
for z in (0.2, 0.4, 0.6, 0.8, 0.95):
    sl = [v for v in vs if abs(v.z - z) < 0.012 and v.x < 0]
    if sl: print("LEG z", z, "x", round(min(v.x for v in sl), 3), round(max(v.x for v in sl), 3), "y", round(min(v.y for v in sl), 3), round(max(v.y for v in sl), 3))
