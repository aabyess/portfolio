"""War hammer ~0.9 m: four-pronged face (+Z), back beak (-Z), top spike (+Y), steel langets,
leather grip with a rondel. Origin = main (right) hand; second hand at Y = +0.30."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *

reset_all()
steel = pbr("Hammer_Steel", tex_steel(256, seed=21, dark=0.05, polish=0.6), nrm_strength=0.7)
iron = pbr("Hammer_Iron", tex_iron(256, seed=22))
oak = pbr("Haft_Oak", tex_wood(512, seed=23, rings=26), tint='#86593a', orm_px=256, nrm_px=256)
leather = pbr("Hammer_Leather", tex_leather(256, seed=24, wrap=3), tint='#3c2416')
brass = pbr("Hammer_Brass", tex_brass(128, seed=25), nrm_px=0)

b = WBuilder()
Y_BOT, Y_TOP = -0.137, 0.666
YH = 0.626                         # head centre


def rsq(c, ax_u, ax_v, hu, hv, r, n=4):
    """Rounded rectangle loop around c in plane (ax_u, ax_v). n segments per corner."""
    pts = []
    r = min(r, hu * 0.99, hv * 0.99)
    for q, (su, sv) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cu, cv = su * (hu - r), sv * (hv - r)
        for k in range(n + 1):
            a = math.pi / 2 * (q + k / n)
            pts.append(V(c) + V(ax_u) * (cu + math.cos(a) * r) + V(ax_v) * (cv + math.sin(a) * r))
    return pts


# ------------------------------------------------------------------ haft (octagonal-ish, rounded)
NR = 16
rings = []
for i in range(51):
    y = Y_BOT + (Y_TOP - Y_BOT) * i / 50
    t = i / 50
    r = 0.0150 - 0.0012 * math.sin(math.pi * t)
    ring = []
    for j in range(NR):
        a = 2 * math.pi * j / NR
        oct_ = 1.0
        ring.append(V((math.cos(a) * r * oct_, y, math.sin(a) * r * oct_)))
    rings.append(ring)
b.rings(rings, oak, cap0=True, cap1=True, uv=('cyl', (0, 1, 0), (0, 0, 0), 3.0, 1.0))
# butt cap (steel, with a small finial)
b.lathe([(Y_BOT + 0.028, 0.0158), (Y_BOT + 0.024, 0.0172), (Y_BOT + 0.004, 0.0175), (Y_BOT - 0.002, 0.0160),
         (Y_BOT - 0.008, 0.0110), (Y_BOT - 0.012, 0.0085), (Y_BOT - 0.020, 0.0060), (Y_BOT - 0.026, 0.0)],
        steel, n=20, axis='Y', cap0=False)
b.torus((0, Y_BOT + 0.026, 0), 0.0172, 0.0018, steel, nu=20, nv=6, axis='Y')
# leather grip
gr = []
for i in range(21):
    y = Y_BOT + 0.032 + 0.215 * i / 20
    gr.append((y, 0.0168 + 0.0006 * math.sin(math.pi * i / 20)))
gr = [(gr[0][0] - 0.001, 0.0150)] + gr + [(gr[-1][0] + 0.001, 0.0150)]
b.lathe(gr, leather, n=20, axis='Y', cap0=False, cap1=False, uv=('cyl', (0, 1, 0), (0, 0, 0), 20.0, 1.0))
# rondel (hand guard disc) above the grip
RY = Y_BOT + 0.255
b.lathe([(RY - 0.004, 0.0152), (RY - 0.004, 0.030), (RY - 0.002, 0.0335), (RY + 0.002, 0.0335),
         (RY + 0.004, 0.030), (RY + 0.004, 0.0152)], steel, n=28, axis='Y', cap0=False, cap1=False)
b.lathe([(RY + 0.004, 0.0160), (RY + 0.009, 0.0168), (RY + 0.012, 0.0155)], brass, n=16, axis='Y', cap0=False,
        cap1=False)
# brass bands
for y in (Y_BOT + 0.030, Y_BOT + 0.249):
    b.torus((0, y, 0), 0.0168, 0.0022, brass, nu=20, nv=6, axis='Y')

# ------------------------------------------------------------------ langets (4 strips, riveted)
LG0, LG1 = YH - 0.255, YH - 0.02
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    d = V((math.cos(a), 0, math.sin(a)))
    side = V((0, 1, 0)).cross(d)
    pts, rr = [], []
    for i in range(9):
        y = LG0 + (LG1 - LG0) * i / 8
        rad = 0.0150 - 0.0012 * math.sin(math.pi * (y - Y_BOT) / (Y_TOP - Y_BOT))
        pts.append(d * (rad + 0.0012) + V((0, y, 0)))
    w0 = 0.0042
    for i in range(9):
        t = i / 8
        rr.append(w0 * (0.55 + 0.45 * t) if t > 0.1 else w0 * 0.55 * (0.4 + 6 * t))
    # flat strip as a thin swept ellipse
    b.sweep(pts, rr, iron, n=8, up=tuple(d), ellipse=(1.0, 0.28), cap=True)
    for y in (LG0 + 0.04, LG0 + 0.12, LG0 + 0.20):
        rad = 0.0150 - 0.0012 * math.sin(math.pi * (y - Y_BOT) / (Y_TOP - Y_BOT))
        c = d * (rad + 0.0024) + V((0, y, 0))
        b.ellipsoid(c, (0.0016, 0.0016, 0.0016), brass, nu=8, nv=5)

# ------------------------------------------------------------------ head
# socket block
blk = []
for i, (y, s) in enumerate(((YH - 0.040, 0.86), (YH - 0.036, 0.97), (YH - 0.030, 1.0), (YH + 0.030, 1.0),
                            (YH + 0.036, 0.97), (YH + 0.040, 0.86))):
    blk.append(rsq((0, y, 0), (1, 0, 0), (0, 0, 1), 0.0195 * s, 0.0205 * s, 0.006, n=3))
b.rings(blk, steel, cap0=True, cap1=True, uv=('box', 5.0))
# decorative collars
for y in (YH - 0.043, YH + 0.043):
    b.rings([rsq((0, y - 0.003, 0), (1, 0, 0), (0, 0, 1), 0.0165, 0.0165, 0.005, 3),
             rsq((0, y, 0), (1, 0, 0), (0, 0, 1), 0.0182, 0.0182, 0.005, 3),
             rsq((0, y + 0.003, 0), (1, 0, 0), (0, 0, 1), 0.0165, 0.0165, 0.005, 3)], steel, cap0=False, cap1=False)
# hammer neck + face (toward +Z)
neck = []
prof = [(0.016, 0.0150, 0.0160), (0.030, 0.0118, 0.0128), (0.046, 0.0112, 0.0122), (0.058, 0.0150, 0.0160),
        (0.066, 0.0185, 0.0190), (0.071, 0.0192, 0.0196), (0.074, 0.0190, 0.0194)]
for z, hu, hv in prof:
    neck.append(rsq((0, YH, z), (1, 0, 0), (0, 1, 0), hu, hv, 0.004, n=3))
b.rings(neck, steel, cap0=False, cap1=True, uv=('box', 5.0))
# four pyramidal prongs on the face
for sx in (-1, 1):
    for sy in (-1, 1):
        c = V((sx * 0.0095, YH + sy * 0.0097, 0.074))
        b.lathe([(0.0, 0.0090), (0.0035, 0.0072), (0.0085, 0.0018), (0.0100, 0.0)], steel, n=4, axis='Z', c=c,
                phase=math.pi / 4, cap1=False, flat=True)
# back beak (toward -Z, curving down toward the haft)
bp, br = [], []
for i in range(14):
    t = i / 13
    z = -0.016 - 0.100 * t
    y = YH + 0.004 - 0.040 * t ** 2.2
    bp.append(V((0, y, z)))
    br.append(0.0125 * (1 - t) ** 1.0 + 0.0004)
b.sweep(bp, br, steel, n=6, up=(1, 0, 0), ellipse=(0.62, 1.0), cap=True)
# top spike (+Y), square section rotated 45 deg
b.lathe([(YH + 0.040, 0.0150), (YH + 0.048, 0.0135), (YH + 0.060, 0.0098), (YH + 0.085, 0.0050),
         (YH + 0.110, 0.0008), (YH + 0.113, 0.0)], steel, n=4, axis='Y', phase=math.pi / 4, cap0=True)
# rivet heads through the socket
for sx in (-1, 1):
    b.lathe([(0, 0.0032), (sx * 0.0012, 0.0028), (sx * 0.0020, 0.0012), (sx * 0.0023, 0.0)], brass, n=10,
            axis='X', c=(sx * 0.0193, YH, 0.0), cap1=False)

ob = b.to_object("hammer")
print("TRIS", mesh_tris(ob))
export("hammer")
