# Realistic (smooth, stylised-realistic) rebuild of the 10 tavern villagers.
# Run: Blender -b --factory-startup --python build_real.py -- [names...] [--noexport]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Euler
from lib_real import *
from body_real import *
from body2 import *

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NOEXPORT = "--noexport" in ARGS
ONLY = [a for a in ARGS if not a.startswith("--")]

# ---------------------------------------------------------------- palette (linear)
PAL = dict(
    cream=(0.72, 0.64, 0.48), white=(0.80, 0.77, 0.70), brown=(0.30, 0.17, 0.08), dbrown=(0.15, 0.09, 0.05),
    leather=(0.26, 0.15, 0.07), dleather=(0.12, 0.07, 0.04), ochre=(0.62, 0.42, 0.13), dred=(0.36, 0.05, 0.035),
    green=(0.16, 0.24, 0.11), grey=(0.26, 0.24, 0.22), steel=(0.50, 0.50, 0.52), mail=(0.16, 0.16, 0.17),
    wine=(0.30, 0.05, 0.05), teal=(0.08, 0.26, 0.28), plum=(0.17, 0.045, 0.14), gold=(0.78, 0.56, 0.18),
    sage=(0.17, 0.23, 0.11), robe=(0.30, 0.19, 0.10), rope=(0.62, 0.52, 0.32),
)

def C_cloth(base, amt=0.08, f=22.0, weave=0.035, dirt=0.0):
    def c(p, n):
        m = 1 + amt * fbm(p, f) + weave * noise.noise(Vector(p) * 420)
        if dirt: m *= 1 - dirt * sstep(0.35, 0.05, p.z)
        return tuple(clamp(x * m) for x in base)
    return c

def C_regions(default, rules, amt=0.08, f=22.0):
    """rules: list of (predicate(p), colour). First match wins."""
    def c(p, n):
        col = default
        for pred, cc in rules:
            if pred(p): col = cc; break
        m = 1 + amt * fbm(p, f) + 0.03 * noise.noise(Vector(p) * 420)
        return tuple(clamp(x * m) for x in col)
    return c

def cut(geo, pred):
    v, f = geo
    keep = [fa for fa in f if not pred(sum((Vector(v[i]) for i in fa), Vector()) / len(fa))]
    return compact([Vector(x) for x in v], keep)

def W_apron(p):
    return W_torso(p, arms=False) if p.z > 1.05 else legblend(1.0, 0.80, xw=0.12)(p)

def open_torso(o, z0, z1, inflate, n=20):
    tab = FEM_TORSO if o.get("fem") else MALE_TORSO
    zs = [z0] + [z for z, *_ in tab if z0 < z < z1] + [z1]
    rings = []
    for z in zs:
        rx, ryf, ryb = torso_dims(o, z)
        rings.append(hring((0, 0.004, z), rx + inflate, ryf + inflate, ryb + inflate, n=n, bump=torso_bump(o, z)))
    return loft(rings)

def cuff(s, o, t, add=0.008, h=0.03, n=12, flare=0.0):
    k = SIDE[s]; sh, el, wr = arm_path(k)
    r = dict(ARM_PROF)
    def rad(tt):
        keys = sorted(r);
        for a, b in zip(keys, keys[1:]):
            if a <= tt <= b: return r[a] + (r[b] - r[a]) * (tt - a) / (b - a)
        return r[keys[-1]]
    mf = 0.88 if o.get("fem") else 1.0
    rings = []
    for dt, ex in ((-h / 2, 0.0), (h / 2, flare)):
        tt = clamp(t + dt / 0.55)
        c = arm_point(k, tt); d = (el - sh) if tt < 0.5 else (wr - el)
        u, v = frame_for(d, (1, 0, 0)); rr = rad(tt) * mf * (0.92 if tt > 0.75 else 1.0) + add + ex
        rings.append(ring(c, u, v, rr, rr * (1.08 if 0.15 < tt < 0.45 else 1.0), n))
    return loft(rings)

def neck_strap(z_front, x_front, y_front, col, mat="Cloth", r=0.009):
    parts = []
    for k in (1, -1):
        pts = [(x_front * k, y_front, z_front), (0.075 * k, -0.075, 1.44), (0.062 * k, -0.02, 1.505), (0.03 * k, 0.05, 1.50), (0.0, 0.064, 1.49)]
        parts.append(Part(tube(pts, [(r * 1.6, r * 0.5)] * 5, n=6, cap0=None, cap1=None, up=(0, 0, 1)), mat, col, W_torso, subsurf=1, name="strap"))
    return parts

def hair_cap(extra=0.0, front_z=1.650, nape=1.55, ears=True, front_y=-0.084):
    s = SDF()
    s.add('ell', (0, 0.020, 1.710), (0.0875 + extra, 0.106 + extra, 0.104 + extra), k=0)
    s.sub('ell', (0, front_y, front_z), (0.082, 0.075, 0.090), k=0.004)
    if ears: s.sub('ell', (0.082, 0.012, 1.655), (0.024, 0.030, 0.036), k=0.004, mirror=True)
    if nape: s.sub('ell', (0, 0.06, nape), (0.1, 0.1, 0.075), k=0.008)
    return s

def lerpc(a, b, t): return mix(a, b, t)

# ================================================================ characters
def innkeeper():
    skin = (0.66, 0.40, 0.27)
    o = dict(skin=skin, belly=0.42, broad=1.04, stubble=None, age=1.0, cheek=1.15, iris=(0.10, 0.07, 0.04), blush=0.35, brow_col=(0.30, 0.25, 0.20), brow_thick=1.5)
    hair = SDF()  # bald crown, ring of hair on sides/back
    hair.add('ell', (0, 0.025, 1.690), (0.086, 0.103, 0.088), k=0)
    hair.sub('ell', (0, 0.0, 1.785), (0.095, 0.125, 0.068), k=0.010)
    hair.sub('ell', (0, -0.088, 1.650), (0.082, 0.072, 0.090), k=0.004)
    hair.sub('ell', (0.082, 0.012, 1.655), (0.024, 0.030, 0.036), k=0.004, mirror=True)
    hair.sub('ell', (0, 0.06, 1.545), (0.1, 0.1, 0.075), k=0.008)
    beard = SDF()
    beard.add('ell', (0, -0.034, 1.596), (0.068, 0.070, 0.058), k=0)
    beard.add('ell', (0, -0.074, 1.548), (0.044, 0.040, 0.050), k=0.03)
    beard.add('cap', (0.006, -0.0975, 1.621), (0.030, -0.089, 1.607), 0.0062, k=0.006, mirror=True)
    beard.sub('ell', (0, -0.040, 1.676), (0.082, 0.082, 0.052), k=0.004)
    beard.sub('ell', (0, -0.100, 1.6055), (0.016, 0.016, 0.0068), k=0.003)
    beard.sub('cap', (0, 0.035, 1.62), (0, 0.035, 1.48), 0.047, k=0.01)
    hc = (0.33, 0.27, 0.21)
    o.update(hair_sdf=hair, hair_col=hc, beard_sdf=beard, beard_col=(0.36, 0.28, 0.20))
    P = head_parts(o)
    o.update(torso_col=C_cloth(PAL["cream"]), arm_col=C_cloth(PAL["cream"]), leg_col=C_cloth(PAL["dbrown"], dirt=0.2))
    P += body_parts(o)
    vest = cut(open_torso(o, 1.02, 1.47, 0.007), lambda c: c.y < -0.03 and abs(c.x) < 0.03 + 0.06 * sstep(1.22, 1.45, c.z))
    P.append(Part(vest, "Leather", C_cloth(PAL["brown"], 0.10), W_torso, subsurf=1, solidify=0.006, name="vest"))
    ap = panel_geo(o, 1.30, 0.58, 0.115, 0.185, gap=0.022, rows=9, cols=7, hang=0.06)
    P.append(Part(ap, "Cloth", C_cloth(PAL["white"], 0.06, dirt=0.0), lambda p: W_torso(p, arms=False) if p.z > 1.05 else legblend3(0.98, 0.80, 0.62, 0.50, xw=0.12)(p), subsurf=1, solidify=0.005, name="apron"))
    P.append(Part(belt(o, 1.10, 0.035, gap=0.020), "Cloth", C_cloth(PAL["white"]), W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += neck_strap(1.30, 0.10, -0.142, C_cloth(PAL["white"]))
    for s in SIDE:
        P.append(Part(cuff(s, o, 0.80, 0.007, 0.05), "Cloth", C_cloth(PAL["cream"]), W_arm(s), subsurf=1, solidify=0.004, name="cuff"))
    P += shoe_parts(o, PAL["leather"])
    return P

def traveler():
    skin = (0.60, 0.39, 0.26)
    o = dict(skin=skin, stubble=(0.24, 0.17, 0.12), iris=(0.10, 0.12, 0.06), brow_col=(0.14, 0.09, 0.05))
    hair = hair_cap(0.002, front_z=1.640, front_y=-0.090)
    hair.add('cap', (0.02, -0.088, 1.752), (0.055, -0.072, 1.735), 0.010, k=0.012, mirror=True)
    hood = SDF()
    hood.add('ell', (0, 0.020, 1.690), (0.112, 0.128, 0.132), k=0)
    hood.add('ell', (0, 0.030, 1.540), (0.100, 0.100, 0.080), k=0.04)
    hood.add('cap', (0, 0.10, 1.72), (0, 0.175, 1.60), 0.035, k=0.03)
    hood.sub('ell', (0, -0.112, 1.650), (0.068, 0.075, 0.098), k=0.012)
    gcol = PAL["green"]
    o.update(hair_sdf=hair, hair_col=(0.13, 0.08, 0.045),
             shells=[dict(sdf=hood, col=C_cloth(gcol, 0.10), name="hood", edge=0.014, tmax=0.08, tris=1000)])
    P = head_parts(o)
    o.update(torso_col=C_cloth(PAL["ochre"]), arm_col=C_cloth(PAL["ochre"]), leg_col=C_cloth(PAL["grey"], dirt=0.2))
    P += body_parts(o)
    P.append(Part(belt(o, 1.02, 0.04, 0.006), "Leather", C_cloth(PAL["leather"], 0.1), W_torso, subsurf=1, solidify=0.005, name="belt"))
    pouch = sphere((0.125, -0.085, 0.975), (0.034, 0.022, 0.040), 10, 8)
    P.append(Part(pouch, "Leather", C_cloth(PAL["leather"], 0.12), lambda p: legblend(1.0, 0.85)(p), subsurf=1, name="pouch"))
    # mantle over the shoulders (under the hood rim)
    rings = []
    for z, rx, ry in ((1.52, 0.090, 0.082), (1.48, 0.165, 0.112), (1.43, 0.215, 0.135), (1.36, 0.240, 0.150), (1.29, 0.248, 0.155)):
        rings.append(hring((0, 0.01, z), rx, ry, ry * 1.05, n=24, bump=fold_bump(7, 0.03 * sstep(1.48, 1.29, z))))
    P.append(Part(loft(rings), "Cloth", C_cloth(gcol, 0.10), W_torso, subsurf=1, solidify=0.008, name="mantle"))
    # cape down the back with folds
    rows = []
    for i, z in enumerate((1.42, 1.30, 1.17, 1.04, 0.91, 0.78, 0.66)):
        hw = 0.20 + 0.10 * (1.42 - z); yb = 0.115 + 0.05 * (1.42 - z) ** 0.8
        row = []
        for j in range(9):
            u = -1 + 2 * j / 8
            y = yb + 0.03 * (1 - u * u) - 0.018 * math.cos(u * math.pi * 3) * sstep(1.3, 0.8, z)
            row.append(Vector((u * hw, y + 0.02 * u * u, z)))
        rows.append(row)
    def cape_w(p):
        if p.z > 1.0: return W_torso(p, arms=False)
        return W_torso(Vector((p.x, p.y, 1.0)), arms=False)
    P.append(Part(grid_panel(rows), "Cloth", C_cloth(mul(gcol, 0.9), 0.10, dirt=0.25), cape_w, subsurf=1, solidify=0.007, name="cape"))
    P += shoe_parts(o, PAL["leather"], boot_h=0.34, boot_col=PAL["leather"])
    return P

def guard():
    skin = (0.62, 0.40, 0.27)
    o = dict(skin=skin, broad=1.06, iris=(0.12, 0.08, 0.04), brow_col=(0.14, 0.09, 0.05), brow_thick=1.2, stubble=(0.26, 0.18, 0.12))
    hair = hair_cap(0.0, front_z=1.66)
    beard = SDF()   # thick moustache
    beard.add('cap', (0.003, -0.0990, 1.6225), (0.031, -0.089, 1.604), 0.0090, k=0.008, mirror=True)
    helm = SDF()
    helm.add('ell', (0, 0.012, 1.722), (0.098, 0.113, 0.100), k=0)
    helm.sub('ell', (0, 0.012, 1.560), (0.30, 0.30, 0.150), k=0.002)
    steel = PAL["steel"]
    o.update(hair_sdf=hair, hair_col=(0.12, 0.08, 0.05), beard_sdf=beard, beard_col=(0.13, 0.085, 0.05),
             shells=[dict(sdf=helm, col=C_var(steel, 0.08, 30), name="helm", edge=0.002, tmax=0.06, mat="Metal", tris=700)])
    P = head_parts(o)
    # brim
    rings = []
    for rx, ry, z in ((0.090, 0.104, 1.712), (0.15, 0.163, 1.700), (0.195, 0.205, 1.680), (0.200, 0.210, 1.672)):
        rings.append(hring((0, 0.012, z), rx, ry, ry, n=28))
    P.append(Part(loft(rings), "Metal", C_var(steel, 0.08, 30), W_head, subsurf=1, solidify=0.004, name="brim"))
    P.append(Part(sphere((0, 0.012, 1.825), (0.012, 0.012, 0.012), 8, 6), "Metal", C_var(steel, 0.05), W_head, subsurf=0, name="knob"))
    mailc = lambda p, n: tuple(clamp(x * (1 + 0.25 * noise.noise(Vector(p) * 900) + 0.06 * fbm(p, 20))) for x in PAL["mail"])
    o.update(torso_col=mailc, torso_mat="Metal", arm_col=mailc, arm_mat="Metal", leg_col=C_cloth(PAL["dbrown"]))
    P += body_parts(o)
    for p in P:
        if p.name == "torso": p.mat = "Cloth"
    tab = PAL["dred"]; em = PAL["ochre"]
    def tabcol(p, n):
        cross = (abs(p.x) < 0.022 and 1.18 < p.z < 1.40) or (abs(p.x) < 0.075 and 1.30 < p.z < 1.345)
        base = tab
        if p.z < 0.62 and p.y < 0: base = mix(base, (0.6, 0.45, 0.12), 0.0)
        m = 1 + 0.08 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420)
        return tuple(clamp(x * m) for x in base)
    # sleeveless surcoat over the torso + front/back skirts
    sur = open_torso(o, 0.98, 1.46, 0.012)
    sur = cut(sur, lambda c: abs(c.x) > 0.15 and c.z > 1.30)   # arm holes
    P.append(Part(sur, "Cloth", tabcol, W_torso, subsurf=1, solidify=0.005, name="surcoat"))
    for side in ("front", "back"):
        g = panel_geo(o, 1.02, 0.56, 0.155, 0.150, side=side, gap=0.016, rows=7, cols=7, hang=0.05)
        P.append(Part(g, "Cloth", tabcol, legblend3(1.0, 0.82, 0.64, 0.52, xw=0.10) if side == "front" else W_apron, subsurf=1, solidify=0.005, name="tabard"))
    emc = C_cloth(em, 0.06)
    P.append(Part(panel_geo(o, 1.405, 1.175, 0.020, 0.020, gap=0.019, rows=5, cols=3), "Cloth", emc, W_torso, subsurf=0, solidify=0.003, name="emblem"))
    P.append(Part(panel_geo(o, 1.345, 1.305, 0.075, 0.075, gap=0.0195, rows=2, cols=7), "Cloth", emc, W_torso, subsurf=0, solidify=0.003, name="emblem2"))
    P.append(Part(belt(o, 1.02, 0.045, 0.018), "Leather", C_cloth(PAL["leather"], 0.1), W_torso, subsurf=1, solidify=0.005, name="belt"))
    P.append(Part(sphere((0, -0.122, 1.02), (0.026, 0.012, 0.024), 8, 6), "Metal", C_var(steel, 0.05), W_torso, subsurf=0, name="buckle"))
    for s in SIDE:  # leather bracers
        P.append(Part(cuff(s, o, 0.78, 0.008, 0.18, flare=0.006), "Leather", C_cloth(PAL["leather"], 0.12), W_arm(s), subsurf=1, solidify=0.004, name="bracer"))
    P += shoe_parts(o, PAL["dleather"], boot_h=0.36, boot_col=PAL["leather"])
    return P

def blacksmith():
    skin = (0.56, 0.35, 0.22)
    o = dict(skin=skin, broad=1.18, belly=0.12, iris=(0.08, 0.05, 0.03), brow_col=(0.06, 0.045, 0.03), brow_thick=1.8,
             stubble=None, jaw=1.08)
    hair = hair_cap(-0.003, front_z=1.655)
    hair.sub('ell', (0, 0.01, 1.85), (0.2, 0.2, 0.05), k=0.01)     # flat top
    beard = SDF()
    beard.add('ell', (0, -0.040, 1.594), (0.062, 0.064, 0.050), k=0)
    beard.add('ell', (0, -0.074, 1.566), (0.036, 0.034, 0.030), k=0.02)
    beard.add('cap', (0.006, -0.0975, 1.621), (0.028, -0.089, 1.607), 0.0055, k=0.006, mirror=True)
    beard.sub('ell', (0, -0.040, 1.668), (0.082, 0.082, 0.050), k=0.004)
    beard.sub('ell', (0, -0.100, 1.6055), (0.016, 0.016, 0.0068), k=0.003)
    beard.sub('cap', (0, 0.035, 1.62), (0, 0.035, 1.50), 0.046, k=0.01)
    o.update(hair_sdf=hair, hair_col=(0.05, 0.04, 0.03), beard_sdf=beard, beard_col=(0.06, 0.045, 0.03))
    P = head_parts(o)
    shirt = (0.20, 0.19, 0.18)
    o.update(torso_col=C_cloth(shirt), arm_col=C_skin_arm(skin), arm_mat="Skin", arm_start=0.15, leg_col=C_cloth(PAL["dbrown"]))
    P += body_parts(o)
    for s in SIDE:   # short sleeves
        P.append(Part(arm_geo(s, o, start=0.0, end=0.24, inflate=0.006, cap_bot=Vector((0, 0, 0.014))), "Cloth", C_cloth(shirt), W_arm(s), subsurf=0, name="sleeve"))
        P.append(Part(cuff(s, o, 0.86, 0.006, 0.07), "Leather", C_cloth((0.14, 0.08, 0.04), 0.1), W_arm(s), subsurf=1, solidify=0.004, name="wristband"))
    lea = (0.28, 0.15, 0.07)
    def leacol(p, n):
        m = 1 + 0.12 * fbm(p, 14) + 0.05 * noise.noise(Vector(p) * 200)
        burn = 0.25 * sstep(0.2, 0.7, fbm(p, 9))
        return tuple(clamp(x * m * (1 - burn)) for x in lea)
    ap = panel_geo(o, 1.42, 0.55, 0.11, 0.19, gap=0.014, rows=10, cols=7, hang=0.07)
    def apw(p): return W_torso(p, arms=False) if p.z > 1.05 else legblend3(0.98, 0.80, 0.62, 0.50, xw=0.12)(p)
    P.append(Part(ap, "Leather", leacol, apw, subsurf=1, solidify=0.007, name="apron"))
    P += neck_strap(1.42, 0.085, -0.115, C_cloth(lea), mat="Leather", r=0.011)
    P.append(Part(belt(o, 1.10, 0.03, 0.022), "Leather", C_cloth((0.14, 0.08, 0.04)), W_torso, subsurf=1, solidify=0.004, name="belt"))
    P += shoe_parts(o, PAL["dleather"], boot_h=0.30, boot_col=(0.10, 0.06, 0.035))
    return P

def C_skin_arm(skin):
    def c(p, n):
        m = 1 + 0.04 * fbm(p, 40)
        return tuple(clamp(x * m) for x in skin)
    return c

def bard():
    skin = (0.68, 0.46, 0.32)
    o = dict(skin=skin, iris=(0.10, 0.16, 0.10), brow_col=(0.42, 0.28, 0.11), stubble=None)
    hair = SDF()   # chin-length bob
    hair.add('ell', (0, 0.020, 1.700), (0.090, 0.108, 0.108), k=0)
    hair.add('ell', (0, 0.020, 1.625), (0.088, 0.100, 0.060), k=0.03)
    hair.sub('ell', (0, -0.090, 1.640), (0.074, 0.072, 0.098), k=0.004)
    hair.sub('ell', (0, 0.0, 1.535), (0.2, 0.2, 0.05), k=0.01)
    teal = PAL["teal"]; och = PAL["ochre"]; red = PAL["dred"]
    o.update(hair_sdf=hair, hair_col=(0.48, 0.30, 0.10), hair_tris=1000)
    P = head_parts(o)
    # beret (tilted) + feather
    v, f = sphere((0, 0, 0), (0.125, 0.118, 0.038), 18, 8)
    M = Matrix.Translation((0.022, 0.012, 1.792)) @ Euler((math.radians(-6), math.radians(12), 0)).to_matrix().to_4x4()
    v = [M @ Vector((p.x, p.y, p.z if p.z > -0.02 else -0.02)) for p in v]
    P.append(Part((v, f), "Cloth", C_cloth(red, 0.08), W_head, subsurf=1, name="beret"))
    fpts = [(0.08, 0.05, 1.80), (0.13, 0.10, 1.85), (0.17, 0.15, 1.895), (0.20, 0.20, 1.925)]
    P.append(Part(tube(fpts, [(0.020, 0.003), (0.024, 0.003), (0.016, 0.002), (0.004, 0.001)], n=6, up=(0, 0, 1)), "Cloth",
                  C_var((0.82, 0.74, 0.50), 0.05, 50), W_head, subsurf=1, name="feather"))
    def legc(p, n):
        base = red if p.x > 0 else och
        return tuple(clamp(x * (1 + 0.06 * fbm(p, 22))) for x in base)
    o.update(torso_col=C_cloth(teal), arm_col=C_cloth(teal), leg_col=legc)
    P += body_parts(o)
    for s, k in SIDE.items():  # puffed shoulders
        g = arm_geo(s, o, start=0.0, end=0.22, inflate=0.016, cap_bot=None)
        g = ([Vector(p) for p in g[0]], g[1])
        P.append(Part(g, "Cloth", C_cloth(och), W_arm(s), subsurf=1, solidify=0.004, name="puff"))
        P.append(Part(cuff(s, o, 0.90, 0.006, 0.04, flare=0.008), "Cloth", C_cloth(och), W_arm(s), subsurf=1, solidify=0.004, name="cuff"))
    pep = skirt_geo(o, [1.04, 0.96, 0.88, 0.84], [0.010, 0.022, 0.038, 0.046], n=24, nf=8, amp=0.03)
    P.append(Part(pep, "Cloth", C_cloth(teal), legblend(1.0, 0.86, xw=0.12), subsurf=1, solidify=0.005, name="peplum"))
    P.append(Part(belt(o, 1.04, 0.03, 0.012), "Leather", C_cloth(och, 0.08), W_torso, subsurf=1, solidify=0.004, name="belt"))
    # strap across the chest + lute on the back
    spts = [(-0.16, -0.09, 1.44), (-0.06, -0.125, 1.33), (0.06, -0.122, 1.20), (0.16, -0.08, 1.08), (0.17, 0.05, 1.04), (0.10, 0.13, 1.08)]
    P.append(Part(tube(spts, [(0.012, 0.003)] * 6, n=6, cap0=None, cap1=None, up=(0, -1, 0)), "Leather", C_cloth((0.14, 0.08, 0.04)), W_torso, subsurf=1, name="strap"))
    lw = (0.55, 0.32, 0.12); ld = (0.16, 0.09, 0.04)
    body_v, body_f = sphere((0, 0, 0), (0.115, 0.05, 0.145), 16, 10)
    body_v = [Vector((p.x, max(p.y, -0.01) if p.y < 0 else p.y, p.z)) for p in body_v]
    M = Matrix.Translation((0.05, 0.175, 1.12)) @ Euler((0, math.radians(20), 0)).to_matrix().to_4x4()
    def lutec(p, n):
        q = M.inverted() @ p
        if q.y < -0.0095 and Vector((q.x, q.z + 0.03)).length < 0.022: return (0.03, 0.02, 0.01)
        if q.y < -0.0095: return mul(lw, 1.15)
        return tuple(clamp(x * (1 + 0.1 * fbm(p, 30))) for x in lw)
    P.append(Part(([M @ p for p in body_v], body_f), "Wood", lutec, W_torso, subsurf=0, name="lute"))
    neck_pts = [M @ Vector((0, 0.0, 0.12)), M @ Vector((0, 0.0, 0.42))]
    P.append(Part(tube(neck_pts, [(0.022, 0.012), (0.018, 0.011)], n=8, up=(0, 1, 0)), "Wood", C_var(ld, 0.08), W_torso, subsurf=0, name="luteneck"))
    hd = M @ Vector((0, 0.0, 0.46))
    P.append(Part(sphere(hd, (0.025, 0.015, 0.045), 8, 6), "Wood", C_var(ld, 0.08), W_torso, subsurf=0, name="lutehead"))
    P += shoe_parts(o, (0.14, 0.08, 0.04), pointed=True)
    return P

def monk():
    skin = (0.64, 0.42, 0.29)
    robe = PAL["robe"]
    o = dict(skin=skin, belly=0.12, age=0.5, iris=(0.10, 0.07, 0.04), brow_col=(0.24, 0.17, 0.10), stubble=(0.32, 0.24, 0.17))
    hair = SDF()  # tonsure ring
    hair.add('ell', (0, 0.018, 1.703), (0.0845, 0.103, 0.101), k=0)
    hair.sub('ell', (0, 0.012, 1.800), (0.075, 0.090, 0.055), k=0.006)
    hair.sub('ell', (0, -0.084, 1.650), (0.082, 0.075, 0.090), k=0.004)
    hair.sub('ell', (0.082, 0.012, 1.655), (0.024, 0.030, 0.036), k=0.004, mirror=True)
    hair.sub('ell', (0, 0.06, 1.55), (0.1, 0.1, 0.075), k=0.008)
    o.update(hair_sdf=hair, hair_col=(0.24, 0.17, 0.10))
    P = head_parts(o)
    rc = C_cloth(robe, 0.10, dirt=0.25)
    o.update(torso_col=rc, arm_col=rc, leg_col=C_skin_arm(skin), leg_top=0.45, arm_end=1.0)
    P += body_parts(o)
    # robe skirt to the ankles
    zs = [1.06, 0.96, 0.84, 0.70, 0.55, 0.40, 0.25, 0.10]
    gr = [0.010, 0.022, 0.034, 0.048, 0.060, 0.072, 0.084, 0.094]
    P.append(Part(skirt_geo(o, zs, gr, n=28, nf=10, amp=0.035), "Cloth", rc, legblend3(0.97, 0.80, 0.60, 0.44, xw=0.14), subsurf=1, solidify=0.006, name="robe"))
    for s in SIDE:  # wide sleeves
        P.append(Part(arm_geo(s, o, start=0.45, end=0.92, inflate=0.010, cap_top=False, cap_bot=None, flare=0.040), "Cloth", rc, W_arm(s), subsurf=1, solidify=0.005, name="sleeve"))
    rope = PAL["rope"]
    rx, ryf, ryb = torso_dims(o, 1.045)
    rring = [Vector((math.cos(a) * (rx + 0.018), -math.sin(a) * ((ryf if math.sin(a) > 0 else ryb) + 0.018) + 0.004, 1.045)) for a in [2 * math.pi * i / 24 for i in range(25)]]
    P.append(Part(tube(rring, [0.010] * 25, n=6, cap0=None, cap1=None, up=(0, 0, 1)), "Cloth", C_var(rope, 0.1, 80), W_torso, subsurf=0, name="rope"))
    P.append(Part(tube([(0.07, -0.115, 1.04), (0.075, -0.14, 0.90), (0.08, -0.15, 0.74)], [0.009, 0.009, 0.008], n=6, up=(1, 0, 0)), "Cloth", C_var(rope, 0.1, 80), legblend(1.0, 0.85), subsurf=0, name="cord"))
    # cowl (hood down) around the neck + folded hood on the back
    rings = []
    for z, rx2, ry2 in ((1.40, 0.17, 0.12), (1.45, 0.155, 0.115), (1.50, 0.11, 0.095), (1.53, 0.085, 0.080)):
        rings.append(hring((0, 0.012, z), rx2, ry2, ry2 * 1.1, n=24, bump=fold_bump(6, 0.04)))
    P.append(Part(loft(rings), "Cloth", rc, W_torso, subsurf=1, solidify=0.010, name="cowl"))
    hv, hf = sphere((0, 0.13, 1.37), (0.12, 0.05, 0.11), 14, 8)
    P.append(Part((hv, hf), "Cloth", rc, W_torso, subsurf=1, name="hoodback"))
    wood = (0.36, 0.21, 0.09)
    P.append(Part(tube([(0, -0.118, 1.36), (0, -0.124, 1.25)], [(0.007, 0.004)] * 2, n=6, up=(1, 0, 0)), "Wood", C_var(wood), W_torso, subsurf=0, name="cross"))
    P.append(Part(tube([(-0.025, -0.122, 1.33), (0.025, -0.122, 1.33)], [(0.006, 0.004)] * 2, n=6, up=(0, 0, 1)), "Wood", C_var(wood), W_torso, subsurf=0, name="cross2"))
    P += shoe_parts(o, (0.36, 0.22, 0.10))
    return P

def maid():
    skin = (0.70, 0.48, 0.34)
    o = dict(skin=skin, fem=True, jaw=0.92, iris=(0.14, 0.22, 0.12), brow_col=(0.34, 0.14, 0.05), blush=0.35)
    hair = hair_cap(0.002, front_z=1.640, front_y=-0.090)
    hair.add('cap', (0.010, -0.088, 1.752), (0.065, -0.062, 1.705), 0.011, k=0.015, mirror=True)
    bon = SDF()
    bon.add('ell', (0, 0.030, 1.720), (0.101, 0.119, 0.116), k=0)
    bon.sub('ell', (0, -0.075, 1.655), (0.092, 0.082, 0.095), k=0.004)
    bon.sub('ell', (0, 0.06, 1.56), (0.12, 0.12, 0.07), k=0.008)
    hcol = (0.40, 0.14, 0.04)
    o.update(hair_sdf=hair, hair_col=hcol, shells=[dict(sdf=bon, col=C_cloth(PAL["cream"], 0.05), name="bonnet", edge=0.010, tmax=0.06, tris=800)])
    P = head_parts(o)
    # braid down the back
    bpts = [(0, 0.10, 1.63), (0, 0.118, 1.56), (0, 0.122, 1.48), (0, 0.118, 1.40), (0, 0.112, 1.34)]
    braid_b = lambda i: (lambda a: 1 + 0.12 * math.sin(3 * a + i * 2.1))
    P.append(Part(tube(bpts, [0.026, 0.024, 0.021, 0.017, 0.012], n=10, bump=braid_b), "Hair", C_var(hcol, 0.12, 50), W_torso, subsurf=1, name="braid"))
    wine = PAL["wine"]; cream = PAL["cream"]
    def torsoc(p, n):
        base = cream if p.z > 1.40 else wine
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_skin_arm(skin), arm_mat="Skin", arm_start=0.25, leg_col=C_cloth((0.55, 0.50, 0.42)), leg_top=0.50)
    P += body_parts(o)
    for s in SIDE:
        P.append(Part(arm_geo(s, o, start=0.0, end=0.36, inflate=0.016, cap_bot=Vector((0, 0, 0.014))), "Cloth", C_cloth(cream, 0.05), W_arm(s), subsurf=1, name="puff"))
    zs = [1.06, 0.95, 0.80, 0.62, 0.46, 0.36]
    gr = [0.010, 0.030, 0.055, 0.080, 0.100, 0.110]
    P.append(Part(skirt_geo(o, zs, gr, n=28, nf=9, amp=0.03), "Cloth", C_cloth(wine), legblend3(0.97, 0.74, 0.58, 0.42, xw=0.14), subsurf=1, solidify=0.006, name="skirt"))
    ap = panel_geo(o, 1.03, 0.50, 0.10, 0.15, gap=0.020, rows=8, cols=7, hang=0.0, min_depth=skirt_front(o, zs, gr))
    P.append(Part(ap, "Cloth", C_cloth(PAL["white"], 0.05), legblend3(0.97, 0.74, 0.58, 0.42, xw=0.14), subsurf=1, solidify=0.004, name="apron"))
    P.append(Part(belt(o, 1.06, 0.035, 0.016), "Cloth", C_cloth(PAL["white"]), W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += shoe_parts(o, PAL["dbrown"])
    return P

def baker():
    skin = (0.72, 0.48, 0.33)
    o = dict(skin=skin, fem=True, belly=0.18, jaw=0.97, cheek=1.2, iris=(0.10, 0.06, 0.03), brow_col=(0.26, 0.15, 0.07), blush=0.45)
    hair = hair_cap(0.0, front_z=1.645, front_y=-0.090)
    hair.add('cap', (-0.05, -0.085, 1.748), (0.045, -0.090, 1.752), 0.011, k=0.015)
    sc = SDF()
    sc.add('ell', (0, 0.022, 1.716), (0.094, 0.113, 0.110), k=0)
    sc.sub('ell', (0, -0.090, 1.665), (0.085, 0.075, 0.090), k=0.004)
    sc.sub('ell', (0, 0.05, 1.56), (0.12, 0.12, 0.075), k=0.006)
    scol = (0.58, 0.20, 0.07)
    o.update(hair_sdf=hair, hair_col=(0.26, 0.15, 0.07), shells=[dict(sdf=sc, col=C_cloth(scol, 0.08), name="scarf", edge=0.008, tmax=0.06, tris=800)])
    P = head_parts(o)
    P.append(Part(sphere((0, 0.122, 1.662), (0.030, 0.026, 0.026), 10, 8), "Cloth", C_cloth(scol), W_head, subsurf=1, name="knot"))
    for k in (1, -1):
        P.append(Part(tube([(0.012 * k, 0.130, 1.650), (0.026 * k, 0.140, 1.60), (0.034 * k, 0.138, 1.555)], [(0.016, 0.004), (0.018, 0.004), (0.014, 0.003)], n=6, up=(0, 1, 0)),
                      "Cloth", C_cloth(scol), W_head, subsurf=1, name="tail"))
    cream = PAL["cream"]; bod = (0.20, 0.11, 0.05); skirt = (0.46, 0.28, 0.11)
    def torsoc(p, n):
        base = bod if 1.04 < p.z < 1.36 else cream
        return tuple(clamp(x * (1 + 0.07 * fbm(p, 22))) for x in base)
    o.update(torso_col=torsoc, arm_col=C_skin_arm(skin), arm_mat="Skin", arm_start=0.30, leg_col=C_cloth((0.40, 0.34, 0.28)), leg_top=0.45)
    P += body_parts(o)
    for s in SIDE:   # rolled sleeves above the elbow
        P.append(Part(arm_geo(s, o, start=0.0, end=0.40, inflate=0.008, cap_bot=Vector((0, 0, 0.014))), "Cloth", C_cloth(cream, 0.05), W_arm(s), subsurf=0, name="sleeve"))
        P.append(Part(cuff(s, o, 0.40, 0.014, 0.05), "Cloth", C_cloth(cream, 0.05), W_arm(s), subsurf=1, solidify=0.005, name="roll"))
    zs = [1.06, 0.95, 0.80, 0.60, 0.42, 0.30]
    gr = [0.010, 0.032, 0.058, 0.082, 0.098, 0.106]
    P.append(Part(skirt_geo(o, zs, gr, n=28, nf=8, amp=0.03), "Cloth", C_cloth(skirt), legblend3(0.97, 0.76, 0.58, 0.40, xw=0.14), subsurf=1, solidify=0.006, name="skirt"))
    flour = (0.82, 0.80, 0.76)
    def flourc(p, n):
        d = 0.10 * sstep(0.1, 0.6, fbm(p, 12)) + 0.05 * noise.noise(Vector(p) * 300)
        return tuple(clamp(x * (1 - d)) for x in flour)
    ap = panel_geo(o, 1.26, 0.48, 0.115, 0.15, gap=0.022, rows=9, cols=7, hang=0.0, min_depth=skirt_front(o, zs, gr))
    def apw(p): return W_torso(p, arms=False) if p.z > 1.08 else legblend3(0.97, 0.76, 0.58, 0.40, xw=0.14)(p)
    P.append(Part(ap, "Cloth", flourc, apw, subsurf=1, solidify=0.004, name="apron"))
    P.append(Part(belt(o, 1.08, 0.035, 0.022), "Cloth", flourc, W_torso, subsurf=1, solidify=0.004, name="apronbelt"))
    P += neck_strap(1.26, 0.10, -0.135, flourc)
    P += shoe_parts(o, PAL["dbrown"])
    return P

def noble():
    skin = (0.76, 0.56, 0.44)
    plum = PAL["plum"]; gold = PAL["gold"]
    o = dict(skin=skin, fem=True, belly=-0.05, jaw=0.90, iris=(0.12, 0.20, 0.30), brow_col=(0.45, 0.32, 0.14), blush=0.25)
    hair = hair_cap(0.002, front_z=1.640, front_y=-0.092, nape=None)
    hair.add('ell', (0, 0.105, 1.615), (0.055, 0.040, 0.040), k=0.02)   # low bun
    veil = SDF()
    veil.add('ell', (0, 0.040, 1.705), (0.100, 0.118, 0.115), k=0)
    veil.sub('ell', (0, -0.060, 1.665), (0.105, 0.090, 0.100), k=0.004)
    veil.sub('ell', (0, 0.05, 1.52), (0.15, 0.15, 0.06), k=0.006)
    vcol = (0.80, 0.77, 0.70)
    o.update(hair_sdf=hair, hair_col=(0.55, 0.38, 0.15), shells=[dict(sdf=veil, col=C_cloth(vcol, 0.04), name="veil", edge=0.006, tmax=0.07, tris=800)])
    P = head_parts(o)
    rings = [hring((0, 0.010, 1.722), 0.0815, 0.1005, 0.1005, n=28), hring((0, 0.010, 1.737), 0.0805, 0.0995, 0.0995, n=28)]
    P.append(Part(loft(rings), "Gold", C_var(gold, 0.05), W_head, subsurf=0, solidify=0.004, sol_offset=1.0, name="circlet"))
    P.append(Part(sphere((0, -0.094, 1.730), (0.008, 0.006, 0.009), 8, 6), "Eye", lambda p, n: (0.45, 0.03, 0.06), W_head, subsurf=0, name="gem"))
    rows = []
    for z in (1.66, 1.58, 1.50, 1.42, 1.34):
        hw = 0.085 + 0.12 * (1.66 - z); y = 0.11 + 0.06 * (1.66 - z)
        rows.append([Vector((u * hw, y + 0.02 * u * u + 0.01 * math.cos(u * 9), z)) for u in [-1 + 2 * j / 6 for j in range(7)]])
    P.append(Part(grid_panel(rows), "Cloth", C_cloth(vcol, 0.04), lambda p: W_head(p) if p.z > 1.50 else W_torso(p, arms=False), subsurf=1, solidify=0.004, name="veilcloth"))
    gc = C_cloth(plum, 0.09)
    o.update(torso_col=lambda p, n: tuple(clamp(x * (1 + 0.09 * fbm(p, 22))) for x in (gold if 1.435 < p.z < 1.46 else plum)),
             arm_col=gc, leg_col=C_skin_arm(skin), leg_top=0.42)
    P += body_parts(o)
    zs = [1.10, 0.98, 0.84, 0.66, 0.46, 0.26, 0.085]
    gr = [0.006, 0.020, 0.038, 0.060, 0.085, 0.110, 0.135]
    def gownc(p, n):
        base = gold if p.z < 0.13 else plum
        return tuple(clamp(x * (1 + 0.08 * fbm(p, 22) + 0.03 * noise.noise(Vector(p) * 420))) for x in base)
    P.append(Part(skirt_geo(o, zs, gr, n=32, nf=11, amp=0.03), "Cloth", gownc, legblend3(0.97, 0.80, 0.60, 0.44, xw=0.14), subsurf=1, solidify=0.006, name="gown"))
    P.append(Part(belt(o, 1.08, 0.025, 0.010), "Gold", C_var(gold, 0.05), W_torso, subsurf=1, solidify=0.003, name="girdle"))
    P.append(Part(tube([(0.03, -0.11, 1.07), (0.035, -0.14, 0.90), (0.04, -0.165, 0.68), (0.042, -0.18, 0.55)], [0.008] * 4, n=6, up=(1, 0, 0)), "Gold", C_var(gold, 0.05),
                  legblend3(1.0, 0.90, 0.70, 0.55), subsurf=0, name="chain"))
    for s in SIDE:   # bell sleeves
        P.append(Part(arm_geo(s, o, start=0.45, end=0.95, inflate=0.006, cap_top=False, cap_bot=None, flare=0.07), "Cloth", gc, W_arm(s), subsurf=1, solidify=0.004, name="bell"))
    P += shoe_parts(o, gold)
    return P

def herbalist():
    skin = (0.64, 0.43, 0.31)
    sage = PAL["sage"]
    o = dict(skin=skin, fem=True, jaw=0.95, age=1.0, iris=(0.12, 0.14, 0.08), brow_col=(0.50, 0.48, 0.45), blush=0.2)
    hair = hair_cap(0.002, front_z=1.640, front_y=-0.090)
    hair.add('cap', (0.068, -0.055, 1.69), (0.072, -0.060, 1.585), 0.012, k=0.02, mirror=True)   # side locks
    hood = SDF()
    hood.add('ell', (0, 0.022, 1.688), (0.112, 0.128, 0.132), k=0)
    hood.add('ell', (0, 0.030, 1.540), (0.100, 0.100, 0.080), k=0.04)
    hood.sub('ell', (0, -0.112, 1.650), (0.070, 0.076, 0.100), k=0.012)
    o.update(hair_sdf=hair, hair_col=(0.55, 0.53, 0.50), shells=[dict(sdf=hood, col=C_cloth(sage, 0.10), name="hood", edge=0.014, tmax=0.08, tris=1000)])
    P = head_parts(o)
    cream = (0.62, 0.56, 0.44); skirt = (0.24, 0.15, 0.08)
    o.update(torso_col=C_cloth(cream), arm_col=C_cloth(cream), leg_col=C_skin_arm(skin), leg_top=0.40)
    P += body_parts(o)
    zs = [1.06, 0.95, 0.80, 0.60, 0.40, 0.22]
    gr = [0.010, 0.026, 0.046, 0.066, 0.082, 0.094]
    P.append(Part(skirt_geo(o, zs, gr, n=28, nf=9, amp=0.03), "Cloth", C_cloth(skirt, dirt=0.3), legblend3(0.97, 0.80, 0.58, 0.42, xw=0.14), subsurf=1, solidify=0.006, name="skirt"))
    P.append(Part(belt(o, 1.07, 0.03, 0.014), "Leather", C_cloth(PAL["leather"]), W_torso, subsurf=1, solidify=0.004, name="belt"))
    rings = []
    for z, rx, ry in ((1.525, 0.090, 0.080), (1.485, 0.160, 0.110), (1.43, 0.212, 0.135), (1.35, 0.238, 0.150), (1.26, 0.245, 0.155)):
        rings.append(hring((0, 0.01, z), rx, ry, ry * 1.05, n=24, bump=fold_bump(7, 0.03 * sstep(1.485, 1.26, z))))
    P.append(Part(loft(rings), "Cloth", C_cloth(sage, 0.10), W_torso, subsurf=1, solidify=0.008, name="shawl"))
    P.append(Part(loft([[Vector((-0.20, 0.17, 1.22)), Vector((0, 0.185, 1.22)), Vector((0.20, 0.17, 1.22))],
                        [Vector((-0.08, 0.15, 1.08)), Vector((0, 0.16, 1.02)), Vector((0.08, 0.15, 1.08))]]) if False else
                  grid_panel([[Vector((-0.22, 0.17, 1.23)), Vector((0, 0.18, 1.23)), Vector((0.22, 0.17, 1.23))],
                              [Vector((-0.10, 0.15, 1.10)), Vector((0, 0.16, 1.06)), Vector((0.10, 0.15, 1.10))],
                              [Vector((-0.01, 0.135, 0.98)), Vector((0, 0.137, 0.97)), Vector((0.01, 0.135, 0.98))]]),
                  "Cloth", C_cloth(sage, 0.1), W_torso, subsurf=1, solidify=0.006, name="shawlpoint"))
    # basket in the crook of the left elbow (weighted to UpperArm.L so it stays upright when seated)
    bx = 0.35; wick = (0.50, 0.34, 0.15)
    def wickc(p, n):
        w = 0.15 * math.sin(p.z * 400) * math.sin(math.atan2(p.y, p.x - bx) * 14)
        return tuple(clamp(x * (1 + w + 0.06 * fbm(p, 30))) for x in wick)
    rings = [hring((bx, 0, z), rx, ry, ry, n=16) for z, rx, ry in ((0.84, 0.075, 0.058), (0.86, 0.088, 0.068), (0.95, 0.102, 0.080), (0.97, 0.106, 0.083))]
    P.append(Part(loft(rings, cap0='pole'), "Wood", wickc, W_const("UpperArm.L"), subsurf=1, solidify=0.006, name="basket"))
    P.append(Part(tube([(bx - 0.10, 0, 0.965), (bx - 0.085, 0, 1.08), (bx, 0, 1.14), (bx + 0.085, 0, 1.08), (bx + 0.10, 0, 0.965)], [0.009] * 5, n=6, up=(0, 1, 0)),
                  "Wood", C_var(wick, 0.08), W_const("UpperArm.L"), subsurf=0, name="handle"))
    for dx, dy, c in ((-0.04, 0.02, (0.16, 0.32, 0.08)), (0.03, -0.02, (0.20, 0.36, 0.10)), (0.0, 0.03, (0.42, 0.24, 0.50)), (0.05, 0.03, (0.18, 0.30, 0.07))):
        P.append(Part(sphere((bx + dx, dy, 0.975), (0.040, 0.034, 0.030), 8, 6), "Cloth", C_var(c, 0.15, 60), W_const("UpperArm.L"), subsurf=0, name="herb"))
    P += shoe_parts(o, PAL["leather"])
    return P

CHARS = {"innkeeper": innkeeper, "traveler": traveler, "guard": guard, "blacksmith": blacksmith, "bard": bard,
         "monk": monk, "maid": maid, "baker": baker, "noble": noble, "herbalist": herbalist}

if __name__ == "__main__":
    for n, fn in CHARS.items():
        if ONLY and n not in ONLY: continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        parts = fn() + tankard_parts()
        build_character(n, parts, export=not NOEXPORT, save=not NOEXPORT)
