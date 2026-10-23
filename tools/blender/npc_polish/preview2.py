# Preview renders for the NPC polish pass (v5).  Warm "sunset" light option, flexible shots.
# Blender -b --factory-startup --python preview2.py -- shot1 shot2 ...
#   env NPC_OUT  : folder with npc-<name>.glb (default repo models/npc)
#   env NPC_PREV : output folder
#   env NAMES    : space separated subset for the lineup shots (default all 10)
# shots: lineup, lineup_sunset, faces, faces_f, faces_m, walk, sit, fall, run, back, far,
#        face:<name>, hands:<name>
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "npc_real"))
import bpy
from mathutils import Vector
import render_util as RU

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.environ.get("NPC_OUT") or os.path.join(REPO, "models", "npc")
PREV = os.environ.get("NPC_PREV") or "/Users/sang/.claude/jobs/02a78233/tmp/npc_polish/prev"
os.makedirs(PREV, exist_ok=True)
ALL10 = ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk", "maid", "baker", "noble", "herbalist"]
NAMES = os.environ.get("NAMES", "").split() or ALL10

def imp(path):
    before = set(bpy.data.objects); ba = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before], [a for a in bpy.data.actions if a not in ba]

def load(names, action=None, frame=0, spacing=0.9, stools=False, rot=0.0):
    off = (len(names) - 1) / 2
    for i, n in enumerate(names):
        p = os.path.join(SRC, f"npc-{n}.glb")
        if not os.path.exists(p): continue
        objs, acts = imp(p)
        arm = next(o for o in objs if o.type == 'ARMATURE')
        root = arm
        while root.parent: root = root.parent
        root.location.x = (i - off) * spacing
        root.rotation_euler.z += rot
        arm.animation_data_create()
        if action:
            a = next(x for x in acts if x.name.split('.')[0] == action)
            arm.animation_data.action = a
            if a.slots: arm.animation_data.action_slot = a.slots[0]
        else:
            arm.animation_data.action = None
            for pb in arm.pose.bones:
                pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
        if stools:
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.17, depth=0.42, location=((i - off) * spacing, 0.0, 0.21))
    RU.fix_imported_vcol()
    bpy.context.scene.frame_set(frame)

def sunset(sc):
    """Low warm key + cool sky fill, like the game at sunset."""
    for o in list(sc.objects):
        if o.type == 'LIGHT': bpy.data.objects.remove(o)
    sun = bpy.data.lights.new("Sun", 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.72, 0.45); sun.angle = 0.05
    so = bpy.data.objects.new("Sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(72), 0, math.radians(35))
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.45, 0.42, 0.50, 1); bg.inputs[1].default_value = 0.9

W10 = (5.2, -11.0, 2.4)
SHOTS = {
    "lineup": (None, 0, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), False),
    "lineup_sunset": (None, 0, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), True),
    "far": (None, 0, False, 1.2, (4.0, -14.0, 1.8), (0, 0, 0.9), 50, (1400, 500), True),
    "back": (None, 0, False, 0.9, (-5.2, 11.0, 2.4), (-0.4, 0, 0.85), 40, (2000, 800), False),
    "walk": ("Walk", 6, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), False),
    "run": ("Run", 4, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), False),
    "sit": ("Sit", 0, True, 0.9, W10, (0.4, 0, 0.6), 40, (2000, 800), False),
    "drink": ("Drink", 40, True, 0.9, W10, (0.4, 0, 0.75), 40, (2000, 800), False),
    "fall": ("Fall", 11, False, 0.9, W10, (0.4, 0.3, 0.6), 40, (2000, 800), False),
    "getup0": ("GetUp", 0, False, 0.9, (5.5, -10.0, 4.5), (0.4, 0.8, 0.2), 40, (2000, 800), False),
    "struggle": ("Struggle", 6, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), False),
    "stomp": ("Stomp", 5, False, 0.9, W10, (0.4, 0, 0.85), 40, (2000, 800), False),
}
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["lineup"]
for shot in args:
    if shot in SHOTS:
        act, fr, st, sp, loc, tgt, lens, res, warm = SHOTS[shot]
        sc = RU.setup_scene(res)
        if warm: sunset(sc)
        load(NAMES, act, fr, sp, st)
        RU.cam(sc, loc, tgt, lens)
    elif shot in ("faces", "faces_f", "faces_m"):
        nm = {"faces": NAMES, "faces_f": ["maid", "baker", "noble", "herbalist"],
              "faces_m": ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk"]}[shot]
        sc = RU.setup_scene((300 * len(nm), 420))
        load(nm, None, 0, 0.30)
        w = 0.30 * len(nm)
        c = RU.cam(sc, (0.0, -3.0, 1.66), (0, 0, 1.64), 50)
        c.data.type = 'ORTHO'; c.data.ortho_scale = w
    elif shot.startswith("face:"):
        n = shot.split(":")[1]
        sc = RU.setup_scene((1000, 1000))
        load([n], None, 0)
        RU.cam(sc, (0.30, -0.95, 1.70), (0, -0.02, 1.65), 60)
    elif shot.startswith("profile:"):
        n = shot.split(":")[1]
        sc = RU.setup_scene((800, 800))
        load([n], None, 0)
        RU.cam(sc, (1.0, -0.12, 1.66), (0, -0.02, 1.64), 70)
    elif shot.startswith("hands:"):
        n = shot.split(":")[1]
        sc = RU.setup_scene((1000, 1000))
        load([n], None, 0)
        RU.cam(sc, (0.6, -0.9, 0.95), (0.18, 0, 0.88), 60)
    elif shot.startswith("body:"):
        n = shot.split(":")[1]
        sc = RU.setup_scene((800, 1100))
        load([n], None, 0)
        RU.cam(sc, (1.3, -3.4, 1.3), (0, 0, 0.92), 50)
    else:
        print("unknown shot", shot); continue
    RU.render(os.path.join(PREV, shot.replace(":", "_") + ".png"))
