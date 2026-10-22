"""Usage: Blender -b --factory-startup --python bikes.py -- motorcycle|bicycle [--noexport]"""
import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/veh_v3")
import bpy, math
import numpy as np
from mathutils import Vector, Matrix
from bake3 import bake_group
from parts3 import roller_chain, sprocket
from common3 import (reset, export, mat, Builder, empty, wire_wheel, catmull, frames_up, mesh_tris,
                     wicker_texture, make_image)

V = Vector
KIND = sys.argv[sys.argv.index('--') + 1]
NOEXPORT = '--noexport' in sys.argv
reset()

RUB = mat("Rubber", "#1c1a19", rough=0.9)
TYRE = mat("Rubber_Tyre", "#1e1c1b", rough=0.9)
SPK = mat("Metal_Spoke", "#c8c5bf", rough=0.25, metal=0.55)
CHR = mat("Metal_Chrome", "#cfccc6", rough=0.22, metal=0.55)
DRK = mat("Metal_Dark", "#2a282b", rough=0.5, metal=0.3)
LEA = mat("Leather_Saddle", "#6e3d1d", rough=0.5)
LED = mat("Leather_Dark", "#3a2214", rough=0.55)
BRS = mat("Metal_Brass", "#c09a52", rough=0.35, metal=0.55)
LMP = mat("Lamp_Glass", "#ffe9b8", rough=0.15, emit="#ffd27a", emit_strength=1.5)
RED = mat("Lamp_Red", "#a3201a", rough=0.3, emit="#5a0c08", emit_strength=0.6)


def helix(b, p0, p1, r, turns, wire, m, n=6, steps=None):
    p0, p1 = V(p0), V(p1)
    ax = (p1 - p0)
    L = ax.length
    ax.normalize()
    s = V((1, 0, 0)) if abs(ax.x) < 0.9 else V((0, 1, 0))
    s = (s - ax * ax.dot(s)).normalized()
    u = ax.cross(s)
    k = steps or int(turns * 10)
    pts = [p0 + ax * (L * i / k) + s * (math.cos(2 * math.pi * turns * i / k) * r) +
           u * (math.sin(2 * math.pi * turns * i / k) * r) for i in range(k + 1)]
    b.sweep(pts, wire, m, n=n)


def fender(b, center, Rf, a0, a1, width, valance, m, k=16, thick=0.004):
    """Valanced mudguard around a wheel (axle = X). Angles in degrees from +Y toward +Z."""
    c = V(center)
    pts, ups = [], []
    for i in range(k + 1):
        a = math.radians(a0 + (a1 - a0) * i / k)
        rad = V((0, math.cos(a), math.sin(a)))
        pts.append(c + rad * Rf)
        ups.append(rad)
    fr = frames_up(pts, lambda i, p: ups[i])
    prof = []
    nphi = 9
    for j in range(nphi):
        ph = -math.pi / 2 + math.pi * j / (nphi - 1)
        prof.append((width / 2 * math.sin(ph), -valance * (1 - math.cos(ph))))
    inner = [(x * (1 - thick / (width / 2)), y - thick) for x, y in reversed(prof)]
    ring = prof + inner
    b.loft(pts, fr, lambda i: ring, m)


def wheel(name, c, r, tyre_w, spokes, parent=None, extra=None, hub_w=0.10, hub_r=0.035, spoke_r=0.0022):
    b = Builder()
    wire_wheel(b, r, tyre_w, TYRE, CHR, CHR, SPK, spokes=spokes, n=36, hub_w=hub_w, hub_r=hub_r, spoke_r=spoke_r)
    if extra:
        extra(b)
    for v in b.bm.verts:
        v.co += V(c)
    ob = b.to_object(name, origin=c, parent=parent)
    print("WHEEL", name, mesh_tris(ob))
    return ob


def saddle_loft(b, secs, thick, m, sub=3):
    """secs: (y, z_top, half_width). Flat-bottomed domed leather saddle along Y."""
    sec = catmull(secs, sub)
    C = [V((0, s[0], s[1] - thick / 2)) for s in sec]
    fr = [(V((0, 1, 0)), V((1, 0, 0)), V((0, 0, 1)))] * len(C)
    ring = []
    n = 18
    for j in range(n):
        th = 2 * math.pi * j / n
        c, s = math.cos(th), math.sin(th)
        ring.append((c * (1 - 0.08 * max(0, -s)), s if s > 0 else s * 0.7))
    b.loft(C, fr, lambda i: [(x * sec[i][2], y * thick / 2) for x, y in ring], m)
    return sec


if KIND == 'motorcycle':
    PAINT = mat("Paint_Oxblood", "#5e1a17", rough=0.3)
    FRM = mat("Paint_Black", "#1d1b1d", rough=0.35)
    ALU = mat("Metal_Engine", "#9a968e", rough=0.45, metal=0.4)
    GOLD = mat("Paint_GoldLine", "#c9a24a", rough=0.4, metal=0.3)
    R, FW, RW = 0.33, V((0, -0.70, 0.33)), V((0, 0.70, 0.33))
    b = Builder()
    T = lambda pts, r=0.018, m=FRM, sub=3: b.sweep(pts, r, m, n=10, sub=sub)
    # ---- frame
    b.lathe([(0, 0.028), (0.005, 0.032), (0.17, 0.032), (0.175, 0.028)], FRM, n=12, axis='Z',
            M=Matrix.Translation((0, -0.605, 0.855)) @ Matrix.Rotation(math.radians(-13), 4, 'X'))
    T([(0, -0.57, 0.99), (0, -0.25, 0.955), (0, 0.05, 0.925), (0, 0.20, 0.90)])
    T([(0, -0.60, 0.88), (0, -0.48, 0.66), (0, -0.36, 0.42), (0, -0.32, 0.34)], 0.02)
    for s in (1, -1):
        T([(0, -0.32, 0.345), (0.05 * s, -0.27, 0.24), (0.055 * s, -0.12, 0.18), (0.055 * s, 0.15, 0.18),
           (0.05 * s, 0.32, 0.21)], 0.016)
        T([(0.075 * s, 0.20, 0.88), (0.08 * s, 0.45, 0.60), (0.085 * s, 0.70, 0.35)], 0.014, sub=2)
        T([(0.05 * s, 0.32, 0.21), (0.08 * s, 0.50, 0.27), (0.085 * s, 0.70, 0.31)], 0.014, sub=2)
        b.rbox((0.085 * s, 0.70, 0.33), (0.012, 0.08, 0.06), FRM, r=0.008)
        b.rbox((0.20 * s, 0.10, 0.27), (0.12, 0.05, 0.035), RUB, r=0.012)          # footrests
        b.sweep([(0.05 * s, 0.10, 0.22), (0.15 * s, 0.10, 0.27)], 0.01, DRK, n=6)
    T([(0, 0.32, 0.21), (0, 0.26, 0.55), (0, 0.20, 0.90)], 0.018, sub=2)
    # ---- tank (round saddle tank) with pinstripe, knee pads, cap
    TK = [(-0.565, 1.02, 0.02, 0.02), (-0.55, 1.02, 0.075, 0.07), (-0.51, 1.025, 0.112, 0.098),
          (-0.40, 1.03, 0.133, 0.113), (-0.20, 1.022, 0.138, 0.113), (-0.02, 1.0, 0.124, 0.10),
          (0.09, 0.985, 0.09, 0.08), (0.135, 0.98, 0.04, 0.04), (0.145, 0.98, 0.008, 0.008)]
    sec = catmull(TK, 3)
    C = [V((0, s[0], s[1])) for s in sec]
    fr = [(V((0, 1, 0)), V((1, 0, 0)), V((0, 0, 1)))] * len(C)
    ring = [(math.cos(2 * math.pi * j / 22), math.sin(2 * math.pi * j / 22) * (1 if j < 11 else 0.8)) for j in range(22)]
    b.loft(C, fr, lambda i: [(x * sec[i][2], y * sec[i][3]) for x, y in ring], PAINT)
    for s in (1, -1):
        th = math.radians(12)
        line = [V((s * (q[2] * math.cos(th) + 0.002), q[0], q[1] + q[3] * math.sin(th))) for q in sec[3:-3]]
        b.sweep(line, 0.0045, GOLD, n=5)
        th = math.radians(-25)
        line = [V((s * (q[2] * math.cos(th) * 1.0 + 0.002), q[0], q[1] + q[3] * 0.8 * math.sin(th))) for q in sec[4:-4]]
        b.sweep(line, 0.003, GOLD, n=4)
        b.rbox((0.118 * s, 0.03, 0.965), (0.03, 0.12, 0.085), RUB, r=0.012,
               M=Matrix.Translation((0.118 * s, 0.03, 0.965)) @ Matrix.Rotation(-0.45 * s, 4, 'Y')
               @ Matrix.Translation((-0.118 * s, -0.03, -0.965)))
    b.lathe([(0, 0.035), (0.01, 0.038), (0.022, 0.034), (0.03, 0.0)], CHR, n=14, axis='Z', c=(0.03, -0.38, 1.135))
    b.lathe([(0, 0.022), (0.02, 0.022), (0.026, 0.0)], CHR, n=10, axis='Z', c=(-0.04, -0.30, 1.135))
    # hand gear-change on the right of the tank
    b.sweep([(-0.10, -0.12, 0.88), (-0.15, -0.16, 0.98), (-0.165, -0.20, 1.08)], 0.008, CHR, n=6, sub=2)
    b.ellipsoid((-0.167, -0.205, 1.10), (0.022, 0.022, 0.022), RUB, 10, 6)
    # ---- engine: crankcase, finned barrel, head, gearbox, covers
    b.lathe([(-0.095, 0.11), (-0.09, 0.125), (-0.07, 0.135), (0.07, 0.135), (0.09, 0.125), (0.095, 0.11)], ALU, n=20,
            axis='X', c=(0, -0.03, 0.36))
    b.lathe([(-0.12, 0.0), (-0.12, 0.08), (-0.105, 0.095), (-0.095, 0.095)], CHR, n=18, axis='X', c=(0, -0.03, 0.36))
    cyl0, cyl1 = V((0, -0.07, 0.46)), V((0, -0.155, 0.80))
    ax = (cyl1 - cyl0).normalized()
    Mc = Matrix.Translation(cyl0) @ V((0, 0, 1)).rotation_difference(ax).to_matrix().to_4x4()
    prof = [(0.0, 0.058)]
    z = 0.02
    for f in range(13):
        rr = 0.088 if f < 9 else 0.098
        prof += [(z, 0.058), (z + 0.002, rr), (z + 0.008, rr), (z + 0.010, 0.058)]
        z += 0.021
    prof.append((z + 0.01, 0.05))
    b.lathe(prof, ALU, n=20, axis='Z', M=Mc)
    b.rbox((0, 0, z + 0.04), (0.11, 0.13, 0.06), ALU, r=0.02, M=Mc)
    for k in range(4):                                     # cylinder-head fins
        b.rbox((0, 0, z + 0.018 + k * 0.016), (0.15, 0.17, 0.004), ALU, r=0.0015, seg=1, M=Mc)
    # pushrod tubes (right side) crankcase -> head, rocker box
    for dy in (-0.012, 0.012):
        b.sweep([(-0.065, -0.02 + dy, 0.47), (-0.075, -0.115 + dy, 0.76)], 0.007, CHR, n=6)
    b.rbox(cyl0 + ax * (z + 0.07) + V((-0.04, 0.0, 0.0)), (0.05, 0.08, 0.035), ALU, r=0.01)
    # spark plug + HT lead to the magneto
    plug = cyl0 + ax * (z - 0.02) + V((0, -0.06, 0.0))
    b.lathe([(0, 0.008), (0.03, 0.008), (0.032, 0.006), (0.05, 0.004)], mat("Ceramic", "#e8e2d4", rough=0.3), n=8,
            axis='Y', c=(0, 0, 0), M=Matrix.Translation(plug) @ Matrix.Rotation(math.pi, 4, 'Z'))
    b.sweep([plug + V((0, -0.05, 0)), plug + V((-0.02, -0.08, -0.08)), (-0.03, -0.25, 0.56), (0, -0.20, 0.535)],
            0.004, mat("Rubber_Lead", "#141212", rough=0.6), n=5, sub=3)
    # carburettor: body, float bowl, tickler, bell mouth + fuel line from the tank tap
    cb = cyl0 + ax * 0.23 + V((0, 0.10, -0.02))
    b.lathe([(-0.025, 0.0), (-0.025, 0.022), (0.025, 0.022), (0.025, 0.0)], ALU, n=12, axis='Z', c=cb + V((0, 0.03, 0.01)))
    b.lathe([(-0.07, 0.0), (-0.07, 0.024), (-0.03, 0.026), (-0.025, 0.0)], ALU, n=12, axis='Z', c=cb + V((-0.035, 0.03, 0.0)))
    b.lathe([(0, 0.004), (0.02, 0.004), (0.022, 0.007), (0.026, 0.0)], CHR, n=8, axis='Z', c=cb + V((-0.035, 0.03, 0.024)))
    b.lathe([(0.0, 0.016), (0.02, 0.018), (0.04, 0.03), (0.042, 0.03)], CHR, n=12, axis='Y', c=cb + V((0, 0.05, 0.01)),
            cap1=False)
    b.sweep([(-0.04, -0.12, 0.93), (-0.05, -0.05, 0.86), (-0.04, 0.0, 0.74), cb + V((-0.035, 0.03, 0.03))], 0.004,
            mat("Fuel_Line", "#6a4a2a", rough=0.5), n=5, sub=3)
    b.lathe([(0, 0.008), (0.02, 0.008), (0.022, 0.0)], BRS, n=8, axis='Z', c=(-0.04, -0.12, 0.925))  # fuel tap
    # kick-starter (right) + brake pedal (left), tool box
    b.sweep([(-0.10, 0.25, 0.40), (-0.12, 0.33, 0.47), (-0.125, 0.42, 0.56)], 0.011, CHR, n=8, sub=2)
    b.rbox((-0.15, 0.43, 0.565), (0.06, 0.025, 0.03), RUB, r=0.008)
    b.sweep([(0.08, 0.18, 0.24), (0.15, 0.06, 0.25), (0.17, -0.02, 0.28)], 0.008, FRM, n=6, sub=2)
    b.rbox((0.19, -0.03, 0.285), (0.05, 0.04, 0.015), RUB, r=0.005)
    b.rbox((0.12, 0.46, 0.50), (0.06, 0.16, 0.10), FRM, r=0.012)
    b.lathe([(0, 0.016), (0.04, 0.016), (0.05, 0.022), (0.08, 0.022)], CHR, n=8, axis='Y', c=(0, 0, 0),
            M=Matrix.Translation(cyl0 + ax * 0.23 + V((0, 0.10, -0.02))))
    b.ellipsoid(cyl0 + ax * 0.23 + V((0.0, 0.20, -0.02)), (0.05, 0.035, 0.05), CHR, 12, 8)   # air filter
    b.rbox((0, 0.24, 0.40), (0.15, 0.19, 0.17), ALU, r=0.04, seg=3)
    b.sweep([(0.115, -0.05, 0.36), (0.115, 0.25, 0.39)], [0.105, 0.08], CHR, n=16, ellipse=(0.28, 1.0))
    b.lathe([(-0.02, 0.0), (-0.02, 0.04), (0.06, 0.04), (0.07, 0.0)], DRK, n=12, axis='Y', c=(0, -0.20, 0.50))
    # chain (left) from gearbox sprocket to rear sprocket
    cs, cr = V((0.12, 0.27, 0.36)), 0.045
    rs, rr_ = V((0.12, 0.70, 0.33)), 0.09
    loop = []
    for i in range(10):
        a = math.pi / 2 + math.pi * i / 9
        loop.append(cs + V((0, math.cos(a) * cr, math.sin(a) * cr)))
    for i in range(14):
        a = -math.pi / 2 + math.pi * i / 13
        loop.append(rs + V((0, math.cos(a) * rr_, math.sin(a) * rr_)))
    CHN = mat("Metal_Chain", "#3a3632", rough=0.45, metal=0.45)
    roller_chain(b, loop, 0.12, 0.0159, 0.013, 0.0016, 0.007, CHN)
    sprocket(b, cs, cr - 0.002, 17, 0.006, DRK)
    # ---- exhaust with fishtail silencer (right)
    b.sweep([cyl0 + ax * 0.25 + V((-0.02, -0.06, 0)), (-0.07, -0.31, 0.64), (-0.13, -0.31, 0.42),
             (-0.16, -0.18, 0.26), (-0.175, 0.10, 0.24), (-0.18, 0.42, 0.27)], 0.022, CHR, n=10, sub=3)
    b.lathe([(0.40, 0.022), (0.46, 0.04), (0.60, 0.05), (0.80, 0.048), (0.90, 0.04)], CHR, n=14, axis='Y',
            c=(-0.18, 0, 0.28))
    b.sweep([(-0.18, 0.89, 0.28), (-0.18, 0.95, 0.285), (-0.18, 1.00, 0.29)], [0.035, 0.045, 0.06], CHR, n=12,
            ellipse=(0.35, 1.0), up=(0, 0, 1))
    # ---- sprung solo saddle
    sec = saddle_loft(b, [(0.05, 1.02, 0.02), (0.08, 1.025, 0.05), (0.16, 1.02, 0.085), (0.26, 1.02, 0.135),
                          (0.36, 1.035, 0.15), (0.41, 1.045, 0.12), (0.428, 1.045, 0.05)], 0.06, LEA)
    b.sweep([(0, 0.06, 0.985), (0, 0.10, 0.94), (0, 0.15, 0.92)], 0.012, CHR, n=6, sub=2)
    for s in (1, -1):
        helix(b, (0.09 * s, 0.36, 0.985), (0.09 * s, 0.355, 0.87), 0.026, 6, 0.0045, CHR, n=5)
        b.sweep([(0.09 * s, 0.355, 0.87), (0.075 * s, 0.25, 0.885)], 0.009, CHR, n=6)
    for k in range(5):
        a = -0.6 + 0.3 * k
        b.ellipsoid((math.sin(a) * 0.145, 0.36 + math.cos(a) * 0.055, 1.02), (0.007, 0.007, 0.005), BRS, 6, 4)
    # ---- rear mudguard, rack, saddlebags, tail lamp, stand
    fender(b, RW, R + 0.04, -20, 118, 0.16, 0.05, PAINT)
    for s in (1, -1):
        b.sweep([(0.085 * s, 0.70, 0.35), (0.08 * s, 0.98, 0.42)], 0.008, FRM, n=6)
        b.sweep([(0.15 * s, 0.50, 0.76), (0.16 * s, 0.98, 0.72)], 0.010, DRK, n=6)
        b.sweep([(0.16 * s, 0.95, 0.72), (0.09 * s, 0.86, 0.40)], 0.008, DRK, n=6)
        b.sweep([(0.15 * s, 0.52, 0.76), (0.08 * s, 0.40, 0.66)], 0.008, DRK, n=6)
        bc = V((0.235 * s, 0.75, 0.60))
        b.rbox(bc, (0.11, 0.32, 0.25), LEA, r=0.04, seg=3)
        b.rbox(bc + V((0.045 * s, 0, 0.07)), (0.03, 0.335, 0.12), LED, r=0.02, seg=2)
        for dy in (-0.08, 0.08):
            b.rbox(bc + V((0.058 * s, dy, 0.02)), (0.008, 0.025, 0.14), LED, r=0.003, seg=1)
            b.rbox(bc + V((0.064 * s, dy, -0.02)), (0.006, 0.03, 0.025), BRS, r=0.003, seg=1)
    for k in range(4):
        b.sweep([(-0.15, 0.55 + 0.13 * k, 0.765), (0.15, 0.55 + 0.13 * k, 0.765)], 0.007, DRK, n=5)
    b.lathe([(0, 0.0), (0.0, 0.03), (0.02, 0.032), (0.03, 0.0)], RED, n=12, axis='Y', c=(0, 1.065, 0.56))
    b.rbox((0, 1.04, 0.56), (0.09, 0.04, 0.06), DRK, r=0.012)
    for s in (1, -1):
        b.sweep([(0.09 * s, 0.70, 0.33), (0.12 * s, 0.84, 0.41), (0.12 * s, 0.92, 0.48)], 0.009, DRK, n=6, sub=2)
    body = b.to_object("motorcycle_body")
    print("BODY", mesh_tris(body))

    # ---- steer: springer fork, bars, lamp, front mudguard  (origin on the steering axis)
    SO = V((0, -0.60, 0.95))
    s_ = Builder()
    for s in (1, -1):
        s_.sweep([(0.085 * s, -0.585, 0.98), (0.085 * s, -0.645, 0.62), (0.08 * s, -0.69, 0.35)], 0.014, FRM, n=8, sub=2)
        s_.sweep([(0.085 * s, -0.645, 0.99), (0.085 * s, -0.70, 0.64), (0.08 * s, -0.735, 0.40)], 0.011, FRM, n=8, sub=2)
        s_.rbox((0.08 * s, -0.715, 0.36), (0.016, 0.07, 0.05), FRM, r=0.01)                 # rocker
        s_.sweep([(0.09 * s, -0.66, 1.03), (0.13 * s, -0.75, 1.03)], 0.008, CHR, n=6)      # lamp bracket
    s_.rbox((0, -0.61, 0.985), (0.21, 0.09, 0.03), FRM, r=0.012)
    s_.rbox((0, -0.62, 0.84), (0.20, 0.08, 0.03), FRM, r=0.012)
    helix(s_, (0, -0.665, 0.86), (0, -0.665, 0.975), 0.022, 7, 0.004, CHR, n=5)
    s_.sweep([(0, -0.575, 1.00), (0, -0.565, 1.10)], 0.016, CHR, n=8)
    bar = [(-0.37, -0.40, 1.17), (-0.30, -0.47, 1.15), (-0.18, -0.555, 1.12), (0, -0.57, 1.10), (0.18, -0.555, 1.12),
           (0.30, -0.47, 1.15), (0.37, -0.40, 1.17)]
    s_.sweep(bar, 0.012, CHR, n=8, sub=3)
    for s in (1, -1):
        s_.sweep([(0.31 * s, -0.46, 1.152), (0.36 * s, -0.41, 1.167), (0.395 * s, -0.375, 1.177)], [0.019, 0.02, 0.018],
                 RUB, n=10, sub=2)
        s_.sweep([(0.24 * s, -0.52, 1.14), (0.29 * s, -0.58, 1.12), (0.33 * s, -0.55, 1.12)], 0.0055, CHR, n=5, sub=2)
    s_.lathe([(0, 0.0), (0.0, 0.035), (0.025, 0.037), (0.03, 0.0)], CHR, n=14, axis='Z', c=(0.06, -0.59, 1.115))
    s_.lathe([(0.03, 0.0), (0.031, 0.03)], mat("Gauge_Face", "#efe6cf", rough=0.4), n=14, axis='Z', c=(0.06, -0.59, 1.115))
    # headlamp
    s_.lathe([(0.0, 0.0), (0.0, 0.035), (-0.03, 0.07), (-0.07, 0.093), (-0.10, 0.10), (-0.112, 0.102), (-0.116, 0.096)],
             CHR, n=18, axis='Y', c=(0, -0.70, 1.03), cap1=False)
    s_.lathe([(-0.116, 0.094), (-0.122, 0.07), (-0.124, 0.0)], LMP, n=18, axis='Y', c=(0, -0.70, 1.03))
    s_.lathe([(0, 0.0), (0.0, 0.018), (-0.05, 0.02), (-0.06, 0.03), (-0.065, 0.0)], CHR, n=10, axis='Y',
             c=(-0.12, -0.70, 0.95))                                                         # horn
    fender(s_, FW, R + 0.04, 40, 195, 0.15, 0.045, PAINT)
    for s in (1, -1):
        s_.sweep([(0.08 * s, -0.70, 0.33), (0.078 * s, -0.95, 0.37)], 0.006, FRM, n=5)
        s_.sweep([(0.08 * s, -0.70, 0.33), (0.078 * s, -0.55, 0.62)], 0.006, FRM, n=5)
    steer = s_.to_object("steer", origin=SO)
    print("STEER", mesh_tris(steer))

    def front_extra(b):
        b.lathe([(-0.05, 0.075), (-0.04, 0.085), (0.0, 0.085), (0.0, 0.05)], DRK, n=20, axis='X')

    def rear_extra(b):
        b.lathe([(0.105, 0.0), (0.105, 0.088), (0.112, 0.092), (0.118, 0.088), (0.118, 0.0)], DRK, n=24, axis='X')
        b.lathe([(-0.07, 0.085), (-0.055, 0.095), (-0.02, 0.095), (-0.02, 0.05)], DRK, n=20, axis='X')
    wheel("wheel_front", FW, R, 0.095, 40, parent=steer, extra=front_extra, hub_w=0.12, hub_r=0.05, spoke_r=0.0025)
    wheel("wheel_rear", RW, R, 0.10, 40, extra=rear_extra, hub_w=0.13, hub_r=0.055, spoke_r=0.0025)
    empty("seat", (0, 0.28, 1.065))
    bake_group("motorcycle", [o for o in bpy.data.objects if o.type == 'MESH'], 1024, ao_dist=0.3,
               mat_scale={'Metal_Spoke': 0.15, 'Metal_Chain': 0.4})
    tot = sum(mesh_tris(o) for o in bpy.data.objects if o.type == 'MESH')
    print("TOTAL TRIS", tot)
    if NOEXPORT:
        bpy.ops.wm.save_as_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/moto_test.blend")
    else:
        export("motorcycle")

else:
    FRAME = mat("Paint_Forest", "#24402c", rough=0.35)
    GOLD = mat("Paint_GoldLine", "#c9a24a", rough=0.4, metal=0.3)
    WICK = mat("Wicker", "#c79a62", rough=0.9, tex=make_image("wicker", wicker_texture(256)))
    BREAD = mat("Bread", "#b9773a", rough=0.8)
    APPLE = mat("Apple", "#9e2a1c", rough=0.45)
    R, FW, RW = 0.35, V((0, -0.54, 0.35)), V((0, 0.52, 0.35))
    BB = V((0, 0.02, 0.30))
    CX = -0.055                 # drive side (right)
    b = Builder()
    T = lambda pts, r=0.014, m=FRAME, sub=3: b.sweep(pts, r, m, n=10, sub=sub)
    b.lathe([(0, 0.02), (0.005, 0.023), (0.17, 0.023), (0.175, 0.02)], FRAME, n=12, axis='Z',
            M=Matrix.Translation((0, -0.462, 0.76)) @ Matrix.Rotation(math.radians(-14), 4, 'X'))
    T([(0, -0.43, 0.88), (0, -0.33, 0.73), (0, -0.16, 0.47), (0, -0.04, 0.35), (0, 0.0, 0.32)])
    T([(0, -0.452, 0.79), (0, -0.36, 0.62), (0, -0.19, 0.38), (0, -0.06, 0.31), (0, 0.0, 0.30)])
    T([(0, 0.0, 0.30), (0, 0.06, 0.60), (0, 0.12, 0.90)], 0.015, sub=2)
    b.lathe([(-0.04, 0.03), (0.04, 0.03)], FRAME, n=12, axis='X', c=BB)                    # bottom bracket shell
    for s in (1, -1):
        T([(0.03 * s, 0.11, 0.86), (0.04 * s, 0.30, 0.61), (0.048 * s, 0.52, 0.35)], 0.010, sub=2)
        T([(0.03 * s, 0.02, 0.30), (0.04 * s, 0.25, 0.32), (0.048 * s, 0.52, 0.35)], 0.010, sub=2)
        b.rbox((0.05 * s, 0.52, 0.35), (0.008, 0.04, 0.03), FRAME, r=0.006, seg=1)
    b.sweep([(0, 0.12, 0.90), (0, 0.135, 0.96)], 0.012, CHR, n=8)                           # seat post
    # saddle (sprung leather)
    sec = saddle_loft(b, [(0.02, 1.005, 0.018), (0.05, 1.01, 0.034), (0.12, 1.008, 0.05), (0.19, 1.012, 0.088),
                          (0.25, 1.02, 0.118), (0.275, 1.022, 0.10), (0.287, 1.02, 0.04)], 0.045, LEA)
    b.sweep([(0, 0.035, 0.985), (0, 0.10, 0.962), (0, 0.15, 0.962)], 0.006, CHR, n=6, sub=2)
    for s in (1, -1):
        helix(b, (0.055 * s, 0.24, 0.985), (0.055 * s, 0.235, 0.925), 0.016, 5, 0.003, CHR, n=4)
        b.sweep([(0.055 * s, 0.235, 0.925), (0.02 * s, 0.15, 0.955)], 0.005, CHR, n=5)
    for k in range(9):                    # copper rivets around the cantle + nose
        a = -1.0 + 0.25 * k
        b.ellipsoid((math.sin(a) * 0.108, 0.245 + math.cos(a) * 0.036, 1.0), (0.0045, 0.0045, 0.0035), BRS, 6, 4)
    for sx in (1, -1):
        b.ellipsoid((sx * 0.012, 0.035, 1.003), (0.004, 0.004, 0.003), BRS, 6, 4)
    # chain loop + chain guard (drive side)
    cr, sr = 0.095, 0.042
    loop = []
    for i in range(12):
        a = math.pi / 2 + math.pi * i / 11
        loop.append(V((CX, BB.y + math.cos(a) * cr, BB.z + math.sin(a) * cr)))
    for i in range(10):
        a = -math.pi / 2 + math.pi * i / 9
        loop.append(V((CX, RW.y + math.cos(a) * sr, RW.z + math.sin(a) * sr)))
    CHN = mat("Metal_Chain", "#3a3632", rough=0.45, metal=0.45)
    roller_chain(b, loop, CX, 0.0127, 0.0085, 0.0011, 0.0045, CHN)
    gp = [V((CX - 0.018, BB.y - 0.08, BB.z + 0.09)), V((CX - 0.018, BB.y + 0.02, BB.z + 0.115)),
          V((CX - 0.018, 0.30, 0.43)), V((CX - 0.018, 0.47, 0.41))]
    b.sweep(gp, [0.03, 0.035, 0.03, 0.022], FRAME, n=12, sub=3, ellipse=(0.18, 1.0), up=(0, 0, 1))
    # rear mudguard, rack, reflector, stand
    fender(b, RW, R + 0.03, 15, 150, 0.065, 0.02, FRAME, thick=0.003)
    b.sweep([V((0.0, RW.y + math.cos(math.radians(a)) * (R + 0.033), RW.z + math.sin(math.radians(a)) * (R + 0.033)))
             for a in range(20, 151, 13)], 0.0025, GOLD, n=4)
    b.rbox((0, 0.57, 0.78), (0.15, 0.34, 0.012), DRK, r=0.005, seg=1)
    for k in range(4):
        b.sweep([(-0.07, 0.43 + 0.09 * k, 0.79), (0.07, 0.43 + 0.09 * k, 0.79)], 0.005, DRK, n=4)
    for s in (1, -1):
        b.sweep([(0.07 * s, 0.72, 0.78), (0.05 * s, 0.52, 0.36)], 0.006, DRK, n=5)
        b.sweep([(0.07 * s, 0.42, 0.78), (0.035 * s, 0.18, 0.80)], 0.006, DRK, n=5)
    b.lathe([(0, 0.0), (0, 0.025), (0.012, 0.025), (0.016, 0.0)], RED, n=12, axis='Y', c=(0, 0.735, 0.74))
    b.sweep([(0.045, 0.45, 0.335), (0.055, 0.62, 0.36), (0.06, 0.74, 0.38)], 0.007, DRK, n=6, sub=2)
    b.to_object("bicycle_body")

    # pedals (origin at the crank axle, spins about local X)
    p = Builder()
    p.lathe([(-0.07, 0.012), (0.07, 0.012)], CHR, n=8, axis='X')
    p.lathe([(CX - 0.004, 0.08), (CX - 0.004, cr - 0.004), (CX + 0.004, cr - 0.004), (CX + 0.004, 0.08)], CHR, n=28,
            axis='X', cap0=False, cap1=False)
    for k in range(5):
        a = 2 * math.pi * k / 5
        p.sweep([(CX, math.cos(a) * 0.025, math.sin(a) * 0.025), (CX, math.cos(a + 0.3) * 0.082, math.sin(a + 0.3) * 0.082)],
                0.006, CHR, n=4, ellipse=(0.6, 1.4))
    for s, dz in ((-1, -0.165), (1, 0.165)):
        x0 = 0.07 * s
        p.seg_box((x0, 0, 0), (x0 + 0.005 * s, 0, dz), 0.012, 0.022, CHR, r=0.005, up=(0, 1, 0), uv=None)
        p.rbox((x0 + 0.055 * s, 0, dz), (0.085, 0.05, 0.02), RUB, r=0.006)
        p.rbox((x0 + 0.055 * s, 0, dz), (0.09, 0.012, 0.024), CHR, r=0.003, seg=1)
    for v in p.bm.verts:
        v.co += BB
    p.to_object("pedals", origin=BB)

    # steer: fork, stem, bars, basket, lamp, front mudguard (origin = steering axis)
    SO = V((0, -0.44, 0.84))
    s_ = Builder()
    for s in (1, -1):
        s_.sweep([(0.038 * s, -0.465, 0.765), (0.042 * s, -0.50, 0.55), (0.046 * s, -0.53, 0.42), (0.046 * s, -0.555, 0.35)],
                 [0.012, 0.011, 0.009, 0.008], FRAME, n=8, sub=3)
    s_.rbox((0, -0.465, 0.765), (0.10, 0.04, 0.025), FRAME, r=0.01)
    s_.sweep([(0, -0.432, 0.90), (0, -0.44, 1.00), (0, -0.48, 1.025)], 0.011, CHR, n=8, sub=2)
    bar = [(-0.28, -0.25, 1.045), (-0.275, -0.34, 1.05), (-0.21, -0.45, 1.04), (-0.09, -0.49, 1.03), (0, -0.49, 1.028),
           (0.09, -0.49, 1.03), (0.21, -0.45, 1.04), (0.275, -0.34, 1.05), (0.28, -0.25, 1.045)]
    s_.sweep(bar, 0.0105, CHR, n=8, sub=3)
    for s in (1, -1):
        s_.sweep([(0.278 * s, -0.33, 1.05), (0.282 * s, -0.27, 1.047), (0.282 * s, -0.215, 1.045)], [0.016, 0.017, 0.016],
                 LEA, n=10, sub=2)
        s_.sweep([(0.20 * s, -0.46, 1.04), (0.24 * s, -0.53, 1.02), (0.27 * s, -0.50, 1.02)], 0.004, CHR, n=4, sub=2)
    s_.lathe([(0, 0.0), (0.0, 0.026), (0.012, 0.024), (0.022, 0.012), (0.026, 0.0)], BRS, n=14, axis='Z',
             c=(0.12, -0.475, 1.045))
    # wicker basket
    bc = V((0, -0.66, 0.83))
    bw, bd, bh, rr = 0.34, 0.26, 0.20, 0.05
    rect = []
    for q in range(4):
        cx_ = (bw / 2 - rr) * (1 if q in (0, 3) else -1)
        cy_ = (bd / 2 - rr) * (1 if q in (0, 1) else -1)
        for k in range(4):
            a = math.pi / 2 * q + math.pi / 2 * k / 3
            rect.append((cx_ + math.cos(a) * rr, cy_ + math.sin(a) * rr))
    verts, faces = [], []
    levels = [(0.0, 0.9), (0.02, 0.96), (bh, 1.04)]
    for z, sc in levels:
        for x, y in rect:
            verts.append(bc + V((x * sc, y * sc, z)))
    nR = len(rect)
    for l in range(len(levels) - 1):
        for k in range(nR):
            k2 = (k + 1) % nR
            faces.append((l * nR + k, l * nR + k2, (l + 1) * nR + k2, (l + 1) * nR + k))
    verts.append(bc)
    faces += [(len(verts) - 1, (k + 1) % nR, k) for k in range(nR)]
    s_.add(verts, faces, WICK, uv=('box', 5.0))
    s_.sweep([bc + V((x * 1.04, y * 1.04, bh)) for x, y in rect], 0.011, WICK, n=6, closed_path=True, cap=False)
    s_.sweep([bc + V((x * 1.0, y * 1.0, bh * 0.45)) for x, y in rect], 0.006, LED, n=4, closed_path=True, cap=False)
    for x in (-0.06, 0.06):
        s_.sweep([(x, -0.53, 1.03), (x, -0.54, 1.045), (x, -0.56, 1.03)], 0.006, LED, n=4, sub=2)
        s_.sweep([(x * 1.5, -0.66 + 0.13, 0.83), (x * 0.8, -0.555, 0.37)], 0.005, DRK, n=4)
    # contents: bread loaf + apples
    s_.ellipsoid(bc + V((-0.05, 0.02, bh - 0.01)), (0.13, 0.06, 0.055), BREAD, 14, 8,
                 M=None)
    for k, (x, y) in enumerate(((0.09, -0.05), (0.12, 0.04), (0.05, 0.07))):
        s_.ellipsoid(bc + V((x, y, bh - 0.005 + 0.01 * k)), (0.035, 0.035, 0.032), APPLE, 10, 6)
    # lamp under the basket front
    s_.lathe([(0.0, 0.0), (0.0, 0.025), (-0.03, 0.04), (-0.05, 0.045), (-0.055, 0.042)], CHR, n=14, axis='Y',
             c=(0, -0.80, 0.78), cap1=False)
    s_.lathe([(-0.055, 0.04), (-0.06, 0.0)], LMP, n=14, axis='Y', c=(0, -0.80, 0.78))
    s_.sweep([(0, -0.80, 0.78), (0, -0.79, 0.83)], 0.006, CHR, n=5)
    fender(s_, FW, R + 0.03, 40, 170, 0.06, 0.018, FRAME, thick=0.003)
    for s in (1, -1):
        s_.sweep([(0.046 * s, -0.555, 0.35), (0.04 * s, -0.84, 0.40)], 0.003, CHR, n=4)
    steer = s_.to_object("steer", origin=SO)

    def rear_extra(b):
        b.lathe([(CX - 0.003, 0.02), (CX - 0.003, sr), (CX + 0.003, sr), (CX + 0.003, 0.02)], DRK, n=18, axis='X',
                cap0=False, cap1=False)
    wheel("wheel_front", FW, R, 0.038, 32, parent=steer, hub_w=0.08, hub_r=0.022, spoke_r=0.0016)
    wheel("wheel_rear", RW, R, 0.04, 32, extra=rear_extra, hub_w=0.10, hub_r=0.024, spoke_r=0.0016)
    empty("seat", (0, 0.18, 1.04))
    bake_group("bicycle", [o for o in bpy.data.objects if o.type == 'MESH'], 1024, ao_dist=0.25,
               mat_scale={'Metal_Spoke': 0.15, 'Metal_Chain': 0.4})
    tot = sum(mesh_tris(o) for o in bpy.data.objects if o.type == 'MESH')
    print("TOTAL TRIS", tot)
    if NOEXPORT:
        bpy.ops.wm.save_as_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/bike_test.blend")
    else:
        export("bicycle")
