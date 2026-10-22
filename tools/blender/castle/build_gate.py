# 상호성 성문 (castle gate) — headless Blender build
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/castle/build_gate.py -- [--preview DIR] [--open]
# Output: models/props/castle-gate.glb, models/src/castle-gate.blend
#
# Blender axes: X right, Y = into the castle (three.js -Z), Z up. The gate front faces -Y (three +Z).
# Origin = centre of the arch on the front face, ground level.
# Named parts the code animates / paints (castle.js):
#   gate_door_l / gate_door_r  origin on the hinge, swing inward (rotate about up axis)
#   portcullis                 origin at its bottom centre, lowered (closed) in the file; code raises it 5.5 m
#   gate_sign                  front face UV 0..1  -> "상호성" canvas
#   banner_l / banner_r        UV 0..1 -> royal banner canvas; flag_l / flag_r / flag_keep pennants
#   torch_flame_l / torch_flame_r  emissive flames
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
TEXDIR = os.path.join(PREVIEW or '/tmp', 'castle_tex'); os.makedirs(TEXDIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.default_rng(7)
random.seed(7)

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

def save_img(name, rgb, noncolor=False):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32); px[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px[::-1].ravel())   # Blender pixels are bottom-up
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
    n = np.dstack([-dx, dy, np.ones_like(hgt)])      # image rows go down; +V is up
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5

def stone_texture(N=1024, rows=8):
    rh = N // rows
    col = np.zeros((N, N, 3)); hgt = np.zeros((N, N))
    big = fbm(N, N, 3, 11, 3); mid = fbm(N, N, 24, 21, 3); fine = fbm(N, N, 128, 31, 2)
    xs = np.arange(N)
    for r in range(rows):
        cuts = [0]
        while True:
            nxt = cuts[-1] + rng.integers(150, 300)
            if nxt > N - 130: break
            cuts.append(nxt)
        cuts = np.array(cuts) + rng.integers(0, N)
        cuts = np.sort(cuts % N)
        # brick id + distance to nearest cut (wrapping)
        d = np.abs(xs[:, None] - cuts[None, :]); d = np.minimum(d, N - d)
        dx = d.min(1)
        bid = np.searchsorted(cuts, xs, side='right') % len(cuts)
        nb = len(cuts)
        tone = rng.uniform(0.74, 1.12, nb)
        warm = rng.uniform(-0.05, 0.06, nb)
        ys = np.arange(rh)
        dy = np.minimum(ys, rh - 1 - ys)
        dd = np.minimum(dx[None, :], dy[:, None]).astype(float)
        mortar = 4.0
        bev = np.clip((dd - mortar) / 12.0, 0, 1)
        sl = slice(r * rh, (r + 1) * rh)
        base = np.array([0.66, 0.62, 0.56])
        t = tone[bid][None, :]; w = warm[bid][None, :]
        c = np.empty((rh, N, 3))
        c[..., 0] = base[0] * t + w; c[..., 1] = base[1] * t + w * 0.4; c[..., 2] = base[2] * t - w * 0.6
        n = 0.80 + 0.30 * mid[sl] + 0.14 * fine[sl]
        c *= n[..., None]
        c *= (0.72 + 0.28 * bev)[..., None]
        m = (dd <= mortar)
        mc = np.array([0.40, 0.38, 0.35]) * (0.8 + 0.3 * fine[sl])[..., None]
        c[m] = mc[m]
        col[sl] = c
        hgt[sl] = bev * 0.8 + 0.25 * mid[sl] * (bev > 0) + 0.1 * fine[sl]
    col *= (0.82 + 0.25 * big)[..., None]
    # a little moss/soot in the low-frequency dirt
    moss = np.clip((fbm(N, N, 5, 41, 3) - 0.62) * 4, 0, 1)
    col = col * (1 - 0.35 * moss[..., None]) + np.array([0.20, 0.24, 0.12]) * 0.35 * moss[..., None]
    return col, normal_from_height(hgt, 2.2)

def slate_texture(N=512, rows=8):
    rh = N // rows
    col = np.zeros((N, N, 3)); fine = fbm(N, N, 64, 51, 2)
    for r in range(rows):
        sw = 64; off = (r % 2) * sw // 2
        xs = (np.arange(N) + off) % sw
        sid = ((np.arange(N) + off) // sw) % (N // sw)
        tone = rng.uniform(0.75, 1.15, N // sw)
        ys = np.arange(rh)[:, None]                    # 0 = top of the row band (overlap shadow)
        # fish-scale bottom: rounded tile edge
        cx = xs[None, :] - sw / 2
        edge = rh - 1 - np.sqrt(np.clip((sw / 2) ** 2 - cx ** 2, 0, None)) * 0.35
        inside = ys < edge + 6
        shade = 0.55 + 0.45 * np.clip(ys / rh * 1.4, 0, 1)
        gap = (np.abs(cx) > sw / 2 - 2)
        c = np.array([0.30, 0.33, 0.40])[None, None, :] * (tone[sid][None, :] * shade)[..., None]
        c = c * (0.85 + 0.25 * fine[r * rh:(r + 1) * rh])[..., None]
        c[gap | ~inside] *= 0.45
        col[r * rh:(r + 1) * rh] = c
    return col

def wood_texture(N=512, planks=8):
    pw = N // planks
    grain = fbm(N, N, 4, 61, 4, aniso=(1, 12))
    knots = fbm(N, N, 6, 71, 2)
    xs = np.arange(N); pid = xs // pw; lx = xs % pw
    tone = rng.uniform(0.8, 1.15, planks)
    c = np.array([0.40, 0.25, 0.14])[None, None, :] * tone[pid][None, :, None]
    c = c * (0.70 + 0.45 * grain)[..., None] * (0.9 + 0.15 * knots)[..., None]
    gap = (lx < 3) | (lx > pw - 3)
    c[:, gap] *= 0.35
    return c

stone_col, stone_nrm = stone_texture()
IM_STONE = save_img('castle_stone', stone_col)
IM_STONE_N = save_img('castle_stone_n', stone_nrm, noncolor=True)
IM_SLATE = save_img('castle_slate', slate_texture())
IM_WOOD = save_img('castle_wood', wood_texture())

# ───────────────────────── materials ─────────────────────────
def mat(name, color=(0.8, 0.8, 0.8), rough=0.85, metal=0.0, img=None, nrm=None, emit=None, double=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        nt.links.new(t.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (*color, 1)
        nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    if nrm:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 6
    m.use_backface_culling = not double
    return m

M = {
    'stone': mat('stone', (0.86, 0.85, 0.86), img=IM_STONE, nrm=IM_STONE_N),
    'trim': mat('stone_trim', (1.0, 0.95, 0.85), img=IM_STONE, nrm=IM_STONE_N),
    'dark': mat('stone_dark', (0.42, 0.40, 0.40), img=IM_STONE, nrm=IM_STONE_N),
    'slate': mat('slate', (1, 1, 1), rough=0.6, img=IM_SLATE),
    'wood': mat('wood', (1, 1, 1), rough=0.8, img=IM_WOOD),
    'iron': mat('iron', (0.07, 0.07, 0.08), rough=0.45, metal=0.8),
    'gold': mat('gold', (0.95, 0.68, 0.22), rough=0.3, metal=1.0),
    'cloth': mat('cloth_red', (0.62, 0.05, 0.05), rough=0.9, double=True),
    'sign': mat('sign', (0.42, 0.26, 0.14), rough=0.8),
    'flame': mat('flame', (1.0, 0.6, 0.2), emit=(1.0, 0.55, 0.15)),
    'slit': mat('slit', (0.02, 0.02, 0.025), rough=1.0),
}

# ───────────────────────── mesh helpers ─────────────────────────
def new_obj(name, bm, material=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if material: me.materials.append(material)
    return o

def box(name, sx, sy, sz, loc, material, rot=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if rot: bmesh.ops.rotate(bm, matrix=Matrix.Rotation(rot, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return new_obj(name, bm, material)

def cyl(name, r1, r2, z0, z1, center, material, segs=20, cap_top=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=z1 - z0)
    bmesh.ops.translate(bm, vec=Vector((center[0], center[1], (z0 + z1) / 2)), verts=bm.verts)
    return new_obj(name, bm, material)

def prism(name, pts, y0, y1, material, origin=(0, 0, 0)):
    """Extrude a 2D outline (x, z) along +Y from y0 to y1."""
    bm = bmesh.new()
    vs = [bm.verts.new((x - origin[0], y0 - origin[1], z - origin[2])) for x, z in pts]
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, y1 - y0, 0), verts=nv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj(name, bm, material)

def arch_pts(half, spring, n=16, z0=0.0):
    pts = [(half, z0), (half, spring)]
    for i in range(1, n):
        a = math.pi * i / n
        pts.append((half * math.cos(a), spring + half * math.sin(a)))
    pts += [(-half, spring), (-half, z0)]
    return pts

def boolean(target, cutter, op='DIFFERENCE'):
    md = target.modifiers.new('b', 'BOOLEAN'); md.operation = op; md.object = cutter; md.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

# UV mapping ------------------------------------------------------------------
def uv_box(o, T=3.2):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify(); mw = o.matrix_world
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = mw @ l.vert.co
            if ax == 2: u, v = p.x, p.y
            elif ax == 0: u, v = p.y * (1 if n.x > 0 else -1), p.z
            else: u, v = p.x * (-1 if n.y > 0 else 1), p.z
            l[uvl].uv = (u / T, v / T)
    bm.to_mesh(me); bm.free()

def uv_cyl(o, center, r, T=3.2, slant_apex=None):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify(); mw = o.matrix_world
    circ = 2 * math.pi * r; reps = max(1, round(circ / T)); Tu = circ / reps
    for f in bm.faces:
        if abs(f.normal.z) > 0.97:            # caps: planar
            for l in f.loops:
                p = mw @ l.vert.co; l[uvl].uv = (p.x / T, p.y / T)
            continue
        us = []
        for l in f.loops:
            p = mw @ l.vert.co
            us.append(math.atan2(p.y - center[1], p.x - center[0]) / (2 * math.pi))
        if max(us) - min(us) > 0.5: us = [u + 1 if u < 0 else u for u in us]
        for l, u in zip(f.loops, us):
            p = mw @ l.vert.co
            if slant_apex is not None:
                v = -(Vector(slant_apex) - p).length / T
            else:
                v = p.z / T
            l[uvl].uv = (u * reps, v)
    bm.to_mesh(me); bm.free()

def uv_front01(o, x0, x1, z0, z1):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    uvl = bm.loops.layers.uv.verify(); mw = o.matrix_world
    for f in bm.faces:
        for l in f.loops:
            p = mw @ l.vert.co
            if f.normal.y < -0.5:
                l[uvl].uv = ((p.x - x0) / (x1 - x0), (p.z - z0) / (z1 - z0))
            else:
                l[uvl].uv = (0.02, 0.02)
    bm.to_mesh(me); bm.free()

STATIC = []          # objects joined into castle_body at the end
def S(o, uv='box', **kw):
    if uv == 'box': uv_box(o, **kw)
    elif uv == 'cyl': uv_cyl(o, **kw)
    STATIC.append(o); return o

# ───────────────────────── geometry ─────────────────────────
AH, SPR = 2.3, 3.0              # arch half width, spring height → opening 4.6 × 5.3
GH_X, GH_Y, GH_Z = 3.9, 7.0, 9.0
DOOR_Y = 1.3                    # doors recessed behind the front face
PORT_Y = 0.55

# gatehouse with the arch cut through
gh = box('gatehouse', GH_X * 2, GH_Y, GH_Z + 1, (0, GH_Y / 2, (GH_Z - 1) / 2), M['stone'])
boolean(gh, prism('cut', arch_pts(AH, SPR, 20, -0.5), -1, GH_Y + 1, None))
S(gh)
# arch ring (voussoirs) + keystone
ring = arch_pts(AH + 0.6, SPR, 20) + [(-AH, 0)] + list(reversed(arch_pts(AH, SPR, 20)))[1:-1] + [(AH, 0)]
ring_o = arch_pts(AH + 0.6, SPR, 20)
ring_i = list(reversed(arch_pts(AH, SPR, 20)))
S(prism('arch_ring', ring_o + ring_i, -0.22, 0.05, M['trim']))
S(prism('arch_ring_back', ring_o + ring_i, GH_Y - 0.05, GH_Y + 0.15, M['trim']))
S(box('keystone', 0.7, 0.36, 0.95, (0, -0.12, SPR + AH + 0.35), M['trim']))
# tunnel floor + front apron (cobbles = dark stone)
S(box('floor', AH * 2 + 0.05, GH_Y + 0.6, 0.3, (0, GH_Y / 2, -0.11), M['dark']), T=1.6)
S(box('apron', 7.0, 3.0, 0.2, (0, -1.5, -0.08), M['dark']), T=1.6)
# parapet (overhanging) with corbels + merlons
S(box('gh_parapet', GH_X * 2 + 0.7, GH_Y + 0.7, 0.8, (0, GH_Y / 2, GH_Z - 0.4 + 0.4), M['trim']))
for i in range(9):
    x = -3.6 + i * 0.9
    S(box(f'corbel{i}', 0.32, 0.4, 0.5, (x, -0.15, GH_Z - 0.25), M['trim']))
def merlons_line(prefix, x0, x1, y, zb, axis='x', w=0.62, gap=0.5, h=0.85, t=0.42, material=None):
    L = abs(x1 - x0); n = max(2, int((L + gap) / (w + gap)))
    step = (L - w) / (n - 1)
    for i in range(n):
        c = min(x0, x1) + w / 2 + i * step
        if axis == 'x': S(box(f'{prefix}{i}', w, t, h, (c, y, zb + h / 2), material or M['stone']))
        else: S(box(f'{prefix}{i}', t, w, h, (y, c, zb + h / 2), material or M['stone']))
ZT = GH_Z + 0.8
merlons_line('m_ghf', -GH_X - 0.3, GH_X + 0.3, -0.12, ZT)
merlons_line('m_ghb', -GH_X - 0.3, GH_X + 0.3, GH_Y + 0.12, ZT)
merlons_line('m_ghl', 0.3, GH_Y - 0.3, -GH_X - 0.12, ZT, axis='y')
merlons_line('m_ghr', 0.3, GH_Y - 0.3, GH_X + 0.12, ZT, axis='y')
S(box('gh_wallwalk', GH_X * 2 + 0.6, GH_Y + 0.6, 0.05, (0, GH_Y / 2, ZT + 0.02), M['dark']))

# sign plaque "상호성" (painted in code) with a trim frame
S(box('sign_frame', 3.7, 0.16, 1.15, (0, -0.06, 6.75), M['trim']))
sign = box('gate_sign', 3.4, 0.12, 0.9, (0, -0.17, 6.75), M['sign'])
uv_front01(sign, -1.7, 1.7, 6.3, 7.2)
# murder-hole style windows above
for x in (-1.4, 1.4):
    S(box(f'gh_win{x}', 0.35, 0.2, 0.8, (x, -0.02, 8.0), M['slit']), T=1)

# ── towers ──
TR, TX, TY, TZ = 2.45, 5.45, 0.55, 11.2
def tower(side):
    x = side * TX; c = (x, TY)
    S(cyl(f'tower_{side}', TR, TR, -1.0, TZ, c, M['stone'], 24), uv='cyl', center=c, r=TR)
    S(cyl(f'plinth_{side}', TR + 0.42, TR, -1.0, 1.5, c, M['trim'], 24), uv='cyl', center=c, r=TR + 0.4)
    S(cyl(f'corbelring_{side}', TR, TR + 0.35, TZ - 0.9, TZ - 0.3, c, M['trim'], 24), uv='cyl', center=c, r=TR + 0.2)
    S(cyl(f'parapet_{side}', TR + 0.35, TR + 0.35, TZ - 0.3, TZ + 0.45, c, M['stone'], 24), uv='cyl', center=c, r=TR + 0.35)
    for k in range(12):
        a = 2 * math.pi * k / 12
        S(box(f'tm_{side}_{k}', 0.6, 0.38, 0.8, (x + math.cos(a) * (TR + 0.18), TY + math.sin(a) * (TR + 0.18), TZ + 0.85), M['stone'], rot=a + math.pi / 2))
    # conical slate roof
    apex = (x, TY, TZ + 6.2)
    S(cyl(f'roof_{side}', TR + 0.6, 0.02, TZ + 0.25, TZ + 6.2, c, M['slate'], 24), uv='cyl', center=c, r=TR + 0.6, T=2.0, slant_apex=apex)
    S(cyl(f'finial_{side}', 0.14, 0.14, TZ + 6.1, TZ + 6.3, c, M['gold'], 8), uv=None)
    S(cyl(f'pole_{side}', 0.045, 0.045, TZ + 6.2, TZ + 8.4, c, M['iron'], 6), uv=None)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.13)
    bmesh.ops.translate(bm, vec=(x, TY, TZ + 8.45), verts=bm.verts); S(new_obj(f'ball_{side}', bm, M['gold']), uv=None)
    # pennant (painted in code): plane in XZ facing -Y, swallowtail, 6 columns so code can wave it
    fl = flag_mesh(f'flag_{"l" if side < 0 else "r"}', 1.9, 0.95, (x + 0.05, TY, TZ + 7.35))
    # arrow slits facing the road (front = -Y) and sides
    for zz in (3.6, 7.0):
        for a in (-math.pi / 2, -math.pi / 2 + side * 0.75, -math.pi / 2 - side * 0.75):
            S(box(f'slit_{side}_{zz}_{a:.2f}', 0.2, 0.25, 1.1, (x + math.cos(a) * (TR - 0.06), TY + math.sin(a) * (TR - 0.06), zz), M['slit'], rot=a + math.pi / 2), T=1)
    # hanging royal banner on the tower front (painted in code)
    bx = x; by = TY - TR - 0.1
    pts = [(-0.65, 0.0), (0.0, 0.45), (0.65, 0.0), (0.65, 3.0), (-0.65, 3.0)]
    bm = bmesh.new()
    vs = [bm.verts.new((bx + px, by, 5.6 + pz)) for px, pz in pts]
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.verify()
    for l, (px, pz) in zip(f.loops, pts): l[uvl].uv = ((px + 0.65) / 1.3, pz / 3.0)
    if f.normal.y > 0: f.normal_flip()
    bn = new_obj(f'banner_{"l" if side < 0 else "r"}', bm, M['cloth'])
    S(cyl(f'banner_rod_{side}', 0.05, 0.05, 0, 1.6, (0, 0), M['iron'], 6), uv=None)
    rod = STATIC[-1]; rod.rotation_euler = (0, math.pi / 2, 0); rod.location = (bx - 0.8, by + 0.05, 8.65)
    bpy.context.view_layer.update(); rod.data.transform(rod.matrix_world); rod.matrix_world = Matrix()
    return fl

def flag_mesh(name, w, h, base, cols=6):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.verify()
    grid = []
    for i in range(cols + 1):
        u = i / cols
        notch = 0.32 * h if i == cols else 0.0           # swallowtail
        col = []
        for j, v in enumerate((0.0, 0.5, 1.0)):
            z = (v - 0.5) * h
            if i == cols and j == 1: xoff = -notch
            else: xoff = 0
            col.append(bm.verts.new((base[0] + u * w + xoff, base[1], base[2] + z)))
        grid.append(col)
    for i in range(cols):
        for j in range(2):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for l in f.loops:
                co = l.vert.co
                l[uvl].uv = ((co.x - base[0]) / w, (co.z - base[2]) / h + 0.5)
            if f.normal.y > 0: f.normal_flip()
    return new_obj(name, bm, M['cloth'])

tower(-1); tower(1)

# ── torches on the towers beside the arch ──
for side in (-1, 1):
    x = side * 3.42; y = TY - math.sqrt(TR ** 2 - (abs(x) - TX) ** 2) - 0.05
    S(box(f'torch_plate_{side}', 0.28, 0.06, 0.45, (x, y, 3.55), M['iron']), uv=None)
    S(box(f'torch_arm_{side}', 0.07, 0.5, 0.07, (x, y - 0.25, 3.45), M['iron']), uv=None)
    S(cyl(f'torch_cup_{side}', 0.09, 0.2, 3.45, 3.75, (x, y - 0.5), M['iron'], 10), uv=None)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.17, radius2=0.0, depth=0.55)
    bmesh.ops.translate(bm, vec=(0, 0, 0.27), verts=bm.verts)
    fo = new_obj(f'torch_flame_{"l" if side < 0 else "r"}', bm, M['flame']); fo.location = (x, y - 0.5, 3.72)

# ── doors (origin on hinge) ──
def door(side):
    hx = side * (AH - 0.02)
    pts = []
    for x, z in arch_pts(AH - 0.03, SPR, 20, 0.02):
        if side * x >= -1e-6: pts.append((x, z))
    # pts go from (±half,0)->(±half,spring)->...->(0, top); close via (0, 0.02)
    if side > 0:
        pts = [(0.012, 0.02)] + [p for p in pts if p[0] > 0.01] + [(0.012, SPR + AH - 0.03)]
    else:
        pts = [(-0.012, SPR + AH - 0.03)] + [p for p in pts if p[0] < -0.01] + [(-0.012, 0.02)]
        pts = list(reversed(pts))
    name = f'gate_door_{"l" if side < 0 else "r"}'
    o = prism(name, pts, DOOR_Y, DOOR_Y + 0.2, M['wood'], origin=(hx, DOOR_Y + 0.1, 0))
    o.location = (hx, DOOR_Y + 0.1, 0)
    o.data.materials.append(M['iron'])
    # iron straps + ring handle (local coords)
    bm = bmesh.new(); bm.from_mesh(o.data)
    def lbox(sx, sy, sz, c):
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=r['verts'])
        bmesh.ops.translate(bm, vec=Vector(c), verts=r['verts'])
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 1
    for zb in (0.7, 2.5, 4.3):
        xmax = AH - 0.1 if zb <= SPR else math.sqrt(max(0.0, (AH - 0.1) ** 2 - (zb + 0.12 - SPR) ** 2))
        L = xmax - 0.06
        cx_world = side * (0.06 + L / 2)
        lbox(L, 0.05, 0.16, (cx_world - hx, -0.125, zb))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # UV for wood planks (planar x/z)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            p = l.vert.co + Vector((hx, 0, 0))
            l[uvl].uv = (p.x / 1.6, p.z / 1.6)
    bm.to_mesh(o.data); bm.free()
    # ring handle
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.12, radius2=0.12, depth=0.04)
    bmesh.ops.rotate(bm, matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(side * 0.35 - hx, -0.14, 1.6), verts=bm.verts)
    tmp = new_obj('tmp_ring', bm, M['iron'])
    tmp.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    tmp.location = o.location
    tmp.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    return o
door(-1); door(1)

# ── portcullis (closed = lowered) ──
def portcullis():
    bm = bmesh.new()
    def add_box(sx, sy, sz, c):
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=r['verts'])
        bmesh.ops.translate(bm, vec=Vector(c), verts=r['verts'])
    W = AH * 2 + 0.1; nV = 11
    for i in range(nV):
        x = -(AH - 0.06) + i * 2 * (AH - 0.06) / (nV - 1)
        add_box(0.09, 0.09, 5.6, (x, 0, 0.25 + 2.8))
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.07, radius2=0.0, depth=0.28)
        bmesh.ops.rotate(bm, matrix=Matrix.Rotation(math.pi, 3, 'X'), verts=r['verts'])
        bmesh.ops.translate(bm, vec=(x, 0, 0.12), verts=r['verts'])
    for j in range(8):
        add_box(W, 0.07, 0.09, (0, 0, 0.75 + j * 0.68))
    o = new_obj('portcullis', bm, M['iron']); o.location = (0, PORT_Y, 0)
    return o
portcullis()
# slot for the portcullis above the arch is inside the stone; nothing to cut.

# ── curtain walls + end towers ──
WX0, WX1, WY0, WY1, WZ = 7.4, 15.0, 0.4, 2.7, 7.0
for side in (-1, 1):
    cx = side * (WX0 + WX1) / 2
    S(box(f'wall_{side}', WX1 - WX0, WY1 - WY0, WZ + 1, (cx, (WY0 + WY1) / 2, (WZ - 1) / 2), M['stone']))
    S(box(f'wall_cap_{side}', WX1 - WX0, WY1 - WY0 + 0.3, 0.3, (cx, (WY0 + WY1) / 2, WZ + 0.05), M['trim']))
    a, b = sorted((side * WX0, side * WX1))
    merlons_line(f'wm_f{side}', a, b, WY0 - 0.02, WZ + 0.2)
    merlons_line(f'wm_b{side}', a, b, WY1 + 0.02, WZ + 0.2)
    # end tower (square)
    ex = side * (WX1 + 1.5)
    S(box(f'endtower_{side}', 3.2, 3.2, 10, (ex, 1.55, 4.0), M['stone']))
    S(box(f'endtower_cap_{side}', 3.6, 3.6, 0.4, (ex, 1.55, 9.1), M['trim']))
    merlons_line(f'em_f{side}', ex - 1.8, ex + 1.8, 1.55 - 1.65, 9.3)
    merlons_line(f'em_b{side}', ex - 1.8, ex + 1.8, 1.55 + 1.65, 9.3)
    merlons_line(f'em_s{side}', 1.55 - 1.2, 1.55 + 1.2, ex + side * 1.65, 9.3, axis='y')
    merlons_line(f'em_i{side}', 1.55 - 1.2, 1.55 + 1.2, ex - side * 1.65, 9.3, axis='y')
    for zz in (3.0, 6.2):
        S(box(f'ewin_{side}_{zz}', 0.2, 0.2, 0.9, (ex, 1.55 - 1.62, zz), M['slit']), T=1)
    # side wall running back to the keep
    S(box(f'sidewall_{side}', 2.0, 14.0, 7.0, (ex, 3.15 + 7.0, 2.5), M['stone']))
    merlons_line(f'sm_{side}', 3.3, 17.0, ex - side * 0.95, 6.0, axis='y')

# back wall + keep (seen over the gate from the village)
S(box('backwall', (WX1 + 1.5) * 2, 2.0, 7.0, (0, 17.2, 2.5), M['stone']))
merlons_line('bm', -(WX1 + 1.5), WX1 + 1.5, 16.25, 6.0)
KX, KY0, KY1, KZ = 6.0, 9.5, 17.5, 15.0
S(box('keep', KX * 2, KY1 - KY0, KZ + 1, (0, (KY0 + KY1) / 2, (KZ - 1) / 2), M['stone']))
S(box('keep_cap', KX * 2 + 0.6, KY1 - KY0 + 0.6, 0.5, (0, (KY0 + KY1) / 2, KZ + 0.2), M['trim']))
merlons_line('km_f', -KX - 0.3, KX + 0.3, KY0 - 0.15, KZ + 0.45)
merlons_line('km_b', -KX - 0.3, KX + 0.3, KY1 + 0.15, KZ + 0.45)
merlons_line('km_l', KY0, KY1, -KX - 0.15, KZ + 0.45, axis='y')
merlons_line('km_r', KY0, KY1, KX + 0.15, KZ + 0.45, axis='y')
for x in (-3.5, 0, 3.5):
    for zz in (8.0, 11.5):
        S(box(f'kwin_{x}_{zz}', 0.5, 0.2, 1.3, (x, KY0 - 0.05, zz), M['slit']), T=1)
for sx in (-1, 1):
    for sy, y in ((0, KY0), (1, KY1)):
        c = (sx * KX, y)
        S(cyl(f'kt_{sx}_{sy}', 1.45, 1.45, -1.0, KZ + 3.0, c, M['stone'], 16), uv='cyl', center=c, r=1.45)
        S(cyl(f'ktc_{sx}_{sy}', 1.45, 1.7, KZ + 2.4, KZ + 3.0, c, M['trim'], 16), uv='cyl', center=c, r=1.6)
        apex = (c[0], c[1], KZ + 7.2)
        S(cyl(f'ktr_{sx}_{sy}', 1.85, 0.02, KZ + 2.9, KZ + 7.2, c, M['slate'], 16), uv='cyl', center=c, r=1.85, T=2.0, slant_apex=apex)
S(cyl('keep_pole', 0.06, 0.06, KZ + 0.4, KZ + 6.0, (0, (KY0 + KY1) / 2), M['iron'], 6), uv=None)
flag_mesh('flag_keep', 2.6, 1.3, (0.05, (KY0 + KY1) / 2, KZ + 5.25))

# ───────────────────────── join static parts ─────────────────────────
bpy.ops.object.select_all(action='DESELECT')
for o in STATIC: o.select_set(True)
bpy.context.view_layer.objects.active = STATIC[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'castle_body'; body.data.name = 'castle_body'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# weld duplicate materials into slots by name
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    for p in o.data.polygons: p.use_smooth = False

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)
total = sum(tris(o) for o in bpy.data.objects if o.type == 'MESH')
print('TRIS', total, {o.name: tris(o) for o in bpy.data.objects if o.type == 'MESH' and tris(o) > 300})

os.makedirs(os.path.join(ROOT, 'models', 'src'), exist_ok=True)
if not PREVIEW or '--export' in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'models', 'src', 'castle-gate.blend'))
    path = os.path.join(ROOT, 'models', 'props', 'castle-gate.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False, export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False, export_animations=False,
        export_image_format='JPEG', export_jpeg_quality=82,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print('EXPORTED', path, os.path.getsize(path))

# ───────────────────────── preview renders ─────────────────────────
if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1400, 900
    try: sc.eevee.taa_render_samples = 32
    except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    sc.world = bpy.data.worlds.new('W'); sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.55, 0.62, 0.75, 1); bg.inputs[1].default_value = 0.9
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.02))
    g = bpy.context.object; gm = mat('ground', (0.32, 0.26, 0.15)); g.data.materials.append(gm)
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 4.0; sd.angle = 0.05
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    def shot(name, loc, target, lens=35):
        cd = bpy.data.cameras.new('C'); cd.lens = lens
        c = bpy.data.objects.new('C', cd); sc.collection.objects.link(c)
        c.location = loc; c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.camera = c; sc.render.filepath = os.path.join(PREVIEW, name)
        bpy.ops.render.render(write_still=True); print('RENDER', name)
    shot('front.png', (6, -34, 7), (0, 0, 6.5))
    shot('close.png', (3, -12, 2.5), (0, 0, 4.0), 28)
    shot('high.png', (-24, -32, 22), (0, 4, 4))
    # open state
    bpy.data.objects['gate_door_l'].rotation_euler.z = math.radians(100)
    bpy.data.objects['gate_door_r'].rotation_euler.z = math.radians(-100)
    bpy.data.objects['portcullis'].location.z = 5.5
    shot('open.png', (3, -12, 2.5), (0, 0, 4.0), 28)
    shot('back.png', (10, 40, 18), (0, 5, 4))
