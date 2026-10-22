# Body / garment / prop builders (Blender coords: Z up, faces -Y, +X = character's left)
import math
from mathutils import Vector, Euler
from lib_real import *

def ang_bump(centers, width, amp):
    """Radial multiplier with gaussian bumps at angles (deg). theta=90 is the front (-Y), 270 the back."""
    def f(a):
        d = math.degrees(a) % 360; m = 1.0
        for c in centers:
            x = (d - c + 180) % 360 - 180
            m += amp * math.exp(-(x / width) ** 2)
        return m
    return f

def fold_bump(nf, amp, phase=0.0, front_flat=0.0):
    def f(a):
        m = 1 + amp * math.sin(nf * a + phase)
        if front_flat: m = 1 + (m - 1) * (1 - front_flat * max(0.0, math.sin(a)) ** 2)
        return m
    return f

MALE_TORSO = [  # z, rx, ryf, ryb
    (0.84, 0.150, 0.096, 0.104), (0.90, 0.166, 0.100, 0.118), (0.96, 0.168, 0.098, 0.118), (1.02, 0.160, 0.094, 0.104),
    (1.08, 0.150, 0.094, 0.092), (1.15, 0.152, 0.098, 0.094), (1.22, 0.160, 0.104, 0.100), (1.29, 0.168, 0.112, 0.106),
    (1.36, 0.176, 0.110, 0.108), (1.41, 0.180, 0.098, 0.104), (1.45, 0.170, 0.086, 0.094), (1.48, 0.150, 0.078, 0.086), (1.508, 0.112, 0.068, 0.074),
    (1.532, 0.068, 0.060, 0.066)]
FEM_TORSO = [
    (0.84, 0.158, 0.098, 0.110), (0.90, 0.176, 0.100, 0.124), (0.96, 0.174, 0.096, 0.120), (1.02, 0.158, 0.090, 0.102),
    (1.08, 0.136, 0.086, 0.086), (1.15, 0.138, 0.090, 0.088), (1.22, 0.148, 0.098, 0.094), (1.29, 0.155, 0.104, 0.098),
    (1.36, 0.162, 0.100, 0.100), (1.41, 0.166, 0.090, 0.098), (1.45, 0.156, 0.080, 0.088), (1.48, 0.138, 0.072, 0.080), (1.508, 0.102, 0.062, 0.068),
    (1.532, 0.062, 0.055, 0.061)]

def torso_bump(o, z):
    fem = o.get("fem", False); cs = []
    if not fem and 1.24 < z < 1.40: cs.append(((60, 120), 22, 0.07 * math.sin(math.pi * (z - 1.24) / 0.16)))
    if fem and 1.20 < z < 1.38: cs.append(((60, 120), 20, 0.16 * math.sin(math.pi * (z - 1.20) / 0.18) ** 1.5))
    if 0.86 < z < 1.00: cs.append(((240, 300), 24, 0.05 * math.sin(math.pi * (z - 0.86) / 0.14)))
    if 1.28 < z < 1.50: cs.append(((0, 180), 26, o.get("shoulder", 0.16) * math.sin(math.pi * (z - 1.28) / 0.22) ** 0.8))
    def bump(a):
        m = 1.0
        for c, w, amp in cs: m *= ang_bump(c, w, amp)(a)
        return m
    return bump

def torso_dims(o, z):
    """Interpolated torso half-sizes at height z (rx, ryf, ryb) incl. belly/broad."""
    tab = FEM_TORSO if o.get("fem") else MALE_TORSO
    if z <= tab[0][0]: rx, ryf, ryb = tab[0][1:]
    elif z >= tab[-1][0]: rx, ryf, ryb = tab[-1][1:]
    else:
        for (z0, a0, b0, c0), (z1, a1, b1, c1) in zip(tab, tab[1:]):
            if z0 <= z <= z1:
                t = (z - z0) / (z1 - z0); rx, ryf, ryb = a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, c0 + (c1 - c0) * t
                break
    g = math.exp(-((z - 1.13) / 0.11) ** 2); belly = o.get("belly", 0.0)
    sh = 1 + (o.get("broad", 1.0) - 1) * sstep(1.15, 1.40, z)
    return rx * (1 + belly * 0.25 * g) * sh, ryf * (1 + belly * 0.9 * g), ryb

def torso_geo(o, n=16, inflate=0.0, z_min=None, z_max=None):
    tab = FEM_TORSO if o.get("fem") else MALE_TORSO
    rings = []
    for z, _, _, _ in tab:
        if z_min is not None and z < z_min - 1e-6: continue
        if z_max is not None and z > z_max + 1e-6: continue
        rx, ryf, ryb = torso_dims(o, z)
        rings.append(hring((0, 0.004, z), rx + inflate, ryf + inflate, ryb + inflate, n=n, bump=torso_bump(o, z)))
    return loft(rings, cap0='pole', cap1='pole')

LEG_PROF = [(0.98, 0.086, 0.090, 0.092), (0.90, 0.088, 0.088, 0.094), (0.80, 0.080, 0.080, 0.084), (0.68, 0.068, 0.068, 0.070),
            (0.57, 0.057, 0.058, 0.058), (0.50, 0.052, 0.054, 0.052), (0.43, 0.053, 0.052, 0.060), (0.35, 0.054, 0.050, 0.064),
            (0.26, 0.045, 0.044, 0.050), (0.17, 0.036, 0.036, 0.040), (0.10, 0.033, 0.034, 0.036), (0.06, 0.034, 0.036, 0.036)]

def leg_geo(s, o, n=18, z_top=0.98, z_bot=0.06, inflate=0.0, cap0='pole', cap1='pole'):
    k = SIDE[s]; fem = o.get("fem", False)
    rings = []
    for z, rx, ryf, ryb in LEG_PROF:
        if z > z_top + 1e-6 or z < z_bot - 1e-6: continue
        f = 1.04 if fem and z > 0.6 else 1.0
        xo = 0.10 * k - 0.006 * k * sstep(0.9, 0.5, z)
        rings.append(hring((xo, 0.0, z), rx * f + inflate, ryf * f + inflate, ryb * f + inflate, n=n))
    return loft(rings, cap0=cap0, cap1=cap1)

def arm_path(k):
    return Vector((0.205 * k, 0.0, 1.415)), Vector((0.238 * k, 0.005, 1.15)), Vector((0.25 * k, 0.0, 0.925))

ARM_PROF = [(0.0, 0.034), (0.05, 0.054), (0.13, 0.054), (0.25, 0.047), (0.38, 0.044), (0.5, 0.037), (0.6, 0.039),
            (0.72, 0.035), (0.86, 0.029), (1.0, 0.025)]

def arm_geo(s, o, n=16, start=0.0, end=1.0, inflate=0.0, cap_top=True, cap_bot='pole', flare=0.0, extra=()):
    """Arm/sleeve tube. t: 0 = shoulder top, 0.5 = elbow, 1 = wrist."""
    k = SIDE[s]; sh, el, wr = arm_path(k); b = o.get("broad", 1.0); fem = o.get("fem", False)
    mf = 0.88 if fem else 1.0
    prof = sorted([p for p in ARM_PROF if start - 1e-6 <= p[0] <= end + 1e-6] + list(extra))
    if prof[0][0] > start + 1e-6: prof.insert(0, (start, dict(ARM_PROF).get(start, prof[0][1])))
    if prof[-1][0] < end - 1e-6: prof.append((end, prof[-1][1]))
    rings = []
    for t, r in prof:
        if t < 0.5: c = sh.lerp(el, t / 0.5); d = el - sh
        else: c = el.lerp(wr, (t - 0.5) / 0.5); d = wr - el
        if t < 0.03: c = c + Vector((-0.012 * k, 0, 0.004 * (1 - t / 0.03)))
        elif t < 0.08: c = c + Vector((-0.004 * k, 0, 0.004))
        rr = r * mf * (b if t < 0.6 else 1 + (b - 1) * 0.6) + inflate + flare * sstep(end - 0.3, end, t)
        u, v = frame_for(d, (1, 0, 0))
        ry = rr * (1.08 if 0.15 < t < 0.45 else 1.0)
        rings.append(ring(c, u, v, rr * (0.92 if t > 0.75 else 1.0), ry, n))
    return loft(rings, cap0='pole' if cap_top else None, cap1=cap_bot)

def arm_point(k, t):
    sh, el, wr = arm_path(k)
    return sh.lerp(el, t / 0.5) if t < 0.5 else el.lerp(wr, (t - 0.5) / 0.5)

def hand_mb(s, o):
    """Hand with palm, four separate curled fingers and an opposed thumb (relaxed grip)."""
    k = SIDE[s]; mb = MB(res=0.0016); f = 0.93 if o.get("fem") else 1.0
    X = lambda x: x * k
    mb.ell((X(0.2515), -0.001 * f, 0.880), (0.0145 * f, 0.040 * f, 0.036 * f), s=4)          # palm
    mb.ell((X(0.2510), 0.0, 0.912), (0.019 * f, 0.026 * f, 0.016), s=3)                      # heel of hand / wrist
    mb.ell((X(0.2440), -0.024 * f, 0.888), (0.012 * f, 0.014 * f, 0.022 * f), s=3)           # thenar
    fingers = [(-0.0255, 0.96, 0.0076, 0.847), (-0.0085, 1.00, 0.0078, 0.843), (0.0085, 0.96, 0.0074, 0.845), (0.0245, 0.80, 0.0064, 0.851)]
    for y, L, r, zk in fingers:
        y *= f; L *= f; r *= f
        a = Vector((X(0.2515), y, zk))
        b = a + Vector((X(-0.004), 0, -0.024 * L))
        c = b + Vector((X(-0.012), 0, -0.012 * L))
        d = c + Vector((X(-0.011), 0, 0.006 * L))
        mb.cap(a, b, r, s=9); mb.cap(b, c, r * 0.92, s=9); mb.cap(c, d, r * 0.84, s=9)
        mb.ball(a, r * 1.08, s=6)                                                            # knuckle
    t0 = Vector((X(0.2460), -0.026 * f, 0.900)); t1 = t0 + Vector((X(-0.006), -0.014 * f, -0.020 * f)); t2 = t1 + Vector((X(-0.008), -0.006 * f, -0.016 * f))
    mb.cap(t0, t1, 0.0098 * f, s=5); mb.cap(t1, t2, 0.0085 * f, s=5)
    return mb

def hands_parts(o, glove=None):
    sk = glove or o["skin"]
    def c(p, n):
        m = 1 + 0.04 * fbm(p, 60)
        kn = sstep(0.83, 0.80, p.z) * 0.12
        return tuple(clamp(x * m) for x in mix(sk, (0.62, 0.36, 0.24), kn))
    return [Part(hand_mb(s, o).to_mesh(), "Leather" if glove else "Skin", c, W_arm(s), subsurf=0, decimate=950, name="hand") for s in SIDE]

def shoe_parts(o, col, sole_col=None, boot_h=0.0, boot_col=None, pointed=False):
    parts = []
    sole_col = sole_col or mul(col, 0.45)
    for s, k in SIDE.items():
        mb = MB(res=0.004)
        x = 0.10 * k
        mb.ell((x, 0.030, 0.042), (0.040, 0.046, 0.042), s=3)
        mb.ell((x, -0.060, 0.034), (0.046, 0.062, 0.034), s=3)
        mb.ell((x, -0.128, 0.028), (0.038, 0.040, 0.026), s=3)
        if pointed: mb.cap((x, -0.14, 0.03), (x - 0.004 * k, -0.20, 0.035), 0.012, s=3)
        mb.ell((x, 0.006, 0.085), (0.040, 0.044, 0.040), s=3)
        if boot_h:
            mb.cap((x, 0.004, 0.09), (x, 0.0, boot_h - 0.02), 0.046, s=4)
            mb.ell((x, 0.0, boot_h - 0.012), (0.053, 0.056, 0.024), s=4)
        v, f = mb.to_mesh()
        v = [Vector((p.x, p.y, p.z if p.z > 0.012 else 0.0)) for p in v]
        def c(p, n, col=col, bc=boot_col or col):
            if p.z < 0.016: return mul(sole_col, 1 + 0.05 * fbm(p, 40))
            base = bc if p.z > 0.11 else col
            m = 1 + 0.08 * fbm(p, 30) - 0.10 * sstep(0.035, 0.016, p.z)
            return tuple(clamp(x * m) for x in base)
        wf = W_foot(s) if not boot_h else (lambda p, s=s: W_foot(s)(p) if p.z < 0.13 else W_leg(s)(p))
        parts.append(Part((v, f), "Leather", c, wf, subsurf=0, decimate=360 if not boot_h else 520, name="shoe"))
    return parts

def ring_band(z, rx, ryf, ryb, h, n=24, bump=None, y=0.004):
    return loft([hring((0, y, z - h / 2), rx, ryf, ryb, n=n, bump=bump), hring((0, y, z + h / 2), rx, ryf, ryb, n=n, bump=bump)])

def belt(o, z, h=0.04, gap=0.006, n=24):
    rx, ryf, ryb = torso_dims(o, z)
    return ring_band(z, rx + gap, ryf + gap, ryb + gap, h, n=n, bump=torso_bump(o, z))

def skirt_geo(o, zs, grow, n=32, nf=9, amp=0.03, front_flat=0.0, phase=0.3, ring_y=0.004):
    rings = []
    zz, gg = [zs[0]], [grow[0]]
    for i in range(1, len(zs)):
        zz += [(zs[i - 1] + zs[i]) / 2, zs[i]]; gg += [(grow[i - 1] + grow[i]) / 2, grow[i]]
    zs, grow = zz, gg
    for z, g in zip(zs, grow):
        rx, ryf, ryb = torso_dims(o, max(z, 0.90))
        if z < 0.90: rx, ryf, ryb = rx, ryf, ryb
        a = amp * sstep(zs[0], zs[-1], z)
        rings.append(hring((0, ring_y, z), rx + g, ryf + g * 0.92, ryb + g, n=n, bump=fold_bump(nf, a, phase, front_flat)))
    return loft(rings)

def panel_geo(o, z_top, z_bot, hw_top, hw_bot, side="front", gap=0.012, rows=7, cols=7, hang=0.0, curve=1.0, rx_add=0.0, min_depth=None):
    rowsl = []; sgn = -1 if side == "front" else 1
    for i in range(rows):
        t = i / (rows - 1); z = z_top + (z_bot - z_top) * t
        hw = hw_top + (hw_bot - hw_top) * t
        zz = max(z, 0.90)
        rx, ryf, ryb = torso_dims(o, zz); rx += rx_add
        ry = ryf if side == "front" else ryb
        bm = torso_bump(o, zz)
        row = []
        for j in range(cols):
            u = -1 + 2 * j / (cols - 1); x = u * hw
            q = clamp(abs(x) / (rx + 0.015), 0, 0.97)
            ang = math.atan2(math.sqrt(1 - q * q), q)
            yb = ry * math.sqrt(1 - q * q) * bm(ang if side == "front" else -ang)
            yb = yb * curve + ry * (1 - curve)
            if z < 0.92: yb = max(yb, ry * 0.9) + hang * (0.92 - z)
            if min_depth: yb = max(yb, min_depth(z) * math.sqrt(max(0.0, 1 - (x / (rx + 0.12)) ** 2)))
            row.append(Vector((x, sgn * (yb + gap) + 0.004, z)))
        rowsl.append(row)
    return grid_panel(rowsl)

def tankard_parts():
    parts = []
    cx, cz = -0.165, 0.875
    wood = (0.40, 0.23, 0.11)
    def wcol(p, n):
        st = fbm(Vector((p.x * 200, p.y * 6, p.z * 200)), 1.0)
        return tuple(clamp(x * (1 + 0.15 * st)) for x in wood)
    X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))
    stave = ang_bump([i * 30 for i in range(12)], 6, 0.03)
    rings = [ring((cx, y, cz), X, Z, r, r, 20, bump=stave) for y, r in ((0.066, 0.046), (0.064, 0.050), (0.0, 0.053), (-0.062, 0.050), (-0.066, 0.047))]
    rings.append(ring((cx, -0.064, cz), X, Z, 0.041, 0.041, 20))
    rings.append(ring((cx, -0.050, cz), X, Z, 0.040, 0.040, 20))
    parts.append(Part(loft(rings, cap0='pole', cap1='pole'), "Wood", wcol, W_const("Prop.R"), subsurf=0, name="mug"))
    for y in (0.042, -0.042):
        g = loft([ring((cx, y + 0.007, cz), X, Z, 0.0545, 0.0545, 20), ring((cx, y - 0.007, cz), X, Z, 0.0545, 0.0545, 20)])
        parts.append(Part(g, "Metal", C_var((0.30, 0.29, 0.28), 0.1, 50), W_const("Prop.R"), subsurf=0, solidify=0.003, name="band"))
    fv, ff = sphere((cx, -0.052, cz), (0.041, 0.016, 0.041), 14, 7)
    fv = [p if p.y < -0.052 else Vector((p.x, -0.052, p.z)) for p in fv]
    parts.append(Part((fv, ff), "Foam", C_var((0.92, 0.85, 0.66), 0.06, 80), W_const("Prop.R"), subsurf=0, name="foam"))
    pts = [(cx - 0.050, 0.040, cz), (cx - 0.072, 0.034, cz), (cx - 0.080, 0.0, cz), (cx - 0.072, -0.034, cz), (cx - 0.050, -0.040, cz)]
    parts.append(Part(tube(pts, [(0.009, 0.013)] * 5, n=8, cap0='pole', cap1='pole', up=(0, 0, 1)), "Wood", wcol, W_const("Prop.R"), subsurf=0, name="handle"))
    return parts

# ---------------------------------------------------------------- standard body assembly
def body_parts(o):
    """Torso/pelvis, legs, arms (+ optional sleeves), hands, shoes. Colour functions come from o."""
    P = []
    P.append(Part(torso_geo(o), o.get("torso_mat", "Cloth"), o["torso_col"], W_body, subsurf=1, name="torso", post=o.get("torso_post")))
    if not o.get("no_legs"):
        for s in SIDE:
            P.append(Part(leg_geo(s, o, z_top=o.get("leg_top", 0.98), z_bot=o.get("leg_bot", 0.06)), o.get("leg_mat", "Cloth"),
                          o["leg_col"](s) if callable(o.get("leg_col")) and o.get("leg_col_side") else o["leg_col"],
                          W_leg(s), subsurf=0, name="leg"))
    for s in SIDE:
        st = o.get("arm_start", 0.0)
        P.append(Part(arm_geo(s, o, start=st, end=o.get("arm_end", 1.0), cap_top=(st == 0.0)), o.get("arm_mat", "Cloth"), o["arm_col"], W_arm(s), subsurf=0, name="arm",
                      post=o.get("arm_post")))
    P += hands_parts(o, o.get("glove"))
    return P

def skirt_front(o, zs, gr, amp=0.03, extra=0.004):
    def f(z):
        if z >= zs[0]: g = gr[0]
        elif z <= zs[-1]: g = gr[-1]
        else:
            for (z0, g0), (z1, g1) in zip(zip(zs, gr), zip(zs[1:], gr[1:])):
                if z1 <= z <= z0: g = g0 + (g1 - g0) * (z0 - z) / (z0 - z1); break
        ryf = torso_dims(o, max(z, 0.90))[1]
        return (ryf + g * 0.92) * (1 + amp) + extra
    return f
