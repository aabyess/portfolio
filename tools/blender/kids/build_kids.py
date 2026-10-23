# Village children (npc-kid-*.glb) on the v5 villager toolkit (tools/blender/npc_polish).
# Same 18 bone NAMES and the same 10 clips as the adults + an extra "Wave" clip (11 clips).
# Run: Blender -b --factory-startup --python build_kids.py -- [tom] [finn] [ella] [mina] [--noexport]
#   env NPC_OUT=<dir> writes GLBs there instead of models/npc (and skips the .blend save)
#
# How a child is made from the adult toolkit
#   1. Geometry is built in adult (1.8 m) coordinates with child faces: big eyes, tiny nose, short lower
#      face, round cheeks, no stubble/age, slim shoulders.
#   2. Bake (UVs + 1024 albedo/normal) runs on the adult-space mesh, so the face UV logic still works.
#   3. After the bake the rest mesh is remapped (UVs/texture untouched):
#        - head x HEAD about the neck/head joint (bigger head ratio),
#        - everything below the hip joint compressed by LEG (shorter legs); upper body/arms shifted down.
#      The skeleton gets the same leg remap (bone names unchanged).
#   4. The armature object gets a uniform scale (per kid) -> 1.18..1.32 m. glTF keeps it on the root node.
# Known limit: Sit/Drink/Cheers keep the adult hips drop (0.42 model units) so a seated kid sinks a bit;
# the game only uses Idle/Walk/Run/Wave/Cheers(standing waves use Wave).
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "npc_polish"))
import bpy
from mathutils import Vector
import lib_real
from lib_real import *
from body_real import *
from body2 import *
from build_polish import PAL, C_cloth, cut, cuff, neck_trim, neck_mix, hair_cap, C_skin_arm

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOEXPORT = "--noexport" in ARGS
ONLY = [a for a in ARGS if not a.startswith("--")]

HEAD = 1.36           # head enlargement about J
J = Vector((0, 0, 1.545))
SINK = 0.045          # head sinks onto a shorter neck
HIP = 0.93            # hip joint height (adult units)
LEG = 0.86            # leg length factor
D = HIP * (1 - LEG)   # upper body drop

def leg_map(z, arm=False):
    if arm or z >= HIP: return z - D
    return z * LEG

# skeleton with shorter legs (same names / parents)
_adult_skel = lib_real.skeleton
def kid_skeleton():
    b = _adult_skel(); out = {}
    for n, (h, t, p) in b.items():
        arm = n.startswith(("UpperArm", "LowerArm", "Hand", "Prop"))
        out[n] = ((h[0], h[1], leg_map(h[2], arm)), (t[0], t[1], leg_map(t[2], arm)), p)
    return out
lib_real.skeleton = kid_skeleton

# ---------------------------------------------------------------- Wave clip (standing, right hand waving high)
def act_wave(A):
    P = 36
    for f in range(0, P + 1, 1):
        w = 2 * math.pi * f / P
        wag = math.sin(2 * w)        # two waves per loop
        hop = max(0.0, math.sin(w)) ** 2
        r = {"Hips": (0, 0, 2 * math.sin(w)), "Spine": (-2, 0, 3 * math.sin(w)), "Chest": (-3, 0, 2), "Neck": (0, 0, 0),
             "Head": (-4, 0, 6 * math.sin(w + 0.4)),
             "UpperArm.R": (-158, -12, 0), "LowerArm.R": (-12, 32 * wag, 0), "Hand.R": (0, 14 * wag, 0),
             "UpperArm.L": (6, 0, 8), "LowerArm.L": (-14, 0, 0),
             "UpperLeg.L": (-4 * hop, 0, 2), "UpperLeg.R": (-4 * hop, 0, -2),
             "LowerLeg.L": (8 * hop, 0, 0), "LowerLeg.R": (8 * hop, 0, 0)}
        A.pose(r, hips_loc=(0, 0, 0.012 * hop - 0.004), prop_scale=0.0); A.key(f)
    return P
if not any(n == "Wave" for n, _ in lib_real.ACTIONS):
    lib_real.ACTIONS.append(("Wave", act_wave))

# ---------------------------------------------------------------- shared kid bits
KIDFACE = dict(age=0.0, jaw=0.88, chin=0.90, cheek=1.12, eye_scale=1.48, nose=0.68, nose_len=0.72, mouth_w=1.0, smile=1.0,
               muzzle=0.80, jawline=0.5, lips=0.92, blush=0.75, head_tris=4300, hair_tris=1300, broad=0.96,
               face_scale=(1.04, 0.97, 0.96))

def shorten_lower_face(parts, f=0.86, z0=1.645, z1=1.555, zn=1.50):
    d1 = (z0 - z1) * (1 - f); a = d1 / (z1 - zn)
    def T(v):
        z = v[2]
        if z >= z0: return Vector(v)
        if z >= z1: z = f * z + (1 - f) * z0
        elif z >= zn: z = z * (1 + a) - zn * a
        return Vector((v[0], v[1], z))
    def Tinv(p):
        z = p.z
        if z >= z0: return p
        if z >= z1 + d1: z = (z - (1 - f) * z0) / f
        elif z >= zn: z = (z + zn * a) / (1 + a)
        return Vector((p.x, p.y, z))
    for pt in parts:
        pt.verts = [T(v) for v in pt.verts]
        pt.color = (lambda c: (lambda p, n: c(Tinv(p), n)))(pt.color)
    return parts

def cute_eyes(parts, o):
    """Bigger iris, dark pupil and a white catchlight on finer eye spheres (vertex colours are baked)."""
    iris = o.get("iris", (0.12, 0.06, 0.025))
    out = []
    for pt in parts:
        if pt.name != "eye": out.append(pt); continue
        vs = [Vector(v) for v in pt.verts]
        ctr = sum(vs, Vector()) / len(vs); er = max((v - ctr).length for v in vs)
        k = 1 if ctr.x > 0 else -1
        fwd = Vector((0.05 * k, -1, -0.02)).normalized()
        hl = Vector((-0.30, -1, 0.42)).normalized()
        def col(p, n, ctr=ctr, fwd=fwd, hl=hl):
            d = (p - ctr).normalized()
            if d.dot(hl) > 0.975: return (0.95, 0.95, 0.95)
            f = d.dot(fwd)
            if f > 0.93: return (0.01, 0.008, 0.008)
            if f > 0.66: return mix(mul(iris, 1.25), mul(iris, 0.40), (f - 0.66) / 0.27)
            return (0.70, 0.67, 0.64)
        out.append(Part(sphere(ctr, (er, er, er), 22, 16), "Eye", col, W_head, subsurf=0, name="eye"))
    return out

def flatten_mouth(parts, amt=0.004):
    """Pull the lips/muzzle back a little (the toolkit face has a pout that reads adult/odd on kids)."""
    def off(v):
        if v[1] > -0.055: return 0.0
        g = math.exp(-((v[0] / 0.030) ** 2) - ((v[2] - 1.607) / 0.018) ** 2)
        return amt * g * sstep(-0.055, -0.080, v[1])
    for pt in parts:
        pt.verts = [Vector((v[0], v[1] + off(v), v[2])) for v in pt.verts]
        pt.color = (lambda c: (lambda p, n: c(Vector((p.x, p.y - off(p), p.z)), n)))(pt.color)
    return parts

def tunic(o, col, hem=0.70, trim=None):
    """Short flared tunic skirt from the waist to mid-thigh (+ optional hem trim colour)."""
    zs = [1.05, 0.96, 0.86, 0.77, hem]
    gr = [0.010, 0.026, 0.040, 0.050, 0.056]
    def c(p, n):
        base = trim if (trim and p.z < hem + 0.025) else col
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in base)
    return Part(skirt_geo(o, zs, gr, n=24, nf=7, amp=0.022), "Cloth", c, legblend3(0.97, 0.74, 0.58, 0.42, xw=0.14), subsurf=1, solidify=0.005, name="tunic")

def dress_skirt(o, col, hem=0.34, trim=None):
    zs = [1.06, 0.95, 0.80, 0.62, 0.46, hem]
    gr = [0.010, 0.032, 0.058, 0.082, 0.098, 0.104]
    def c(p, n):
        base = trim if (trim and p.z < hem + 0.03) else col
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in base)
    return Part(skirt_geo(o, zs, gr, n=26, nf=8, amp=0.03), "Cloth", c, legblend3(0.97, 0.74, 0.58, 0.40, xw=0.14), subsurf=1, solidify=0.006, name="skirt"), zs, gr

def trim_budget(P):
    for p in P:
        if p.name == "hand": p.decimate = 700
        if p.name == "shoe": p.decimate = 260 if (p.decimate or 0) < 400 else 380

def braid(pts, radii, col, wfn):
    bb = lambda i: (lambda a: 1 + 0.13 * math.sin(3 * a + i * 2.1))
    return Part(tube(pts, radii, n=8, bump=bb), "Hair", C_var(col, 0.12, 50), wfn, subsurf=1, name="braid")

# ================================================================ Tom: blond boy, brick-red tunic, felt cap
def tom():
    skin = (0.76, 0.55, 0.42)
    o = dict(KIDFACE, skin=skin, iris=(0.10, 0.20, 0.34), brow_col=(0.45, 0.32, 0.14), brow_thick=0.9)
    hair = hair_cap(0.006, front_z=1.655, front_y=-0.094)
    for x, z in ((0.0, 1.712), (0.036, 1.708), (-0.040, 1.706)):   # messy fringe tufts under the cap brim
        hair.add('ell', (x, -0.086, z), (0.026, 0.016, 0.014), k=0.02)
    cap = SDF()
    cap.add('ell', (0, 0.016, 1.750), (0.112, 0.128, 0.098), k=0)
    cap.sub('ell', (0, 0.018, 1.640), (0.16, 0.16, 0.090), k=0.004)
    capc = (0.13, 0.20, 0.07)   # moss green
    hc = (0.62, 0.42, 0.13)
    o.update(hair_sdf=hair, hair_col=hc, shells=[dict(sdf=cap, col=C_cloth(capc, 0.08), name="cap", edge=0.008, tmax=0.05, tris=600)])
    P = shorten_lower_face(flatten_mouth(cute_eyes(head_parts(o), o)), 0.92)
    P.append(Part(tube([(0, 0.02, 1.85), (0.01, 0.05, 1.875), (0.02, 0.085, 1.872)], [0.012, 0.010, 0.006], n=6), "Cloth", C_cloth(capc), W_head, subsurf=0, name="stalk"))
    red = (0.50, 0.10, 0.05)
    def torsoc(p, n):
        base = neck_mix(p, skin, red, 1.46, 0.085)
        return tuple(clamp(x * (1 + 0.06 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_cloth(red), leg_col=C_cloth((0.22, 0.14, 0.07), dirt=0.15))
    P += body_parts(o)
    P.append(neck_trim(o, 1.46, 0.085, C_cloth((0.62, 0.50, 0.24), 0.04)))
    P.append(tunic(o, red, 0.70, trim=(0.62, 0.50, 0.24)))
    P.append(Part(belt(o, 1.02, 0.035, 0.010), "Leather", C_cloth(PAL["leather"], 0.1), W_torso, subsurf=1, solidify=0.005, name="belt"))
    P.append(Part(sphere((-0.115, -0.080, 0.975), (0.026, 0.018, 0.030), 8, 6), "Leather", C_cloth(PAL["leather"], 0.12), lambda p: legblend(1.0, 0.85)(p), subsurf=1, name="pouch"))
    P += shoe_parts(o, PAL["leather"], boot_h=0.22, boot_col=PAL["leather"])
    trim_budget(P)
    return P

# ================================================================ Finn: dark-haired boy, sky-blue tunic, yellow hood
def finn():
    skin = (0.62, 0.42, 0.29)
    o = dict(KIDFACE, skin=skin, iris=(0.09, 0.055, 0.025), brow_col=(0.06, 0.04, 0.03), brow_thick=1.0, cheek=1.2)
    hair = hair_cap(0.0, front_z=1.650, front_y=-0.092)
    hood = SDF()
    hood.add('ell', (0, 0.022, 1.708), (0.110, 0.124, 0.124), k=0)
    hood.add('ell', (0, 0.030, 1.555), (0.100, 0.100, 0.075), k=0.04)
    hood.add('cap', (0, 0.10, 1.74), (0, 0.17, 1.66), 0.030, k=0.03)
    hood.sub('ell', (0, -0.112, 1.650), (0.074, 0.080, 0.100), k=0.012)
    hcol = (0.66, 0.44, 0.06)   # mustard hood
    o.update(hair_sdf=hair, hair_col=(0.05, 0.035, 0.025),
             shells=[dict(sdf=hood, col=C_cloth(hcol, 0.10), name="hood", edge=0.012, tmax=0.07, tris=850)])
    P = shorten_lower_face(flatten_mouth(cute_eyes(head_parts(o), o)), 0.92)
    blue = (0.10, 0.28, 0.55)
    o.update(torso_col=C_cloth(blue), arm_col=C_cloth(blue), leg_col=C_cloth((0.20, 0.20, 0.19), dirt=0.2))
    P += body_parts(o)
    P.append(tunic(o, blue, 0.72))
    # short hood capelet over the shoulders
    rings = []
    for z, rx, ry in ((1.50, 0.080, 0.074), (1.47, 0.140, 0.098), (1.42, 0.186, 0.118), (1.36, 0.200, 0.126)):
        rings.append(hring((0, 0.01, z), rx, ry, ry * 1.05, n=22, bump=fold_bump(6, 0.012 * sstep(1.47, 1.36, z))))
    P.append(Part(loft(rings), "Cloth", C_cloth(hcol, 0.10), W_torso, subsurf=1, solidify=0.005, name="capelet"))
    P.append(Part(belt(o, 1.02, 0.030, 0.010), "Cloth", C_cloth((0.55, 0.45, 0.25), 0.06), W_torso, subsurf=1, solidify=0.004, name="rope"))
    P += shoe_parts(o, PAL["dbrown"])
    trim_budget(P)
    return P

# ================================================================ Ella: auburn twin braids, mustard dress, white apron
def ella():
    skin = (0.80, 0.58, 0.45)
    o = dict(KIDFACE, skin=skin, fem=True, iris=(0.12, 0.26, 0.10), brow_col=(0.36, 0.13, 0.04), brow_thick=0.85, lash=1.5, lips=1.0,
             blush=0.85, blush_col=(0.88, 0.45, 0.42), lip=(0.70, 0.30, 0.28), no_ears=True)
    hair = hair_cap(0.007, front_z=1.640, front_y=-0.092, ears=False)
    hc = (0.42, 0.13, 0.035)
    o.update(hair_sdf=hair, hair_col=hc)
    P = shorten_lower_face(flatten_mouth(cute_eyes(head_parts(o), o)), 0.92)
    rib = (0.10, 0.30, 0.62)
    hw = lambda p: W_torso(p, arms=False, head=True)
    for k in (1, -1):   # twin braids over the shoulders, ribbons at the ends
        pts = [(0.075 * k, 0.040, 1.660), (0.098 * k, 0.020, 1.590), (0.105 * k, -0.010, 1.520), (0.108 * k, -0.030, 1.455), (0.108 * k, -0.040, 1.405)]
        P.append(braid(pts, [0.026, 0.024, 0.021, 0.017, 0.010], hc, hw))
        P.append(Part(sphere((0.108 * k, -0.040, 1.425), (0.020, 0.012, 0.012), 10, 6), "Cloth", C_cloth(rib, 0.05), hw, subsurf=0, name="bow"))
    mustard = (0.70, 0.46, 0.08); chem = (0.80, 0.78, 0.72)
    def torsoc(p, n):
        base = neck_mix(p, skin, mustard, 1.45, 0.100)
        return tuple(clamp(x * (1 + 0.05 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_skin_arm(skin), arm_mat="Skin", arm_start=0.25, leg_col=C_cloth((0.75, 0.72, 0.66)), leg_top=0.45)
    P += body_parts(o)
    P.append(neck_trim(o, 1.45, 0.100, C_cloth(chem, 0.03)))
    for s in SIDE:
        P.append(Part(arm_geo(s, o, n=12, start=0.0, end=0.34, inflate=0.020, cap_bot=Vector((0, 0, 0.014))), "Cloth", C_cloth(chem, 0.04), W_arm(s), subsurf=1, name="puff"))
    sk, zs, gr = dress_skirt(o, mustard, 0.36, trim=(0.42, 0.20, 0.05))
    P.append(sk)
    ap = panel_geo(o, 1.03, 0.48, 0.090, 0.13, gap=0.020, rows=7, cols=6, hang=0.0, min_depth=skirt_front(o, zs, gr))
    P.append(Part(ap, "Cloth", C_cloth(PAL["white"], 0.04), legblend3(0.97, 0.74, 0.58, 0.40, xw=0.14), subsurf=1, solidify=0.004, name="apron"))
    P.append(Part(belt(o, 1.055, 0.030, 0.016), "Cloth", C_cloth(PAL["white"]), W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += shoe_parts(o, (0.30, 0.14, 0.06))
    trim_budget(P)
    return P

# ================================================================ Mina: black hair, rose dress, white kerchief, blue apron
def mina():
    skin = (0.70, 0.49, 0.35)
    o = dict(KIDFACE, skin=skin, fem=True, iris=(0.07, 0.045, 0.025), brow_col=(0.05, 0.035, 0.03), brow_thick=0.85, lash=1.5, lips=1.0,
             blush=0.85, blush_col=(0.86, 0.42, 0.42), lip=(0.66, 0.27, 0.27), cheek=1.25)
    hair = hair_cap(0.004, front_z=1.640, front_y=-0.092)
    hair.add('ell', (0, -0.080, 1.735), (0.075, 0.024, 0.030), k=0.02)   # straight fringe
    sc = SDF()
    sc.add('ell', (0, 0.026, 1.722), (0.100, 0.116, 0.106), k=0)
    sc.sub('ell', (0, -0.094, 1.690), (0.110, 0.080, 0.070), k=0.004)   # fringe stays visible
    sc.sub('ell', (0, 0.05, 1.58), (0.13, 0.13, 0.085), k=0.006)
    sc.sub('ell', (0.0, -0.06, 1.62), (0.13, 0.08, 0.06), k=0.004)
    scol = (0.82, 0.80, 0.74)
    hc = (0.035, 0.028, 0.025)
    o.update(hair_sdf=hair, hair_col=hc, shells=[dict(sdf=sc, col=C_cloth(scol, 0.05), name="kerchief", edge=0.008, tmax=0.05, tris=650)])
    P = shorten_lower_face(flatten_mouth(cute_eyes(head_parts(o), o)), 0.92)
    P.append(Part(sphere((0, 0.124, 1.690), (0.024, 0.020, 0.020), 8, 6), "Cloth", C_cloth(scol), W_head, subsurf=1, name="knot"))
    # short ponytail below the kerchief
    P.append(braid([(0, 0.110, 1.640), (0, 0.128, 1.590), (0, 0.126, 1.540)], [0.026, 0.022, 0.012], hc, lambda p: W_torso(p, arms=False, head=True)))
    rose = (0.62, 0.16, 0.24); blue = (0.16, 0.30, 0.52)
    def torsoc(p, n):
        base = neck_mix(p, skin, rose, 1.45, 0.095)
        return tuple(clamp(x * (1 + 0.05 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_cloth(rose), leg_col=C_cloth((0.75, 0.72, 0.66)), leg_top=0.45)
    P += body_parts(o)
    P.append(neck_trim(o, 1.45, 0.095, C_cloth(scol, 0.03)))
    for s in SIDE:
        P.append(Part(cuff(s, o, 0.84, 0.008, 0.035), "Cloth", C_cloth(scol, 0.04), W_arm(s), subsurf=1, solidify=0.004, name="cuff"))
    sk, zs, gr = dress_skirt(o, rose, 0.34)
    P.append(sk)
    ap = panel_geo(o, 1.03, 0.46, 0.085, 0.12, gap=0.020, rows=7, cols=6, hang=0.0, min_depth=skirt_front(o, zs, gr))
    P.append(Part(ap, "Cloth", C_cloth(blue, 0.05), legblend3(0.97, 0.74, 0.58, 0.40, xw=0.14), subsurf=1, solidify=0.004, name="apron"))
    P.append(Part(belt(o, 1.055, 0.030, 0.016), "Cloth", C_cloth(blue), W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += shoe_parts(o, (0.16, 0.08, 0.05))
    trim_budget(P)
    return P

CHARS = {"tom": (tom, 0.74), "finn": (finn, 0.77), "ella": (ella, 0.75), "mina": (mina, 0.70)}

def kidify(ob):
    """Post-bake rest-mesh remap: big head about J, then shorter legs (arms only drop)."""
    me = ob.data
    gi = {g.index: g.name for g in ob.vertex_groups}
    for v in me.vertices:
        w = {gi[g.group]: g.weight for g in v.groups}
        p = v.co.copy()
        s = sstep(1.46, 1.57, p.z) * sstep(0.20, 0.13, math.hypot(p.x, p.y - 0.01))
        if s > 0: p = p + s * ((J - Vector((0, 0, SINK)) + (p - J) * HEAD) - p)
        armw = sum(x for b, x in w.items() if b.startswith(("UpperArm", "LowerArm", "Hand", "Prop")))
        if armw > 0.5 and p.z < HIP: p.z = p.z - D
        else: p.z = leg_map(p.z)
        v.co = p
    me.update()

if __name__ == "__main__":
    for n, (fn, scale) in CHARS.items():
        if ONLY and n not in ONLY: continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        parts = fn()
        arm, ob = build_character("kid-" + n, parts, export=False, save=False)
        kidify(ob)
        arm.scale = (scale, scale, scale)
        if not NOEXPORT and not os.environ.get("NPC_OUT"):
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_SRC, f"npc-kid-{n}.blend"))
        if not NOEXPORT:
            glb = os.path.join(OUT_GLB, f"npc-kid-{n}.glb")
            bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True,
                                      export_animation_mode='ACTIONS', export_draco_mesh_compression_enable=True,
                                      export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False,
                                      export_skins=True, export_yup=True, export_apply=False,
                                      export_anim_slide_to_zero=True, export_optimize_animation_size=True,
                                      export_extra_animations=False, export_vertex_color='MATERIAL',
                                      export_image_format='WEBP', export_image_quality=82)
            tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
            print("KIDBUILT", n, "tris", tris, "bytes", os.path.getsize(glb))
