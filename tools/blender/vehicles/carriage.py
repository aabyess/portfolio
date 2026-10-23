import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/vehicles")
import bpy, math
from mathutils import Vector
from common import reset, export, mat, Builder, empty, spoked_wheel
from horse_lib import build_horse

reset()
SH = 0.08                     # centre the whole rig on the origin
build_horse(dy=-1.75 + SH, saddle=False, harness=True, name="horse")

W = mat("Wood", "#8a5a32"); WD = mat("Wood_Dark", "#5a3a1f"); WL = mat("Wood_Light", "#a8743f")
IR = mat("Metal_Iron", "#38363a", rough=0.6); CV = mat("Cloth_Canvas", "#d9c9a1"); CVD = mat("Cloth_CanvasDark", "#bfae86")
GL = mat("Lantern_Glow", "#ffc25a", rough=0.3); BR = mat("Metal_Brass", "#b8924a", rough=0.5)


def P(x, y, z):
    return Vector((x, y + SH, z))


b = Builder()
# chassis beams + floor
for s in (1, -1):
    b.box(P(0.36 * s, 1.30, 0.82), (0.10, 3.30, 0.10), WD)
b.box(P(0, 1.30, 0.92), (1.30, 3.30, 0.08), W)
# side boards (3 planks each, alternating tones)
for s in (1, -1):
    for i, m in enumerate((WD, W, WL)):
        b.box(P(0.625 * s, 1.30, 1.03 + i * 0.135), (0.05, 3.30, 0.125), m)
    for y in (-0.33, 0.55, 1.45, 2.30, 2.93):                     # posts
        b.box(P(0.655 * s, y, 1.16), (0.06, 0.07, 0.48), WD)
    b.box(P(0.65 * s, 1.30, 1.42), (0.09, 3.36, 0.05), WD)        # top rail
for y in (-0.33, 2.93):
    for i, m in enumerate((WD, W, WL)):
        b.box(P(0, y, 1.03 + i * 0.135), (1.22, 0.05, 0.125), m)
# axles + bolsters
b.tube(P(-0.86, 0.05, 0.48), P(0.86, 0.05, 0.48), 0.04, 0.04, IR, n=6)
b.tube(P(-0.88, 2.30, 0.64), P(0.88, 2.30, 0.64), 0.045, 0.045, IR, n=6)
b.box(P(0, 0.05, 0.64), (1.10, 0.14, 0.28), WD)
b.box(P(0, 2.30, 0.74), (1.10, 0.14, 0.12), WD)
for s in (1, -1):                                                  # leaf springs
    b.box(P(0.36 * s, 2.30, 0.705), (0.08, 0.60, 0.04), IR)
# shafts + swingletree
for s in (1, -1):
    b.tube(P(0.40 * s, -0.33, 0.92), P(0.40 * s, -2.50, 1.16), 0.04, 0.032, WL, n=6)
    b.box(P(0.40 * s, -2.50, 1.17), (0.06, 0.05, 0.06), IR)
b.tube(P(-0.42, -0.62, 1.00), P(0.42, -0.62, 1.00), 0.03, 0.03, WD, n=6)
b.seg(P(0, -0.33, 0.95), P(0, -0.62, 1.00), (0.08, 0.06), (0.06, 0.05), WD)
# driver bench, backrest, footboard
b.box(P(0, 0.15, 1.42), (1.16, 0.38, 0.08), WL)
b.box(P(0, 0.15, 1.36), (1.0, 0.30, 0.06), WD)
for s in (1, -1):
    b.box(P(0.50 * s, 0.15, 1.20), (0.06, 0.30, 0.40), WD)
    b.box(P(0.56 * s, 0.25, 1.56), (0.05, 0.30, 0.05), WD)        # arm rests
    b.box(P(0.56 * s, 0.12, 1.50), (0.05, 0.05, 0.12), WD)
b.box(P(0, 0.36, 1.62), (1.16, 0.06, 0.30), W)
b.box(P(0, 0.15, 1.475), (0.90, 0.30, 0.03), mat("Cloth_Red", "#8e2b22"))   # seat cushion
b.seg(P(0, -0.30, 1.02), P(0, -0.52, 1.20), (1.10, 0.05), (1.10, 0.05), W, twist_up=(0, -0.6, 0.8))
for s in (1, -1):
    b.box(P(0.53 * s, -0.42, 1.06), (0.05, 0.22, 0.20), WD)
# canvas cover (closed arched shell) + hoops
def arch(y0, y1, R, t, m, n=7, cz=1.42):
    vs, faces = [], []
    for i in range(n + 1):
        a = math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        for y in (y0, y1):
            for r in (R, R - t):
                vs.append(P(ca * r, y, cz + sa * r * 1.05))
    for i in range(n):
        o, q = i * 4, (i + 1) * 4
        faces += [(o + 0, o + 1, q + 1, q + 0), (o + 2, o + 3, q + 3, q + 2), (o + 0, o + 2, q + 2, q + 0), (o + 1, o + 3, q + 3, q + 1)]
    faces += [(0, 1, 3, 2), (n * 4, n * 4 + 1, n * 4 + 3, n * 4 + 2)]
    b._add(vs, faces, m)
arch(0.58, 2.95, 0.66, 0.03, CV)
for y in (0.60, 1.38, 2.16, 2.93):
    arch(y - 0.03, y + 0.03, 0.685, 0.05, WD)
# back panel (half disc) of canvas, slightly darker
n = 7
vs = [P(0, 2.94, 1.42)] + [P(math.cos(math.pi * i / n) * 0.64, 2.94, 1.42 + math.sin(math.pi * i / n) * 0.64 * 1.05) for i in range(n + 1)]
b._add(vs, [(0, i + 1, i + 2) for i in range(n)], CVD)
# cargo visible through the front opening: barrel + crate
b.tube(P(-0.25, 1.05, 0.96), P(-0.25, 1.05, 1.56), 0.22, 0.22, W, n=8)
b.tube(P(-0.25, 1.05, 1.08), P(-0.25, 1.05, 1.12), 0.235, 0.235, IR, n=8)
b.tube(P(-0.25, 1.05, 1.42), P(-0.25, 1.05, 1.46), 0.235, 0.235, IR, n=8)
b.box(P(0.27, 1.15, 1.18), (0.42, 0.42, 0.44), WL)
b.box(P(0.27, 1.15, 1.18), (0.44, 0.06, 0.46), WD)
# lantern on a post at the front right corner
b.box(P(-0.62, -0.33, 1.68), (0.05, 0.05, 0.55), WD)
b.box(P(-0.69, -0.33, 1.94), (0.18, 0.04, 0.04), WD)
b.box(P(-0.76, -0.33, 1.80), (0.12, 0.12, 0.16), GL)
b.box(P(-0.76, -0.33, 1.895), (0.15, 0.15, 0.03), IR)
b.box(P(-0.76, -0.33, 1.705), (0.14, 0.14, 0.03), IR)
b.seg(P(-0.76, -0.33, 1.91), P(-0.76, -0.33, 1.95), (0.03, 0.03), (0.01, 0.01), IR)
# rear step
b.box(P(0, 3.00, 0.80), (0.70, 0.18, 0.04), WD)
b.to_object("carriage_body")

# wheels (origin = wheel centre, spin axis = local X)
for nm, x, y, r, sp in (("wheel_fl", 0.78, 0.05, 0.48, 10), ("wheel_fr", -0.78, 0.05, 0.48, 10),
                        ("wheel_rl", 0.80, 2.30, 0.64, 12), ("wheel_rr", -0.80, 2.30, 0.64, 12)):
    wb = Builder()
    spoked_wheel(wb, r, 0.08, W, IR, WD, spokes=sp, n=16)
    ob = wb.to_object("_tmp")
    ob.name = nm; ob.data.name = nm
    ob.location = P(x, y, r)

empty("seat", P(0, 0.15, 1.50))
export("carriage")
