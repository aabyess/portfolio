# 시냇물 돌다리 (stone bridge over the stream) — headless Blender build
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/bridge/build_bridge.py -- [--preview DIR] [--export]
# Output: models/props/bridge.glb, models/src/bridge.blend
#
# Axes: Blender X = web x, Blender -Y = web z (glTF +Y-up export), Z up.
# Origin = bridge centre on the road (web x = pathX(ZC), z = ZC = (z0+z1)/2), y = 0.
# The road deck follows portfolio.js bridgeY exactly:
#   deck(s) = top + arch * cos(pi * s / L)      (s = web z - ZC, |s| <= L/2)
# and the whole bridge is bent sideways by pathX(ZC+s) - pathX(ZC) so it follows the road.
# Named nodes: bridge_body (all stone/wood/iron), bridge_lamp_glass (4 lantern panes, emissive),
#              bridge_plants (ivy, flowers, moss — double sided).
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
TEXDIR = os.path.join(PREVIEW or '/tmp', 'bridge_tex'); os.makedirs(TEXDIR, exist_ok=True)

W = json.load(open(os.path.join(ROOT, 'models', 'autumn-world.json')))
B, P = W['bridge'], W['path']
Z0, Z1, TOP, ARCH, HW = B['z0'], B['z1'], B['top'], B['arch'], B['halfW']
L = Z1 - Z0; ZC = (Z0 + Z1) / 2
pathX = lambda z: P['amp'] * math.sin(-P['k'] * z)
XC = pathX(ZC)
RAMP = 1.3           # cobble ramp beyond each end (visual)
OX = HW + 0.38       # outer face of parapets / spandrel walls
BOT = -1.5           # foundations (buried in the stream bed)
SPRING = -0.78       # arch springing (under water level -0.45)

def deck(s):
    if abs(s) <= L / 2: return TOP + ARCH * math.cos(math.pi * s / L)
    t = min(1.0, (abs(s) - L / 2) / RAMP); t = t * t * (3 - 2 * t)
    return TOP + (0.045 - TOP) * t
def bend(s): return pathX(ZC + s) - XC

bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.default_rng(11)

# ───────────────────────── textures (numpy) ─────────────────────────
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

def normal_from_height(hgt, strength, half=True):
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * strength
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(hgt)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    n = n * 0.5 + 0.5
    if half: n = n.reshape(n.shape[0] // 2, 2, n.shape[1] // 2, 2, 3).mean((1, 3))
    return n

def ashlar(N=1024, rows=8, seed=0, base=(0.74, 0.63, 0.49)):
    r_ = np.random.default_rng(seed)
    rh = N // rows
    col = np.zeros((N, N, 3)); hgt = np.zeros((N, N))
    big = fbm(N, N, 3, 11 + seed, 3); mid = fbm(N, N, 24, 21 + seed, 3); fine = fbm(N, N, 128, 31 + seed, 2)
    pits = fbm(N, N, 64, 91 + seed, 2)
    xs = np.arange(N)
    for r in range(rows):
        cuts = [0]
        while True:
            nxt = cuts[-1] + r_.integers(130, 290)
            if nxt > N - 120: break
            cuts.append(nxt)
        cuts = np.sort((np.array(cuts) + r_.integers(0, N)) % N)
        d = np.abs(xs[:, None] - cuts[None, :]); d = np.minimum(d, N - d)
        dx = d.min(1)
        bid = np.searchsorted(cuts, xs, side='right') % len(cuts)
        nb = len(cuts)
        tone = r_.uniform(0.78, 1.12, nb); warm = r_.uniform(-0.05, 0.06, nb)
        grey = r_.uniform(0, 1, nb) < 0.25          # a few cooler grey stones
        ys = np.arange(rh); dy = np.minimum(ys, rh - 1 - ys)
        dd = np.minimum(dx[None, :], dy[:, None]).astype(float)
        mortar = 4.5
        bev = np.clip((dd - mortar) / 14.0, 0, 1)
        sl = slice(r * rh, (r + 1) * rh)
        t = tone[bid][None, :]; w = warm[bid][None, :]; g = grey[bid][None, :]
        c = np.empty((rh, N, 3))
        c[..., 0] = base[0] * t + w; c[..., 1] = base[1] * t + w * 0.4; c[..., 2] = base[2] * t - w * 0.6
        gc = np.array([0.60, 0.58, 0.55])
        c = np.where(g[..., None], gc * t[..., None], c)
        n = 0.80 + 0.30 * mid[sl] + 0.14 * fine[sl] - 0.18 * np.clip(pits[sl] - 0.62, 0, 1) * 3
        c *= n[..., None]
        c *= (0.70 + 0.30 * bev)[..., None]
        m = (dd <= mortar)
        mc = np.array([0.44, 0.40, 0.34]) * (0.8 + 0.3 * fine[sl])[..., None]
        c[m] = mc[m]
        col[sl] = c
        hgt[sl] = bev * 0.8 + 0.25 * mid[sl] * (bev > 0) + 0.1 * fine[sl] - 0.2 * np.clip(pits[sl] - 0.6, 0, 1)
    col *= (0.84 + 0.24 * big)[..., None]
    moss = np.clip((fbm(N, N, 5, 41 + seed, 3) - 0.64) * 4, 0, 1)
    col = col * (1 - 0.4 * moss[..., None]) + np.array([0.22, 0.27, 0.11]) * 0.4 * moss[..., None]
    return col, hgt

# clean stone (parapets, pillars, voussoirs)
stone_c, stone_h = ashlar(seed=1)
IM_STONE = save_img('br_stone', stone_c)
IM_STONE_N = save_img('br_stone_n', normal_from_height(stone_h, 2.4), True)

# wet stone: same masonry, V maps to world height BOT..BOT+WET_T (water stains, algae, moss line, drips)
WET_T = 2.6
wet_c, wet_h = ashlar(seed=2)
N = wet_c.shape[0]
v = 1.0 - (np.arange(N) + 0.5) / N                    # image row -> V (row 0 = top)
hh = BOT + v * WET_T                                    # world height for each row
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
wet = (1 - sstep(-0.62, -0.38, hh))[:, None]            # below water: dark and green
mossband = (sstep(-0.75, -0.48, hh) * (1 - sstep(-0.42, -0.05, hh)))[:, None]
mossn = fbm(N, N, 10, 301, 4)
drips = fbm(N, N, 3, 311, 3, aniso=(1, 14))
dripk = (1 - sstep(-0.4, 0.55, hh))[:, None] * np.clip((drips - 0.45) * 2.5, 0, 1)
algae = np.array([0.20, 0.25, 0.14])
wet_c = wet_c * (1 - 0.45 * wet[..., None]) + algae * 0.25 * wet[..., None]
mk = np.clip(mossband * (0.6 + 0.9 * (mossn - 0.45)), 0, 1)[..., None]
wet_c = wet_c * (1 - 0.75 * mk) + np.array([0.24, 0.33, 0.10]) * (0.75 + 0.4 * mossn[..., None]) * mk
wet_c *= (1 - 0.28 * dripk)[..., None]
wet_h = wet_h + 0.4 * mk[..., 0] * mossn
IM_WET = save_img('br_stone_wet', wet_c)
IM_WET_N = save_img('br_stone_wet_n', normal_from_height(wet_h, 2.4), True)

def cobbles(N=1024, cells=18, seed=5):
    r_ = np.random.default_rng(seed)
    pts = r_.uniform(0.15, 0.85, (cells, cells, 2))
    tone = r_.uniform(0.80, 1.10, (cells, cells)); hue = r_.uniform(-0.04, 0.04, (cells, cells))
    ys, xs = np.mgrid[0:N, 0:N] / N * cells
    cx, cy = np.floor(xs).astype(int), np.floor(ys).astype(int)
    f1 = np.full((N, N), 9.0); f2 = np.full((N, N), 9.0); idx = np.zeros((N, N), int)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            gx, gy = cx + ox, cy + oy
            p = pts[gy % cells, gx % cells]
            d = np.hypot(xs - (gx + p[..., 0]), (ys - (gy + p[..., 1])) * 1.15)
            lt1 = d < f1
            f2 = np.where(lt1, f1, np.minimum(f2, d)); idx = np.where(lt1, (gy % cells) * cells + gx % cells, idx)
            f1 = np.where(lt1, d, f1)
    edge = f2 - f1
    dome = np.clip(edge / 0.32, 0, 1) ** 0.6
    stone = edge > 0.07
    fine = fbm(N, N, 96, 501, 2); mid = fbm(N, N, 16, 511, 3); big = fbm(N, N, 3, 521, 3)
    t = tone.ravel()[idx]; hu = hue.ravel()[idx]
    base = np.array([0.56, 0.50, 0.43])
    c = np.empty((N, N, 3))
    c[..., 0] = base[0] * t + hu; c[..., 1] = base[1] * t + hu * 0.3; c[..., 2] = base[2] * t - hu * 0.5
    c *= (0.78 + 0.22 * dome * (0.8 + 0.3 * mid))[..., None] * (0.85 + 0.2 * fine)[..., None]
    c *= (1 + 0.12 * np.clip(dome - 0.8, 0, 1) * 5)[..., None]          # polished tops
    dirt = np.array([0.24, 0.19, 0.13]) * (0.8 + 0.4 * fine)[..., None]
    mossy = np.clip((fbm(N, N, 6, 531, 3) - 0.55) * 3, 0, 1)[..., None]
    dirt = dirt * (1 - mossy) + np.array([0.20, 0.26, 0.10]) * mossy
    c = np.where(stone[..., None], c, dirt)
    c *= (0.88 + 0.2 * big)[..., None]
    hgt = np.where(stone, 0.3 + dome * 0.7, 0.0) + 0.05 * fine
    return c, hgt

cob_c, cob_h = cobbles()
IM_COB = save_img('br_cobble', cob_c)
IM_COB_N = save_img('br_cobble_n', normal_from_height(cob_h, 3.0), True)

def wood_texture(N=512, planks=8):
    pw = N // planks
    grain = fbm(N, N, 4, 61, 4, aniso=(1, 12)); knots = fbm(N, N, 6, 71, 2)
    xs = np.arange(N); pid = xs // pw; lx = xs % pw
    tone = rng.uniform(0.8, 1.15, planks)
    c = np.array([0.42, 0.27, 0.15])[None, None, :] * tone[pid][None, :, None]
    c = c * (0.70 + 0.45 * grain)[..., None] * (0.9 + 0.15 * knots)[..., None]
    c[:, (lx < 3) | (lx > pw - 3)] *= 0.4
    return c
IM_WOOD = save_img('br_wood', wood_texture())

# ───────────────────────── materials ─────────────────────────
def mat(name, color=(0.8, 0.8, 0.8), rough=0.85, metal=0.0, img=None, nrm=None, emit=None, estr=4.0, double=False, nstr=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        if tuple(color) != (1, 1, 1):
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = 1.0
            nt.links.new(t.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (*color, 1)
            nt.links.new(mix.outputs[2], b.inputs['Base Color'])
        else:
            nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    if nrm:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nstr
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    m.use_backface_culling = not double
    return m

M = {
    'wet': mat('br_stone_wet', (1, 1, 1), img=IM_WET, nrm=IM_WET_N),
    'soffit': mat('br_stone_soffit', (0.78, 0.76, 0.74), img=IM_STONE, nrm=IM_STONE_N),
    'stone': mat('br_stone', (1, 1, 1), img=IM_STONE, nrm=IM_STONE_N),
    'trim': mat('br_stone_trim', (1.08, 1.02, 0.92), rough=0.8, img=IM_STONE, nrm=IM_STONE_N),
    'cobble': mat('br_cobble', (1, 1, 1), rough=0.75, img=IM_COB, nrm=IM_COB_N, nstr=1.0),
    'wood': mat('br_wood', (1, 1, 1), rough=0.8, img=IM_WOOD),
    'iron': mat('br_iron', (0.06, 0.055, 0.05), rough=0.5, metal=0.85),
    'glass': mat('br_lamp_glass', (1.0, 0.75, 0.4), rough=0.3, emit=(1.0, 0.62, 0.25), estr=3.0),
    'flame': mat('br_candle_flame', (1.0, 0.7, 0.3), emit=(1.0, 0.6, 0.2), estr=5.0),
    'wax': mat('br_wax', (0.92, 0.86, 0.72), rough=0.6),
    'soil': mat('br_soil', (0.17, 0.11, 0.07), rough=1.0),
    'leaf': mat('br_leaf', (0.16, 0.32, 0.09), rough=0.8, double=True),
    'ivy_g': mat('br_ivy_green', (0.13, 0.27, 0.07), rough=0.75, double=True),
    'ivy_r': mat('br_ivy_red', (0.55, 0.10, 0.05), rough=0.75, double=True),
    'ivy_o': mat('br_ivy_orange', (0.78, 0.32, 0.06), rough=0.75, double=True),
    'moss': mat('br_moss', (0.20, 0.30, 0.08), rough=1.0),
    'f_red': mat('br_flower_red', (0.80, 0.08, 0.06), rough=0.7),
    'f_yel': mat('br_flower_yellow', (0.95, 0.70, 0.10), rough=0.7),
    'f_wht': mat('br_flower_white', (0.92, 0.90, 0.85), rough=0.7),
    'f_pur': mat('br_flower_purple', (0.45, 0.20, 0.62), rough=0.7),
    'f_org': mat('br_flower_orange', (0.95, 0.42, 0.08), rough=0.7),
    'gold': mat('br_gold', (0.95, 0.68, 0.22), rough=0.3, metal=1.0),
}

# ───────────────────────── mesh helpers ─────────────────────────
def V(x, s, h): return Vector((x, -s, h))          # (web-local x, along-road s, height) -> Blender

BODY, GLASS, PLANTS = [], [], []
def new_obj(name, bm, material, bucket):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if material: me.materials.append(material)
    bucket.append(o); return o

def sweep(name, ss, section, material, bucket=BODY, caps=True):
    """Rings of `section(s)` -> [(x, h), ...] along s; quads between rings, n-gon caps."""
    bm = bmesh.new(); rings = []
    for s in ss:
        rings.append([bm.verts.new(V(x, s, h)) for x, h in section(s)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    if caps:
        bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, material, bucket)

def hexa(name, p8, material, bucket=BODY):
    """8 corners: bottom quad 0-3, top quad 4-7 (same winding)."""
    bm = bmesh.new(); v = [bm.verts.new(p) for p in p8]
    for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, material, bucket)

def boxc(name, size, center, material, bucket=BODY, rotz=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if rotz: bmesh.ops.rotate(bm, matrix=__import__('mathutils').Matrix.Rotation(rotz, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return new_obj(name, bm, material, bucket)

def cone(name, r1, r2, z0, z1, cxy, material, segs=4, bucket=BODY, rot=math.pi / 4):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=z1 - z0)
    if rot: bmesh.ops.rotate(bm, matrix=__import__('mathutils').Matrix.Rotation(rot, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((cxy[0], cxy[1], (z0 + z1) / 2)), verts=bm.verts)
    return new_obj(name, bm, material, bucket)

def blob(name, r, center, material, bucket, sq=(1, 1, 1), sub=1, seed=0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    rr = np.random.default_rng(abs(int(seed)))
    for v in bm.verts:
        v.co = Vector((v.co.x * sq[0], v.co.y * sq[1], v.co.z * sq[2])) * (0.85 + 0.3 * rr.random())
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return new_obj(name, bm, material, bucket)

def boolean(target, cutter):
    md = target.modifiers.new('b', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cutter
    md.solver = 'EXACT'
    try: md.material_mode = 'TRANSFER'
    except Exception: pass
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=md.name)
    if cutter in BODY: BODY.remove(cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)

# ───────────────────────── geometry ─────────────────────────
HALF = L / 2
def srange(a, b, step=0.25):
    n = max(1, int(math.ceil((b - a) / step)))
    return [a + (b - a) * i / n for i in range(n + 1)]

# arches: centre big span over the deepest channel, two smaller flanking spans, cutwater piers between
SA = -1.15                          # centre arch (web z ≈ -37.55, the stream crosses the road diagonally)
ARCHES = [(SA - 3.75, 1.3, 0.24), (SA, 1.65, 0.28), (SA + 3.75, 1.3, 0.24)]   # (centre s, half span, ring thickness)
PIERS = [SA - 2.1, SA + 2.1]        # pier centres (0.9 wide)
FILL = 0.10                         # cobble slab + fill above the crown
arch_geo = []
for sc, a, rt in ARCHES:
    hc = deck(sc) - FILL - rt
    r = hc - SPRING
    R = (a * a + r * r) / (2 * r)
    arch_geo.append((sc, a, rt, R, hc - R))           # centre height h0

# 1) bridge body: solid block under the deck, arches cut through
body = sweep('body', srange(-HALF, HALF), lambda s: [(-OX, BOT), (OX, BOT), (OX, deck(s) - FILL + 0.005), (-OX, deck(s) - FILL + 0.005)], M['wet'])
for i, (sc, a, rt, R, h0) in enumerate(arch_geo):
    th0 = math.asin(min(1.0, a / R))
    pts = [(sc + a, BOT - 0.3), (sc + a, SPRING)]
    n = 24
    for k in range(1, n):
        th = -th0 + 2 * th0 * k / n
        pts.append((sc + R * math.sin(th), h0 + R * math.cos(th)))
    pts = [(sc + a, BOT - 0.3)] + list(reversed(pts[1:])) if False else pts
    pts += [(sc - a, SPRING), (sc - a, BOT - 0.3)]
    # the arc above runs from +a to -a? build explicitly ordered from s=+a over the crown to s=-a
    arc = [(sc + R * math.sin(th0 - 2 * th0 * k / n), h0 + R * math.cos(th0 - 2 * th0 * k / n)) for k in range(n + 1)]
    outline = [(sc + a, BOT - 0.4)] + arc + [(sc - a, BOT - 0.4)]
    bm = bmesh.new()
    va = [bm.verts.new(V(-OX - 0.6, s, h)) for s, h in outline]
    vb = [bm.verts.new(V(OX + 0.6, s, h)) for s, h in outline]
    m_ = len(outline)
    for j in range(m_):
        bm.faces.new((va[j], va[(j + 1) % m_], vb[(j + 1) % m_], vb[j]))
    bm.faces.new(va); bm.faces.new(list(reversed(vb)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cut = new_obj(f'cut{i}', bm, M['soffit'], BODY)
    boolean(body, cut)

# 2) voussoirs on both faces of each arch (lighter trim stone, keystone proud)
for i, (sc, a, rt, R, h0) in enumerate(arch_geo):
    th0 = math.asin(min(1.0, a / R))
    arc_len = 2 * th0 * R
    nv = int(round(arc_len / 0.27)) | 1
    gap = 0.012 / R
    for side in (-1, 1):
        for k in range(nv):
            ta = -th0 + 2 * th0 * k / nv + gap / 2; tb = -th0 + 2 * th0 * (k + 1) / nv - gap / 2
            key = (k == nv // 2)
            ro = R + rt + (0.07 if key else (0.03 if k % 2 else 0.0))
            proud = 0.07 if key else 0.035
            xin, xout = side * (OX - 0.15), side * (OX + proud)
            ring = [(sc + R * math.sin(ta), h0 + R * math.cos(ta)), (sc + R * math.sin(tb), h0 + R * math.cos(tb)),
                    (sc + ro * math.sin(tb), h0 + ro * math.cos(tb)), (sc + ro * math.sin(ta), h0 + ro * math.cos(ta))]
            p8 = [V(xin, s, h) for s, h in ring] + [V(xout, s, h) for s, h in ring]
            hexa(f'vous{i}_{side}_{k}', p8, M['trim'])
        # impost/springer blocks at the springing on each face
        for e in (-1, 1):
            s0 = sc + e * a
            hexa(f'impost{i}_{side}_{e}', [V(side * (OX - 0.1), s0 - 0.22, SPRING - 0.12), V(side * (OX - 0.1), s0 + 0.22, SPRING - 0.12),
                                           V(side * (OX - 0.1), s0 + 0.22, SPRING + 0.02), V(side * (OX - 0.1), s0 - 0.22, SPRING + 0.02),
                                           V(side * (OX + 0.05), s0 - 0.22, SPRING - 0.12), V(side * (OX + 0.05), s0 + 0.22, SPRING - 0.12),
                                           V(side * (OX + 0.05), s0 + 0.22, SPRING + 0.02), V(side * (OX + 0.05), s0 - 0.22, SPRING + 0.02)], M['trim'])

# 3) cutwaters (pointed, both faces) with sloped stone hoods
for j, sp in enumerate(PIERS):
    hcap = deck(sp) - 0.62
    for side in (-1, 1):
        def tri(xo, hw, h):
            return [V(side * OX, sp - hw, h), V(side * (OX + xo), sp, h), V(side * OX, sp + hw, h)]
        bm = bmesh.new()
        lo = [bm.verts.new(p) for p in tri(0.78, 0.45, BOT)]
        hi = [bm.verts.new(p) for p in tri(0.78, 0.45, hcap)]
        bm.faces.new(lo); bm.faces.new(hi)
        for k in range(3):
            bm.faces.new((lo[k], lo[(k + 1) % 3], hi[(k + 1) % 3], hi[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        new_obj(f'cutwater{j}{side}', bm, M['wet'], BODY)
        # hood: overhanging cap slab + pyramid up to the wall
        bm = bmesh.new()
        lo = [bm.verts.new(p) for p in tri(0.88, 0.53, hcap)]
        mid = [bm.verts.new(p) for p in tri(0.88, 0.53, hcap + 0.08)]
        apex = bm.verts.new(V(side * OX, sp, hcap + 0.5))
        bm.faces.new(lo)
        for k in range(3):
            bm.faces.new((lo[k], lo[(k + 1) % 3], mid[(k + 1) % 3], mid[k]))
        for k in range(2):
            bm.faces.new((mid[k], mid[k + 1], apex))
        bm.faces.new((mid[2], mid[0], apex))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        new_obj(f'hood{j}{side}', bm, M['trim'], BODY)
        # a pilaster rising from the hood to the parapet coping
        PIL.append((sp, side)) if 'PIL' in globals() else None

# 4) cobbled deck + ramps (top exactly = bridgeY profile)
DECK_SS = srange(-HALF - RAMP, HALF + RAMP, 0.2)
deck_o = sweep('deck', DECK_SS, lambda s: [(-HW, deck(s) - 0.14), (HW, deck(s) - 0.14), (HW, deck(s)), (-HW, deck(s))], M['cobble'])

# 5) string course along the outer faces at deck level
for side in (-1, 1):
    xi, xo = side * (OX - 0.05), side * (OX + 0.07)
    sweep(f'string{side}', srange(-HALF + 0.3, HALF - 0.3), lambda s, xi=xi, xo=xo: [(xi, deck(s) - 0.20), (xo, deck(s) - 0.20), (xo, deck(s) - 0.06), (xi, deck(s) - 0.06)], M['trim'])

# 6) parapet walls + coping blocks
PH = 0.74
for side in (-1, 1):
    xi, xo = side * HW, side * OX
    sweep(f'parapet{side}', srange(-HALF + 0.3, HALF - 0.3), lambda s, xi=xi, xo=xo: [(xi, deck(s) - 0.12), (xo, deck(s) - 0.12), (xo, deck(s) + PH), (xi, deck(s) + PH)], M['stone'])
    cs = srange(-HALF + 0.35, HALF - 0.35, 0.58)
    for k, (sa, sb) in enumerate(zip(cs, cs[1:])):
        sa2, sb2 = sa + 0.006, sb - 0.006
        x1, x2 = side * (HW - 0.05), side * (OX + 0.05)
        ha, hb = deck(sa2) + PH, deck(sb2) + PH
        p8 = [V(x1, sa2, ha), V(x2, sa2, ha), V(x2, sb2, hb), V(x1, sb2, hb),
              V(x1, sa2, ha + 0.11), V(x2, sa2, ha + 0.11), V(x2, sb2, hb + 0.11), V(x1, sb2, hb + 0.11)]
        hexa(f'coping{side}_{k}', p8, M['trim'])

# 7) pilasters above each cutwater, up through the parapet (outer face), with a small cap
for sp in PIERS:
    for side in (-1, 1):
        hb = deck(sp) - 0.62 + 0.3
        ht = deck(sp) + PH + 0.11
        x1, x2 = side * (OX - 0.02), side * (OX + 0.12)
        p8 = [V(x1, sp - 0.3, hb), V(x2, sp - 0.3, hb), V(x2, sp + 0.3, hb), V(x1, sp + 0.3, hb),
              V(x1, sp - 0.3, ht), V(x2, sp - 0.3, ht), V(x2, sp + 0.3, ht), V(x1, sp + 0.3, ht)]
        hexa(f'pilaster{sp}{side}', p8, M['stone'])
        x1, x2 = side * (HW - 0.07), side * (OX + 0.17)
        p8 = [V(x1, sp - 0.36, ht), V(x2, sp - 0.36, ht), V(x2, sp + 0.36, ht), V(x1, sp + 0.36, ht),
              V(x1, sp - 0.36, ht + 0.1), V(x2, sp - 0.36, ht + 0.1), V(x2, sp + 0.36, ht + 0.1), V(x1, sp + 0.36, ht + 0.1)]
        hexa(f'pilcap{sp}{side}', p8, M['trim'])

# 8) end pillars with iron lanterns, and splayed wing walls ending in bollards
def lantern(cx, cy, z):
    """Iron lantern standing on a pillar cap at (cx, cy, z)."""
    boxc('lb', (0.30, 0.30, 0.05), (cx, cy, z + 0.025), M['iron'])
    boxc('lneck', (0.14, 0.14, 0.08), (cx, cy, z + 0.09), M['iron'])
    boxc('lbase', (0.32, 0.32, 0.04), (cx, cy, z + 0.15), M['iron'])
    boxc('lglass', (0.22, 0.22, 0.34), (cx, cy, z + 0.34), M['glass'], GLASS)
    for dx in (-0.125, 0.125):
        for dy in (-0.125, 0.125):
            boxc('lpost', (0.03, 0.03, 0.38), (cx + dx, cy + dy, z + 0.34), M['iron'])
    for k in range(4):                                  # muntins across the panes
        a = k * math.pi / 2
        boxc('lbar', (0.012, 0.24, 0.012) if k % 2 == 0 else (0.24, 0.012, 0.012), (cx, cy, z + 0.34), M['iron'])
    boxc('ltop', (0.34, 0.34, 0.04), (cx, cy, z + 0.53), M['iron'])
    cone('lroof', 0.30, 0.02, z + 0.55, z + 0.78, (cx, cy), M['iron'])
    blob('lfin', 0.035, (cx, cy, z + 0.80), M['iron'], BODY, sub=1)
    # hanging ring
    bm = bmesh.new(); bmesh.ops.create_circle(bm, segments=8, radius=0.04)
    bmesh.ops.rotate(bm, matrix=__import__('mathutils').Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, z + 0.86), verts=bm.verts)
    r = bmesh.ops.extrude_edge_only(bm, edges=bm.edges)
    bmesh.ops.translate(bm, vec=(0, 0.012, 0), verts=[g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)])
    new_obj('lring', bm, M['iron'], BODY)

PW = 0.62
for e in (-1, 1):                         # e = which end
    se = e * (HALF - PW / 2 + 0.02)
    for side in (-1, 1):
        cx = side * (HW - 0.07 + PW / 2)      # inner face 0.07 inside the road edge
        dz = deck(se)
        top = dz + 1.02
        p = V(cx, se, 0)
        boxc('pillar_plinth', (PW + 0.08, PW + 0.08, 0.9), (p.x, p.y, dz - 0.6 + 0.45 + 0.05), M['trim'])
        boxc('pillar', (PW, PW, top - dz + 0.2), (p.x, p.y, dz - 0.2 + (top - dz + 0.2) / 2), M['stone'])
        boxc('pillar_band', (PW + 0.06, PW + 0.06, 0.08), (p.x, p.y, top - 0.22), M['trim'])
        boxc('pillar_cap', (PW + 0.16, PW + 0.16, 0.12), (p.x, p.y, top + 0.06), M['trim'])
        boxc('pillar_cap2', (PW - 0.04, PW - 0.04, 0.06), (p.x, p.y, top + 0.15), M['trim'])
        lantern(p.x, p.y, top + 0.18)
        # wing wall: from the pillar out and down to a bollard
        s1 = e * (HALF + 2.3)
        x0 = side * (OX - 0.19); x1 = side * (OX + 0.65)
        h0, h1 = dz + PH - 0.05, 0.42
        tw = 0.19
        for nm, hb, ht, mt, ext in (('wing', -0.6, None, M['stone'], 0.0), ('wingcap', None, None, M['trim'], 0.05)):
            pass
        sa = e * (HALF - 0.05)
        def wpt(s, x, h): return V(x, s, h)
        d_ = Vector((x1 - x0, s1 - sa)).normalized()
        nrm2 = Vector((d_.y, -d_.x))
        def off(x, s, o): return (x + nrm2.x * o, s + nrm2.y * o)
        a1 = off(x0, sa, tw); a2 = off(x0, sa, -tw); b1 = off(x1, s1, tw); b2 = off(x1, s1, -tw)
        hexa('wing', [V(a1[0], a1[1], -0.6), V(a2[0], a2[1], -0.6), V(b2[0], b2[1], -0.6), V(b1[0], b1[1], -0.6),
                      V(a1[0], a1[1], h0), V(a2[0], a2[1], h0), V(b2[0], b2[1], h1), V(b1[0], b1[1], h1)], M['stone'])
        a1 = off(x0, sa, tw + 0.05); a2 = off(x0, sa, -tw - 0.05); b1 = off(x1, s1, tw + 0.05); b2 = off(x1, s1, -tw - 0.05)
        hexa('wingcap', [V(a1[0], a1[1], h0), V(a2[0], a2[1], h0), V(b2[0], b2[1], h1), V(b1[0], b1[1], h1),
                         V(a1[0], a1[1], h0 + 0.1), V(a2[0], a2[1], h0 + 0.1), V(b2[0], b2[1], h1 + 0.1), V(b1[0], b1[1], h1 + 0.1)], M['trim'])
        bp = V(x1, s1, 0)
        boxc('bollard', (0.46, 0.46, 1.1), (bp.x, bp.y, -0.55 + 0.55 + 0.0), M['stone'])
        cone('bollard_top', 0.36, 0.05, 0.55, 0.78, (bp.x, bp.y), M['trim'])

# 9) flower boxes hung on the outside of the parapets (between the pilasters), with iron brackets
FLOWER_M = ['f_red', 'f_yel', 'f_wht', 'f_pur', 'f_org']
fr = np.random.default_rng(3)
def leaf_quad(bm, c, sz, rr, up=False):
    """one leaf card: a diamond with random orientation (mostly facing up if up=True)."""
    if up:
        a = rr.uniform(0, 2 * math.pi); tilt = rr.uniform(0.2, 0.9)
        du = Vector((math.cos(a), math.sin(a), 0)) * sz
        dv = Vector((-math.sin(a) * math.cos(tilt), math.cos(a) * math.cos(tilt), math.sin(tilt))) * sz * 0.7
    else:
        du = Vector(rr.normal(size=3)).normalized() * sz
        dv = du.cross(Vector(rr.normal(size=3))).normalized() * sz * 0.7
    vs = [bm.verts.new(c + du), bm.verts.new(c + dv), bm.verts.new(c - du * 0.6), bm.verts.new(c - dv)]
    bm.faces.new(vs)
leaf_bm = bmesh.new()
for bi, (sc, side) in enumerate([(SA - 2.95, 1), (SA, 1), (SA + 2.95, 1), (SA - 2.95, -1), (SA, -1), (SA + 2.95, -1)]):
    dz = deck(sc) + PH - 0.30
    xi = side * (OX + 0.005); xo = side * (OX + 0.30)
    cxm = (xi + xo) / 2
    p = V(cxm, sc, 0)
    boxc('fbox', (0.30, 0.86, 0.24), (p.x, p.y, dz + 0.12), M['wood'])
    boxc('fbox_lip', (0.33, 0.90, 0.04), (p.x, p.y, dz + 0.24), M['wood'])
    boxc('fsoil', (0.25, 0.80, 0.02), (p.x, p.y, dz + 0.245), M['soil'])
    for t in (-0.3, 0.3):                                # iron brackets
        q = V(side * (OX + 0.15), sc + t, 0)
        boxc('fbr', (0.30, 0.03, 0.03), (q.x, q.y, dz - 0.015), M['iron'])
        boxc('fbr2', (0.03, 0.03, 0.30), (side * (OX + 0.03), q.y, dz + 0.0), M['iron'])
    # leafy mound
    for k in range(70):
        u = fr.uniform(-0.40, 0.40); w = fr.uniform(-0.13, 0.13)
        hmax = 0.16 * (1 - (u / 0.45) ** 2) * (1 - (w / 0.2) ** 2)
        c = V(cxm + w, sc + u, dz + 0.25 + fr.uniform(0.0, 1.0) * hmax)
        leaf_quad(leaf_bm, c, fr.uniform(0.045, 0.07), fr, up=True)
    # trailing strands over the outer edge
    for k in range(7):
        u = -0.38 + 0.76 * k / 6 + fr.uniform(-0.03, 0.03)
        ln = fr.uniform(0.2, 0.55)
        h = dz + 0.25
        while h > dz + 0.25 - ln:
            c = V(xo + side * fr.uniform(0.0, 0.04), sc + u + fr.uniform(-0.03, 0.03), h)
            leaf_quad(leaf_bm, c, fr.uniform(0.035, 0.055), fr)
            h -= 0.05
    # blossoms in two colours per box
    cols = [FLOWER_M[bi % 5], FLOWER_M[(bi + 2) % 5]]
    for k in range(22):
        u = fr.uniform(-0.38, 0.38); w = fr.uniform(-0.11, 0.11)
        hmax = 0.17 * (1 - (u / 0.45) ** 2)
        c = V(cxm + w, sc + u, dz + 0.27 + fr.uniform(0.5, 1.0) * hmax)
        blob('flw', fr.uniform(0.03, 0.045), (c.x, c.y, c.z), M[cols[k % 2] if k % 5 else 'f_wht'], PLANTS, sq=(1, 1, 0.6), sub=0, seed=k + bi * 50)
new_obj('box_leaves', leaf_bm, M['leaf'], PLANTS)

# 10) ivy curtains (autumn reds, oranges, greens) hanging from the coping
IVY_PATCHES = [(SA - 3.2, 1, 1.0), (SA + 3.0, 1, 0.8), (SA + 0.3, -1, 1.1), (SA - 5.2, -1, 0.9), (SA + 5.0, -1, 0.7), (SA - 0.4, 1, 0.6)]
ir = np.random.default_rng(17)
ivy_mats = [M['ivy_r'], M['ivy_o'], M['ivy_g'], M['ivy_r']]
for pi_, (s0, side, wdt) in enumerate(IVY_PATCHES):
    bm_by_mat = {id(m_): (m_, bmesh.new()) for m_ in ivy_mats}
    nstr = int(wdt / 0.09)
    for k in range(nstr):
        s = s0 - wdt / 2 + wdt * (k + ir.random() * 0.6) / nstr
        top = deck(s) + PH + 0.1
        length = ir.uniform(0.4, 1.0) * (1.4 - abs(k - nstr / 2) / nstr * 1.4) + 0.2
        hcur = top; scur = s
        while hcur > top - length:
            scur += ir.uniform(-0.03, 0.03)
            m_ = ivy_mats[ir.integers(0, 4)] if pi_ % 2 == 0 else ivy_mats[ir.integers(1, 4)]
            bm = bm_by_mat[id(m_)][1]
            sz = ir.uniform(0.05, 0.085)
            xo = side * (OX + 0.015 + ir.uniform(0, 0.03))
            c = Vector((xo, -scur, hcur))
            ang = ir.uniform(0, 2 * math.pi)
            du = Vector((0, math.cos(ang), math.sin(ang))) * sz; dv = Vector((0, -math.sin(ang), math.cos(ang))) * sz * 0.8
            tilt = Vector((side * ir.uniform(0.01, 0.04), 0, 0))
            vs = [bm.verts.new(c + du), bm.verts.new(c + dv + tilt), bm.verts.new(c - du), bm.verts.new(c - dv + tilt)]
            bm.faces.new(vs)
            hcur -= ir.uniform(0.04, 0.075)
        # over the top of the coping a little
        for j in range(3):
            m_ = ivy_mats[ir.integers(0, 4)]; bm = bm_by_mat[id(m_)][1]
            sc_ = s + ir.uniform(-0.04, 0.04); xx = side * (OX - ir.uniform(0.0, 0.25)); hz = deck(sc_) + PH + 0.115
            sz = 0.06
            vs = [bm.verts.new(Vector((xx + sz, -sc_, hz))), bm.verts.new(Vector((xx, -sc_ - sz, hz + 0.01))),
                  bm.verts.new(Vector((xx - sz, -sc_, hz))), bm.verts.new(Vector((xx, -sc_ + sz, hz + 0.01)))]
            bm.faces.new(vs)
    for m_, bm in bm_by_mat.values():
        if len(bm.faces): new_obj(f'ivy{pi_}', bm, m_, PLANTS)
        else: bm.free()

# 11) moss cushions on hoods, coping joints and at the foot of the pillars
mr = np.random.default_rng(23)
for sp in PIERS:
    for side in (-1, 1):
        for k in range(3):
            c = V(side * (OX + 0.25 + mr.uniform(0, 0.25)), sp + mr.uniform(-0.2, 0.2), deck(sp) - 0.62 + 0.12 + mr.uniform(0, 0.1))
            blob('moss', 0.12, (c.x, c.y, c.z), M['moss'], PLANTS, sq=(1, 1, 0.35), sub=1, seed=int(k + sp * 10))
for k in range(10):
    s = mr.uniform(-HALF + 1, HALF - 1); side = 1 if k % 2 else -1
    c = V(side * (OX - 0.05 + mr.uniform(-0.05, 0.05)), s, deck(s) + PH + 0.11)
    blob('mossc', 0.07, (c.x, c.y, c.z), M['moss'], PLANTS, sq=(1.3, 1, 0.3), sub=1, seed=100 + k)

# 12) wayside shrine beside the north-west end (outside the wing wall)
sh_s, sh_x = HALF + 1.5, -(OX + 1.75)
p = V(sh_x, sh_s, 0)
boxc('sh_step', (0.95, 0.95, 0.5), (p.x, p.y, -0.1), M['trim'])
boxc('sh_shaft', (0.52, 0.52, 1.1), (p.x, p.y, 0.7), M['stone'])
boxc('sh_ledge', (0.66, 0.66, 0.08), (p.x, p.y, 1.29), M['trim'])
boxc('sh_back', (0.10, 0.56, 0.62), (p.x - 0.22, p.y, 1.64), M['stone'])           # back wall; the niche opens toward the road (+x)
for dy in (-0.25, 0.25):
    boxc('sh_side', (0.48, 0.07, 0.62), (p.x, p.y + dy, 1.64), M['wood'])
boxc('sh_roofbase', (0.66, 0.72, 0.05), (p.x, p.y, 1.97), M['wood'])
bm = bmesh.new()                                       # little gable roof (ridge along the road)
pts = [(-0.40, -0.42, 0), (-0.40, 0.42, 0), (0.40, 0.42, 0), (0.40, -0.42, 0), (0, -0.42, 0.32), (0, 0.42, 0.32)]
vv = [bm.verts.new(Vector((p.x + a, p.y + b, 1.995 + c))) for a, b, c in pts]
for f in ((0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 4, 3), (1, 2, 5)):
    bm.faces.new([vv[i] for i in f])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
new_obj('sh_roof', bm, M['wood'], BODY)
boxc('sh_ridge', (0.06, 0.9, 0.06), (p.x, p.y, 2.32), M['wood'])
# small saint figure + candles + flowers in the niche
cone('sh_fig', 0.10, 0.06, 1.33, 1.70, (p.x - 0.08, p.y), M['trim'], segs=8, rot=0)
blob('sh_head', 0.055, (p.x - 0.08, p.y, 1.75), M['trim'], BODY, sub=1)
cone('sh_halo', 0.08, 0.08, 1.78, 1.79, (p.x - 0.1, p.y), M['gold'], segs=10, rot=0)
for dx in (-0.16, 0.16):
    cone('sh_candle', 0.025, 0.025, 1.33, 1.45, (p.x + 0.12, p.y + dx), M['wax'], segs=6, rot=0)
    blob('sh_flame', 0.018, (p.x + 0.12, p.y + dx, 1.47), M['flame'], GLASS, sq=(1, 1, 1.8), sub=1)
for k in range(8):
    a = k / 8 * 2 * math.pi
    blob('sh_fl', 0.05, (p.x + 0.4 * math.cos(a) * 0.9, p.y + 0.4 * math.sin(a) * 0.9, 0.2), M[FLOWER_M[k % 5]] if k % 2 else M['leaf'], PLANTS, sq=(1, 1, 0.7), sub=1, seed=k)
SHRINE_ROT_CENTER = (p.x, p.y)

# ───────────────────────── UVs ─────────────────────────
TS, TW, TC = 2.4, WET_T, 2.4
def uv_obj(o):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify()
    names = [m_.name if m_ else '' for m_ in me.materials]
    for f in bm.faces:
        mn = names[f.material_index] if names else ''
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p_ = l.vert.co; s = -p_.y
            if mn == 'br_cobble':
                u, v_ = p_.x / TC, s / TC
            elif mn == 'br_stone_wet':
                if ax == 0: u, v_ = s * (1 if n.x > 0 else -1) / TS, (p_.z - BOT) / TW
                elif ax == 1: u, v_ = p_.x * (-1 if n.y > 0 else 1) / TS, (p_.z - BOT) / TW
                else: u, v_ = (p_.x + s) / TS, 0.85
            elif mn == 'br_stone_soffit':
                ag = min(arch_geo, key=lambda g: abs(g[0] - s))
                ang = math.atan2(s - ag[0], p_.z - ag[4])
                u, v_ = p_.x / TS, ang * ag[3] / TS
            else:
                if ax == 2: u, v_ = p_.x / TS, p_.y / TS
                elif ax == 0: u, v_ = p_.y * (1 if n.x > 0 else -1) / TS, p_.z / TS
                else: u, v_ = p_.x * (-1 if n.y > 0 else 1) / TS, p_.z / TS
            l[uvl].uv = (u, v_)
    bm.to_mesh(me); bm.free()
for o in BODY: uv_obj(o)

# ───────────────────────── join, bend, shade ─────────────────────────
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o
body = join(BODY, 'bridge_body')
glass = join(GLASS, 'bridge_lamp_glass')
plants = join(PLANTS, 'bridge_plants')
for o in (body, glass, plants):
    for v_ in o.data.vertices:
        v_.co.x += bend(-v_.co.y)
    try:
        o.data.shade_smooth(); o.data.set_sharp_from_angle(angle=math.radians(32))
    except Exception as ex:
        print('shade fallback', ex)
        for p_ in o.data.polygons: p_.use_smooth = False
# merge duplicate material slots by name happened via join; remove unused slots
for o in (body, glass, plants):
    bpy.context.view_layer.objects.active = o
    try: bpy.ops.object.material_slot_remove_unused()
    except Exception: pass

def tris(o): return sum(len(p_.vertices) - 2 for p_ in o.data.polygons)
print('TRIS', {o.name: tris(o) for o in (body, glass, plants)}, 'total', sum(tris(o) for o in (body, glass, plants)))
print('DECK check', [(round(s, 2), round(deck(s), 3)) for s in (-HALF, -3.64, 0, 3.64, HALF)])

os.makedirs(os.path.join(ROOT, 'models', 'src'), exist_ok=True)
if not PREVIEW or '--export' in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'models', 'src', 'bridge.blend'))
    path = os.path.join(ROOT, 'models', 'props', 'bridge.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for o in (body, glass, plants): o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False, export_animations=False,
        export_image_format='JPEG', export_jpeg_quality=84,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print('EXPORTED', path, os.path.getsize(path))

# ───────────────────────── preview renders (in the real world) ─────────────────────────
if PREVIEW:
    sc = bpy.context.scene
    root = bpy.data.objects.new('bridge_root', None); sc.collection.objects.link(root)
    for o in (body, glass, plants): o.parent = root
    root.location = (XC, -ZC, 0)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'autumn-world.glb'))
    if 'EX_Bridge' in bpy.data.objects and '--old' not in argv:
        bpy.data.objects['EX_Bridge'].hide_render = True
    if '--old' in argv:
        root.hide_render = True
        for o in (body, glass, plants): o.hide_render = True
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    try: sc.eevee.taa_render_samples = 24
    except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    sc.world = bpy.data.worlds.new('W'); sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.75, 0.62, 0.55, 1); bg.inputs[1].default_value = 0.8
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 3.5; sd.angle = 0.05; sd.color = (1.0, 0.85, 0.7)
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(0), math.radians(-60))
    cx, cy = XC, -ZC
    def shot(name, loc, target, lens=30):
        cd = bpy.data.cameras.new('C'); cd.lens = lens; cd.clip_start = 0.05
        c = bpy.data.objects.new('C', cd); sc.collection.objects.link(c)
        c.location = loc; c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.camera = c; sc.render.filepath = os.path.join(PREVIEW, name)
        bpy.ops.render.render(write_still=True); print('RENDER', name)
    shots = [
        ('side_w.png', (cx - 13, cy - 3, 1.6), (cx, cy + 1, 0.0), 28),
        ('side_e.png', (cx + 12, cy + 6, 2.4), (cx, cy, 0.0), 28),
        ('deck.png', (cx + 0.6, cy + 12, 1.7), (cx, cy - 2, 0.6), 30),
        ('high.png', (cx - 12, cy + 15, 9), (cx, cy, 0), 28),
        ('lamp.png', (cx - 4.5, cy - 10.5, 1.8), (cx - 2.7, cy - 7.0, 1.2), 35),
    ]
    only = argv[argv.index('--shots') + 1].split(',') if '--shots' in argv else None
    for nm, loc, tg, lens in shots:
        if only and nm.split('.')[0] not in only: continue
        shot(('old_' if '--old' in argv else '') + nm, loc, tg, lens)
