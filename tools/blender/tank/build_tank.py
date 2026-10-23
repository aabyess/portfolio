"""Royal cartoon tank -> models/vehicles/tank.glb  (+ models/src/tank.blend)
Blender -b --factory-startup --python build_tank.py

Same part names / dimensions as buildTankPlaceholder() in tankfx.js (vehicles.js animates them):
  hull · turret (origin = turret ring) > barrel (origin = trunnion, pitches on local X) > muzzle (Empty)
  turret > seat (Empty, commander's hip) · turret > antenna (origin = base, sways on local X)
  track_l / track_r (materials Track_L / Track_R, UV u runs along the loop, 1 unit = 1 link -> offset scroll)
  wheel_l0..5 / wheel_r0..5, sprocket_l/r, idler_l/r (origin = axle, spin on local X)
  Lamp_Glass material = headlight position.
Built in three.js coordinates (front +Z, up +Y, left +X) through P(): Blender = (x, -z, y).
Look: whimsical royal tank — royal blue paint, gold trim, castle battlements on the turret, red shield with a
gold '최' crest on both turret sides, wooden side skirts and crates, pennant on the antenna.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "weapons"))
from wcommon import *
from wbase import empty

REPO_ = REPO
OUT = os.path.join(REPO_, "models", "vehicles", "tank.glb")
SRC = os.path.join(REPO_, "models", "src", "tank.blend")
FONT = "/System/Library/Fonts/Supplemental/AppleGothic.ttf"


def P(x, y, z):
    return V((x, -z, y))


AX_Z3 = (0, -1, 0)    # three +Z in Blender
AX_Y3 = (0, 0, 1)     # three +Y
AX_X3 = (1, 0, 0)

# ------------------------------------------------------------------ dims (= TANK_DIMS in tankfx.js)
TRACK_X, TRACK_W, TRACK_T = 1.2, 0.52, 0.06
WHEEL_R, WHEEL_Z = 0.34, [-2.05, -1.23, -0.41, 0.41, 1.23, 2.05]
SPROCKET = dict(z=-2.72, y=0.66, r=0.33)
IDLER = dict(z=2.72, y=0.66, r=0.30)
TURRET_Y, TURRET_Z = 1.56, -0.25

reset_all()

# ------------------------------------------------------------------ materials
paint = pbr("Tank_Paint", tex_plain(512, 201, base_lum=0.95, rough=0.55, metal=0.0, scale=6, amp=0.08),
            tint='#5f86cf', nrm_px=0)
paintD = pbr("Tank_PaintDark", tex_plain(512, 202, base_lum=0.95, rough=0.62, metal=0.0, scale=6, amp=0.1),
             tint='#40609c', nrm_px=0)
gold = pbr("Tank_Gold", tex_brass(256, seed=203), tint='#ffe6a0', nrm_px=0)
steel = pbr("Tank_Steel", tex_iron(256, seed=204))
wood = pbr("Tank_Wood", tex_wood(512, seed=205, rings=16), tint='#a06a3c', nrm_px=256)
red = flat_mat("Tank_Crest", '#b3262a', rough=0.5)
rubber = flat_mat("Tank_Rubber", '#1d1c1b', rough=0.92)
tarp = pbr("Tank_Tarp", tex_plain(128, 206, base_lum=0.9, rough=0.9, scale=30, amp=0.2), tint='#9a8a64', nrm_px=0)
bore = flat_mat("Tank_Bore", '#0b0a0a', rough=0.9)
flagm = flat_mat("Tank_Flag", '#c22d2d', rough=0.8)
glass = flat_mat("Lamp_Glass", '#fff2cc', rough=0.2, emit='#ffd890', emit_strength=1.5)
glass.use_backface_culling = False


def tread_tex(W=256, H=128):
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    U, Vv = np.meshgrid(u, v)
    h = np.zeros((H, W))
    plate = (U > 0.05) & (U < 0.93)
    h[plate] = 0.45
    grouser = (U > 0.32) & (U < 0.62) & (Vv > 0.06) & (Vv < 0.94)
    h[grouser] = 1.0
    guide = (U > 0.18) & (U < 0.78) & (np.abs(Vv - 0.5) < 0.06)
    h[guide] = 0.75
    pins = (((U - 0.13) ** 2 * 16 + (Vv - 0.15) ** 2) < 0.0016) | (((U - 0.13) ** 2 * 16 + (Vv - 0.85) ** 2) < 0.0016)
    h[pins] = 0.8
    n = tnoise(128, 30, 207)
    n = np.tile(n, (1, 2))[:H, :W]
    lum = 0.16 + 0.17 * h + 0.06 * n
    edge = np.clip(np.abs(np.gradient(blur(h, 1))[1]) * 8, 0, 1)
    lum = lum + 0.10 * edge * (h > 0.5)
    col = np.stack([lum, lum * 0.97, lum * 0.92], -1)
    rough = np.clip(0.85 - 0.3 * edge - 0.1 * h, 0.3, 1)
    return dict(base=col, orm=orm(rough, 0.45), nrm=normal_from_height(blur(h, 2), 3.0))


TT = tread_tex()


def track_mat(name):
    m = pbr(name, TT, nrm_px=None)
    m.use_backface_culling = False
    return m


# ------------------------------------------------------------------ track ribbon (same loop as tankfx trackGeometry)
def track_object(name, x0, mat):
    circles = [dict(z=z, y=WHEEL_R + TRACK_T, r=WHEEL_R) for z in WHEEL_Z] + [SPROCKET, IDLER]
    pts = []
    for c in circles:
        for i in range(48):
            a = i / 48 * 2 * math.pi
            pts.append((c['z'] + math.cos(a) * c['r'], c['y'] + math.sin(a) * c['r']))
    pts.sort()

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]                  # counter-clockwise in (z, y)
    segL = [math.dist(hull[i], hull[(i + 1) % len(hull)]) for i in range(len(hull))]
    per = sum(segL)
    N = 160
    pitch = per / round(per / 0.155)
    samp, si, acc = [], 0, 0.0
    for k in range(N):
        d = k / N * per
        while acc + segL[si] < d:
            acc += segL[si]; si = (si + 1) % len(hull)
        a, b = hull[si], hull[(si + 1) % len(hull)]
        t = (d - acc) / (segL[si] or 1)
        samp.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, d))
    nrm = []
    for i in range(N):
        a, b = samp[(i - 1) % N], samp[(i + 1) % N]
        dz, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dz, dy) or 1
        nrm.append((dy / l, -dz / l))
    xs = (x0 + TRACK_W / 2, x0 - TRACK_W / 2)
    # cross-section corners: (x, offset along normal, v)
    corners = [(xs[0], TRACK_T, 0.0), (xs[1], TRACK_T, 1.0), (xs[1], 0.0, 1.0), (xs[0], 0.0, 0.0)]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    ring = []
    for k in range(N):
        z, y, d = samp[k]; nz, ny = nrm[k]
        ring.append([bm.verts.new(P(cx, y + ny * o, z + nz * o)) for cx, o, _ in corners])
    # per-face UVs: outer/inner faces span v 0..1 across the width; sides get a thin strip
    face_v = [(0.0, 1.0), (0.02, 0.06), (1.0, 0.0), (0.06, 0.02)]   # (v at corner j, v at corner j+1)
    for k in range(N):
        k2 = (k + 1) % N
        u0 = samp[k][2] / pitch
        u1 = (samp[k2][2] if k2 else per) / pitch
        for j in range(4):
            j2 = (j + 1) % 4
            f = bm.faces.new([ring[k][j], ring[k][j2], ring[k2][j2], ring[k2][j]])
            f.smooth = j in (0, 2)
            va, vb = face_v[j]
            for l, uv in zip(f.loops, [(u0, va), (u0, vb), (u1, vb), (u1, va)]):
                l[uvl].uv = uv
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------ text crest
def text_mesh(txt, size):
    cu = bpy.data.curves.new("crest_txt", 'FONT')
    cu.body = txt
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except Exception as e:
        print("FONT FAIL", e)
    cu.size = size
    cu.extrude = 0.012
    cu.resolution_u = 2
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new("crest_txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    verts = [V(v.co) for v in me.vertices]
    faces = [list(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    return verts, faces


def add_crest(b, center, u, v, n, scale=1.0):
    """Red heater shield with gold rim and raised gold '최'. center/u/v/n are Blender vectors."""
    u, v, n = V(u), V(v), V(n)
    sh = [(-0.24, 0.22), (0.24, 0.22), (0.24, 0.02), (0.17, -0.15), (0.0, -0.27), (-0.17, -0.15), (-0.24, 0.02)]
    sh = [(x * scale, y * scale) for x, y in sh]
    b.plate(sh, red, au=tuple(u), av=tuple(v), origin=tuple(center), w0=0.0, w1=0.03, bevel=0.008, seg=1,
            smooth_outline=3, uv=('box', 2.0))
    rim = catmull([(x * 1.06, y * 1.06 + 0.002, 0) for x, y in sh], 3, closed=True)
    rim_pts = [V(center) + u * p[0] + v * p[1] + n * 0.03 for p in rim]
    b.sweep(rim_pts, 0.014 * scale, gold, n=6, closed_path=True, cap=False, up=tuple(n))
    tv, tf = text_mesh("최", 0.5 * scale)
    Mx = Matrix((tuple(u), tuple(v), tuple(n))).transposed().to_4x4()
    Mx.translation = V(center) + n * 0.032 + v * (0.0 * scale)
    b.add(tv, tf, gold, M=Mx, uv=('box', 4.0))


# ================================================================== hull
hb = WBuilder()
# lower hull (dark) and upper hull (paint) — side profiles (z, y) extruded across X
lower = [(-2.82, 1.12), (-2.82, 0.60), (-2.45, 0.38), (2.30, 0.38), (2.98, 0.80), (2.98, 1.12)]
hb.plate(lower, paintD, au=AX_Z3, av=AX_Y3, origin=(0, 0, 0), w0=-0.92, w1=0.92, bevel=0.04, seg=1, uv=('box', 0.5))
upper = [(-3.0, 1.06), (-3.0, 1.40), (-2.86, 1.56), (1.15, 1.58), (2.35, 1.38), (3.04, 1.13), (3.04, 1.06)]
hb.plate(upper, paint, au=AX_Z3, av=AX_Y3, origin=(0, 0, 0), w0=-1.46, w1=1.46, bevel=0.07, seg=2, uv=('box', 0.5))
# gold trim along the top edges of the upper hull
for sx in (-1, 1):
    tp = [P(sx * 1.47, y + 0.005, z) for z, y in [(-2.95, 1.40), (-2.84, 1.53), (1.15, 1.555), (2.35, 1.36), (3.0, 1.12)]]
    hb.sweep(tp, 0.022, gold, n=6, up=(0, 0, 1))
# fenders over the tracks (front ends angled down)
for sx in (-1, 1):
    hb.rbox(P(sx * 1.2, 1.09, 0.0), (0.56, 6.0, 0.04), paint, r=0.015, uv=('box', 0.5))
    hb.rbox(P(sx * 1.2, 1.0, 3.18), (0.56, 0.36, 0.04), paint, r=0.015, M=None, uv=('box', 0.5))
# wooden side skirts with iron bands and gold rivets
for sx in (-1, 1):
    for i in range(4):
        y = 0.80 + i * 0.085
        hb.rbox(P(sx * 1.5, y, -0.05), (0.05, 5.3, 0.08), wood, r=0.012, uv=('grain', (0, 1, 0), 1.0, 3.0))
    for z in (-2.4, -1.2, 0.0, 1.2, 2.4):
        hb.rbox(P(sx * 1.53, 0.93, z), (0.02, 0.07, 0.36), steel, r=0.006)
        hb.ellipsoid(P(sx * 1.545, 0.93, z), (0.018, 0.018, 0.018), gold, nu=6, nv=4)
# headlights (Lamp_Glass) + gold bezels
for sx in (-1, 1):
    c = tuple(P(sx * 1.05, 1.32, 0))
    hb.lathe([(-2.36, 0.0), (-2.36, 0.10), (-2.45, 0.11), (-2.48, 0.095)], gold, n=14, axis='Y', c=c, cap1=False)
    hb.lathe([(-2.48, 0.095), (-2.49, 0.06), (-2.475, 0.0)], glass, n=14, axis='Y', c=c, cap0=False)
# rear exhausts
for sx in (-1, 1):
    hb.lathe([(2.95, 0.10), (3.3, 0.09), (3.32, 0.07), (3.2, 0.06)], steel, n=10, axis='Y',
             M=Matrix.Translation(P(sx * 0.6, 1.25, 0)), cap0=True, cap1=False)
# towing hooks
for sx in (-1, 1):
    hb.torus(P(sx * 0.62, 0.74, 3.0), 0.09, 0.03, steel, nu=10, nv=6, axis='X')
# driver hatch + periscope
hb.lathe([(1.575, 0.27), (1.62, 0.26), (1.64, 0.2), (1.645, 0.0)], paintD, n=16, axis='Z',
         c=(-0.45, -1.05, 0), cap0=False)
hb.rbox(P(-0.45, 1.66, 1.38), (0.22, 0.1, 0.1), steel, r=0.02)
hb.ellipsoid(P(-0.45, 1.66, 1.05), (0.04, 0.04, 0.04), gold, nu=6, nv=4)
# engine grille
for i in range(6):
    hb.rbox(P(0, 1.585, -2.0 - i * 0.13), (1.5, 0.06, 0.03), steel, r=0.01)
# spare track links on the glacis
spare = pbr("Spare_Links", TT, nrm_px=None)
hb.rbox(P(0, 1.47, 2.0), (1.4, 0.5, 0.05), spare, r=0.01, M=None, uv=('box', 6.0))
# shovel + axe on the rear deck (medieval tools)
hb.seg_box(P(0.95, 1.6, -0.8), P(0.95, 1.6, -2.1), 0.05, 0.04, wood, r=0.015, up=(0, 0, 1))
hb.rbox(P(0.95, 1.6, -2.28), (0.2, 0.36, 0.025), steel, r=0.01)
hb.seg_box(P(-0.95, 1.6, -0.9), P(-0.95, 1.6, -2.0), 0.05, 0.04, wood, r=0.015, up=(0, 0, 1))
hb.plate([(0.0, -0.02), (0.16, -0.1), (0.2, 0.0), (0.16, 0.1), (0.0, 0.02)], steel, au=AX_Z3, av=AX_X3,
         origin=tuple(P(-0.95, 1.59, -0.85)), w0=0.0, w1=0.02, bevel=0.004)
# gold royal crown emblem on the glacis (cartoon)
crown = [(-0.22, 0.0), (0.22, 0.0), (0.22, 0.1), (0.26, 0.2), (0.12, 0.12), (0.0, 0.24), (-0.12, 0.12),
         (-0.26, 0.2), (-0.22, 0.1)]
d_glacis = (P(0, 1.13, 3.04) - P(0, 1.38, 2.35)).normalized()   # down the slope
n_glacis = V((1, 0, 0)).cross(d_glacis)                            # outward
if n_glacis.z < 0:
    n_glacis = -n_glacis
c_glacis = (P(0, 1.13, 3.04) + P(0, 1.38, 2.35)) / 2 + n_glacis * 0.004
hb.plate(crown, gold, au=(1, 0, 0), av=tuple(-d_glacis), origin=tuple(c_glacis - (-d_glacis) * 0.12), w0=0.0,
         w1=0.025, bevel=0.006, seg=1)
# return rollers
for sx in (-1, 1):
    for z in (-1.4, 0.0, 1.4):
        hb.lathe([(-0.15, 0.0), (-0.15, 0.075), (0.15, 0.075), (0.15, 0.0)], steel, n=10, axis='X',
                 c=tuple(P(sx * 1.2, 0.86, z)))
hull = hb.to_object("hull")

# ================================================================== tracks
track_object("track_l", 1.2, track_mat("Track_L"))
track_object("track_r", -1.2, track_mat("Track_R"))


# ================================================================== wheels
def road_wheel(name, x, y, z, sx):
    b = WBuilder()
    c = P(x, y, z)
    prof = [(-0.2, 0.2), (-0.2, 0.30), (-0.19, 0.34), (-0.03, 0.34), (-0.02, 0.30), (0.02, 0.30), (0.03, 0.34),
            (0.19, 0.34), (0.2, 0.30), (0.2, 0.2)]
    b.lathe(prof, rubber, n=16, axis='X', c=tuple(c), cap0=False, cap1=False)
    for s in (-1, 1):
        b.lathe([(s * 0.2, 0.2), (s * 0.205, 0.18), (s * 0.2, 0.12), (s * 0.2, 0.0)], paint, n=16, axis='X',
                c=tuple(c), cap0=False)
    b.lathe([(sx * 0.2, 0.11), (sx * 0.24, 0.10), (sx * 0.27, 0.06), (sx * 0.28, 0.0)], gold, n=12, axis='X',
            c=tuple(c), cap0=False)
    for k in range(4):
        a = k / 4 * 2 * math.pi
        b.ellipsoid(c + V((sx * 0.205, math.cos(a) * 0.15, math.sin(a) * 0.15)), (0.018, 0.018, 0.018), steel,
                    nu=5, nv=3)
    return b.to_object(name, origin=tuple(c))


for side, sx in (('l', 1), ('r', -1)):
    for i, z in enumerate(WHEEL_Z):
        road_wheel("wheel_%s%d" % (side, i), sx * TRACK_X, WHEEL_R + TRACK_T, z, sx)
    # sprocket (rear, toothed)
    b = WBuilder(); c = P(sx * TRACK_X, SPROCKET['y'], SPROCKET['z'])
    b.lathe([(-0.18, 0.0), (-0.18, 0.27), (0.18, 0.27), (0.18, 0.0)], steel, n=18, axis='X', c=tuple(c))
    for k in range(12):
        a = k / 12 * 2 * math.pi
        M = Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X')
        b.rbox((0, 0, 0.30), (0.34, 0.08, 0.07), steel, r=0.015, seg=1, M=M)
    b.lathe([(sx * 0.18, 0.13), (sx * 0.24, 0.12), (sx * 0.27, 0.06), (sx * 0.28, 0.0)], gold, n=12, axis='X',
            c=tuple(c), cap0=False)
    b.to_object("sprocket_" + side, origin=tuple(c))
    # idler (front)
    b = WBuilder(); c = P(sx * TRACK_X, IDLER['y'], IDLER['z'])
    b.lathe([(-0.17, 0.0), (-0.17, 0.27), (-0.15, 0.30), (0.15, 0.30), (0.17, 0.27), (0.17, 0.0)], steel, n=18,
            axis='X', c=tuple(c))
    b.lathe([(sx * 0.17, 0.12), (sx * 0.22, 0.11), (sx * 0.25, 0.0)], paint, n=12, axis='X', c=tuple(c), cap0=False)
    for k in range(4):
        a = k / 4 * 2 * math.pi
        b.ellipsoid(c + V((sx * 0.18, math.cos(a) * 0.17, math.sin(a) * 0.17)), (0.02, 0.02, 0.02), gold, nu=6, nv=4)
    b.to_object("idler_" + side, origin=tuple(c))

# ================================================================== turret
T0 = P(0, TURRET_Y, TURRET_Z)


def TP(x, y, z):
    return P(x, TURRET_Y + y, TURRET_Z + z)


tb = WBuilder()
plan = [(-0.52, 1.2), (0.52, 1.2), (1.05, 0.58), (1.12, -0.85), (0.86, -1.45), (-0.86, -1.45), (-1.12, -0.85),
        (-1.05, 0.58)]
plan_uv = [(x, -z) for x, z in plan]     # (three x, Blender y) — av = Blender +Y = three -Z
tb.plate(plan_uv, paint, au=(1, 0, 0), av=(0, 1, 0), origin=tuple(T0 + V((0, 0, 0.06))), w0=0.0, w1=0.50,
         bevel=0.08, seg=2, smooth_outline=3, uv=('box', 0.5))
# turret ring
tb.lathe([(-0.06, 1.0), (0.08, 1.0), (0.1, 0.97)], paintD, n=28, axis='Z', c=tuple(T0), cap0=False, cap1=False)
tb.torus(TP(0, 0.07, 0), 1.0, 0.025, gold, nu=28, nv=5, axis='Z')
# castle battlements along the top edge (merlons)
outline = catmull([(x, z, 0) for x, z in plan], 3, closed=True)
per_pts = [(p[0], p[1]) for p in outline]
lens = [math.dist(per_pts[i], per_pts[(i + 1) % len(per_pts)]) for i in range(len(per_pts))]
total = sum(lens)
nm = int(total / 0.42)
step = total / nm
acc, i = 0.0, 0
for k in range(nm):
    d = k * step + step * 0.5
    while acc + lens[i] < d:
        acc += lens[i]; i = (i + 1) % len(per_pts)
    a, bpt = per_pts[i], per_pts[(i + 1) % len(per_pts)]
    t = (d - acc) / lens[i]
    x, z = a[0] + (bpt[0] - a[0]) * t, a[1] + (bpt[1] - a[1]) * t
    tx, tz = (bpt[0] - a[0]) / lens[i], (bpt[1] - a[1]) / lens[i]
    if z > 0.8 and abs(x) < 0.6:
        continue                  # leave the front free for the mantlet
    nx, nz = tz, -tx              # outward normal
    if nx * x + nz * z < 0:
        nx, nz = -nx, -nz
    cx, cz = x - nx * 0.07, z - nz * 0.07
    M = Matrix.Translation(TP(cx, 0.62, cz)) @ Matrix.Rotation(math.atan2(-tz, tx), 4, 'Z')
    tb.rbox((0, 0, 0.02), (0.25, 0.11, 0.2), paint, r=0.025, seg=1, M=M, uv=('box', 0.5))
    tb.rbox((0, 0, -0.085), (0.27, 0.13, 0.02), gold, r=0.0, M=M)
# commander cupola (open) — seat inside
CUP = (0.42, -0.45)
tb.lathe([(0.48, 0.36), (0.71, 0.33), (0.71, 0.30), (0.50, 0.30)], paintD, n=18, axis='Z',
         c=tuple(TP(CUP[0], 0, CUP[1])), cap0=False, cap1=False)
tb.torus(TP(CUP[0], 0.71, CUP[1]), 0.33, 0.03, gold, nu=18, nv=5, axis='Z')
lid_M = Matrix.Translation(TP(CUP[0], 0.94, CUP[1] - 0.40)) @ Matrix.Rotation(-(math.pi / 2 - 0.3), 4, 'X')
tb.lathe([(-0.025, 0.0), (-0.025, 0.31), (0.025, 0.31), (0.03, 0.0)], paint, n=16, axis='Z', M=lid_M)
for k in range(5):
    a = k / 5 * math.pi * 1.4 - 0.7
    tb.rbox(TP(CUP[0] + math.sin(a) * 0.345, 0.66, CUP[1] + math.cos(a) * 0.345), (0.1, 0.06, 0.06),
            flat_mat("Tank_Vision", '#4a6a78', rough=0.15, metal=0.3), r=0.01,
            M=None)
# loader hatch (closed) + gold knob
tb.lathe([(0.0, 0.28), (0.05, 0.27), (0.07, 0.2), (0.075, 0.0)], paintD, n=16, axis='Z',
         c=tuple(TP(-0.42, 0.55, -0.3)), cap0=False)
tb.ellipsoid(TP(-0.42, 0.635, -0.3), (0.04, 0.04, 0.04), gold, nu=8, nv=5)
# rear bustle: wooden crates + rolled tarp
tb.rbox(TP(0, 0.32, -1.62), (1.6, 0.4, 0.3), steel, r=0.03)
for x, w in ((-0.45, 0.55), (0.32, 0.7)):
    tb.rbox(TP(x, 0.62, -1.68), (w, 0.36, 0.38), wood, r=0.02, uv=('grain', (1, 0, 0), 1.5, 3.0))
    tb.rbox(TP(x, 0.62, -1.68), (w + 0.02, 0.05, 0.4), steel, r=0.01)
tb.lathe([(-0.7, 0.0), (-0.7, 0.12), (0.7, 0.12), (0.7, 0.0)], tarp, n=10, axis='X', c=tuple(TP(0, 0.5, -1.25)))
for x in (-0.4, 0.4):
    tb.torus(TP(x, 0.5, -1.25), 0.125, 0.012, flat_mat("Tank_Strap", '#4a2c1a', rough=0.8), nu=10, nv=4, axis='X')
# smoke dischargers -> little gold-capped tubes
for sx in (-1, 1):
    for k in range(3):
        M = Matrix.Translation(TP(sx * (0.92 + k * 0.07), 0.46, 0.5 - k * 0.12)) @ Matrix.Rotation(sx * 0.4, 4, 'Y') \
            @ Matrix.Rotation(1.0, 4, 'X')
        tb.lathe([(-0.1, 0.0), (-0.1, 0.05), (0.1, 0.05), (0.12, 0.04)], steel, n=8, axis='Z', M=M)
# crest shields on both sides
for sx in (-1, 1):
    u = V((0, 1, 0)) if sx > 0 else V((0, -1, 0))
    add_crest(tb, TP(sx * 1.165, 0.31, -0.3), u, (0, 0, 1), (sx, 0, 0), scale=0.95)
turret = tb.to_object("turret", origin=tuple(T0))

# ---------------- barrel (origin = trunnion at turret-local (0, 0.3, 1.12))
B0 = TP(0, 0.3, 1.12)


def BP(z, y=0.0, x=0.0):
    return TP(x, 0.3 + y, 1.12 + z)


bb = WBuilder()
bb.rbox(BP(0.08), (0.86, 0.4, 0.46), paint, r=0.12, seg=3, uv=('box', 0.5))   # rounded mantlet
for sx in (-1, 1):
    bb.ellipsoid(BP(0.28, 0.12, sx * 0.3), (0.03, 0.03, 0.03), gold, nu=6, nv=4)
# barrel tube along three +Z (= Blender -Y): lathe axis Y with negative 'along'
c0 = BP(0)
prof = [(0.25, 0.21), (0.62, 0.2), (0.65, 0.12), (0.7, 0.095), (2.0, 0.085), (3.7, 0.078)]
bb.lathe([(-a, r) for a, r in prof], paintD, n=16, axis='Y', c=tuple(c0), cap0=True, cap1=False)
# gold bands
for zz in (0.75, 2.05, 3.0):
    bb.lathe([(-(zz - 0.03), 0.094 - 0.005 * zz), (-(zz + 0.03), 0.094 - 0.005 * zz)], gold, n=16, axis='Y',
             c=tuple(c0), cap0=False, cap1=False)
# fume extractor
bb.lathe([(-2.0, 0.085), (-2.05, 0.125), (-2.35, 0.125), (-2.4, 0.083)], paint, n=16, axis='Y', c=tuple(c0),
         cap0=False, cap1=False)
# brass bell muzzle (cartoon blunderbuss flare) + dark bore
bb.lathe([(-3.68, 0.078), (-3.8, 0.085), (-3.98, 0.115), (-4.08, 0.15), (-4.12, 0.155), (-4.13, 0.14)], gold,
         n=18, axis='Y', c=tuple(c0), cap0=False, cap1=False)
bb.lathe([(-4.13, 0.14), (-4.1, 0.10), (-3.9, 0.06), (-3.9, 0.0)], bore, n=18, axis='Y', c=tuple(c0), cap0=False)
barrel = bb.to_object("barrel", origin=tuple(B0), parent=turret)
muzzle = empty("muzzle", BP(4.12), parent=barrel, size=0.2)

# ---------------- seat + antenna
seat = empty("seat", TP(CUP[0], 0.6, CUP[1]), parent=turret, size=0.2)
ab = WBuilder()
A0 = TP(-0.75, 0.55, -1.15)
ab.lathe([(0.0, 0.06), (0.12, 0.05), (0.14, 0.02)], steel, n=8, axis='Z', c=tuple(A0), cap0=True, cap1=False)
ab.lathe([(0.12, 0.012), (1.9, 0.007)], steel, n=5, axis='Z', c=tuple(A0), cap0=False, cap1=False)
ab.ellipsoid(A0 + V((0, 0, 1.93)), (0.035, 0.035, 0.035), gold, nu=8, nv=5)
# swallow-tail pennant (red, gold stripe) facing back
fl = [(0.0, 0.0), (0.0, -0.3), (0.55, -0.22), (0.4, -0.15), (0.55, -0.08)]
ab.plate([(u, v) for u, v in fl], flagm, au=(0, 1, 0), av=(0, 0, 1), origin=tuple(A0 + V((0, 0.005, 1.86))),
         w0=-0.004, w1=0.004, bevel=0.0, uv=('box', 2.0))
ab.plate([(0.0, -0.13), (0.0, -0.17), (0.46, -0.13), (0.46, -0.09)], gold, au=(0, 1, 0), av=(0, 0, 1),
         origin=tuple(A0 + V((0, 0.005, 1.86))), w0=-0.0055, w1=0.0055, bevel=0.0)
antenna = ab.to_object("antenna", origin=tuple(A0), parent=turret)

# ------------------------------------------------------------------ stats + export
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        t = mesh_tris(o); tris += t
        print("  part %-12s %6d tris" % (o.name, t))
print("TRIS tank", tris)
os.makedirs(os.path.dirname(SRC), exist_ok=True)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=SRC)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
    export_cameras=False, export_lights=False, export_animations=False,
    export_image_format='JPEG', export_jpeg_quality=80,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=14,
)
print("EXPORTED", OUT, os.path.getsize(OUT))
