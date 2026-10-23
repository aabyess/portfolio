# Player v2: stylized head (numpy SDF -> radial "star" mesh), ears, clumped hair and the painted face texture.
# Coordinates: person.glb bind pose in Blender world metres (Z up, character faces -Y).
import math
import numpy as np
from mathutils import Vector

HC = np.array([0.0, -0.030, 1.668])          # ray origin for the radial head mesh

# ---------------------------------------------------------------- numpy SDF primitives
def sd_ell(P, c, r):
    c = np.asarray(c, float); r = np.asarray(r, float)
    q = (P - c) / r
    k0 = np.linalg.norm(q, axis=1)
    k1 = np.linalg.norm(q / r, axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)

def sd_cap(P, a, b, r):
    a = np.asarray(a, float); b = np.asarray(b, float)
    pa = P - a; ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - r

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k): return -smin(-a, -b, k)

# ---------------------------------------------------------------- head shape
EYE_X, EYE_Z = 0.034, 1.669

def skull_sdf(P):
    d = sd_ell(P, (0, -0.022, 1.703), (0.081, 0.098, 0.099))                    # cranium
    d = smin(d, sd_ell(P, (0, -0.046, 1.634), (0.060, 0.073, 0.066)), 0.032)    # face mass
    d = smin(d, sd_ell(P, (0, -0.084, 1.574), (0.024, 0.022, 0.018)), 0.022)    # chin
    for k in (1, -1):
        d = smin(d, sd_cap(P, (0.047 * k, -0.012, 1.612), (0.014 * k, -0.074, 1.574), 0.012), 0.030)   # jaw line
    return d

def neck_sdf(P):
    return sd_cap(P, (0, 0.002, 1.40), (0, -0.012, 1.615), 0.0435)

def hair_sdf(P):
    return smin(skull_sdf(P), neck_sdf(P), 0.02)

def head_sdf(P):
    d = skull_sdf(P)
    for k in (1, -1):
        d = smin(d, sd_ell(P, (0.042 * k, -0.084, 1.648), (0.020, 0.017, 0.016)), 0.018)  # cheekbones
    d = smin(d, neck_sdf(P), 0.022)                                                          # neck
    # small straight nose
    d = smin(d, sd_cap(P, (0, -0.110, 1.690), (0, -0.123, 1.648), 0.0068), 0.012)
    d = smin(d, sd_ell(P, (0, -0.1235, 1.6425), (0.0105, 0.0095, 0.0085)), 0.008)
    for k in (1, -1):
        d = smin(d, sd_ell(P, (0.0085 * k, -0.1165, 1.6395), (0.0062, 0.0058, 0.0050)), 0.005)  # alae
    # brow ridge + soft eye sockets (eyes are painted, so keep it shallow)
    d = smin(d, sd_cap(P, (-0.040, -0.1035, 1.6995), (0.040, -0.1035, 1.6995), 0.0095), 0.020)
    for k in (1, -1):
        d = smax(d, -sd_ell(P, (EYE_X * k, -0.1235, EYE_Z), (0.019, 0.011, 0.0115)), 0.012)
    # lips: slight fullness, chin cleft-free
    d = smin(d, sd_ell(P, (0, -0.1050, 1.6045), (0.0165, 0.0065, 0.0062)), 0.010)
    return d

def radial_hit(sdf, dirs, r0=0.012, r1=0.32, step=0.0015):
    """first exit radius of sdf along each unit dir (from HC)."""
    rs = np.arange(r0, r1, step)
    n = len(dirs)
    out = np.full(n, r1)
    found = np.zeros(n, bool)
    for r in rs:
        P = HC + dirs * r
        d = sdf(P)
        hit = (d > 0) & ~found
        out[hit] = r; found |= hit
        if found.all(): break
    # refine by bisection between r-step and r
    lo = out - step; hi = out.copy()
    for _ in range(7):
        mid = 0.5 * (lo + hi)
        d = sdf(HC + dirs * mid[:, None])
        inside = d < 0
        lo = np.where(inside, mid, lo); hi = np.where(inside, hi, mid)
    return 0.5 * (lo + hi)

def dir_of(az, el):
    """az: 0 = front (-Y), +90deg = character's left (+X). el: elevation."""
    az = np.asarray(az, float); el = np.asarray(el, float)
    return np.stack([np.sin(az) * np.cos(el), -np.cos(az) * np.cos(el), np.sin(el)], -1)

def _warp(u, a):  # u in [-1,1] -> denser near 0
    return u - a / math.pi * np.sin(math.pi * u)

def head_mesh(n_az=64, n_el=46):
    """radial lat-long mesh of head_sdf; front (az=0) and face band (el ~ 0) get denser samples."""
    us = np.linspace(-1, 1, n_az, endpoint=False) + 1.0 / n_az
    az = math.pi * _warp(us, 0.55)
    vs = np.linspace(-1, 1, n_el + 2)[1:-1]
    el = 0.5 * math.pi * np.sign(vs) * np.abs(_warp(vs, 0.45))
    AZ, EL = np.meshgrid(az, el)                     # (n_el, n_az)
    D = dir_of(AZ.ravel(), EL.ravel())
    R = radial_hit(head_sdf, D)
    P = HC + D * R[:, None]
    pd = dir_of(np.array([0.0, 0.0]), np.array([-math.pi / 2, math.pi / 2]))
    pr = radial_hit(head_sdf, pd)
    verts = [Vector(p) for p in P] + [Vector(HC + pd[0] * pr[0]), Vector(HC + pd[1] * pr[1])]
    bot, top = len(verts) - 2, len(verts) - 1
    faces = []
    for j in range(n_el - 1):
        for i in range(n_az):
            a = j * n_az + i; b = j * n_az + (i + 1) % n_az
            faces.append((a, b, b + n_az, a + n_az))
    for i in range(n_az):
        faces.append((bot, (i + 1) % n_az, i))
        o = (n_el - 1) * n_az
        faces.append((o + i, o + (i + 1) % n_az, top))
    return verts, faces

def ear_geo(k):
    """simple ear: flattened, slightly cupped ellipsoid tilted back."""
    from lib_real import sphere
    vs, fs = sphere((0, 0, 0), (0.0085, 0.0165, 0.025), 12, 8)
    out = []
    for v in vs:
        x, y, z = v.x, v.y, v.z
        x += 0.006 * (1 - (y / 0.019) ** 2) * (1 if x > 0 else 0.3)       # cup: rim sticks out
        # tilt back 14deg, splay out 18deg
        a = math.radians(14); y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
        b = math.radians(-18 * 1); x, y = x * math.cos(b) - y * math.sin(b), x * math.sin(b) + y * math.cos(b)
        out.append(Vector((k * (0.0765 + x), -0.008 + y, 1.667 + z)))
    if k < 0: fs = [tuple(reversed(f)) for f in fs]
    return out, fs

# ---------------------------------------------------------------- hair
def scalp_point(az, el, off):
    d = dir_of(np.array([az]), np.array([el]))
    r = radial_hit(skull_sdf, d)[0]
    return Vector(HC + d[0] * (r + off)), Vector(d[0])

def _slerp_dirs(d0, d1, t):
    d0 = np.asarray(d0); d1 = np.asarray(d1)
    om = math.acos(max(-1.0, min(1.0, float(d0 @ d1))))
    if om < 1e-6: return d0
    return (math.sin((1 - t) * om) * d0 + math.sin(t * om) * d1) / math.sin(om)

def strand(root, tip, w=0.026, t=0.010, lift=0.010, off0=0.004, off1=0.010, n=9, sides=6, bend=0.0, twist=0.0, mid=None, tip_out=0.0):
    """Hair clump: a lens-section ribbon that hugs the scalp from root (az,el) to tip (az,el).
    lift: extra height in the middle (volume); off1: offset at the tip; tip_out: tip leaves the surface
    (metres along the outward normal, grows as s^2)."""
    a0, e0 = map(math.radians, root); a1, e1 = map(math.radians, tip)
    d0 = dir_of(np.array([a0]), np.array([e0]))[0]; d1 = dir_of(np.array([a1]), np.array([e1]))[0]
    dm = None
    if mid:
        dm = dir_of(np.array([math.radians(mid[0])]), np.array([math.radians(mid[1])]))[0]
    dirs = []
    for i in range(n):
        s = i / (n - 1)
        if dm is not None:
            d = _slerp_dirs(_slerp_dirs(d0, dm, s), _slerp_dirs(dm, d1, s), s)
        else:
            d = _slerp_dirs(d0, d1, s)
        dirs.append(d / np.linalg.norm(d))
    D = np.array(dirs)
    R = radial_hit(hair_sdf, D)
    pts, nrm = [], []
    for i in range(n):
        s = i / (n - 1)
        off = off0 + (off1 - off0) * s + lift * math.sin(math.pi * min(1.0, s * 1.15)) + tip_out * s * s
        pts.append(Vector(HC + D[i] * (R[i] + off))); nrm.append(Vector(D[i]))
    verts, faces = [], []
    for i in range(n):
        s = i / (n - 1)
        T = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        N = (nrm[i] - T * nrm[i].dot(T)).normalized()
        B = T.cross(N)
        tw = twist * s
        Bn = B * math.cos(tw) + N * math.sin(tw); Nn = N * math.cos(tw) - B * math.sin(tw)
        taper = (1 - s) ** 0.75 if i < n - 1 else 0.0
        bulge = 1.0 + 0.25 * math.sin(math.pi * s)
        ww = w * 0.5 * taper * bulge; tt = t * 0.5 * max(taper, 0.25 if i < n - 1 else 0) * bulge
        c = pts[i] + Bn * (bend * w * s * s)
        if i == n - 1:
            verts.append(c); continue
        for j in range(sides):
            a = 2 * math.pi * j / sides
            ca, sa = math.cos(a), math.sin(a)
            # lens: flat underside, rounded top
            verts.append(c + Bn * (ca * ww) + Nn * (sa * tt * (1.0 if sa > 0 else 0.45)))
    for i in range(n - 2):
        for j in range(sides):
            a = i * sides + j; b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    tipi = len(verts) - 1; o = (n - 2) * sides
    for j in range(sides): faces.append((o + j, o + (j + 1) % sides, tipi))
    # root cap
    rc = sum((verts[j] for j in range(sides)), Vector()) / sides
    verts.append(rc); ri = len(verts) - 1
    for j in range(sides): faces.append(((j + 1) % sides, j, ri))
    return verts, faces

def hairline_el(az_deg):
    """elevation (deg) of the hairline at azimuth az (0 front, 180 back), symmetric."""
    a = abs(((az_deg + 180) % 360) - 180)
    pts = [(0, 31), (30, 28), (52, 20), (70, 13), (88, 9), (100, -2), (118, -14), (140, -30), (180, -44)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= a <= x1: return y0 + (y1 - y0) * (a - x0) / (x1 - x0)
    return -36

def hair_cap(off=0.003, n_az=48, n_el=20):
    """scalp shell above the hairline (open edge sits just inside the hairline; clumps cover it)."""
    verts, faces = [], []
    rows = []
    for j in range(n_el + 1):
        t = j / n_el
        row = []
        for i in range(n_az):
            az = 360.0 * i / n_az - 180.0
            e0 = hairline_el(az) + 2.0
            el = e0 + (89.0 - e0) * (1 - (1 - t) ** 1.3)
            row.append((math.radians(az), math.radians(el), t))
        rows.append(row)
    flat = [x for r in rows for x in r]
    D = dir_of(np.array([x[0] for x in flat]), np.array([x[1] for x in flat]))
    R = radial_hit(hair_sdf, D)
    for (az, el, t), d, r in zip(flat, D, R):
        o = off + 0.004 * t   # a bit more volume towards the crown
        verts.append(Vector(HC + d * (r + o)))
    for j in range(n_el):
        for i in range(n_az):
            a = j * n_az + i; b = j * n_az + (i + 1) % n_az
            faces.append((a, b, b + n_az, a + n_az))
    top = Vector(HC + np.array([0, 0, 1.0]) * (radial_hit(skull_sdf, np.array([[0, 0, 1.0]]))[0] + off + 0.004))
    verts.append(top); ti = len(verts) - 1; o = n_el * n_az
    for i in range(n_az): faces.append((o + i, o + (i + 1) % n_az, ti))
    return verts, faces

def hair_strands():
    """list of strand() geometries: side-swept, tousled hero hair (parting on the character's right)."""
    S = []
    def add(*a, **k):
        k.setdefault("n", HN); k.setdefault("sides", HS)
        S.append(strand(*a, **k))
    # --- crown -> sweep to the character's left and forward (main mass, gives volume on top)
    for (az, el, ta, te, w) in [(-20, 62, 55, 20, 0.036), (-10, 74, 72, 14, 0.036), (0, 84, 95, 10, 0.034), (-35, 70, 42, 26, 0.034),
                                (12, 62, 80, 18, 0.032), (-5, 52, 40, 25, 0.030), (25, 50, 66, 22, 0.030), (-25, 80, 110, 18, 0.032)]:
        add((az, el), (ta, te), w=w, t=0.013, lift=0.013, off0=0.006, off1=0.009, tip_out=0.004, bend=0.15)
    # --- fringe: a swoop from the parting across the forehead to the character's left; uneven tips
    for (ra, re, ma, me, ta, te, w, lift) in [(-22, 60, -5, 52, 22, 25, 0.030, 0.016), (-14, 64, 5, 51, 36, 23, 0.032, 0.017),
                                              (-6, 66, 16, 50, 50, 21, 0.030, 0.015), (2, 66, 26, 48, 62, 16, 0.028, 0.012),
                                              (-28, 58, -14, 46, 3, 24, 0.026, 0.012), (-18, 57, -9, 42, -3, 21, 0.018, 0.010),
                                              (-34, 56, -30, 46, -24, 35, 0.020, 0.008)]:
        add((ra, re), (ta, te), mid=(ma, me), w=w, t=0.012, lift=lift, off0=0.007, off1=0.006, tip_out=0.003, bend=0.25)
    # --- right side (short side of the parting): swept back/down over the temple, close to the head
    for (ra, re, ta, te, w) in [(-40, 55, -80, 22, 0.032), (-55, 50, -98, 10, 0.030), (-62, 38, -104, 0, 0.026), (-48, 30, -72, 14, 0.022), (-75, 45, -118, 0, 0.030)]:
        add((ra, re), (ta, te), w=w, t=0.010, lift=0.004, off0=0.005, off1=0.004, tip_out=0.002, bend=-0.1)
    # --- left side: covers the temple, tips just above the ear
    for (ra, re, ta, te, w) in [(45, 45, 86, 8, 0.032), (62, 40, 104, 0, 0.030), (38, 32, 66, 6, 0.024), (72, 28, 112, -6, 0.024), (80, 48, 120, -2, 0.030)]:
        add((ra, re), (ta, te), w=w, t=0.010, lift=0.004, off0=0.005, off1=0.005, tip_out=0.003, bend=0.15)
    # --- back: crown -> nape, layered, pointed tips at the neck
    for i in range(9):
        a = -64 + 128 * i / 8
        add((180 + a * 0.3, 70), (180 + a * 1.1, -50 + 14 * abs(a) / 64), w=0.042, t=0.012, lift=0.008, off0=0.006, off1=0.004,
            tip_out=0.004, bend=0.12 * (1 if i % 2 else -1), mid=(180 + a * 0.9, 12))
    for i in range(6):
        a = -55 + 110 * i / 5
        add((180 + a * 0.6, 40), (180 + a * 1.15, -38 + 10 * abs(a) / 55), w=0.034, t=0.011, lift=0.006, off0=0.008, off1=0.006,
            tip_out=0.006, bend=0.15 * (1 if i % 2 else -1))
    for a in (112, 132, 152, -112, -132, -152):
        add((a * 0.95, 34), (a, -26 + 8 * (abs(a) < 120)), w=0.032, t=0.010, lift=0.004, off0=0.005, off1=0.005, tip_out=0.004)
    return S

HN, HS = 9, 6

# ---------------------------------------------------------------- painted face texture (sRGB floats)
FACE_RES = 1024
FX0, FX1, FZ0, FZ1 = -0.100, 0.100, 1.545, 1.800     # front planar region -> u in [0, FU], v in [0, 1]
FU = 0.80
CZ0, CZ1 = 1.36, 1.84                               # cylinder strip -> u in [0.82, 1.0]

SKIN_S = np.array([236, 189, 156]) / 255.0

def face_uv_front(x, z):
    return ((x - FX0) / (FX1 - FX0) * FU, (z - FZ0) / (FZ1 - FZ0))

def face_uv_cyl(x, y, z):
    az = math.atan2(x, -(y - HC[1]))
    return (0.82 + 0.18 * (az + math.pi) / (2 * math.pi), min(max((z - CZ0) / (CZ1 - CZ0), 0.0), 1.0))

def _ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def _over(img, col, a):
    a = np.clip(a, 0, 1)[..., None]
    img[:] = img * (1 - a) + np.asarray(col, float) * a

def paint_face(res=FACE_RES):
    H = W = res
    img = np.ones((H, W, 3)) * SKIN_S
    # front region texel -> (x, z)
    us = (np.arange(W) + 0.5) / W; vs = (np.arange(H) + 0.5) / H
    U, Vv = np.meshgrid(us, vs)                              # row 0 = v small = low z (Blender image rows go bottom->top)
    X = FX0 + U / FU * (FX1 - FX0); Z = FZ0 + Vv * (FZ1 - FZ0)
    front = U < FU + 0.005
    px = (FX1 - FX0) / (FU * W)                               # metres per texel (~0.00024)
    aa = px * 1.2
    # --- soft cheeks / warm nose tip / lips area
    def g(cx, cz, sx, sz): return np.exp(-(((X - cx) / sx) ** 2 + ((Z - cz) / sz) ** 2))
    blush = np.array([230, 135, 118]) / 255.0
    _over(img, blush, 0.13 * (g(0.045, 1.643, 0.012, 0.008) + g(-0.045, 1.643, 0.012, 0.008)) * front)
    _over(img, blush, 0.12 * g(0, 1.642, 0.008, 0.007) * front)
    # subtle temple/jaw shading towards the sides (adds form to the flat paint)
    # --- eyes
    lash = np.array([38, 24, 20]) / 255.0
    for k in (1, -1):
        lx = X * k - EYE_X; lz = Z - EYE_Z
        xi, xo = -0.0150, 0.0148
        t = np.clip((lx - xi) / (xo - xi), 0, 1)
        inside_x = (lx > xi) & (lx < xo)
        # lid curves (z offsets); outer corner a touch higher -> alert, friendly
        zu = 0.0079 * np.sin(np.pi * t) ** 0.75 + 0.0012 * t - 0.0003
        zl = -0.0052 * np.sin(np.pi * t) ** 0.9 + 0.0010 * t
        du = zu - lz; dl = lz - zl                         # >0 inside
        open_ = _ss(-aa, aa, np.minimum(du, dl)) * inside_x * front
        # sclera (slightly shaded under the upper lid)
        scl = np.array([246, 242, 236]) / 255.0
        _over(img, scl, open_)
        _over(img, np.array([200, 180, 175]) / 255.0, open_ * 0.55 * (1 - _ss(0.0, 0.0030, du)))
        # iris
        ix, iz = -0.0004, 0.0004
        ri = np.sqrt(((lx - ix) / 0.0070) ** 2 + ((lz - iz) / 0.0074) ** 2)
        iris_a = _ss(1.0 + aa / 0.007, 1.0 - aa / 0.007, ri) * open_
        c_out = np.array([28, 52, 78]) / 255.0; c_mid = np.array([52, 112, 150]) / 255.0; c_in = np.array([120, 178, 196]) / 255.0
        col = np.where(ri[..., None] > 0.80, c_out, np.where(ri[..., None] > 0.45, c_mid, c_in))
        col = col * 1.0
        blend = _ss(0.62, 0.90, ri)[..., None]
        icol = c_mid * (1 - blend) + c_out * blend
        icol = icol * (1 - _ss(0.45, 0.20, ri)[..., None]) + c_in * _ss(0.45, 0.20, ri)[..., None]
        img[:] = img * (1 - iris_a[..., None]) + icol * iris_a[..., None]
        # iris shadow from the upper lid
        _over(img, np.array([18, 30, 45]) / 255.0, iris_a * 0.6 * (1 - _ss(0.0, 0.0028, du)))
        # pupil
        rp = np.sqrt(((lx - ix) / 0.0031) ** 2 + ((lz - iz) / 0.0033) ** 2)
        _over(img, np.array([10, 12, 16]) / 255.0, _ss(1.0 + aa / 0.003, 1.0 - aa / 0.003, rp) * open_)
        # highlights (same world side for both eyes)
        hx = X - (EYE_X * k + ix * k + 0.0024); hz = Z - (EYE_Z + iz + 0.0026)
        _over(img, (1, 1, 1), _ss(0.0017 + aa, 0.0017 - aa, np.sqrt(hx * hx + hz * hz)) * open_)
        hx = X - (EYE_X * k + ix * k - 0.0022); hz = Z - (EYE_Z + iz - 0.0024)
        _over(img, (1, 1, 1), 0.8 * _ss(0.0009 + aa, 0.0009 - aa, np.sqrt(hx * hx + hz * hz)) * open_)
        # upper lash line: thick, thicker outward, with a small flick at the outer corner
        th = 0.0011 + 0.0016 * t
        dline = lz - zu
        lash_a = _ss(th + aa, th - aa, np.abs(dline - th * 0.45)) * _ss(xi - 0.0006, xi + 0.0014, lx) * (lx < xo + 0.0002)
        # flick
        fx = (lx - xo) / 0.0038
        fz = zu[...] if False else None
        flick_c = 0.0012 + 0.0024 * np.clip(fx, 0, 1)            # rises outward
        flick_d = np.abs(lz - (0.0009 + flick_c))
        flick_a = _ss(0.0011 * (1 - np.clip(fx, 0, 1)) + aa, 0.0, flick_d) * (fx > -0.05) * (fx < 1.0)
        _over(img, lash, np.maximum(lash_a, flick_a) * front)
        # lower lid: thin soft line, fades inward
        ll = _ss(0.00075 + aa, 0.0, np.abs(lz - zl + 0.0003)) * inside_x * _ss(0.15, 0.6, t)
        _over(img, np.array([150, 95, 80]) / 255.0, 0.55 * ll * front)
        # lid crease
        cz = zu + 0.0042 - 0.0008 * (1 - np.sin(np.pi * t))
        cr = _ss(0.0006 + aa, 0.0, np.abs(lz - cz)) * _ss(0.12, 0.35, t) * (t < 0.95) * inside_x
        _over(img, np.array([190, 130, 105]) / 255.0, 0.45 * cr * front)
        # brows: defined, slightly arched, thick at the inner end
        bxi, bxo = -0.0175, 0.0205
        tb = np.clip((lx - bxi) / (bxo - bxi), 0, 1)
        zb = 0.0235 + 0.0040 * np.sin(np.pi * np.clip(tb * 1.1, 0, 1)) - 0.0012 * tb
        thb = 0.0030 * (1 - tb) + 0.0012
        dbz = lz - zb
        brow_a = _ss(thb + aa, thb - aa, np.abs(dbz)) * _ss(bxi - 0.0008, bxi + 0.0016, lx) * _ss(bxo + 0.0004, bxo - 0.0030, lx)
        _over(img, np.array([62, 38, 24]) / 255.0, 0.95 * brow_a * front)
    # --- mouth: friendly slight smile
    mx = X / 0.0175
    zm = 1.6020 + 0.0021 * mx ** 2 - 0.0003
    inside_m = np.abs(mx) < 1.0
    thm = 0.00095 * (1 - 0.55 * mx ** 2)
    m_a = _ss(thm + aa, np.maximum(thm - aa, 0), np.abs(Z - zm)) * inside_m * _ss(1.0, 0.85, np.abs(mx))
    _over(img, np.array([125, 62, 56]) / 255.0, 0.9 * m_a * front)
    # corners: tiny upturned ticks
    for k in (1, -1):
        cx = X * k - 0.0178; cz = Z - (1.6020 + 0.0021 + 0.0004)
        tick = _ss(0.0007 + aa, 0.0, np.abs(cz - 0.35 * cx)) * (cx > -0.0006) * (cx < 0.0018)
        _over(img, np.array([150, 85, 72]) / 255.0, 0.55 * tick * front)
    # lower lip: soft pink, upper lip barely darker
    _over(img, np.array([214, 128, 112]) / 255.0, 0.30 * g(0, 1.5965, 0.0115, 0.0030) * front)
    _over(img, np.array([200, 120, 104]) / 255.0, 0.16 * g(0, 1.6055, 0.0120, 0.0018) * front)
    # chin / under-lip soft shadow
    _over(img, np.array([210, 155, 125]) / 255.0, 0.14 * g(0, 1.5885, 0.009, 0.0025) * front)
    # --- cylinder strip: skin with a soft darker neck under the jaw
    cyl = U > 0.81
    Zc = CZ0 + Vv * (CZ1 - CZ0)
    shade = 0.80 + 0.20 * _ss(1.50, 1.585, Zc)
    img[cyl] = (SKIN_S * shade[..., None])[cyl]
    return np.clip(img, 0, 1)
