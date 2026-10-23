import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/veh_real")
import bpy, math
import numpy as np
from mathutils import Vector, Matrix
from common2 import (reset, export, mat, Builder, empty, wagon_wheel, wood_texture, make_image, catmull,
                     frames_up, mesh_tris)
from horse_real import Horse, build_actions

V = Vector
reset()
NOEXPORT = '--noexport' in sys.argv
SH = 0.08                     # centre the whole rig on the origin
HDY = -1.75 + SH


def P(x, y, z):
    return V((x, y + SH, z))


def hl_y(world_y):            # world y -> horse-local y
    return world_y - HDY


# ---------------------------------------------------------------- horse (draft harness)
h = Horse(dy=HDY, name="horse")
arm = h.build_armature()
h.build_body()
h.build_details()
SWING_Y = -0.53               # P-space y of the swingletree
harness = h.build_harness(trace_end_y=hl_y(SWING_Y + SH), trace_end_z=1.0, trace_x=0.30)
br = h.build_bridle(blinkers=True)
reins = h.build_reins([P(0.16, -0.10, 1.78), P(-0.16, -0.10, 1.78)], sag=0.03, via=h.terrets)
h.finish(harness + [('head', br), ('reins_root', reins)])
build_actions(arm)

# ---------------------------------------------------------------- materials
WT = make_image("wood_grain", wood_texture(256))
W = mat("Wood", "#b27a48", rough=0.75, tex=WT)
WD = mat("Wood_Dark", "#7c5232", rough=0.8, tex=WT)
WL = mat("Wood_Light", "#c99662", rough=0.75, tex=WT)
WW = mat("Wood_Weathered", "#a08a70", rough=0.85, tex=WT)
IR = mat("Metal_Iron", "#4a4848", rough=0.45, metal=0.5)
CV = mat("Cloth_Canvas", "#ddd0ae", rough=0.95)
GL = mat("Lantern_Glow", "#ffc25a", rough=0.25, emit="#ffb347", emit_strength=2.0)
BR = mat("Metal_Brass", "#c09a52", rough=0.35, metal=0.55)
RED = mat("Cloth_Red", "#7d2620", rough=0.95)
ROPE = mat("Rope", "#b79f74", rough=1.0)
SACK = mat("Cloth_Sack", "#a99067", rough=1.0)


def gy(size):
    ax = max(range(3), key=lambda k: size[k])
    return ('grain', [(1, 0, 0), (0, 1, 0), (0, 0, 1)][ax], 1.0, 3.0)


def plank(b, c, size, m, r=0.008, seg=2):
    return b.rbox(c, size, m, r=r, seg=seg, uv=gy(size))


b = Builder()
# ---------------------------------------------------------------- chassis
for s in (1, -1):
    plank(b, P(0.36 * s, 1.30, 0.82), (0.10, 3.30, 0.10), WD, r=0.015)
for y in (-0.30, 0.55, 1.45, 2.30, 2.90):                       # cross members
    plank(b, P(0, y, 0.85), (0.80, 0.08, 0.06), WD, r=0.01, seg=1)
# floor planks (along Y)
for i in range(9):
    x = -0.58 + i * 0.145
    plank(b, P(x, 1.30, 0.92), (0.138, 3.30, 0.035), WW if i % 3 == 1 else W, r=0.006, seg=1)
# side boards (3 planks per side) + front / tail boards
for s in (1, -1):
    for i, m in enumerate((WD, W, WL)):
        plank(b, P(0.625 * s, 1.30, 1.005 + i * 0.135), (0.04, 3.30, 0.125), m, r=0.008)
    for y in (-0.33, 0.55, 1.45, 2.30, 2.93):                   # stakes with iron caps
        plank(b, P(0.66 * s, y, 1.15), (0.05, 0.065, 0.50), WD, r=0.012)
        b.rbox(P(0.664 * s, y, 1.39), (0.056, 0.071, 0.03), IR, r=0.006, seg=1)
        b.rbox(P(0.664 * s, y, 0.96), (0.056, 0.071, 0.03), IR, r=0.006, seg=1)
    plank(b, P(0.65 * s, 1.30, 1.425), (0.085, 3.38, 0.05), WD, r=0.015)   # top rail
    # iron stays (diagonal straps) between stakes
    for y0, y1 in ((0.55, 1.45), (1.45, 2.30)):
        b.seg_box(P(0.648 * s, y0 + 0.05, 1.36), P(0.648 * s, y1 - 0.05, 0.98), 0.006, 0.03, IR, r=0.002,
                  up=(s, 0, 0), uv=None)
for y in (-0.33, 2.93):
    for i, m in enumerate((WD, W, WL)):
        plank(b, P(0, y, 1.005 + i * 0.135), (1.22, 0.04, 0.125), m, r=0.008)
# ---------------------------------------------------------------- running gear
# axles
b.lathe([(-0.88, 0.03), (-0.86, 0.04), (0.86, 0.04), (0.88, 0.03)], IR, n=10, axis='X', c=P(0, 0.05, 0.48))
b.lathe([(-0.90, 0.035), (-0.88, 0.045), (0.88, 0.045), (0.90, 0.035)], IR, n=10, axis='X', c=P(0, 2.30, 0.64))
# front: bolster + fifth wheel
plank(b, P(0, 0.05, 0.69), (1.10, 0.13, 0.10), WD, r=0.015)
b.torus(P(0, 0.05, 0.765), 0.30, 0.012, IR, nu=28, nv=6, axis='Z')
plank(b, P(0, 0.05, 0.765), (0.30, 0.16, 0.05), WD, r=0.01)
# rear bolster
plank(b, P(0, 2.30, 0.80), (1.00, 0.12, 0.05), WD, r=0.012)


def leaf_spring(cx, cy, cz, length, rise, nleaf=4):
    for k in range(nleaf):
        L = length * (1 - 0.2 * k)
        pts = []
        for i in range(9):
            t = (i / 8) * 2 - 1
            pts.append(P(cx, cy + t * L / 2, cz + rise * t * t - k * 0.014))
        b.sweep(pts, 0.007, IR, n=4, ellipse=(4.0, 1.0), up=(0, 0, 1))
    for d in (-0.07, 0.07):        # U-bolts
        b.rbox(P(cx, cy + d * 0.5, cz - 0.03), (0.075, 0.016, 0.09), IR, r=0.005, seg=1)
    for e in (-1, 1):              # shackles to the sill
        b.rbox(P(cx, cy + e * length / 2, cz + rise + 0.035), (0.03, 0.03, 0.07), IR, r=0.006, seg=1)


for s in (1, -1):
    leaf_spring(0.36 * s, 2.30, 0.705, 0.90, 0.055)
    leaf_spring(0.36 * s, 0.05, 0.535, 0.62, 0.06)
# ---------------------------------------------------------------- shafts, swingletree
for s in (1, -1):
    pts = [P(0.40 * s, -0.30, 0.90), P(0.41 * s, -0.95, 0.98), P(0.41 * s, -1.70, 1.10), P(0.40 * s, -2.35, 1.16),
           P(0.37 * s, -2.55, 1.22)]
    b.sweep(pts, [0.04, 0.036, 0.032, 0.028, 0.024], WL, n=10, sub=3, uv=('grain', (0, 1, 0), 1.0, 3.0))
    b.lathe([(0, 0.0), (0.0, 0.03), (0.08, 0.03), (0.09, 0.022)], IR, n=10, axis='Y', c=P(0.375 * s, -2.58, 1.21),
            M=Matrix.Translation(P(0.375 * s, -2.58, 1.21)) @ Matrix.Rotation(math.radians(180), 4, 'Z')
            @ Matrix.Translation(-P(0.375 * s, -2.58, 1.21)))
    b.torus(P(0.42 * s, -1.80, 1.12), 0.03, 0.006, IR, nu=12, nv=5, axis='Y')      # tug loop
b.sweep([P(-0.41, -0.62, 0.97), P(0.41, -0.62, 0.97)], 0.03, WD, n=10, uv=('grain', (1, 0, 0), 1.0, 3.0))
b.sweep([P(-0.32, SWING_Y, 1.0), P(0.32, SWING_Y, 1.0)], 0.028, WD, n=10, uv=('grain', (1, 0, 0), 1.0, 3.0))
for s in (1, -1):
    b.lathe([(0, 0.032), (0.05, 0.032)], IR, n=10, axis='X', c=P(0.30 * s - 0.025, SWING_Y, 1.0))
b.seg_box(P(0, -0.25, 0.86), P(0, SWING_Y, 1.0), 0.07, 0.06, WD, r=0.012)
b.seg_box(P(0, -0.62, 0.97), P(0, -0.25, 0.90), 0.05, 0.05, WD, r=0.01)
# ---------------------------------------------------------------- driver bench + footboard
plank(b, P(0, 0.15, 1.42), (1.16, 0.40, 0.05), WL, r=0.015)
plank(b, P(0, 0.15, 1.24), (1.00, 0.34, 0.30), WD, r=0.012)            # box under the seat
for s in (1, -1):
    plank(b, P(0.505 * s, 0.15, 1.20), (0.05, 0.36, 0.40), WD, r=0.012)
    arm_pts = [P(0.56 * s, 0.36, 1.68), P(0.575 * s, 0.25, 1.62), P(0.575 * s, 0.10, 1.585), P(0.57 * s, -0.02, 1.60)]
    b.sweep(arm_pts, 0.022, WD, n=8, sub=3, uv=('grain', (0, 1, 0), 1.0, 3.0))
    b.sweep([P(0.57 * s, 0.0, 1.59), P(0.56 * s, 0.02, 1.44)], 0.016, IR, n=6)
    b.sweep([P(0.56 * s, 0.30, 1.62), P(0.55 * s, 0.30, 1.44)], 0.016, IR, n=6)
# backrest: top rail + spindles
b.sweep([P(-0.58, 0.37, 1.70), P(0, 0.39, 1.73), P(0.58, 0.37, 1.70)], 0.028, WD, n=10, sub=4,
        uv=('grain', (1, 0, 0), 1.0, 3.0))
plank(b, P(0, 0.35, 1.47), (1.12, 0.04, 0.06), WD)
for i in range(9):
    x = -0.48 + i * 0.12
    b.lathe([(0, 0.014), (0.06, 0.018), (0.12, 0.014), (0.2, 0.017), (0.25, 0.013)], WD, n=6, axis='Z',
            c=P(x, 0.36, 1.48), cap0=False, cap1=False)
# cushions (seat + back)
b.rbox(P(0, 0.14, 1.475), (0.96, 0.34, 0.06), RED, r=0.025, seg=3)
b.rbox(P(0, 0.33, 1.60), (0.90, 0.05, 0.18), RED, r=0.02, seg=3,
       M=Matrix.Translation(P(0, 0.33, 1.60)) @ Matrix.Rotation(-0.15, 4, 'X') @ Matrix.Translation(-P(0, 0.33, 1.60)))
for x in (-0.3, 0.0, 0.3):
    b.ellipsoid(P(x, 0.14, 1.507), (0.012, 0.012, 0.006), BR, 8, 4)
# footboard (angled) + dash
b.rbox(P(0, -0.42, 1.12), (1.10, 0.30, 0.035), W, r=0.008, uv=gy((1.1, 0.3, 0.035)),
       M=Matrix.Translation(P(0, -0.42, 1.12)) @ Matrix.Rotation(0.55, 4, 'X') @ Matrix.Translation(-P(0, -0.42, 1.12)))
plank(b, P(0, -0.56, 1.30), (1.10, 0.035, 0.12), WD)
for s in (1, -1):
    plank(b, P(0.53 * s, -0.42, 1.10), (0.04, 0.26, 0.26), WD)
    b.sweep([P(0.53 * s, -0.56, 1.36), P(0.53 * s, -0.56, 1.0)], 0.012, IR, n=6)
# ---------------------------------------------------------------- canvas cover
HOOPS = [0.60, 1.38, 2.16, 2.93]
R0, CZ, HK = 0.66, 1.43, 1.08


def arch_pt(a, r, y):
    return P(math.cos(a) * r, y, CZ + math.sin(a) * r * HK)


NA = 22
angles = [math.pi * i / NA for i in range(NA + 1)]
ys = []
for i in range(len(HOOPS) - 1):
    for k in range(6):
        ys.append(HOOPS[i] + (HOOPS[i + 1] - HOOPS[i]) * k / 6)
ys.append(HOOPS[-1])
ys = [0.50] + ys + [3.00]
verts, faces = [], []
for j, y in enumerate(ys):
    if y < HOOPS[0]:
        sag, f = 0.0, (HOOPS[0] - y) / 0.10
    elif y > HOOPS[-1]:
        sag, f = 0.0, (y - HOOPS[-1]) / 0.07
    else:
        i = max(k for k in range(len(HOOPS) - 1) if HOOPS[k] <= y + 1e-6) if y < HOOPS[-1] else len(HOOPS) - 2
        u = (y - HOOPS[i]) / (HOOPS[i + 1] - HOOPS[i])
        sag, f = 0.035 * math.sin(math.pi * u), 0.0
    for a in angles:
        side = min(a, math.pi - a) / (math.pi / 2)
        wr = 0.006 * math.sin(a * 9 + y * 13) * (1 if sag else 0)
        pull = 0.05 * f * (0.4 + 0.6 * math.sin(a))            # gathered ends
        r = R0 - sag * (0.35 + 0.65 * min(1, side * 2.2)) + wr - pull
        if f:
            r += 0.012 * math.sin(a * 14) * f
        verts.append(arch_pt(a, r, y))
K = len(angles)
for j in range(len(ys) - 1):
    for i in range(K - 1):
        a = j * K + i
        faces.append((a, a + 1, a + K + 1, a + K))
b.add(verts, faces, CV)
# rear: puckered end panel with an oval opening
rv, rf = [], []
for ring, (scale, y) in enumerate(((0.93, 3.00), (0.62, 3.04), (0.40, 3.05))):
    for a in angles:
        r = R0 * scale + (0.015 * math.sin(a * 16) if ring else 0)
        rv.append(P(math.cos(a) * r, y, CZ + 0.02 * (2 - ring) / 2 + math.sin(a) * r * HK * (0.9 if ring == 2 else 1)))
for ring in range(2):
    for i in range(K - 1):
        a = ring * K + i
        rf.append((a, a + 1, a + K + 1, a + K))
b.add(rv, rf, CV)
# drawstring ropes at both openings
b.sweep([arch_pt(a, R0 * 0.40 + 0.01, 3.05) for a in angles], 0.008, ROPE, n=5)
b.sweep([arch_pt(a, R0 - 0.045, 0.50) for a in angles], 0.009, ROPE, n=5)
# bows (hoops): bent wood on the outside
for y in HOOPS:
    pts = [arch_pt(a, R0 + 0.02, y) for a in angles]
    pts = [P(math.cos(0) * (R0 + 0.02), y, 1.40)] + pts + [P(-(R0 + 0.02), y, 1.40)]
    b.sweep(pts, 0.022, WD, n=6, ellipse=(1.0, 1.4), up=(0, 1, 0))
# tie-down ropes along the lower edge
for s in (1, -1):
    for y in np.linspace(0.75, 2.80, 7):
        b.torus(P(0.665 * s, y, 1.42), 0.03, 0.006, ROPE, nu=8, nv=3, axis='Y')
# ---------------------------------------------------------------- lantern on a bracket (front right)
LX, LY = -0.66, -0.33
b.sweep([P(LX, LY, 1.40), P(LX, LY, 1.95)], 0.02, WD, n=8)
b.sweep([P(LX, LY, 1.92), P(LX - 0.06, LY, 1.95), P(LX - 0.14, LY, 1.95)], 0.009, IR, n=6, sub=2)
b.sweep([P(LX - 0.10, LY, 1.95), P(LX - 0.02, LY, 1.82)], 0.006, IR, n=5)
LC = P(LX - 0.14, LY, 1.76)
b.torus(LC + V((0, 0, 0.165)), 0.018, 0.004, IR, nu=10, nv=4, axis='Y')
b.lathe([(0.10, 0.0), (0.10, 0.012), (0.125, 0.035), (0.13, 0.06), (0.135, 0.075), (0.145, 0.075)], IR, n=12, axis='Z',
        c=LC, cap0=False)
b.lathe([(-0.09, 0.07), (-0.08, 0.075), (-0.07, 0.07), (-0.07, 0.06)], IR, n=12, axis='Z', c=LC)
b.lathe([(-0.07, 0.055), (0.10, 0.055)], GL, n=8, axis='Z', c=LC, phase=math.pi / 8)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    o = V((math.cos(a) * 0.058, math.sin(a) * 0.058, 0))
    b.sweep([LC + o + V((0, 0, -0.07)), LC + o + V((0, 0, 0.10))], 0.006, IR, n=4)
# ---------------------------------------------------------------- cargo
# barrel
bc = P(-0.28, 1.05, 0.94)
prof = [(0.0, 0.19), (0.05, 0.21), (0.15, 0.23), (0.30, 0.235), (0.45, 0.23), (0.55, 0.21), (0.60, 0.19)]
b.lathe(prof, W, n=16, axis='Z', c=bc, uv=('grain', (0, 0, 1), 1.0, 3.0))
for zz, rr in ((0.06, 0.212), (0.16, 0.232), (0.44, 0.232), (0.54, 0.212)):
    b.lathe([(zz - 0.015, rr), (zz - 0.012, rr + 0.005), (zz + 0.012, rr + 0.005), (zz + 0.015, rr)], IR, n=16,
            axis='Z', c=bc)
# crates
for c, sz in ((P(0.27, 1.15, 1.15), (0.42, 0.42, 0.42)), (P(0.30, 1.62, 1.07), (0.36, 0.40, 0.28)),
              (P(0.25, 1.17, 1.48), (0.30, 0.30, 0.24))):
    plank(b, c, (sz[0] - 0.02, sz[1] - 0.02, sz[2] - 0.02), WL, r=0.01)
    for dz in (-sz[2] / 2 + 0.03, sz[2] / 2 - 0.03):
        plank(b, c + V((0, 0, dz)), (sz[0], sz[1], 0.05), WD, r=0.008, seg=1)
    for dx in (-1, 1):
        plank(b, c + V((dx * (sz[0] / 2 - 0.02), 0, 0)), (0.045, sz[1] + 0.005, sz[2] + 0.004), WD, r=0.008, seg=1)
# sacks
for c, rot in ((P(-0.25, 1.70, 1.08), 0.3), (P(-0.30, 2.15, 1.08), -0.2), (P(0.20, 2.25, 1.05), 1.4)):
    M = Matrix.Translation(c) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
    b.lathe([(-0.24, 0.0), (-0.22, 0.12), (-0.12, 0.165), (0.05, 0.17), (0.17, 0.13), (0.22, 0.06),
             (0.25, 0.035), (0.30, 0.05), (0.31, 0.0)], SACK, n=12, axis='Z', M=M, ellipse=(1.0, 0.62))
    b.torus((0, 0, 0.25), 0.04, 0.008, ROPE, nu=10, nv=4, axis='Z', M=M)
# bucket hanging at the back + rear step
bk = P(0.40, 3.08, 0.66)
b.lathe([(0.0, 0.10), (0.24, 0.13), (0.25, 0.135)], W, n=14, axis='Z', c=bk, cap1=False, uv=('grain', (0, 0, 1), 1, 3))
for zz in (0.03, 0.21):
    b.lathe([(zz - 0.01, 0.105 + zz * 0.12 + 0.004), (zz + 0.01, 0.105 + zz * 0.12 + 0.006)], IR, n=14, axis='Z', c=bk)
b.sweep([bk + V((-0.13, 0, 0.24)), bk + V((-0.08, 0, 0.36)), bk + V((0, 0, 0.40)), bk + V((0.08, 0, 0.36)),
         bk + V((0.13, 0, 0.24))], 0.005, IR, n=5, sub=2)
b.sweep([P(0.40, 2.95, 1.10), P(0.40, 3.06, 1.06)], 0.012, IR, n=6)
b.rbox(P(0, 3.04, 0.78), (0.70, 0.20, 0.035), WD, r=0.008, uv=gy((0.7, 0.2, 0.035)))
for s in (1, -1):
    b.sweep([P(0.30 * s, 2.92, 0.86), P(0.30 * s, 3.10, 0.78)], 0.012, IR, n=6)
# brake: lever on the right + beam with shoes in front of the rear wheels
b.sweep([P(-0.70, 1.85, 0.80), P(-0.71, 1.78, 1.30), P(-0.72, 1.70, 1.62)], 0.016, IR, n=6, sub=2)
b.lathe([(0, 0.022), (0.10, 0.024), (0.11, 0.0)], WD, n=8, axis='Z', c=P(-0.72, 1.70, 1.62))
b.sweep([P(-0.84, 1.88, 0.72), P(0.84, 1.88, 0.72)], 0.03, WD, n=8, uv=('grain', (1, 0, 0), 1.0, 3.0))
for s in (1, -1):
    b.rbox(P(0.80 * s, 1.75, 0.80), (0.08, 0.06, 0.20), WD, r=0.012,
           M=Matrix.Translation(P(0.80 * s, 1.75, 0.80)) @ Matrix.Rotation(0.6, 4, 'X')
           @ Matrix.Translation(-P(0.80 * s, 1.75, 0.80)))
body = b.to_object("carriage_body")
print("CARRIAGE body tris", mesh_tris(body))

# ---------------------------------------------------------------- wheels (origin = centre, spin = local X)
for nm, x, y, r, sp in (("wheel_fl", 0.78, 0.05, 0.48, 12), ("wheel_fr", -0.78, 0.05, 0.48, 12),
                        ("wheel_rl", 0.80, 2.30, 0.64, 14), ("wheel_rr", -0.80, 2.30, 0.64, 14)):
    wb = Builder()
    wagon_wheel(wb, r, 0.075, W, IR, spokes=sp, n=28)
    if x < 0:
        for v in wb.bm.verts:
            v.co.x = -v.co.x
        for f in wb.bm.faces:
            f.normal_flip()
    ob = wb.to_object(nm)
    ob.location = P(x, y, r)
    print("WHEEL", nm, mesh_tris(ob))

empty("seat", P(0, 0.15, 1.51))
tot = sum(mesh_tris(o) for o in bpy.data.objects if o.type == 'MESH')
print("TOTAL TRIS", tot)
if NOEXPORT:
    bpy.ops.wm.save_as_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/veh_real/carriage_test.blend")
else:
    export("carriage")
