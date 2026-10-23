"""17th-c. flintlock pistol ~0.45 m. Built in a 'natural' frame N (barrel +Z, up +Y, lock on the right = -X),
then rotated so the hand grip (butt) axis is +Y and the origin is the grip centre.
Empty `muzzle` at the barrel tip: its glTF +Z (Blender local -Y) is the firing direction."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *

reset_all()
walnut = pbr("Stock_Walnut", tex_wood(512, seed=31, rings=14, figure=0.5, pore_amt=0.35, nrm=0.6, late_amt=0.16), tint='#7b4a2a',
             orm_px=256, nrm_px=256, nrm_strength=0.5)
barrel_m = pbr("Barrel_Iron", tex_steel(256, seed=32, dark=0.16, polish=0.5), nrm_strength=0.6)
lock_m = pbr("Lock_Steel", tex_steel(256, seed=33, dark=0.04, polish=0.8), nrm_strength=0.5)
brass = pbr("Pistol_Brass", tex_brass(256, seed=34))
flint = flat_mat("Flint", '#3a3833', rough=0.45)
bore = flat_mat("Bore", '#050505', rough=0.9)
horn = flat_mat("Ramrod_Horn", '#e8dcc0', rough=0.5)

b = WBuilder()
X, Y, Z = V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1))
MZ = 0.262                       # muzzle z (barrel from 0 to MZ)

# ------------------------------------------------------------------ barrel
# octagonal breech (0 .. 0.085), round taper after, muzzle swell
oct_rings = []
for z, r in ((-0.004, 0.0128), (0.0, 0.0134), (0.080, 0.0124), (0.085, 0.0124)):
    oct_rings.append([V((math.cos(math.pi / 8 + k * math.pi / 4) * r / math.cos(math.pi / 8) * 0.97,
                         math.sin(math.pi / 8 + k * math.pi / 4) * r / math.cos(math.pi / 8) * 0.97, z))
                      for k in range(8)])
b.rings(oct_rings, barrel_m, cap0=True, cap1=False, uv=('grain', (0, 0, 1), 5, 5), flat=True)
b.lathe([(0.083, 0.0128), (0.0855, 0.0136), (0.0895, 0.0136), (0.092, 0.0118), (0.11, 0.0112), (0.20, 0.0100),
         (MZ - 0.022, 0.0096), (MZ - 0.014, 0.0110), (MZ - 0.010, 0.0112), (MZ - 0.003, 0.0112),
         (MZ, 0.0104), (MZ, 0.0068), (MZ - 0.035, 0.0066)], barrel_m, n=24, axis='Z', cap0=False, cap1=True,
        uv=('cyl', (0, 0, 1), (0, 0, 0), 5.0, 1.0))
b.lathe([(MZ - 0.0005, 0.0067), (MZ - 0.035, 0.0065)], bore, n=16, axis='Z', cap0=False, cap1=True)
# baluster ring at the transition already in lathe; front sight blade + rear notch on tang
b.plate([(-0.004, 0.0), (0.004, 0.0), (0.003, 0.004), (-0.002, 0.0042)], lock_m, au=Z, av=Y,
        origin=(0.0, 0.0108, MZ - 0.020), w0=-0.0009, w1=0.0009, bevel=0.0003)
# ------------------------------------------------------------------ stock (lofted along a curved path)
path = [(0.205, -0.0125), (0.15, -0.0128), (0.08, -0.0135), (0.02, -0.0105), (-0.025, -0.0095), (-0.055, -0.0145),
        (-0.080, -0.0260), (-0.100, -0.0450), (-0.118, -0.0700), (-0.134, -0.0960), (-0.148, -0.1200),
        (-0.158, -0.1390)]
# (half height across path, half width X) per control point
dims = [(0.0115, 0.0110), (0.0118, 0.0115), (0.0125, 0.0122), (0.0185, 0.0158), (0.0200, 0.0160),
        (0.0165, 0.0135), (0.0150, 0.0128), (0.0158, 0.0135), (0.0185, 0.0150), (0.0225, 0.0170),
        (0.0265, 0.0188), (0.0285, 0.0196)]
pp = catmull([(0, y, z, h, w) for (z, y), (h, w) in zip(path, dims)], sub=5)
P = [V(q[:3]) for q in pp]
HH = [q[3] for q in pp]
WW = [q[4] for q in pp]
fr = frames_along(P, up_hint=(1, 0, 0))
NS = 28


def stock_ring(i, scale=1.0, grow=0.0):
    t, s, u = fr[i]
    hh, ww = HH[i] * scale + grow, WW[i] * scale + grow
    out = []
    for j in range(NS):
        a = 2 * math.pi * j / NS
        ca, sa = math.cos(a), math.sin(a)
        # superellipse (flat-ish sides at the lock, rounder at the butt)
        e = 0.62 if i < len(P) * 0.55 else 0.80
        x = math.copysign(abs(ca) ** e, ca) * hh
        yv = math.copysign(abs(sa) ** e, sa) * ww
        out.append(P[i] + s * x + u * yv)
    return out


NB = len(P)
cap_start = NB - 5                                 # brass butt cap covers the last section
srings = [stock_ring(i) for i in range(cap_start + 1)]
# rounded fore-end tip
srings.insert(0, [P[0] + (q - P[0]) * 0.75 + V((0, 0, 0.004)) for q in srings[0]])
b.rings(srings, walnut, cap0=True, cap1=False, uv=('grain', (0, 0, 1), 4.0, 4.0))
# butt cap (brass): slightly proud of the wood, then domed
crings = [stock_ring(i, 1.0, 0.0006) for i in range(cap_start, NB)]
tN, sN, uN = fr[-1]
for k, (sc_, dz) in enumerate(((0.92, 0.004), (0.75, 0.0085), (0.48, 0.0118), (0.18, 0.0134))):
    crings.append([P[-1] + (q - P[-1]) * sc_ + tN * dz for q in stock_ring(NB - 1, 1.0, 0.0006)])
b.rings(crings, brass, cap0=False, cap1=True, uv=('box', 8.0))
# butt-cap spurs running up the sides of the grip
for sx in (-1, 1):
    i0 = cap_start
    spur = []
    for k in range(6):
        i = i0 - k * 2
        t, s, u = fr[i]
        spur.append(P[i] + u * (WW[i] + 0.0004) * sx)
    rr = [0.0042, 0.0042, 0.0036, 0.0028, 0.0018, 0.0008]
    b.sweep(spur, rr, brass, n=8, up=tuple(fr[i0][1]), ellipse=(1.0, 0.22))
# breech tang following the top of the wrist
tp = []
for zt in (0.004, -0.012, -0.026, -0.040, -0.052):
    i = min(range(len(P)), key=lambda k: abs(P[k].z - zt) + (0 if P[k].y > -0.03 else 1))
    tp.append(V((0, P[i].y + HH[i] + 0.0004, P[i].z)))
b.sweep(tp, [0.0042, 0.0040, 0.0034, 0.0024, 0.0010], barrel_m, n=8, up=(0, 1, 0), ellipse=(1.0, 0.25), sub=2)
b.lathe([(0, 0.0022), (0.0007, 0.0019), (0.0010, 0.0)], lock_m, n=8, axis='Y', c=(0, tp[2].y + 0.0006, tp[2].z),
        cap0=False)
# fore-end nose cap
b.rings([stock_ring(0, 1.0, 0.0005), stock_ring(1, 1.0, 0.0005)], horn, cap0=True, cap1=False)

# ------------------------------------------------------------------ ramrod + pipes
RY = -0.0262
b.lathe([(-0.005, 0.0), (-0.005, 0.0030), (MZ - 0.020, 0.0030)], walnut, n=8, axis='Z', c=(0, RY, 0), cap1=True)
b.lathe([(MZ - 0.020, 0.0034), (MZ - 0.006, 0.0040), (MZ - 0.002, 0.0038), (MZ - 0.001, 0.0)], brass, n=10,
        axis='Z', c=(0, RY, 0), cap0=True)
for zc in (0.105, 0.185):
    b.lathe([(zc - 0.009, 0.0036), (zc - 0.008, 0.0048), (zc + 0.008, 0.0048), (zc + 0.009, 0.0036)], brass,
            n=12, axis='Z', c=(0, RY, 0), cap0=False, cap1=False)
    b.plate([(-0.007, 0.0), (0.007, 0.0), (0.005, 0.006), (-0.005, 0.006)], brass, au=Z, av=Y,
            origin=(0, RY + 0.002, zc), w0=-0.0018, w1=0.0018, bevel=0.0005)

# ------------------------------------------------------------------ lock (right side = -X)
XL = -0.0158                      # stock side face at the lock
lock_outline = [(-0.062, -0.002), (-0.050, -0.0085), (-0.020, -0.0120), (0.010, -0.0125), (0.034, -0.0095),
                (0.042, -0.0040), (0.040, 0.0020), (0.028, 0.0050), (0.0, 0.0060), (-0.030, 0.0050),
                (-0.052, 0.0040)]
b.plate([(z, y - 0.004) for z, y in lock_outline], lock_m, au=Z, av=Y, origin=(XL, 0, 0), w0=-0.0004, w1=0.0028,
        bevel=0.0007, smooth_outline=3)
XP = XL - 0.0028                  # outer face of the lock plate
# tumbler boss / cock pivot screw
CZ, CY = -0.024, -0.005
b.lathe([(0, 0.0052), (-0.0015, 0.0050), (-0.0022, 0.0035), (-0.0024, 0.0)], lock_m, n=16, axis='X',
        c=(XP, CY, CZ), cap0=False)
# cock (goose-neck hammer): S-curve body extruded, jaws on top, flint
cock = [(-0.006, -0.009), (0.002, -0.0085), (0.006, -0.004), (0.006, 0.002), (0.003, 0.008), (0.002, 0.014),
        (0.006, 0.020), (0.012, 0.024), (0.016, 0.0225), (0.013, 0.0185), (0.008, 0.0165), (0.0055, 0.0125),
        (-0.0005, 0.006), (-0.003, 0.001), (-0.007, -0.003)]
b.plate([(z + CZ, y + CY) for z, y in cock], lock_m, au=Z, av=Y, origin=(XP, 0, 0), w0=0.0, w1=0.0055,
        bevel=0.0012, smooth_outline=3)
JZ, JY, JX = CZ + 0.013, CY + 0.0245, XP - 0.0028      # lower jaw centre
b.rbox((JX, JY, JZ), (0.0060, 0.0028, 0.0110), lock_m, r=0.0009)
b.rbox((JX, JY + 0.0072, JZ - 0.0002), (0.0060, 0.0026, 0.0105), lock_m, r=0.0009)     # top jaw
b.lathe([(JY - 0.0015, 0.0022), (JY + 0.0128, 0.0022), (JY + 0.0135, 0.0030), (JY + 0.0150, 0.0030),
         (JY + 0.0160, 0.0)], lock_m, n=10, axis='Y', c=(JX, 0, JZ - 0.0035), cap0=True)   # jaw screw
b.rbox((JX, JY + 0.0036, JZ + 0.0075), (0.0055, 0.0040, 0.0080), flint, r=0.0006)       # flint (leather-wrapped)
# pan + frizzen (steel) in front of the flint
FZ = JZ + 0.0175
b.rbox((XP - 0.0030, -0.0015, FZ - 0.004), (0.0065, 0.0040, 0.0130), lock_m, r=0.0010)   # pan
fr_out = [(0.0, -0.0010), (0.0040, -0.0010), (0.0052, 0.0030), (0.0040, 0.0280), (0.0018, 0.0285),
          (0.0010, 0.0040), (-0.0120, 0.0040), (-0.0122, 0.0010), (-0.0040, 0.0005)]
b.plate([(z + FZ - 0.003, y + 0.0004) for z, y in fr_out], lock_m, au=Z, av=Y, origin=(XP - 0.0003, 0, 0),
        w0=-0.002, w1=0.0095, bevel=0.0008)
# frizzen spring (forward, bent leaf)
spring = [(0.0055, -0.0020), (0.0190, -0.0040), (0.0210, -0.0075), (0.0180, -0.0090), (0.0050, -0.0060)]
b.plate([(z + FZ, y) for z, y in spring], lock_m, au=Z, av=Y, origin=(XP, 0, 0), w0=0.0, w1=0.0020,
        bevel=0.0005, smooth_outline=2)
# lock screws (heads on the left side plate) + side plate (brass serpentine) on the left (+X)
side_outline = [(-0.060, 0.0), (-0.045, -0.0080), (-0.020, -0.0060), (0.000, -0.0100), (0.025, -0.0070),
                (0.032, -0.0010), (0.020, 0.0030), (-0.010, 0.0010), (-0.035, 0.0040)]
b.plate([(z, y - 0.004) for z, y in side_outline], brass, au=Z, av=Y, origin=(-XL, 0, 0), w0=0.0004, w1=-0.0012,
        bevel=0.0004, smooth_outline=3)
for zc in (-0.040, 0.012):
    b.lathe([(0, 0.0030), (0.0008, 0.0028), (0.0013, 0.0012), (0.0014, 0.0)], lock_m, n=10, axis='X',
            c=(-XL + 0.0012, -0.006, zc), cap0=False)
# barrel wedge escutcheons on the fore-end
for sx in (-1, 1):
    b.lathe([(0, 0.0026), (sx * 0.0008, 0.0022), (sx * 0.0010, 0.0)], brass, n=10, axis='X',
            c=(sx * 0.0116, -0.012, 0.150), cap0=False)

# ------------------------------------------------------------------ trigger guard + trigger
tg = [V((0, -0.0255, 0.028)), V((0, -0.0290, 0.010)), V((0, -0.0350, -0.004)), V((0, -0.0470, -0.020)),
      V((0, -0.0480, -0.036)), V((0, -0.0400, -0.048)), V((0, -0.0300, -0.054)), V((0, -0.0255, -0.075))]
b.sweep(tg, [0.0030, 0.0032, 0.0034, 0.0034, 0.0034, 0.0034, 0.0030, 0.0022], brass, n=10, sub=4, up=(1, 0, 0),
        ellipse=(0.75, 1.0))
b.ellipsoid((0, -0.0272, 0.031), (0.0028, 0.0018, 0.0048), brass, nu=10, nv=6)   # guard finial
trig = [V((0, -0.022, -0.026)), V((0, -0.030, -0.025)), V((0, -0.037, -0.027)), V((0, -0.042, -0.032))]
b.sweep(trig, [0.0028, 0.0026, 0.0022, 0.0014], lock_m, n=8, sub=3, up=(1, 0, 0), ellipse=(0.6, 1.0))
# touch hole on the barrel (right side) - tiny dark dot
b.ellipsoid((-0.0118, 0.0020, 0.0040), (0.0006, 0.0009, 0.0009), bore, nu=8, nv=4)

# ------------------------------------------------------------------ hand frame transform
gi = int(len(P) * 0.80)
G = P[gi]
gaxis = (P[gi - 3] - P[gi + 3]).normalized()      # butt -> wrist
# rotation taking gaxis -> +Y, keeping X
ang = -math.atan2(gaxis.z, gaxis.y)               # rotate gaxis back onto +Y
R = Matrix.Rotation(ang, 4, 'X')
M = R @ Matrix.Translation(-G)
print("GRIP point N", tuple(round(c, 4) for c in G), "axis", tuple(round(c, 3) for c in gaxis),
      "rot deg", math.degrees(ang))
xform_builder(b, M)
ob = b.to_object("pistol")
muz = M @ V((0, 0, MZ + 0.002))
fwd = (R.to_3x3() @ V((0, 0, 1))).normalized()
empty_at("muzzle", muz, fwd=fwd)
print("MUZZLE", tuple(round(c, 4) for c in muz), "fwd", tuple(round(c, 3) for c in fwd))
print("TRIS", mesh_tris(ob))
export("pistol")
