# Preview renders for the village children.
# Blender -b --factory-startup --python preview_kids.py -- lineup faces run wave walk back
#   env NPC_OUT : folder with npc-kid-*.glb (default repo models/npc); adults always from models/npc
#   env NPC_PREV: output folder
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "npc_polish"))
import bpy
import render_util as RU

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ADULT = os.path.join(REPO, "models", "npc")
SRC = os.environ.get("NPC_OUT") or ADULT
PREV = os.environ.get("NPC_PREV") or "/Users/sang/.claude/jobs/02a78233/tmp/kids"
os.makedirs(PREV, exist_ok=True)
KIDS = ["kid-tom", "kid-finn", "kid-ella", "kid-mina"]

def imp(path):
    before = set(bpy.data.objects); ba = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before], [a for a in bpy.data.actions if a not in ba]

def load(names, action=None, frame=0, spacing=0.7):
    off = (len(names) - 1) / 2
    for i, n in enumerate(names):
        p = os.path.join(SRC if n.startswith("kid") else ADULT, f"npc-{n}.glb")
        objs, acts = imp(p)
        arm = next(o for o in objs if o.type == 'ARMATURE')
        root = arm
        while root.parent: root = root.parent
        root.location.x = (i - off) * spacing
        arm.animation_data_create()
        if action:
            a = next((x for x in acts if x.name.split('.')[0] == action), None)
            arm.animation_data.action = a
            if a and a.slots: arm.animation_data.action_slot = a.slots[0]
        else:
            arm.animation_data.action = None
            for pb in arm.pose.bones:
                pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    RU.fix_imported_vcol()
    bpy.context.scene.frame_set(frame)

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["lineup"]
for shot in args:
    if shot == "lineup":
        sc = RU.setup_scene((1800, 900)); load(["maid"] + KIDS + ["guard"], None, 0, 0.75)
        RU.cam(sc, (1.6, -6.5, 1.3), (0, 0, 0.85), 40)
    elif shot in ("run", "walk", "wave", "idle", "cheers", "stomp", "fall", "sit"):
        fr = {"run": 4, "walk": 6, "wave": 9, "idle": 20, "cheers": 14, "stomp": 5, "fall": 19, "sit": 0}[shot]
        sc = RU.setup_scene((1600, 800)); load(KIDS, shot.capitalize(), fr, 0.8)
        RU.cam(sc, (1.6, -5.0, 1.2), (0, 0, 0.65), 40)
    elif shot == "back":
        sc = RU.setup_scene((1600, 800)); load(KIDS, None, 0, 0.8)
        RU.cam(sc, (-1.6, 5.0, 1.2), (0, 0, 0.65), 40)
    elif shot == "faces":
        sc = RU.setup_scene((1600, 480)); load(KIDS, None, 0, 0.40)
        c = RU.cam(sc, (0.0, -3.0, 1.10), (0, 0, 1.08), 50)
        c.data.type = 'ORTHO'; c.data.ortho_scale = 1.6
    elif shot.startswith("face:"):
        n = shot.split(":")[1]
        sc = RU.setup_scene((900, 900)); load(["kid-" + n], None, 0)
        RU.cam(sc, (0.30, -1.0, 1.15), (0, -0.02, 1.08), 60)
    else:
        print("unknown", shot); continue
    RU.render(os.path.join(PREV, shot.replace(":", "_") + ".png"))
