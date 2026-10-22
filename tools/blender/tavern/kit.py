"""Tavern prop kit: textures, materials, reusable parts, export. Real metres, front -Y, up +Z."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/veh_real")
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix
from common2 import (Builder, mat, empty, catmull, frames_up, mesh_tris, make_image, wood_texture, srgb2lin,
                     _MATS)
import common2

V = Vector
REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
PROPS = os.path.join(REPO, "models", "props")
SRC = os.path.join(REPO, "models", "src")
GROUP_SCALE = 0.62          # station group scale in portfolio.js
TO_GROUP = 1.0 / GROUP_SCALE


def reset():
    common2.reset()
    _TEX.clear()
    try:
        bpy.context.preferences.filepaths.save_version = 0
    except Exception:
        pass


# ---------------------------------------------------------------- textures (sRGB float arrays)
_TEX = {}


def _smooth_noise(size, cells, rng):
    g = rng.random((cells + 1, cells + 1))
    g[-1, :] = g[0, :]
    g[:, -1] = g[:, 0]
    x = np.linspace(0, cells, size, endpoint=False)
    i = x.astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    a = g[i][:, i] * (1 - f)[None, :] + g[i][:, (i + 1)] * f[None, :]
    b = g[i + 1][:, i] * (1 - f)[None, :] + g[i + 1][:, (i + 1)] * f[None, :]
    return a * (1 - f)[:, None] + b * f[:, None]


def fbm(size, rng, oct=(4, 8, 16, 32)):
    out = np.zeros((size, size))
    amp = 1.0
    for c in oct:
        out += _smooth_noise(size, c, rng) * amp
        amp *= 0.5
    out -= out.min()
    return out / out.max()


def tex(name):
    if name in _TEX:
        return _TEX[name]
    S = 256
    rng = np.random.default_rng(abs(hash(name)) % 1000)
    if name == 'wood':
        arr = wood_texture(S)
    elif name == 'plaster':
        n = fbm(S, rng)
        l = 0.86 + 0.12 * n - 0.10 * (fbm(S, rng, (32, 64)) > 0.8)
        arr = np.stack([l, l * 0.96, l * 0.88], -1)
    elif name == 'stone':      # irregular coursed stone blocks
        n = fbm(S, rng)
        y = np.arange(S)[:, None] * np.ones((1, S))
        x = np.ones((S, 1)) * np.arange(S)[None, :]
        rows = 5
        rh = S / rows
        r = (y // rh).astype(int)
        off = (r % 2) * 0.5 + rng.random(rows)[r] * 0.3
        bw = S / 3.0
        cx = ((x / bw + off) % 1.0)
        cy = (y % rh) / rh
        mortar = (np.minimum(cx, 1 - cx) * bw < 3) | (np.minimum(cy, 1 - cy) * rh < 3)
        tint = 0.75 + 0.2 * rng.random((rows, 4))[r, ((x / bw + off) % 4).astype(int)]
        l = tint * (0.85 + 0.25 * n)
        l = np.where(mortar, 0.55 + 0.1 * n, l)
        arr = np.stack([l, l * 0.97, l * 0.92], -1)
    elif name == 'thatch':
        cols = rng.random(S)
        streak = np.zeros((S, S))
        for k in range(4):        # overlapping straw layers with random length breaks
            sh = rng.integers(0, S, S)
            yy = (np.arange(S)[:, None] + sh[None, :]) % S
            streak += (cols[(np.arange(S) * (k + 3) + k * 17) % S][None, :] * (yy > S * 0.15)) * 0.25
        n = fbm(S, rng, (8, 16, 64))
        l = 0.42 + 0.5 * streak * (0.75 + 0.25 * n)
        arr = np.stack([l, l * 0.86, l * 0.58], -1)
    elif name == 'canvas':
        u = np.arange(S)
        w = 0.92 + 0.04 * np.sin(u * np.pi / 2)[None, :] + 0.04 * np.sin(u * np.pi / 2)[:, None]
        n = fbm(S, rng)
        l = w * (0.85 + 0.15 * n)
        arr = np.stack([l, l, l], -1)
    elif name == 'stripes':    # awning stripes: white / tinted (tint via material colour on the coloured stripe)
        u = np.arange(S)
        s = ((u // (S // 8)) % 2).astype(float)[None, :] * np.ones((S, 1))
        n = fbm(S, rng)
        l = 0.9 + 0.08 * n
        arr = np.stack([l * (1 - s * 0.25), l * (1 - s * 0.82), l * (1 - s * 0.85)], -1)
    elif name == 'chalk':
        n = fbm(S, rng)
        arr = np.zeros((S, S, 3)) + (0.16 + 0.05 * n)[..., None]
        for row in range(6):
            y0 = 30 + row * 36
            x = 24
            while x < S - 30:
                ln = rng.integers(10, 40)
                h = rng.integers(8, 14) if row else 18
                for xx in range(x, min(x + ln, S - 24)):
                    yy = int(y0 + 3 * math.sin(xx * 0.9 + row)) % S
                    arr[yy - h // 2:yy + h // 2, xx:xx + 2] = 0.8 if rng.random() > 0.35 else 0.5
                x += ln + rng.integers(8, 20)
        arr = np.clip(arr * np.array([1.0, 1.0, 0.98]), 0, 1)
    elif name == 'tiles':      # terracotta roof tile rows
        n = fbm(S, rng)
        v = (np.arange(S) % (S // 6)) / (S // 6)
        shade = (0.75 + 0.25 * v)[:, None] * np.ones((1, S))
        u = (np.arange(S) % (S // 8)) / (S // 8)
        shade *= (0.8 + 0.2 * np.sin(u * np.pi))[None, :]
        var = 0.85 + 0.25 * rng.random((6, 8))[np.minimum(np.arange(S) // (S // 6), 5)[:, None], np.minimum(np.arange(S) // (S // 8), 7)[None, :]]
        l = shade * var * (0.9 + 0.1 * n)
        arr = np.stack([l, l * 0.92, l * 0.85], -1)
    elif name == 'brick':
        n = fbm(S, rng)
        y = np.arange(S)[:, None] * np.ones((1, S))
        x = np.ones((S, 1)) * np.arange(S)[None, :]
        rh = S / 16
        r = (y // rh).astype(int)
        bw = S / 4
        off = (r % 2) * 0.5
        cx = (x / bw + off) % 1.0
        cy = (y % rh) / rh
        mortar = (np.minimum(cx, 1 - cx) * bw < 2.2) | (np.minimum(cy, 1 - cy) * rh < 1.6)
        bid = (r * 7 + ((x / bw + off)).astype(int) * 3) % 11
        tint = 0.78 + 0.03 * bid
        l = tint * (0.85 + 0.2 * n)
        arr = np.stack([l, l * 0.92, l * 0.88], -1)
        arr = np.where(mortar[..., None], np.stack([0.95 + 0 * n, 0.93 + 0 * n, 0.88 + 0 * n], -1) * (0.85 + 0.1 * n)[..., None]
                       , arr)
    elif name == 'azulejo':
        u = (np.arange(S) % 64) / 64.0
        U, Vv = np.meshgrid(u, u)
        d = np.abs(U - 0.5) + np.abs(Vv - 0.5)
        star = (d < 0.28) & (d > 0.18)
        ring = (np.hypot(U - 0.5, Vv - 0.5) < 0.1)
        corner = (np.minimum(np.minimum(U, 1 - U), np.minimum(Vv, 1 - Vv)) < 0.06)
        blue = star | ring | corner
        yel = (d < 0.18) & ~ring
        arr = np.ones((S, S, 3)) * np.array([0.95, 0.93, 0.86])
        arr[blue] = [0.16, 0.30, 0.62]
        arr[yel] = [0.88, 0.66, 0.22]
    elif name == 'cloth':
        n = fbm(S, rng)
        l = 0.85 + 0.15 * n
        arr = np.stack([l, l, l], -1)
    else:
        raise KeyError(name)
    img = make_image("tex_" + name, arr)
    _TEX[name] = img
    return img


# ---------------------------------------------------------------- materials
def M(name):
    """Material palette. Textured materials are tinted via baseColorFactor."""
    P = {
        'wood': ("Wood", "#b27a48", 0.75, 0, 'wood'),
        'wood_dark': ("Wood_Dark", "#6a4428", 0.8, 0, 'wood'),
        'wood_light': ("Wood_Light", "#d2a26c", 0.75, 0, 'wood'),
        'wood_grey': ("Wood_Weathered", "#a08a70", 0.85, 0, 'wood'),
        'wood_black': ("Wood_Tarred", "#3a2a20", 0.7, 0, 'wood'),
        'wood_red': ("Wood_PaintedRed", "#a33a26", 0.7, 0, 'wood'),
        'wood_green': ("Wood_PaintedGreen", "#4f6b48", 0.7, 0, 'wood'),
        'wood_blue': ("Wood_PaintedBlue", "#4d6680", 0.7, 0, 'wood'),
        'shingle': ("Shingle", "#7d6650", 0.9, 0, 'wood'),
        'shingle_dk': ("Shingle_Dark", "#5c4a3a", 0.9, 0, 'wood'),
        'plaster': ("Plaster", "#efe5d0", 0.95, 0, 'plaster'),
        'plaster_ochre': ("Plaster_Ochre", "#e0b878", 0.95, 0, 'plaster'),
        'stone': ("Stone", "#b3aa9a", 0.9, 0, 'stone'),
        'stone_dk': ("Stone_Dark", "#7e786e", 0.9, 0, 'stone'),
        'thatch': ("Thatch", "#d8b070", 1.0, 0, 'thatch'),
        'tiles': ("Roof_Tiles", "#c06a45", 0.85, 0, 'tiles'),
        'canvas': ("Cloth_Canvas", "#e2d6b6", 0.95, 0, 'canvas'),
        'stripes_red': ("Cloth_StripeRed", "#ffffff", 0.95, 0, 'stripes'),
        'cloth_red': ("Cloth_Red", "#8a2a22", 0.95, 0, 'cloth'),
        'cloth_green': ("Cloth_Green", "#3f5a36", 0.95, 0, 'cloth'),
        'cloth_blue': ("Cloth_Blue", "#34506e", 0.95, 0, 'cloth'),
        'cloth_white': ("Cloth_White", "#ede6d6", 0.95, 0, 'cloth'),
        'sack': ("Cloth_Sack", "#a99067", 1.0, 0, 'canvas'),
        'chalk': ("Chalk_Board", "#ffffff", 0.9, 0, 'chalk'),
        'iron': ("Metal_Iron", "#4a4848", 0.45, 0.5, None),
        'brass': ("Metal_Brass", "#c09a52", 0.35, 0.55, None),
        'copper': ("Metal_Copper", "#b8643c", 0.35, 0.55, None),
        'pewter': ("Metal_Pewter", "#9d9c96", 0.35, 0.5, None),
        'clay': ("Ceramic_Stoneware", "#a07a55", 0.5, 0, None),
        'clay_glaze': ("Ceramic_Glazed", "#6b4a2e", 0.25, 0, None),
        'terracotta': ("Terracotta", "#b8623e", 0.8, 0, None),
        'glass_green': ("Glass_Bottle", "#2f5a3a", 0.12, 0, None),
        'rope': ("Rope", "#b79f74", 1.0, 0, None),
        'leather': ("Leather_Dark", "#3a2214", 0.55, 0, None),
        'straw': ("Straw", "#d8b86a", 1.0, 0, None),
        'bread': ("Bread", "#b9773a", 0.8, 0, None),
        'apple': ("Apple", "#9e2a1c", 0.45, 0, None),
        'cheese': ("Cheese", "#e6b94e", 0.6, 0, None),
        'ham': ("Ham", "#9a4a3a", 0.6, 0, None),
        'green': ("Herbs", "#5b7a3a", 0.9, 0, None),
        'sign_face': ("Sign_Face", "#e8d2a8", 0.8, 0, None),
        'candle': ("Candle_Wax", "#efe2c2", 0.6, 0, None),
    }
    if name == 'glow':
        return mat("Lantern_Glow", "#ffc25a", rough=0.25, emit="#ffb347", emit_strength=2.5)
    if name == 'flame':
        return mat("Flame_Glow", "#ffcf70", rough=0.5, emit="#ff9a30", emit_strength=4.0)
    n, h, r, m, t = P[name]
    return mat(n, h, rough=r, metal=m, tex=tex(t) if t else None)


def G(axis):
    return ('grain', {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis], 1.0, 3.0)


def gy(size):
    ax = max(range(3), key=lambda k: size[k])
    return ('grain', [(1, 0, 0), (0, 1, 0), (0, 0, 1)][ax], 1.0, 3.0)


def rot(c, ax, a):
    c = V(c)
    return Matrix.Translation(c) @ Matrix.Rotation(a, 4, ax) @ Matrix.Translation(-c)


# ---------------------------------------------------------------- generic parts
def plank(b, c, size, m, r=0.008, seg=2, Mx=None):
    return b.rbox(c, size, m, r=r, seg=seg, uv=gy(size), M=Mx)


def beam(b, p0, p1, w, h, m, r=0.012, up=(0, 0, 1), seg=2):
    return b.seg_box(p0, p1, w, h, m, r=r, up=up, seg=seg)


def post(b, x, y, z0, z1, w, m, r=0.015):
    plank(b, (x, y, (z0 + z1) / 2), (w, w, z1 - z0), m, r=r)


def round_post(b, x, y, z0, z1, r0, m, n=8, r1=None):
    r1 = r1 or r0 * 0.9
    b.lathe([(z0, r0), (z1, r1)], m, n=n, axis='Z', c=(x, y, 0), uv=G('z'))


def prism(b, poly, z0, z1, m, uv=None, Mx=None):
    n = len(poly)
    verts = [V((x, y, z0)) for x, y in poly] + [V((x, y, z1)) for x, y in poly]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return b.add(verts, faces, m, uv=uv, M=Mx)


def cask(b, c, length, r, m_wood, m_iron, axis='Z', hoops=4, n=16, bulge=0.12, Mx=None, lid=True):
    """Barrel centred at c (along axis). bulge = extra radius at the middle (fraction)."""
    prof = []
    k = 8
    for i in range(k + 1):
        t = i / k
        rr = r * (1 + bulge * math.sin(math.pi * t))
        prof.append((-length / 2 + length * t, rr))
    # chime: lip at ends, recessed head
    full = [(-length / 2 + 0.012, r * 0.86)] + [(-length / 2, r * 0.9)] + prof + [(length / 2, r * 0.9),
                                                                              (length / 2 - 0.012, r * 0.86)]
    b.lathe(full, m_wood, n=n, axis=axis, c=c, uv=G({'X': 'x', 'Y': 'y', 'Z': 'z'}[axis]), M=Mx, cap0=lid, cap1=lid)
    pos = [0.08, 0.30, 0.70, 0.92][:hoops] if hoops == 4 else [0.1, 0.9]
    for t in pos:
        a = -length / 2 + length * t
        rr = r * (1 + bulge * math.sin(math.pi * t)) + 0.004
        w = 0.018
        b.lathe([(a - w, rr), (a - w * 0.6, rr + 0.004), (a + w * 0.6, rr + 0.004), (a + w, rr)], m_iron, n=n,
                axis=axis, c=c, M=Mx, cap0=False, cap1=False)


def tankard(b, c, m_body, m_band, h=0.15, r=0.048, pewter=False):
    c = V(c)
    b.lathe([(0, r * 1.05), (0.006, r * 1.06), (h, r * 0.95), (h, r * 0.85), (0.012, r * 0.85)], m_body, n=12, axis='Z',
            c=c, cap1=False, uv=G('z'))
    if not pewter:
        for z in (0.025, h - 0.025):
            b.lathe([(z - 0.008, r * 1.05 + 0.002), (z + 0.008, r * 1.0 + 0.002)], m_band, n=12, axis='Z', c=c,
                    cap0=False, cap1=False)
    pts = [c + V((r * 0.9, 0, h * 0.85)), c + V((r * 1.7, 0, h * 0.8)), c + V((r * 1.8, 0, h * 0.45)),
           c + V((r * 1.6, 0, h * 0.2)), c + V((r * 0.95, 0, h * 0.18))]
    b.sweep(pts, 0.009, m_body if pewter else m_band, n=5, sub=2)


def jug(b, c, m, h=0.30, r=0.10):
    c = V(c)
    prof = [(0, r * 0.7), (0.01, r * 0.8), (h * 0.35, r), (h * 0.65, r * 0.8), (h * 0.85, r * 0.45), (h * 0.95, r * 0.5),
            (h, r * 0.52), (h, r * 0.44), (h * 0.9, r * 0.4)]
    b.lathe(prof, m, n=14, axis='Z', c=c, cap1=False)
    pts = [c + V((r * 0.48, 0, h * 0.9)), c + V((r * 1.2, 0, h * 0.85)), c + V((r * 1.35, 0, h * 0.55)),
           c + V((r * 0.95, 0, h * 0.35))]
    b.sweep(pts, 0.012, m, n=6, sub=2)


def bottle(b, c, m, h=0.28, r=0.04):
    c = V(c)
    b.lathe([(0, r * 0.9), (0.01, r), (h * 0.6, r), (h * 0.75, r * 0.45), (h * 0.95, r * 0.3), (h, r * 0.33), (h, 0.0)],
            m, n=10, axis='Z', c=c)


def goblet(b, c, m, h=0.14):
    c = V(c)
    b.lathe([(0, 0.035), (0.008, 0.035), (0.012, 0.008), (h * 0.55, 0.007), (h * 0.62, 0.03), (h, 0.042),
             (h, 0.038), (h * 0.7, 0.02)], m, n=10, axis='Z', c=c, cap1=False)


def crate(b, c, size, m, m2, yaw=0.0):
    Mx = rot(c, 'Z', yaw)
    sx, sy, sz = size
    c = V(c)
    plank(b, c, (sx - 0.03, sy - 0.03, sz - 0.03), m, r=0.008, seg=1, Mx=Mx)
    for dz in (-sz / 2 + 0.03, sz / 2 - 0.03):
        plank(b, c + V((0, 0, dz)), (sx, sy, 0.05), m2, r=0.006, seg=1, Mx=Mx)
    for dx in (-1, 1):
        plank(b, c + V((dx * (sx / 2 - 0.025), 0, 0)), (0.05, sy + 0.004, sz), m2, r=0.006, seg=1, Mx=Mx)


def sack(b, c, m, m_rope, yaw=0.0, lie=False, s=1.0):
    c = V(c)
    Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z')
    if lie:
        Mx = Mx @ Matrix.Rotation(math.pi / 2, 4, 'X')
    Mx = Mx @ Matrix.Scale(s, 4)
    if lie:
        prof = [(-0.24, 0.0), (-0.22, 0.12), (-0.12, 0.165), (0.05, 0.17), (0.17, 0.13), (0.22, 0.06), (0.25, 0.035),
                (0.30, 0.05), (0.31, 0.0)]
        b.lathe(prof, m, n=12, axis='Z', M=Mx, ellipse=(1.0, 0.62))
    else:
        prof = [(0.0, 0.0), (0.0, 0.15), (0.05, 0.19), (0.25, 0.19), (0.40, 0.14), (0.47, 0.06), (0.50, 0.035),
                (0.56, 0.06), (0.57, 0.0)]
        b.lathe(prof, m, n=12, axis='Z', M=Mx, ellipse=(1.0, 0.8))
    b.torus((0, 0, 0.25 if lie else 0.50), 0.04, 0.009, m_rope, nu=10, nv=4, axis='Z', M=Mx)


def chain(b, p0, p1, m, links=None, r=0.012):
    p0, p1 = V(p0), V(p1)
    L = (p1 - p0).length
    n = links or max(2, int(L / 0.035))
    d = (p1 - p0).normalized()
    for i in range(n):
        c = p0 + d * (L * (i + 0.5) / n)
        ax = 'Y' if i % 2 else 'X'
        b.torus(c, r, 0.0035, m, nu=6, nv=3, axis=ax, ellipse=(1.0, 1.0),
                M=None)


def lantern(b, top, m_iron, m_glow, style='box', s=1.0, hang=0.0):
    """Hanging lantern; `top` = hook point. Returns glass centre."""
    top = V(top)
    if hang > 0:
        b.sweep([top, top - V((0, 0, hang))], 0.004, m_iron, n=4)
    c = top - V((0, 0, hang + 0.20 * s))
    b.torus(c + V((0, 0, 0.17 * s)), 0.022 * s, 0.004, m_iron, nu=10, nv=4, axis='Y')
    if style == 'box':
        b.lathe([(0.10 * s, 0.0), (0.10 * s, 0.012 * s), (0.125 * s, 0.03 * s), (0.135 * s, 0.075 * s),
                 (0.145 * s, 0.075 * s)], m_iron, n=4, axis='Z', c=c, cap0=False, phase=math.pi / 4)
        b.lathe([(-0.10 * s, 0.075 * s), (-0.085 * s, 0.08 * s), (-0.075 * s, 0.075 * s), (-0.075 * s, 0.06 * s)],
                m_iron, n=4, axis='Z', c=c, phase=math.pi / 4)
        b.lathe([(-0.075 * s, 0.056 * s), (0.10 * s, 0.056 * s)], m_glow, n=4, axis='Z', c=c, phase=math.pi / 4)
        for k in range(4):
            a = k * math.pi / 2
            o = V((math.cos(a) * 0.075 * s, math.sin(a) * 0.075 * s, 0))
            b.sweep([c + o + V((0, 0, -0.075 * s)), c + o + V((0, 0, 0.10 * s))], 0.006 * s, m_iron, n=4)
    else:    # round lantern
        b.lathe([(0.06 * s, 0.0), (0.06 * s, 0.03 * s), (0.10 * s, 0.07 * s), (0.11 * s, 0.075 * s)], m_iron, n=10,
                axis='Z', c=c, cap0=False)
        b.lathe([(-0.09 * s, 0.07 * s), (-0.085 * s, 0.075 * s), (-0.07 * s, 0.06 * s)], m_iron, n=10, axis='Z', c=c)
        b.lathe([(-0.075 * s, 0.045 * s), (-0.02 * s, 0.07 * s), (0.03 * s, 0.07 * s), (0.065 * s, 0.05 * s)], m_glow,
                n=10, axis='Z', c=c)
        for k in range(6):
            a = k * math.pi / 3
            pts = [c + V((math.cos(a) * r_ * s, math.sin(a) * r_ * s, z * s)) for z, r_ in
                   ((-0.075, 0.05), (-0.02, 0.074), (0.03, 0.074), (0.065, 0.055))]
            b.sweep(pts, 0.004 * s, m_iron, n=3)
    return c


def menu_board(b, c, yaw, m_frame, m_chalk, s=1.0):
    """A-frame chalk menu board standing on the ground at c."""
    c = V(c)
    Mx = rot(c, 'Z', yaw)
    w, h = 0.50 * s, 0.80 * s
    for side in (-1, 1):
        tilt = 0.18 * side
        Mt = Mx @ rot(c + V((0, 0, 0.0)), 'X', tilt)
        ctr = c + V((0, side * 0.0, h / 2 + 0.03))
        for dx in (-1, 1):
            plank(b, ctr + V((dx * (w / 2 - 0.02), 0, 0)), (0.04, 0.03, h + 0.06), m_frame, r=0.006, seg=1, Mx=Mt)
        for dz in (-1, 1):
            plank(b, ctr + V((0, 0, dz * (h / 2 - 0.02))), (w, 0.03, 0.04), m_frame, r=0.006, seg=1, Mx=Mt)
        # chalk face (UV 0..1 so the code could redraw it)
        f = 1 if side < 0 else -1
        y = ctr.y - f * 0.016 * 0 + (-0.017 if side < 0 else 0.017)
        verts = [V((ctr.x - w / 2 + 0.04, y, ctr.z - h / 2 + 0.04)), V((ctr.x + w / 2 - 0.04, y, ctr.z - h / 2 + 0.04)),
                 V((ctr.x + w / 2 - 0.04, y, ctr.z + h / 2 - 0.04)), V((ctr.x - w / 2 + 0.04, y, ctr.z + h / 2 - 0.04))]
        bv, bf = b.add(verts, [(0, 1, 2, 3)], m_chalk, M=Mt)
        for face in bf:
            for l, uv in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                l[b.uvl].uv = uv


def sign_face_object(name, center, w, h, normal_y=-1, parent=None, yaw=0.0, collection=None):
    """Separate quad named `name` with material Sign_Face, UV 0..1 (front facing -Y)."""
    sb = Builder()
    c = V(center)
    y = 0.0
    verts = [V((-w / 2, y, -h / 2)), V((w / 2, y, -h / 2)), V((w / 2, y, h / 2)), V((-w / 2, y, h / 2))]
    if normal_y > 0:
        verts = [V((-v.x, v.y, v.z)) for v in verts]
    Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z')
    bv, bf = sb.add(verts, [(0, 1, 2, 3)], M('sign_face'), M=Mx)
    for face in bf:
        face.normal_update()
        for l, uv in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            l[sb.uvl].uv = uv if normal_y < 0 else (1 - uv[0], uv[1])
    ob = sb.to_object(name, origin=c)
    return ob


def hanging_sign(b, anchor, w, h, m_board, m_iron, style='plain', drop=0.12):
    """Board hanging on two chains below anchor (centre of the bar). Returns face centre (front)."""
    a = V(anchor)
    top = a.z - drop
    for dx in (-w * 0.38, w * 0.38):
        chain(b, a + V((dx, 0, 0)), V((a.x + dx, a.y, top + 0.01)), m_iron)
    c = V((a.x, a.y, top - h / 2))
    if style == 'shield':
        # carved board: rounded bottom
        poly = []
        for i in range(9):
            t = i / 8
            poly.append((-w / 2 + w * t, h / 2))
        for i in range(13):
            ang = math.pi * i / 12
            poly.append((math.cos(ang) * w / 2 * 1.0, -h / 2 + h * 0.35 - math.sin(ang) * h * 0.4))
        poly = [poly[0]] + poly[8:9] + poly[9:]
        pts = [(x, z) for x, z in poly]
        prism(b, pts, -0.025, 0.025, m_board, uv=G('x'),
              Mx=Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    else:
        b.rbox(c, (w, 0.05, h), m_board, r=0.02, seg=2, uv=G('x'))
    b.rbox(V((a.x, a.y, a.z)), (w * 0.95, 0.03, 0.03), m_iron, r=0.008, seg=1)
    return c + V((0, -0.027, 0))


# ---------------------------------------------------------------- roofs
def roof_shingles(b, x0, x1, eave, ridge, mats, sw=0.24, sl=0.30, t=0.022, seed=1, under=None, T=None, rr=0.0):
    """Shingle slope. eave/ridge = (y, z). Rows from eave to ridge, staggered. `under`: sarking material."""
    rnd = random.Random(seed)
    e, r = V((0, eave[0], eave[1])), V((0, ridge[0], ridge[1]))
    d = r - e
    L = d.length
    dn = d.normalized()
    nrm = V((0, -dn.z, dn.y)) if dn.y < 0 else V((0, dn.z, -dn.y))
    if nrm.z < 0:
        nrm = -nrm
    if under is not None:
        mid = (e + r) / 2 - nrm * 0.03
        Mx = Matrix((V((1, 0, 0)), dn, nrm)).transposed().to_4x4()
        Mx.translation = V((((x0 + x1) / 2), mid.y, mid.z))
        b.rbox((0, 0, 0), (x1 - x0, L + 0.04, 0.03), under, r=0.006, seg=1, M=(T @ Mx) if T else Mx, uv=G('x'))
    rows = int(L / (sl * 0.55)) + 1
    for i in range(rows):
        s0 = min(L - sl * 0.5, i * sl * 0.55)
        n = int((x1 - x0) / sw) + 1
        off = (i % 2) * 0.5
        for j in range(-1, n):
            xa = x0 + (j + off) * sw
            xb = xa + sw * rnd.uniform(0.85, 0.98)
            xa, xb = max(xa, x0), min(xb, x1)
            if xb - xa < 0.04:
                continue
            ctr = e + dn * (s0 + sl / 2) + nrm * (t / 2 + 0.006 * (i % 2))
            Mx = Matrix((V((1, 0, 0)), dn, nrm)).transposed().to_4x4()
            Mx = Matrix.Translation(V(((xa + xb) / 2, ctr.y, ctr.z))) @ Mx @ Matrix.Rotation(rnd.uniform(-0.03, 0.03), 4, 'Z') \
                @ Matrix.Rotation(-0.06, 4, 'X')
            b.rbox((0, 0, 0), (xb - xa, sl, t), mats[rnd.randrange(len(mats))], r=rr, seg=1, M=(T @ Mx) if T else Mx,
                   uv=('grain', dn, 1.0, 3.0))


def roof_slab(b, x0, x1, eave, ridge, m, thick=0.25, nx=24, ny=8, lump=0.03, seed=2, tile_wave=0.0, tile_w=0.2,
              overhang_round=True, T=None, uscale=1.2, deform=None):
    """Thick roof slab between eave and ridge lines (thatch or wavy tiles). UV along slope."""
    rnd = random.Random(seed)
    e, r = V((0, eave[0], eave[1])), V((0, ridge[0], ridge[1]))
    d = r - e
    L = d.length
    dn = d.normalized()
    nrm = V((0, -dn.z, dn.y))
    if nrm.z < 0:
        nrm = -nrm
    if tile_wave:
        nx = int((x1 - x0) / tile_w * 4)
    top, bot = [], []
    noise = [[rnd.uniform(-1, 1) for _ in range(nx + 1)] for _ in range(ny + 1)]
    for i in range(ny + 1):
        s = L * i / ny
        rt, rb = [], []
        for j in range(nx + 1):
            x = x0 + (x1 - x0) * j / nx
            p = e + dn * s + V((x, 0, 0))
            hgt = thick
            if lump:
                hgt += lump * noise[i][j]
                if i == 0 and overhang_round:
                    hgt *= 0.55
            if tile_wave:
                hgt = thick + tile_wave * abs(math.sin(math.pi * (x - x0) / tile_w))
                if i % 2 == 0 and i:
                    hgt += 0.0
            rt.append(p + nrm * hgt)
            rb.append(p)
        top.append(rt)
        bot.append(rb)
    verts, faces = [], []
    W = nx + 1
    for g in (top, bot):
        for row in g:
            verts.extend(row)
    nT = (ny + 1) * W
    for i in range(ny):
        for j in range(nx):
            a = i * W + j
            faces.append((a, a + 1, a + W + 1, a + W))
            faces.append((nT + a, nT + a + W, nT + a + W + 1, nT + a + 1))
    border = [(0, j) for j in range(nx)] + [(i, nx) for i in range(ny)] + \
             [(ny, j) for j in range(nx, 0, -1)] + [(i, 0) for i in range(ny, 0, -1)]
    for k in range(len(border)):
        i0, j0 = border[k]
        i1, j1 = border[(k + 1) % len(border)]
        a, c = i0 * W + j0, i1 * W + j1
        faces.append((a, c, nT + c, nT + a))
    orig = [V(v) for v in verts]
    vt = [V(v) for v in verts]
    if deform:
        vt = [deform(v) for v in vt]
    if T is not None:
        vt = [T @ v for v in vt]
    bv, bf = b.add(vt, faces, m)
    idx = {v: i for i, v in enumerate(bv)}
    # UV: u along x, v along slope (computed in the untransformed frame)
    for f in bf:
        for l in f.loops:
            co = orig[idx[l.vert]]
            l[b.uvl].uv = ((co.x - x0) / (tile_w * 8 if tile_wave else uscale), (co - e).dot(dn) / (L / 2 if not tile_wave
                                                                                                  else tile_w * 6))
    return top


def ridge_cap(b, x0, x1, y, z, m, r=0.07, n=8, ellipse=(1.0, 0.7)):
    b.sweep([V((x0, y, z)), V((x1, y, z))], r, m, n=n, ellipse=ellipse, up=(0, 0, 1))


def half_timber_panel(b, x0, x1, z0, z1, y, m_timber, m_plaster, pattern='cross', tw=0.12, td=0.10, depth=0.06,
                      face=-1):
    """Wall panel in plane y (normal -Y if face=-1) with plaster infill and timber frame."""
    yy = y
    plank(b, ((x0 + x1) / 2, yy - face * depth / 2, (z0 + z1) / 2), (x1 - x0, depth, z1 - z0), m_plaster, r=0.0,
          seg=0)
    ft = yy + face * (td / 2 - depth / 2 + 0.005)
    plank(b, ((x0 + x1) / 2, ft, z0 + tw / 2), (x1 - x0, td, tw), m_timber, r=0.012)
    plank(b, ((x0 + x1) / 2, ft, z1 - tw / 2), (x1 - x0, td, tw), m_timber, r=0.012)
    for x in (x0 + tw / 2, x1 - tw / 2):
        plank(b, (x, ft, (z0 + z1) / 2), (tw, td, z1 - z0), m_timber, r=0.012)
    xm = (x0 + x1) / 2
    if pattern in ('cross', 'man'):
        beam(b, (x0 + tw, ft, z0 + tw), (x1 - tw, ft, z1 - tw), tw * 0.85, td * 0.9, m_timber, up=(0, 1, 0))
        beam(b, (x1 - tw, ft, z0 + tw), (x0 + tw, ft, z1 - tw), tw * 0.85, td * 0.9, m_timber, up=(0, 1, 0))
    if pattern in ('man', 'post'):
        plank(b, (xm, ft, (z0 + z1) / 2), (tw, td, z1 - z0), m_timber, r=0.012)
    if pattern == 'diag':
        beam(b, (x0 + tw, ft, z0 + tw), (x1 - tw, ft, z1 - tw), tw * 0.85, td * 0.9, m_timber, up=(0, 1, 0))
    if pattern == 'rail':
        plank(b, ((x0 + x1) / 2, ft, (z0 + z1) / 2), (x1 - x0, td, tw * 0.9), m_timber, r=0.012)


# ---------------------------------------------------------------- counters
def counter(b, x0, x1, y_front, depth, top_z, m_body, m_top, m_trim=None, boards='v', front_overhang=0.06):
    """Serving counter; front face at y_front, extends toward +Y by depth."""
    yc = y_front + depth / 2
    h = top_z - 0.10
    if boards == 'v':
        n = max(2, int((x1 - x0) / 0.15))
        w = (x1 - x0) / n
        for i in range(n):
            plank(b, (x0 + w * (i + 0.5), y_front + 0.02, h / 2 + 0.02), (w - 0.006, 0.035, h), m_body, r=0.006, seg=1)
    elif boards == 'h':
        n = max(2, int(h / 0.16))
        hh = h / n
        for i in range(n):
            plank(b, ((x0 + x1) / 2, y_front + 0.02, 0.02 + hh * (i + 0.5)), (x1 - x0, 0.035, hh - 0.006), m_body,
                  r=0.006, seg=1)
    plank(b, ((x0 + x1) / 2, yc, h / 2 + 0.02), (x1 - x0 - 0.04, depth - 0.06, h), m_body, r=0.01, seg=1)
    for x in (x0 + 0.04, x1 - 0.04):
        plank(b, (x, y_front + 0.025, h / 2 + 0.02), (0.09, 0.07, h + 0.02), m_trim or m_top, r=0.012)
    plank(b, ((x0 + x1) / 2, y_front + 0.04, 0.06), (x1 - x0, 0.07, 0.09), m_trim or m_top, r=0.01)
    # top slab: two thick planks
    for k in range(2):
        plank(b, ((x0 + x1) / 2 + 0.0, y_front - front_overhang + (depth + front_overhang) * (0.25 + 0.5 * k),
                  top_z - 0.045), (x1 - x0 + 0.08, (depth + front_overhang) / 2 - 0.004, 0.09), m_top, r=0.014)


def tap_barrel(b, c, m_wood, m_iron, m_brass, length=0.55, r=0.21):
    """Barrel lying along Y on a cradle; c = barrel centre. Spigot at the -Y end."""
    c = V(c)
    cask(b, c, length, r, m_wood, m_iron, axis='Y')
    for dy in (-length * 0.3, length * 0.3):
        plank(b, c + V((0, dy, -r - 0.02)), (r * 1.7, 0.07, 0.10), m_wood, r=0.012)
        for sx in (-1, 1):
            plank(b, c + V((sx * r * 0.72, dy, -r * 0.62)), (0.07, 0.07, 0.14), m_wood, r=0.012,
                  Mx=rot(c + V((sx * r * 0.72, dy, -r * 0.62)), 'Y', -sx * 0.6))
    sp = c + V((0, -length / 2, -r * 0.45))
    b.lathe([(0, 0.022), (-0.05, 0.018), (-0.06, 0.02)], m_brass, n=10, axis='Y', c=sp, cap0=False)
    b.sweep([sp + V((0, -0.06, 0)), sp + V((0, -0.075, -0.05))], 0.012, m_brass, n=8)
    b.sweep([sp + V((0, -0.035, 0.02)), sp + V((0, -0.035, 0.09))], 0.007, m_brass, n=6)
    b.ellipsoid(sp + V((0, -0.035, 0.095)), (0.016, 0.016, 0.016), m_brass, 8, 5)


def cask_stack(b, c, r, length, m_wood, m_iron, axis='Y', n_bottom=2):
    c = V(c)
    xs = [(-(n_bottom - 1) / 2 + i) * (2 * r * 1.12 + 0.01) for i in range(n_bottom)]
    for x in xs:
        cask(b, c + V((x, 0, r * 1.12)), length, r, m_wood, m_iron, axis=axis)
    for i in range(n_bottom - 1):
        x = (xs[i] + xs[i + 1]) / 2
        cask(b, c + V((x, 0, r * 1.12 * 2.7)), length, r, m_wood, m_iron, axis=axis)
    for x in (xs[0] - r * 1.1, xs[-1] + r * 1.1):
        b.rbox(c + V((x, 0, 0.04)), (0.06, length * 0.8, 0.08), m_wood, r=0.01, seg=1)


# ---------------------------------------------------------------- export
def finish_object(ob, scale):
    if scale != 1.0:
        ob.data.transform(Matrix.Scale(scale, 4))
        ob.location = ob.location * scale


def export_prop(name, scale=1.0):
    os.makedirs(PROPS, exist_ok=True)
    for ob in bpy.data.objects:
        if ob.parent is None:
            if ob.type == 'MESH':
                finish_object(ob, scale)
            else:
                ob.location = ob.location * scale
        else:
            if ob.type == 'MESH':
                ob.data.transform(Matrix.Scale(scale, 4))
            ob.location = ob.location * scale
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, name + ".blend"))
    path = os.path.join(PROPS, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False, export_animations=False,
        export_image_format='JPEG', export_jpeg_quality=80, export_vertex_color='MATERIAL',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    tot = sum(mesh_tris(o) for o in bpy.data.objects if o.type == 'MESH')
    print("EXPORTED", path, os.path.getsize(path), "tris", tot)


def cyl_uv(b, faces, center, ku=1.0, kv=1.0, axis='Z'):
    """Cylindrical UV: u = angle * ku / 2pi, v = height * kv."""
    c = V(center)
    for f in faces:
        us = []
        for l in f.loops:
            d = l.vert.co - c
            a = math.atan2(d.y, d.x) / (2 * math.pi)
            us.append(a)
        # fix seam
        if max(us) - min(us) > 0.5:
            us = [u + 1 if u < 0 else u for u in us]
        for l, u in zip(f.loops, us):
            l[b.uvl].uv = (u * ku, (l.vert.co.z - c.z) * kv)


def wall_arches(b, x0, x1, y, thick, H, arches, m, step=0.06, z0=0.0, uvs=1.0):
    """Solid wall x0..x1 in plane y (thickness toward +Y), height H, with round-headed arch openings.
    arches: list of (xc, width, spring_height). Built from vertical slices (height field)."""
    xs = [x0]
    marks = sorted({x0, x1} | {a[0] - a[1] / 2 for a in arches} | {a[0] + a[1] / 2 for a in arches})
    for i in range(len(marks) - 1):
        a, c = marks[i], marks[i + 1]
        n = max(1, int((c - a) / step))
        for k in range(1, n + 1):
            xs.append(a + (c - a) * k / n)

    def zb(x):
        for xc, w, hs in arches:
            r = w / 2
            if xc - r - 1e-6 <= x <= xc + r + 1e-6:
                return z0 + hs + math.sqrt(max(0.0, r * r - (x - xc) ** 2))
        return z0

    def solid(x0_, x1_):
        for xc, w, hs in arches:
            if xc - w / 2 - 1e-6 <= x0_ and x1_ <= xc + w / 2 + 1e-6:
                return True
        return False
    verts, faces = [], []
    for x in xs:
        zbot = zb(x)
        for yy in (y, y + thick):
            verts.append(V((x, yy, zbot)))
            verts.append(V((x, yy, H)))
    # per slice: 4 verts: (front bottom, front top, back bottom, back top)
    for i in range(len(xs) - 1):
        a, c = i * 4, (i + 1) * 4
        faces.append((a + 0, c + 0, c + 1, a + 1))       # front
        faces.append((a + 2, a + 3, c + 3, c + 2))       # back
        faces.append((a + 1, c + 1, c + 3, a + 3))       # top
        faces.append((a + 0, a + 2, c + 2, c + 0))       # bottom / intrados
    n = len(xs) - 1
    faces.append((0, 1, 3, 2))
    faces.append((n * 4 + 0, n * 4 + 2, n * 4 + 3, n * 4 + 1))
    bv, bf = b.add(verts, faces, m)
    for f in bf:
        nrm = f.normal
        for l in f.loops:
            co = l.vert.co
            if abs(nrm.y) > 0.5:
                l[b.uvl].uv = (co.x * uvs, co.z * uvs)
            elif abs(nrm.x) > 0.5:
                l[b.uvl].uv = (co.y * uvs, co.z * uvs)
            else:
                l[b.uvl].uv = (co.x * uvs, co.y * uvs)
    return bv, bf


def leaf_cluster(b, c, r, mats, n=10, seed=1, flat=0.35, size=0.06, card=True):
    """Cluster of leaves. card=True: cheap cupped diamond cards (4 tris each, double-sided material)."""
    rnd = random.Random(seed)
    c = V(c)
    for i in range(n):
        p = c + V((rnd.uniform(-r, r), rnd.uniform(-r, r) * 0.6, rnd.uniform(-r, r) * 0.8))
        Mx = Matrix.Translation(p) @ Matrix.Rotation(rnd.uniform(0, 6.28), 4, 'Z') @ \
            Matrix.Rotation(rnd.uniform(-0.9, 0.9), 4, 'X') @ Matrix.Rotation(rnd.uniform(-0.5, 0.5), 4, 'Y')
        s = size * rnd.uniform(0.7, 1.3)
        m = mats[rnd.randrange(len(mats))]
        if card:
            verts = [V((0, -s * 1.2, 0)), V((s * 0.75, 0, s * 0.12)), V((0, s * 1.2, s * 0.05)), V((-s * 0.75, 0, s * 0.12)),
                     V((0, 0, -s * 0.12 * flat * 3))]
            b.add(verts, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], m, M=Mx)
        else:
            b.ellipsoid((0, 0, 0), (s, s * 0.7, s * flat), m, 6, 4, M=Mx)


def grass_tufts(b, pts, seed=1, n=6, h=0.18):
    rnd = random.Random(seed)
    G1 = mat("Grass", "#6b7a3a", rough=0.95)
    G2 = mat("Grass_Dry", "#9a8a4a", rough=0.95)
    for p in pts:
        p = V(p)
        for i in range(n):
            a = rnd.uniform(0, 6.28)
            q = p + V((math.cos(a) * rnd.uniform(0, 0.12), math.sin(a) * rnd.uniform(0, 0.12), 0))
            tip = q + V((math.cos(a) * 0.06, math.sin(a) * 0.06, h * rnd.uniform(0.6, 1.2)))
            w = V((-math.sin(a), math.cos(a), 0)) * 0.025
            b.add([q - w, q + w, tip], [(0, 1, 2)], G1 if rnd.random() > 0.35 else G2)


def masonry(b, c, size, m, r=0.02, scale=1.0, Mx=None):
    """Box with world-scaled box UVs (brick / stone / stucco don't stretch)."""
    return b.rbox(c, size, m, r=r, seg=2, uv=('box', scale), M=Mx)


def flame(b, c, s, m_flame):
    c = V(c)
    b.lathe([(0, 0.0), (0.0, 0.06 * s), (0.08 * s, 0.07 * s), (0.18 * s, 0.04 * s), (0.30 * s, 0.0)], m_flame, n=8,
            axis='Z', c=c)
    b.lathe([(0.02 * s, 0.0), (0.02 * s, 0.035 * s), (0.12 * s, 0.035 * s), (0.36 * s, 0.0)], m_flame, n=6, axis='Z',
            c=c + V((0.03 * s, 0.01 * s, 0)))
