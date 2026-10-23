import bpy, os, math, sys
from mathutils import Vector

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
NAMES = ["innkeeper", "traveler", "guard", "maid", "blacksmith", "bard", "monk", "baker", "noble", "herbalist"]
PREV = "/Users/sang/.claude/jobs/02a78233/tmp/npc/previews"
os.makedirs(PREV, exist_ok=True)

def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def world_verts(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg)
    m = e.to_mesh()
    vs = [e.matrix_world @ v.co for v in m.vertices]
    e.to_mesh_clear()
    return vs

# ---------------------------------------------------------------- stats (fresh scene per file)
for n in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    p = os.path.join(REPO, "models", "npc", f"npc-{n}.glb")
    objs = imp(p)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    meshes = [o for o in objs if o.type == 'MESH' and o.parent is not None]
    tris = sum(sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in meshes)
    if arm.animation_data: arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    vs = [v for o in meshes for v in world_verts(o)]
    zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
    # forward: foot verts (z<0.1) extend toward toes
    feet = [v for v in vs if v.z < 0.08]
    fy = (min(v.y for v in feet), max(v.y for v in feet))
    fwd = "-Y (Blender) => +Z glTF" if -fy[0] > fy[1] else "+Y (Blender) => -Z glTF"
    xs = (min(v.x for v in vs), max(v.x for v in vs))
    print(f"STAT {n}: size={os.path.getsize(p)}B objects={[o.name + ':' + o.type for o in objs if o.name != 'Icosphere']}")
    print(f"STAT {n}: bones={len(arm.data.bones)} {[b.name for b in arm.data.bones]}")
    print(f"STAT {n}: actions={[a.name for a in bpy.data.actions]} ranges={[tuple(a.frame_range) for a in bpy.data.actions]}")
    print(f"STAT {n}: tris={tris} bbox z=[{zmin:.3f},{zmax:.3f}] height={zmax - zmin:.3f} x=[{xs[0]:.2f},{xs[1]:.2f}] feet y=[{fy[0]:.3f},{fy[1]:.3f}] forward={fwd}")
    # per-action checks: min z (floor contact), mug & hand positions
    for a in bpy.data.actions:
        arm.animation_data.action = a
        if a.slots: arm.animation_data.action_slot = a.slots[0]
        f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
        mins = []
        for f in range(f0, f1 + 1, 2):
            bpy.context.scene.frame_set(f)
            vv = [v for o in meshes for v in world_verts(o)]
            mins.append(min(v.z for v in vv))
        bpy.context.scene.frame_set(f0)
        pr = arm.pose.bones["Prop.R"]; hd = arm.pose.bones["Head"]
        mug = arm.matrix_world @ pr.head; head = arm.matrix_world @ hd.head
        hips = arm.matrix_world @ arm.pose.bones["Hips"].head
        print(f"  ACT {a.name}: frames {f0}-{f1} minZ range [{min(mins):.3f},{max(mins):.3f}] hips@f0 z={hips.z:.3f} mug@f0={tuple(round(c,3) for c in mug)} scale={pr.scale[0]:.3f}")
        if a.name == "Drink":
            bpy.context.scene.frame_set(40)
            mug = arm.matrix_world @ pr.head; hz = arm.matrix_world @ hd.head
            print(f"  Drink f40 mug center={tuple(round(c,3) for c in mug)} head-bone base={tuple(round(c,3) for c in hz)} (mouth ~ +0.09 z, -0.11 y)")
        if a.name == "Cheers":
            bpy.context.scene.frame_set(14)
            mug = arm.matrix_world @ pr.head
            print(f"  Cheers f14 mug center={tuple(round(c,3) for c in mug)}")

# ---------------------------------------------------------------- renders
def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = False
    sc.render.resolution_x = 1280; sc.render.resolution_y = 720
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("W"); sc.world.color = (0.15, 0.12, 0.10)
    bpy.ops.mesh.primitive_plane_add(size=20)
    fl = bpy.context.object
    m = bpy.data.materials.new("floor"); m.diffuse_color = (0.30, 0.26, 0.22, 1); fl.data.materials.append(m)
    return sc

def load_all(stools=False, action=None, frame=0, spacing=1.0):
    arms = []
    for i, n in enumerate(NAMES):
        objs = imp(os.path.join(REPO, "models", "npc", f"npc-{n}.glb"))
        arm = next(o for o in objs if o.type == 'ARMATURE')
        root = arm
        while root.parent: root = root.parent
        root.location.x = (i - 1.5) * spacing
        if action:
            a = bpy.data.actions.get(action) or next(x for x in bpy.data.actions if x.name.startswith(action) and x.name not in [y.name for y in []])
            # imported duplicates get suffixes; find the one for this import (last created matching)
            cands = [x for x in bpy.data.actions if x.name.split('.')[0] == action]
            a = cands[-1]
            arm.animation_data_create(); arm.animation_data.action = a
            if a.slots: arm.animation_data.action_slot = a.slots[0]
        arms.append(arm)
        if stools:
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.17, depth=0.42, location=((i - 1.5) * spacing, 0.0, 0.21))
            s = bpy.context.object
            m = bpy.data.materials.get("stool") or bpy.data.materials.new("stool"); m.diffuse_color = (0.25, 0.15, 0.08, 1)
            s.data.materials.append(m)
    bpy.context.scene.frame_set(frame)
    return arms

def cam(sc, loc, target, lens=40):
    cd = bpy.data.cameras.new("C"); cd.lens = lens
    c = bpy.data.objects.new("C", cd); sc.collection.objects.link(c)
    c.location = loc
    d = Vector(target) - Vector(loc)
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = c
    return c

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)

NEW6 = ["blacksmith", "bard", "monk", "baker", "noble", "herbalist"]
ALL10 = ["innkeeper", "traveler", "guard", "blacksmith", "bard", "monk", "maid", "baker", "noble", "herbalist"]
def load_list(names, stools=False, action=None, frame=0, spacing=1.0):
    off = (len(names) - 1) / 2
    for i, n in enumerate(names):
        objs = imp(os.path.join(REPO, "models", "npc", f"npc-{n}.glb"))
        arm = next(o for o in objs if o.type == 'ARMATURE')
        root = arm
        while root.parent: root = root.parent
        root.location.x = (i - off) * spacing
        if action:
            cands = [x for x in bpy.data.actions if x.name.split('.')[0] == action]
            a = cands[-1]
            arm.animation_data_create(); arm.animation_data.action = a
            if a.slots: arm.animation_data.action_slot = a.slots[0]
        if stools:
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.17, depth=0.42, location=((i - off) * spacing, 0.0, 0.21))
            s = bpy.context.object
            m = bpy.data.materials.get("stool") or bpy.data.materials.new("stool"); m.diffuse_color = (0.25, 0.15, 0.08, 1)
            s.data.materials.append(m)
    bpy.context.scene.frame_set(frame)

shots = [
    ("lineup10_front34", ALL10, "Idle", 0, False, 0.85, (3.4, -10.2, 2.8), (0.3, 0, 0.8)),
    ("new6_lineup_front34", NEW6, "Idle", 0, False, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.9)),
    ("new6_back34", NEW6, "Idle", 0, False, 1.0, (-3.6, 5.2, 2.0), (0, 0, 0.9)),
    ("new6_walk_f6_front34", NEW6, "Walk", 6, False, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.9)),
    ("new6_walk_f18_front34", NEW6, "Walk", 18, False, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.9)),
    ("new6_sit_front34", NEW6, "Sit", 0, True, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.6)),
    ("new6_drink_f40_front34", NEW6, "Drink", 40, True, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.8)),
    ("new6_cheers_f14_front34", NEW6, "Cheers", 14, True, 1.0, (3.6, -5.2, 2.0), (0, 0, 0.8)),
    ("monk_sit_side", ["monk"], "Sit", 0, True, 1.0, (2.4, -0.3, 0.8), (0, -0.2, 0.6)),
    ("noble_walk_side", ["noble"], "Walk", 6, False, 1.0, (2.8, 0, 1.0), (0, 0, 0.9)),
    ("herbalist_sit_side", ["herbalist"], "Sit", 0, True, 1.0, (2.4, -0.6, 0.9), (0, -0.2, 0.6)),
    ("bard_drink_side", ["bard"], "Drink", 40, True, 1.0, (2.4, -0.3, 1.1), (0, -0.2, 0.9)),
]
only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for name, names, act, fr, st, sp, loc, tgt in shots:
    if only and name not in only: continue
    sc = setup_scene()
    load_list(names, stools=st, action=act, frame=fr, spacing=sp)
    cam(sc, loc, tgt, 40)
    render(os.path.join(PREV, name + ".png"))
