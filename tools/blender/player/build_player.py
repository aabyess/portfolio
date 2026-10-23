# Player hero ("young medieval adventurer / prince of 상호랜드") for models/player.glb.
#
# The body/garments are generated with the same NPC toolkit (tools/blender/npc_real: metaball hands,
# SDF head + hair shell, lofted torso/legs/sleeves, vertex colour -> baked 1024 albedo/normal), but
# then WARPED from the NPC skeleton space onto the person.glb (Quaternius) bind pose — arms in T-pose,
# longer legs, narrow torso — and weighted procedurally to person.glb's own bone names.
#
# Output of this script: a mesh-only skinned glb (tmp) that splice_player.py grafts into a copy of
# person.glb, so the armature, node default pose, skins' joint order and all 24 clips stay byte-identical.
#
# Run: Blender -b --factory-startup --python build_player.py -- [--nobake] [--out /path/mesh.glb]
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "tools", "blender", "npc_real"))
_argv = sys.argv
sys.argv = [sys.argv[0]]          # build_real parses sys.argv at import
import bpy, bmesh
from mathutils import Vector, Matrix, Quaternion
from lib_real import *
from body_real import *
from body2 import *
from build_real import PAL, C_cloth, cut, cuff, hair_cap
sys.argv = _argv
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOBAKE = "--nobake" in ARGS
OUT_MESH = ARGS[ARGS.index("--out") + 1] if "--out" in ARGS else "/Users/sang/.claude/jobs/02a78233/tmp/player/player_mesh.glb"
PERSON = os.path.join(REPO, "models", "person.glb")

# ================================================================ palette (linear)
BLUE = (0.035, 0.075, 0.30)      # royal blue tunic
BLUE_D = (0.022, 0.045, 0.19)
GOLD = PAL["gold"]
RED = (0.36, 0.025, 0.03)         # cape
RED_IN = (0.20, 0.018, 0.022)     # cape lining (dark red)
TROUS = (0.10, 0.075, 0.06)       # dark brown hose
BOOT = (0.20, 0.10, 0.045)
GLOVE = (0.26, 0.15, 0.07)
SKIN = (0.66, 0.44, 0.31)
HAIR = (0.11, 0.065, 0.035)

# ================================================================ person.glb bind pose (Blender world, Z up, faces -Y)
SH_P = {1: Vector((0.153, -0.060, 1.432)), -1: Vector((-0.153, -0.060, 1.432))}
EL_P = {1: Vector((0.334, -0.056, 1.432)), -1: Vector((-0.334, -0.056, 1.432))}
WR_P = {1: Vector((0.568, -0.086, 1.432)), -1: Vector((-0.568, -0.086, 1.432))}
SNAME = {1: "L", -1: "R"}

# ================================================================ NPC-space -> person-space warp
ZMAP = [(-1.0, -1.0), (0.0, 0.0), (0.09, 0.095), (0.50, 0.533), (0.92, 0.964), (1.42, 1.432), (1.47, 1.488), (1.56, 1.585), (3.0, 3.025)]
def zmap(z):
    for (a, A), (b, B) in zip(ZMAP, ZMAP[1:]):
        if a <= z <= b: return A + (B - A) * (z - a) / (b - a)
    return z
def leg_dy(zp):  # knee sits ~4 cm forward of the hip line in the person rig
    pts = [(-1, -0.012), (0.023, -0.012), (0.533, -0.037), (0.964, 0.005), (3, 0.005)]
    for (a, A), (b, B) in zip(pts, pts[1:]):
        if a <= zp <= b: return A + (B - A) * (zp - a) / (b - a)
    return 0.0
HEAD_PIV_N = Vector((0, 0.0, 1.56)); HEAD_S = 1.07

def warp_body(p):
    """torso / garments / head: narrower chest, z remap, head enlarged a little."""
    z = p.z
    fx = 1 - 0.15 * sstep(0.98, 1.20, z) * (1 - sstep(1.47, 1.55, z))
    q = Vector((p.x * fx, p.y, z))
    s = 1 + (HEAD_S - 1) * sstep(1.50, 1.60, z)
    q = HEAD_PIV_N + (q - HEAD_PIV_N) * s
    return Vector((q.x, q.y - 0.05, zmap(q.z)))

def warp_leg(p, k):
    """legs / boots: leg centre 0.10 -> 0.121, thinner, knee forward."""
    cx = 0.10 * k
    f = 0.80 + 0.17 * sstep(0.86, 0.58, p.z)      # slimmer thigh tops so they stay under the tunic
    x = 0.121 * k + (p.x - cx) * f
    y = p.y * (0.88 + 0.10 * sstep(0.86, 0.58, p.z))
    zp = zmap(p.z)
    return Vector((x, y - 0.05 + leg_dy(zp), zp))

def _seg(p, a_n, b_n, a_p, b_p, sr):
    dn = b_n - a_n; Ln = dn.length; dn = dn / Ln
    dp = b_p - a_p; Lp = dp.length; dp = dp / Lp
    Q = dn.rotation_difference(dp)
    v = p - a_n; ax = v.dot(dn); rad = v - dn * ax
    return a_p + dp * (ax * Lp / Ln) + Q @ (rad * sr), ax, Q

HAND_S = 1.28
def warp_arm(p, k):
    sh, el, wr = arm_path(k)
    pu, axu, Qu = _seg(p, sh, el, SH_P[k], EL_P[k], 0.92)
    pl, axl, Ql = _seg(p, el, wr, EL_P[k], WR_P[k], 0.95)
    ph = WR_P[k] + Ql @ ((p - wr) * HAND_S)
    dl = (wr - el).normalized()
    a_el = (p - el).dot(dl); a_wr = (p - wr).dot(dl)
    w1 = sstep(-0.03, 0.03, a_el)
    w2 = sstep(-0.012, 0.012, a_wr)
    q = pu.lerp(pl, w1)
    return q.lerp(ph, w2)

# ================================================================ person-space weights
SP_PTS = [(0, -0.05, 0.78), (0, -0.05, 0.999), (0, -0.045, 1.161), (0, -0.041, 1.377), (0, -0.043, 1.511), (0, -0.043, 1.587), (0, -0.043, 2.0)]
SP_B = ["Hips", "Abdomen", "Torso", "Chest", "Neck", "Head"]
SP_HW = [0.05, 0.07, 0.07, 0.03, 0.03]
def Wp_spine(p): return chain_w(Vector((0, -0.045, p.z)), SP_PTS, SP_B, SP_HW)

def _add(w, extra, a):
    w = {b: x * (1 - a) for b, x in w.items()}
    for b, x in extra.items(): w[b] = w.get(b, 0) + x * a
    return w

def Wp_body(p):
    w = Wp_spine(p)
    if p.z < 1.02:   # pelvis / crotch -> thighs
        t = 1 - sstep(0.86, 1.02, p.z)
        wl = sstep(-0.09, 0.09, p.x)
        w = _add(w, {"UpperLeg.L": wl, "UpperLeg.R": 1 - wl}, t)
    if abs(p.x) > 0.05 and p.z > 1.30:  # shoulder caps ride the shoulder bone
        k = 1 if p.x > 0 else -1
        d = (p - Vector((0.13 * k, -0.055, 1.42))).length
        a = 0.6 * (1 - sstep(0.03, 0.11, d))
        if a > 0: w = _add(w, {f"Shoulder.{SNAME[k]}": 1.0}, a)
    return w

def Wp_arm(k):
    s = SNAME[k]
    pts = [Vector((0.06 * k, -0.06, 1.425)), SH_P[k], EL_P[k], WR_P[k], WR_P[k] + Vector((0.3 * k, 0, 0))]
    return lambda p: chain_w(p, pts, [f"Shoulder.{s}", f"UpperArm.{s}", f"LowerArm.{s}", f"Wrist.{s}"], [0.03, 0.045, 0.025])

def Wp_leg(k):
    s = SNAME[k]
    pts = [(0.121 * k, -0.05, 1.10), (0.121 * k, -0.045, 0.964), (0.121 * k, -0.087, 0.533), (0.121 * k, -0.062, -0.05)]
    def f(p):
        w = chain_w(p, pts, ["Hips", f"UpperLeg.{s}", f"LowerLeg.{s}"], [0.07, 0.06])
        t = sstep(0.075, 0.14, p.z)   # boot foot -> Foot (IK bone, pivot on the ground)
        if t < 1: w = _add(w, {f"Foot.{s}": 1.0}, 1 - t)
        return w
    return f

def Wp_skirt(p):
    w = Wp_spine(p)
    t = 0.90 * (1 - sstep(0.80, 1.02, p.z))
    wl = sstep(-0.10, 0.10, p.x)
    return _add(w, {"UpperLeg.L": wl, "UpperLeg.R": 1 - wl}, t)

def Wp_cape(p):
    return Wp_spine(Vector((p.x, p.y, max(p.z, 1.06))))

# ================================================================ hero parts (NPC space)
def hero_parts():
    o = dict(skin=SKIN, iris=(0.07, 0.11, 0.20), brow_col=(0.10, 0.06, 0.03), brow_thick=1.15, blush=0.22, jaw=1.02)
    hair = hair_cap(0.004, front_z=1.648, front_y=-0.090)
    hair.add('ell', (0, 0.020, 1.735), (0.088, 0.104, 0.090), k=0.02)                     # volume on top
    hair.add('cap', (-0.052, -0.080, 1.758), (0.028, -0.094, 1.724), 0.013, k=0.016)      # swept fringe
    hair.add('cap', (0.030, -0.088, 1.752), (0.062, -0.068, 1.726), 0.010, k=0.012)
    hair.add('ell', (0, 0.075, 1.600), (0.070, 0.050, 0.050), k=0.03)                     # nape
    hair.sub('ell', (0.085, 0.010, 1.650), (0.022, 0.028, 0.030), k=0.004, mirror=True)  # keep ears free
    o.update(hair_sdf=hair, hair_col=HAIR, hair_tris=1800)
    P = []
    def nose_post(co, n):   # younger face: pull the nose tip in a little
        g = gauss(co, (0, -0.104, 1.646), 0.022)
        if co.y < -0.086: co = Vector((co.x, co.y + 0.30 * g * (-0.086 - co.y), co.z))
        return co
    for pt in head_parts(o):
        pt.kind = "head"
        if pt.name == "head": pt.post = nose_post
        P.append(pt)

    # ---- tunic (torso) : royal blue, gold neckline trim + gold crown emblem panel added below
    def tunic(p, n):
        base = GOLD if 1.468 < p.z < 1.492 else BLUE
        m = 1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420)
        return tuple(clamp(x * m) for x in base)
    o.update(torso_col=tunic)
    P.append(Part(torso_geo(o), "Cloth", tunic, None, subsurf=1, name="torso")); P[-1].kind = "body"
    for s in SIDE:
        k = SIDE[s]
        lg = Part(leg_geo(s, o, z_top=0.98, z_bot=0.30), "Cloth", C_cloth(TROUS, 0.07), None, subsurf=0, name="leg"); lg.kind = f"leg{k}"; P.append(lg)
        def slv(p, n, k=k):
            t = (Vector(p) - arm_path(k)[0]).length
            base = GOLD if 0.505 < t < 0.525 else BLUE
            m = 1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420)
            return tuple(clamp(x * m) for x in base)
        ar = Part(arm_geo(s, o, start=0.0, end=0.86), "Cloth", slv, None, subsurf=0, name="arm"); ar.kind = f"arm{k}"; P.append(ar)
        # leather gauntlet cuff over the wrist
        g = Part(cuff(s, o, 0.86, 0.006, 0.10, flare=0.006), "Leather", C_cloth(GLOVE, 0.10), None, subsurf=1, solidify=0.004, name="gauntlet"); g.kind = f"arm{k}"; P.append(g)
    for hp in hands_parts(o, glove=GLOVE):
        hp.kind = "hand" + ("1" if sum(v.x for v in hp.verts) > 0 else "-1"); hp.decimate = 800; P.append(hp)
    # ---- tall riding boots with turned-down cuff
    for sp in shoe_parts(o, BOOT, boot_h=0.38, boot_col=BOOT):
        sp.kind = "leg" + ("1" if sum(v.x for v in sp.verts) > 0 else "-1"); P.append(sp)
    for s, k in SIDE.items():
        rings = [hring((0.10 * k, 0.0, z), r, r, r * 1.05, n=18) for z, r in ((0.345, 0.056), (0.372, 0.064), (0.392, 0.066))]
        bc = Part(loft(rings), "Leather", C_cloth(mul(BOOT, 1.25), 0.1), None, subsurf=1, solidify=0.004, name="bootcuff"); bc.kind = f"leg{k}"; P.append(bc)

    # ---- tunic skirt to mid-thigh with gold hem
    zs = [1.06, 0.98, 0.88, 0.79, 0.715]
    gr = [0.010, 0.026, 0.046, 0.062, 0.074]
    def skirtc(p, n):
        base = GOLD if p.z < 0.738 else (BLUE_D if p.z < 0.75 else BLUE)
        m = 1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420)
        return tuple(clamp(x * m) for x in base)
    sk = Part(skirt_geo(o, zs, gr, n=32, nf=10, amp=0.028), "Cloth", skirtc, None, subsurf=1, solidify=0.005, name="skirt"); sk.kind = "skirt"; P.append(sk)
    # ---- belt + gold buckle + pouch
    bt = Part(belt(o, 1.025, 0.042, gap=0.022), "Leather", C_cloth((0.13, 0.065, 0.03), 0.1), None, subsurf=1, solidify=0.005, name="belt"); bt.kind = "body"; P.append(bt)
    rx, ryf, ryb = torso_dims(o, 1.025)
    bk = Part(loft([ring((0, -(ryf + 0.030), 1.025), Vector((1, 0, 0)), Vector((0, 0, 1)), 0.024, 0.024, 4, phase=math.pi / 4, sq=2.0),
                    ring((0, -(ryf + 0.036), 1.025), Vector((1, 0, 0)), Vector((0, 0, 1)), 0.022, 0.022, 4, phase=math.pi / 4)], cap0='pole', cap1='pole'),
              "Gold", C_var(GOLD, 0.05), None, subsurf=0, name="buckle"); bk.kind = "body"; P.append(bk)
    pouch = sphere((0.150, -0.060, 0.975), (0.030, 0.024, 0.040), 8, 6)
    pc = Part(pouch, "Leather", C_cloth((0.22, 0.12, 0.05), 0.12), None, subsurf=1, name="pouch"); pc.kind = "skirt"; P.append(pc)
    # ---- crown emblem on the chest (gold): band + three points
    eg = panel_geo(o, 1.300, 1.275, 0.040, 0.040, gap=0.0125, rows=2, cols=5)
    ep = Part(eg, "Gold", C_var(GOLD, 0.05), None, subsurf=0, solidify=0.003, name="emblem"); ep.kind = "body"; P.append(ep)
    for x0, ztop in ((-0.030, 1.326), (0.0, 1.338), (0.030, 1.326)):
        rows = []
        for z in (1.300, ztop):
            hw = 0.011 if z == 1.300 else 0.0015
            row = []
            for u in (-1, 0, 1):
                x = x0 + u * hw
                rxx, ryy, _ = torso_dims(o, z)
                q = clamp(abs(x) / (rxx + 0.015), 0, 0.97)
                yb = ryy * math.sqrt(1 - q * q) * torso_bump(o, z)(math.atan2(math.sqrt(1 - q * q), q))
                row.append(Vector((x, -(yb + 0.0125) + 0.004, z)))
            rows.append(row)
        tp = Part(grid_panel(rows), "Gold", C_var(GOLD, 0.05), None, subsurf=0, solidify=0.003, name="emblem"); tp.kind = "body"; P.append(tp)

    # ---- short cape hanging from the shoulders (red, ochre lining), clasps in front
    rows = []
    zs_c = (1.505, 1.465, 1.40, 1.31, 1.21, 1.11, 1.01, 0.93, 0.87)
    for i, z in enumerate(zs_c):
        t = (1.505 - z) / (1.505 - 0.87)
        hw = 0.10 + 0.085 * sstep(0.0, 0.25, t) + 0.035 * t
        _, _, rb = torso_dims(o, max(z, 0.95))
        yb = max(rb, 0.07) + 0.022 + 0.05 * t ** 1.2
        if z > 1.49: yb = 0.068
        row = []
        n = 11
        for j in range(n):
            u = -1 + 2 * j / (n - 1)
            fold = 0.016 * math.cos(u * math.pi * 2.5) * sstep(0.15, 0.7, t)
            wrap = 0.06 * u * u * (1 - sstep(0.0, 0.5, t))      # wrap forward over the shoulder tops
            row.append(Vector((u * hw, yb - wrap + fold + 0.015 * u * u * t, z - 0.01 * u * u * (1 - t))))
        rows.append(row)
    def capec(p, n):
        inside = n.y < -0.2 and p.z < 1.45
        base = RED_IN if inside else RED
        if p.z < 0.94 and not inside: base = mix(RED, GOLD, 0.0)
        m = 1 + 0.08 * fbm(p, 20) + 0.03 * noise.noise(Vector(p) * 420)
        return tuple(clamp(x * m) for x in base)
    cp = Part(grid_panel(rows), "Cloth", capec, None, subsurf=1, solidify=0.008, name="cape"); cp.kind = "cape"; P.append(cp)
    for k in (1, -1):
        cl = Part(sphere((0.105 * k, -0.075, 1.455), (0.016, 0.008, 0.016), 10, 6), "Gold", C_var(GOLD, 0.05), None, subsurf=0, name="clasp"); cl.kind = "body"; P.append(cl)
    ch = Part(tube([(0.10, -0.082, 1.452), (0.05, -0.105, 1.41), (0.0, -0.112, 1.395), (-0.05, -0.105, 1.41), (-0.10, -0.082, 1.452)], [0.0035] * 5, n=6, cap0=None, cap1=None, up=(0, 0, 1)),
              "Gold", C_var(GOLD, 0.05), None, subsurf=0, name="chain"); ch.kind = "body"; P.append(ch)
    return P, o

# ================================================================ circlet from the realised hair
def circlet_parts(realised):
    pts = []
    for part, (vs, ns, fs) in realised:
        if part.name in ("hair", "head"): pts += vs
    out = []
    zc = 1.742
    def zt(y): return zc - 0.012 * sstep(0.0, -0.10, y)          # dips slightly toward the brow
    sl = [p for p in pts if abs(p.z - zt(p.y)) < 0.006]
    n = 36; rings_in, rings_out = [], []
    rad = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), -math.sin(a), 0))
        best = 0.0
        for p in sl:
            q = Vector((p.x, p.y - 0.012, 0))
            if q.length < 1e-6: continue
            if q.normalized().dot(d) > 0.985: best = max(best, q.length)
        rad.append(best)
    for i in range(n):  # fill holes / smooth
        if rad[i] == 0: rad[i] = max(rad[i - 1], rad[(i + 1) % n])
    for _ in range(2): rad = [(rad[i - 1] + 2 * rad[i] + rad[(i + 1) % n]) / 4 for i in range(n)]
    lo, hi = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), -math.sin(a), 0)); r = rad[i] + 0.003
        c = Vector((0, 0.012, 0)) + d * r
        z = zt(c.y)
        lo.append(Vector((c.x, c.y, z - 0.0085))); hi.append(Vector((c.x, c.y, z + 0.0085)))
    out.append(Part(loft([lo, hi]), "Gold", C_var(GOLD, 0.05), None, subsurf=0, solidify=0.004, sol_offset=1.0, name="circlet"))
    # front point + sapphire
    i0 = n // 4    # angle 90deg = front (-Y)
    f = hi[i0]; fl = lo[i0]
    tip = Vector((0, f.y - 0.004, f.z + 0.020))
    tri = ([Vector((-0.014, fl.y, f.z - 0.002)), Vector((0.014, fl.y, f.z - 0.002)), tip], [(0, 1, 2)])
    out.append(Part(tri, "Gold", C_var(GOLD, 0.05), None, subsurf=0, solidify=0.004, sol_offset=1.0, name="circlet"))
    out.append(Part(sphere((0, fl.y - 0.006, f.z - 0.004), (0.0065, 0.004, 0.0075), 10, 6), "Eye", lambda p, n: (0.03, 0.10, 0.55), None, subsurf=0, name="gem"))
    for p in out: p.kind = "head"
    return out

# ================================================================ build
def weight_for(kind, p):
    if kind == "head" or kind == "body": return Wp_body(p) if kind == "body" else Wp_spine(p)
    if kind.startswith("arm"): return Wp_arm(int(kind[3:]))(p)
    if kind.startswith("hand"): return {f"Wrist.{SNAME[int(kind[4:])]}": 1.0}
    if kind.startswith("leg"): return Wp_leg(int(kind[3:]))(p)
    if kind == "skirt": return Wp_skirt(p)
    if kind == "cape": return Wp_cape(p)
    raise ValueError(kind)

def warp_for(kind, p):
    if kind.startswith("arm"): return warp_arm(p, int(kind[3:]))
    if kind.startswith("hand"): return warp_arm(p, int(kind[4:]))
    if kind.startswith("leg"): return warp_leg(p, int(kind[3:]))
    return warp_body(p)

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts, o = hero_parts()
    realised = []
    for part in parts:
        vs, ns, fs = realize(part)
        realised.append((part, (vs, ns, fs)))
    for part in circlet_parts(realised):
        realised.append((part, realize(part)))
    allv, allf, fmat, cols, wts, mats = [], [], [], [], [], []
    stats = {}
    for part, (vs, ns, fs) in realised:
        if part.mat not in mats: mats.append(part.mat)
        mi = mats.index(part.mat); base = len(allv)
        for v, n in zip(vs, ns):
            q = warp_for(part.kind, v)
            allv.append(q)
            cols.append(part.color(v, n))
            w = weight_for(part.kind, q)
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
    # triangulate (keeps glTF and the tri count honest)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    tris = len(me.polygons)
    print("TRIS", tris, "VERTS", len(me.vertices), "GROUPS", names)
    if not NOBAKE:
        from bake_real import bake_textures
        bake_textures(ob, "player", res=1024)
    return ob

def graft_and_export(ob):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=PERSON)
    new = [x for x in bpy.data.objects if x not in before]
    arm = next(x for x in new if x.type == 'ARMATURE')
    ref = next(x for x in new if x.name == "Casual2_Body")
    # same parenting/transform as the original skinned meshes: local coords = world / 100
    M = ref.matrix_world.copy()
    ob.data.transform(M.inverted())
    ob.parent = ref.parent; ob.parent_type = ref.parent_type
    ob.matrix_parent_inverse = ref.matrix_parent_inverse.copy(); ob.matrix_basis = ref.matrix_basis.copy()
    bpy.context.view_layer.update()
    print("MW match", (ob.matrix_world - M).to_3x3().is_identity if False else max(abs(a - b) for ra, rb in zip(ob.matrix_world, M) for a, b in zip(ra, rb)))
    mod = ob.modifiers.new("Armature", 'ARMATURE'); mod.object = arm
    for x in new:
        if x.type == 'MESH': bpy.data.objects.remove(x)
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
                              export_image_format='WEBP', export_image_quality=85, export_tangents=False)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_MESH.replace(".glb", ".blend"))
    print("EXPORTED", OUT_MESH, os.path.getsize(OUT_MESH))

if __name__ == "__main__":
    ob = build()
    graft_and_export(ob)
