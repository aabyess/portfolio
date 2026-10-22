# Anatomy builders for the realistic NPCs. Blender coords: Z up, character faces -Y, +X = character's left.
import math
from mathutils import Vector, Euler
from lib_real import *

def gauss(p, c, r):
    d = (Vector(p) - Vector(c)).length / r
    return math.exp(-d * d)

# ---------------------------------------------------------------- head
EYE_Y = -0.0730
EYE_Z = 1.684
EYE_X = 0.0315
EYE_R = 0.0108

def head_mb(o):
    fem = o.get("fem", False)
    jaw = o.get("jaw", 1.0)           # jaw width factor
    mb = MB(res=o.get("head_res", 0.0032))
    # skull
    mb.ell((0, 0.014, 1.703), (0.0765, 0.095, 0.095), s=4)
    mb.ell((0, -0.048, 1.716), (0.062, 0.046, 0.056), s=3)                 # forehead
    # face mass (maxilla / cheeks) and lower face / jaw
    mb.ell((0, -0.045, 1.646), (0.057, 0.050, 0.055), s=2.5)
    mb.ell((0, -0.030, 1.608), (0.052 * jaw, 0.052, 0.036), s=2.5)
    for k in (1, -1):
        mb.ell((0.045 * k, -0.055, 1.661), (0.019, 0.014, 0.013), s=2.5)    # cheekbones
        mb.ball((EYE_X * k, -0.086, EYE_Z + 0.001), 0.0128, s=2.5, neg=True)  # eye socket
        # eyelids wrap the eyeball (eye centre at EYE_Y); upper lid covers the top third
        mb.ell((EYE_X * k, EYE_Y - 0.0010, EYE_Z + 0.0072), (0.0142, 0.0124, 0.0062), s=3, rot=(-16, 0, 0))
        mb.ell((EYE_X * k, EYE_Y - 0.0010, EYE_Z - 0.0094), (0.0128, 0.0112, 0.0042), s=3, rot=(14, 0, 0))
        mb.ball((0.0125 * k, -0.0995, 1.6375), 0.0080 if not fem else 0.0070, s=3)     # nostril wing
        mb.ball((0.0235 * k, -0.0915, 1.6055), 0.0036, s=2.5, neg=True)                 # mouth corner
        # ear
        mb.ell((0.0775 * k, 0.012, 1.668), (0.0085, 0.019, 0.030), s=3, rot=(0, 0, 8 * k))
        mb.ball((0.0855 * k, 0.010, 1.665), 0.0085, s=2.5, neg=True)
    mb.ball((0, -0.080, 1.578), 0.020 if not fem else 0.017, s=2.5)                      # chin
    br = 0.0115 if not fem else 0.008
    mb.cap((-0.034, -0.0825, 1.7035), (0.034, -0.0825, 1.7035), br, s=3)               # brow ridge
    # nose
    ns = 1.0 if not fem else 0.86
    mb.cap((0, -0.0895, 1.690), (0, -0.1055, 1.647), 0.0082 * ns, s=3)
    mb.ball((0, -0.1080, 1.641), 0.0105 * ns, s=3)
    # lips
    lp = 1.0 if not fem else 1.15
    mb.ell((0, -0.0935, 1.6125), (0.0205, 0.0085, 0.0058 * lp), s=3)
    mb.ell((0, -0.0920, 1.5995), (0.0175, 0.0085, 0.0062 * lp), s=3)
    mb.cap((-0.016, -0.1005, 1.6065), (0.016, -0.1005, 1.6065), 0.0017, s=2.5, neg=True)   # mouth line
    # neck
    nr = 0.052 if not fem else 0.045
    mb.cap((0, 0.014, 1.43), (0, 0.006, 1.61), nr, s=4)
    if not fem: mb.ball((0, -0.036, 1.527), 0.010, s=3)                                # adam's apple
    return mb

def C_skin(o):
    skin = o["skin"]
    lip = o.get("lip", mix(skin, (0.50, 0.24, 0.17), 0.40))
    blush = o.get("blush_col") or mix(skin, (0.72, 0.36, 0.22), 0.5)
    shadow = o.get("eyeshadow")   # optional (colour, amount): soft tint on the upper lids (barmaid)
    stub = o.get("stubble")
    es = o.get("eye_scale", 1.0); lw = 0.0022 * o.get("lash", 1.0); mw = o.get("mouth_w", 1.0)
    def c(p, n):
        col = skin
        g = gauss(p, (0.046, -0.072, 1.646), 0.022) + gauss(p, (-0.046, -0.072, 1.646), 0.022)
        g += 0.6 * gauss(p, (0, -0.112, 1.640), 0.012)
        g += 0.7 * (gauss(p, (0.08, 0.008, 1.668), 0.025) + gauss(p, (-0.08, 0.008, 1.668), 0.025))
        col = mix(col, blush, clamp(g) * o.get("blush", 0.25))
        # lips
        dx = p.x / (0.022 * mw); dz = (p.z - 1.6062) / 0.0118
        if p.y < -0.088 and dx * dx + dz * dz < 1.0:
            col = mix(col, lip, clamp((1 - (dx * dx + dz * dz)) * 3))
            ml = math.exp(-((p.z - 1.6060) / 0.0016) ** 2) * clamp((1 - dx * dx) * 2)
            col = mix(col, mul(lip, 0.45), ml * 0.8)
        # lash line along the upper lid
        for kk in (1, -1):
            a0 = Vector((kk * (EYE_X - 0.0118 * es), EYE_Y - 0.0098 * es, EYE_Z + 0.0022 * es)); a1 = Vector((kk * (EYE_X + 0.0112 * es), EYE_Y - 0.0078 * es, EYE_Z + 0.0030 * es))
            d = (p - a0) - (a1 - a0) * clamp((p - a0).dot(a1 - a0) / (a1 - a0).length_squared)
            if d.length < lw: col = mix(col, (0.05, 0.03, 0.02), (1 - d.length / lw) * 0.85)
        if shadow:
            g2 = gauss(p, (EYE_X, EYE_Y - 0.010 * es, EYE_Z + 0.008 * es), 0.010 * es) + gauss(p, (-EYE_X, EYE_Y - 0.010 * es, EYE_Z + 0.008 * es), 0.010 * es)
            col = mix(col, shadow[0], clamp(g2) * shadow[1])
        # eye surroundings darker
        e = gauss(p, (EYE_X, -0.085, EYE_Z), 0.02) + gauss(p, (-EYE_X, -0.085, EYE_Z), 0.02)
        col = mix(col, mul(col, 0.8), clamp(e) * 0.5)
        if stub:
            s = sstep(1.65, 1.625, p.z) * sstep(0.02, -0.04, p.y) * (1 - gauss(p, (0, -0.1, 1.606), 0.016))
            col = mix(col, stub, clamp(s) * 0.55)
        if p.z < 1.53: col = mul(col, 0.93 + 0.07 * sstep(1.45, 1.53, p.z))
        m = 1 + 0.035 * fbm(p, 60)
        return tuple(clamp(x * m) for x in col)
    return c

def eyes(o):
    parts = []
    iris = o.get("iris", (0.12, 0.06, 0.025))
    for k in (1, -1):
        ctr = Vector((EYE_X * k, EYE_Y, EYE_Z))
        er = EYE_R * o.get("eye_scale", 1.0)
        geo = sphere(ctr, (er, er, er), 12, 8)
        fwd = Vector((0.06 * k, -1, -0.03)).normalized()
        def col(p, n, ctr=ctr, fwd=fwd):
            d = (p - ctr).normalized().dot(fwd)
            if d > 0.975: return (0.015, 0.012, 0.01)
            if d > 0.80: return mix(iris, mul(iris, 0.45), (d - 0.80) / 0.17)
            return (0.62, 0.58, 0.54)
        parts.append(Part(geo, "Eye", col, W_head, subsurf=0, name="eye"))
    return parts

def brows(o, color, thick=1.0):
    parts = []
    for k in (1, -1):
        pts = [(0.012 * k, -0.0935, 1.7005), (0.024 * k, -0.0945, 1.7045), (0.037 * k, -0.0925, 1.7062), (0.049 * k, -0.0860, 1.7025)]
        geo = tube(pts, [(0.0042 * thick, 0.0016), (0.0046 * thick, 0.0017), (0.0040 * thick, 0.0016), (0.0022 * thick, 0.0012)], n=8, up=(0, -1, 0.3))
        parts.append(Part(geo, "Hair", C_var(color, 0.05, 80), W_head, subsurf=1, name="brow"))
    return parts

# ================================================================ SDF head (replaces metaball head)
def sd_ell(p, c, r):
    q = Vector(((p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]))
    k0 = q.length
    q2 = Vector((q.x / r[0], q.y / r[1], q.z / r[2]))
    k1 = q2.length
    if k1 < 1e-9: return -min(r)
    return k0 * (k0 - 1.0) / k1

def sd_cap(p, a, b, r):
    a = Vector(a); b = Vector(b); pa = p - a; ba = b - a
    h = clamp(pa.dot(ba) / ba.dot(ba))
    return (pa - ba * h).length - r

def smin(a, b, k):
    if k <= 0: return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25

def smax(a, b, k): return -smin(-a, -b, k)

class SDF:
    """ops: ('add'|'sub', kind, args, k, mirror). kind 'ell' (c, r) / 'cap' (a, b, r)."""
    def __init__(self): self.ops = []
    def add(self, kind, *args, k=0.01, mirror=False): self.ops.append(('add', kind, args, k, mirror)); return self
    def sub(self, kind, *args, k=0.004, mirror=False): self.ops.append(('sub', kind, args, k, mirror)); return self
    def prim(self, kind, args, p, mirror):
        q = Vector((abs(p.x), p.y, p.z)) if mirror else p
        return sd_ell(q, *args) if kind == 'ell' else sd_cap(q, *args)
    def __call__(self, p):
        d = 1e9
        for mode, kind, args, k, mirror in self.ops:
            x = self.prim(kind, args, p, mirror)
            d = smin(d, x, k) if mode == 'add' else smax(d, -x, k)
        return d
    def empty(self): return not self.ops

HEAD_C = Vector((0, -0.004, 1.668))

def cast_dir(fn, d, C=HEAD_C, tmax=0.34):
    d = Vector(d).normalized(); t = tmax
    for _ in range(200):
        v = fn(C + d * t)
        if v < 0.0003: break
        t -= max(v * 0.85, 0.0004)
        if t < 0.002: break
    lo, hi = t - 0.002, t + 0.006
    if fn(C + d * hi) > 0 and fn(C + d * max(lo, 0.001)) < 0:
        lo = max(lo, 0.001)
        for _ in range(14):
            m = (lo + hi) / 2
            if fn(C + d * m) > 0: hi = m
            else: lo = m
        t = (lo + hi) / 2
    return C + d * t

def refine_region(fn, verts, faces, pred, levels=1, C=HEAD_C):
    """Subdivide faces whose centre satisfies pred and re-project every vertex radially onto fn."""
    import bmesh as _bm
    for _ in range(levels):
        bm = _bm.new()
        vs = [bm.verts.new(v) for v in verts]
        for f in faces:
            try: bm.faces.new([vs[i] for i in f])
            except ValueError: pass
        bm.verts.ensure_lookup_table()
        sel = set()
        for f in bm.faces:
            if pred(f.calc_center_median()):
                for e in f.edges: sel.add(e)
        _bm.ops.subdivide_edges(bm, edges=list(sel), cuts=1, use_grid_fill=True, use_single_edge=False)
        _bm.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        for v in bm.verts:
            v.co = cast_dir(fn, v.co - C, C)
        bm.verts.index_update()
        verts = [v.co.copy() for v in bm.verts]; faces = [tuple(v.index for v in f.verts) for f in bm.faces]
        bm.free()
    return verts, faces

def despike(fn, verts, faces, iters=2, rel=0.7, C=HEAD_C):
    """Fix fold-overs from radial casting in concave creases: vertices far from their neighbour centroid
    (relative to local edge length) are re-cast through the centroid direction."""
    nb = [set() for _ in verts]
    for f in faces:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]; nb[a].add(b); nb[b].add(a)
    verts = list(verts)
    for _ in range(iters):
        moved = 0
        for i, v in enumerate(verts):
            if not nb[i] or v.y > -0.03 or v.z < 1.55: continue
            c = sum((verts[j] for j in nb[i]), Vector()) / len(nb[i])
            el = sum((verts[j] - c).length for j in nb[i]) / len(nb[i])
            if (v - c).length > rel * el + 0.0004:
                verts[i] = cast_dir(fn, c - C, C); moved += 1
        if not moved: break
    return verts

def star_mesh(fn, C=HEAD_C, nseg=48, nring=38, expo=1.35, tmax=0.34):
    """Project a sphere (poles on the -Y/+Y axis, dense at the face) onto the outermost surface of fn."""
    def dirv(th, ph):
        return Vector((math.sin(th) * math.cos(ph), -math.cos(th), math.sin(th) * math.sin(ph)))
    def cast(d):
        t = tmax
        for _ in range(200):
            v = fn(C + d * t)
            if v < 0.0003: break
            t -= max(v * 0.85, 0.0004)
            if t < 0.002: break
        # refine (in case we stopped inside)
        lo, hi = t - 0.002, t + 0.006
        if fn(C + d * hi) > 0 and fn(C + d * max(lo, 0.001)) < 0:
            lo = max(lo, 0.001)
            for _ in range(14):
                m = (lo + hi) / 2
                if fn(C + d * m) > 0: hi = m
                else: lo = m
            t = (lo + hi) / 2
        return C + d * t
    verts = [cast(dirv(0, 0))]
    ths = [math.pi * (i / nring) ** expo for i in range(1, nring)]
    for th in ths:
        for j in range(nseg):
            verts.append(cast(dirv(th, 2 * math.pi * j / nseg)))
    verts.append(cast(dirv(math.pi, 0))); last = len(verts) - 1
    faces = []
    for j in range(nseg): faces.append((0, 1 + j, 1 + (j + 1) % nseg))
    for i in range(len(ths) - 1):
        for j in range(nseg):
            a = 1 + i * nseg + j; b = 1 + i * nseg + (j + 1) % nseg
            faces.append((a, a + nseg, b + nseg, b))
    o = 1 + (len(ths) - 1) * nseg
    for j in range(nseg): faces.append((o + j, last, o + (j + 1) % nseg))
    return verts, faces

def head_sdf(o):
    fem = o.get("fem", False); jaw = o.get("jaw", 1.0); age = o.get("age", 0.0); full = o.get("cheek", 1.0)
    s = SDF()
    s.add('ell', (0, 0.014, 1.704), (0.0765, 0.096, 0.096), k=0.0)
    s.add('ell', (0, -0.045, 1.718), (0.064, 0.050, 0.058), k=0.025)
    s.add('ell', (0, -0.046, 1.650), (0.058, 0.052, 0.052), k=0.03)
    s.add('cap', (0.030, -0.071, 1.664), (0.062, -0.035, 1.660), 0.0105, k=0.02, mirror=True)        # zygomatic arch
    s.add('ell', (0.040, -0.058, 1.642), (0.018 * full, 0.014 * full, 0.018), k=0.03, mirror=True)  # cheek pad
    s.add('ell', (0, -0.036, 1.604), (0.046 * jaw, 0.050, 0.034), k=0.024)
    mw = o.get("mouth_w", 1.0); sm = o.get("smile", 0.0); mz = o.get("muzzle", 1.0); jl = o.get("jawline", 1.0)   # (barmaid) defaults = villagers
    s.add('cap', (0.052 * jaw, -0.002, 1.632), (0.020, -0.068, 1.575), (0.0085 if not fem else 0.0072) * jl, k=0.02, mirror=True)
    ch = o.get("chin", 1.0)
    s.add('ell', (0, -0.079 - 0.003 * (ch - 1), 1.578 if not fem else 1.582), ((0.020 if not fem else 0.016) * ch, 0.013, 0.016 if not fem else 0.013), k=0.012)
    s.add('ell', (0, -0.062 + 0.006 * (1 - mz), 1.624), (0.035, 0.020 * mz, 0.023), k=0.020)                                 # maxilla fill (v5: less muzzle)
    lp = (1.0 if not fem else 1.12) * o.get("lips", 1.0)
    s.add('ell', (0, -0.0868, 1.6115), (0.0160 * mw, 0.0044, 0.0040 * lp), k=0.006)
    s.add('ell', (0, -0.0858, 1.6005), (0.0140 * mw, 0.0046, 0.0046 * lp), k=0.006)
    s.sub('cap', (0, -0.0960, 1.6262), (0, -0.0953, 1.6168), 0.0011, k=0.003)                       # philtrum
    if sm:   # gentle smile: the lip line curves up towards the corners
        s.sub('cap', (-0.008 * mw, -0.0925, 1.6062), (0.008 * mw, -0.0925, 1.6062), 0.0009, k=0.0012)
        s.sub('cap', (0.008 * mw, -0.0925, 1.6062), (0.0165 * mw, -0.0915, 1.6062 + 0.0022 * sm), 0.0009, k=0.0012, mirror=True)
    else:
        s.sub('cap', (-0.0165 * mw, -0.0925, 1.6062), (0.0165 * mw, -0.0925, 1.6062), 0.0009, k=0.0012)           # lip line
    s.sub('ell', (0.0185 * mw, -0.0885, 1.6062 + 0.0030 * sm), (0.0022, 0.0030, 0.0022), k=0.003, mirror=True)        # corners
    s.sub('cap', (0.0160, -0.0935, 1.6370), (0.0255, -0.0865, 1.6060), 0.0005 + 0.0008 * age, k=0.010, mirror=True)  # nasolabial
    ns = (1.0 if not fem else 0.88) * o.get("nose", 1.0); nl = o.get("nose_len", 1.0)
    s.add('cap', (0, -0.0870, 1.692), (0, -0.0870 - 0.0165 * nl, 1.650), 0.0068 * ns, k=0.010)
    s.add('ell', (0, -0.0890 - 0.0170 * nl, 1.642), (0.0095 * ns, 0.0090 * ns, 0.0085 * ns), k=0.007)
    s.add('ell', (0.0115 * ns, -0.0975, 1.6385), (0.0068 * ns, 0.0068, 0.0060), k=0.005, mirror=True)
    s.sub('ell', (0.0080 * ns, -0.0995, 1.6332), (0.0024, 0.0030, 0.0014), k=0.0015, mirror=True)
    s.add('cap', (0.0, -0.0838, 1.7045), (0.038, -0.0800, 1.7035), 0.0095 if not fem else 0.0068, k=0.010, mirror=True)
    # eyes: almond opening, lids, crease
    e = o.get("eye_scale", 1.0)   # (king/barmaid) eye opening + lids scaled about the eye centre; 1.0 = v5 villagers
    s.sub('ell', (EYE_X, EYE_Y - 0.0085 * e, EYE_Z - 0.0004 * e), (0.0146 * e, 0.0120 * e, 0.0071 * e), k=0.0025, mirror=True)
    s.add('cap', (EYE_X - 0.0118 * e, EYE_Y - 0.0090 * e, EYE_Z + 0.0036 * e), (EYE_X + 0.0112 * e, EYE_Y - 0.0070 * e, EYE_Z + 0.0044 * e), 0.0024 * e, k=0.003, mirror=True)
    s.sub('cap', (EYE_X - 0.0110 * e, EYE_Y - 0.0098 * e, EYE_Z + 0.0088 * e), (EYE_X + 0.0110 * e, EYE_Y - 0.0082 * e, EYE_Z + 0.0095 * e), 0.0011, k=0.003, mirror=True)
    s.add('cap', (EYE_X - 0.0100 * e, EYE_Y - 0.0082 * e, EYE_Z - 0.0058 * e), (EYE_X + 0.0100 * e, EYE_Y - 0.0074 * e, EYE_Z - 0.0062 * e), 0.0016 * e, k=0.003, mirror=True)
    if age > 0:
        s.add('ell', (0.036, -0.056, 1.600), (0.012, 0.011, 0.010), k=0.022, mirror=True)            # jowls
        s.add('cap', (EYE_X - 0.008, EYE_Y - 0.0065, EYE_Z - 0.0105), (EYE_X + 0.009, EYE_Y - 0.0050, EYE_Z - 0.0110), 0.0022 * age, k=0.004, mirror=True)
    nr = 0.059 if not fem else 0.052   # v5: slightly thicker neck (read as long and thin before)
    s.add('cap', (0, 0.030, 1.40), (0, 0.004, 1.62), nr, k=0.03)   # v5: neck leans forward a little
    s.add('cap', (0.036, 0.018, 1.625), (0.012, -0.030, 1.47), 0.012 if not fem else 0.010, k=0.02, mirror=True)  # sternocleidomastoid
    if not fem: s.add('ell', (0, -0.036, 1.527), (0.011, 0.010, 0.014), k=0.012)
    return s

def binary_split(verts, tris, val):
    """Cut triangles along val == 0. verts/val are extended in place. Returns (positive_tris, negative_tris)."""
    cache = {}
    def cut(i, j):
        key = (min(i, j), max(i, j))
        if key not in cache:
            t = val[i] / (val[i] - val[j])
            verts.append(verts[i].lerp(verts[j], t)); val.append(0.0)
            cache[key] = len(verts) - 1
        return cache[key]
    A, B = [], []
    for tri in tris:
        sg = [val[i] > 0 for i in tri]
        if all(sg): A.append(tri); continue
        if not any(sg): B.append(tri); continue
        for r in range(3):
            l, m, n = tri[r], tri[(r + 1) % 3], tri[(r + 2) % 3]
            if sg[r] != sg[(r + 1) % 3] and sg[r] != sg[(r + 2) % 3]: break
        p = cut(l, m); q = cut(l, n)
        lone, rest = [(l, p, q)], [(p, m, n), (p, n, q)]
        if val[l] > 0: A += lone; B += rest
        else: B += lone; A += rest
    return A, B

def compact(verts, faces):
    used = sorted(set(i for f in faces for i in f)); remap = {i: n for n, i in enumerate(used)}
    return [verts[i] for i in used], [tuple(remap[i] for i in f) for f in faces]

def ear_parts(o, skin_col):
    parts = []
    for k in (1, -1):
        c = Vector((0.0725 * k, 0.012, 1.668))
        v, f = sphere((0, 0, 0), (0.0080, 0.0175, 0.028), 10, 9)
        out = []
        for p in v:
            q = Vector(p)
            if q.x > 0.002:  # concha bowl on the outer side
                g = math.exp(-((q.y + 0.002) / 0.010) ** 2 - ((q.z + 0.003) / 0.014) ** 2)
                q.x -= 0.0042 * g
            q.x *= 1.0
            q = Euler((0, 0, math.radians(-3))).to_matrix() @ q   # flare back
            q.x *= k
            out.append(c + q)
        parts.append(Part((out, f), "Skin", C_var(mix(skin_col, (0.8, 0.35, 0.3), 0.15), 0.03, 60), W_head, subsurf=0, name="ear"))
    return parts

def sdf_grad(fn, p, e=0.0006):
    g = Vector((fn(p + Vector((e, 0, 0))) - fn(p - Vector((e, 0, 0))),
                fn(p + Vector((0, e, 0))) - fn(p - Vector((0, e, 0))),
                fn(p + Vector((0, 0, e))) - fn(p - Vector((0, 0, e)))))
    return g.normalized() if g.length > 1e-12 else Vector((0, 0, 1))

def shell_on_skin(head, verts, tris, vol, col, name, edge=0.004, tmin=0.0025, tmax=0.05, smooth_it=3, mat="Hair", weight=None):
    """Hair/beard as a sculpted shell grown out of the skin mesh: region = inside vol (cut along a
    smooth contour), thickness = distance along the skin normal to vol's outer surface, rounded edge."""
    verts = list(verts)
    val = [-vol(v) for v in verts]
    A, _ = binary_split(verts, list(tris), val)
    if not A: return None
    used = sorted(set(i for f in A for i in f)); remap = {i: n for n, i in enumerate(used)}
    nb = {i: set() for i in used}
    for f in A:
        for a in f:
            for b in f:
                if a != b: nb[a].add(b)
    th = {}; nrm = {}
    for i in used:
        p = verts[i]; n = sdf_grad(head, p); nrm[i] = n
        t = 0.0; x = tmax
        while x > 0:
            if vol(p + n * x) < 0: t = x; break
            x -= 0.001
        th[i] = max(t, tmin)
    for _ in range(smooth_it):
        th = {i: 0.5 * th[i] + 0.5 * sum(th[j] for j in nb[i]) / max(len(nb[i]), 1) for i in used}
    out = []
    for i in used:
        v = max(val[i], 0.0)
        r = math.sqrt(clamp(v / edge))
        t = th[i] * r - 0.0006 * (1 - r)
        out.append(verts[i] + nrm[i] * t)
    return Part((out, [tuple(remap[i] for i in f) for f in A]), mat, col, weight or W_head, subsurf=0, name=name)

def hair_clumps(amp=0.0042, freq=11.0, crown=(0, 0.03, 1.80)):
    """Strand clumps radiating from the crown: ridged noise in (azimuth, polar) space, pushed along the normal."""
    cr = Vector(crown)
    def post(co, n):
        d = co - cr
        az = math.atan2(d.x, -d.y); pol = math.acos(clamp(-d.z / max(d.length, 1e-6), -1, 1))
        q = Vector((math.cos(az) * freq, math.sin(az) * freq, pol * 2.5))
        r = 1 - abs(noise.noise(q)); r2 = 1 - abs(noise.noise(q * 2.3 + Vector((5, 1, 3))))
        return co + n * amp * (0.7 * r * r + 0.3 * r2 * r2 - 0.35)
    return post

def beard_clumps(amp=0.0022):
    def post(co, n):
        q = Vector((co.x * 220, co.y * 220, co.z * 45))
        r = 1 - abs(noise.noise(q))
        return co + n * amp * (r * r - 0.3)
    return post

def head_parts(o):
    head = head_sdf(o)
    hair = o.get("hair_sdf"); beard = o.get("beard_sdf")
    skin_c = C_skin(o)
    verts, faces = star_mesh(head, nseg=o.get("nseg", 50), nring=o.get("nring", 40))
    verts, faces = refine_region(head, verts, faces, lambda c: c.y < -0.062 and 1.585 < c.z < 1.715 and abs(c.x) < 0.052)
    verts = despike(head, verts, faces)
    tris = []
    for f in faces:
        for i in range(1, len(f) - 1): tris.append((f[0], f[i], f[i + 1]))
    parts = [Part((verts, faces), "Skin", skin_c, W_head, subsurf=0, decimate=o.get("head_tris", 6500), name="head")]
    if hair is not None and not hair.empty():
        hc = o.get("hair_col_fn") or C_var(o["hair_col"], 0.12, 40, streak=(1.0, 1.0, 0.25))
        pt = shell_on_skin(head, verts, tris, hair, hc, "hair", edge=o.get("hair_edge", 0.0018), tmin=0.0045)
        if pt: pt.decimate = o.get("hair_tris", 1600); pt.post = hair_clumps(); parts.append(pt)
    if beard is not None and not beard.empty():
        bc = o.get("beard_col_fn") or C_var(o.get("beard_col", o.get("hair_col", (0.2, 0.1, 0.05))), 0.12, 50, streak=(1, 1, 0.35))
        pt = shell_on_skin(head, verts, tris, beard, bc, "beard", edge=o.get("beard_edge", 0.0025), tmin=0.004)
        if pt: pt.decimate = o.get("beard_tris", 1100); pt.post = beard_clumps(); parts.append(pt)
    for sh in o.get("shells", []):
        pt = shell_on_skin(head, verts, tris, sh["sdf"], sh["col"], sh.get("name", "shell"), edge=sh.get("edge", 0.006),
                           tmax=sh.get("tmax", 0.06), mat=sh.get("mat", "Cloth"), weight=sh.get("weight"), tmin=sh.get("tmin", 0.0025))
        if pt:
            pt.decimate = sh.get("tris", 900); pt.post = sh.get("post"); parts.append(pt)
    parts += eyes(o)
    if not o.get("no_ears"): parts += ear_parts(o, o["skin"])
    if o.get("brow_col"): parts += brows(o, o["brow_col"], o.get("brow_thick", 1.25))
    fs = o.get("face_scale")
    if fs:   # v5: per-character head proportions (x = width, y = depth, z = height) around the head centre
        C = HEAD_C
        for pt in parts:
            pt.verts = [Vector((C.x + (v[0] - C.x) * fs[0], C.y + (v[1] - C.y) * fs[1], C.z + (v[2] - C.z) * fs[2])) for v in pt.verts]
    return parts
