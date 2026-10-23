# Import exported GLBs and render previews (EEVEE, soft 3-point light).
# Blender -b --factory-startup --python preview.py -- shot1 shot2 ...
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import render_util as RU

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
PREV = os.environ.get("NPC_PREV") or "/Users/sang/.claude/jobs/02a78233/tmp/npc_real/previews"
os.makedirs(PREV, exist_ok=True)
ALL10 = ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk", "maid", "baker", "noble", "herbalist"]

def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def load_list(names, stools=False, action=None, frame=0, spacing=1.0, rot_z=0.0):
    off = (len(names) - 1) / 2
    for i, n in enumerate(names):
        before_acts = set(bpy.data.actions)
        objs = imp(os.path.join(os.environ.get("NPC_OUT") or os.path.join(REPO, "models", "npc"), f"npc-{n}.glb"))
        new_acts = [a for a in bpy.data.actions if a not in before_acts]
        arm = next(o for o in objs if o.type == 'ARMATURE')
        root = arm
        while root.parent: root = root.parent
        root.location.x = (i - off) * spacing
        root.rotation_euler.z += rot_z
        arm.animation_data_create()
        if action:
            a = next(x for x in new_acts if x.name.split('.')[0] == action)
            arm.animation_data.action = a
            if a.slots: arm.animation_data.action_slot = a.slots[0]
        else:
            arm.animation_data.action = None
            for pb in arm.pose.bones:
                pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
        if stools:
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.17, depth=0.42, location=((i - off) * spacing, 0.0, 0.21))
            s = bpy.context.object
            m = bpy.data.materials.get("stool") or bpy.data.materials.new("stool")
            b = next(nd for nd in m.node_tree.nodes if nd.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (0.18, 0.10, 0.05, 1)
            s.data.materials.append(m)
    RU.fix_imported_vcol()
    bpy.context.scene.frame_set(frame)

W10 = (5.2, -11.0, 2.4)
shots = {
    "lineup10_front34": (ALL10, None, 0, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800)),
    "lineup10_back34": (ALL10, None, 0, False, 0.9, (-5.2, 11.0, 2.4), (-0.4, 0, 0.85), 40, (2000, 800)),
    "faces_f": (["maid", "noble", "baker", "herbalist"], None, 0, False, 0.36, (0.05, -1.25, 1.68), (0, 0, 1.66), 60, (1600, 600)),
    "faces_m": (["traveler", "blacksmith", "bard", "monk"], None, 0, False, 0.36, (0.05, -1.25, 1.68), (0, 0, 1.66), 60, (1600, 600)),
    "faces_close": (["innkeeper", "maid", "guard"], None, 0, False, 0.42, (0.25, -1.55, 1.70), (0, 0, 1.62), 60, (1600, 800)),
    "walk_f6": (ALL10, "Walk", 6, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800)),
    "sit": (ALL10, "Sit", 0, True, 0.9, W10, (0.4, 0, 0.6), 40, (2000, 800)),
    "drink_f40": (ALL10, "Drink", 40, True, 0.9, W10, (0.4, 0, 0.75), 40, (2000, 800)),
    "cheers_f14": (ALL10, "Cheers", 14, True, 0.9, W10, (0.4, 0, 0.8), 40, (2000, 800)),
    "struggle_f6": (ALL10, "Struggle", 6, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800)),
    "getup_f0": (ALL10, "GetUp", 0, False, 0.9, (5.5, -10.0, 4.5), (0.4, 0.8, 0.2), 40, (2000, 800)),
    "getup_f18": (ALL10, "GetUp", 18, False, 0.9, W10, (0.4, 0, 0.6), 40, (2000, 800)),
    "fall_f11": (ALL10, "Fall", 11, False, 0.9, W10, (0.4, 0.3, 0.6), 40, (2000, 800)),
    "stomp_f5": (ALL10, "Stomp", 5, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800)),
    "run_f4": (ALL10, "Run", 4, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800)),
    "side_walk": (["traveler", "noble", "monk"], "Walk", 6, False, 0.9, (4.5, -0.2, 1.1), (0, 0, 0.9), 40, (1600, 900)),
    "side_drink": (["innkeeper", "maid", "guard"], "Drink", 40, True, 0.9, (3.2, -1.2, 1.3), (0, -0.1, 0.9), 40, (1600, 900)),
    "side_getup0": (["innkeeper", "noble"], "GetUp", 0, False, 0.9, (3.5, 0.8, 0.8), (0, 0.8, 0.15), 40, (1600, 900)),
}
only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(shots)
for name in only:
    names, act, fr, st, sp, loc, tgt, lens, res = shots[name]
    sc = RU.setup_scene(res)
    load_list(names, stools=st, action=act, frame=fr, spacing=sp)
    RU.cam(sc, loc, tgt, lens)
    RU.render(os.path.join(PREV, name + ".png"))
