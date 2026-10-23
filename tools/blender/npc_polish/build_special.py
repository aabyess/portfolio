# Special NPCs on the v5 villager toolkit: King 최상호 (npc-king) and the tavern barmaid (npc-barmaid).
# Same 18-bone rig, same 10 clips, same sit height, same export settings as build_polish.py.
# Run: Blender -b --factory-startup --python build_special.py -- [king] [barmaid] [--noexport]
#   env NPC_OUT=<dir> writes GLBs there instead of models/npc (and skips the .blend save)
# Notes
#   king    : crown/beard follow Head; scepter is rigid on Hand.L (Prop.R is scaled to 0.001 outside
#             Sit/Drink/Cheers, so a Prop.R scepter would vanish while walking). Tankard on Prop.R as usual.
#   barmaid : no baked tankard (the game attaches its own beer mug to Prop.R). eye_scale/lash options
#             live in body_real.py (default 1.0 = unchanged villagers).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Euler, Matrix
from lib_real import *
from body_real import *
from body2 import *
from build_polish import PAL, C_cloth, cut, open_torso, cuff, neck_trim, neck_mix, hair_cap, C_skin_arm

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOEXPORT = "--noexport" in ARGS
ONLY = [a for a in ARGS if not a.startswith("--")]

GOLD = (0.80, 0.56, 0.14)

def ermine_col(base=(0.86, 0.84, 0.79), dens=0):
    """White ermine fur (the black tails are real geometry, see ermine_spots: vertex colours are too coarse)."""
    def c(p, n):
        m = 1 + 0.07 * fbm(p, 60) + 0.05 * noise.noise(Vector(p) * 600)
        return tuple(clamp(x * m) for x in base)
    return c

def ermine_spots(verts, n, ring_ids, weight, w=0.0065, h=0.017, lift=0.003, skip=2, lerp_next=0.0):
    """Black ermine tails as tiny closed diamonds sitting on a loft's outer surface (vertex colours alone
    are too coarse to show them). verts: loft verts (n per ring); ring_ids: rings to decorate."""
    P = []; V = [Vector(v) for v in verts]
    for i in ring_ids:
        for j in range((i % 2), n, skip):
            p = V[i * n + j]
            if lerp_next: p = p.lerp(V[(i + 1) * n + j], lerp_next)
            t1 = V[i * n + (j + 1) % n] - V[i * n + (j - 1) % n]
            t2 = V[(i - 1) * n + j] - V[(i + 1) * n + j]
            nn = t1.cross(t2).normalized()
            if nn.dot(Vector((p.x, p.y - 0.01, 0))) < 0: nn = -nn
            up = (t2 - nn * t2.dot(nn)).normalized(); side = nn.cross(up)
            c = p + nn * lift
            vs = [c + up * h * 0.45, c + side * w, c - up * h * 0.55, c - side * w, c + nn * 0.0025, c - nn * 0.0025]
            fs = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)]
            P.append(Part((vs, fs), "Hair", lambda q, m: (0.025, 0.02, 0.018), weight, subsurf=0, name="espot"))
    return P

def crown_parts():
    P = []
    y0 = 0.014
    gold = C_var(GOLD, 0.05, 40)
    # velvet cap inside the crown (reads as a royal crown, not a ring, from far away)
    v, f = sphere((0, y0, 1.770), (0.090, 0.107, 0.078), 20, 10)
    v = [Vector((q.x, q.y, max(q.z, 1.770))) for q in v]
    P.append(Part((v, f), "Cloth", C_cloth((0.45, 0.02, 0.03), 0.06), W_head, subsurf=0, name="crowncap"))
    # band (slightly flared upwards)
    rings = [hring((0, y0, z), rx, ry, ry, n=32) for z, rx, ry in ((1.738, 0.0935, 0.1115), (1.762, 0.0960, 0.1140), (1.790, 0.0990, 0.1170))]
    P.append(Part(loft(rings), "Gold", gold, W_head, subsurf=0, solidify=0.005, sol_offset=1.0, name="crownband"))
    for z in (1.741, 1.787):   # rolled rims
        rr = [Vector((math.cos(a) * (0.0955 + (z - 1.738) * 0.11), y0 - math.sin(a) * (0.1135 + (z - 1.738) * 0.11), z)) for a in [2 * math.pi * i / 20 for i in range(21)]]
        P.append(Part(tube(rr, [0.0045] * 21, n=4, cap0=None, cap1=None, up=(0, 0, 1)), "Gold", gold, W_head, subsurf=0, name="crownrim"))
    # 8 points (tall fleur points front/back/sides, short ones between), each with a pearl/ball
    for i in range(8):
        a = math.pi / 2 + 2 * math.pi * i / 8
        tall = i % 2 == 0
        h = 0.060 if tall else 0.036
        bx, by = math.cos(a) * 0.1005, y0 - math.sin(a) * 0.1185
        ox, oy = math.cos(a) * 0.008, -math.sin(a) * 0.008
        pts = [(bx, by, 1.786), (bx + ox * 0.3, by + oy * 0.3, 1.786 + h * 0.6), (bx + ox * 0.5, by + oy * 0.5, 1.786 + h)]
        P.append(Part(tube(pts, [0.014, 0.008, 0.003], n=6, cap0='pole', cap1='pole', up=(0, 0, 1)), "Gold", gold, W_head, subsurf=0, name="crownpt"))
        P.append(Part(sphere((bx + ox * 0.5, by + oy * 0.5, 1.786 + h + 0.006), (0.008, 0.008, 0.008), 6, 4), "Gold", gold, W_head, subsurf=0, name="crownball"))
    # gems on the band: big red in front, blue on the sides, red at the back
    for a, col, r in ((math.pi / 2, (0.55, 0.02, 0.03), 0.011), (math.pi / 2 + 0.55, (0.04, 0.10, 0.50), 0.008), (math.pi / 2 - 0.55, (0.04, 0.10, 0.50), 0.008),
                      (math.pi / 2 + 1.25, (0.55, 0.02, 0.03), 0.008), (math.pi / 2 - 1.25, (0.55, 0.02, 0.03), 0.008),
                      (math.pi / 2 + 2.0, (0.04, 0.10, 0.50), 0.008), (math.pi / 2 - 2.0, (0.04, 0.10, 0.50), 0.008), (-math.pi / 2, (0.55, 0.02, 0.03), 0.010)):
        gx, gy = math.cos(a) * 0.1030, y0 - math.sin(a) * 0.1215
        P.append(Part(sphere((gx, gy, 1.764), (r, r, r), 6, 4), "Eye", lambda p, n, c=col: c, W_head, subsurf=0, name="gem"))
    # little orb + cross on the top
    P.append(Part(sphere((0, y0, 1.852), (0.012, 0.012, 0.012), 10, 8), "Gold", gold, W_head, subsurf=0, name="orb"))
    P.append(Part(tube([(0, y0, 1.860), (0, y0, 1.892)], [0.0035, 0.0035], n=6, up=(1, 0, 0)), "Gold", gold, W_head, subsurf=0, name="cross"))
    P.append(Part(tube([(-0.011, y0, 1.880), (0.011, y0, 1.880)], [0.0035, 0.0035], n=6, up=(0, 0, 1)), "Gold", gold, W_head, subsurf=0, name="cross2"))
    return P

def scepter_parts():
    """Rigid on Hand.L, passing through the curled left fist, tilted forward-up."""
    P = []
    gold = C_var(GOLD, 0.05, 40)
    a = Vector((0.236, 0.075, 0.730)); b = Vector((0.236, -0.130, 1.215))
    d = (b - a).normalized()
    P.append(Part(tube([a, a.lerp(b, 0.5), b], [0.0085, 0.0085, 0.0095], n=8, up=(1, 0, 0)), "Gold", gold, W_const("Hand.L"), subsurf=0, name="scepter"))
    for t in (0.0, 0.35, 0.92):
        c = a.lerp(b, t)
        P.append(Part(sphere(c, (0.0135, 0.0135, 0.0135), 8, 4), "Gold", gold, W_const("Hand.L"), subsurf=0, name="sknob"))
    top = b + d * 0.030
    P.append(Part(sphere(top, (0.032, 0.032, 0.032), 12, 8), "Gold", gold, W_const("Hand.L"), subsurf=0, name="shead"))
    P.append(Part(sphere(top + d * 0.040, (0.018, 0.018, 0.018), 10, 8), "Eye", lambda p, n: (0.55, 0.02, 0.03), W_const("Hand.L"), subsurf=0, name="sgem"))
    for k in (1, -1):   # small side wings on the head
        P.append(Part(tube([top + Vector((0.012 * k, 0, 0)), top + Vector((0.034 * k, 0, 0.020))], [0.006, 0.003], n=6, up=(0, 0, 1)), "Gold", gold, W_const("Hand.L"), subsurf=0, name="swing"))
    return P

# ================================================================ King 최상호
def king():
    skin = (0.66, 0.45, 0.31)
    crimson = (0.40, 0.025, 0.035); dcrim = (0.28, 0.015, 0.025)
    o = dict(skin=skin, broad=1.07, belly=0.10, age=0.6, head_tris=4900, hair_tris=1000, cheek=1.05, iris=(0.09, 0.06, 0.03), brow_col=(0.07, 0.05, 0.035), brow_thick=1.45,
             stubble=None, blush=0.30, face_scale=(1.01, 1.0, 1.0), nose=1.04, nose_len=1.0, chin=1.05)
    hair = hair_cap(0.001, front_z=1.652)
    beard = SDF()   # neat short full beard + moustache
    beard.add('ell', (0, -0.040, 1.592), (0.060, 0.062, 0.046), k=0)
    beard.add('ell', (0, -0.076, 1.566), (0.030, 0.030, 0.030), k=0.02)
    beard.add('cap', (0.003, -0.0990, 1.6195), (0.026, -0.0915, 1.6070), 0.0070, k=0.006, mirror=True)
    beard.add('cap', (0.026, -0.0915, 1.6070), (0.031, -0.0860, 1.5900), 0.0050, k=0.006, mirror=True)
    beard.sub('ell', (0, -0.040, 1.664), (0.082, 0.082, 0.050), k=0.004)
    beard.sub('ell', (0, -0.100, 1.6030), (0.0215, 0.016, 0.0058), k=0.003)
    beard.sub('cap', (0, 0.035, 1.62), (0, 0.035, 1.50), 0.046, k=0.01)
    hc = (0.065, 0.045, 0.030)
    o.update(hair_sdf=hair, hair_col=hc, beard_sdf=beard, beard_col=hc)
    P = head_parts(o)
    P += crown_parts()
    def torsoc(p, n):
        base = crimson
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in base)
    rc = C_cloth(crimson, 0.08)
    o.update(torso_col=torsoc, arm_col=rc, leg_col=C_cloth(dcrim), leg_top=0.45)
    P += body_parts(o)
    for p in P:
        if p.name == "torso": p.mat = "Cloth"
    # long robe to the ankles: crimson with an ermine hem band and a gold edge, gold stripe down the front
    # extra rings at 0.17/0.155 give a crisp crimson/ermine edge (colours are per vertex before the bake)
    zs = [1.08, 0.90, 0.64, 0.46, 0.27, 0.17, 0.155, 0.07]
    gr = [0.010, 0.032, 0.064, 0.086, 0.106, 0.116, 0.1175, 0.124]
    def robec(p, n):
        if p.z < 0.159: return ermine_col()(p, n)
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in crimson)
    N = 32
    robe = skirt_geo(o, zs, gr, n=N, nf=11, amp=0.03)
    rw = legblend3(0.97, 0.80, 0.60, 0.44, xw=0.14)
    P.append(Part(robe, "Cloth", robec, rw, subsurf=1, solidify=0.006, name="robe"))   # (solidify -> no subsurf: verts are exact)
    RV = [Vector(v) for v in robe[0]]
    rz = [RV[i * N].z for i in range(len(RV) // N)]
    i_edge = min(range(len(rz)), key=lambda i: abs(rz[i] - 0.1625)); i_low = min(range(len(rz)), key=lambda i: abs(rz[i] - 0.155))
    P += ermine_spots(robe[0], N, [i_low], rw, lerp_next=0.5, h=0.022, w=0.007)
    def outward(v, d=0.004):
        r = Vector((v.x, v.y - 0.004, 0)); return v + r.normalized() * d
    hem = [outward(RV[i_edge * N + j % N]) for j in range(N + 1)]
    P.append(Part(tube(hem, [0.0065] * (N + 1), n=6, cap0=None, cap1=None, up=(0, 0, 1)), "Gold", C_var(GOLD, 0.05), rw, subsurf=0, name="hemgold"))
    front = [outward(RV[i * N + N // 4], 0.003) for i in range(0, i_edge + 1)]
    front[0] = front[0] + Vector((0, 0, 0.02))
    P.append(Part(tube(front, [(0.0025, 0.017)] * len(front), n=6, up=(0, -1, 0)), "Gold", C_var(GOLD, 0.05), rw, subsurf=0, name="frontgold"))
    # gold belt with a big buckle
    P.append(Part(belt(o, 1.06, 0.045, 0.016), "Gold", C_var(GOLD, 0.05), W_torso, subsurf=1, solidify=0.004, name="belt"))
    P.append(Part(sphere((0, -0.130, 1.06), (0.030, 0.012, 0.028), 10, 6), "Gold", C_var(GOLD, 0.04), W_torso, subsurf=0, name="buckle"))
    P.append(Part(sphere((0, -0.141, 1.06), (0.011, 0.006, 0.011), 8, 6), "Eye", lambda p, n: (0.55, 0.02, 0.03), W_torso, subsurf=0, name="bgem"))
    # ermine cuffs + gold rings at the wrists
    for s in SIDE:
        P.append(Part(cuff(s, o, 0.84, 0.010, 0.07, flare=0.010), "Cloth", ermine_col(), W_arm(s), subsurf=1, solidify=0.004, name="ecuff"))
    # ermine shoulder cape (mantle) - the big white collar with black spots
    rings = []
    for z, rx, ry in ((1.545, 0.088, 0.080), (1.51, 0.150, 0.108), (1.46, 0.215, 0.138), (1.39, 0.252, 0.158), (1.31, 0.262, 0.165), (1.26, 0.262, 0.166)):
        rings.append(hring((0, 0.012, z), rx, ry, ry * 1.06, n=28, bump=fold_bump(8, 0.012 * sstep(1.50, 1.30, z))))
    mant = loft(rings)
    P.append(Part(mant, "Cloth", ermine_col(), W_torso, subsurf=1, solidify=0.012, name="ermine"))
    P += ermine_spots(mant[0], 28, [1, 2, 3, 4], W_torso)
    # long crimson cape down the back (stops at mid-calf so it stays above the floor when seated)
    rows = []
    for z in (1.42, 1.28, 1.12, 0.96, 0.80, 0.64, 0.50):
        hw = 0.235 + 0.085 * (1.42 - z); yb = 0.135 + 0.06 * (1.42 - z) ** 0.8
        row = []
        for j in range(11):
            u = -1 + 2 * j / 10
            y = yb + 0.03 * (1 - u * u) - 0.016 * math.cos(u * math.pi * 3.5) * sstep(1.3, 0.8, z)
            row.append(Vector((u * hw, y + 0.035 * u * u, z)))
        rows.append(row)
    def cape_w(p):
        if p.z > 1.0: return W_torso(p, arms=False)
        return W_torso(Vector((p.x, p.y, 1.0)), arms=False)
    def capec(p, n):
        return tuple(clamp(x * (1 + 0.08 * fbm(p, 22))) for x in dcrim)
    P.append(Part(grid_panel(rows), "Cloth", capec, cape_w, subsurf=1, solidify=0.007, name="cape"))
    # gold chain of office with a medallion on the chest (over the ermine)
    chain = []
    for i in range(13):
        t = -1 + 2 * i / 12
        chain.append(Vector((t * 0.150, -0.150 - 0.025 * (1 - t * t) + 0.02 * t * t, 1.40 - 0.075 * (1 - t * t))))
    P.append(Part(tube(chain, [0.0065] * 13, n=6, up=(0, -1, 0)), "Gold", C_var(GOLD, 0.05, 80), W_torso, subsurf=0, name="chain"))
    P.append(Part(sphere((0, -0.180, 1.315), (0.024, 0.008, 0.024), 12, 6), "Gold", C_var(GOLD, 0.04), W_torso, subsurf=0, name="medal"))
    P.append(Part(sphere((0, -0.189, 1.315), (0.010, 0.005, 0.010), 8, 6), "Eye", lambda p, n: (0.04, 0.10, 0.50), W_torso, subsurf=0, name="mgem"))
    P += scepter_parts()
    P += shoe_parts(o, (0.30, 0.03, 0.04))
    for p in P:   # tri budget: hands/shoes are mostly hidden by the cuffs and the robe
        if p.name == "hand": p.decimate = 650
        if p.name == "shoe": p.decimate = 240
    return P

def shorten_lower_face(parts, f=0.88, z0=1.645, z1=1.555, zn=1.50):
    """Compress the face below the nose (z1..z0) by f and fade the lift out down the neck (zn..z1).
    Colour functions are wrapped with the inverse map so lips/lash lines stay where they were painted."""
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

# ================================================================ Barmaid
def barmaid():
    skin = (0.78, 0.56, 0.43)
    o = dict(skin=skin, fem=True, belly=-0.08, jaw=0.90, chin=1.0, cheek=1.10, iris=(0.10, 0.22, 0.36), brow_col=(0.30, 0.17, 0.07), brow_thick=0.95,
             blush=0.85, blush_col=(0.86, 0.42, 0.40), eyeshadow=((0.50, 0.32, 0.36), 0.35), lips=1.20, lip=(0.68, 0.26, 0.26), mouth_w=1.12, smile=1.0, muzzle=0.75, jawline=0.6, eye_scale=1.20, lash=1.5, head_tris=6300, no_ears=True,
             face_scale=(0.95, 0.98, 0.965), nose=0.82, nose_len=0.86)
    hair = hair_cap(0.007, front_z=1.632, front_y=-0.092, ears=False)   # fuller hair over the ears
    hcol = (0.55, 0.32, 0.11)   # honey chestnut
    o.update(hair_sdf=hair, hair_col=hcol, hair_tris=1800)
    P = shorten_lower_face(head_parts(o), 0.86)
    # high ponytail -> braid down the back (follows Head at the top, Chest lower down)
    bpts = [(0, 0.095, 1.735), (0, 0.128, 1.69), (0, 0.140, 1.61), (0, 0.140, 1.53), (0, 0.133, 1.45), (0, 0.125, 1.37), (0, 0.118, 1.30)]
    braid_b = lambda i: (lambda a: 1 + 0.13 * math.sin(3 * a + i * 2.1))
    P.append(Part(tube(bpts, [0.030, 0.029, 0.027, 0.024, 0.021, 0.017, 0.010], n=10, bump=braid_b), "Hair", C_var(hcol, 0.12, 50),
                  lambda p: W_torso(p, arms=False, head=True), subsurf=1, name="braid"))
    # ribbon bow at the base of the ponytail (red) + a small white flower above the left ear
    rib = (0.62, 0.05, 0.06)
    for k in (1, -1):
        P.append(Part(sphere((0.030 * k, 0.122, 1.738), (0.030, 0.012, 0.019), 12, 6), "Cloth", C_cloth(rib, 0.05), W_head, subsurf=0, name="bow"))
        P.append(Part(tube([(0.006 * k, 0.122, 1.728), (0.016 * k, 0.130, 1.69), (0.020 * k, 0.132, 1.655)], [(0.010, 0.002), (0.011, 0.002), (0.009, 0.002)], n=4, up=(0, 1, 0)),
                      "Cloth", C_cloth(rib, 0.05), W_head, subsurf=1, name="ribtail"))
    P.append(Part(sphere((0, 0.126, 1.738), (0.012, 0.010, 0.013), 8, 6), "Cloth", C_cloth(rib, 0.05), W_head, subsurf=0, name="knot"))
    fc = Vector((0.086, -0.012, 1.752))
    for i in range(5):
        a = 2 * math.pi * i / 5
        off = Vector((0.0, math.cos(a), math.sin(a))) * 0.012
        P.append(Part(sphere(fc + off + Vector((0.004, 0, 0)), (0.004, 0.011, 0.011), 6, 4), "Cloth", lambda p, n: (0.86, 0.62, 0.66), W_head, subsurf=0, name="petal"))
    P.append(Part(sphere(fc + Vector((0.008, 0, 0)), (0.004, 0.005, 0.005), 6, 4), "Cloth", lambda p, n: (0.80, 0.55, 0.08), W_head, subsurf=0, name="fcentre"))
    # dirndl-style dress: white chemise, laced green bodice, red skirt, small white apron
    chem = (0.80, 0.78, 0.72); bod = (0.30, 0.025, 0.05); skirt = (0.13, 0.30, 0.62)   # burgundy bodice, cornflower skirt
    def torsoc(p, n):
        base = neck_mix(p, skin, bod if 1.03 < p.z < 1.345 else chem, 1.425, 0.110)
        return tuple(clamp(x * (1 + 0.05 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_skin_arm(skin), arm_mat="Skin", arm_start=0.25, leg_col=C_cloth((0.75, 0.72, 0.66)), leg_top=0.45)
    P += body_parts(o)
    P.append(neck_trim(o, 1.425, 0.110, C_cloth(chem, 0.03)))
    # bodice top edge + criss-cross lacing (gold-cream cord) on the front
    rx, ryf, ryb = torso_dims(o, 1.345)
    rim = [Vector((math.cos(a) * (rx + 0.004), -math.sin(a) * ((ryf if math.sin(a) > 0 else ryb) + 0.004) + 0.004, 1.345)) for a in [2 * math.pi * i / 28 for i in range(29)]]
    P.append(Part(tube(rim, [0.0045] * 29, n=6, cap0=None, cap1=None, up=(0, 0, 1)), "Cloth", C_cloth((0.20, 0.015, 0.03), 0.05), W_torso, subsurf=0, name="bodrim"))
    lace = (0.82, 0.68, 0.36)
    def front_y(x, z):
        rx, ryf, _ = torso_dims(o, z)
        q = clamp(abs(x) / (rx + 0.004), 0, 0.97); ang = math.atan2(math.sqrt(1 - q * q), q)
        return -ryf * math.sqrt(1 - q * q) * torso_bump(o, z)(ang) + 0.004 - 0.006
    zl = [1.07, 1.12, 1.17, 1.22, 1.27, 1.32]
    for i in range(len(zl) - 1):
        for k in (1, -1):
            x0, x1 = 0.022 * k, -0.022 * k
            pts = [Vector((x0, front_y(x0, zl[i]), zl[i])), Vector((0, front_y(0, (zl[i] + zl[i + 1]) / 2) - 0.002, (zl[i] + zl[i + 1]) / 2)), Vector((x1, front_y(x1, zl[i + 1]), zl[i + 1]))]
            P.append(Part(tube(pts, [0.0028] * 3, n=5, up=(0, -1, 0)), "Cloth", C_var(lace, 0.05), W_torso, subsurf=0, name="lace"))
    # puffed short chemise sleeves with a red ribbon edge
    for s in SIDE:
        P.append(Part(arm_geo(s, o, n=12, start=0.0, end=0.33, inflate=0.022, cap_bot=Vector((0, 0, 0.014))), "Cloth", C_cloth(chem, 0.04), W_arm(s), subsurf=1, name="puff"))
        P.append(Part(cuff(s, o, 0.315, 0.012, 0.016), "Cloth", C_cloth(rib, 0.05), W_arm(s), subsurf=0, name="sleeverib"))
    # full red skirt to the ankles with a gold hem stripe
    zs = [1.05, 0.95, 0.80, 0.62, 0.44, 0.27, 0.10]
    gr = [0.012, 0.040, 0.074, 0.106, 0.132, 0.150, 0.162]
    def skirtc(p, n):
        base = (0.82, 0.80, 0.74) if 0.15 < p.z < 0.185 else skirt
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in base)
    P.append(Part(skirt_geo(o, zs, gr, n=32, nf=12, amp=0.035), "Cloth", skirtc, legblend3(0.97, 0.78, 0.60, 0.42, xw=0.14), subsurf=1, solidify=0.006, name="skirt"))
    def apronc(p, n):
        base = (0.86, 0.84, 0.80)
        if p.z < 0.47: base = (0.76, 0.74, 0.70) if math.sin(p.x * 260) > 0.3 else base   # lace hem
        return tuple(clamp(x * (1 + 0.04 * fbm(p, 30))) for x in base)
    ap = panel_geo(o, 1.03, 0.44, 0.095, 0.16, gap=0.020, rows=8, cols=7, hang=0.0, min_depth=skirt_front(o, zs, gr, amp=0.035))
    P.append(Part(ap, "Cloth", apronc, legblend3(0.97, 0.78, 0.60, 0.42, xw=0.14), subsurf=1, solidify=0.004, name="apron"))
    P.append(Part(belt(o, 1.045, 0.030, 0.016), "Cloth", C_cloth((0.86, 0.84, 0.80)), W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += shoe_parts(o, (0.10, 0.06, 0.04))
    return P

CHARS = {"king": (king, True), "barmaid": (barmaid, False)}

if __name__ == "__main__":
    for n, (fn, mug) in CHARS.items():
        if ONLY and n not in ONLY: continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        parts = fn() + (tankard_parts() if mug else [])
        build_character(n, parts, export=not NOEXPORT, save=not NOEXPORT)
