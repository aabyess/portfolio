"""Atlas texturing for the v3 vehicles.

Pipeline per bake group (a set of mesh objects sharing one atlas):
 1. UV 'atlas' (multi-object smart project + average scale + pack).
 2. Cycles bakes a small G-buffer through emission (object position, object normal, grain-UV + material id,
    bevel edge masks + world z) and ambient occlusion.
 3. numpy 'shaders' per material kind compute albedo / roughness / metallic / height for every texel
    (wood grain, rust, chrome smudges, leather stitching, tyre tread, coat ...).
 4. Height -> tangent-space normal map (derivatives in texel space, scaled by texel world size).
 5. Final textures: <name>_base (sRGB, AO multiplied in softly), <name>_nrm, <name>_orm (AO, rough, metal).
    Each object's materials are replaced by one atlas material (emissive / special materials are kept).
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

V = Vector
KEEP = {'Lantern_Glow', 'Lamp_Glass', 'Lamp_Red', 'Horse_Hair'}


# ======================================================================= noise (numpy)
def _hash(ix, iy, iz, seed):
    h = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (iz.astype(np.int64) * 83492791) ^ (seed * 2654435761)
    h = h & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF).astype(np.float64) / float(0xFFFFFF)


def vnoise(P, seed=0):
    """Value noise in [0,1]. P: (N,3) already scaled."""
    P = np.asarray(P, dtype=np.float64)
    i = np.floor(P)
    f = P - i
    f = f * f * (3 - 2 * f)
    i = i.astype(np.int64)
    out = 0.0
    for dx in (0, 1):
        wx = f[:, 0] if dx else 1 - f[:, 0]
        for dy in (0, 1):
            wy = f[:, 1] if dy else 1 - f[:, 1]
            for dz in (0, 1):
                wz = f[:, 2] if dz else 1 - f[:, 2]
                out = out + wx * wy * wz * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(P, freq=1.0, oct=4, seed=0, gain=0.5, scale=(1, 1, 1)):
    P = np.asarray(P, dtype=np.float64) * np.array(scale)
    s, a, tot = 0.0, 1.0, 0.0
    for o in range(oct):
        s = s + a * vnoise(P * freq * (2.03 ** o) + o * 17.13, seed + o * 31)
        tot += a
        a *= gain
    return s / tot


def voronoi(P, seed=0):
    """F1 distance and cell random value. P scaled."""
    P = np.asarray(P, dtype=np.float64)
    i = np.floor(P).astype(np.int64)
    best = np.full(len(P), 9.0)
    cid = np.zeros(len(P))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx, cy, cz = i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz
                fp = np.stack([cx + _hash(cx, cy, cz, seed), cy + _hash(cx, cy, cz, seed + 1),
                               cz + _hash(cx, cy, cz, seed + 2)], 1)
                d = np.linalg.norm(fp - P, axis=1)
                m = d < best
                best = np.where(m, d, best)
                cid = np.where(m, _hash(cx, cy, cz, seed + 3), cid)
    return best, cid


def sst(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lin(hexcol):
    h = hexcol.lstrip('#')
    s = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def mixc(a, b, t):
    t = np.asarray(t)[:, None] if np.ndim(t) == 1 else t
    return a * (1 - t) + b * t


# ======================================================================= material kinds
def kind_of(mname):
    n = mname
    if n in KEEP:
        return None
    table = [('Horse_Coat', 'coat'), ('Horse_Mane', 'hair'), ('Horse_Hoof', 'hoof'), ('Horse_Eye', 'eye'),
             ('Horse_Nostril', 'nostril'), ('Leather', 'leather'), ('Cloth_Canvas', 'canvas'), ('Cloth_Sack', 'sack'),
             ('Cloth', 'cloth'), ('Metal_Brass', 'brass'), ('Metal_Iron', 'iron'), ('Metal_Dark', 'iron_dark'),
             ('Metal_Chrome', 'chrome'), ('Metal_Spoke', 'chrome'), ('Metal_Chain', 'iron_dark'), ('Ceramic', 'plain'), ('Fuel_Line', 'rubber'), ('Metal_Engine', 'alu'), ('Wood', 'wood'), ('Rope', 'rope'),
             ('Rubber_Tyre', 'tyre'), ('Rubber', 'rubber'), ('Paint', 'paint'), ('Wicker', 'wicker'),
             ('Bread', 'bread'), ('Apple', 'apple'), ('Gauge', 'plain'), ('Thread', 'plain'),
             ('Steel_Track', 'track'), ('Olive', 'olive')]
    for k, v in table:
        if n.startswith(k):
            return v
    return 'plain'


def mat_params(m):
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    col = None
    for n in nt.nodes:          # base colour may sit in a multiply node (textured v2 materials)
        if n.type == 'MIX' and n.data_type == 'RGBA':
            col = np.array(n.inputs[7].default_value[:3])
    if col is None:
        col = np.array(bsdf.inputs['Base Color'].default_value[:3])
    return dict(base=col, rough=bsdf.inputs['Roughness'].default_value, metal=bsdf.inputs['Metallic'].default_value,
                name=m.name)


class Ctx:
    """Per-texel inputs for one material subset."""
    def __init__(self, **kw):
        self.__dict__.update(kw)


def sh_wood(c):
    u, v = c.G[:, 0], c.G[:, 1]
    n = len(u)
    pv = fbm(c.P, 0.9, 2, seed=11)                       # per-board tint variation
    warp = fbm(np.stack([u * 1.2, v * 3.0, pv * 3], 1), 1.0, 3, seed=3)
    rings = v * 70 + warp * 5.0 + u * 0.4
    ring = 0.5 + 0.5 * np.sin(2 * np.pi * rings)
    ring = ring ** 3
    fib = fbm(np.stack([u * 5, v * 260, pv * 7], 1), 1.0, 3, seed=5)
    crack = sst(0.80, 0.90, fbm(np.stack([u * 2.0, v * 70, pv * 3], 1), 1.0, 2, seed=8)) * \
        sst(0.45, 0.65, fbm(np.stack([u * 0.8, v * 4, pv], 1), 1.0, 2, seed=9))
    knot_d, _ = voronoi(np.stack([u * 1.6, v * 6.0, pv * 2], 1), seed=21)
    knot = sst(0.16, 0.0, knot_d) * sst(0.55, 0.75, fbm(np.stack([u, v, pv], 1), 2.0, 2, seed=22))
    bb = c.base * 0.85 + c.base.mean() * 0.15
    base = bb * (0.78 + 0.40 * pv)[:, None]
    col = base * (1.0 - 0.28 * ring - 0.22 * (fib - 0.5) - 0.45 * knot)[:, None]
    col = col * (1 - 0.6 * crack)[:, None]
    # weathering: greying on top/exposed, worn bright edges, grime in crevices and low parts
    grey = np.array([0.20, 0.19, 0.17])
    wg = 0.18 * sst(0.4, 0.8, fbm(c.P, 2.5, 3, seed=13))
    col = mixc(col, grey, wg)
    wear = sst(0.08, 0.35, c.e1) * sst(0.35, 0.6, fbm(c.P, 30, 2, seed=14))
    col = mixc(col, np.minimum(c.base * 1.45 + 0.03, 1), wear * 0.55)
    dirt = (1 - c.ao) * 0.55 + 0.35 * sst(0.75, 0.25, c.wz) * c.dirt_low
    col = mixc(col, np.array([0.06, 0.045, 0.03]), np.clip(dirt, 0, 0.75))
    h = -0.0007 * ring - 0.0005 * fib - 0.0018 * crack - 0.0012 * knot + 0.0003 * wear
    rough = 0.70 + 0.10 * ring + 0.08 * crack - 0.18 * wear + 0.08 * dirt
    return col, rough, np.zeros(n), h


def sh_iron(c, rusty=1.0, base_hex=None):
    n = len(c.P)
    f = fbm(c.P, 5.0, 4, seed=31)
    f2 = fbm(c.P, 24.0, 3, seed=32)
    rust = sst(0.50, 0.70, f * 0.75 + (1 - c.ao) * 0.55 + 0.25 * f2 - 0.1) * rusty
    rcol = mixc(lin('#5c2e17')[None, :], lin('#9a5426')[None, :], sst(0.3, 0.8, f2))
    col = mixc(np.tile(c.base, (n, 1)) * (0.85 + 0.3 * f2)[:, None], rcol, rust)
    edge = sst(0.10, 0.40, c.e1) * (1 - rust)
    col = mixc(col, np.array([0.30, 0.30, 0.30]), edge * 0.6)
    pits = sst(0.62, 0.75, vnoise(c.P * 260, seed=33)) * rust
    h = 0.0006 * rust * f2 - 0.0004 * pits + 0.0002 * f
    rough = 0.40 + 0.45 * rust + 0.10 * f2 - 0.15 * edge
    metal = np.clip(0.52 * (1 - rust) + 0.08 * edge, 0, 0.6)
    return col, rough, metal, h


def sh_chrome(c):
    n = len(c.P)
    sm = fbm(c.P, 14.0, 4, seed=41)
    spots = sst(0.72, 0.82, vnoise(c.P * 180, seed=42))
    # no environment map in the game -> bake a soft studio/sky reflection into the albedo so chrome reads as chrome
    nz = c.N[:, 2] + 0.12 * (sm - 0.5)
    sky = np.array([0.80, 0.82, 0.84])
    hor = np.array([0.10, 0.10, 0.11])
    gnd = np.array([0.30, 0.25, 0.19])
    env = mixc(np.tile(hor, (n, 1)), sky, sst(0.05, 0.55, nz))
    env = mixc(env, gnd, sst(-0.05, -0.45, nz))
    env = mixc(env, np.array([0.95, 0.95, 0.95]), 0.6 * np.exp(-((nz - 0.75) / 0.12) ** 2))
    col = env * (c.base / max(c.base.max(), 1e-3))[None, :] * (0.92 + 0.10 * sm)[:, None]
    col = mixc(col, np.array([0.10, 0.08, 0.06]), (1 - c.ao) * 0.55 + 0.25 * spots)
    rough = 0.10 + 0.22 * sst(0.45, 0.75, sm) + 0.25 * (1 - c.ao) + 0.2 * spots
    h = -0.0002 * spots
    return col, rough, np.full(n, 0.45) - 0.2 * spots, h


def sh_brass(c):
    n = len(c.P)
    t = np.clip((1 - c.ao) * 0.9 + 0.45 * sst(0.45, 0.8, fbm(c.P, 9, 3, seed=51)), 0, 1)
    col = mixc(np.tile(c.base, (n, 1)), lin('#3d3a22')[None, :], t * 0.85)
    col = mixc(col, c.base * 1.25, sst(0.1, 0.4, c.e1) * 0.6)
    return col, 0.28 + 0.4 * t, np.clip(0.56 - 0.35 * t, 0, 0.6), np.zeros(n)


def stitch_mask(c, iso=0.16, width=0.05, pitch=0.009):
    line = np.exp(-((c.e2 - iso) / width) ** 2) * sst(0.02, 0.06, c.e2)
    ph = (c.P[:, 0] + c.P[:, 1] * 1.37 + c.P[:, 2] * 0.71) / pitch
    dash = sst(0.15, 0.3, np.abs(np.sin(np.pi * ph)))
    return line * dash, line


def sh_leather(c):
    n = len(c.P)
    mot = fbm(c.P, 9, 4, seed=61)
    peb = vnoise(c.P * 260, seed=62)
    crease = sst(0.55, 0.85, fbm(c.P, 28, 3, seed=63, scale=(1, 2.5, 1)))
    col = np.tile(c.base, (n, 1)) * (0.80 + 0.40 * mot)[:, None]
    col = col * (1 - 0.25 * crease)[:, None]
    scuff = sst(0.10, 0.40, c.e1) * sst(0.3, 0.6, fbm(c.P, 40, 2, seed=64))
    col = mixc(col, np.minimum(c.base * 1.6 + 0.02, 1), scuff * 0.6)
    col = mixc(col, np.array([0.02, 0.012, 0.008]), (1 - c.ao) * 0.5)
    if getattr(c, 'stitch', c.name.startswith('Leather_Saddle')):
        st, line = stitch_mask(c, iso=0.16, width=0.035, pitch=0.007)
    else:
        st, line = np.zeros(n), np.zeros(n)
    thread = lin('#b89a6a')
    col = mixc(col, np.tile(thread, (n, 1)), st * 0.55)
    col = col * (1 - 0.25 * line * (1 - st))[:, None]
    h = 0.00025 * peb - 0.0006 * crease + 0.0005 * st - 0.0004 * line * (1 - st)
    rough = 0.48 + 0.15 * crease - 0.18 * scuff + 0.12 * (1 - c.ao)
    return col, rough, np.zeros(n), h


def sh_cloth(c, fuzz=1.0):
    n = len(c.P)
    f = fbm(c.P, 40, 3, seed=71)
    w = 0.5 + 0.25 * (np.sin(c.P[:, 0] * 900) + np.sin((c.P[:, 1] + c.P[:, 2]) * 900))
    col = np.tile(c.base, (n, 1)) * (0.85 + 0.25 * f)[:, None] * (0.95 + 0.06 * w)[:, None]
    col = mixc(col, np.array([0.02, 0.015, 0.01]), (1 - c.ao) * 0.55)
    return col, 0.85 + 0.1 * f, np.zeros(n), 0.0003 * w * fuzz + 0.0002 * f


def sh_canvas(c):
    n = len(c.P)
    P = c.P
    stain = sst(0.55, 0.8, fbm(P, 2.2, 4, seed=81))
    tint = fbm(P, 0.8, 2, seed=82)
    col = np.tile(c.base, (n, 1)) * (0.88 + 0.16 * tint)[:, None]
    col = mixc(col, lin('#8a7a5a')[None, :], stain * 0.35)
    # water lines / streaks running down
    streak = sst(0.6, 0.9, fbm(P, 1.0, 3, seed=83, scale=(14, 14, 1.2)))
    col = mixc(col, lin('#9a8d70')[None, :], streak * 0.25 * sst(1.9, 1.5, c.wz))
    # patches (defined in world space on the cover)
    patch = np.zeros(n)
    pborder = np.zeros(n)
    for (cx, cy, cz, hx, hy, hz, colh) in getattr(c, 'patches', []):
        d = np.maximum.reduce([np.abs(P[:, 0] - cx) - hx, np.abs(P[:, 1] - cy) - hy, np.abs(P[:, 2] - cz) - hz])
        inside = d < 0
        patch = np.where(inside, 1.0, patch)
        pborder = np.maximum(pborder, np.exp(-((d + 0.012) / 0.004) ** 2))
        col = np.where(inside[:, None], lin(colh)[None, :] * (0.9 + 0.2 * tint)[:, None], col)
    ph = (P[:, 0] + P[:, 1] * 1.37 + P[:, 2] * 0.71) / 0.012
    st = pborder * sst(0.2, 0.4, np.abs(np.sin(np.pi * ph)))
    col = mixc(col, lin('#5a4a32')[None, :], st * 0.8)
    # folds: wrinkles across the cover between the hoops
    fold = np.sin(2 * np.pi * (P[:, 1] * 7.0 + 1.8 * fbm(P, 1.5, 2, seed=84))) * fbm(P, 3, 2, seed=85)
    weave = 0.5 + 0.25 * (np.sin(P[:, 1] * 700) + np.sin((P[:, 0] + P[:, 2]) * 700))
    col = col * (1 + 0.06 * fold)[:, None]
    col = mixc(col, np.array([0.08, 0.065, 0.045]), (1 - c.ao) * 0.6 + 0.3 * sst(1.6, 1.42, c.wz))
    h = 0.004 * fold + 0.0012 * patch + 0.0004 * st + 0.00015 * weave
    return col, 0.9 + 0.05 * stain, np.zeros(n), h


def sh_rope(c):
    n = len(c.P)
    ph = (c.P[:, 0] + c.P[:, 1] + c.P[:, 2]) * 260
    tw = 0.5 + 0.5 * np.sin(ph)
    col = np.tile(c.base, (n, 1)) * (0.75 + 0.35 * tw)[:, None]
    col = mixc(col, np.array([0.03, 0.025, 0.02]), (1 - c.ao) * 0.5)
    return col, np.full(n, 0.95), np.zeros(n), 0.0006 * tw


def sh_rubber(c):
    n = len(c.P)
    f = fbm(c.P, 30, 3, seed=91)
    col = np.tile(c.base, (n, 1)) * (0.85 + 0.3 * f)[:, None]
    dust = sst(0.25, 0.05, c.wz) * 0.5
    col = mixc(col, lin('#6a5a48')[None, :], dust * 0.4)
    return col, 0.85 + 0.1 * f, np.zeros(n), 0.0002 * f


def sh_tyre(c):
    """Object space: wheel axle = X, origin at the wheel centre."""
    n = len(c.P)
    x, y, z = c.P[:, 0], c.P[:, 1], c.P[:, 2]
    rr = np.sqrt(y * y + z * z)
    a = np.arctan2(z, y)
    R = rr.max()
    w = np.abs(x).max()
    crown = sst(R - 0.35 * w - 0.004, R - 0.25 * w, rr)
    if R > 0.34 or w > 0.03:       # motorcycle / large: staggered block tread
        pitch = 0.030
        ph = a * R / pitch
        lane = (x > 0).astype(float)
        blk = (np.abs(np.sin(np.pi * (ph + 0.5 * lane))) > 0.42).astype(float)
        cgroove = sst(0.006, 0.003, np.abs(x))
        sgroove = sst(w * 0.62, w * 0.56, np.abs(x)) * sst(w * 0.48, w * 0.54, np.abs(x))
        groove = np.clip((1 - blk) + cgroove + sgroove, 0, 1) * crown
        depth = 0.003
    else:                          # bicycle: fine diamond knurl + centre rib
        pitch = 0.006
        ph1 = (a * R + x * 1.0) / pitch
        ph2 = (a * R - x * 1.0) / pitch
        knurl = (np.abs(np.sin(np.pi * ph1)) * np.abs(np.sin(np.pi * ph2)))
        groove = sst(0.35, 0.1, knurl) * crown * sst(0.002, 0.004, np.abs(x))
        depth = 0.0008
    side = (1 - crown) * (0.5 + 0.5 * np.sin(rr * 2400)) * 0.3
    f = fbm(c.P, 40, 2, seed=92)
    col = np.tile(c.base, (n, 1)) * (0.9 + 0.2 * f)[:, None]
    col = col * (1 - 0.35 * groove)[:, None]
    worn = crown * (1 - groove)
    col = mixc(col, lin('#4a443e')[None, :], worn * 0.25)
    col = mixc(col, lin('#7a6a55')[None, :], sst(0.6, 0.85, fbm(c.P, 6, 3, seed=93)) * 0.25 * (1 - crown))
    h = -depth * groove + 0.0002 * side
    rough = 0.82 + 0.1 * groove - 0.12 * worn
    return col, rough, np.zeros(n), h


def sh_paint(c, dirt_k=1.0):
    n = len(c.P)
    peel = vnoise(c.P * 300, seed=101)
    sm = fbm(c.P, 10, 3, seed=102)
    col = np.tile(c.base, (n, 1)) * (0.95 + 0.08 * sm)[:, None]
    chip = sst(0.12, 0.35, c.e1) * sst(0.58, 0.68, fbm(c.P, 45, 3, seed=103))
    scratch = sst(0.93, 0.97, fbm(c.P, 1.0, 2, seed=104, scale=(60, 4, 60))) * 0.6
    under = lin('#3a3836')
    col = mixc(col, np.tile(under, (n, 1)), np.clip(chip + scratch * 0.5, 0, 1))
    dust = (sst(0.55, 0.15, c.wz) * 0.6 + (1 - c.ao) * 0.5) * dirt_k
    col = mixc(col, lin('#5e4c38')[None, :], np.clip(dust, 0, 0.7) * 0.6)
    rough = 0.22 + 0.15 * sm + 0.3 * chip + 0.35 * dust
    metal = 0.35 * chip
    h = 0.00008 * peel - 0.0003 * chip - 0.0002 * scratch
    return col, rough, metal, h


def sh_alu(c):
    n = len(c.P)
    cast = vnoise(c.P * 220, seed=111)
    f = fbm(c.P, 8, 3, seed=112)
    col = np.tile(c.base * 0.75, (n, 1)) * (0.85 + 0.2 * f)[:, None]
    grime = np.clip((1 - c.ao) * 0.9 + 0.3 * sst(0.55, 0.8, fbm(c.P, 4, 3, seed=113)), 0, 1)
    col = mixc(col, lin('#2a2016')[None, :], grime * 0.7)
    edge = sst(0.1, 0.4, c.e1)
    col = mixc(col, c.base * 1.25, edge * 0.5)
    return col, 0.45 + 0.2 * cast + 0.2 * grime - 0.15 * edge, np.clip(0.5 - 0.3 * grime, 0, 0.6), 0.00025 * cast


def sh_wicker(c):
    n = len(c.P)
    u, v = c.G[:, 0], c.G[:, 1]
    N = 9.0
    cu = (u * N) % 1.0
    cv = (v * N * 0.5) % 1.0
    row = np.floor(v * N * 0.5).astype(int)
    col_ = np.floor(u * N).astype(int)
    over = ((row + col_) % 2 == 0)
    sh = np.sin(np.pi * cv) ** 0.6
    sv = np.sin(np.pi * cu) ** 0.6
    lum = np.where(over, 0.55 + 0.45 * sh, 0.35 + 0.45 * sv * sh)
    hh = np.where(over, sh, sv * 0.8)
    f = fbm(c.P, 30, 2, seed=121)
    col = np.tile(c.base, (n, 1)) * (lum * (0.85 + 0.3 * f))[:, None]
    col = mixc(col, np.array([0.04, 0.03, 0.015]), (1 - c.ao) * 0.5)
    return col, 0.85 - 0.1 * hh, np.zeros(n), 0.004 * hh


def sh_simple(c, var=0.15, rough=None, f=20, h=0.0002, seed=131):
    n = len(c.P)
    q = fbm(c.P, f, 3, seed=seed)
    col = np.tile(c.base, (n, 1)) * (1 - var + 2 * var * q)[:, None]
    col = mixc(col, np.array([0.02, 0.015, 0.01]), (1 - c.ao) * 0.45)
    r = np.full(n, c.rough if rough is None else rough)
    return col, r, np.full(n, min(c.metal, 0.6)), h * q


def sh_hoof(c):
    n = len(c.P)
    lines = fbm(c.P, 1.0, 3, seed=141, scale=(260, 260, 14))
    col = np.tile(c.base, (n, 1)) * (0.75 + 0.5 * lines)[:, None]
    col = mixc(col, lin('#6e6252')[None, :], sst(0.06, 0.0, c.wz) * 0.5)
    return col, 0.45 + 0.2 * lines, np.zeros(n), 0.0005 * lines


def sh_hair(c):
    n = len(c.P)
    s = fbm(c.P, 1.0, 3, seed=151, scale=(300, 300, 25))
    col = np.tile(c.base, (n, 1)) * (0.6 + 0.8 * s)[:, None]
    return col, 0.55 + 0.2 * s, np.zeros(n), 0.0006 * s


SHADERS = {
    'wood': sh_wood, 'iron': sh_iron, 'iron_dark': lambda c: sh_iron(c, 0.35), 'chrome': sh_chrome, 'brass': sh_brass,
    'leather': sh_leather, 'cloth': sh_cloth, 'sack': lambda c: sh_cloth(c, 2.0), 'canvas': sh_canvas,
    'rope': sh_rope, 'rubber': sh_rubber, 'tyre': sh_tyre, 'paint': sh_paint, 'alu': sh_alu, 'wicker': sh_wicker,
    'bread': lambda c: sh_simple(c, 0.25, 0.75, 25, 0.0008), 'apple': lambda c: sh_simple(c, 0.12, 0.35, 40, 0.0001),
    'plain': lambda c: sh_simple(c, 0.05), 'hoof': sh_hoof, 'hair': sh_hair,
    'eye': lambda c: sh_simple(c, 0.05, 0.08, 10, 0.0), 'nostril': lambda c: sh_simple(c, 0.1, 0.6, 30, 0.0002),
}


# ======================================================================= blender side
def _sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def make_atlas_uv(objs, margin=0.004, weights=None, mat_scale=None):
    """weights: optional {object: scale} to give some parts more texel density."""
    for o in objs:
        me = o.data
        if 'grain' not in me.uv_layers:
            if len(me.uv_layers):
                me.uv_layers[0].name = 'grain'
            else:
                me.uv_layers.new(name='grain')
        uv = me.uv_layers.get('atlas') or me.uv_layers.new(name='atlas')
        me.uv_layers.active = uv
        uv.active_render = True
    _sel(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.reveal()
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    if weights or mat_scale:
        for o, s in (weights or {}).items():
            # scale UVs of this object (relative density) before packing
            uvd = o.data.uv_layers['atlas'].data
            a = np.zeros(len(uvd) * 2)
            uvd.foreach_get('uv', a)
            uvd.foreach_set('uv', a * s)
    if mat_scale:
        for o in objs:
            me = o.data
            sc = np.ones(len(me.materials))
            for i, m in enumerate(me.materials):
                for k, v in mat_scale.items():
                    if m and m.name.startswith(k):
                        sc[i] = v
            if (sc == 1).all():
                continue
            mi = np.zeros(len(me.polygons), dtype=np.int32)
            me.polygons.foreach_get('material_index', mi)
            ls = np.zeros(len(me.polygons), dtype=np.int32)
            me.polygons.foreach_get('loop_total', ls)
            lf = np.repeat(sc[mi], ls)
            uvd = me.uv_layers['atlas'].data
            a = np.zeros(len(uvd) * 2)
            uvd.foreach_get('uv', a)
            a = a.reshape(-1, 2) * lf[:, None]
            uvd.foreach_set('uv', a.ravel())
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def _setup_cycles(samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 6
    sc.render.bake.margin_type = 'EXTEND'
    sc.render.bake.use_clear = True
    sc.render.bake.use_selected_to_active = False


def bake_group(name, objs, size=1024, handlers=None, extra=None, ao_dist=0.5, dirt_low=1.0, occluders=(),
               ground=True, normal_strength=1.0, ao_in_base=0.45, uv_weights=None, base_normal=None, mat_scale=None, orm_half=True):
    """Bake one atlas for objs; replaces their (non-special) materials with '<name>_Atlas'. Returns the material."""
    handlers = handlers or {}
    extra = extra or {}
    make_atlas_uv(objs, weights=uv_weights, mat_scale=mat_scale)
    # ---- collect materials & ids
    mats = []
    for o in objs:
        for m in o.data.materials:
            if m and m not in mats:
                mats.append(m)
    mid = {m: i + 1 for i, m in enumerate(mats)}
    params = {m: mat_params(m) for m in mats}
    # ---- G-buffer images
    imgs = {}
    for k in ('pos', 'nrm', 'gid', 'edg', 'ao'):
        im = bpy.data.images.new("%s_g_%s" % (name, k), size, size, alpha=False, float_buffer=True)
        im.colorspace_settings.name = 'Non-Color'
        imgs[k] = im
    # temporary node setup in every material
    saved = {}
    for m in mats:
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        saved[m] = [l.from_socket for l in out.inputs['Surface'].links]
        tn = {}
        tn['img'] = nt.nodes.new('ShaderNodeTexImage')
        tn['tc'] = nt.nodes.new('ShaderNodeTexCoord')
        tn['geo'] = nt.nodes.new('ShaderNodeNewGeometry')
        tn['uv'] = nt.nodes.new('ShaderNodeUVMap')
        tn['uv'].uv_map = 'grain'
        tn['em'] = nt.nodes.new('ShaderNodeEmission')
        tn['em'].inputs['Strength'].default_value = 1.0
        # pos encode: P/16 + 0.5
        pm = nt.nodes.new('ShaderNodeVectorMath'); pm.operation = 'MULTIPLY_ADD'
        pm.inputs[1].default_value = (1 / 16, 1 / 16, 1 / 16); pm.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(tn['tc'].outputs['Object'], pm.inputs[0])
        tn['pos'] = pm
        nm = nt.nodes.new('ShaderNodeVectorMath'); nm.operation = 'MULTIPLY_ADD'
        nm.inputs[1].default_value = (0.5, 0.5, 0.5); nm.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(tn['tc'].outputs['Normal'], nm.inputs[0])
        tn['nrm'] = nm
        # grain uv + id : (u/32+0.5, v/32+0.5, id/255)
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tn['uv'].outputs['UV'], sep.inputs[0])
        com = nt.nodes.new('ShaderNodeCombineXYZ')
        for ax, sock in ((0, 'X'), (1, 'Y')):
            mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY_ADD'
            mm.inputs[1].default_value = 1 / 32; mm.inputs[2].default_value = 0.5
            nt.links.new(sep.outputs[sock], mm.inputs[0])
            nt.links.new(mm.outputs[0], com.inputs[ax])
        com.inputs[2].default_value = mid[m] / 255.0
        tn['gid'] = com
        # edges: 1 - dot(bevel, N) for two radii, world z / 8
        com2 = nt.nodes.new('ShaderNodeCombineXYZ')
        for ax, rad in ((0, 0.006), (1, 0.03)):
            bv = nt.nodes.new('ShaderNodeBevel'); bv.samples = 8
            bv.inputs['Radius'].default_value = rad
            dp = nt.nodes.new('ShaderNodeVectorMath'); dp.operation = 'DOT_PRODUCT'
            nt.links.new(bv.outputs[0], dp.inputs[0]); nt.links.new(tn['geo'].outputs['Normal'], dp.inputs[1])
            mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'SUBTRACT'; mm.inputs[0].default_value = 1.0
            nt.links.new(dp.outputs['Value'], mm.inputs[1])
            nt.links.new(mm.outputs[0], com2.inputs[ax])
        sz = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tn['geo'].outputs['Position'], sz.inputs[0])
        mz = nt.nodes.new('ShaderNodeMath'); mz.operation = 'MULTIPLY'; mz.inputs[1].default_value = 1 / 8
        nt.links.new(sz.outputs['Z'], mz.inputs[0]); nt.links.new(mz.outputs[0], com2.inputs[2])
        tn['edg'] = com2
        tn['out'] = out
        saved[m] = (saved[m], tn)
        for n in nt.nodes:
            n.select = False
        tn['img'].select = True
        nt.nodes.active = tn['img']
    # occluder ground for AO
    gp = None
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.001))
        gp = bpy.context.active_object
        gp.name = "_ao_ground"
    _sel(objs)
    _setup_cycles(1)
    for k in ('pos', 'nrm', 'gid', 'edg'):
        for m in mats:
            tn = saved[m][1]
            tn['img'].image = imgs[k]
            m.node_tree.links.new(tn[k].outputs[0], tn['em'].inputs['Color'])
            m.node_tree.links.new(tn['em'].outputs[0], tn['out'].inputs['Surface'])
        if k == 'edg':
            bpy.context.scene.cycles.samples = 8
        bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
        print("BAKED", name, k)
    for m in mats:
        tn = saved[m][1]
        tn['img'].image = imgs['ao']
    bpy.context.scene.cycles.samples = 48
    bpy.context.scene.world = bpy.context.scene.world or bpy.data.worlds.new("bakeW")
    bpy.context.scene.world.light_settings.distance = ao_dist
    bpy.ops.object.bake(type='AO', margin=6, use_clear=True)
    print("BAKED", name, "ao")
    if base_normal is not None:
        base_normal(imgs)        # optional high->low normal bake (fills imgs['bn'])
    if gp:
        bpy.data.objects.remove(gp)

    def arr(im, ch=3):
        a = np.zeros(size * size * 4, dtype=np.float32)
        im.pixels.foreach_get(a)
        return a.reshape(size, size, 4)[..., :ch].astype(np.float64)
    pos = (arr(imgs['pos']) - 0.5) * 16
    nrm = arr(imgs['nrm']) * 2 - 1
    gid = arr(imgs['gid'])
    edg = arr(imgs['edg'])
    ao = arr(imgs['ao'], 1)[..., 0]
    ids = np.rint(gid[..., 2] * 255).astype(int)
    G = (gid[..., :2] - 0.5) * 32
    valid = ids > 0
    # ---- shade
    alb = np.zeros((size, size, 3)) + 0.2
    rough = np.full((size, size), 0.8)
    metal = np.zeros((size, size))
    hgt = np.zeros((size, size))
    for m in mats:
        sel = ids == mid[m]
        if not sel.any():
            continue
        pr = params[m]
        kind = kind_of(m.name) or 'plain'
        c = Ctx(P=pos[sel], N=nrm[sel], G=G[sel], e1=np.clip(edg[sel][:, 0] * 4, 0, 1),
                e2=np.clip(edg[sel][:, 1] * 3, 0, 1), wz=edg[sel][:, 2] * 8, ao=np.clip(ao[sel], 0, 1),
                base=pr['base'], rough=pr['rough'], metal=pr['metal'], dirt_low=dirt_low, name=m.name,
                **extra.get(m.name, {}))
        fn = handlers.get(m.name) or handlers.get(kind) or SHADERS.get(kind, SHADERS['plain'])
        a_, r_, mt_, h_ = fn(c)
        alb[sel] = a_
        rough[sel] = np.clip(r_, 0.05, 1)
        metal[sel] = np.clip(mt_, 0, 0.6)
        hgt[sel] = h_
    # ---- height -> normal
    nmap = height_to_normal(hgt, pos, valid, normal_strength)
    if base_normal is not None and 'bn' in imgs:
        bn = arr(imgs['bn']) * 2 - 1
        has = np.linalg.norm(bn, axis=2) > 0.5
        bxy = np.where(has[..., None], bn[..., :2], 0)
        bz = np.where(has, bn[..., 2], 1)
        n2 = np.dstack([nmap[..., 0] + bxy[..., 0], nmap[..., 1] + bxy[..., 1], nmap[..., 2] * bz])
        nmap = n2 / np.linalg.norm(n2, axis=2, keepdims=True)
    aoc = np.clip(ao, 0, 1)
    basecol = alb * (1 - ao_in_base + ao_in_base * aoc)[..., None]
    base_img = img_from(name + "_base", to_srgb(basecol))
    nrm_img = img_from(name + "_nrm", nmap * 0.5 + 0.5, noncolor=True)
    orm = np.dstack([0.35 + 0.65 * aoc, rough, metal])
    if orm_half:
        orm = orm.reshape(size // 2, 2, size // 2, 2, 3).mean(axis=(1, 3))
    orm_img = img_from(name + "_orm", orm, noncolor=True)
    for im in imgs.values():
        bpy.data.images.remove(im)
    # ---- restore & final material
    for m in mats:
        prev, tn = saved[m]
        nt = m.node_tree
        for k_, n in tn.items():
            if k_ != 'out':
                pass
        for n in list(nt.nodes):
            if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL', 'TEX_IMAGE', 'MIX', 'VERTEX_COLOR') or n == tn['img']:
                nt.nodes.remove(n)
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        nt.links.new(bsdf.outputs[0], tn['out'].inputs['Surface'])
    am = atlas_material(name + "_Atlas", base_img, nrm_img, orm_img)
    for o in objs:
        me = o.data
        for i, m in enumerate(me.materials):
            if m is not None and kind_of(m.name) is not None:
                me.materials[i] = am
        # merge duplicate slots
        _dedupe_slots(o)
        if 'grain' in me.uv_layers:
            me.uv_layers.remove(me.uv_layers['grain'])
        for ca in list(me.color_attributes):
            me.color_attributes.remove(ca)
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    return am


def _dedupe_slots(o):
    me = o.data
    uniq = []
    remap = []
    for m in me.materials:
        if m not in uniq:
            uniq.append(m)
        remap.append(uniq.index(m))
    if len(uniq) == len(me.materials):
        return
    mi = np.zeros(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get('material_index', mi)
    mi = np.array(remap)[mi]
    me.materials.clear()
    for m in uniq:
        me.materials.append(m)
    me.polygons.foreach_set('material_index', mi.astype(np.int32))


def height_to_normal(h, pos, valid, strength=1.0):
    S = h.shape[0]
    n = np.dstack([np.zeros_like(h), np.zeros_like(h), np.ones_like(h)])

    def grad(axis):
        hp, hm = np.roll(h, -1, axis), np.roll(h, 1, axis)
        pp, pm = np.roll(pos, -1, axis), np.roll(pos, 1, axis)
        vp, vm = np.roll(valid, -1, axis), np.roll(valid, 1, axis)
        dp = np.linalg.norm(pp - pos, axis=2)
        dm = np.linalg.norm(pos - pm, axis=2)
        med = np.median(np.concatenate([dp[valid & vp], dm[valid & vm]])) if valid.any() else 0.005
        okp = vp & (dp > 1e-7) & (dp < med * 4)
        okm = vm & (dm > 1e-7) & (dm < med * 4)
        g = np.zeros_like(h)
        both = okp & okm
        g = np.where(both, (hp - hm) / np.maximum(dp + dm, 1e-7), g)
        g = np.where(okp & ~okm, (hp - h) / np.maximum(dp, 1e-7), g)
        g = np.where(okm & ~okp, (h - hm) / np.maximum(dm, 1e-7), g)
        return g
    gx = grad(1)   # columns = u
    gy = grad(0)   # rows = v
    nn = np.dstack([-gx * strength, -gy * strength, np.ones_like(h)])
    nn /= np.linalg.norm(nn, axis=2, keepdims=True)
    return nn


def img_from(name, rgb, noncolor=False):
    S = rgb.shape[0]
    im = bpy.data.images.new(name, S, rgb.shape[1], alpha=False)
    a = np.ones((S, rgb.shape[1], 4), dtype=np.float32)
    a[..., :3] = np.clip(rgb, 0, 1)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(a.ravel())
    im.file_format = 'PNG'
    im.pack()
    return im


def gltf_settings_group():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    g.nodes.new('NodeGroupInput')
    return g


def atlas_material(name, base, nrm, orm, alpha=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'atlas'
    tb = nt.nodes.new('ShaderNodeTexImage'); tb.image = base
    nt.links.new(uv.outputs[0], tb.inputs[0])
    nt.links.new(tb.outputs['Color'], bsdf.inputs['Base Color'])
    if orm is not None:
        to = nt.nodes.new('ShaderNodeTexImage'); to.image = orm
        nt.links.new(uv.outputs[0], to.inputs[0])
        sp = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(to.outputs['Color'], sp.inputs[0])
        nt.links.new(sp.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sp.outputs['Blue'], bsdf.inputs['Metallic'])
        gg = nt.nodes.new('ShaderNodeGroup'); gg.node_tree = gltf_settings_group()
        nt.links.new(sp.outputs['Red'], gg.inputs['Occlusion'])
    if nrm is not None:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm
        nt.links.new(uv.outputs[0], tn.inputs[0])
        nmn = nt.nodes.new('ShaderNodeNormalMap'); nmn.uv_map = 'atlas'
        nt.links.new(tn.outputs['Color'], nmn.inputs['Color'])
        nt.links.new(nmn.outputs[0], bsdf.inputs['Normal'])
    if alpha is not None:
        nt.links.new(tb.outputs['Alpha'], bsdf.inputs['Alpha'])
        try:
            m.blend_method = 'CLIP'
        except Exception:
            pass
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass
        m.alpha_threshold = alpha if hasattr(m, 'alpha_threshold') else None
        m.use_backface_culling = False
    return m
