"""Bearded war/woodcutter axe ~0.8 m. Grip axis +Y, bit (edge) toward +Z, flats +-X.
Origin = right (main) hand near the butt. Second hand at Y = +0.38."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *

reset_all()
iron = pbr("Axe_Iron", tex_iron(256, seed=12), nrm_strength=1.0)
edge = pbr("Axe_Edge", tex_steel(256, seed=13, polish=0.7), nrm_strength=0.6)
ash = pbr("Haft_Ash", tex_wood(512, seed=14, rings=18), tint='#b48a5c', orm_px=256, nrm_px=256)
leather = pbr("Axe_Leather", tex_leather(256, seed=15, wrap=3), tint='#4a2f1c')
end_wood = pbr("Haft_EndGrain", tex_wood(128, seed=16, rings=10), tint='#8a6440', nrm_px=0)

b = WBuilder()
Y_BOT, Y_TOP = -0.100, 0.708
YH = 0.630                         # head (eye) centre


def haft_r(y):
    """(half X, half Z) of the oval haft section."""
    t = (y - Y_BOT) / (Y_TOP - Y_BOT)
    rx = 0.0118 - 0.0012 * math.sin(math.pi * min(1, t * 1.2)) + 0.0006 * t
    rz = 0.0165 - 0.0018 * math.sin(math.pi * min(1, t * 1.2)) + 0.0008 * t
    if t < 0.07:                    # flared knob
        k = 1 - t / 0.07
        f = 1 + 0.38 * math.sin(math.pi * 0.5 * k) ** 1.5
        rx *= f; rz *= f * 1.04
    return rx, rz


def haft_z(y):                      # gentle S curve, straight through the eye
    t = (y - Y_BOT) / (YH - Y_BOT)
    return 0.010 * math.sin(math.pi * min(t, 1.0)) - 0.004 * (1 - min(t, 1.0)) ** 2


ys = [Y_BOT + (Y_TOP - Y_BOT) * (i / 60) for i in range(61)]
ys[0] = Y_BOT
rings = []
NR = 20
for y in ys:
    rx, rz = haft_r(y)
    if y < Y_BOT + 0.004:           # rounded butt end
        k = (Y_BOT + 0.004 - y) / 0.004
    rings.append([V((math.cos(2 * math.pi * j / NR) * rx, y, haft_z(y) + math.sin(2 * math.pi * j / NR) * rz))
                  for j in range(NR)])
# rounded butt: add two shrinking rings below
r0 = rings[0]
c0 = V((0, Y_BOT, haft_z(Y_BOT)))
rings.insert(0, [c0 + (p - c0) * 0.88 + V((0, -0.004, 0)) for p in r0])
rings.insert(0, [c0 + (p - c0) * 0.55 + V((0, -0.0068, 0)) for p in r0])
top = rings[-1]
ct = V((0, Y_TOP, 0))
rings.append([ct + (p - ct) * 0.85 + V((0, 0.003, 0)) for p in top])
b.rings(rings, ash, cap0=True, cap1=True, uv=('grain', (0, 1, 0), 3.0, 3.0))
# iron wedge in the haft top
b.rbox((0, Y_TOP + 0.0035, 0), (0.0035, 0.004, 0.026), iron, r=0.0012)

# ------------------------------------------------------------------ head
EYE_RX, EYE_RZ, EYE_H = 0.0175, 0.0240, 0.034
eye_prof = []
for i in range(13):
    t = i / 12.0
    y = YH - EYE_H + 2 * EYE_H * t
    r = 1.0 + 0.10 * (abs(2 * t - 1) ** 3)   # lugs flare at top and bottom
    eye_prof.append((y, r))
ring_e = []
for y, r in eye_prof:
    rr = []
    for j in range(24):
        a = 2 * math.pi * j / 24
        z = math.sin(a) * EYE_RZ * r
        if z < 0:                    # thicker, flattened poll at the back
            z = -min(-z * 1.30, 0.0285 * r)
        rr.append(V((math.cos(a) * EYE_RX * r, y, z)))
    ring_e.append(rr)
# round the top/bottom lips
for idx, dy in ((0, -0.002), (-1, 0.002)):
    rr = ring_e[idx]
    ring_e.insert(0 if idx == 0 else len(ring_e),
                  [V((p.x * 0.80, p.y + dy, p.z * 0.85)) for p in rr])
b.rings(ring_e, iron, cap0=False, cap1=False, uv=('box', 4.0))
# inner lip (so the open ends do not look hollow): ring between haft and eye
for y in (YH - EYE_H - 0.002, YH + EYE_H + 0.002):
    rx, rz = haft_r(y)
    b.lathe([(y, 0.0), (y, 1.0)], iron, n=24, axis='Y', ellipse=(EYE_RX * 0.80, EYE_RZ * 0.85), cap0=False,
            cap1=False)
# poll (hammer-ish flat back)

# blade: sections from the eye (u=0) to the edge (u=1); each section spans top T(u) -> bottom B(u)
NU, NV = 26, 14


def T(u):
    return V((0, YH + 0.030 + 0.020 * u ** 2.2, 0.014 + 0.150 * u))


def Bt(u):
    return V((0, YH - 0.030 - 0.010 * u - 0.100 * u ** 2.6, 0.014 + 0.128 * u ** 1.05))


def thick(u):
    base = 0.0125 * (1 - u) ** 1.35 + 0.0022
    if u > 0.86:
        k = (u - 0.86) / 0.14
        base = base * (1 - k) + 0.0004 * k
    return base


def section(u):
    t0, b0 = T(u), Bt(u)
    pts_pos, pts_neg = [], []
    th = thick(u)
    for j in range(NV):
        v = j / (NV - 1)
        p = t0.lerp(b0, v)
        bulge = 0.016 * math.sin(math.pi * v) * u ** 3     # convex edge
        p = p + V((0, 0, bulge))
        f = max(0.30, math.sin(math.pi * v) ** 0.35)
        x = th * f
        pts_pos.append(p + V((x, 0, 0)))
        pts_neg.append(p + V((-x, 0, 0)))
    return pts_pos + list(reversed(pts_neg))


us = [i / NU for i in range(NU + 1)]
ring_b = [section(u) for u in us]
split = next(i for i, u in enumerate(us) if u >= 0.86)
b.rings(ring_b[:split + 1], iron, cap0=False, cap1=False, uv=('box', 4.0))
b.rings(ring_b[split:], edge, cap0=False, cap1=True, uv=('grain', (0, 1, 0), 4.0, 4.0))
# smith's mark punched on the cheek: tiny raised ring
b.torus((0.0105, YH - 0.005, 0.040), 0.004, 0.0007, iron, nu=12, nv=4, axis='X')
b.torus((-0.0105, YH - 0.005, 0.040), 0.004, 0.0007, iron, nu=12, nv=4, axis='X')

# ------------------------------------------------------------------ leather grip wrap + thong
gp = []
for i in range(25):
    y = -0.070 + 0.155 * i / 24
    rx, rz = haft_r(y)
    gp.append((y, 1.0))
ringsg = []
for y, _ in gp:
    rx, rz = haft_r(y)
    ringsg.append([V((math.cos(2 * math.pi * j / 20) * (rx + 0.0016), y,
                      haft_z(y) + math.sin(2 * math.pi * j / 20) * (rz + 0.0016))) for j in range(20)])
for idx, s_ in ((0, -1), (-1, 1)):
    rr = ringsg[idx]
    y = rr[0].y
    rx, rz = haft_r(y)
    inner = [V((math.cos(2 * math.pi * j / 20) * (rx + 0.0002), y + s_ * 0.0012,
                haft_z(y) + math.sin(2 * math.pi * j / 20) * (rz + 0.0002))) for j in range(20)]
    if idx == 0:
        ringsg.insert(0, inner)
    else:
        ringsg.append(inner)
b.rings(ringsg, leather, cap0=False, cap1=False, uv=('cyl', (0, 1, 0), (0, 0, 0), 20.0, 1.0))
# leather lanyard loop through the knob
lp = [V((0, -0.090, -0.004))]
for k in range(1, 12):
    a = math.pi * k / 12
    lp.append(V((0.0, -0.090 - 0.055 * math.sin(a) ** 0.8, -0.004 - 0.030 * math.sin(a) * math.cos(a) - 0.016 * (k / 12))))
b.sweep(lp, 0.0022, leather, n=6, up=(1, 0, 0), ellipse=(1.0, 0.5))

ob = b.to_object("axe")
print("TRIS", mesh_tris(ob))
export("axe")
