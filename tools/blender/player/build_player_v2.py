# Player hero v2 for models/player.glb ("young hero of 상호랜드").
#
# Built directly in person.glb's bind pose (T-pose, Blender world metres, Z up, faces -Y): no NPC warp.
#   - stylized head: numpy SDF -> radial mesh, painted face texture (eyes with iris + highlights, brows, smile)
#   - clumped, side-swept hair (v2_head.py), ears
#   - royal-blue quilted gambeson with gold trim + split skirt, red capelet + cape with gold brooch,
#     leather belt + pouch, tan trousers, tall boots, leather bracers
#   - hands with five fingers that follow person.glb's finger bones and are weighted per phalanx, so
#     weapons.js grip() can curl them.
# Output: mesh-only skinned glb that splice_player.py grafts into a copy of person.glb (armature, rest pose,
# joint order and all 24 clips stay byte-identical).
#
# Run: Blender -b --factory-startup --python build_player_v2.py -- [--nobake] [--out /path/mesh.glb]
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "tools", "blender", "npc_polish"))
sys.path.insert(0, HERE)
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, noise
from lib_real import clamp, sstep, mix, mul, ring, hring, loft, tube, sphere, grid_panel, chain_w, fbm, Part, realize, MATS, make_material
import v2_head as VH

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOBAKE = "--nobake" in ARGS
OUT_MESH = ARGS[ARGS.index("--out") + 1] if "--out" in ARGS else "/Users/sang/.claude/jobs/02a78233/tmp/player_v2/player_mesh.glb"
PERSON = os.path.join(REPO, "models", "person.glb")
SNAME = {1: "L", -1: "R"}

MATS.update({"Quilt": (0.86, 0.0, 0.35), "Face": (0.55, 0.0, 0.45), "Cape": (0.80, 0.0, 0.35), "Boot": (0.55, 0.0, 0.5)})

# ================================================================ palette (linear)
def srgb(r, g, b): return tuple(((c / 255.0 + 0.055) / 1.055) ** 2.4 if c / 255.0 > 0.04045 else c / 255.0 / 12.92 for c in (r, g, b))
BLUE = srgb(38, 72, 158)
BLUE_D = srgb(26, 48, 112)
GOLD = srgb(222, 172, 70)
GOLD_D = srgb(170, 120, 40)
RED = srgb(170, 30, 34)
RED_IN = srgb(110, 22, 28)
TAN = srgb(150, 112, 74)
BOOT = srgb(78, 46, 28)
BOOT_L = srgb(112, 70, 40)
SOLE = srgb(40, 26, 18)
LEATHER = srgb(120, 74, 40)
LEATHER_D = srgb(84, 50, 28)
SKIN = tuple(((c + 0.055) / 1.055) ** 2.4 for c in VH.SKIN_S)
HAIR = srgb(92, 56, 32)
HAIR_L = srgb(140, 92, 52)
GEM = srgb(40, 90, 200)

def cloth(base, amt=0.06, f=22):
    def c(p, n):
        m = 1 + amt * fbm(p, f) + 0.025 * noise.noise(Vector(p) * 400)
        return tuple(clamp(x * m) for x in base)
    return c
def flat(base): return lambda p, n: base

# ================================================================ joints (read from person.glb)
J = {}
def read_joints():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=PERSON)
    new = [x for x in bpy.data.objects if x not in before]
    arm = next(x for x in new if x.type == 'ARMATURE')
    for b in arm.data.bones:
        J[b.name] = arm.matrix_world @ b.head_local
    ref = next(x for x in new if x.name == "Casual2_Body")
    info = dict(arm=arm, parent=ref.parent, ptype=ref.parent_type, mpi=ref.matrix_parent_inverse.copy(),
                mb=ref.matrix_basis.copy(), mw=ref.matrix_world.copy())
    for x in new:
        if x.type == 'MESH': bpy.data.objects.remove(x)
    return info

def JV(name, k): return J[f"{name}.{SNAME[k]}"].copy()

# ================================================================ weights
SP_PTS = [(0, -0.05, 0.78), (0, -0.05, 0.999), (0, -0.045, 1.161), (0, -0.041, 1.377), (0, -0.043, 1.511), (0, -0.043, 1.587), (0, -0.043, 2.0)]
SP_B = ["Hips", "Abdomen", "Torso", "Chest", "Neck", "Head"]
SP_HW = [0.05, 0.07, 0.07, 0.035, 0.03]
def W_spine(p): return chain_w(Vector((0, -0.045, p.z)), SP_PTS, SP_B, SP_HW)

def _add(w, extra, a):
    if a <= 0: return w
    w = {b: x * (1 - a) for b, x in w.items()}
    for b, x in extra.items(): w[b] = w.get(b, 0) + x * a
    return w

def W_torso(p):
    w = W_spine(p)
    ax = abs(p.x)
    if ax > 0.07 and p.z > 1.30:
        k = 1 if p.x > 0 else -1; s = SNAME[k]
        a = 0.85 * sstep(0.08, 0.15, ax) * sstep(1.30, 1.40, p.z)
        b = 0.45 * sstep(0.13, 0.18, ax) * sstep(1.33, 1.41, p.z)
        w = _add(w, {f"Shoulder.{s}": 1.0 - b / max(a, 1e-6) if a > 0 else 1.0, f"UpperArm.{s}": b / max(a, 1e-6) if a > 0 else 0.0}, a)
    if p.z < 1.0:   # pelvis -> thighs
        t = 1 - sstep(0.86, 1.0, p.z)
        wl = sstep(-0.09, 0.09, p.x)
        w = _add(w, {"UpperLeg.L": wl, "UpperLeg.R": 1 - wl}, t)
    return w

def W_arm(k):
    s = SNAME[k]
    pts = [Vector((0.07 * k, -0.06, 1.430)), JV("UpperArm", k), JV("LowerArm", k), JV("Wrist", k), JV("Wrist", k) + Vector((0.3 * k, 0, 0))]
    return lambda p: chain_w(p, pts, [f"Shoulder.{s}", f"UpperArm.{s}", f"LowerArm.{s}", f"Wrist.{s}"], [0.035, 0.05, 0.018])

FINGERS = ["Index", "Middle", "Ring", "Pinky"]
def finger_pts(f, k):
    a = [JV(f"{f}{i}", k) for i in range(1, 5)]
    tip = a[3] + (a[3] - a[2]).normalized() * (0.020 if f != "Pinky" else 0.017)
    return a + [tip]

def W_finger(f, k):
    s = SNAME[k]; pts = finger_pts(f, k)
    return lambda p: chain_w(p, pts, [f"{f}1.{s}", f"{f}2.{s}", f"{f}3.{s}", f"{f}4.{s}"], [0.010, 0.006, 0.005])

def thumb_pts(k):
    a = [JV(f"Thumb{i}", k) for i in range(1, 4)]
    tip = a[2] + (a[2] - a[1]).normalized() * 0.026
    return a + [tip]

def W_thumb(k):
    s = SNAME[k]; pts = thumb_pts(k)
    return lambda p: chain_w(p, pts, [f"Thumb1.{s}", f"Thumb2.{s}", f"Thumb3.{s}"], [0.008, 0.006])

def W_palm(k):
    s = SNAME[k]
    wr = JV("Wrist", k); kn = {f: JV(f"{f}2", k) for f in FINGERS}
    def f(p):
        # along the hand: 0 at wrist joint .. 1 at the knuckle line
        kc = sum(kn.values(), Vector()) / 4
        d = kc - wr; t = clamp((p - wr).dot(d) / d.length_squared)
        if (p - wr).dot(d) < 0: return {f"Wrist.{s}": 1.0}
        # nearest finger by lateral (y) position
        best = min(FINGERS, key=lambda fn: abs(p.y - kn[fn].y))
        a = 0.85 * sstep(0.35, 0.95, t)
        return _add({f"Wrist.{s}": 1.0}, {f"{best}1.{s}": 1.0}, a)
    return f

def W_leg(k):
    s = SNAME[k]
    pts = [(0.121 * k, -0.05, 1.10), (0.121 * k, -0.045, 0.964), (0.121 * k, -0.087, 0.533), (0.121 * k, -0.062, -0.05)]
    def f(p):
        w = chain_w(p, pts, ["Hips", f"UpperLeg.{s}", f"LowerLeg.{s}"], [0.07, 0.06])
        t = sstep(0.075, 0.14, p.z)
        if t < 1: w = _add(w, {f"Foot.{s}": 1.0}, 1 - t)
        return w
    return f

def W_skirt(k):
    s = SNAME[k]
    def f(p):
        w = W_spine(p)
        t = 0.80 * (1 - sstep(0.80, 1.02, p.z))
        return _add(w, {f"UpperLeg.{s}": 1.0}, t)
    return f

def W_cape(p):
    return W_spine(Vector((p.x, p.y, max(p.z, 1.10))))

def W_capelet(p):
    w = W_spine(Vector((p.x, p.y, max(p.z, 1.40))))
    ax = abs(p.x)
    if ax > 0.08:
        k = 1 if p.x > 0 else -1; s = SNAME[k]
        a = 0.80 * sstep(0.08, 0.17, ax)
        b = 0.50 * sstep(0.13, 0.20, ax)
        w = _add(w, {f"Shoulder.{s}": 1 - b / a, f"UpperArm.{s}": b / a}, a)
    return w

def W_pouch(p):
    return _add(W_spine(p), {"UpperLeg.R": 1.0}, 0.35)

# ================================================================ torso profile
# z: (cy, rx, ryf, ryb)
TORSO = [(0.86, -0.054, 0.136, 0.100, 0.100), (0.94, -0.054, 0.138, 0.100, 0.098), (1.00, -0.050, 0.131, 0.096, 0.092),
         (1.08, -0.046, 0.134, 0.098, 0.091), (1.17, -0.042, 0.146, 0.108, 0.095), (1.26, -0.040, 0.158, 0.116, 0.100),
         (1.34, -0.040, 0.166, 0.118, 0.102), (1.40, -0.042, 0.168, 0.110, 0.098), (1.44, -0.044, 0.158, 0.096, 0.090),
         (1.475, -0.044, 0.130, 0.080, 0.078), (1.500, -0.042, 0.092, 0.068, 0.066), (1.515, -0.038, 0.066, 0.060, 0.060)]
def torso_dims(z):
    T = TORSO
    if z <= T[0][0]: return T[0][1:]
    for a, b in zip(T, T[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t) * 0.5 + t * 0.5
            return tuple(x + (y - x) * t for x, y in zip(a[1:], b[1:]))
    return T[-1][1:]

TSQ = 2.35
def torso_pt(z, ang, off=0.0):
    """ang: 0 = +X (char left), 90deg = front (-Y)."""
    cy, rx, ryf, ryb = torso_dims(z)
    ca, sa = math.cos(ang), math.sin(ang)
    e = 2 / TSQ
    cx_ = math.copysign(abs(ca) ** e, ca); sy_ = math.copysign(abs(sa) ** e, sa)
    p = Vector((cx_ * (rx + off), cy - sy_ * ((ryf if sa > 0 else ryb) + off), z))
    return p

def torso_ring(z, n, off=0.0):
    return [torso_pt(z, 2 * math.pi * i / n, off) for i in range(n)]

# ================================================================ parts
def P_(geo, mat, col, w, **kw):
    p = Part(geo, mat, col, w, **kw); return p

def cr(vals, k=2):
    """Catmull-Rom resample of a list of Vectors / floats / tuples (k sub-steps per segment)."""
    def lerp(a, b, t):
        if isinstance(a, tuple): return tuple(x + (y - x) * t for x, y in zip(a, b))
        return a + (b - a) * t
    def crs(p0, p1, p2, p3, t):
        if isinstance(p1, tuple): return tuple(crs(a, b, c, d, t) for a, b, c, d in zip(p0, p1, p2, p3))
        t2, t3 = t * t, t * t * t
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    out = []
    n = len(vals)
    for i in range(n - 1):
        p0 = vals[max(i - 1, 0)]; p1 = vals[i]; p2 = vals[i + 1]; p3 = vals[min(i + 2, n - 1)]
        for j in range(k):
            out.append(crs(p0, p1, p2, p3, j / k))
    out.append(vals[-1])
    return out

def ctube(pts, rad, k=2, **kw):
    pts = [Vector(p) for p in pts]
    return tube(cr(pts, k), cr([tuple(r) if isinstance(r, (tuple, list)) else (r, r) for r in rad], k), **kw)

def body_parts():
    P = []
    # ---------------- head, ears, hair
    P.append(P_(VH.head_mesh(60, 44), "Face", flat(SKIN), W_spine, subsurf=0, name="head"))
    for k in (1, -1):
        P.append(P_(VH.ear_geo(k), "Face", flat(SKIN), W_spine, subsurf=0, name="ear"))
    def hairc(p, n):
        t = clamp((p.z - 1.60) / 0.22)
        base = mix(HAIR, HAIR_L, 0.35 * t)
        m = 1 + 0.10 * fbm(Vector((p.x * 3, p.y * 3, p.z * 0.6)), 30) + 0.04 * noise.noise(Vector(p) * 300)
        return tuple(clamp(x * m) for x in base)
    P.append(P_(VH.hair_cap(n_az=40, n_el=14), "Hair", hairc, W_spine, subsurf=0, name="hair"))
    for g in VH.hair_strands():
        P.append(P_(g, "Hair", hairc, W_spine, subsurf=0, name="hair"))

    # ---------------- gambeson torso (closed loft, quilted blue)
    zs = [0.90, 0.96, 1.00, 1.05, 1.11, 1.17, 1.23, 1.29, 1.35, 1.40, 1.44, 1.475, 1.500, 1.515]
    zs = cr(zs, 2)
    P.append(P_(loft([torso_ring(z, 40) for z in zs]), "Quilt", cloth(BLUE), W_torso, subsurf=0, name="torso"))
    # stand collar with gold edge
    cz = [1.498, 1.515, 1.535, 1.552, 1.558]
    crings = [ring((0, -0.034, z), Vector((1, 0, 0)), Vector((0, -1, 0)), 0.066 + 0.004 * (z - 1.50) / 0.06, 0.064 + 0.004 * (z - 1.50) / 0.06, 24) for z in cz]
    def collarc(p, n): return GOLD if p.z > 1.546 else cloth(BLUE)(p, n)
    P.append(P_(loft(crings), "Quilt", collarc, W_spine, solidify=0.006, name="collar"))
    # front placket strip (gold) + buttons
    rows = []
    for z in [1.03, 1.08, 1.14, 1.20, 1.26, 1.32, 1.38, 1.43, 1.47, 1.495]:
        cy, rx, ryf, ryb = torso_dims(z)
        row = []
        for u in (-1, -0.5, 0, 0.5, 1):
            x = u * 0.011
            ang = math.asin(clamp(x / rx, -1, 1))
            p = torso_pt(z, math.pi / 2 - ang, 0.0035)
            row.append(p)
        rows.append(row)
    P.append(P_(grid_panel(rows), "Gold", cloth(GOLD, 0.04), W_torso, solidify=0.003, sol_offset=1.0, name="placket"))
    for z in (1.10, 1.18, 1.26, 1.34):
        p = torso_pt(z, math.pi / 2, 0.009)
        P.append(P_(sphere(p, (0.0075, 0.005, 0.0075), 8, 5), "Gold", flat(GOLD_D), W_torso, subsurf=0, name="button"))

    # ---------------- split skirt (two halves; slits front and back), gold hem + slit trim
    for k in (1, -1):
        rows = []
        zr = [1.025, 0.98, 0.93, 0.88, 0.845, 0.825, 0.815, 0.800]
        n = 19
        for z in zr:
            t = (1.025 - z) / (1.025 - 0.80)
            row = []
            gap = math.radians(2.0 + 3.0 * t)
            for j in range(n):
                u = j / (n - 1)
                # angle from front (+90deg) around this side to back (-90deg), leaving gaps at front/back
                a = (math.pi / 2 - gap) - u * (math.pi - 2 * gap)
                if k < 0: a = math.pi - a
                pt = torso_pt(max(z, 0.90), a, 0.006 + 0.050 * t ** 1.3)
                pt.z = z
                fold = 0.006 * math.sin(u * math.pi * 4) * t
                pt += Vector((math.cos(a), -math.sin(a), 0)) * fold
                row.append(pt)
            rows.append(row)
        def skc(p, n, k=k):
            # gold hem + trim along the slit edges
            cy = -0.05
            a = math.atan2(-(p.y - cy), p.x * k)          # 90deg front, -90deg back for this side
            edge = min(abs(a - math.pi / 2), abs(a + math.pi / 2))
            if p.z < 0.8205 or (edge < math.radians(6.5) and p.z < 1.02): return GOLD
            return cloth(BLUE)(p, n)
        P.append(P_(grid_panel(rows), "Quilt", skc, W_skirt(k), subsurf=1, solidify=0.006, name="skirt"))
    # pelvis under the skirt (tan, same as trousers)
    prings = [hring((0, -0.048, z), rx, ry, ry * 0.98, n=20) for z, rx, ry in ((1.00, 0.124, 0.090), (0.94, 0.121, 0.088), (0.895, 0.100, 0.076), (0.87, 0.062, 0.050))]
    P.append(P_(loft(prings, cap1='pole'), "Cloth", cloth(TAN), W_torso, subsurf=0, name="pelvis"))

    # ---------------- belt + buckle + pouch
    brs = [torso_ring(z, 32, 0.009) for z in (0.992, 1.000, 1.030, 1.038)]
    for r_, z in zip(brs, (0.992, 1.000, 1.030, 1.038)):
        for p in r_: p.z = z
    bring = [torso_ring(0.995, 32, 0.004), torso_ring(0.995, 32, 0.010), torso_ring(1.035, 32, 0.010), torso_ring(1.035, 32, 0.004)]
    P.append(P_(loft(bring + [bring[0]]), "Leather", cloth(LEATHER_D, 0.10), W_torso, subsurf=0, name="belt"))
    bf = torso_pt(1.015, math.pi / 2, 0.012)
    bk = loft([ring(bf + Vector((0, d, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)), 0.022, 0.019, 4, phase=math.pi / 4, sq=6.0) for d in (0.004, -0.004)], cap0='pole', cap1='pole')
    P.append(P_(bk, "Gold", flat(GOLD), W_torso, subsurf=0, name="buckle"))
    pc = torso_pt(0.95, math.radians(90 + 52), 0.030)     # right-front hip
    pv, pf = loft([ring(pc + Vector((0, 0, dz)), Vector((1, 0, 0)), Vector((0, -1, 0)), rx, ry, 12, sq=3.2)
                   for dz, rx, ry in ((0.040, 0.030, 0.016), (0.030, 0.033, 0.020), (-0.015, 0.033, 0.021), (-0.035, 0.028, 0.017))], cap0='pole', cap1='pole')
    P.append(P_((pv, pf), "Leather", cloth(LEATHER, 0.10), W_pouch, subsurf=0, name="pouch"))
    flap = [[pc + Vector((x, -0.023 - 0.004 * (1 - abs(x) / 0.034), z)) for x in (-0.034, -0.017, 0, 0.017, 0.034)] for z in (0.041, 0.020, 0.006)]
    P.append(P_(grid_panel(flap), "Leather", flat(LEATHER_D), W_pouch, solidify=0.003, name="pouchflap"))
    P.append(P_(sphere(pc + Vector((0, -0.030, 0.010)), (0.005, 0.003, 0.005), 8, 5), "Gold", flat(GOLD), W_pouch, subsurf=0, name="stud"))

    # ---------------- sleeves (blue, gold cuff) + leather bracers
    for k in (1, -1):
        sh, el, wr = JV("UpperArm", k), JV("LowerArm", k), JV("Wrist", k)
        root = Vector((0.085 * k, -0.058, 1.422))
        def along(a, b, t): return a.lerp(b, t)
        pts = [root, along(root, sh, 0.5), sh, along(sh, el, 0.5), along(sh, el, 0.85), el, along(el, wr, 0.18), along(el, wr, 0.36)]
        rad = [(0.050, 0.056), (0.056, 0.058), (0.058, 0.057), (0.054, 0.052), (0.049, 0.047), (0.047, 0.045), (0.049, 0.047), (0.050, 0.048)]
        P.append(P_(ctube(pts, rad, 2, n=18, cap0=None, cap1=None, up=(0, 0, 1)), "Quilt", cloth(BLUE), W_arm(k), subsurf=0, name="sleeve"))
        # gold cuff band at the sleeve end (sits over the bracer top)
        cp = [along(el, wr, t) for t in (0.285, 0.305, 0.345, 0.365)]
        crr = [(0.051, 0.049), (0.054, 0.052), (0.054, 0.052), (0.051, 0.049)]
        P.append(P_(tube(cp, crr, n=18, cap0=None, cap1=None, up=(0, 0, 1)), "Gold", cloth(GOLD, 0.03), W_arm(k), subsurf=0, name="cuff"))
        # bracer with two darker straps + studs
        bp = [along(el, wr, t) for t in (0.32, 0.42, 0.55, 0.68, 0.80, 0.90, 0.97, 1.0)]
        br = [(0.049, 0.046), (0.050, 0.047), (0.048, 0.045), (0.045, 0.042), (0.042, 0.039), (0.041, 0.038), (0.043, 0.040), (0.044, 0.041)]
        g = ctube(bp, br, 2, n=18, cap0=None, cap1=None, up=(0, 0, 1))
        # inward lip at the wrist end so the open edge has thickness
        lip = tube([along(el, wr, 1.0), along(el, wr, 0.995)], [(0.044, 0.041), (0.033, 0.031)], n=18, cap0=None, cap1=None, up=(0, 0, 1))
        P.append(P_(g, "Leather", cloth(LEATHER, 0.12), W_arm(k), subsurf=0, name="bracer"))
        P.append(P_(lip, "Leather", flat(LEATHER_D), W_arm(k), subsurf=0, name="bracer"))
        # wrist (skin) running from inside the bracer into the palm
        wp = [along(el, wr, 0.85), wr + (wr - el).normalized() * 0.012]
        P.append(P_(tube(wp, [(0.031, 0.027), (0.027, 0.023)], n=12, cap0=None, cap1=None, up=(0, 0, 1)), "Skin", cloth(SKIN, 0.03), W_arm(k), subsurf=0, name="wrist"))
        for t, r0 in ((0.52, 0.0475), (0.80, 0.0415)):
            sp_ = [along(el, wr, t - 0.025), along(el, wr, t + 0.025)]
            P.append(P_(tube(sp_, [(r0 + 0.002, r0 - 0.001)] * 2, n=18, cap0=None, cap1=None, up=(0, 0, 1)), "Leather", flat(LEATHER_D), W_arm(k), subsurf=0, name="bstrap"))
            c = along(el, wr, t) + Vector((0, 0, r0 + 0.002))
            P.append(P_(sphere(c, (0.006, 0.006, 0.003), 8, 4), "Gold", flat(GOLD), W_arm(k), subsurf=0, name="stud"))

    # ---------------- hands (skin): palm + 4 fingers + thumb, following the bones
    for k in (1, -1):
        P += hand_parts(k)

    # ---------------- trousers + boots
    for k in (1, -1):
        cx = 0.121 * k
        lp = [(cx * 0.92, -0.050, 1.00), (cx, -0.046, 0.94), (cx, -0.055, 0.82), (cx, -0.065, 0.70), (cx, -0.078, 0.60), (cx, -0.086, 0.533),
              (cx, -0.080, 0.47), (cx, -0.075, 0.40), (cx, -0.072, 0.30)]
        lr = [(0.086, 0.088), (0.084, 0.086), (0.078, 0.078), (0.071, 0.070), (0.062, 0.061), (0.057, 0.056), (0.055, 0.054), (0.052, 0.051), (0.050, 0.049)]
        def trc(p, n):
            c = cloth(TAN, 0.07)(p, n)
            return c
        P.append(P_(ctube(lp, lr, 2, n=18, cap0=None, cap1=None, up=(0, -1, 0)), "Cloth", trc, W_leg(k), subsurf=0, name="leg"))
        P += boot_parts(k)

    # ---------------- capelet + hood roll + cape + brooch
    P += cloak_parts()
    return P

def hand_parts(k):
    s = SNAME[k]
    P = []
    wr = JV("Wrist", k)
    kn = {f: JV(f"{f}2", k) for f in FINGERS}
    kc = (kn["Index"] + kn["Pinky"]) * 0.5
    ax = (kc - wr).normalized()
    # palm: rings from the wrist to the knuckles in the plane (lateral y, normal z)
    up = Vector((0, 0, 1))
    rings = []
    for t, wy, hz in ((-0.10, 0.026, 0.016), (0.05, 0.030, 0.017), (0.30, 0.037, 0.0165), (0.60, 0.043, 0.0155), (0.85, 0.046, 0.0145), (1.0, 0.045, 0.0125)):
        c = wr.lerp(kc, t) if t >= 0 else wr + (wr - kc) * (-t)
        c = c + Vector((0, 0, -0.002))
        # lateral axis: from pinky to index side
        lat = (kn["Index"] - kn["Pinky"]); lat = (lat - ax * lat.dot(ax)).normalized()
        nz = ax.cross(lat).normalized()
        if nz.z < 0: nz = -nz
        rings.append(ring(c, lat, nz, wy, hz, 10, sq=2.6))
    P.append(P_(loft(rings, cap0='pole', cap1='pole'), "Skin", cloth(SKIN, 0.03), W_palm(k), subsurf=1, name="palm"))
    rad = {"Index": 0.0090, "Middle": 0.0094, "Ring": 0.0088, "Pinky": 0.0077}
    for f in FINGERS:
        pts = finger_pts(f, k)
        q = [pts[0].lerp(pts[1], 0.72), pts[1], pts[2], pts[3], pts[4]]
        r = rad[f]
        rr = [r * 1.05, r * 1.02, r * 0.93, r * 0.86, r * 0.62]
        q2 = cr(q, 2); rr2 = cr(rr, 2)
        g = tube(q2, rr2, n=7, cap0='pole', cap1=(q[4] - q[3]).normalized() * 0.004, up=(0, 0, 1))
        P.append(P_(g, "Skin", cloth(SKIN, 0.03), W_finger(f, k), subsurf=0, name="finger"))
    tp = thumb_pts(k)
    q = [tp[0].lerp(tp[1], 0.35), tp[0].lerp(tp[1], 0.75), tp[1], tp[2], tp[3]]
    rr = [0.0150, 0.0125, 0.0108, 0.0098, 0.0068]
    g = tube(cr(q, 2), cr(rr, 2), n=8, cap0='pole', cap1=(q[4] - q[3]).normalized() * 0.004, up=(0, 0, 1))
    P.append(P_(g, "Skin", cloth(SKIN, 0.03), W_thumb(k), subsurf=0, name="thumb"))
    return P

def boot_parts(k):
    P = []
    cx = 0.121 * k
    # shaft (vertical rings) with a folded cuff
    sp = [(cx, -0.074, 0.445), (cx, -0.074, 0.40), (cx, -0.072, 0.33), (cx, -0.068, 0.24), (cx, -0.064, 0.16), (cx, -0.060, 0.10), (cx, -0.056, 0.06)]
    sr = [(0.063, 0.062), (0.062, 0.061), (0.063, 0.060), (0.057, 0.054), (0.051, 0.048), (0.049, 0.046), (0.048, 0.045)]
    P.append(P_(ctube(sp, sr, 2, n=18, cap0=None, cap1='pole', up=(0, -1, 0)), "Boot", cloth(BOOT, 0.10), W_leg(k), subsurf=0, name="boot"))
    cuff = [(cx, -0.074, 0.465), (cx, -0.074, 0.452), (cx, -0.074, 0.415), (cx, -0.074, 0.405)]
    cfr = [(0.064, 0.063), (0.070, 0.069), (0.069, 0.068), (0.065, 0.064)]
    P.append(P_(tube(cuff, cfr, n=18, cap0=None, cap1=None, up=(0, -1, 0)), "Boot", cloth(BOOT_L, 0.10), W_leg(k), subsurf=0, name="bootcuff"))
    # foot: rings along -Y (heel -> toe), flat sole
    secs = [(0.050, 0.036, 0.105), (0.025, 0.044, 0.125), (-0.020, 0.047, 0.125), (-0.075, 0.049, 0.095), (-0.125, 0.050, 0.072), (-0.165, 0.045, 0.060), (-0.192, 0.032, 0.050), (-0.205, 0.016, 0.040)]
    rings = []
    for y, w, top in cr(secs, 2):
        zc = top * 0.45
        rings.append(ring(Vector((cx + 0.004 * k * (0.05 - y) / 0.25, y, zc)), Vector((1, 0, 0)), Vector((0, 0, 1)), w, top - zc, 18, ryb=zc, sq=2.8))
    def bootc(p, n):
        return cloth(BOOT, 0.10)(p, n)
    P.append(P_(loft(rings, cap0='pole', cap1='pole'), "Boot", bootc, W_leg(k), subsurf=0, name="foot"))
    # sole slab (dark), slightly wider than the upper
    outl = []
    cs = cr(secs, 2)
    for y, w, top in cs: outl.append((cx + 0.004 * k * (0.05 - y) / 0.25 + (w + 0.003), y))
    for y, w, top in reversed(cs): outl.append((cx + 0.004 * k * (0.05 - y) / 0.25 - (w + 0.003), y))
    srings = [[Vector((x, y + (0.003 if i == 0 else 0), z)) for (x, y) in outl] for i, z in enumerate((0.0, 0.018))]
    sg = loft(srings, cap0='pole', cap1='pole')
    if k < 0: sg = (sg[0], [tuple(reversed(f)) for f in sg[1]])
    P.append(P_(sg, "Boot", flat(SOLE), W_leg(k), subsurf=0, name="sole"))
    # ankle strap + buckle
    st = [ring(Vector((cx, -0.058, z)), Vector((1, 0, 0)), Vector((0, -1, 0)), 0.052, 0.050, 16) for z in (0.120, 0.138)]
    P.append(P_(loft(st), "Leather", flat(LEATHER_D), W_leg(k), solidify=0.004, sol_offset=1.0, name="strap"))
    P.append(P_(loft([ring(Vector((cx + 0.050 * k, -0.062, 0.129)), Vector((0, 1, 0)), Vector((0, 0, 1)), 0.009, 0.010, 4, phase=math.pi / 4, sq=6) for _ in (0,)] +
                     [ring(Vector((cx + 0.056 * k, -0.062, 0.129)), Vector((0, 1, 0)), Vector((0, 0, 1)), 0.008, 0.009, 4, phase=math.pi / 4, sq=6)], cap0='pole', cap1='pole'),
                "Gold", flat(GOLD), W_leg(k), subsurf=0, name="buckle"))
    return P

def cloak_parts():
    P = []
    # capelet: rings around the neck, open in front below the brooch
    zr = [(1.532, 0.072, 0.066, 0.068, 0.0), (1.512, 0.126, 0.094, 0.090, 0.0), (1.490, 0.176, 0.118, 0.112, 0.30), (1.462, 0.204, 0.132, 0.126, 0.70), (1.425, 0.212, 0.138, 0.134, 1.0)]
    nc = 48
    rows = []
    for zi, (z, rx, ryf, ryb, op) in enumerate(zr):
        gap = math.radians(2 + 36 * op)
        row = []
        for j in range(nc + 1):
            u = j / nc
            a = math.pi / 2 + gap + u * (2 * math.pi - 2 * gap)     # start at front (+90deg), go round
            ca, sa = math.cos(a), math.sin(a)
            zz = z
            if zi == len(zr) - 1:      # hem: lower at the back, higher over the arms
                back = max(0.0, -sa)
                side = abs(ca)
                zz = z - 0.060 * back + 0.008 * side * (1 - back) - 0.012 * max(0, sa) ** 2
            yy = -0.040 - sa * (ryf if sa > 0 else ryb)
            fold = 0.012 * math.sin(a * 10 + 0.5) * (zi / 4) ** 1.5
            row.append(Vector((ca * (rx + fold), yy - sa * fold, zz)))
        rows.append(row)
    def capc(p, n):
        # gold trim along the hem
        return cloth(RED, 0.06)(p, n)
    P.append(P_(grid_panel(rows), "Cape", capc, W_capelet, subsurf=1, solidify=0.006, sol_offset=1.0, name="capelet"))
    # gold hem trim ribbon (follows the capelet hem, slightly outside)
    hem = rows[-1]; pre = rows[-2]
    trim = [[pre[j].lerp(hem[j], 0.82) + (hem[j] - Vector((0, -0.04, hem[j].z))).normalized() * 0.004 for j in range(len(hem))],
            [hem[j] + (hem[j] - Vector((0, -0.04, hem[j].z))).normalized() * 0.004 + Vector((0, 0, -0.002)) for j in range(len(hem))]]
    P.append(P_(grid_panel(trim), "Gold", cloth(GOLD, 0.03), W_capelet, subsurf=0, solidify=0.002, name="captrim"))
    # hood roll behind the neck
    hp = []
    for i in range(9):
        a = math.radians(-20 - 140 * i / 8)        # from char-left-front round the back to char-right-front
        r = 0.098
        hp.append(Vector((math.cos(a) * r * 1.05, -0.040 - math.sin(a) * r, 1.522 - 0.010 * math.sin(math.pi * i / 8))))
    hr = [0.012, 0.020, 0.025, 0.027, 0.028, 0.027, 0.025, 0.020, 0.012]
    P.append(P_(tube(cr(hp, 2), cr(hr, 2), n=10, up=(0, 0, 1)), "Cape", cloth(RED, 0.06), W_spine, subsurf=0, name="hood"))
    # brooch: gold disc + gem
    bc = Vector((0, -0.132, 1.488))
    disc = loft([ring(bc + Vector((0, d, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)), r, r, 20) for d, r in ((0.004, 0.021), (-0.002, 0.023), (-0.005, 0.0215), (-0.006, 0.019))], cap0='pole', cap1='pole')
    P.append(P_(disc, "Gold", flat(GOLD), W_spine, subsurf=0, name="brooch"))
    P.append(P_(sphere(bc + Vector((0, -0.007, 0)), (0.009, 0.005, 0.009), 12, 8), "Gold", flat(GEM), W_spine, subsurf=0, name="gem"))
    # cape: hangs from under the capelet at the back
    rows = []
    zs = [1.44, 1.38, 1.30, 1.18, 1.06, 0.95, 0.885, 0.876, 0.866, 0.855]
    n = 21
    for z in zs:
        t = (1.44 - z) / (1.44 - 0.855)
        hw = 0.150 + 0.075 * t
        _, _, _, rb = torso_dims(max(z, 1.0))
        yb = -0.042 + rb + 0.026 + 0.090 * t ** 1.3
        row = []
        for j in range(n):
            u = -1 + 2 * j / (n - 1)
            fold = 0.020 * math.cos(u * math.pi * 2.5) * sstep(0.1, 0.7, t)
            wrap = 0.075 * u * u * (1 - sstep(0.0, 0.45, t))
            row.append(Vector((u * hw, yb - wrap + fold + 0.02 * u * u * t, z - 0.012 * u * u * t)))
        rows.append(row)
    def capec(p, n):
        inside = n.y < -0.1
        if p.z < 0.871 and not inside: return GOLD
        return cloth(RED_IN if inside else RED, 0.07)(p, n)
    P.append(P_(grid_panel(rows), "Cape", capec, W_cape, subsurf=1, solidify=0.007, sol_offset=1.0, name="cape"))
    return P

# ================================================================ build
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    info = read_joints()
    parts = body_parts()
    allv, allf, fmat, cols, wts, mats = [], [], [], [], [], []
    stats = {}
    for part in parts:
        vs, ns, fs = realize(part)
        if part.mat not in mats: mats.append(part.mat)
        mi = mats.index(part.mat); base = len(allv)
        for v, n in zip(vs, ns):
            allv.append(v); cols.append(part.color(v, n))
            w = part.weight(v)
            w = dict(sorted(w.items(), key=lambda kv: -kv[1])[:4]); s = sum(w.values()) or 1.0
            wts.append({b: x / s for b, x in w.items() if x / s > 1e-3})
        for f in fs:
            allf.append(tuple(base + i for i in f)); fmat.append(mi)
        stats[part.name] = stats.get(part.name, 0) + sum(len(f) - 2 for f in fs)
    print("PARTS", stats)
    me = bpy.data.meshes.new("Player_Mesh")
    me.from_pydata([tuple(v) for v in allv], [], allf); me.update()
    ob = bpy.data.objects.new("Player_Body", me); bpy.context.scene.collection.objects.link(ob)
    for key in mats: me.materials.append(make_material(f"player_{key}", key))
    for i, p in enumerate(me.polygons):
        p.material_index = fmat[i]; p.use_smooth = True
    ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(cols): ca.data[i].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = ca
    names = sorted({b for w in wts for b in w})
    groups = {bn: ob.vertex_groups.new(name=bn) for bn in names}
    for i, w in enumerate(wts):
        for bn, x in w.items(): groups[bn].add([i], x, 'REPLACE')
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    print("TRIS", len(me.polygons), "VERTS", len(me.vertices), "GROUPS", len(names))
    import v2_bake
    v2_bake.texture(ob, bake=not NOBAKE)
    return ob, info

def graft_and_export(ob, info):
    arm = info["arm"]
    M = info["mw"]
    ob.data.transform(M.inverted())
    ob.parent = info["parent"]; ob.parent_type = info["ptype"]
    ob.matrix_parent_inverse = info["mpi"]; ob.matrix_basis = info["mb"]
    bpy.context.view_layer.update()
    mod = ob.modifiers.new("Armature", 'ARMATURE'); mod.object = arm
    for x in list(bpy.data.objects):
        if x.type == 'MESH' and x is not ob: bpy.data.objects.remove(x)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    for x in bpy.data.objects: x.select_set(False)
    ob.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    os.makedirs(os.path.dirname(OUT_MESH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT_MESH, export_format='GLB', use_selection=True, export_animations=False,
                              export_skins=True, export_yup=True, export_apply=False, export_cameras=False, export_lights=False,
                              export_draco_mesh_compression_enable=False, export_vertex_color='NONE',
                              export_image_format='WEBP', export_image_quality=88, export_tangents=False)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_MESH.replace(".glb", ".blend"))
    print("EXPORTED", OUT_MESH, os.path.getsize(OUT_MESH))

if __name__ == "__main__":
    ob, info = build()
    graft_and_export(ob, info)
