"""Arming sword (Oakeshott XII-ish), ~0.95 m. Grip axis +Y, edges +-Z, flats +-X."""
import sys, os
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *

reset_all()
steel = pbr("Sword_Steel", tex_steel(512, seed=3), orm_px=256, nrm_px=256, nrm_strength=0.6)
guard_steel = pbr("Guard_Steel", tex_steel(256, seed=8, dark=0.06, polish=0.5), nrm_strength=0.8)
leather = pbr("Grip_Leather", tex_leather(256, seed=5, wrap=4), tint='#5a3a24', nrm_strength=1.0)
cord = pbr("Riser_Leather", tex_leather(128, seed=6), tint='#3e2718', nrm_px=0)

b = WBuilder()
# ------------------------------------------------------------------ blade
Y0, BL = 0.068, 0.775            # blade root, length
N = 48


def blade_w(t):                   # full width at fraction t
    w = 0.052 - 0.020 * t
    if t > 0.80:                  # ogive point
        k = (t - 0.80) / 0.20
        w *= math.sqrt(max(0.0, 1 - k ** 1.8))
    return max(w, 0.0004)


def blade_t(t):
    return 0.0062 - 0.0036 * t


def fuller(t):                    # (half width, depth)
    if t > 0.70:
        return 0.0, 0.0
    k = min(1.0, (0.70 - t) / 0.08) * min(1.0, (t + 0.02) / 0.05)
    return 0.0085 * (1 - 0.35 * t) * k, 0.0013 * k


ts = [i / N for i in range(N + 1)]
ts = [t ** 0.9 for t in ts]
centers = [V((0, Y0 + BL * t, 0)) for t in ts]
frames = [(V((0, 1, 0)), V((0, 0, 1)), V((1, 0, 0))) for _ in ts]   # (t, side=Z width, up=X thickness)


def prof(i):
    t = ts[i]
    w, th = blade_w(t) / 2, blade_t(t) / 2
    fw, fd = fuller(t)
    fw = min(fw, w * 0.5)
    e = 0.00035                     # edge half thickness
    pts = []
    # +X face from +Z edge to -Z edge
    half = [(w, e), (w * 0.93, th * 0.35), (w * 0.62, th * 0.86), (fw + 0.0022, th),
            (fw, th * 0.98), (fw * 0.55, th - fd * 0.85), (0.0, th - fd),
            (-fw * 0.55, th - fd * 0.85), (-fw, th * 0.98), (-fw - 0.0022, th),
            (-w * 0.62, th * 0.86), (-w * 0.93, th * 0.35), (-w, e)]
    pts = half + [(z, -x) for z, x in reversed(half)]
    return pts


b.loft(centers, frames, prof, steel, cap0=True, cap1=True, uv=('grain', (0, 1, 0), 5.0, 5.0))
# ------------------------------------------------------------------ crossguard (along Z)
gp = []
for k in range(-12, 13):
    s = k / 12.0
    z = s * 0.115
    y = 0.060 + 0.012 * abs(s) ** 2.2        # quillons sweep slightly toward the blade
    gp.append(V((0, y, z)))
gr = [0.0072 - 0.0022 * abs(k / 12.0) ** 1.4 for k in range(-12, 13)]
b.sweep(gp, gr, guard_steel, n=10, up=(1, 0, 0), ellipse=(1.0, 1.2), cap=True)
# quillon terminals (small knobs)
for sgn in (-1, 1):
    b.ellipsoid((0, 0.072, sgn * 0.117), (0.0068, 0.0068, 0.0075), guard_steel, nu=12, nv=8)
# quillon block / ecusson
b.rbox((0, 0.062, 0), (0.020, 0.020, 0.036), guard_steel, r=0.0045, seg=3)
# ricasso langet (chappe) leather rain-guard
b.rbox((0, 0.077, 0), (0.0095, 0.022, 0.030), cord, r=0.003, seg=2)
# ------------------------------------------------------------------ grip (leather over wood, oval, swelling)
GN = 40
gpts = []
for i in range(GN + 1):
    t = i / GN
    y = -0.050 + 0.100 * t
    r = 0.0135 + 0.0022 * math.sin(math.pi * t) ** 1.2
    for ry in (-0.016, 0.016):                  # risers under the leather
        r += 0.0011 * math.exp(-((y - ry) / 0.0028) ** 2)
    gpts.append((y, r))
b.lathe(gpts, leather, n=24, axis='Y', ellipse=(0.80, 1.0), uv=('cyl', (0, 1, 0), (0, 0, 0), 20.0, 1.0))
for y in (-0.047, 0.047):                       # leather end-collars
    b.lathe([(y - 0.004, 0.0), (y - 0.004, 0.0143), (y - 0.002, 0.0150), (y + 0.002, 0.0150), (y + 0.004, 0.0143),
             (y + 0.004, 0.0)], cord, n=24, axis='Y', ellipse=(0.82, 1.0), uv=('cyl', (0, 1, 0), (0, 0, 0), 20.0, 2.0))
# ------------------------------------------------------------------ wheel pommel (disc in YZ plane, axis X)
PY = -0.080
prof_p = [(-0.0168, 0.0), (-0.0168, 0.0080), (-0.0150, 0.0102), (-0.0135, 0.0112), (-0.0135, 0.0158),
          (-0.0120, 0.0203), (-0.0088, 0.0236), (-0.0060, 0.0246), (0.0060, 0.0246), (0.0088, 0.0236),
          (0.0120, 0.0203), (0.0135, 0.0158), (0.0135, 0.0112), (0.0150, 0.0102), (0.0168, 0.0080), (0.0168, 0.0)]
b.lathe(prof_p, guard_steel, n=36, axis='X', c=(0, PY, 0))
# neck between grip and pommel
b.lathe([(-0.0565, 0.0), (-0.0565, 0.0095), (-0.054, 0.0105), (-0.051, 0.0102), (-0.051, 0.0)], guard_steel, n=16,
        axis='Y')
# peened tang button on top of pommel
b.lathe([(PY - 0.0244, 0.0055), (PY - 0.0268, 0.0050), (PY - 0.0290, 0.0030), (PY - 0.0298, 0.0)], guard_steel,
        n=14, axis='Y', cap0=False)

ob = b.to_object("sword")
print("TRIS", mesh_tris(ob))
export("sword")
