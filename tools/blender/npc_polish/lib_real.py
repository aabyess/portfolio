# Shared infrastructure for the "realistic" NPC rebuild: skeleton + actions (identical to the
# low-poly build), metaball / loft geometry helpers, part processing (solidify/subsurf/decimate),
# vertex-colour + procedural weights, merge, materials and Draco glTF export.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Euler, Quaternion, noise

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
OUT_GLB = os.environ.get("NPC_OUT") or os.path.join(REPO, "models", "npc")
OUT_SRC = os.path.join(REPO, "models", "src")
FPS = 24
SIDE = {"L": 1, "R": -1}

# ---------------------------------------------------------------- skeleton (unchanged)
def skeleton():
    b = {}
    b["Hips"] = ((0, 0, 0.93), (0, 0, 1.05), None)
    b["Spine"] = ((0, 0, 1.05), (0, 0, 1.25), "Hips")
    b["Chest"] = ((0, 0, 1.25), (0, 0, 1.47), "Spine")
    b["Neck"] = ((0, 0, 1.47), (0, 0, 1.56), "Chest")
    b["Head"] = ((0, 0, 1.56), (0, 0, 1.80), "Neck")
    for s, k in SIDE.items():
        b[f"UpperArm.{s}"] = ((0.21 * k, 0, 1.42), (0.24 * k, 0, 1.15), "Chest")
        b[f"LowerArm.{s}"] = ((0.24 * k, 0, 1.15), (0.25 * k, 0, 0.92), f"UpperArm.{s}")
        b[f"Hand.{s}"] = ((0.25 * k, 0, 0.92), (0.25 * k, 0, 0.82), f"LowerArm.{s}")
        b[f"UpperLeg.{s}"] = ((0.10 * k, 0, 0.92), (0.10 * k, 0, 0.50), "Hips")
        b[f"LowerLeg.{s}"] = ((0.10 * k, 0, 0.50), (0.10 * k, 0, 0.09), f"UpperLeg.{s}")
        b[f"Foot.{s}"] = ((0.10 * k, 0, 0.09), (0.10 * k, -0.15, 0.03), f"LowerLeg.{s}")
    b["Prop.R"] = ((-0.17, 0.0, 0.875), (-0.17, -0.08, 0.875), "Hand.R")
    return b

# ---------------------------------------------------------------- math helpers
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def sstep(e0, e1, x):
    t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t)
def V(*a): return Vector(a if len(a) == 3 else a[0])
def mix(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)

# ---------------------------------------------------------------- metaballs
def kfac(s, t=0.6): return math.sqrt(1 - (t / s) ** (1 / 3))

class MB:
    """Metaball family. Radii are the *isolated surface* radii (calibrated for threshold 0.6)."""
    def __init__(self, res=0.005):
        self.el = []; self.res = res
    def ball(self, c, r, s=3.0, neg=False):
        self.el.append(('BALL', Vector(c), r / kfac(s), s, (1, 1, 1), Quaternion(), neg)); return self
    def ell(self, c, r3, s=3.0, rot=(0, 0, 0), neg=False):
        m = max(r3); q = Euler([math.radians(a) for a in rot]).to_quaternion()
        self.el.append(('ELLIPSOID', Vector(c), m / kfac(s), s, tuple(x / m for x in r3), q, neg)); return self
    def cap(self, a, b, r, s=3.0, neg=False):
        a, b = Vector(a), Vector(b); d = b - a; L = d.length / 2
        q = Vector((1, 0, 0)).rotation_difference(d.normalized()) if L > 1e-6 else Quaternion()
        self.el.append(('CAPSULE', (a + b) / 2, r / kfac(s), s, (L, 1, 1), q, neg)); return self
    def chain(self, pts, radii, s=3.0, steps=3):
        """Tapered tube as overlapping balls (smooth taper)."""
        pts = [Vector(p) for p in pts]
        for i in range(len(pts) - 1):
            for j in range(steps):
                t = j / steps
                self.ball(pts[i].lerp(pts[i + 1], t), radii[i] + (radii[i + 1] - radii[i]) * t, s)
        self.ball(pts[-1], radii[-1], s)
        return self
    def to_mesh(self):
        mb = bpy.data.metaballs.new("mbtmp"); mb.resolution = self.res; mb.render_resolution = self.res
        mb.threshold = 0.6; mb.update_method = 'UPDATE_ALWAYS'
        ob = bpy.data.objects.new("mbtmpobj", mb); bpy.context.scene.collection.objects.link(ob)
        for t, c, R, s, sz, q, neg in self.el:
            e = mb.elements.new(type=t); e.co = c; e.radius = R; e.stiffness = s
            e.rotation = q; e.use_negative = neg
            e.size_x, e.size_y, e.size_z = sz
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        verts = [v.co.copy() for v in me.vertices]; faces = [tuple(p.vertices) for p in me.polygons]
        bpy.data.objects.remove(ob); bpy.data.metaballs.remove(mb); bpy.data.meshes.remove(me)
        return verts, faces

# ---------------------------------------------------------------- lofts
def frame_for(d, up_hint=None):
    d = d.normalized()
    u = Vector((1, 0, 0)) if up_hint is None else Vector(up_hint)
    if abs(d.dot(u)) > 0.9: u = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((0, 0, 1))
    u = (u - d * d.dot(u)).normalized(); v = d.cross(u)
    return u, v

def ring(c, u, v, rx, ry, n, ryb=None, bump=None, phase=0.0, sq=2.0):
    """Ring of n points around c in plane (u, v). ry = radius toward +v, ryb toward -v.
    bump(theta) -> radial multiplier. sq: superellipse exponent (2 = ellipse)."""
    c = Vector(c); out = []
    ryb = ry if ryb is None else ryb
    for k in range(n):
        a = phase + 2 * math.pi * k / n
        ca, sa = math.cos(a), math.sin(a)
        if sq != 2.0:
            ca = math.copysign(abs(ca) ** (2 / sq), ca); sa = math.copysign(abs(sa) ** (2 / sq), sa)
        m = bump(a) if bump else 1.0
        out.append(c + u * (ca * rx * m) + v * (sa * (ry if sa > 0 else ryb) * m))
    return out

def hring(c, rx, ryf, ryb=None, n=16, bump=None, sq=2.0):
    """Horizontal ring: +X right(left of char), front = -Y gets ryf. theta=90deg is front."""
    return ring(c, Vector((1, 0, 0)), Vector((0, -1, 0)), rx, ryf, n, ryb=ryb, bump=bump, sq=sq)

def loft(rings, cap0=None, cap1=None):
    """cap: None (open), 'pole' (fan to centre), or a Vector offset for the pole tip."""
    verts, faces = [], []
    n = len(rings[0])
    for r in rings: verts += [Vector(p) for p in r]
    for i in range(len(rings) - 1):
        for k in range(n):
            a = i * n + k; b = i * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
    for cap, ri, rev in ((cap0, 0, True), (cap1, len(rings) - 1, False)):
        if cap is None: continue
        ctr = sum((Vector(p) for p in rings[ri]), Vector()) / n
        if isinstance(cap, (Vector, tuple)): ctr = ctr + Vector(cap)
        verts.append(ctr); ci = len(verts) - 1; base = ri * n
        for k in range(n):
            f = (base + k, base + (k + 1) % n, ci)
            faces.append(tuple(reversed(f)) if rev else f)
    return verts, faces

def tube(pts, radii, n=12, cap0='pole', cap1='pole', up=None, bump=None, ryf=None):
    """Loft rings along a polyline; radii r or (rx, ry)."""
    pts = [Vector(p) for p in pts]; rings = []
    for i, p in enumerate(pts):
        d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        u, v = frame_for(d, up)
        r = radii[i]; rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rings.append(ring(p, u, v, rx, ry, n, bump=(bump(i) if bump else None)))
    return loft(rings, cap0, cap1)

def sphere(c, r3, nu=16, nv=10):
    """UV sphere with real poles."""
    c = Vector(c); rx, ry, rz = r3; verts = [c + Vector((0, 0, -rz))]; faces = []
    for j in range(1, nv):
        th = -math.pi / 2 + math.pi * j / nv
        for k in range(nu):
            a = 2 * math.pi * k / nu
            verts.append(c + Vector((math.cos(th) * math.cos(a) * rx, math.cos(th) * math.sin(a) * ry, math.sin(th) * rz)))
    verts.append(c + Vector((0, 0, rz))); top = len(verts) - 1
    for k in range(nu): faces.append((0, 1 + (k + 1) % nu, 1 + k))
    for j in range(nv - 2):
        for k in range(nu):
            a = 1 + j * nu + k; b = 1 + j * nu + (k + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    o = 1 + (nv - 2) * nu
    for k in range(nu): faces.append((o + k, o + (k + 1) % nu, top))
    return verts, faces

def grid_panel(rows, thick_dir=None):
    """rows: list of lists of points (same length) -> open quad sheet."""
    verts, faces = [], []
    m = len(rows[0])
    for r in rows: verts += [Vector(p) for p in r]
    for i in range(len(rows) - 1):
        for j in range(m - 1):
            a = i * m + j; faces.append((a, a + 1, a + m + 1, a + m))
    return verts, faces

def xform(geo, mat):
    v, f = geo
    return [mat @ Vector(p) for p in v], f

# ---------------------------------------------------------------- weights
def chain_w(p, pts, bones, hw):
    pts = [Vector(x) for x in pts]
    S = [0.0]
    for i in range(len(pts) - 1): S.append(S[-1] + (pts[i + 1] - pts[i]).length)
    best = None
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]; d = b - a
        t = clamp((p - a).dot(d) / max(d.length_squared, 1e-12)); q = a + d * t
        dist = (p - q).length
        if best is None or dist < best[0] - 1e-9: best = (dist, S[i] + t * (S[i + 1] - S[i]))
    s = best[1]; n = len(bones)
    ts = [1.0] + [sstep(S[j] - hw[j - 1], S[j] + hw[j - 1], s) for j in range(1, n)] + [0.0]
    w = {}
    for i in range(n):
        x = ts[i] - ts[i + 1]
        if x > 1e-4: w[bones[i]] = w.get(bones[i], 0) + x
    return w

def W_torso(p, arms=True, head=False):
    if head:
        w = chain_w(p, [(0, 0, 0.8), (0, 0, 1.05), (0, 0, 1.25), (0, 0, 1.47), (0, 0, 1.56), (0, 0, 1.9)],
                    ["Hips", "Spine", "Chest", "Neck", "Head"], [0.07, 0.08, 0.035, 0.035])
    else:
        w = chain_w(p, [(0, 0, 0.8), (0, 0, 1.05), (0, 0, 1.25), (0, 0, 1.5)], ["Hips", "Spine", "Chest"], [0.07, 0.08])
    if arms and abs(p.x) > 0.10 and p.z > 1.28:
        k = 1 if p.x > 0 else -1; s = "L" if k > 0 else "R"
        d = (p - Vector((0.21 * k, 0, 1.42))).length
        a = 0.55 * (1 - sstep(0.035, 0.12, d))
        if a > 0:
            w = {b: x * (1 - a) for b, x in w.items()}; w[f"UpperArm.{s}"] = w.get(f"UpperArm.{s}", 0) + a
    return w

def W_head(p):
    return chain_w(p, [(0, 0, 1.38), (0, 0, 1.47), (0, 0, 1.56), (0, 0, 1.95)], ["Chest", "Neck", "Head"], [0.03, 0.035])

def arm_pts(k):
    return [(0.07 * k, 0, 1.45), (0.21 * k, 0, 1.42), (0.24 * k, 0, 1.15), (0.25 * k, 0, 0.92), (0.25 * k, 0, 0.70)]
def W_arm(s, hw=(0.04, 0.055, 0.03)):
    k = SIDE[s]
    return lambda p: chain_w(p, arm_pts(k), ["Chest", f"UpperArm.{s}", f"LowerArm.{s}", f"Hand.{s}"], list(hw))

def leg_pts(k):
    return [(0.10 * k, 0, 1.08), (0.10 * k, 0, 0.92), (0.10 * k, 0, 0.50), (0.10 * k, 0, 0.09), (0.10 * k, -0.20, 0.03)]
def W_leg(s, hw=(0.07, 0.06, 0.03)):
    k = SIDE[s]
    return lambda p: chain_w(p, leg_pts(k), ["Hips", f"UpperLeg.{s}", f"LowerLeg.{s}", f"Foot.{s}"], list(hw))
def W_foot(s):
    def f(p):
        t = sstep(0.075, 0.13, p.z)
        w = {f"Foot.{s}": 1 - t, f"LowerLeg.{s}": t}
        return {b: x for b, x in w.items() if x > 1e-4}
    return f

def _blend_legs(p, t, wl, u=0.0):
    base = W_torso(p, arms=False)
    w = {k: v * (1 - t) for k, v in base.items()}
    for s, f in (("L", wl), ("R", 1 - wl)):
        w[f"UpperLeg.{s}"] = w.get(f"UpperLeg.{s}", 0) + t * (1 - u) * f
        if u > 0: w[f"LowerLeg.{s}"] = w.get(f"LowerLeg.{s}", 0) + t * u * f
    return {k: v for k, v in w.items() if v > 1e-4}

def legblend(z_top=0.98, z_bot=0.80, xw=0.12):
    def f(p):
        t = 1 - sstep(z_bot, z_top, p.z)
        return _blend_legs(p, t, sstep(-xw, xw, p.x))
    return f

def legblend3(z_top=0.98, z_bot=0.80, zk_top=0.60, zk_bot=0.44, xw=0.14, lower_max=1.0):
    def f(p):
        t = 1 - sstep(z_bot, z_top, p.z)
        u = (1 - sstep(zk_bot, zk_top, p.z)) * lower_max
        return _blend_legs(p, t, sstep(-xw, xw, p.x), u)
    return f

def W_body(p):
    if p.z < 1.0: return legblend(1.0, 0.85, xw=0.09)(p)
    return W_torso(p, arms=True)

def W_const(b): return lambda p: {b: 1.0}

# ---------------------------------------------------------------- colours
def fbm(p, f=30.0, oct=2):
    a, s, tot = 1.0, 0.0, 0.0
    for i in range(oct):
        s += a * noise.noise(Vector(p) * f * (2 ** i)); tot += a; a *= 0.5
    return s / tot

def C_var(base, amt=0.07, f=25.0, streak=None):
    """Base colour with low-frequency mottling (fabric/skin variation)."""
    def c(p, n):
        q = Vector(p)
        if streak: q = Vector((q.x * streak[0], q.y * streak[1], q.z * streak[2]))
        m = 1.0 + amt * fbm(q, f)
        return tuple(clamp(x * m) for x in base)
    return c

# ---------------------------------------------------------------- parts
class Part:
    def __init__(self, geo, mat, color, weight, subsurf=1, solidify=0.0, decimate=None, post=None,
                 name="part", smooth=0, sol_offset=-1.0):
        self.verts, self.faces = geo
        self.mat, self.color, self.weight = mat, color, weight
        self.subsurf, self.solidify, self.decimate, self.post = subsurf, solidify, decimate, post
        self.name, self.smooth, self.sol_offset = name, smooth, sol_offset

def _eval(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data; ob.modifiers.clear(); ob.data = me; bpy.data.meshes.remove(old)

def realize(part):
    me = bpy.data.meshes.new(part.name)
    me.from_pydata([tuple(v) for v in part.verts], [], part.faces); me.update()
    ob = bpy.data.objects.new(part.name, me); bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    if part.subsurf and not part.solidify:
        m = ob.modifiers.new("SS", 'SUBSURF'); m.levels = part.subsurf; m.render_levels = part.subsurf
        m.quality = 3
    if part.solidify:
        m = ob.modifiers.new("S", 'SOLIDIFY'); m.thickness = part.solidify; m.offset = part.sol_offset
        m.use_even_offset = False; m.use_rim = True; m.use_quality_normals = True
    if part.smooth:
        m = ob.modifiers.new("SM", 'SMOOTH'); m.factor = 0.5; m.iterations = part.smooth
    if ob.modifiers: _eval(ob)
    if part.post:
        me = ob.data
        nrm = [v.normal.copy() for v in me.vertices]
        for v, n in zip(me.vertices, nrm): v.co = part.post(v.co.copy(), n)
        me.update()
    if part.decimate:
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if tris > part.decimate:
            m = ob.modifiers.new("D", 'DECIMATE'); m.ratio = part.decimate / tris
            m.use_collapse_triangulate = True; m.use_symmetry = True; m.symmetry_axis = 'X'
            _eval(ob)
    me = ob.data
    out = ([v.co.copy() for v in me.vertices], [v.normal.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    return out

MATS = {  # name: (roughness, metallic, specular)
    "Skin": (0.58, 0.0, 0.5), "Cloth": (0.92, 0.0, 0.35), "Leather": (0.62, 0.0, 0.45), "Hair": (0.72, 0.0, 0.45),
    "Eye": (0.18, 0.0, 0.6), "Metal": (0.40, 0.6, 0.5), "Gold": (0.35, 0.75, 0.5), "Wood": (0.72, 0.0, 0.4),
    "Foam": (0.8, 0.0, 0.3),
}

def merge(parts):
    allv, alln, allf, fmat, cols, wts = [], [], [], [], [], []
    mats = []
    for part in parts:
        vs, ns, fs = realize(part)
        if os.environ.get("NPC_DEBUG"): print("PART", part.name, sum(len(f) - 2 for f in fs))
        if part.mat not in mats: mats.append(part.mat)
        mi = mats.index(part.mat); base = len(allv)
        for v, n in zip(vs, ns):
            allv.append(v); alln.append(n)
            cols.append(part.color(v, n))
            w = part.weight(v)
            w = dict(sorted(w.items(), key=lambda kv: -kv[1])[:4]); s = sum(w.values()) or 1.0
            wts.append({b: x / s for b, x in w.items()})
        for f in fs:
            allf.append(tuple(base + i for i in f)); fmat.append(mi)
    return allv, allf, fmat, cols, wts, mats

def make_material(name, key):
    r, mt, sp = MATS[key]
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    c = nt.nodes.new("ShaderNodeVertexColor"); c.layer_name = "Col"
    nt.links.new(c.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = r; b.inputs["Metallic"].default_value = mt
    try: b.inputs["Specular IOR Level"].default_value = sp
    except Exception: pass
    m.diffuse_color = (0.7, 0.6, 0.5, 1)
    return m

# ---------------------------------------------------------------- animation (unchanged from low-poly build)
def rest_rot(pb): return pb.bone.matrix_local.to_3x3()

class Anim:
    def __init__(self, arm): self.arm = arm; self.prevq = {}
    def pose(self, rots, hips_loc=(0, 0, 0), prop_scale=1.0):
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            e = rots.get(pb.name, (0, 0, 0))
            R = Euler([math.radians(a) for a in e], 'XYZ').to_matrix()
            M = rest_rot(pb)
            q = (M.inverted() @ R @ M).to_quaternion()
            pq = self.prevq.get(pb.name)
            if pq is not None and pq.dot(q) < 0: q.negate()
            self.prevq[pb.name] = q.copy()
            pb.rotation_quaternion = q
            pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
        hp = self.arm.pose.bones["Hips"]
        hp.location = rest_rot(hp).inverted() @ Vector(hips_loc)
        s = max(prop_scale, 0.001)
        self.arm.pose.bones["Prop.R"].scale = (s, s, s)
    def key(self, f):
        for pb in self.arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("scale", frame=f)

def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def smooth(t): t = clamp(t); return t * t * (3 - 2 * t)

SIT_HIPS = (0, 0.0, -0.42)
def sit_base(t, period):
    w = 2 * math.pi * t / period
    sway = math.sin(w)
    return {
        "Hips": (0, 0, 0),
        "UpperLeg.L": (-90, 0, 9), "UpperLeg.R": (-90, 0, -9),
        "LowerLeg.L": (90, 0, 0), "LowerLeg.R": (90, 0, 0),
        "Foot.L": (0, 0, 0), "Foot.R": (0, 0, 0),
        "Spine": (6 + 1.0 * math.sin(2 * w), 0, 1.5 * sway),
        "Chest": (3 + 1.2 * math.sin(2 * w + 0.5), 0, 1.0 * sway),
        "Neck": (-3, 0, 0), "Head": (-2 + 2 * math.sin(w + 1), 0, 8 * math.sin(w * 0.5 + 0.3) if period > 60 else 0),
        "UpperArm.L": (-28, 0, 4), "LowerArm.L": (-55, 0, 0), "Hand.L": (0, 0, 0),
        "UpperArm.R": (-22, 0, 8), "LowerArm.R": (-68 + 2 * sway, 0, 0), "Hand.R": (0, 0, 0),
    }

def act_idle(A):
    P = 72
    for f in range(0, P + 1, 2):
        w = 2 * math.pi * f / P; b = math.sin(w)
        r = {"Spine": (1.0 * b, 0, 0.8 * math.sin(w + 0.7)), "Chest": (1.5 * b, 0, 0), "Neck": (0, 0, 0),
             "Head": (-1.0 * b, 0, 3 * math.sin(w * 1 + 1.3)),
             "UpperArm.L": (2 * b, 0, -4), "UpperArm.R": (2 * b, 0, 4),
             "LowerArm.L": (-8 - 2 * b, 0, 0), "LowerArm.R": (-8 - 2 * b, 0, 0),
             "Hips": (0, 0, 1.0 * math.sin(w + 0.7)),
             "UpperLeg.L": (0, 0, 1.5), "UpperLeg.R": (0, 0, -1.5)}
        A.pose(r, hips_loc=(0.008 * math.sin(w + 0.7), 0, 0.004 * b), prop_scale=0.0); A.key(f)
    return P

def act_walk(A):
    P = 24
    for f in range(0, P + 1, 1):
        ph = 2 * math.pi * f / P; s, c = math.sin(ph), math.cos(ph)
        thL, thR = -26 * s, 26 * s
        kL = 6 + 42 * max(0.0, c) ** 1.5 + 6 * max(0.0, -c)
        kR = 6 + 42 * max(0.0, -c) ** 1.5 + 6 * max(0.0, c)
        fL = -(thL + kL) * 0.6 if c < 0 else -kL * 0.3
        fR = -(thR + kR) * 0.6 if c > 0 else -kR * 0.3
        r = {"UpperLeg.L": (thL, 0, 1.5), "UpperLeg.R": (thR, 0, -1.5),
             "LowerLeg.L": (kL, 0, 0), "LowerLeg.R": (kR, 0, 0),
             "Foot.L": (fL, 0, 0), "Foot.R": (fR, 0, 0),
             "UpperArm.L": (22 * s, 0, -5), "UpperArm.R": (-22 * s, 0, 5),
             "LowerArm.L": (-18 - 10 * max(0, -s), 0, 0), "LowerArm.R": (-18 - 10 * max(0, s), 0, 0),
             "Hips": (0, 0, 6 * s), "Spine": (3, 0, -3 * s), "Chest": (1, 0, -4 * s),
             "Head": (-2, 0, 1 * s)}
        bob = -0.035 * abs(s) + 0.01
        A.pose(r, hips_loc=(0, 0, bob - 0.01), prop_scale=0.0); A.key(f)
    return P

def act_sit(A):
    P = 96
    for f in range(0, P + 1, 2):
        A.pose(sit_base(f, P), hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

ARM_REST = {"UpperArm.R": (-22, 0, 8), "LowerArm.R": (-68, 0, 0), "Hand.R": (0, 0, 0)}
ARM_DRINK = {"UpperArm.R": (-72, 0, 62), "LowerArm.R": (-95, 0, -14), "Hand.R": (-22, 40, 26)}
ARM_DRINK2 = {"UpperArm.R": (-80, 0, 80), "LowerArm.R": (-103, 0, -20), "Hand.R": (-41, 59, 38)}
ARM_CHEERS = {"UpperArm.R": (-120, 0, 15), "LowerArm.R": (-12, 0, 0), "Hand.R": (42, 0, 0)}
ARM_CHEERS2 = {"UpperArm.R": (-128, 0, 13), "LowerArm.R": (-4, 0, 0), "Hand.R": (42, 0, 0)}
def blend_arm(a, b, t): return {k: lerp(a[k], b[k], t) for k in a}

def act_drink(A):
    P = 72
    keys = [(0, ARM_REST, 0), (12, ARM_REST, 0), (28, ARM_DRINK, 1), (40, ARM_DRINK2, 1.3), (50, ARM_DRINK, 1), (64, ARM_REST, 0), (72, ARM_REST, 0)]
    for f in range(0, P + 1, 2):
        r = sit_base(f, P)
        for i in range(len(keys) - 1):
            f0, a0, h0 = keys[i]; f1, a1, h1 = keys[i + 1]
            if f0 <= f <= f1:
                t = smooth((f - f0) / (f1 - f0)); arm = blend_arm(a0, a1, t); h = h0 + (h1 - h0) * t
                break
        r.update(arm)
        r["Head"] = (-2 - 14 * h, 0, 0); r["Neck"] = (-3 - 5 * h, 0, 0); r["Chest"] = (3 - 4 * h, 0, 0)
        A.pose(r, hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

def act_cheers(A):
    P = 36
    keys = [(0, ARM_REST, 0), (10, ARM_CHEERS, 1), (14, ARM_CHEERS2, 1.4), (18, ARM_CHEERS, 1), (24, ARM_CHEERS, 1), (36, ARM_REST, 0)]
    for f in range(0, P + 1, 2):
        r = sit_base(f, P)
        for i in range(len(keys) - 1):
            f0, a0, h0 = keys[i]; f1, a1, h1 = keys[i + 1]
            if f0 <= f <= f1:
                t = smooth((f - f0) / (f1 - f0)); arm = blend_arm(a0, a1, t); h = h0 + (h1 - h0) * t
                break
        r.update(arm)
        r["Spine"] = (6 + 4 * h, 0, 4 * h); r["Chest"] = (3 + 2 * h, 0, 3 * h)
        r["Head"] = (-2 - 6 * h, 0, 0); r["UpperArm.L"] = (-28 + 6 * h, 0, 4)
        A.pose(r, hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

def act_struggle(A):
    """Held up by the torso/collar: legs kick alternately, arms flail, head shakes. Hips at rest height."""
    P = 24
    for f in range(0, P + 1, 1):
        w = 2 * math.pi * f / P; s, c = math.sin(w), math.cos(w)
        s2 = math.sin(2 * w)
        r = {"Hips": (4 * s2, 0, 5 * s), "Spine": (-4 + 3 * c, 0, -4 * s), "Chest": (-3, 0, -3 * s),
             "Neck": (4, 0, 10 * math.sin(2 * w + 0.6)), "Head": (6 + 4 * s2, 0, 16 * math.sin(2 * w)),
             "UpperLeg.L": (-30 - 25 * s, 0, 6), "UpperLeg.R": (-30 + 25 * s, 0, -6),
             "LowerLeg.L": (45 + 30 * max(0.0, c), 0, 0), "LowerLeg.R": (45 + 30 * max(0.0, -c), 0, 0),
             "Foot.L": (20 * s, 0, 0), "Foot.R": (-20 * s, 0, 0),
             "UpperArm.L": (-60 + 45 * math.sin(2 * w), 0, 55 - 25 * c), "UpperArm.R": (-60 - 45 * math.sin(2 * w + 0.8), 0, -55 + 25 * c),
             "LowerArm.L": (-55 - 30 * math.sin(2 * w + 1.0), 0, 0), "LowerArm.R": (-55 - 30 * math.sin(2 * w + 2.0), 0, 0),
             "Hand.L": (20 * s2, 0, 0), "Hand.R": (-20 * s2, 0, 0)}
        A.pose(r, hips_loc=(0, 0, 0), prop_scale=0.0); A.key(f)
    return P

# GetUp: frame 0 = lying on the back (face up), head toward +Y, feet near the origin.
GU_KEYS = [
    (0, {"Hips": (-90, 0, 0), "UpperArm.L": (0, 0, -10), "UpperArm.R": (0, 0, 10), "LowerArm.L": (-10, 0, 0), "LowerArm.R": (-10, 0, 0),
         "Head": (0, 0, 0), "Foot.L": (20, 0, 0), "Foot.R": (20, 0, 0)}, (0, 0.93, -0.80)),
    (5, {"Hips": (-80, 0, 0), "Spine": (10, 0, 0), "Chest": (8, 0, 0), "Head": (12, 0, 0),
         "UpperLeg.L": (-25, 0, 3), "UpperLeg.R": (-25, 0, -3), "LowerLeg.L": (50, 0, 0), "LowerLeg.R": (50, 0, 0),
         "UpperArm.L": (25, 0, -20), "UpperArm.R": (25, 0, 20), "LowerArm.L": (-20, 0, 0), "LowerArm.R": (-20, 0, 0)}, (0, 0.80, -0.80)),
    (14, {"Hips": (-25, 0, 0), "Spine": (15, 0, 0), "Chest": (10, 0, 0), "Head": (5, 0, 0),
          "UpperLeg.L": (-95, 0, 6), "UpperLeg.R": (-95, 0, -6), "LowerLeg.L": (110, 0, 0), "LowerLeg.R": (110, 0, 0),
          "Foot.L": (10, 0, 0), "Foot.R": (10, 0, 0),
          "UpperArm.L": (40, 0, -12), "UpperArm.R": (40, 0, 12), "LowerArm.L": (-10, 0, 0), "LowerArm.R": (-10, 0, 0),
          "Hand.L": (-60, 0, 0), "Hand.R": (-60, 0, 0)}, (0, 0.40, -0.80)),
    (24, {"Hips": (35, 0, 0), "Spine": (12, 0, 0), "Chest": (6, 0, 0), "Head": (-20, 0, 0),
          "UpperLeg.L": (-135, 0, 8), "UpperLeg.R": (-135, 0, -8), "LowerLeg.L": (125, 0, 0), "LowerLeg.R": (125, 0, 0),
          "Foot.L": (-25, 0, 0), "Foot.R": (-25, 0, 0),
          "UpperArm.L": (-40, 0, -10), "UpperArm.R": (-40, 0, 10), "LowerArm.L": (-30, 0, 0), "LowerArm.R": (-30, 0, 0)}, (0, 0.20, -0.53)),
    (36, {}, (0, 0, 0)),
]

def act_getup(A):
    return keyed_action(A, 36, GU_KEYS)

BONE_R = {"Hips": 0.125, "Spine": 0.115, "Chest": 0.12, "Neck": 0.06, "Head": 0.115, "UpperArm": 0.055, "LowerArm": 0.045,
          "Hand": 0.04, "UpperLeg": 0.08, "LowerLeg": 0.058, "Foot": 0.045, "Prop": 0.0}

def ground_lift(arm):
    """How far the posed body (approximated by capsules around the bones) dips below z=0."""
    bpy.context.view_layer.update()
    lo = 1e9
    for pb in arm.pose.bones:
        r = BONE_R[pb.name.split(".")[0]]
        if r == 0: continue
        h = arm.matrix_world @ pb.head; t = arm.matrix_world @ pb.tail
        if pb.name == "Head": t = h + (t - h) * 1.0
        for k in range(4):
            q = h.lerp(t, k / 3)
            lo = min(lo, q.z - r)
    return max(0.0, -lo)

def keyed_action(A, P, keys, clamp_ground=True):
    names = [b.name for b in A.arm.pose.bones]
    for f in range(0, P + 1, 1):
        for i in range(len(keys) - 1):
            f0, r0, l0 = keys[i]; f1, r1, l1 = keys[i + 1]
            if f0 <= f <= f1:
                t = smooth((f - f0) / (f1 - f0)); break
        r = {n: lerp(r0.get(n, (0, 0, 0)), r1.get(n, (0, 0, 0)), t) for n in names}
        loc = list(lerp(l0, l1, t))
        A.pose(r, hips_loc=loc, prop_scale=0.0)
        if clamp_ground and 0 < f < P or (clamp_ground and f == 0 and l0[2] < -0.3) or (clamp_ground and f == P and l1[2] < -0.3):
            d = ground_lift(A.arm)
            if d > 0:
                loc[2] += d; A.pose(r, hips_loc=loc, prop_scale=0.0)
        A.key(f)
    return P

def act_fall(A):
    """Knocked backward: stumble, arms up, land on the back. Last frame == GetUp frame 0."""
    keys = [
        (0, {}, (0, 0, 0)),
        (4, {"Hips": (-12, 0, 0), "Spine": (-8, 0, 0), "Chest": (-6, 0, 0), "Head": (18, 0, 0),
             "UpperLeg.L": (-25, 0, 4), "UpperLeg.R": (8, 0, -4), "LowerLeg.L": (35, 0, 0), "LowerLeg.R": (20, 0, 0),
             "UpperArm.L": (-110, 0, 35), "UpperArm.R": (-110, 0, -35), "LowerArm.L": (-30, 0, 0), "LowerArm.R": (-30, 0, 0)}, (0, 0.08, -0.03)),
        (11, {"Hips": (-50, 0, 0), "Spine": (-6, 0, 0), "Chest": (-4, 0, 0), "Head": (25, 0, 0),
              "UpperLeg.L": (-40, 0, 5), "UpperLeg.R": (-20, 0, -5), "LowerLeg.L": (40, 0, 0), "LowerLeg.R": (30, 0, 0),
              "UpperArm.L": (-150, 0, 40), "UpperArm.R": (-150, 0, -40), "LowerArm.L": (-25, 0, 0), "LowerArm.R": (-25, 0, 0)}, (0, 0.45, -0.42)),
        (16, {"Hips": (-86, 0, 0), "Head": (12, 0, 0), "UpperLeg.L": (-18, 0, 3), "UpperLeg.R": (-8, 0, -3),
              "LowerLeg.L": (15, 0, 0), "LowerLeg.R": (10, 0, 0),
              "UpperArm.L": (-60, 0, 30), "UpperArm.R": (-60, 0, -30), "LowerArm.L": (-20, 0, 0), "LowerArm.R": (-20, 0, 0)}, (0, 0.88, -0.77)),
        (20,) + tuple(GU_KEYS[0][1:]),
    ]
    return keyed_action(A, 20, keys)

def act_stomp(A):
    P = 24
    for f in range(0, P + 1, 1):
        w = 2 * math.pi * f / P
        def lift(ph):   # 0..1 lift curve for a stomp window of 12 frames starting at ph
            x = ((f - ph) % 24) / 12.0
            if x >= 1: return 0.0
            return math.sin(math.pi * min(x / 0.75, 1.0)) if x < 0.75 else 0.0
        lL, lR = lift(0), lift(12)
        shake = math.sin(4 * w)
        r = {"Hips": (0, 0, 3 * math.sin(w)), "Spine": (9, 0, 0), "Chest": (6, 0, 2 * math.sin(w)), "Neck": (4, 0, 0),
             "Head": (-8 + 3 * shake, 0, 6 * math.sin(2 * w)),
             "UpperLeg.L": (-45 * lL, 0, 3), "UpperLeg.R": (-45 * lR, 0, -3),
             "LowerLeg.L": (6 + 60 * lL, 0, 0), "LowerLeg.R": (6 + 60 * lR, 0, 0),
             "Foot.L": (-15 * lL, 0, 0), "Foot.R": (-15 * lR, 0, 0),
             "UpperArm.R": (-125 + 6 * shake, 0, -25), "LowerArm.R": (-70 + 18 * shake, 0, 0), "Hand.R": (10 * shake, 0, 0),
             "UpperArm.L": (-15, 0, 28), "LowerArm.L": (-75, 0, 0), "Hand.L": (0, 0, 0)}
        imp = max(0.0, 1 - abs(((f % 12) - 9.5) / 2.5))   # small dip on impact (frames ~9-10 and ~21-22)
        A.pose(r, hips_loc=(0, 0, -0.012 * imp + 0.012), prop_scale=0.0); A.key(f)
    return P

def act_run(A):
    P = 16
    for f in range(0, P + 1, 1):
        ph = 2 * math.pi * f / P; s, c = math.sin(ph), math.cos(ph)
        thL, thR = -40 * s, 40 * s
        kL = 12 + 88 * max(0.0, c) ** 1.2 + 18 * max(0.0, -c)
        kR = 12 + 88 * max(0.0, -c) ** 1.2 + 18 * max(0.0, c)
        fL = -(thL + kL) * 0.5 if c < 0 else -kL * 0.25
        fR = -(thR + kR) * 0.5 if c > 0 else -kR * 0.25
        r = {"UpperLeg.L": (thL, 0, 2), "UpperLeg.R": (thR, 0, -2),
             "LowerLeg.L": (kL, 0, 0), "LowerLeg.R": (kR, 0, 0),
             "Foot.L": (fL, 0, 0), "Foot.R": (fR, 0, 0),
             "UpperArm.L": (45 * s, 0, 6), "UpperArm.R": (-45 * s, 0, -6),
             "LowerArm.L": (-80 - 15 * s, 0, 0), "LowerArm.R": (-80 + 15 * s, 0, 0),
             "Hips": (0, 0, 9 * s), "Spine": (10, 0, -4 * s), "Chest": (4, 0, -7 * s), "Neck": (-4, 0, 0),
             "Head": (-6, 0, 2 * s)}
        bob = -0.06 * abs(s) + 0.0
        A.pose(r, hips_loc=(0, 0, bob - 0.015), prop_scale=0.0); A.key(f)
    return P

ACTIONS = [("Idle", act_idle), ("Walk", act_walk), ("Sit", act_sit), ("Drink", act_drink), ("Cheers", act_cheers),
           ("Struggle", act_struggle), ("GetUp", act_getup), ("Fall", act_fall), ("Stomp", act_stomp), ("Run", act_run)]

# ---------------------------------------------------------------- build + export
def build_character(name, parts, export=True, save=True, actions=True):
    sc = bpy.context.scene
    sc.render.fps = FPS
    ad = bpy.data.armatures.new(f"{name}_Rig")
    arm = bpy.data.objects.new("Armature", ad); sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    sk = skeleton()
    for bn, (h, t, p) in sk.items():
        eb = ad.edit_bones.new(bn); eb.head = h; eb.tail = t; eb.roll = 0.0
    for bn, (h, t, p) in sk.items():
        if p: ad.edit_bones[bn].parent = ad.edit_bones[p]; ad.edit_bones[bn].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    ad.display_type = 'STICK'
    verts, faces, fmat, cols, wts, mats = merge(parts)
    me = bpy.data.meshes.new(f"{name}_Mesh")
    me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(f"NPC_{name.capitalize()}", me); sc.collection.objects.link(ob)
    for key in mats: me.materials.append(make_material(f"{name}_{key}", key))
    for i, p in enumerate(me.polygons):
        p.material_index = fmat[i]; p.use_smooth = True
    ca = me.color_attributes.new("Col", 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(cols): ca.data[i].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = ca
    groups = {bn: ob.vertex_groups.new(name=bn) for bn in sk}
    for i, w in enumerate(wts):
        for bn, x in w.items(): groups[bn].add([i], x, 'REPLACE')
    if os.environ.get("NPC_BAKE", "1") == "1":
        from bake_real import bake_textures
        bake_textures(ob, name, res=int(os.environ.get("NPC_TEX", "1024")))
    ob.parent = arm
    mod = ob.modifiers.new("Armature", 'ARMATURE'); mod.object = arm
    if actions:
        arm.animation_data_create()
        A = Anim(arm)
        for an, af in ACTIONS:
            act = bpy.data.actions.new(an); act.use_fake_user = True
            arm.animation_data.action = act
            A.prevq = {}
            P = af(A)
            act.use_frame_range = True; act.frame_start = 0; act.frame_end = P
            act.use_cyclic = True
            tr = arm.animation_data.nla_tracks.new(); tr.name = an
            tr.strips.new(an, 0, act); tr.mute = True
            arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    sc.frame_start = 0; sc.frame_end = 96
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    if save and not os.environ.get("NPC_OUT"):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_SRC, f"npc-{name}.blend"))
    if export:
        glb = os.path.join(OUT_GLB, f"npc-{name}.glb")
        bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True,
                                  export_animation_mode='ACTIONS', export_draco_mesh_compression_enable=True,
                                  export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False,
                                  export_skins=True, export_yup=True, export_apply=False,
                                  export_anim_slide_to_zero=True, export_optimize_animation_size=True,
                                  export_extra_animations=False, export_vertex_color='MATERIAL',
                                  export_image_format=os.environ.get('NPC_IMG', 'WEBP'), export_image_quality=int(os.environ.get('NPC_Q', '82')))
        print("BUILT", name, "tris", tris, "verts", len(me.vertices), "bytes", os.path.getsize(glb))
    else:
        print("BUILT(noexport)", name, "tris", tris, "verts", len(me.vertices))
    return arm, ob
