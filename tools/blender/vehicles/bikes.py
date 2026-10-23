"""Usage: Blender -b --factory-startup --python bikes.py -- motorcycle|bicycle"""
import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/vehicles")
import bpy, math
from mathutils import Vector
from common import reset, export, mat, Builder, empty, spoked_wheel

KIND = sys.argv[sys.argv.index('--') + 1]
reset()

RUB = mat("Rubber", "#1f1c1b", rough=0.9)
CHR = mat("Metal_Chrome", "#c9c6bf", rough=0.35, metal=0.0)
DRK = mat("Metal_Dark", "#262428", rough=0.6)
LEA = mat("Leather_Saddle", "#6b3d1f")
LED = mat("Leather_Dark", "#3b2416")
BRS = mat("Metal_Brass", "#b8924a", rough=0.5)
LMP = mat("Lamp_Glass", "#ffe2a0", rough=0.3)
RED = mat("Lamp_Red", "#a3201a", rough=0.4)


def wheel(name, c, r, w, spokes, parent=None, extra=None):
    b = Builder()
    spoked_wheel(b, r, w, RUB, CHR, CHR, spokes=spokes, n=16, thin=True)
    if extra:
        extra(b)
    for v in b.bm.verts:
        v.co += Vector(c)
    return b.to_object(name, origin=c, parent=parent)


if KIND == 'motorcycle':
    PAINT = mat("Paint_Oxblood", "#6b1f1a", rough=0.5)
    ALU = mat("Metal_Engine", "#8d8a84", rough=0.6)
    GOLD = mat("Paint_GoldLine", "#c79a3b", rough=0.5)
    R, FW, RW = 0.33, (0, -0.70, 0.33), (0, 0.70, 0.33)
    b = Builder()
    t = lambda p0, p1, r=0.024, m=DRK: b.tube(p0, p1, r, r, m, n=6)
    t((0, -0.55, 1.03), (0, -0.60, 0.82), 0.04)                    # steering head
    t((0, -0.55, 0.98), (0, 0.22, 0.90))                           # top tube
    t((0, -0.58, 0.86), (0, -0.22, 0.27))                          # down tube
    t((0, -0.22, 0.26), (0, 0.32, 0.27))                           # cradle
    t((0, 0.32, 0.27), (0, 0.18, 0.92))                            # seat tube
    for s in (1, -1):
        t((0.09 * s, 0.18, 0.90), (0.09 * s, 0.70, 0.36), 0.02)    # seat stays
        t((0.09 * s, 0.32, 0.27), (0.09 * s, 0.70, 0.33), 0.02)    # chain stays
        b.box((0.19 * s, 0.10, 0.30), (0.12, 0.05, 0.03), RUB)     # foot pegs
    # tank
    b.seg((0, -0.53, 1.03), (0, 0.12, 0.98), (0.25, 0.22), (0.20, 0.17), PAINT)
    for s in (1, -1):
        b.seg((0.115 * s, -0.40, 1.03), (0.098 * s, 0.05, 0.99), (0.012, 0.03), (0.012, 0.025), GOLD)
        b.box((0.10 * s, 0.02, 0.96), (0.03, 0.12, 0.08), LED)     # knee pads
    b.tube((0, -0.36, 1.13), (0, -0.36, 1.16), 0.035, 0.035, BRS, n=8)  # filler cap
    # engine
    b.box((0, 0.02, 0.40), (0.24, 0.40, 0.22), ALU)
    b.box((0, 0.27, 0.42), (0.20, 0.16, 0.20), ALU)
    b.tube((0.13, 0.02, 0.40), (0.14, 0.02, 0.40), 0.10, 0.10, CHR, n=8)   # side cover
    b.tube((0, -0.10, 0.48), (0, -0.20, 0.82), 0.075, 0.07, ALU, n=8)      # cylinder
    for i in range(5):
        k = 0.2 + i * 0.15
        c = Vector((0, -0.10, 0.48)).lerp(Vector((0, -0.20, 0.82)), k)
        b.tube(c - Vector((0, -0.01, 0.012)), c + Vector((0, -0.01, 0.012)), 0.11, 0.11, DRK, n=8)
    # exhaust (fishtail)
    pts = [(0.08, -0.20, 0.62), (0.13, -0.27, 0.40), (0.15, -0.10, 0.27), (0.16, 0.40, 0.29), (0.17, 0.92, 0.38)]
    for p0, p1 in zip(pts, pts[1:]):
        b.tube(p0, p1, 0.032, 0.032, CHR, n=6)
    b.tube((0.17, 0.62, 0.34), (0.17, 1.00, 0.40), 0.05, 0.06, CHR, n=6)
    # sprung saddle
    b.seg((0, 0.06, 1.00), (0, 0.40, 1.01), (0.12, 0.07), (0.30, 0.08), LEA)
    b.seg((0, 0.06, 0.96), (0, 0.40, 0.965), (0.10, 0.02), (0.26, 0.02), LED)
    for s in (1, -1):
        b.tube((0.09 * s, 0.36, 0.86), (0.09 * s, 0.36, 0.96), 0.025, 0.025, CHR, n=6)
    # rear fender, light, rack + saddlebags
    b.arc(RW, 0.40, 0.02, 0.16, 15, 125, PAINT, k=7)
    b.box((0, 1.03, 0.61), (0.08, 0.04, 0.06), RED)
    for s in (1, -1):
        b.tube((0.17 * s, 0.52, 0.76), (0.17 * s, 0.96, 0.74), 0.015, 0.015, DRK, n=4)
        b.tube((0.17 * s, 0.56, 0.76), (0.09 * s, 0.45, 0.62), 0.012, 0.012, DRK, n=4)
        b.box((0.235 * s, 0.75, 0.62), (0.12, 0.34, 0.26), LEA)
        b.box((0.30 * s, 0.75, 0.68), (0.012, 0.36, 0.13), LED)      # flap
        b.box((0.305 * s, 0.75, 0.62), (0.012, 0.04, 0.05), BRS)     # buckle
    body = b.to_object("motorcycle_body")

    # steer group (origin on the steering axis)
    SO = (0, -0.60, 0.95)
    s_ = Builder()
    for s in (1, -1):
        s_.tube((0.075 * s, -0.56, 1.00), (0.075 * s, -0.70, 0.33), 0.022, 0.022, CHR, n=6)
    s_.box((0, -0.565, 0.98), (0.20, 0.06, 0.04), DRK)
    s_.box((0, -0.60, 0.80), (0.20, 0.06, 0.04), DRK)
    s_.tube((0, -0.57, 1.00), (0, -0.55, 1.12), 0.02, 0.02, CHR, n=6)
    s_.tube((-0.20, -0.55, 1.12), (0.20, -0.55, 1.12), 0.018, 0.018, CHR, n=6)
    for s in (1, -1):
        s_.tube((0.20 * s, -0.55, 1.12), (0.38 * s, -0.43, 1.16), 0.018, 0.018, CHR, n=6)
        s_.tube((0.38 * s, -0.43, 1.16), (0.47 * s, -0.37, 1.17), 0.027, 0.027, LED, n=6)
    s_.tube((0, -0.64, 1.02), (0, -0.78, 1.02), 0.08, 0.10, CHR, n=10)       # headlamp shell
    s_.tube((0, -0.78, 1.02), (0, -0.795, 1.02), 0.085, 0.085, LMP, n=10)
    s_.arc(FW, 0.40, 0.02, 0.14, 55, 160, PAINT, k=6)
    steer = s_.to_object("steer", origin=SO)
    wheel("wheel_front", FW, R, 0.11, 16, parent=steer)
    wheel("wheel_rear", RW, R, 0.12, 16,
          extra=lambda b: b.ring((-0.09, 0, 0), 0.11, 0.05, 0.015, DRK, n=12))   # rear sprocket/brake drum
    empty("seat", (0, 0.27, 1.07))
    export("motorcycle")

else:
    FRAME = mat("Paint_Forest", "#2e4a33", rough=0.5)
    WICK = mat("Wicker", "#a87a45")
    R, FW, RW = 0.35, (0, -0.54, 0.35), (0, 0.52, 0.35)
    BB = (0, 0.02, 0.30)
    b = Builder()
    t = lambda p0, p1, r=0.018, m=FRAME: b.tube(p0, p1, r, r, m, n=6)
    t((0, -0.42, 0.93), (0, -0.46, 0.76), 0.026)                   # head tube
    t((0, -0.42, 0.88), (0, 0.12, 0.86))                           # top tube
    t((0, -0.44, 0.79), BB)                                        # down tube
    t(BB, (0, 0.13, 0.90))                                         # seat tube
    for s in (1, -1):
        t((0.045 * s, 0.12, 0.84), (0.05 * s, 0.52, 0.35), 0.013)  # seat stays
        t((0.045 * s, 0.02, 0.30), (0.05 * s, 0.52, 0.35), 0.013)  # chain stays
    t((0, 0.13, 0.90), (0, 0.15, 0.98), 0.014, CHR)                # seat post
    b.seg((0, 0.03, 1.00), (0, 0.27, 1.01), (0.06, 0.05), (0.20, 0.07), LEA)   # saddle
    for s in (1, -1):
        b.tube((0.07 * s, 0.24, 0.93), (0.07 * s, 0.24, 0.98), 0.018, 0.018, CHR, n=6)
    # chain + chain guard (static)
    b.seg((0.06, 0.02, 0.40), (0.06, 0.52, 0.395), (0.01, 0.012), (0.01, 0.012), DRK)
    b.seg((0.06, 0.02, 0.20), (0.06, 0.52, 0.305), (0.01, 0.012), (0.01, 0.012), DRK)
    b.seg((0.075, -0.02, 0.43), (0.075, 0.50, 0.42), (0.008, 0.06), (0.008, 0.05), FRAME)
    # rear fender + rack
    b.arc(RW, 0.39, 0.012, 0.07, 20, 150, FRAME, k=7)
    b.box((0, 0.56, 0.78), (0.16, 0.36, 0.015), DRK)
    for s in (1, -1):
        b.tube((0.07 * s, 0.70, 0.78), (0.05 * s, 0.52, 0.36), 0.008, 0.008, DRK, n=4)
        b.tube((0.07 * s, 0.40, 0.78), (0.045 * s, 0.17, 0.80), 0.008, 0.008, DRK, n=4)
    b.box((0, 0.745, 0.755), (0.05, 0.015, 0.035), RED)                # rear reflector
    b.to_object("bicycle_body")

    # pedals (origin at crank axle, spins about local X)
    p = Builder()
    p.tube((-0.07, 0, 0), (0.07, 0, 0), 0.02, 0.02, CHR, n=6)
    p.ring((0.06, 0, 0), 0.10, 0.06, 0.008, CHR, n=14)
    for s, dz in ((1, -0.17), (-1, 0.17)):
        p.seg((0.07 * s, 0, 0), (0.075 * s, 0, dz), (0.015, 0.03), (0.015, 0.025), CHR)
        p.box((0.12 * s, 0, dz), (0.09, 0.05, 0.022), RUB)
    for v in p.bm.verts:
        v.co += Vector(BB)
    p.to_object("pedals", origin=BB)

    SO = (0, -0.44, 0.84)
    s_ = Builder()
    for s in (1, -1):
        s_.tube((0.04 * s, -0.46, 0.77), (0.045 * s, -0.54, 0.35), 0.012, 0.010, FRAME, n=6)
    s_.box((0, -0.46, 0.765), (0.11, 0.04, 0.03), FRAME)
    s_.tube((0, -0.43, 0.90), (0, -0.44, 1.03), 0.013, 0.013, CHR, n=6)
    s_.tube((-0.12, -0.44, 1.03), (0.12, -0.44, 1.03), 0.012, 0.012, CHR, n=6)
    for s in (1, -1):
        s_.tube((0.12 * s, -0.44, 1.03), (0.27 * s, -0.31, 1.05), 0.012, 0.012, CHR, n=6)
        s_.tube((0.27 * s, -0.31, 1.05), (0.29 * s, -0.22, 1.05), 0.02, 0.02, LEA, n=6)
    s_.tube((0.10, -0.44, 1.04), (0.10, -0.44, 1.07), 0.025, 0.025, BRS, n=8)   # bell
    # wicker basket
    s_.box((0, -0.66, 0.92), (0.34, 0.26, 0.20), WICK)
    s_.box((0, -0.66, 1.025), (0.36, 0.28, 0.025), LED)
    for xx in (-0.09, 0.0, 0.09):
        s_.box((xx, -0.795, 0.92), (0.015, 0.008, 0.20), LED)
    s_.seg((0, -0.53, 0.98), (0, -0.46, 0.90), (0.04, 0.02), (0.04, 0.02), DRK)
    s_.tube((0, -0.80, 0.80), (0, -0.84, 0.80), 0.04, 0.05, CHR, n=8)          # lamp
    s_.tube((0, -0.84, 0.80), (0, -0.845, 0.80), 0.045, 0.045, LMP, n=8)
    s_.arc(FW, 0.39, 0.012, 0.07, 45, 165, FRAME, k=6)
    steer = s_.to_object("steer", origin=SO)
    wheel("wheel_front", FW, R, 0.045, 18, parent=steer)
    wheel("wheel_rear", RW, R, 0.045, 18,
          extra=lambda b: b.ring((0.06, 0, 0), 0.05, 0.025, 0.008, CHR, n=10))
    empty("seat", (0, 0.17, 1.045))
    export("bicycle")
