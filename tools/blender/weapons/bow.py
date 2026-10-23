"""English longbow ~1.7 m (yew, sapwood back, horn nocks, leather grip) + skinned string.
Hand frame: grip axis +Y (upper limb), arrow flight +Z (Blender) = glTF +Y... see README.
Armature 'BowRig': bones bow (root), limb_upper, limb_lower, string_mid. Action 'Draw' 0->1 s pulls the
string 0.6 m toward -Z (the archer) and flexes the limbs. Empty 'nock' rides on string_mid; 'arrow_rest'
marks where the shaft lies against the bow (archer's left = +X)."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *
from mathutils import Quaternion

reset_all()
FPS = 24

# ------------------------------------------------------------------ yew texture (U along limb, V around)
S = 512
rng = np.random.default_rng(51)
u = np.linspace(0, 1, S, endpoint=False)
U, Vv = np.meshgrid(u, u)
grain = tnoise(S, 60, 52, aniso=(18, 1)) * 0.6 + tnoise(S, 12, 53, aniso=(8, 1)) * 0.4
# sapwood band centred on v = 0.75 (the back, +Z)
dv = np.minimum(np.abs(Vv - 0.75), 1 - np.abs(Vv - 0.75))
sap = np.clip(1 - (dv - 0.11 - 0.015 * np.sin(U * 2 * np.pi * 7)) / 0.03, 0, 1)
heart = np.stack([0.58 - 0.18 * grain, 0.31 - 0.11 * grain, 0.165 - 0.06 * grain], -1)
sapc = np.stack([0.92 - 0.10 * grain, 0.82 - 0.10 * grain, 0.60 - 0.08 * grain], -1)
col = heart * (1 - sap[..., None]) + sapc * sap[..., None]
# pin knots
for k in range(14):
    cx, cy = rng.random() * S, rng.random() * S
    d = np.sqrt(((U * S - cx + S / 2) % S - S / 2) ** 2 / 9 + ((Vv * S - cy + S / 2) % S - S / 2) ** 2)
    col *= (1 - 0.45 * np.exp(-(d / 2.2) ** 2))[..., None]
rough = 0.45 + 0.15 * grain
yew_t = dict(base=col, orm=orm(rough, 0.0), nrm=normal_from_height(grain, 0.8))
yew = pbr("Bow_Yew", yew_t, orm_px=128, nrm_px=256, nrm_strength=0.5)
leather = pbr("Bow_Grip_Leather", tex_leather(256, seed=54, wrap=4), tint='#5b3720')
horn = pbr("Bow_Horn", tex_plain(128, 55, base_lum=0.92, rough=0.35, scale=20, amp=0.25), tint='#d9c9a3', nrm_px=0)
string_m = pbr("Bow_String", tex_plain(64, 56, base_lum=0.85, rough=0.85, scale=30, amp=0.2), tint='#d8cfb4',
               nrm_px=0)
serving = flat_mat("Bow_Serving", '#3b2f25', rough=0.8)

# ------------------------------------------------------------------ limb shape
Y_UP, Y_LO = 0.860, -0.840
Z_TIP = -0.165                    # braced tip set-back toward the string side


def zc(y):                        # centreline (braced)
    L = Y_UP if y > 0 else -Y_LO
    t = min(1.0, abs(y) / L)
    t2 = max(0.0, (abs(y) - 0.07) / (L - 0.07))
    return Z_TIP * (t2 ** 1.9)


def dims(y):                      # width X, thickness Z
    L = Y_UP if y > 0 else -Y_LO
    t = min(1.0, abs(y) / L)
    if abs(y) < 0.075:
        return 0.0335, 0.0360
    k = (abs(y) - 0.075) / (L - 0.075)
    w = 0.0330 * (1 - k) + 0.0125 * k
    th = 0.0340 * (1 - k ** 0.9) + 0.0115 * k ** 0.9
    return w, th


NR = 18
ys = []
for i in range(81):
    t = i / 80
    ys.append(Y_LO + 0.012 + (Y_UP - Y_LO - 0.024) * (0.5 - 0.5 * math.cos(math.pi * t)) * 0.0 +
              (Y_UP - Y_LO - 0.024) * t)
verts, uvs, faces = [], [], []
arc = 0.0
prev = None
for i, y in enumerate(ys):
    c = V((0, y, zc(y)))
    if prev is not None:
        arc += (c - prev).length
    prev = c
    # tangent-normal frame (in YZ plane)
    d = (V((0, y + 0.002, zc(y + 0.002))) - V((0, y - 0.002, zc(y - 0.002)))).normalized()
    nz = V((0, -d.z, d.y))        # back direction (+Z-ish)
    w, th = dims(y)
    for j in range(NR):
        a = 2 * math.pi * j / NR
        ca, sa = math.cos(a), math.sin(a)
        if sa >= 0:               # back: flatter
            off = th * 0.38 * (sa ** 0.45)
            x = w / 2 * math.copysign(abs(ca) ** 0.75, ca)
        else:                     # belly: round
            off = -th * 0.62 * (abs(sa) ** 0.95)
            x = w / 2 * ca
        verts.append(c + V((x, 0, 0)) + nz * off)
        uvs.append((arc * 1.2, (j / NR + 0.5) % 1.0))
for i in range(len(ys) - 1):
    for j in range(NR):
        j2 = (j + 1) % NR
        faces.append((i * NR + j, i * NR + j2, (i + 1) * NR + j2, (i + 1) * NR + j))
b = WBuilder()
b.add(verts, faces, yew, uv=('vert', uvs))
# limb ends are covered by horn nocks
tips = {}
for sgn, ye in ((1, ys[-1]), (-1, ys[0])):
    zt = zc(ye)
    w, th = dims(ye)
    base = ye - sgn * 0.040
    # horn nock: cone over the limb end with a string groove
    prof = [(0.0, 0.0090), (0.006, 0.0094), (0.020, 0.0082), (0.028, 0.0058), (0.0305, 0.0060),
            (0.034, 0.0062), (0.0375, 0.0052), (0.048, 0.0032), (0.056, 0.0012), (0.058, 0.0)]
    M = Matrix.Translation((0, base, zc(base) * 0.98 + 0.0)) @ (Matrix.Diagonal((1, sgn, 1, 1)))
    b.lathe(prof, horn, n=14, axis='Y', M=M, ellipse=(1.0, 0.95), cap0=True)
    tips[sgn] = V((0, base + sgn * 0.032, zc(base) - 0.0))
# leather grip wrap
gv, guv, gf = [], [], []
GN = 16
gy0, gy1 = -0.062, 0.048
for i in range(GN + 1):
    y = gy0 + (gy1 - gy0) * i / GN
    w, th = dims(y)
    c = V((0, y, zc(y)))
    e = 0.0018
    for j in range(NR):
        a = 2 * math.pi * j / NR
        ca, sa = math.cos(a), math.sin(a)
        if sa >= 0:
            off = th * 0.38 * (sa ** 0.45) + e
            x = (w / 2 + e) * math.copysign(abs(ca) ** 0.75, ca)
        else:
            off = -th * 0.62 * (abs(sa) ** 0.95) - e
            x = (w / 2 + e) * ca
        gv.append(c + V((x, 0, off)))
        guv.append(((y - gy0) * 20, j / NR))
for i in range(GN):
    for j in range(NR):
        j2 = (j + 1) % NR
        gf.append((i * NR + j, i * NR + j2, (i + 1) * NR + j2, (i + 1) * NR + j))
b.add(gv, gf, leather, uv=('vert', guv))
# whipping cord at both grip ends
for y in (gy0 - 0.002, gy1 + 0.002):
    w, th = dims(y)
    pts = []
    for j in range(NR + 1):
        a = 2 * math.pi * j / NR
        ca, sa = math.cos(a), math.sin(a)
        off = th * 0.38 * (max(sa, 0) ** 0.45) - th * 0.62 * (max(-sa, 0) ** 0.95)
        pts.append(V((w / 2 * ca * 1.06 + 0.0, y, zc(y) + off * 1.08)))
    b.sweep(pts[:-1], 0.0016, serving, n=6, closed_path=True, cap=False)
# arrow plate (horn inlay on the archer's left = +X, just above the grip)
NOCK_Y = 0.052
b.rbox((0.0172, gy1 + 0.012, -0.003), (0.0014, 0.020, 0.015), horn, r=0.0006, seg=2)
bow_ob = b.to_object("bow")

# ------------------------------------------------------------------ string (two runs + centre serving)
top, bot = tips[1], tips[-1]
mid = V((0, NOCK_Y, top.z + (bot.z - top.z) * (NOCK_Y - top.y) / (bot.y - top.y)))
sb = WBuilder()
SEG = 14
def run(a, c):
    pts = [a.lerp(c, k / SEG) for k in range(SEG + 1)]
    return pts
for a_, c_ in ((top, mid), (mid, bot)):
    pts = run(a_, c_)
    sb.sweep(pts, 0.0016, string_m, n=6, cap=True, up=(1, 0, 0))
# centre serving (thicker wrap) +-0.06 around the nock point
for a_, c_ in ((mid + (top - mid).normalized() * 0.065, mid), (mid, mid + (bot - mid).normalized() * 0.065)):
    sb.sweep(run(a_, c_)[::2], 0.0023, serving, n=8, cap=True, up=(1, 0, 0))
# nocking point (small bump of thread above the arrow)
sb.ellipsoid(mid + V((0, 0.007, 0)), (0.0030, 0.0030, 0.0030), serving, nu=8, nv=6)
# string loops around the horn nock grooves
for sgn, tp in ((1, top), (-1, bot)):
    sb.torus(tp + V((0, sgn * 0.0015, 0)), 0.0066, 0.0017, string_m, nu=14, nv=6, axis='Y')
str_ob = sb.to_object("bowstring")

# ------------------------------------------------------------------ armature
arm_d = bpy.data.armatures.new("BowRig")
arm = bpy.data.objects.new("BowRig", arm_d)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_d.edit_bones
r = eb.new("bow"); r.head = (0, 0, 0); r.tail = (0, 0.1, 0)
lu = eb.new("limb_upper"); lu.head = (0, 0.075, 0.0); lu.tail = top; lu.parent = r
ll = eb.new("limb_lower"); ll.head = (0, -0.075, 0.0); ll.tail = bot; ll.parent = r
sm = eb.new("string_mid"); sm.head = mid; sm.tail = mid + V((0, 0.06, 0)); sm.parent = r
for e_ in (lu, ll):
    e_.roll = 0.0
bpy.ops.object.mode_set(mode='OBJECT')


def skin(ob, wfun):
    for nm in ("bow", "limb_upper", "limb_lower", "string_mid"):
        ob.vertex_groups.new(name=nm)
    for v in ob.data.vertices:
        for nm, wv in wfun(v.co).items():
            if wv > 1e-4:
                ob.vertex_groups[nm].add([v.index], wv, 'REPLACE')
    ob.parent = arm
    mod = ob.modifiers.new("Armature", 'ARMATURE'); mod.object = arm


def limb_w(co):
    y = co.y
    if y > 0.075:
        k = min(1.0, (y - 0.075) / (top.y - 0.075))
        wv = k ** 1.3 if y < top.y - 0.06 else 1.0
        return {"limb_upper": wv, "bow": 1 - wv}
    if y < -0.075:
        k = min(1.0, (-0.075 - y) / (-0.075 - bot.y))
        wv = k ** 1.3 if y > bot.y + 0.06 else 1.0
        return {"limb_lower": wv, "bow": 1 - wv}
    return {"bow": 1.0}


def string_w(co):
    if co.y >= mid.y:
        t = (top.y - co.y) / (top.y - mid.y)
        t = min(max(t, 0), 1)
        return {"limb_upper": 1 - t, "string_mid": t}
    t = (co.y - bot.y) / (mid.y - bot.y)
    t = min(max(t, 0), 1)
    return {"limb_lower": 1 - t, "string_mid": t}


skin(bow_ob, limb_w)
skin(str_ob, string_w)

# empties
nock = empty_at("nock", mid, fwd=(0, 0, 1), parent=arm, parent_bone="string_mid", size=0.04)
rest = empty_at("arrow_rest", V((0.0192, NOCK_Y + 0.004, -0.004)), fwd=(0, 0, 1), parent=arm, size=0.03)

# ------------------------------------------------------------------ Draw action
act = bpy.data.actions.new("Draw")
arm.animation_data_create()
arm.animation_data.action = act
pb = arm.pose.bones
for p in pb:
    p.rotation_mode = 'QUATERNION'
DRAW = 0.60
FLEX_U = -math.radians(11)
FLEX_L = math.radians(11)
for f, k in ((0, 0.0), (FPS, 1.0)):
    bpy.context.scene.frame_set(f)
    pb["string_mid"].location = (0, 0, -DRAW * k)       # bone axes == armature axes
    pb["limb_upper"].rotation_quaternion = Quaternion((1, 0, 0), FLEX_U * k)
    pb["limb_lower"].rotation_quaternion = Quaternion((1, 0, 0), FLEX_L * k)
    pb["string_mid"].keyframe_insert("location", frame=f)
    pb["limb_upper"].keyframe_insert("rotation_quaternion", frame=f)
    pb["limb_lower"].keyframe_insert("rotation_quaternion", frame=f)
    pb["bow"].keyframe_insert("location", frame=f)
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 0, FPS
bpy.context.scene.frame_set(0)
bpy.context.scene.frame_set(FPS)
dg = bpy.context.evaluated_depsgraph_get()
me = bow_ob.evaluated_get(dg).to_mesh()
hi = max(me.vertices, key=lambda v: v.co.y); lo = min(me.vertices, key=lambda v: v.co.y)
print("DRAWN tips", tuple(round(c, 3) for c in hi.co), tuple(round(c, 3) for c in lo.co))
bow_ob.evaluated_get(dg).to_mesh_clear()
print("NOCK drawn", tuple(round(c, 3) for c in nock.matrix_world.translation))
bpy.context.scene.frame_set(0)
print("TRIS", mesh_tris(bow_ob) + mesh_tris(str_ob))
print("MID", tuple(mid), "TOP", tuple(top), "BOT", tuple(bot))
export("bow")
