# 마을 소품 키트 (village props kit) — headless Blender build
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/village_props/build_kit.py -- [--preview DIR] [--export] [--only name,name]
# Output: models/props/vp-kit.glb (all props, shared materials/textures), models/src/vp-kit.blend
#
# Axes: Blender X right, -Y = front (glTF +Z), Z up. Every prop root sits on the ground at its own origin
# (props are spread on a grid in the file; village-props.js reads each root's meshes relative to the root).
# Named nodes the code relies on:
#   vp_<prop>            root mesh of each prop (multi-material)
#   windmill_blades      child of vp_windmill, origin at the hub, spins about its local Y (glTF Z = front axis)
#   smoke*               empties at chimney tops (chimney smoke emitters)
#   light*               empties at lantern centres (lamp post / door lanterns)
# Materials (shared by name across props → one draw call per material after merging):
#   vp_plaster vp_timber vp_thatch vp_shingle vp_slate vp_stone vp_ashlar vp_planks vp_soil vp_palette vp_glow vp_water
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
ONLY = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
TEXDIR = os.path.join(PREVIEW or '/tmp', 'vp_tex'); os.makedirs(TEXDIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.default_rng(23)
R = random.Random(23)

# ───────────────────────── textures (numpy, tileable) ─────────────────────────
def vnoise(h, w, gy, gx, seed):
    r = np.random.default_rng(seed).random((gy, gx))
    def axis(n, g):
        t = np.arange(n) * g / n
        i0 = np.floor(t).astype(int); f = t - i0; f = f * f * (3 - 2 * f)
        return i0 % g, (i0 + 1) % g, f
    y0, y1, fy = axis(h, gy); x0, x1, fx = axis(w, gx)
    a = r[np.ix_(y0, x0)]; b = r[np.ix_(y0, x1)]; c = r[np.ix_(y1, x0)]; d = r[np.ix_(y1, x1)]
    top = a * (1 - fx) + b * fx; bot = c * (1 - fx) + d * fx
    return top * (1 - fy[:, None]) + bot * fy[:, None]

def fbm(h, w, g, seed, oct=4, aniso=(1, 1)):
    s = np.zeros((h, w)); amp = 1; tot = 0
    for o in range(oct):
        s += amp * vnoise(h, w, max(1, g * aniso[0] << o), max(1, g * aniso[1] << o), seed + o)
        tot += amp; amp *= 0.5
    return s / tot

def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def save_img(name, rgb, noncolor=False):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32); px[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px[::-1].ravel())
    path = os.path.join(TEXDIR, name + '.png')
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    bpy.data.images.remove(img)
    im = bpy.data.images.load(path); im.name = name
    if noncolor: im.colorspace_settings.name = 'Non-Color'
    im.pack()
    return im

def normal_from_height(hgt, strength):
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * strength
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(hgt)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5

def voronoi(N, cells_x, cells_y, seed):
    r_ = np.random.default_rng(seed)
    pts = r_.uniform(0.12, 0.88, (cells_y, cells_x, 2))
    ys, xs = np.mgrid[0:N, 0:N].astype(float)
    xs = xs / N * cells_x; ys = ys / N * cells_y
    cx, cy = np.floor(xs).astype(int), np.floor(ys).astype(int)
    f1 = np.full((N, N), 9.0); f2 = np.full((N, N), 9.0); idx = np.zeros((N, N), int)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            gx, gy = cx + ox, cy + oy
            p = pts[gy % cells_y, gx % cells_x]
            d = np.hypot(xs - (gx + p[..., 0]), ys - (gy + p[..., 1]))
            lt = d < f1
            f2 = np.where(lt, f1, np.minimum(f2, d)); idx = np.where(lt, (gy % cells_y) * cells_x + gx % cells_x, idx)
            f1 = np.where(lt, d, f1)
    return f1, f2, idx

def tex_plaster(N=512):
    big = fbm(N, N, 3, 101, 3); mid = fbm(N, N, 12, 111, 4); fine = fbm(N, N, 96, 121, 2)
    c = np.array([0.90, 0.85, 0.74]) * (0.84 + 0.12 * big + 0.08 * mid + 0.06 * fine)[..., None]
    r = np.abs(fbm(N, N, 5, 131, 4) - 0.5)
    crack = np.clip(1 - r / 0.010, 0, 1) * (fbm(N, N, 3, 141, 2) > 0.56)
    c *= (1 - 0.30 * crack)[..., None]
    st = np.clip((fbm(N, N, 4, 151, 3) - 0.58) * 3, 0, 1)[..., None]
    c = c * (1 - 0.18 * st) + np.array([0.62, 0.52, 0.36]) * 0.18 * st
    return c, normal_from_height(0.6 * mid + 0.25 * fine - 0.6 * crack, 1.4)

def tex_timber(N=512):
    grain = fbm(N, N, 3, 161, 4, aniso=(1, 14)); knots = fbm(N, N, 5, 171, 3)
    c = np.array([0.30, 0.19, 0.11]) * (0.62 + 0.55 * grain)[..., None] * (0.85 + 0.25 * knots)[..., None]
    cr = (fbm(N, N, 2, 181, 3, aniso=(1, 30)) > 0.66) & (fbm(N, N, 6, 191, 2) > 0.5)
    c[cr] *= 0.45
    return c, normal_from_height(grain * 0.8 - cr * 0.8, 1.6)

def tex_thatch(N=1024, rows=5):
    rh = N // rows
    strands = fbm(N, N, 4, 201, 4, aniso=(1, 64)); strands2 = fbm(N, N, 8, 211, 3, aniso=(1, 70))
    dark = (fbm(N, N, 3, 215, 2, aniso=(1, 120)) > 0.68)
    big = fbm(N, N, 3, 221, 3); fine = fbm(N, N, 64, 231, 2)
    ys = np.arange(N); wav = (fbm(1, N, 1, 241, 3, aniso=(1, 12))[0] - 0.5) * 0.5
    t = np.clip(((ys[:, None] % rh) / rh) + wav[None, :], 0, 1)
    shade = 0.74 + 0.26 * sstep(0.0, 0.6, t)
    butt = sstep(0.9, 1.0, t)
    fresh = np.array([0.76, 0.60, 0.34]); old = np.array([0.55, 0.47, 0.35])
    mixk = np.clip(big * 1.4 - 0.25, 0, 1)[..., None]
    c = fresh * (1 - mixk) + old * mixk
    c = c * (0.62 + 0.45 * strands * (0.75 + 0.45 * strands2))[..., None] * shade[..., None]
    c[dark] *= 0.62
    c = c * (1 + 0.12 * butt * fine)[..., None]
    moss = np.clip((fbm(N, N, 6, 251, 3) - 0.64) * 4, 0, 1)[..., None]
    c = c * (1 - 0.45 * moss) + np.array([0.26, 0.31, 0.13]) * 0.45 * moss
    hgt = shade * 0.5 + strands * 0.7 - dark * 0.3 + butt * 0.15
    return c, normal_from_height(hgt, 3.0)

def tex_shingle(N=512, rows=8):
    rh = N // rows
    col = np.zeros((N, N, 3)); hgt = np.zeros((N, N))
    grain = fbm(N, N, 4, 261, 3, aniso=(1, 16)); fine = fbm(N, N, 64, 271, 2)
    xs = np.arange(N)
    for r in range(rows):
        cuts = [0]
        while cuts[-1] < N - 40: cuts.append(cuts[-1] + int(rng.integers(34, 70)))
        cuts[-1] = N
        cuts = np.array(cuts); off = int(rng.integers(0, N))
        xx = (xs + off) % N
        sid = np.searchsorted(cuts, xx, side='right') - 1
        d = np.minimum(xx - cuts[sid], cuts[sid + 1] - xx)
        tone = rng.uniform(0.72, 1.15, len(cuts))
        ys = np.arange(rh)[:, None] / rh
        shade = 0.45 + 0.55 * sstep(0.0, 0.45, ys)
        c = np.array([0.46, 0.38, 0.31])[None, None, :] * (tone[sid][None, :] * shade)[..., None]
        sl = slice(r * rh, (r + 1) * rh)
        c = c * (0.7 + 0.45 * grain[sl])[..., None] * (0.9 + 0.15 * fine[sl])[..., None]
        gap = (d < 2)[None, :].repeat(rh, 0)
        c[gap] *= 0.35
        col[sl] = c
        hgt[sl] = shade * (d >= 2)[None, :] + 0.2 * grain[sl]
    moss = np.clip((fbm(N, N, 5, 281, 3) - 0.6) * 3, 0, 1)[..., None]
    col = col * (1 - 0.4 * moss) + np.array([0.26, 0.32, 0.14]) * 0.4 * moss
    return col, normal_from_height(hgt, 2.0)

def tex_slate(N=512, rows=8):
    rh = N // rows
    col = np.zeros((N, N, 3)); fine = fbm(N, N, 64, 291, 2); big = fbm(N, N, 3, 295, 3)
    for r in range(rows):
        sw = 64; off = (r % 2) * sw // 2
        xs = (np.arange(N) + off) % sw
        sid = ((np.arange(N) + off) // sw) % (N // sw)
        tone = rng.uniform(0.78, 1.15, N // sw)
        ys = np.arange(rh)[:, None]
        shade = 0.5 + 0.5 * np.clip(ys / rh * 1.5, 0, 1)
        gap = (xs < 2) | (xs > sw - 3)
        c = np.array([0.33, 0.35, 0.40])[None, None, :] * (tone[sid][None, :] * shade)[..., None]
        c = c * (0.85 + 0.25 * fine[r * rh:(r + 1) * rh])[..., None]
        c[:, gap] *= 0.45
        col[r * rh:(r + 1) * rh] = c
    col *= (0.88 + 0.2 * big)[..., None]
    return col

def tex_rubble(N=1024):
    f1, f2, idx = voronoi(N, 9, 14, 301)
    edge = f2 - f1
    nb = 9 * 14
    tone = rng.uniform(0.72, 1.12, nb); hue = rng.uniform(-0.05, 0.05, nb)
    dome = np.clip(edge / 0.3, 0, 1) ** 0.55
    stone = edge > 0.075
    mid = fbm(N, N, 18, 311, 3); fine = fbm(N, N, 128, 321, 2); big = fbm(N, N, 3, 331, 3)
    t = tone[idx]; hu = hue[idx]
    base = np.array([0.60, 0.56, 0.50])
    c = np.empty((N, N, 3))
    c[..., 0] = base[0] * t + hu; c[..., 1] = base[1] * t + hu * 0.3; c[..., 2] = base[2] * t - hu * 0.6
    c *= (0.70 + 0.30 * dome)[..., None] * (0.82 + 0.25 * mid)[..., None] * (0.9 + 0.14 * fine)[..., None]
    mortar = np.array([0.70, 0.66, 0.58]) * (0.75 + 0.3 * fine)[..., None]
    c = np.where(stone[..., None], c, mortar)
    c *= (0.85 + 0.22 * big)[..., None]
    moss = np.clip((fbm(N, N, 5, 341, 3) - 0.62) * 3.5, 0, 1)[..., None]
    c = c * (1 - 0.35 * moss) + np.array([0.22, 0.28, 0.12]) * 0.35 * moss
    hgt = np.where(stone, 0.35 + dome * 0.65, 0.0) + 0.06 * fine
    return c, normal_from_height(hgt, 2.6)

def tex_ashlar(N=512, rows=6):
    rh = N // rows
    col = np.zeros((N, N, 3)); hgt = np.zeros((N, N))
    mid = fbm(N, N, 16, 351, 3); fine = fbm(N, N, 96, 361, 2); big = fbm(N, N, 3, 371, 3)
    xs = np.arange(N)
    for r in range(rows):
        cuts = [0]
        while True:
            nxt = cuts[-1] + int(rng.integers(90, 170))
            if nxt > N - 70: break
            cuts.append(nxt)
        cuts = np.sort((np.array(cuts) + int(rng.integers(0, N))) % N)
        d = np.abs(xs[:, None] - cuts[None, :]); d = np.minimum(d, N - d); dx = d.min(1)
        bid = np.searchsorted(cuts, xs, side='right') % len(cuts)
        tone = rng.uniform(0.80, 1.10, len(cuts))
        ys = np.arange(rh); dy = np.minimum(ys, rh - 1 - ys)
        dd = np.minimum(dx[None, :], dy[:, None]).astype(float)
        bev = np.clip((dd - 2.5) / 7.0, 0, 1)
        sl = slice(r * rh, (r + 1) * rh)
        c = np.array([0.72, 0.68, 0.60])[None, None, :] * tone[bid][None, :, None]
        c = c * (0.82 + 0.25 * mid[sl] + 0.1 * fine[sl])[..., None] * (0.75 + 0.25 * bev)[..., None]
        m = dd <= 2.5
        c[m] = (np.array([0.50, 0.47, 0.42]) * (0.85 + 0.2 * fine[sl])[..., None])[m]
        col[sl] = c; hgt[sl] = bev * 0.8 + 0.2 * mid[sl]
    col *= (0.88 + 0.18 * big)[..., None]
    return col, normal_from_height(hgt, 2.0)

def tex_planks(N=512, planks=8):
    pw = N // planks
    grain = fbm(N, N, 4, 381, 4, aniso=(1, 12)); knots = fbm(N, N, 6, 391, 2)
    xs = np.arange(N); pid = xs // pw; lx = xs % pw
    tone = rng.uniform(0.82, 1.15, planks)
    c = np.array([0.52, 0.36, 0.22])[None, None, :] * tone[pid][None, :, None]
    c = c * (0.70 + 0.45 * grain)[..., None] * (0.9 + 0.15 * knots)[..., None]
    gap = (lx < 3) | (lx > pw - 3)
    c[:, gap] *= 0.38
    hgt = grain * 0.4 + 0.6 * (~gap)[None, :]
    return c, normal_from_height(hgt, 1.6)

def tex_soil(N=512):
    f1, f2, idx = voronoi(N, 22, 22, 401)
    clod = np.clip((f2 - f1) / 0.25, 0, 1) ** 0.5
    mid = fbm(N, N, 10, 411, 3); fine = fbm(N, N, 128, 421, 2); big = fbm(N, N, 3, 431, 3)
    tone = rng.uniform(0.8, 1.15, 22 * 22)[idx]
    c = np.array([0.30, 0.20, 0.13]) * (tone * (0.6 + 0.45 * clod) * (0.8 + 0.3 * mid) * (0.88 + 0.18 * big))[..., None]
    # straw stubble and pebbles
    st = (fbm(N, N, 6, 441, 2, aniso=(1, 40)) > 0.70) & (fine > 0.55)
    c[st] = np.array([0.66, 0.54, 0.30]) * (0.8 + 0.4 * fine[st])[..., None]
    pb = (fbm(N, N, 40, 451, 1) > 0.80)
    c[pb] = np.array([0.55, 0.52, 0.48])
    hgt = clod * 0.7 + 0.3 * mid + 0.4 * pb + 0.3 * st
    return c, normal_from_height(hgt, 2.4)

PAL = {
    'iron': (0.13, 0.12, 0.12), 'iron2': (0.24, 0.22, 0.21), 'gold': (0.86, 0.63, 0.22), 'black': (0.05, 0.05, 0.05),
    'red': (0.80, 0.10, 0.08), 'yellow': (0.96, 0.76, 0.16), 'white': (0.95, 0.93, 0.87), 'purple': (0.52, 0.26, 0.68),
    'pink': (0.93, 0.50, 0.62), 'orange': (0.96, 0.46, 0.08), 'blue': (0.32, 0.45, 0.78), 'leaf': (0.22, 0.42, 0.12),
    'leaf2': (0.34, 0.50, 0.15), 'leafdark': (0.12, 0.26, 0.08), 'autumn': (0.78, 0.36, 0.08), 'autumn2': (0.62, 0.20, 0.06),
    'pumpkin': (0.93, 0.46, 0.06), 'pumpkin2': (0.86, 0.56, 0.12), 'stem': (0.36, 0.44, 0.18), 'cabbage': (0.46, 0.63, 0.30),
    'burlap': (0.60, 0.48, 0.31), 'sack': (0.74, 0.64, 0.46), 'sail': (0.87, 0.82, 0.70), 'cloth_red': (0.62, 0.13, 0.10),
    'cloth_blue': (0.22, 0.32, 0.56), 'cloth_green': (0.26, 0.40, 0.25), 'shutter': (0.21, 0.40, 0.35), 'shutter2': (0.50, 0.17, 0.13),
    'rope': (0.67, 0.57, 0.38), 'hat': (0.30, 0.22, 0.14), 'logend': (0.80, 0.64, 0.43), 'bark': (0.30, 0.22, 0.15),
    'terracotta': (0.70, 0.33, 0.20), 'paper': (0.93, 0.89, 0.77), 'paper2': (0.87, 0.80, 0.62), 'ink': (0.22, 0.15, 0.10),
    'soil': (0.24, 0.16, 0.10), 'moss': (0.28, 0.38, 0.12), 'hay': (0.83, 0.69, 0.37), 'wax': (0.93, 0.87, 0.73),
    'wood_dark': (0.24, 0.16, 0.10), 'wood_light': (0.62, 0.46, 0.30), 'stone_l': (0.70, 0.67, 0.62), 'ember': (1.0, 0.55, 0.15),
}
PAL_KEYS = list(PAL)
def tex_palette(N=256, g=8):
    s = N // g
    c = np.zeros((N, N, 3))
    for i, k in enumerate(PAL_KEYS):
        r, q = divmod(i, g)
        c[r * s:(r + 1) * s, q * s:(q + 1) * s] = PAL[k]
    return c
def pal_uv(k):
    i = PAL_KEYS.index(k); r, q = divmod(i, 8)
    return ((q + 0.5) / 8, 1 - (r + 0.5) / 8)

pc, pn = tex_plaster(); IM = {'plaster': save_img('vp_plaster', pc), 'plaster_n': save_img('vp_plaster_n', pn, True)}
tc, tn = tex_timber(); IM['timber'] = save_img('vp_timber', tc); IM['timber_n'] = save_img('vp_timber_n', tn, True)
hc, hn = tex_thatch(); IM['thatch'] = save_img('vp_thatch', hc); IM['thatch_n'] = save_img('vp_thatch_n', hn[::2, ::2], True)
sc_, sn = tex_shingle(); IM['shingle'] = save_img('vp_shingle', sc_); IM['shingle_n'] = save_img('vp_shingle_n', sn, True)
IM['slate'] = save_img('vp_slate', tex_slate())
rc, rn = tex_rubble(); IM['stone'] = save_img('vp_stone', rc); IM['stone_n'] = save_img('vp_stone_n', rn[::2, ::2], True)
ac, an = tex_ashlar(); IM['ashlar'] = save_img('vp_ashlar', ac); IM['ashlar_n'] = save_img('vp_ashlar_n', an, True)
kc, kn = tex_planks(); IM['planks'] = save_img('vp_planks', kc); IM['planks_n'] = save_img('vp_planks_n', kn, True)
oc, on = tex_soil(); IM['soil'] = save_img('vp_soil', oc); IM['soil_n'] = save_img('vp_soil_n', on, True)
IM['palette'] = save_img('vp_palette', tex_palette())

# ───────────────────────── materials ─────────────────────────
def mat(name, img=None, nrm=None, color=(1, 1, 1), rough=0.85, metal=0.0, emit=None, estr=3.0, nstr=0.8, closest=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        if closest: t.interpolation = 'Closest'
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    if nrm:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nstr
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    m.use_backface_culling = True
    return m

M = {
    'plaster': mat('vp_plaster', IM['plaster'], IM['plaster_n'], rough=0.92, nstr=0.6),
    'timber': mat('vp_timber', IM['timber'], IM['timber_n'], rough=0.8),
    'thatch': mat('vp_thatch', IM['thatch'], IM['thatch_n'], rough=0.95, nstr=1.0),
    'shingle': mat('vp_shingle', IM['shingle'], IM['shingle_n'], rough=0.85),
    'slate': mat('vp_slate', IM['slate'], None, rough=0.55),
    'stone': mat('vp_stone', IM['stone'], IM['stone_n'], rough=0.9, nstr=1.0),
    'ashlar': mat('vp_ashlar', IM['ashlar'], IM['ashlar_n'], rough=0.85),
    'planks': mat('vp_planks', IM['planks'], IM['planks_n'], rough=0.8),
    'soil': mat('vp_soil', IM['soil'], IM['soil_n'], rough=1.0, nstr=1.0),
    'palette': mat('vp_palette', IM['palette'], None, rough=0.75, closest=True),
    'glow': mat('vp_glow', None, None, color=(0.95, 0.62, 0.28), rough=0.35, emit=(1.0, 0.60, 0.25), estr=3.0),
    'water': mat('vp_water', None, None, color=(0.10, 0.20, 0.22), rough=0.06),
}
TS = {'plaster': 2.4, 'timber': 1.4, 'thatch': 3.2, 'shingle': 2.0, 'slate': 2.0, 'stone': 2.6, 'ashlar': 1.8,
      'planks': 1.4, 'soil': 3.0, 'glow': 1.0, 'water': 2.0, 'palette': 1.0}

# ───────────────────────── builder ─────────────────────────
class Bld:
    def __init__(s, name):
        s.name = name; s.bm = bmesh.new(); s.uvl = s.bm.loops.layers.uv.new('UVMap'); s.mats = []
    def mi(s, m):
        mm = M[m]
        if mm not in s.mats: s.mats.append(mm)
        return s.mats.index(mm)

    @staticmethod
    def faces_of(verts): return list({f for v in verts for f in v.link_faces})

    def _uv(s, faces, m, pal, long_axis=None, S=None):
        if pal or m == 'palette':
            uv = pal_uv(pal or 'iron')
            for f in faces:
                for l in f.loops: l[s.uvl].uv = uv
            return
        S = S or TS[m]; ou, ov = R.random(), R.random()
        for f in faces:
            f.normal_update(); n = f.normal
            if long_axis is not None and abs(n.dot(long_axis)) < 0.9:
                b = (long_axis - n * n.dot(long_axis)).normalized(); t = b.cross(n)
            else:
                t = Vector((0, 0, 1)).cross(n)
                if t.length < 1e-4: t = Vector((1, 0, 0))
                t.normalize(); b = n.cross(t)
            for l in f.loops:
                p = l.vert.co; l[s.uvl].uv = (p.dot(t) / S + ou, p.dot(b) / S + ov)

    def _place(s, verts, loc, rot):
        M4 = Matrix.Translation(Vector(loc)) @ (rot if isinstance(rot, Matrix) else Euler(rot, 'XYZ').to_matrix()).to_4x4()
        bmesh.ops.transform(s.bm, matrix=M4, verts=verts)

    def _mat(s, faces, m, pal, smooth=False):
        idx = s.mi('palette' if pal else m)
        for f in faces: f.material_index = idx; f.smooth = smooth

    def box(s, size, loc, m, rot=(0, 0, 0), pal=None, grain=True, S=None):
        r = bmesh.ops.create_cube(s.bm, size=1.0, matrix=Matrix.Diagonal((*size, 1)))
        vs = r['verts']; fs = s.faces_of(vs)
        ax = max(range(3), key=lambda i: size[i]); L = Vector((0, 0, 0)); L[ax] = 1
        s._uv(fs, m, pal, L if grain and m in ('timber', 'planks') else None, S)
        s._place(vs, loc, rot); s._mat(fs, m, pal)
        return vs

    def obox(s, center, xdir, ydir, size, m, pal=None):
        x = Vector(xdir).normalized(); y = Vector(ydir); y = (y - x * y.dot(x)).normalized(); z = x.cross(y)
        Rm = Matrix((x, y, z)).transposed()
        return s.box(size, center, m, rot=Rm, pal=pal)

    def beam(s, a, b, w, dep, n, m='timber', pal=None, ext=0.0):
        a = Vector(a); b = Vector(b); n = Vector(n)
        d = b - a; L = d.length
        return s.obox((a + b) / 2 + n * (dep / 2), d, n, (L + ext, dep, w), m, pal)

    def cyl(s, r1, r2, h, loc, m, segs=12, rot=(0, 0, 0), pal=None, smooth=True, caps_pal=None):
        r = bmesh.ops.create_cone(s.bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
        vs = r['verts']; fs = s.faces_of(vs)
        for f in fs: f.normal_update()
        caps = [f for f in fs if abs(f.normal.z) > 0.999]; side = [f for f in fs if abs(f.normal.z) <= 0.999]
        if pal or m == 'palette':
            s._uv(fs, m, pal)
        else:
            S = TS[m]; ou = R.random(); circ = 2 * math.pi * max(r1, r2); reps = max(1, round(circ / S))
            for f in side:
                us = [math.atan2(l.vert.co.y, l.vert.co.x) / (2 * math.pi) for l in f.loops]
                if max(us) - min(us) > 0.5: us = [u + 1 if u < 0 else u for u in us]
                for l, u in zip(f.loops, us): l[s.uvl].uv = (u * reps + ou, (l.vert.co.z + h / 2) / S)
            s._uv(caps, m, None)
        s._place(vs, loc, rot)
        s._mat(side, m, pal, smooth); s._mat(caps, m, pal)
        if caps_pal:
            idx = s.mi('palette'); uv = pal_uv(caps_pal)
            for f in caps:
                f.material_index = idx
                for l in f.loops: l[s.uvl].uv = uv
        return vs

    def lathe(s, prof, loc, m, segs=12, rot=(0, 0, 0), pal=None, smooth=True, jitter=0.0, ribs=0, rib_amp=0.0, cap=True):
        """prof: [(r, z)] bottom→top. r == 0 at an end makes a pole."""
        bm = s.bm; rings = []
        S = TS.get(m, 1.0)
        acc = [0.0]
        for i in range(1, len(prof)):
            acc.append(acc[-1] + math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
        circ = 2 * math.pi * max(p[0] for p in prof); reps = max(1, round(circ / S)); ou = R.random()
        allv = []
        for j, (r, z) in enumerate(prof):
            ring = []
            for i in range(segs + 1):
                a = 2 * math.pi * (i % segs) / segs
                rr = r * (1 + rib_amp * (abs(math.cos(a * ribs / 2)) - 0.5) if ribs else 1)
                if jitter and 0 < j < len(prof) - 1:
                    rr *= 1 + jitter * (math.sin(a * 3 + j * 1.7) * 0.6 + math.sin(a * 7 + j * 2.9) * 0.4)
                v = bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)); ring.append(v); allv.append(v)
            rings.append(ring)
        faces = []
        for j in range(len(prof) - 1):
            for i in range(segs):
                q = (rings[j][i], rings[j][i + 1], rings[j + 1][i + 1], rings[j + 1][i])
                if prof[j][0] == 0 and prof[j + 1][0] == 0: continue
                try: f = bm.faces.new(q)
                except ValueError: continue
                faces.append(f)
                for l, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    l[s.uvl].uv = (ii / segs * reps + ou, acc[jj] / S) if not pal and m != 'palette' else pal_uv(pal or 'iron')
        capf = []
        if cap:
            for j in (0, len(prof) - 1):
                if prof[j][0] > 0:
                    f = bm.faces.new(rings[j][:segs] if j else list(reversed(rings[j][:segs]))); capf.append(f)
            s._uv(capf, m, pal)
        bmesh.ops.remove_doubles(bm, verts=allv, dist=1e-5)
        allv = [v for v in allv if v.is_valid]
        s._place(allv, loc, rot)
        s._mat(faces, m, pal, smooth); s._mat(capf, m, pal)
        return allv

    def prism_x(s, pts, x0, x1, m, nseg=1, pal=None, taper=None):
        """Extrude a closed (y, z) outline along X. taper(t, y, z) -> (y, z) per slice (t = 0..1)."""
        bm = s.bm; slices = []
        for k in range(nseg + 1):
            t = k / nseg; x = x0 + (x1 - x0) * t
            sl = []
            for (y, z) in pts:
                yy, zz = taper(t, y, z) if taper else (y, z)
                sl.append(bm.verts.new((x, yy, zz)))
            slices.append(sl)
        fs = []
        n = len(pts)
        for k in range(nseg):
            for i in range(n):
                fs.append(bm.faces.new((slices[k][i], slices[k][(i + 1) % n], slices[k + 1][(i + 1) % n], slices[k + 1][i])))
        fs.append(bm.faces.new(slices[0])); fs.append(bm.faces.new(list(reversed(slices[-1]))))
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        s._uv(fs, m, pal); s._mat(fs, m, pal)
        return [v for sl in slices for v in sl]

    def ico(s, r, loc, pal, scale=(1, 1, 1), rot=(0, 0, 0), smooth=True, m='palette'):
        res = bmesh.ops.create_icosphere(s.bm, subdivisions=1, radius=r, matrix=Matrix.Diagonal((*scale, 1)))
        vs = res['verts']; fs = s.faces_of(vs)
        s._uv(fs, m, pal if m == 'palette' else None)
        s._place(vs, loc, rot); s._mat(fs, m, pal if m == 'palette' else None, smooth)
        return vs

    def build(s, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(s.name); s.bm.normal_update(); s.bm.to_mesh(me); s.bm.free()
        for mm in s.mats: me.materials.append(mm)
        o = bpy.data.objects.new(s.name, me); bpy.context.scene.collection.objects.link(o)
        o.location = loc
        return o

def empty(name, parent, loc):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    e.empty_display_size = 0.2; e.parent = parent; e.location = loc
    return e

def tris_of(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

# ───────────────────────── shared pieces ─────────────────────────
def flowers(b, cx, cy, cz, w, seed=0):
    rr = random.Random(seed)
    cols = ['red', 'yellow', 'white', 'purple', 'pink', 'orange']
    for i in range(3):
        b.ico(0.13, (cx - w / 2 + w * (i + 0.5) / 3, cy, cz + 0.06), 'leaf' if i % 2 else 'leafdark', scale=(1.5, 0.9, 0.8))
    n = max(4, int(w / 0.13))
    for i in range(n):
        x = cx - w / 2 + 0.06 + (w - 0.12) * (i + rr.random() * 0.6) / n
        b.ico(0.065 + rr.random() * 0.03, (x, cy + rr.uniform(-0.07, 0.07), cz + 0.13 + rr.random() * 0.08), rr.choice(cols))

def lantern(b, x, y, z, parent_list, name='light'):
    """Hanging iron lantern, its glass centred at (x, y, z)."""
    b.box((0.2, 0.2, 0.26), (x, y, z), 'glow')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.03, 0.03, 0.3), (x + sx * 0.105, y + sy * 0.105, z), 'palette', pal='iron')
    b.box((0.26, 0.26, 0.035), (x, y, z - 0.15), 'palette', pal='iron')
    b.cyl(0.19, 0.03, 0.14, (x, y, z + 0.2), 'palette', segs=4, rot=(0, 0, math.pi / 4), pal='iron', smooth=False)
    b.cyl(0.04, 0.04, 0.05, (x, y, z + 0.29), 'palette', segs=6, rot=(math.pi / 2, 0, 0), pal='iron')
    parent_list.append((name, (x, y, z)))

# Wall face frame: origin o, horizontal tangent t, outward normal n
class Face:
    def __init__(s, o, t, n): s.o = Vector(o); s.t = Vector(t); s.n = Vector(n)
    def p(s, u, z, out=0.0): return s.o + s.t * u + Vector((0, 0, z)) + s.n * out

def fbeam(b, F, u0, z0, u1, z1, w=0.16, dep=0.06, m='timber', pal=None, ext=0.0):
    b.beam(F.p(u0, z0), F.p(u1, z1), w, dep, F.n, m, pal, ext)

def window(b, F, u, zc, w, h, style='timber', box=False, shutters=None, seed=0, frame_m='timber'):
    """Glass (glow) slightly proud of the wall + frame + leaded cross + sill (+ flower box / shutters)."""
    c = F.p(u, zc, 0.012)
    b.obox(c, F.t, F.n, (w, 0.03, h), 'glow')
    fw = 0.11 if style == 'timber' else 0.16
    fm = frame_m
    fbeam(b, F, u - w / 2 - fw / 2, zc - h / 2 - fw, u - w / 2 - fw / 2, zc + h / 2 + fw, fw, 0.08, fm)
    fbeam(b, F, u + w / 2 + fw / 2, zc - h / 2 - fw, u + w / 2 + fw / 2, zc + h / 2 + fw, fw, 0.08, fm)
    fbeam(b, F, u - w / 2 - fw, zc + h / 2 + fw / 2, u + w / 2 + fw, zc + h / 2 + fw / 2, fw, 0.09, fm)
    # mullion + transom (dark leaded)
    fbeam(b, F, u, zc - h / 2, u, zc + h / 2, 0.045, 0.05, 'palette', pal='wood_dark')
    fbeam(b, F, u - w / 2, zc + h * 0.12, u + w / 2, zc + h * 0.12, 0.04, 0.05, 'palette', pal='wood_dark')
    # sill
    b.obox(F.p(u, zc - h / 2 - 0.05, 0.08), F.t, F.n, (w + 0.34, 0.16, 0.07), 'planks' if style == 'timber' else 'ashlar')
    if box:
        b.obox(F.p(u, zc - h / 2 - 0.2, 0.2), F.t, F.n, (w + 0.2, 0.24, 0.2), 'planks')
        cc = F.p(u, zc - h / 2 - 0.13, 0.2)
        # flowers in the box (local frame: along t)
        rr = random.Random(seed)
        cols = ['red', 'yellow', 'white', 'purple', 'pink', 'orange']
        for i in range(3):
            q = cc + F.t * ((i - 1) * (w + 0.1) / 3)
            b.ico(0.12, q, 'leaf' if i % 2 else 'leafdark', scale=(1.5, 1.0, 0.8))
        n = 6
        for i in range(n):
            q = cc + F.t * ((i + 0.5) / n - 0.5) * (w + 0.1) + F.n * rr.uniform(-0.06, 0.06) + Vector((0, 0, 0.1 + rr.random() * 0.07))
            b.ico(0.06 + rr.random() * 0.03, q, rr.choice(cols))
        # trailing ivy
        for i in range(3):
            q = cc + F.t * ((i - 1) * w / 3) + F.n * 0.12 + Vector((0, 0, -0.16))
            b.ico(0.07, q, 'leaf2', scale=(0.8, 0.6, 1.6))
    if shutters:
        for sd in (-1, 1):
            q = F.p(u + sd * (w / 2 + fw + w * 0.27), zc, 0.05)
            b.obox(q, F.t, F.n, (w * 0.52, 0.05, h + 0.1), 'planks')
            b.obox(q + F.n * 0.03, F.t, F.n, (w * 0.5, 0.02, h + 0.08), 'palette', pal=shutters)
            for zz in (-h * 0.3, h * 0.3):
                b.obox(q + F.n * 0.045 + Vector((0, 0, zz)), F.t, F.n, (w * 0.5, 0.02, 0.06), 'palette', pal='iron')

def door(b, F, u, w=1.0, h=1.95, z0=0.3, frame_m='timber', arch=False):
    c = F.p(u, z0 + h / 2, 0.03)
    b.obox(c, F.t, F.n, (w, 0.06, h), 'planks')
    # braces (Z-pattern)
    for zz in (0.25, h - 0.3):
        b.obox(F.p(u, z0 + zz, 0.07), F.t, F.n, (w - 0.08, 0.04, 0.12), 'planks')
    b.beam(F.p(u - w / 2 + 0.08, z0 + 0.3, 0.07), F.p(u + w / 2 - 0.08, z0 + h - 0.35, 0.07), 0.11, 0.035, F.n, 'planks')
    # hinges + ring handle
    for zz in (0.35, h - 0.35):
        b.obox(F.p(u - w / 2 + 0.25, z0 + zz, 0.1), F.t, F.n, (0.45, 0.02, 0.05), 'palette', pal='iron')
    b.cyl(0.06, 0.06, 0.03, F.p(u + w / 2 - 0.18, z0 + 1.0, 0.11), 'palette', segs=8, pal='iron',
          rot=Matrix((F.t, Vector((0, 0, 1)), F.n)).transposed().to_euler())
    fw = 0.15
    fbeam(b, F, u - w / 2 - fw / 2, z0, u - w / 2 - fw / 2, z0 + h + fw, fw, 0.1, frame_m)
    fbeam(b, F, u + w / 2 + fw / 2, z0, u + w / 2 + fw / 2, z0 + h + fw, fw, 0.1, frame_m)
    fbeam(b, F, u - w / 2 - fw, z0 + h + fw / 2, u + w / 2 + fw, z0 + h + fw / 2, fw + 0.04, 0.12, frame_m)
    # step stone
    b.obox(F.p(u, z0 - 0.1, 0.3), F.t, F.n, (w + 0.5, 0.6, 0.2 + z0), 'ashlar')

def roof(b, W, d, zt, pitch, ovx, ove, th, m, style='plain', nseg=1):
    tp = math.tan(pitch); e = d + ove
    zA = zt - ove * tp; zR = zt + d * tp; h = th / math.cos(pitch)
    if style == 'thatch':
        pts = [(-e, zA), (0, zR), (e, zA),
               (e + 0.08, zA + 0.45 * h), (e - 0.05, zA + h),
               (0.42, zR + h - 0.42 * tp + 0.08), (0.22, zR + h + 0.1), (0, zR + h + 0.14), (-0.22, zR + h + 0.1), (-0.42, zR + h - 0.42 * tp + 0.08),
               (-e + 0.05, zA + h), (-e - 0.08, zA + 0.45 * h)]
        def taper(t, y, z):
            k = 1 - 0.10 * (1 - math.sin(math.pi * t)) ** 3
            return (y * (0.97 + 0.03 * k), zA + (z - zA) * k)
        vs = b.prism_x(pts, -W / 2 - ovx, W / 2 + ovx, m, nseg=nseg, taper=taper)
        rr = random.Random(int(W * 100))
        for v in vs:
            v.co.z += rr.uniform(-0.035, 0.035); v.co.y += rr.uniform(-0.02, 0.02)
    else:
        pts = [(-e, zA), (0, zR), (e, zA), (e, zA + h), (0, zR + h), (-e, zA + h)]
        b.prism_x(pts, -W / 2 - ovx, W / 2 + ovx, m)
        # ridge board + barge boards
        b.box((W + 2 * ovx + 0.1, 0.22, 0.22), (0, 0, zR + h + 0.02), 'timber', rot=(math.pi / 4, 0, 0))
        for sx in (-1, 1):
            x = sx * (W / 2 + ovx + 0.03)
            for sy in (-1, 1):
                a = Vector((x, sy * (e + 0.02), zA + h * 0.5)); c = Vector((x, 0, zR + h * 0.5 + 0.02))
                b.beam(a, c, 0.24, 0.06, Vector((sx, 0, 0)), 'timber', ext=0.1)
    return zR + h

def shell(b, W, D, zb, zt, pitch, m, gable=True):
    d = D / 2; tp = math.tan(pitch)
    pts = [(-d, zb), (d, zb), (d, zt), (0, zt + d * tp - 0.03), (-d, zt)] if gable else [(-d, zb), (d, zb), (d, zt), (-d, zt)]
    b.prism_x(pts, -W / 2, W / 2, m)

def chimney(b, x, y, zb, ztop, w, dpt, empties, m='stone'):
    b.box((w, dpt, ztop - zb), (x, y, (zb + ztop) / 2), m)
    b.box((w + 0.16, dpt + 0.16, 0.14), (x, y, ztop - 0.25), 'ashlar')
    b.box((w + 0.1, dpt + 0.1, 0.1), (x, y, ztop + 0.05), 'ashlar')
    b.cyl(0.13, 0.11, 0.35, (x, y, ztop + 0.27), 'palette', segs=8, pal='terracotta', caps_pal='black')
    empties.append(('smoke', (x, y, ztop + 0.5)))

def timber_wall(b, F, u0, u1, zb, zt, openings, braces=True, mid=None, pitch=None):
    """Half-timbering on a plaster face: sole plate, top plate, posts, mid rail, diagonal braces avoiding openings."""
    fbeam(b, F, u0, zb + 0.09, u1, zb + 0.09, 0.18, 0.07)
    fbeam(b, F, u0, zt - 0.09, u1, zt - 0.09, 0.18, 0.07)
    fbeam(b, F, u0 + 0.09, zb, u0 + 0.09, zt, 0.18, 0.08)
    fbeam(b, F, u1 - 0.09, zb, u1 - 0.09, zt, 0.18, 0.08)
    mid = mid if mid is not None else (zb + zt) / 2 + 0.1
    L = u1 - u0; n = max(2, round(L / 1.25)); step = L / n
    posts = [u0 + step * i for i in range(1, n)]
    def blocked(ua, ub, za, zb_):
        for (ou, oz0, ow, oh) in openings:
            if ua < ou + ow / 2 + 0.12 and ub > ou - ow / 2 - 0.12 and za < oz0 + oh + 0.12 and zb_ > oz0 - 0.12: return True
        return False
    for u in posts:
        if not blocked(u - 0.08, u + 0.08, zb, zt): fbeam(b, F, u, zb, u, zt, 0.15, 0.06)
    edges = [u0 + 0.09] + posts + [u1 - 0.09]
    for i in range(len(edges) - 1):
        a, c = edges[i], edges[i + 1]
        if not blocked(a, c, mid - 0.07, mid + 0.07): fbeam(b, F, a, mid, c, mid, 0.13, 0.055)
        if braces and not blocked(a, c, zb, zt):
            if i % 2 == 0: fbeam(b, F, a, zb + 0.15, c, mid - 0.05, 0.13, 0.05, ext=0.05)
            else: fbeam(b, F, a, mid - 0.05, c, zb + 0.15, 0.13, 0.05, ext=0.05)
            fbeam(b, F, a, mid + 0.05, c, zt - 0.15, 0.12, 0.05, ext=0.05) if i % 2 else fbeam(b, F, a, zt - 0.15, c, mid + 0.05, 0.12, 0.05, ext=0.05)

def gable_timber(b, F, d, zt, pitch, win=None):
    tp = math.tan(pitch); apex = zt + d * tp
    fbeam(b, F, -d, zt + 0.08, d, zt + 0.08, 0.18, 0.07)
    k0 = zt + 0.1 if win is None else zt + win + 0.15
    if apex - 0.1 > k0 + 0.2: fbeam(b, F, 0, k0, 0, apex - 0.1, 0.16, 0.06)
    u0 = 0.1 if win is None else 0.5
    for sd in (-1, 1):
        fbeam(b, F, sd * u0, zt + 0.25, sd * d * 0.68, zt + d * 0.3 * tp - 0.05, 0.13, 0.05)
        fbeam(b, F, sd * d * 0.5, zt + 0.1, sd * d * 0.5, zt + d * 0.5 * tp - 0.12, 0.13, 0.05)

def corner_quoins(b, W, D, zb, zt, m='ashlar'):
    z = zb; k = 0
    while z < zt - 0.2:
        hgt = 0.32
        for sx in (-1, 1):
            for sy in (-1, 1):
                long_x = (k % 2 == 0)
                sx_ = 0.55 if long_x else 0.3; sy_ = 0.3 if long_x else 0.55
                b.box((sx_, sy_, hgt - 0.02), (sx * (W / 2 - sx_ / 2 + 0.03), sy * (D / 2 - sy_ / 2 + 0.03), z + hgt / 2), m)
        z += hgt; k += 1

# ───────────────────────── props ─────────────────────────
PROPS = {}      # name -> (root object, [(empty_name, loc)], extra objects)
def prop(name):
    def deco(fn):
        PROPS[name] = fn; return fn
    return deco

FRONT = Face((0, 0, 0), (1, 0, 0), (0, -1, 0))

@prop('cottage_a')
def cottage_a():
    """Thatched half-timbered cottage with an outside stone chimney stack and flower boxes."""
    b = Bld('vp_cottage_a'); E = []
    W, D, z0, zt, P = 7.0, 4.8, 0.35, 2.75, math.radians(50)
    d = D / 2
    b.box((W + 0.3, D + 0.3, 1.5), (0, 0, z0 - 0.75), 'stone')
    shell(b, W, D, z0, zt, P, 'plaster')
    Ff = Face((0, -d, 0), (1, 0, 0), (0, -1, 0)); Fb = Face((0, d, 0), (-1, 0, 0), (0, 1, 0))
    Fl = Face((-W / 2, 0, 0), (0, -1, 0), (-1, 0, 0)); Fr = Face((W / 2, 0, 0), (0, 1, 0), (1, 0, 0))
    wins_f = [(-2.2, 1.65, 0.9, 0.85), (1.6, 1.65, 1.1, 0.85)]
    door_u = -0.5
    timber_wall(b, Ff, -W / 2, W / 2, z0, zt, [(u, zc - h / 2, w, h) for u, zc, w, h in wins_f] + [(door_u, z0, 1.0, 2.05)])
    timber_wall(b, Fb, -W / 2, W / 2, z0, zt, [(0.8, 1.2, 0.9, 0.85)])
    for F in (Fl, Fr):
        timber_wall(b, F, -d, d, z0, zt, [(0, 1.2, 0.8, 0.8)] if F is Fl else [], braces=True)
        gable_timber(b, F, d, zt, P, win=1.3 if F is Fl else None)
    for i, (u, zc, w, h) in enumerate(wins_f): window(b, Ff, u, zc, w, h, box=True, seed=i)
    window(b, Fb, 0.8, 1.65, 0.9, 0.85)
    window(b, Fl, 0, 1.65, 0.8, 0.8, box=True, seed=7)
    window(b, Fl, 0, zt + 0.9, 0.55, 0.55)
    door(b, Ff, door_u)
    top = roof(b, W, d, zt, P, 0.45, 0.45, 0.42, 'thatch', 'thatch', nseg=8)
    # external chimney stack on the right gable
    cx = W / 2 + 0.45
    b.box((1.2, 1.2, zt + 0.4), (cx, 0.6, (zt + 0.4) / 2 - 0.3), 'stone')
    b.box((1.25, 1.25, 0.12), (cx, 0.6, zt - 0.05), 'ashlar')
    chimney(b, cx, 0.6, zt, top + 0.7, 0.8, 0.8, E)
    # door lantern, bench, potted flowers
    lantern(b, door_u + 0.95, -d - 0.38, 2.05, E, 'light')
    b.box((0.06, 0.4, 0.06), (door_u + 0.95, -d - 0.2, 2.42), 'palette', pal='iron')
    b.box((1.5, 0.36, 0.07), (-3.0 + 0.1, -d - 0.45, 0.78), 'planks')
    for sx in (-0.6, 0.6): b.box((0.08, 0.3, 0.45), (-2.9 + sx, -d - 0.45, 0.52), 'timber')
    b.lathe([(0.2, 0.3), (0.26, 0.62), (0.28, 0.66), (0.22, 0.66)], (2.95, -d - 0.45, 0), 'palette', segs=10, pal='terracotta')
    flowers(b, 2.95, -d - 0.45, 0.6, 0.4, seed=3)
    return b.build(), E

@prop('cottage_b')
def cottage_b():
    """Low fieldstone cottage, slate roof, painted shutters, lean-to woodshed."""
    b = Bld('vp_cottage_b'); E = []
    W, D, z0, zt, P = 6.4, 4.6, 0.3, 2.5, math.radians(40)
    d = D / 2
    b.box((W + 0.35, D + 0.35, 1.5), (0, 0, z0 - 0.75), 'stone')
    shell(b, W, D, z0, zt, P, 'stone')
    corner_quoins(b, W, D, z0, zt)
    Ff = Face((0, -d, 0), (1, 0, 0), (0, -1, 0)); Fb = Face((0, d, 0), (-1, 0, 0), (0, 1, 0))
    Fl = Face((-W / 2, 0, 0), (0, -1, 0), (-1, 0, 0)); Fr = Face((W / 2, 0, 0), (0, 1, 0), (1, 0, 0))
    window(b, Ff, -1.9, 1.5, 0.8, 0.9, style='stone', shutters='shutter', frame_m='ashlar', box=True, seed=11)
    window(b, Ff, 1.9, 1.5, 0.8, 0.9, style='stone', shutters='shutter', frame_m='ashlar')
    window(b, Fb, 0.0, 1.5, 0.8, 0.9, style='stone', shutters='shutter', frame_m='ashlar')
    window(b, Fr, 0.0, zt + 0.7, 0.5, 0.55, style='stone', frame_m='ashlar')
    door(b, Ff, 0.0, w=1.0, h=1.9, z0=z0, frame_m='ashlar')
    top = roof(b, W, d, zt, P, 0.3, 0.45, 0.16, 'slate')
    chimney(b, -W / 2 + 0.55, 0.0, zt - 0.5, top + 0.6, 0.75, 0.75, E)
    # lean-to woodshed on the right
    sx0, sx1 = W / 2, W / 2 + 1.6
    for y in (-d + 0.2, d - 0.2):
        b.box((0.14, 0.14, 1.9), (sx1 - 0.1, y, 0.95), 'timber')
    zl0, zl1 = 2.1, 1.75
    ang = math.atan2(zl0 - zl1, sx1 - sx0)
    b.box((1.9, D + 0.3, 0.1), ((sx0 + sx1) / 2 + 0.1, 0, (zl0 + zl1) / 2 + 0.06), 'shingle', rot=(0, ang, 0))
    b.box((1.6, D - 0.2, 0.08), ((sx0 + sx1) / 2, 0, 0.04), 'planks')
    for row in range(4):
        for i in range(9):
            y = -d + 0.45 + i * 0.45 + (row % 2) * 0.22
            if y > d - 0.3: continue
            b.cyl(0.13, 0.13, 1.3, ((sx0 + sx1) / 2, y, 0.2 + row * 0.24), 'timber', segs=7, rot=(0, math.pi / 2, 0), caps_pal='logend', smooth=False)
    # rain barrel + bench
    b.lathe([(0.32, 0), (0.37, 0.4), (0.32, 0.8), (0.3, 0.8)], (-W / 2 + 0.2, -d - 0.5, 0), 'planks', segs=12)
    b.cyl(0.29, 0.29, 0.02, (-W / 2 + 0.2, -d - 0.5, 0.76), 'water', segs=12)
    for zz in (0.12, 0.68): b.lathe([(0.35, zz), (0.37, zz + 0.04), (0.35, zz + 0.08)], (-W / 2 + 0.2, -d - 0.5, 0), 'palette', segs=12, pal='iron', cap=False)
    lantern(b, 0.85, -d - 0.32, 2.15, E)
    b.box((0.05, 0.36, 0.05), (0.85, -d - 0.16, 2.5), 'palette', pal='iron')
    return b.build(), E

@prop('cottage_c')
def cottage_c():
    """Two-storey house: stone ground floor, jettied half-timbered upper floor, steep shingle roof."""
    b = Bld('vp_cottage_c'); E = []
    W, D, z0, z1, zt, P, J = 6.0, 4.8, 0.3, 2.6, 5.0, math.radians(54), 0.35
    d = D / 2
    b.box((W + 0.3, D + 0.3, 1.4), (0, 0, z0 - 0.7), 'stone')
    b.box((W, D, z1 - z0), (0, 0, (z0 + z1) / 2), 'stone')
    corner_quoins(b, W, D, z0, z1 - 0.1)
    # jetty joists
    for i in range(13):
        x = -W / 2 + 0.2 + i * (W - 0.4) / 12
        b.box((0.13, D + 2 * J + 0.1, 0.16), (x, 0, z1 + 0.08), 'timber')
    b.box((W + 0.1, D + 2 * J, 0.06), (0, 0, z1 + 0.19), 'timber')
    D2 = D + 2 * J; d2 = D2 / 2
    shell(b, W, D2, z1 + 0.22, zt, P, 'plaster')
    Ff = Face((0, -d, 0), (1, 0, 0), (0, -1, 0)); Fb = Face((0, d, 0), (-1, 0, 0), (0, 1, 0))
    Uf = Face((0, -d2, 0), (1, 0, 0), (0, -1, 0)); Ub = Face((0, d2, 0), (-1, 0, 0), (0, 1, 0))
    Ul = Face((-W / 2, 0, 0), (0, -1, 0), (-1, 0, 0)); Ur = Face((W / 2, 0, 0), (0, 1, 0), (1, 0, 0))
    Gl = Ul; Gr = Ur
    upw = [(-1.9, 3.75, 0.8, 0.85), (0.0, 3.75, 0.8, 0.85), (1.9, 3.75, 0.8, 0.85)]
    timber_wall(b, Uf, -W / 2, W / 2, z1 + 0.22, zt, [(u, zc - h / 2, w, h) for u, zc, w, h in upw])
    timber_wall(b, Ub, -W / 2, W / 2, z1 + 0.22, zt, [(0, 3.3, 0.8, 0.85)])
    for F in (Ul, Ur):
        timber_wall(b, F, -d2, d2, z1 + 0.22, zt, [(0, 3.3, 0.8, 0.85)] if F is Ul else [])
        gable_timber(b, F, d2, zt, P, win=1.55)
    for i, (u, zc, w, h) in enumerate(upw): window(b, Uf, u, zc, w, h, box=(i != 1), seed=20 + i)
    window(b, Ub, 0, 3.75, 0.8, 0.85)
    window(b, Ul, 0, 3.75, 0.8, 0.85, box=True, seed=31)
    window(b, Ul, 0, zt + 1.1, 0.55, 0.6)
    window(b, Ur, 0, zt + 1.1, 0.55, 0.6)
    window(b, Ff, -1.7, 1.45, 1.1, 0.85, style='stone', frame_m='ashlar', shutters='shutter2')
    window(b, Fb, 1.0, 1.45, 0.8, 0.8, style='stone', frame_m='ashlar')
    door(b, Ff, 1.2, w=1.05, h=1.95, z0=z0, frame_m='ashlar')
    top = roof(b, W, d2, zt, P, 0.35, 0.4, 0.15, 'shingle')
    chimney(b, 1.4, 0.55, zt, top + 0.55, 0.8, 0.7, E)
    # hanging trade sign (blank board on an iron bracket)
    b.box((0.06, 0.9, 0.06), (W / 2 - 0.4, -d - 0.45, 2.35), 'palette', pal='iron')
    b.box((0.06, 0.62, 0.48), (W / 2 - 0.4, -d - 0.62, 2.0), 'planks')
    b.box((0.08, 0.55, 0.4), (W / 2 - 0.4, -d - 0.62, 2.0), 'palette', pal='gold')
    lantern(b, 0.25, -d - 0.35, 2.15, E)
    b.box((0.05, 0.36, 0.05), (0.25, -d - 0.17, 2.5), 'palette', pal='iron')
    # barrels by the door
    for (x, y) in ((2.35, -d - 0.5), (2.9, -d - 0.75)):
        b.lathe([(0.27, 0), (0.32, 0.36), (0.27, 0.72), (0.25, 0.72)], (x, y, 0), 'planks', segs=12)
        for zz in (0.1, 0.6): b.lathe([(0.3, zz), (0.32, zz + 0.04), (0.3, zz + 0.08)], (x, y, 0), 'palette', segs=12, pal='iron', cap=False)
    return b.build(), E

@prop('cottage_d')
def cottage_d():
    """Small fieldstone croft with a heavy thatch, timber gable, porch and rain butt."""
    b = Bld('vp_cottage_d'); E = []
    W, D, z0, zt, P = 5.2, 4.2, 0.3, 2.35, math.radians(50)
    d = D / 2
    b.box((W + 0.3, D + 0.3, 1.4), (0, 0, z0 - 0.7), 'stone')
    shell(b, W, D, z0, zt, P, 'stone')
    Ff = Face((0, -d, 0), (1, 0, 0), (0, -1, 0)); Fb = Face((0, d, 0), (-1, 0, 0), (0, 1, 0))
    Fl = Face((-W / 2, 0, 0), (0, -1, 0), (-1, 0, 0)); Fr = Face((W / 2, 0, 0), (0, 1, 0), (1, 0, 0))
    # timber+plaster gable triangles over stone walls
    tp = math.tan(P)
    for F, sx in ((Fl, -1), (Fr, 1)):
        pts = [(-d + 0.02, zt), (d - 0.02, zt), (0, zt + d * tp - 0.1)]
        bm = b.bm
        vs = [bm.verts.new(F.p(u, z, 0.025)) for u, z in pts]
        f = bm.faces.new(vs if sx < 0 else list(reversed(vs)))
        f.normal_update()
        if f.normal.dot(F.n) < 0: f.normal_flip()
        b._uv([f], 'plaster', None); f.material_index = b.mi('plaster')
        gable_timber(b, F, d, zt, P, win=1.15 if F is Fl else None)
    window(b, Ff, 1.3, 1.35, 0.75, 0.75, style='stone', frame_m='timber', box=True, seed=41)
    window(b, Fb, -0.8, 1.35, 0.7, 0.7, style='stone', frame_m='timber')
    window(b, Fl, 0, zt + 0.75, 0.5, 0.5)
    door(b, Ff, -0.9, w=0.95, h=1.8, z0=z0)
    top = roof(b, W, d, zt, P, 0.4, 0.35, 0.5, 'thatch', 'thatch', nseg=7)
    chimney(b, W / 2 - 0.6, 0.55, zt - 0.3, top + 0.45, 0.7, 0.7, E)
    # bench under the eave
    b.box((1.3, 0.34, 0.07), (0.55 + 1.2, -d - 0.4, 0.75), 'planks')
    for sx in (-0.5, 0.5): b.box((0.08, 0.28, 0.42), (1.75 + sx, -d - 0.4, 0.5), 'timber')
    # rain butt, sacks, pumpkins by the door
    b.lathe([(0.3, 0), (0.34, 0.35), (0.3, 0.7), (0.28, 0.7)], (-2.3, -d - 0.45, 0), 'planks', segs=12)
    b.cyl(0.27, 0.27, 0.02, (-2.3, -d - 0.45, 0.66), 'water', segs=12)
    for zz in (0.1, 0.55): b.lathe([(0.32, zz), (0.34, zz + 0.04), (0.32, zz + 0.08)], (-2.3, -d - 0.45, 0), 'palette', segs=12, pal='iron', cap=False)
    pumpkin(b, 0.0, -d - 0.75, 0, 0.26)
    pumpkin(b, 0.4, -d - 0.6, 0, 0.2, col='pumpkin2')
    sack(b, -2.0, -d - 1.0, 0, 0.3)
    return b.build(), E

def pumpkin(b, x, y, z, r=0.25, col='pumpkin'):
    prof = [(0.0, 0), (r * 0.7, r * 0.05), (r, r * 0.45), (r * 0.95, r * 0.95), (r * 0.6, r * 1.3), (r * 0.15, r * 1.35), (0, r * 1.28)]
    b.lathe(prof, (x, y, z), 'palette', segs=12, pal=col, ribs=8, rib_amp=0.12)
    b.cyl(r * 0.12, r * 0.08, r * 0.35, (x, y, z + r * 1.4), 'palette', segs=5, pal='stem', rot=(0.25, 0, 0))

def sack(b, x, y, z, r=0.3, rot=0.0):
    prof = [(0, 0), (r * 0.9, 0.02), (r, r * 0.6), (r * 0.85, r * 1.5), (r * 0.35, r * 1.85), (r * 0.2, r * 2.0), (r * 0.3, r * 2.15), (0, r * 2.2)]
    b.lathe(prof, (x, y, z), 'palette', segs=9, pal='sack', jitter=0.06, rot=(0, rot, 0))

@prop('well')
def well():
    b = Bld('vp_well'); E = []
    ring = [(0.72, -0.2), (1.08, -0.2), (1.08, 0.72), (1.14, 0.76), (1.14, 0.9), (0.66, 0.9), (0.66, 0.76), (0.72, 0.72), (0.72, -0.2)]
    # tube: outer lathe (stone) + inner lathe facing inward + top rim (ashlar)
    b.lathe([(1.08, -0.3), (1.08, 0.72)], (0, 0, 0), 'stone', segs=16, cap=False, smooth=False)
    v = b.lathe([(0.72, 0.72), (0.72, -0.3)], (0, 0, 0), 'stone', segs=16, cap=False, smooth=False)
    b.lathe([(1.08, 0.72), (1.15, 0.76), (1.15, 0.9), (0.66, 0.9), (0.66, 0.76), (0.72, 0.72)], (0, 0, 0), 'ashlar', segs=16, cap=False, smooth=False)
    b.cyl(0.72, 0.72, 0.04, (0, 0, 0.12), 'water', segs=16)
    # posts, crossbar, roof
    for sx in (-1, 1):
        b.box((0.16, 0.16, 2.3), (sx * 0.98, 0, 1.75), 'timber')
        b.box((0.1, 0.5, 0.1), (sx * 0.98, 0, 0.95), 'timber')
    b.cyl(0.09, 0.09, 2.15, (0, 0, 1.75), 'timber', segs=8, rot=(0, math.pi / 2, 0))
    b.cyl(0.13, 0.13, 0.5, (0, 0, 1.75), 'palette', segs=10, rot=(0, math.pi / 2, 0), pal='rope')
    # crank
    b.box((0.05, 0.05, 0.45), (1.12, 0, 1.55), 'palette', pal='iron')
    b.box((0.05, 0.3, 0.05), (1.12, -0.12, 1.33), 'palette', pal='iron')
    b.box((0.09, 0.09, 0.24), (1.2, -0.27, 1.33), 'timber', rot=(0, math.pi / 2, 0))
    # rope + bucket hanging
    b.cyl(0.015, 0.015, 0.55, (0, 0, 1.38), 'palette', segs=4, pal='rope')
    bk = [(0.15, 0.82), (0.19, 1.1), (0.17, 1.1)]
    b.lathe([(0.0, 0.82), (0.15, 0.82), (0.19, 1.1), (0.17, 1.1), (0.13, 0.86)], (0, 0, 0.05), 'planks', segs=10)
    b.lathe([(0.18, 1.02), (0.2, 1.04), (0.18, 1.06)], (0, 0, 0.05), 'palette', segs=10, pal='iron', cap=False)
    b.box((0.4, 0.02, 0.02), (0, 0, 1.22), 'palette', pal='iron')
    # second bucket on the rim
    b.lathe([(0.0, 0.0), (0.14, 0.0), (0.18, 0.28), (0.16, 0.28), (0.12, 0.04)], (0.62, -0.55, 0.9), 'planks', segs=10)
    roof(b, 2.0, 0.85, 2.9, math.radians(42), 0.15, 0.25, 0.08, 'shingle')
    for sx in (-1, 1):
        b.box((0.12, 1.5, 0.1), (sx * 0.98, 0, 2.85), 'timber')
    return b.build(), E

@prop('fountain')
def fountain():
    b = Bld('vp_fountain'); E = []
    o = 8
    b.lathe([(2.35, -0.25), (2.35, 0.15), (2.2, 0.2), (2.2, 0.55), (2.35, 0.6), (2.35, 0.72), (1.95, 0.72), (1.95, 0.6)], (0, 0, 0), 'ashlar', segs=o, smooth=False, rot=(0, 0, math.pi / 8), cap=False)
    b.lathe([(1.95, 0.6), (1.95, 0.0)], (0, 0, 0), 'ashlar', segs=o, smooth=False, rot=(0, 0, math.pi / 8), cap=False)
    b.cyl(2.0, 2.0, 0.04, (0, 0, 0.5), 'water', segs=o, rot=(0, 0, math.pi / 8))
    b.lathe([(0.55, 0.45), (0.55, 0.7), (0.32, 0.85), (0.28, 1.5), (0.42, 1.62), (0.95, 1.72), (1.0, 1.85), (0.9, 1.88), (0.4, 1.82),
             (0.22, 1.95), (0.18, 2.5), (0.28, 2.6), (0.28, 2.72), (0.12, 2.8), (0.16, 3.0), (0.0, 3.12)], (0, 0, 0), 'ashlar', segs=12)
    b.cyl(0.88, 0.88, 0.03, (0, 0, 1.84), 'water', segs=12)
    # four water jets pouring from the upper bowl + splashes
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        x, y = math.cos(a) * 0.98, math.sin(a) * 0.98
        b.cyl(0.025, 0.04, 1.3, (x * 1.02, y * 1.02, 1.17), 'water', segs=5)
        b.ico(0.13, (x * 1.04, y * 1.04, 0.53), 'white', scale=(1.2, 1.2, 0.35))
    # gold crown finial (King 최상호)
    b.cyl(0.16, 0.2, 0.14, (0, 0, 3.15), 'palette', segs=8, pal='gold')
    for k in range(5):
        a = k * 2 * math.pi / 5
        b.cyl(0.04, 0.0, 0.14, (math.cos(a) * 0.17, math.sin(a) * 0.17, 3.29), 'palette', segs=4, pal='gold')
    return b.build(), E

@prop('haystack')
def haystack():
    b = Bld('vp_haystack'); E = []
    b.lathe([(1.35, -0.1), (1.5, 0.45), (1.42, 1.1), (1.1, 1.75), (0.6, 2.2), (0.18, 2.45), (0.0, 2.5)], (0, 0, 0), 'thatch', segs=14, jitter=0.05)
    b.cyl(0.05, 0.04, 1.2, (0.0, 0.0, 2.7), 'timber', segs=5)
    # loose hay at the foot
    for k in range(7):
        a = k * 0.9 + 0.3
        b.lathe([(0.35, 0), (0.25, 0.18), (0, 0.26)], (math.cos(a) * 1.55, math.sin(a) * 1.55, -0.05), 'thatch', segs=6, jitter=0.1)
    # pitchfork leaning
    b.box((0.04, 0.04, 2.0), (1.45, -0.6, 1.0), 'timber', rot=(0, -0.25, 0.3))
    return b.build(), E

@prop('bales')
def bales():
    b = Bld('vp_bales'); E = []
    def bale(x, y, z, rz=0.0):
        b.box((1.0, 0.52, 0.42), (x, y, z + 0.21), 'thatch', rot=(0, 0, rz))
        for k in (-0.25, 0.25):
            c, s_ = math.cos(rz), math.sin(rz)
            b.box((0.03, 0.54, 0.44), (x + c * k, y + s_ * k, z + 0.21), 'palette', pal='rope', rot=(0, 0, rz))
    bale(0, -0.3, 0); bale(0.05, 0.3, 0, 0.05); bale(1.1, 0.0, 0, 1.4); bale(0.05, 0.0, 0.42, 0.1)
    return b.build(), E

@prop('fence')
def fence():
    """2.4 m split-rail segment from x = 0 to x = 2.4 (post at x = 0, thinner hidden post at the far end)."""
    b = Bld('vp_fence'); E = []
    L = 2.4
    b.box((0.13, 0.13, 1.35), (0, 0, 0.375), 'timber')
    b.cyl(0.08, 0.04, 0.08, (0, 0, 1.09), 'timber', segs=4, rot=(0, 0, math.pi / 4), smooth=False)
    b.box((0.11, 0.11, 1.3), (L, 0, 0.35), 'timber')
    b.box((L + 0.1, 0.08, 0.11), (L / 2, 0.075, 0.42), 'timber', rot=(0, -0.02, 0))
    b.box((L + 0.1, 0.08, 0.11), (L / 2, 0.075, 0.82), 'timber', rot=(0, 0.015, 0))
    return b.build(), E

@prop('cart')
def cart():
    b = Bld('vp_cart'); E = []
    zb = 0.72
    b.box((1.3, 2.0, 0.08), (0, 0, zb), 'planks')
    for sx in (-1, 1):
        b.box((0.06, 2.0, 0.35), (sx * 0.65, 0, zb + 0.2), 'planks')
        b.box((0.1, 3.6, 0.1), (sx * 0.5, -0.8, zb - 0.08), 'timber')
        for y in (-0.9, 0.0, 0.9): b.box((0.07, 0.07, 0.48), (sx * 0.65, y, zb + 0.2), 'timber')
        # wheel
        wx = sx * 0.85
        b.lathe([(0.56, -0.05), (0.62, -0.05), (0.62, 0.05), (0.56, 0.05), (0.56, -0.05)], (wx, 0.1, 0.62), 'timber', segs=14, rot=(0, math.pi / 2, 0), cap=False, smooth=False)
        b.cyl(0.1, 0.1, 0.22, (wx, 0.1, 0.62), 'timber', segs=8, rot=(0, math.pi / 2, 0))
        for k in range(6):
            a = k * math.pi / 3
            b.box((0.05, 0.05, 0.5), (wx, 0.1 + math.sin(a) * 0.3, 0.62 + math.cos(a) * 0.3), 'timber', rot=(-a, 0, 0))
        b.lathe([(0.63, -0.055), (0.635, 0.0), (0.63, 0.055)], (wx, 0.1, 0.62), 'palette', segs=14, rot=(0, math.pi / 2, 0), pal='iron', cap=False)
    b.box((0.08, 2.0, 0.35), (0, 1.0, zb + 0.2), 'planks', rot=(0, 0, math.pi / 2))
    b.box((1.3, 0.06, 0.35), (0, 1.0, zb + 0.2), 'planks')
    b.box((1.0, 0.08, 0.08), (0, -2.5, zb - 0.08), 'timber')
    b.box((0.08, 0.08, 0.75), (0, -1.6, 0.36), 'timber')
    # cargo: pumpkins + sacks
    sack(b, -0.3, 0.45, zb + 0.04, 0.26, rot=0.25)
    sack(b, 0.3, 0.5, zb + 0.04, 0.24, rot=-0.2)
    pumpkin(b, -0.3, -0.35, zb + 0.04, 0.24); pumpkin(b, 0.28, -0.25, zb + 0.04, 0.2, 'pumpkin2'); pumpkin(b, 0.0, -0.7, zb + 0.04, 0.18)
    return b.build(), E

def barrel(b, x, y, z, r=0.32, h=0.85, rot=(0, 0, 0)):
    b.lathe([(r * 0.86, 0), (r, h * 0.5), (r * 0.86, h), (r * 0.78, h)], (x, y, z), 'planks', segs=12, rot=rot)
    for zz in (0.1, h - 0.18):
        rr = r * (0.9 if zz < 0.2 or zz > h - 0.2 else 1)
        b.lathe([(rr * 0.97, zz), (rr * 1.01, zz + 0.04), (rr * 0.97, zz + 0.08)], (x, y, z), 'palette', segs=12, pal='iron', cap=False, rot=rot)

def crate(b, x, y, z, s=0.6, rz=0.0):
    b.box((s, s, s), (x, y, z + s / 2), 'planks', rot=(0, 0, rz))
    c, sn = math.cos(rz), math.sin(rz)
    for (ax, ay) in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        lx, ly = ax * (s / 2 - 0.02), ay * (s / 2 - 0.02)
        b.box((0.07, 0.07, s + 0.02), (x + c * lx - sn * ly, y + sn * lx + c * ly, z + s / 2), 'timber', rot=(0, 0, rz))

@prop('barrels')
def barrels():
    b = Bld('vp_barrels'); E = []
    barrel(b, 0, 0, 0); barrel(b, 0.68, 0.1, 0); barrel(b, 0.3, 0.62, 0)
    crate(b, -0.85, 0.05, 0, 0.7, 0.1); crate(b, -0.85, 0.05, 0.7, 0.5, -0.25); crate(b, -0.8, 0.85, 0, 0.6, 0.4)
    barrel(b, 0.35, 0.25, 0.85, 0.3, 0.75, rot=(0, 0, 0))
    b.box((0.04, 1.2, 0.04), (1.2, 0.0, 0.55), 'timber', rot=(0.5, 0, 0))     # broom handle
    b.cyl(0.12, 0.05, 0.4, (1.2, -0.28, 0.12), 'palette', segs=6, pal='hay', rot=(0.5, 0, 0))
    pumpkin(b, 0.95, -0.55, 0, 0.22)
    return b.build(), E

@prop('woodpile')
def woodpile():
    b = Bld('vp_woodpile'); E = []
    rr = random.Random(5)
    for row in range(4):
        n = 7 - row
        for i in range(n):
            x = -1.0 + (i + row * 0.5) * 0.3
            b.cyl(0.13 + rr.uniform(-0.02, 0.02), 0.13, 1.0, (x, rr.uniform(-0.05, 0.05), 0.13 + row * 0.24), 'timber', segs=7,
                  rot=(math.pi / 2, 0, rr.uniform(-0.05, 0.05)), caps_pal='logend', smooth=False)
    for sx in (-1.25, 1.1):
        b.box((0.1, 0.1, 1.0), (sx, 0.3, 0.45), 'timber'); b.box((0.1, 0.1, 1.0), (sx, -0.3, 0.45), 'timber')
    # chopping block, axe, split logs
    b.cyl(0.3, 0.32, 0.5, (1.0, -0.95, 0.25), 'timber', segs=9, caps_pal='logend', smooth=False)
    b.box((0.04, 0.04, 0.75), (1.0, -0.8, 0.75), 'timber', rot=(0.6, 0, 0))
    b.box((0.04, 0.2, 0.12), (1.0, -1.0, 0.52), 'palette', pal='iron2', rot=(0.6, 0, 0))
    for k in range(4):
        b.box((0.12, 0.12, 0.45), (0.3 + k * 0.17, -1.0 - (k % 2) * 0.15, 0.06), 'timber', rot=(math.pi / 2, 0, 0.4 * k))
    return b.build(), E

@prop('windmill')
def windmill():
    b = Bld('vp_windmill'); E = []
    H = 9.8
    b.lathe([(2.75, -0.6), (2.75, 0.4), (2.55, 0.5)], (0, 0, 0), 'ashlar', segs=16, smooth=False, cap=False)
    b.lathe([(2.55, 0.5), (2.35, 3.0), (2.12, 6.0), (1.9, H)], (0, 0, 0), 'stone', segs=16, smooth=True)
    b.lathe([(1.98, H - 0.15), (2.08, H), (1.98, H + 0.15)], (0, 0, 0), 'ashlar', segs=16, cap=False)
    # reefing stage (gallery) with railing
    b.lathe([(2.3, 3.2), (3.3, 3.2), (3.3, 3.32), (2.3, 3.32)], (0, 0, 0), 'planks', segs=16, smooth=False)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        b.box((0.08, 0.08, 0.95), (math.cos(a) * 3.2, math.sin(a) * 3.2, 3.78), 'timber')
        b.box((0.08, 0.08, 1.9), (math.cos(a) * 2.95, math.sin(a) * 2.95, 2.35), 'timber', rot=(0, 0, 0)) if k % 4 == 0 else None
    b.lathe([(3.22, 4.2), (3.26, 4.25), (3.22, 4.3)], (0, 0, 0), 'timber', segs=16, cap=False, smooth=False)
    # door + windows on the front (-Y)
    F = Face((0, -2.5, 0), (1, 0, 0), (0, -1, 0))
    door(b, F, 0, w=1.0, h=2.0, z0=0.45, frame_m='ashlar')
    for zc, k in ((5.0, 0), (7.0, 1)):
        r = 2.35 - (zc - 3.0) * (0.23 / 3.0) + 0.02
        Fw = Face((0, -r, 0), (1, 0, 0), (0, -1, 0))
        window(b, Fw, 0, zc, 0.55, 0.7, style='stone', frame_m='timber')
    for a in (math.radians(60), math.radians(200)):
        r = 2.25; Fw = Face((math.cos(a) * r, math.sin(a) * r, 0), (-math.sin(a), math.cos(a), 0), (math.cos(a), math.sin(a), 0))
        window(b, Fw, 0, 5.6, 0.5, 0.65, style='stone', frame_m='timber')
    # boat-shaped cap
    b.lathe([(2.05, H - 0.05), (2.1, H + 0.35), (1.85, H + 1.3), (1.2, H + 2.1), (0.45, H + 2.6), (0.0, H + 2.75)], (0, 0, 0), 'shingle', segs=16, smooth=True)
    b.cyl(0.08, 0.05, 0.5, (0, 0, H + 2.9), 'palette', segs=6, pal='gold')
    b.ico(0.12, (0, 0, H + 3.2), 'gold')
    # windshaft housing + tail pole down to the ground (behind)
    hub = Vector((0, -2.95, H + 1.0))
    b.cyl(0.28, 0.32, 1.7, (0, -2.1, H + 1.0), 'timber', segs=10, rot=(math.pi / 2, 0, 0))
    b.beam(Vector((0, 1.6, H + 0.6)), Vector((0, 5.8, 0.4)), 0.22, 0.22, Vector((1, 0, 0)), 'timber')
    b.beam(Vector((-0.9, 1.4, H + 0.4)), Vector((0, 5.5, 1.2)), 0.12, 0.12, Vector((1, 0, 0)), 'timber')
    b.beam(Vector((0.9, 1.4, H + 0.4)), Vector((0, 5.5, 1.2)), 0.12, 0.12, Vector((1, 0, 0)), 'timber')
    # sacks + cart wheel on the ground
    sack(b, 1.4, -2.9, 0, 0.3); sack(b, 1.9, -2.7, 0, 0.28, 0.4); sack(b, -1.6, -2.85, 0, 0.3)
    body = b.build()
    # sails
    s = Bld('windmill_blades')
    s.cyl(0.36, 0.36, 0.5, (0, 0, 0), 'timber', segs=10, rot=(math.pi / 2, 0, 0))
    s.cyl(0.18, 0.12, 0.25, (0, -0.35, 0), 'palette', segs=8, pal='iron', rot=(math.pi / 2, 0, 0))
    Lr = 6.2
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        rd = Vector((math.cos(a), 0, math.sin(a))); tg = Vector((-math.sin(a), 0, math.cos(a)))
        s.beam(rd * 0.2 + Vector((0, -0.08, 0)), rd * Lr + Vector((0, -0.08, 0)), 0.2, 0.18, Vector((0, -1, 0)), 'timber')
        # lattice frame on the leading side
        for off in (0.3, 1.45):
            s.beam(rd * 1.3 + tg * off, rd * Lr + tg * off, 0.07, 0.07, Vector((0, -1, 0)), 'timber')
        s.beam(rd * 1.3 - tg * 0.3, rd * Lr - tg * 0.3, 0.06, 0.06, Vector((0, -1, 0)), 'timber')
        n = 11
        for i in range(n + 1):
            p = rd * (1.3 + (Lr - 1.3) * i / n)
            s.beam(p - tg * 0.3, p + tg * 1.45, 0.06, 0.06, Vector((0, -1, 0)), 'timber')
        # sailcloth on the back of the lattice
        c = rd * ((1.3 + Lr) / 2 + 0.1) + tg * 0.88 + Vector((0, 0.06, 0))
        s.obox(c, rd, tg, (Lr - 1.4, 1.1, 0.025), 'palette', pal='sail')
    bl = s.build()
    bl.parent = body; bl.location = hub
    return body, E

@prop('scarecrow')
def scarecrow():
    b = Bld('vp_scarecrow'); E = []
    b.box((0.1, 0.1, 2.4), (0, 0, 1.0), 'timber')
    b.box((1.6, 0.08, 0.08), (0, 0, 1.65), 'timber')
    # shirt + sleeves
    b.lathe([(0.24, 0.85), (0.32, 1.0), (0.3, 1.55), (0.2, 1.72), (0.0, 1.75)], (0, 0, 0), 'palette', segs=8, pal='cloth_blue', jitter=0.05)
    for sx in (-1, 1):
        b.cyl(0.12, 0.1, 0.62, (sx * 0.5, 0, 1.65), 'palette', segs=7, pal='cloth_red', rot=(0, math.pi / 2, 0))
        b.cyl(0.09, 0.02, 0.25, (sx * 0.9, 0, 1.63), 'thatch', segs=6, rot=(0, sx * math.pi / 2 + 0.25, 0))
    b.cyl(0.24, 0.12, 0.35, (0, 0, 0.72), 'thatch', segs=7)
    b.box((0.36, 0.04, 0.12), (0.06, -0.27, 1.25), 'palette', pal='cloth_green', rot=(0, 0.2, 0))   # patch
    # head + hat
    b.ico(0.24, (0, 0, 2.02), 'burlap', scale=(1, 1, 1.12))
    b.ico(0.035, (-0.08, -0.21, 2.06), 'black'); b.ico(0.035, (0.08, -0.21, 2.06), 'black')
    b.box((0.18, 0.02, 0.025), (0, -0.225, 1.94), 'palette', pal='ink', rot=(0, 0.15, 0))
    b.cyl(0.42, 0.42, 0.03, (0, 0, 2.22), 'palette', segs=10, pal='hat', rot=(0.12, 0, 0))
    b.cyl(0.2, 0.08, 0.42, (0, 0.02, 2.43), 'palette', segs=8, pal='hat', rot=(0.18, 0, 0))
    # crow on the arm
    b.ico(0.09, (0.62, 0, 1.79), 'black', scale=(1.5, 0.9, 0.9))
    b.ico(0.055, (0.75, 0, 1.86), 'black')
    b.cyl(0.02, 0.0, 0.07, (0.81, 0, 1.86), 'palette', segs=4, pal='yellow', rot=(0, math.pi / 2, 0))
    return b.build(), E

def soil_patch(b, W, D, nx, ny):
    bm = b.bm; vs = []
    rr = random.Random(int(W * D))
    grid = [[bm.verts.new((-W / 2 + W * i / nx, -D / 2 + D * j / ny, 0.06 + rr.uniform(-0.02, 0.03) if 0 < i < nx and 0 < j < ny else -0.06))
             for i in range(nx + 1)] for j in range(ny + 1)]
    fs = []
    for j in range(ny):
        for i in range(nx):
            fs.append(bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])))
    b._uv(fs, 'soil', None); b._mat(fs, 'soil', None)

@prop('field_wheat')
def field_wheat():
    """Harvested wheat field 10 × 7 m: stubble soil + standing sheaves (stooks)."""
    b = Bld('vp_field_wheat'); E = []
    W, D = 10.0, 7.0
    soil_patch(b, W, D, 10, 7)
    rr = random.Random(9)
    for j in range(3):
        for i in range(5):
            x = -W / 2 + 1.2 + i * (W - 2.4) / 4 + rr.uniform(-0.3, 0.3); y = -D / 2 + 1.2 + j * (D - 2.4) / 2 + rr.uniform(-0.3, 0.3)
            if (i, j) == (3, 1): continue
            b.lathe([(0.5, 0.0), (0.46, 0.35), (0.3, 0.85), (0.14, 1.12), (0.16, 1.18), (0.26, 1.32), (0.15, 1.5), (0.0, 1.58)], (x, y, 0), 'thatch', segs=9, jitter=0.07,
                    rot=(rr.uniform(-0.06, 0.06), rr.uniform(-0.06, 0.06), rr.random() * 6))
            b.lathe([(0.16, 1.1), (0.17, 1.15), (0.16, 1.2)], (x, y, 0), 'palette', segs=8, pal='rope', cap=False)
    # stubble rows (low golden ridges)
    for j in range(9):
        y = -D / 2 + 0.5 + j * (D - 1.0) / 8
        b.prism_x([(y - 0.12, 0.05), (y + 0.12, 0.05), (y, 0.13)], -W / 2 + 0.4, W / 2 - 0.4, 'thatch')
    return b.build(), E

@prop('field_veg')
def field_veg():
    """Vegetable plot 9 × 6 m: raised rows of cabbages and pumpkins with vines."""
    b = Bld('vp_field_veg'); E = []
    W, D = 9.0, 6.0
    soil_patch(b, W, D, 9, 6)
    rr = random.Random(13)
    rows = 6
    for j in range(rows):
        y = -D / 2 + 0.6 + j * (D - 1.2) / (rows - 1)
        b.prism_x([(y - 0.35, 0.02), (y + 0.35, 0.02), (y + 0.18, 0.22), (y - 0.18, 0.22)], -W / 2 + 0.4, W / 2 - 0.4, 'soil')
        if j % 2 == 0:
            for i in range(9):
                x = -W / 2 + 0.8 + i * (W - 1.6) / 8 + rr.uniform(-0.1, 0.1)
                b.ico(0.2, (x, y, 0.32), 'cabbage', scale=(1, 1, 0.75))
                for k in range(3):
                    a = k * 2.1 + rr.random()
                    b.ico(0.16, (x + math.cos(a) * 0.17, y + math.sin(a) * 0.17, 0.27), 'leaf2', scale=(1.3, 1.3, 0.35), rot=(0, 0, a))
        else:
            for i in range(5):
                x = -W / 2 + 1.0 + i * (W - 2.0) / 4 + rr.uniform(-0.3, 0.3)
                pumpkin(b, x, y + rr.uniform(-0.1, 0.1), 0.17, rr.uniform(0.2, 0.3), rr.choice(['pumpkin', 'pumpkin', 'pumpkin2']))
            for i in range(10):
                x = -W / 2 + 0.6 + i * (W - 1.2) / 9
                b.ico(0.22, (x, y + rr.uniform(-0.25, 0.25), 0.24), rr.choice(['leaf', 'leafdark', 'autumn']), scale=(1.3, 1.0, 0.35), rot=(0, 0, rr.random() * 3))
    return b.build(), E

@prop('lamp')
def lamp():
    b = Bld('vp_lamp'); E = []
    b.box((0.42, 0.42, 0.5), (0, 0, 0.1), 'ashlar')
    b.box((0.17, 0.17, 3.0), (0, 0, 1.75), 'timber')
    b.cyl(0.13, 0.04, 0.16, (0, 0, 3.3), 'timber', segs=4, rot=(0, 0, math.pi / 4), smooth=False)
    # bracket arm towards -Y (front = road side)
    b.box((0.07, 0.75, 0.08), (0, -0.4, 3.05), 'palette', pal='iron')
    b.beam(Vector((0, -0.05, 2.65)), Vector((0, -0.55, 3.03)), 0.04, 0.04, Vector((1, 0, 0)), 'palette', pal='iron')
    b.cyl(0.008, 0.008, 0.18, (0, -0.72, 2.95), 'palette', segs=4, pal='iron')
    lantern(b, 0, -0.72, 2.6, E)
    return b.build(), E

@prop('signpost')
def signpost():
    b = Bld('vp_signpost'); E = []
    b.box((0.16, 0.16, 2.7), (0, 0, 1.2), 'timber')
    b.cyl(0.14, 0.02, 0.2, (0, 0, 2.65), 'timber', segs=4, rot=(0, 0, math.pi / 4), smooth=False)
    for k, (zz, rz, L) in enumerate(((2.25, 0.0, 1.2), (1.9, 2.4, 1.0), (1.55, -1.2, 1.1))):
        pts = [(-0.1, -0.13), (L - 0.22, -0.13), (L, 0.0), (L - 0.22, 0.13), (-0.1, 0.13)]
        bm = b.bm
        top = [bm.verts.new((x, -0.03, z)) for x, z in pts]; bot = [bm.verts.new((x, 0.03, z)) for x, z in pts]
        fs = [bm.faces.new(top), bm.faces.new(list(reversed(bot)))]
        n = len(pts)
        for i in range(n): fs.append(bm.faces.new((top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i])))
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        b._uv(fs, 'planks', None, Vector((1, 0, 0))); b._mat(fs, 'planks', None)
        vs = top + bot
        b._place(vs, (0.08, 0, zz), (0, 0, rz))
        b.box((0.03, 0.08, 0.03), (0.08 + math.cos(rz) * 0.05, math.sin(rz) * 0.05, zz), 'palette', pal='iron')
    b.ico(0.25, (0.15, -0.15, 0.08), 'stone_l', scale=(1.2, 1, 0.5), smooth=False)
    for k in range(5):
        a = k * 1.3
        b.ico(0.12, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.06), 'autumn' if k % 2 else 'leaf2', scale=(1.3, 1.3, 0.5))
    return b.build(), E

@prop('noticeboard')
def noticeboard():
    b = Bld('vp_noticeboard'); E = []
    for sx in (-1, 1): b.box((0.14, 0.14, 2.5), (sx * 0.9, 0, 1.15), 'timber')
    b.box((1.7, 0.08, 1.05), (0, 0, 1.55), 'planks')
    b.box((1.86, 0.1, 0.1), (0, -0.02, 2.1), 'timber'); b.box((1.86, 0.1, 0.1), (0, -0.02, 1.0), 'timber')
    roof(b, 2.0, 0.3, 2.35, math.radians(35), 0.1, 0.25, 0.06, 'shingle')
    rr = random.Random(4)
    for k in range(5):
        x = -0.6 + k * 0.3 + rr.uniform(-0.05, 0.05); z = 1.55 + rr.uniform(-0.25, 0.25)
        w, h = rr.uniform(0.28, 0.4), rr.uniform(0.32, 0.46)
        b.box((w, 0.01, h), (x, -0.05, z), 'palette', pal=rr.choice(['paper', 'paper2']), rot=(0, rr.uniform(-0.12, 0.12), 0))
        b.box((0.03, 0.02, 0.03), (x, -0.06, z + h / 2 - 0.04), 'palette', pal='iron')
        for ln in range(3):
            b.box((w * 0.7, 0.012, 0.018), (x, -0.058, z + h / 4 - ln * 0.08), 'palette', pal='ink', rot=(0, rr.uniform(-0.12, 0.12), 0))
    return b.build(), E

# ───────────────────────── build all ─────────────────────────
ORDER = ['cottage_a', 'cottage_b', 'cottage_c', 'cottage_d', 'windmill', 'well', 'fountain', 'haystack', 'bales', 'fence', 'cart',
         'barrels', 'woodpile', 'scarecrow', 'field_wheat', 'field_veg', 'lamp', 'signpost', 'noticeboard']
GRID = {}
roots = {}
col_x = 0
for i, name in enumerate(ORDER):
    if ONLY and name not in ONLY: continue
    obj, E = PROPS[name]()
    gx, gy = (i % 5) * 16 - 32, (i // 5) * 16
    obj.location = (gx, gy, 0)
    for k, (en, loc) in enumerate(E):
        empty(f'{en}_{name}_{k}', obj, loc)
    for o in [obj] + list(obj.children):
        if o.type == 'MESH':
            bpy.context.view_layer.objects.active = o
    roots[name] = obj

report = {}
for name, o in roots.items():
    t = tris_of(o) + sum(tris_of(c) for c in o.children if c.type == 'MESH')
    report[name] = (t, [m.name for m in o.data.materials])
print('TRIS', {k: v[0] for k, v in report.items()}, 'total', sum(v[0] for v in report.values()))
for k, v in report.items(): print('  ', k, v[0], v[1])

os.makedirs(os.path.join(ROOT, 'models', 'src'), exist_ok=True)
if (not PREVIEW or '--export' in argv) and not ONLY:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'models', 'src', 'vp-kit.blend'))
    path = os.path.join(ROOT, 'models', 'props', 'vp-kit.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False, export_animations=False,
        export_image_format='JPEG', export_jpeg_quality=84,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print('EXPORTED', path, os.path.getsize(path))

# ───────────────────────── preview renders ─────────────────────────
if PREVIEW:
    sc = bpy.context.scene
    next(n for n in M['glow'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength'].default_value = 0.5
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 820
    try: sc.eevee.taa_render_samples = 24
    except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    sc.world = bpy.data.worlds.new('W'); sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.75, 0.62, 0.52, 1); bg.inputs[1].default_value = 0.8
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -0.01))
    g = bpy.context.object; g.data.materials.append(mat('ground', None, None, color=(0.30, 0.22, 0.12)))
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 3.6; sd.angle = 0.06; sd.color = (1.0, 0.86, 0.7)
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(52), math.radians(8), math.radians(-38))
    def shot(name, loc, target, lens=35):
        cd = bpy.data.cameras.new('C'); cd.lens = lens
        c = bpy.data.objects.new('C', cd); sc.collection.objects.link(c)
        c.location = loc; c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.camera = c; sc.render.filepath = os.path.join(PREVIEW, name)
        bpy.ops.render.render(write_still=True); print('RENDER', name)
    for name, o in roots.items():
        p = o.location
        big = name.startswith('cottage') or name in ('windmill', 'field_wheat', 'field_veg')
        dist = 20 if name == 'windmill' else (14 if big else 6)
        hz = 6 if name == 'windmill' else (2.2 if big else 0.9)
        shot(f'{name}.png', (p.x + dist * 0.55, p.y - dist, p.z + dist * 0.45), (p.x, p.y, p.z + hz), 35)
        if name.startswith('cottage'):
            shot(f'{name}_back.png', (p.x - dist * 0.6, p.y + dist, p.z + dist * 0.4), (p.x, p.y, p.z + hz), 35)
    if '--night' in argv:
        sd.energy = 0.05; bg.inputs[1].default_value = 0.05
        M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 12
        for name, o in roots.items():
            if name.startswith('cottage') or name == 'lamp':
                p = o.location
                shot(f'{name}_night.png', (p.x + 6, p.y - 10, p.z + 3), (p.x, p.y, p.z + 2), 35)
