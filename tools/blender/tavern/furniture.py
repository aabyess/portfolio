"""Usage: Blender -b --factory-startup --python furniture.py -- stool|barrel|table|bench|log"""
import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/tavern")
import bpy, math, random
from mathutils import Vector as V, Matrix
from kit import *

KIND = sys.argv[sys.argv.index('--') + 1]
reset()
SEAT = 0.42
b = Builder()

if KIND == 'stool':
    W, WD, IR = M('wood'), M('wood_dark'), M('iron')
    # thick round seat with a soft rounded edge, top exactly at 0.42
    t = 0.055
    b.lathe([(SEAT - t, 0.0), (SEAT - t, 0.17), (SEAT - t + 0.008, 0.188), (SEAT - 0.012, 0.196), (SEAT - 0.003, 0.19),
             (SEAT, 0.178), (SEAT, 0.0)], W, n=20, axis='Z', uv=G('x'))
    # three splayed legs, tenoned through the seat (end grain dots on top)
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 6
        top = V((math.cos(a) * 0.10, math.sin(a) * 0.10, SEAT - 0.005))
        bot = V((math.cos(a) * 0.175, math.sin(a) * 0.175, 0.0))
        b.sweep([bot, bot.lerp(top, 0.5) + V((0, 0, 0.0)), top], [0.019, 0.022, 0.02], WD, n=8, uv=G('z'))
        b.ellipsoid(top + V((0, 0, 0.002)), (0.02, 0.02, 0.003), WD, 8, 3)
    # stretchers between the legs
    for k in range(3):
        a0 = 2 * math.pi * k / 3 + math.pi / 6
        a1 = 2 * math.pi * (k + 1) / 3 + math.pi / 6
        r = 0.152
        z = 0.14 + 0.03 * k
        p0 = V((math.cos(a0) * r, math.sin(a0) * r, z))
        p1 = V((math.cos(a1) * r, math.sin(a1) * r, z))
        b.sweep([p0, p1], 0.011, W, n=6, uv=G('x'))
    b.to_object("tavern_stool")
    export_prop("tavern-stool")

elif KIND == 'barrel':
    W, IR = M('wood'), M('iron')
    # small cask standing on end; top rim exactly at 0.42, max radius 0.20
    H, R = SEAT, 0.178
    prof = []
    for i in range(9):
        tt = i / 8
        prof.append((0.0 + H * tt, R * (1 + 0.12 * math.sin(math.pi * tt))))
    prof = [(0.012, R * 0.88), (0.0, R * 0.95)] + prof[1:-1] + [(H, R * 0.95), (H - 0.012, R * 0.88)]
    b.lathe(prof, W, n=20, axis='Z', uv=G('z'))
    for tt in (0.10, 0.32, 0.68, 0.90):
        z = H * tt
        rr = R * (1 + 0.12 * math.sin(math.pi * tt)) + 0.004
        b.lathe([(z - 0.016, rr), (z - 0.01, rr + 0.004), (z + 0.01, rr + 0.004), (z + 0.016, rr)], IR, n=20, axis='Z',
                cap0=False, cap1=False)
    # head boards (slightly recessed) + bung
    for i in range(4):
        x = -R * 0.66 + i * R * 0.44
        w = R * 0.42
        hw = math.sqrt(max(0.0, (R * 0.86) ** 2 - x * x))
        plank(b, (x, 0, H - 0.017), (w, hw * 2 * 0.98, 0.012), M('wood_light'), r=0.003, seg=1)
    b.lathe([(H - 0.012, 0.02), (H - 0.009, 0.02), (H - 0.009, 0.0)], M('wood_dark'), n=10, axis='Z', c=(0.07, 0.03, 0))
    b.to_object("tavern_stool_barrel")
    export_prop("tavern-stool-barrel")

elif KIND == 'log':
    # log-round stool (Norse / rustic): bark sides, sawn top at 0.42
    BK = mat("Bark", "#4f3a2a", rough=0.95)
    rnd = random.Random(4)
    ring = []
    n = 18
    prof_r = [(0.0, 0.205), (0.05, 0.19), (0.38, 0.182), (SEAT - 0.01, 0.18)]
    verts, faces = [], []
    for z, r in prof_r:
        for j in range(n):
            a = 2 * math.pi * j / n
            rr = r * (1 + 0.04 * math.sin(a * 5 + z * 7) + rnd.uniform(-0.015, 0.015))
            verts.append(V((math.cos(a) * rr, math.sin(a) * rr, z)))
    for i in range(len(prof_r) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            faces.append((i * n + j, i * n + j2, (i + 1) * n + j2, (i + 1) * n + j))
    verts.append(V((0, 0, 0)))
    faces += [(len(verts) - 1, (j + 1) % n, j) for j in range(n)]
    b.add(verts, faces, BK)
    b.lathe([(SEAT - 0.012, 0.176), (SEAT, 0.172), (SEAT, 0.0)], M('wood_light'), n=n, axis='Z', cap0=False)
    b.to_object("tavern_stool_log")
    export_prop("tavern-stool-log")

elif KIND == 'table':
    W, WD, IR = M('wood'), M('wood_dark'), M('iron')
    TOP, R, T = 0.70, 0.62, 0.06
    # plank top clipped to a circle
    n = 6
    pw = 2 * R / n
    for i in range(n):
        xa, xb = -R + i * pw + 0.003, -R + (i + 1) * pw - 0.003
        poly = []
        k = 8
        for s in range(k + 1):         # right edge (top half to bottom half)
            x = xa + (xb - xa) * s / k
            poly.append((x, math.sqrt(max(0, R * R - x * x))))
        for s in range(k + 1):
            x = xb - (xb - xa) * s / k
            poly.append((x, -math.sqrt(max(0, R * R - x * x))))
        prism(b, poly, TOP - T, TOP, W if i % 2 else M('wood_light'), uv=G('y'))
    # iron band round the rim
    b.lathe([(TOP - T + 0.005, R + 0.004), (TOP - 0.008, R + 0.004)], IR, n=36, axis='Z', cap0=False, cap1=False)
    # cleats under the top
    for x in (-0.33, 0.33):
        plank(b, (x, 0, TOP - T - 0.03), (0.07, 1.0, 0.06), WD, r=0.012)
    # pedestal: octagonal post + four splayed feet + braces
    b.lathe([(0.08, 0.075), (0.12, 0.09), (0.16, 0.075), (0.55, 0.068), (0.58, 0.08), (TOP - T - 0.06, 0.08)], WD, n=8,
            axis='Z', uv=G('z'), phase=math.pi / 8)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d = V((math.cos(a), math.sin(a), 0))
        beam(b, d * 0.04 + V((0, 0, 0.07)), d * 0.50 + V((0, 0, 0.035)), 0.085, 0.07, WD, up=(0, 0, 1))
        plank(b, d * 0.47 + V((0, 0, 0.012)), (0.09, 0.09, 0.024), WD, r=0.008, Mx=rot(d * 0.47, 'Z', a))
        beam(b, d * 0.06 + V((0, 0, 0.36)), d * 0.30 + V((0, 0, TOP - T - 0.06)), 0.05, 0.045, W, up=(0, 0, 1))
    b.to_object("tavern_table")
    export_prop("tavern-table")

elif KIND == 'bench':
    # short trestle bench for two (seat top 0.42), 1.1 m long — optional seating variant
    W, WD = M('wood'), M('wood_dark')
    plank(b, (0, 0, SEAT - 0.03), (1.10, 0.30, 0.06), W, r=0.015)
    for x in (-0.42, 0.42):
        for s in (-1, 1):
            beam(b, (x, s * 0.05, SEAT - 0.06), (x, s * 0.14, 0.0), 0.06, 0.05, WD, up=(1, 0, 0))
        plank(b, (x, 0, 0.16), (0.05, 0.22, 0.05), WD, r=0.01)
    plank(b, (0, 0, 0.16), (0.86, 0.04, 0.05), WD, r=0.01)
    b.to_object("tavern_bench")
    export_prop("tavern-bench")

elif KIND == 'chair':
    # Italian rush-seat ladder-back chair; seat top 0.42, seat 0.38 x 0.36 (fits r ~0.2), back toward +Y
    CH = M('wood_dark')
    RUSH = mat("Rush_Seat", "#c9a45a", rough=1.0, tex=tex('thatch'))
    hw, hd = 0.19, 0.18
    for sx in (-1, 1):
        for sy in (-1, 1):
            top = 0.40 if sy < 0 else 0.92
            b.lathe([(0.0, 0.017), (0.15, 0.019), (0.30, 0.016), (top, 0.016), (top + 0.02, 0.012)], CH, n=8, axis='Z',
                    c=(sx * (hw - 0.02), sy * (hd - 0.02), 0), uv=G('z'))
    for z, axis in ((0.12, 'x'), (0.22, 'y'), (0.12, 'y')):
        for s_ in (-1, 1):
            if axis == 'x':
                b.sweep([V((-hw + 0.02, s_ * (hd - 0.02), z)), V((hw - 0.02, s_ * (hd - 0.02), z))], 0.009, CH, n=6)
            else:
                b.sweep([V((s_ * (hw - 0.02), -hd + 0.02, z)), V((s_ * (hw - 0.02), hd - 0.02, z))], 0.009, CH, n=6)
    # woven rush seat: thick cushion-like slab with crossing texture, top exactly 0.42
    b.rbox((0, 0, 0.395), (hw * 2 - 0.01, hd * 2 - 0.01, 0.05), RUSH, r=0.02, seg=2, uv=('box', 4.0))
    for s_ in (-1, 1):
        b.sweep([V((-hw + 0.02, s_ * (hd - 0.02), 0.395)), V((hw - 0.02, s_ * (hd - 0.02), 0.395))], 0.014, CH, n=6)
    # ladder back slats
    for z in (0.58, 0.72, 0.86):
        b.rbox((0, hd - 0.02, z), (hw * 2 - 0.04, 0.018, 0.07), CH, r=0.008, seg=1, uv=G('x'),
               M=rot((0, hd - 0.02, z), 'X', -0.08))
    b.to_object("tavern_chair")
    export_prop("tavern-chair")

elif KIND == 'bierbank':
    # Bavarian beer-garden bench: pine top, green folding legs, seat top 0.42, 1.2 m
    PINE = M('wood_light')
    GRN = mat("Shutter_Green", "#3e6b48", rough=0.7, tex=tex('wood'))
    plank(b, (0, 0, SEAT - 0.02), (1.20, 0.26, 0.04), PINE, r=0.01)
    for x in (-0.45, 0.45):
        for s_ in (-1, 1):
            beam(b, (x, s_ * 0.10, SEAT - 0.045), (x, s_ * 0.12, 0.0), 0.03, 0.03, GRN, up=(1, 0, 0))
        b.sweep([V((x, -0.11, 0.2)), V((x, 0.11, 0.2))], 0.009, M('iron'), n=5)
        plank(b, (x, 0, SEAT - 0.055), (0.05, 0.24, 0.03), GRN, r=0.008, seg=1)
    b.to_object("tavern_bierbank")
    export_prop("tavern-bierbank")

elif KIND == 'crate':
    # upturned market crate used as a seat, top 0.42, 0.40 x 0.34
    W, WD = M('wood_grey'), M('wood_dark')
    sx, sy, sz = 0.40, 0.34, SEAT
    for k in range(3):
        plank(b, (0, -sy / 2 + sy * (k + 0.5) / 3, sz - 0.012), (sx, sy / 3 - 0.008, 0.024), W, r=0.004, seg=1)
    for s_ in (-1, 1):
        for k in range(3):
            plank(b, (s_ * (sx / 2 - 0.01), 0, 0.02 + (sz - 0.05) * (k + 0.5) / 3), (0.02, sy, (sz - 0.05) / 3 - 0.012),
                  W, r=0.004, seg=1)
        for k in range(3):
            plank(b, (0, s_ * (sy / 2 - 0.01), 0.02 + (sz - 0.05) * (k + 0.5) / 3), (sx - 0.04, 0.02, (sz - 0.05) / 3 - 0.012),
                  W, r=0.004, seg=1)
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            plank(b, (sx_ * (sx / 2 - 0.025), sy_ * (sy / 2 - 0.025), sz / 2 - 0.012), (0.045, 0.045, sz - 0.024), WD,
                  r=0.006, seg=1)
    b.lathe([(0, 0.0), (0.0, 0.05), (0.01, 0.052), (0.012, 0.0)], M('wood_light'), n=4, axis='Z', c=(0.25, 0.0, 0),
            phase=0.3)
    b.to_object("tavern_crate_seat")
    export_prop("tavern-stool-crate")
