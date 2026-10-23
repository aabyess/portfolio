"""Realistic rigged horse: anatomical lofts -> voxel union -> smooth -> decimate,
smooth region-based skin weights, mane/tail strands, saddle or draft harness.
Bone names identical to the old rig (+ tail_end). Actions Idle/Walk/Gallop."""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from common3 import (Builder, mat, empty, catmull, frames_along, frames_up, apply_mods, join, mesh_tris,
                     srgb2lin, FPS)

V = Vector

LEGS = {  # name: (x, upper head, upper tail/knee, foot)  -- identical to the old rig
    'fl': (0.15, (-0.48, 1.15), (-0.48, 0.58), (-0.49, 0.02)),
    'fr': (-0.15, (-0.48, 1.15), (-0.48, 0.58), (-0.49, 0.02)),
    'rl': (0.15, (0.42, 1.18), (0.53, 0.60), (0.47, 0.02)),
    'rr': (-0.15, (0.42, 1.18), (0.53, 0.60), (0.47, 0.02)),
}

# ---------------------------------------------------------------- anatomy (rig-local, dy = 0)
TORSO = [  # y, zc, half-width, half-height
    (-0.875, 1.21, 0.04, 0.05),
    (-0.85, 1.21, 0.12, 0.16),
    (-0.80, 1.22, 0.175, 0.245),
    (-0.68, 1.24, 0.215, 0.305),
    (-0.48, 1.245, 0.245, 0.325),
    (-0.22, 1.215, 0.27, 0.305),
    (0.04, 1.205, 0.285, 0.30),
    (0.28, 1.235, 0.28, 0.28),
    (0.48, 1.285, 0.275, 0.25),
    (0.65, 1.295, 0.245, 0.23),
    (0.77, 1.28, 0.19, 0.185),
    (0.825, 1.275, 0.10, 0.11),
    (0.845, 1.275, 0.03, 0.03),
]
NECK = [  # (y, z), half-width, half-height (sagittal)
    ((-0.46, 1.27), 0.21, 0.31),
    ((-0.62, 1.42), 0.175, 0.28),
    ((-0.75, 1.59), 0.14, 0.225),
    ((-0.85, 1.74), 0.115, 0.175),
    ((-0.92, 1.86), 0.098, 0.14),
    ((-0.96, 1.935), 0.088, 0.112),
    ((-0.975, 1.975), 0.075, 0.085),
]
HEAD_P0 = (-0.965, 1.995)
MANE_ROOTS = [(-0.93, 1.96), (-0.80, 1.81), (-0.66, 1.66)]   # crest points: poll -> withers (approx.)
HEAD_P1 = (-1.37, 1.625)
HEAD = [  # s, half-width, half-height, offset along 'face-up' (negative = toward throat)
    (-0.02, 0.05, 0.05, -0.01),
    (0.03, 0.095, 0.105, -0.03),
    (0.15, 0.118, 0.152, -0.065),
    (0.30, 0.108, 0.140, -0.055),
    (0.48, 0.088, 0.108, -0.025),
    (0.66, 0.074, 0.088, -0.006),
    (0.84, 0.071, 0.082, -0.008),
    (0.95, 0.070, 0.075, -0.014),
    (1.00, 0.055, 0.058, -0.016),
    (1.02, 0.02, 0.02, -0.016),
]
FRONT_LEG = [  # y, z, half-width (X), half-depth (Y)
    (-0.50, 1.24, 0.12, 0.19),
    (-0.50, 1.06, 0.11, 0.165),
    (-0.49, 0.93, 0.086, 0.125),
    (-0.485, 0.79, 0.068, 0.092),
    (-0.48, 0.67, 0.051, 0.068),
    (-0.48, 0.585, 0.056, 0.074),
    (-0.48, 0.52, 0.049, 0.058),
    (-0.482, 0.44, 0.037, 0.047),
    (-0.485, 0.33, 0.035, 0.045),
    (-0.49, 0.245, 0.045, 0.057),
    (-0.497, 0.19, 0.041, 0.049),
    (-0.51, 0.125, 0.036, 0.040),
    (-0.52, 0.085, 0.040, 0.046),
]
REAR_LEG = [
    (0.40, 1.30, 0.15, 0.27),
    (0.44, 1.13, 0.145, 0.265),
    (0.475, 0.98, 0.125, 0.225),
    (0.51, 0.845, 0.092, 0.158),
    (0.54, 0.725, 0.068, 0.115),
    (0.552, 0.625, 0.054, 0.098),
    (0.54, 0.545, 0.047, 0.07),
    (0.522, 0.44, 0.039, 0.054),
    (0.508, 0.33, 0.037, 0.05),
    (0.50, 0.245, 0.046, 0.059),
    (0.493, 0.19, 0.041, 0.049),
    (0.48, 0.125, 0.036, 0.040),
    (0.47, 0.085, 0.040, 0.046),
]


def sst(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def chain3(t, b0, b1, b2, t1, t2):
    f1 = sst(t1[0], t1[1], t)
    f2 = sst(t2[0], t2[1], t)
    return {b0: 1 - f1, b1: f1 * (1 - f2), b2: f1 * f2}


class Region:
    def __init__(self, name, C, T, S, U, hw, hh, chain):
        self.name = name
        self.C = np.array([tuple(c) for c in C])
        self.T = np.array([tuple(c) for c in T])
        self.S = np.array([tuple(c) for c in S])
        self.U = np.array([tuple(c) for c in U])
        self.hw = np.array(hw)
        self.hh = np.array(hh)
        self.chain = chain
        seg = np.linalg.norm(np.diff(self.C, axis=0), axis=1)
        self.cum = np.concatenate([[0], np.cumsum(seg)])
        self.cum /= self.cum[-1]


def mats():
    return dict(
        coat=mat("Horse_Coat", "#7a4524", rough=0.7, vcol=True),
        mane=mat("Horse_Mane", "#1c1410", rough=0.75),
        hoof=mat("Horse_Hoof", "#2b2420", rough=0.55),
        eye=mat("Horse_Eye", "#0b0807", rough=0.12),
        nostril=mat("Horse_Nostril", "#120c0a", rough=0.7),
        leather=mat("Leather_Dark", "#3a2214", rough=0.55),
        saddle=mat("Leather_Saddle", "#6e3d1d", rough=0.62),
        blanket=mat("Cloth_Red", "#7d2620", rough=0.95),
        trim=mat("Cloth_Gold", "#b98d3a", rough=0.7),
        brass=mat("Metal_Brass", "#c09a52", rough=0.35, metal=0.55),
        iron=mat("Metal_Iron", "#4a4848", rough=0.45, metal=0.5),
        wool=mat("Cloth_Wool", "#6b6450", rough=1.0),
        collar=mat("Leather_Collar", "#2a1a12", rough=0.5),
        hair=hair_material(),
    )


def hair_texture(W=512, H=256, ncol=4, seed=4):
    """RGBA strands: ncol clump columns, root at the top row (v=1), tips toward v=0."""
    rng = np.random.default_rng(seed)
    acc_a = np.zeros((H, W))
    acc_c = np.zeros((H, W, 3))
    ys = np.arange(H)
    cw = W // ncol
    for k in range(ncol):
        for i in range(int(cw * 1.6)):
            x0 = k * cw + rng.uniform(0.06, 0.94) * cw
            L = rng.uniform(0.55, 1.0) * H
            amp = rng.uniform(0.5, 3.0); fr = rng.uniform(0.5, 2.5); ph = rng.uniform(0, 6.3)
            drift = rng.uniform(-0.04, 0.04) * cw
            wdt = rng.uniform(0.6, 1.4)
            tone = rng.uniform(0.6, 1.4)
            c = np.array([0.12, 0.085, 0.065]) * tone
            if rng.random() < 0.12:
                c = np.array([0.30, 0.18, 0.10]) * tone
            t = ys / L                     # row 0 = bottom in Blender; root at the top -> flip below
            t = (H - 1 - ys) / L
            ok = t <= 1
            xs = x0 + amp * np.sin(fr * t * 6.28 + ph) + drift * t
            xs = np.clip(xs, k * cw + 1, (k + 1) * cw - 2)
            a_ = np.clip(1.0 - t, 0, 1) ** 0.35 * ok
            xi = np.floor(xs).astype(int)
            fx = xs - xi
            for dx, wgt in ((0, 1 - fx), (1, fx)):
                col = np.clip(xi + dx, 0, W - 1)
                aa = a_ * np.clip(wgt * wdt + 0.25, 0, 1)
                m = aa > acc_a[ys, col]
                acc_c[ys[m], col[m]] = c * (0.85 + 0.3 * (1 - np.clip(t[m], 0, 1)))[:, None]
                acc_a[ys, col] = np.maximum(acc_a[ys, col], aa)
    a2 = (acc_a + np.roll(acc_a, 1, 1) * 0.5 + np.roll(acc_a, -1, 1) * 0.5) / 2.0
    a2 = np.clip(a2 * 1.25, 0, 1)
    c2 = acc_c.copy()
    c2[acc_a < 0.05] = [0.04, 0.03, 0.025]
    return np.dstack([c2, a2])


def hair_material():
    img = bpy.data.images.get("horse_hair")
    if img is None:
        rgba = hair_texture()
        H, W = rgba.shape[:2]
        img = bpy.data.images.new("horse_hair", W, H, alpha=True)
        img.pixels.foreach_set(rgba.astype(np.float32).ravel())
        img.file_format = 'PNG'
        img.pack()
    m = bpy.data.materials.new("Horse_Hair")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img
    nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
    rnd = nt.nodes.new('ShaderNodeMath'); rnd.operation = 'ROUND'
    nt.links.new(ti.outputs['Alpha'], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.55
    m.use_backface_culling = False
    try:
        m.surface_render_method = 'DITHERED'
    except Exception:
        pass
    m.diffuse_color = (0.05, 0.04, 0.03, 1)
    return m

# ---------------------------------------------------------------- geometry helpers
def egg_ring(n, top_narrow=0.10, bottom_flat=0.0):
    out = []
    for j in range(n):
        th = 2 * math.pi * j / n
        c, s = math.cos(th), math.sin(th)
        x = c * (1 - top_narrow * max(0.0, s) + bottom_flat * min(0.0, s) * 0.0)
        out.append((x, s))
    return out


class Horse:
    def __init__(self, dy=0.0, name="horse"):
        self.dy = dy
        self.name = name
        self.M = mats()
        self.regions = []

    def P(self, x, y, z):
        return V((x, y + self.dy, z))

    # ------------------------------------------------------------ armature
    def build_armature(self):
        P = self.P
        arm_data = bpy.data.armatures.new(self.name + "_rig")
        arm = bpy.data.objects.new(self.name + "_rig", arm_data)
        bpy.context.scene.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        eb = arm_data.edit_bones

        def bone(n, h, t, parent=None):
            b = eb.new(n)
            b.head, b.tail = h, t
            b.roll = 0
            if parent:
                b.parent = eb[parent]
                b.use_connect = False
            return b

        bone('root', P(0, 0, 0), P(0, -0.4, 0))
        bone('body', P(0, 0.0, 1.22), P(0, -0.4, 1.22), 'root')
        bone('neck', P(0, -0.62, 1.40), P(0, -0.95, 1.90), 'body')
        bone('head', P(0, -0.95, 1.92), P(0, -1.32, 1.62), 'neck')
        bone('tail', P(0, 0.70, 1.38), P(0, 0.98, 0.88), 'body')
        bone('tail_end', P(0, 0.98, 0.88), P(0, 1.04, 0.50), 'tail')
        bone('tail_tip', P(0, 1.01, 0.70), P(0, 1.05, 0.40), 'tail_end')
        for k, (x, h, kn, ft) in LEGS.items():
            bone('leg_%s_up' % k, P(x, *h), P(x, *kn), 'body')
            bone('leg_%s_low' % k, P(x, *kn), P(x, *ft), 'leg_%s_up' % k)
        # ears (pivot at the ear base) and mane sway bones along the crest
        for nm, sx in (('ear_l', 1), ('ear_r', -1)):
            base = self.head_point(0.045, sx * 0.055, 0.075)
            bone(nm, base, base + V((sx * 0.03, 0.0, 0.13)), 'head')
        for i, (yy, zz) in enumerate(MANE_ROOTS):
            r = P(0, yy, zz)
            bone('mane_%d' % (i + 1), r, r + V((-0.16, 0.02, -0.18)), 'neck')
        bpy.ops.object.mode_set(mode='OBJECT')
        self.arm = arm
        return arm

    # ------------------------------------------------------------ body lofts
    def _region_loft(self, b, name, centers, frames, hw, hh, ring, chain, M=None):
        b.loft(centers, frames, lambda i: [(x * hw[i], y * hh[i]) for x, y in ring], self.M['coat'])
        self.regions.append(Region(name, centers, [f[0] for f in frames], [f[1] for f in frames],
                                   [f[2] for f in frames], hw, hh, chain))

    def head_frame(self):
        P = self.P
        p0, p1 = P(0, *HEAD_P0), P(0, *HEAD_P1)
        d = (p1 - p0)
        L = d.length
        d.normalize()
        up = V((0, 0, 1)) - d * d.z
        up.normalize()          # 'face' side (forehead / nose bridge)
        return p0, d, up, L

    def head_point(self, s, x=0.0, u=0.0):
        p0, d, up, L = self.head_frame()
        return p0 + d * (s * L) + V((x, 0, 0)) + up * u

    def build_body(self):
        P = self.P
        b = Builder()
        RING = egg_ring(24, 0.12)
        # torso
        sec = catmull(TORSO, 4)
        C = [P(0, s[0], s[1]) for s in sec]
        fr = frames_up(C, (0, 0, 1))
        self._region_loft(b, 'torso', C, fr, [s[2] for s in sec], [s[3] for s in sec], RING,
                          lambda t: {'body': np.ones_like(t)})
        # neck
        sec = catmull([(*c, w, h) for c, w, h in NECK], 4)
        C = [P(0, s[0], s[1]) for s in sec]
        fr = frames_up(C, lambda i, p: (0, -0.25, 1))
        ring = egg_ring(22, 0.30)
        self._region_loft(b, 'neck', C, fr, [s[2] for s in sec], [s[3] for s in sec], ring,
                          lambda t: chain3(t, 'body', 'neck', 'head', (0.08, 0.42), (0.86, 0.99)))
        # head
        p0, d, up, L = self.head_frame()
        sec = catmull(HEAD, 4)
        C = [p0 + d * (s[0] * L) + up * s[3] for s in sec]
        fr = frames_up(C, lambda i, p: up)
        self._region_loft(b, 'head', C, fr, [s[1] for s in sec], [s[2] for s in sec], egg_ring(22, 0.18),
                          lambda t: {'head': np.ones_like(t)})
        # cheeks / jaw, brow, lips, chest, shoulders, elbows, haunches, hocks (blobs, belong to nearby regions)
        for sx in (1, -1):
            b.ellipsoid(self.head_point(0.22, 0.055 * sx, -0.075), (0.055, 0.095, 0.085), self.M['coat'], 14, 10,
                        M=self._rot_head())
            b.ellipsoid(self.head_point(0.20, 0.072 * sx, 0.06), (0.03, 0.04, 0.025), self.M['coat'], 10, 6)
            b.ellipsoid(P(0.075 * sx, -0.78, 1.16), (0.085, 0.085, 0.12), self.M['coat'], 14, 10)
            b.ellipsoid(P(0.165 * sx, -0.57, 1.33), (0.075, 0.17, 0.16), self.M['coat'], 14, 10,
                        M=self._rot_x(P(0.165 * sx, -0.57, 1.33), -0.5))
            b.ellipsoid(P(0.12 * sx, -0.40, 0.99), (0.055, 0.07, 0.07), self.M['coat'], 12, 8)
        b.ellipsoid(self.head_point(0.985, 0, -0.06), (0.05, 0.05, 0.03), self.M['coat'], 12, 8,
                    M=self._rot_head())
        # legs
        for k, (x, h, kn, ft) in LEGS.items():
            front = k[0] == 'f'
            data = FRONT_LEG if front else REAR_LEG
            sec = catmull(data, 4)
            sx = 1 if x > 0 else -1
            n = len(sec)
            C = [P(sx * (0.15 - 0.02 * (i / (n - 1)) if front else 0.165 - 0.035 * (i / (n - 1))), s[0], s[1])
                 for i, s in enumerate(sec)]
            fr = frames_up(C, (0, -1, 0))
            # knee / hock param
            zj = 0.60
            tj = next(i for i, s in enumerate(sec) if s[1] < zj) / (n - 1)
            tb = (0.10, 0.27) if front else (0.13, 0.30)
            self._region_loft(b, 'leg_' + k, C, fr, [s[2] for s in sec], [s[3] for s in sec], egg_ring(18, 0.0),
                              (lambda tj_, tb_, k_: (lambda t: chain3(t, 'body', 'leg_%s_up' % k_, 'leg_%s_low' % k_,
                                                                        tb_, (tj_ - 0.035, tj_ + 0.02))))(tj, tb, k))
            if not front:
                b.ellipsoid(P(sx * 0.155, 0.59, 0.645), (0.035, 0.045, 0.06), self.M['coat'], 10, 8)
        # tail dock
        C = [P(0, 0.70, 1.40), P(0, 0.79, 1.40), P(0, 0.85, 1.35), P(0, 0.885, 1.26), P(0, 0.90, 1.18)]
        sec = catmull([(*c, r) for c, r in zip(C, (0.06, 0.052, 0.045, 0.038, 0.028))], 3)
        C = [V(s[:3]) for s in sec]
        fr = frames_up(C, (0, 1, 0.3))
        rr = [s[3] for s in sec]
        self._region_loft(b, 'dock', C, fr, rr, rr, egg_ring(14, 0.0),
                          lambda t: {'body': 1 - sst(0.05, 0.4, t), 'tail': sst(0.05, 0.4, t)})
        ob = b.to_object(self.name + "_body")
        # voxel union + smoothing
        r = ob.modifiers.new("remesh", 'REMESH')
        r.mode = 'VOXEL'
        r.voxel_size = 0.009
        r.adaptivity = 0.0
        s = ob.modifiers.new("smooth", 'SMOOTH')
        s.factor = 0.7
        s.iterations = 8
        apply_mods(ob)
        n = mesh_tris(ob)
        dm = ob.modifiers.new("dec", 'DECIMATE')
        dm.ratio = min(1.0, 6400 / max(n, 1))
        apply_mods(ob)
        ob.data.shade_smooth()
        ob.data.materials.clear()
        ob.data.materials.append(self.M['coat'])
        print("BODY tris raw", n, "->", mesh_tris(ob))
        self.body = ob
        bpy.context.view_layer.update()
        self.bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
        return ob

    def _rot_head(self):
        p0, d, up, L = self.head_frame()
        ang = math.atan2(-d.z, -d.y)   # pitch of the head axis
        return None

    def _rot_x(self, c, a):
        return Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Translation(-c)

    # ------------------------------------------------------------ surface utils
    def hit(self, origin, target, off=0.0):
        origin, target = V(origin), V(target)
        d = (target - origin).normalized()
        loc, nrm, idx, dist = self.bvh.ray_cast(origin, d, (target - origin).length + 0.5)
        if loc is None:
            loc, nrm, idx, dist = self.bvh.find_nearest(target)
        return loc + nrm * off, nrm

    def ring_hits(self, center, side, up, angles, off, reach=0.6):
        pts, nrms = [], []
        for a in angles:
            dirv = side * math.cos(a) + up * math.sin(a)
            p, n = self.hit(center + dirv * reach, center, off)
            pts.append(p)
            nrms.append(n)
        return pts, nrms

    def ribbon(self, b, pts, nrms, width, thick, m, closed=False, sub=0):
        if sub:
            pp = catmull([(*p, *n) for p, n in zip(pts, nrms)], sub, closed)
            pts = [V(q[:3]) for q in pp]
            nrms = [V(q[3:]).normalized() for q in pp]
            if closed:
                pass
        n = len(pts)
        rings = []
        fr = []
        for i in range(n):
            if closed:
                t = (pts[(i + 1) % n] - pts[(i - 1) % n]).normalized()
            else:
                t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            nn = (nrms[i] - t * t.dot(nrms[i])).normalized()
            s = t.cross(nn).normalized()
            fr.append((t, s, nn))
        prof = [(-width / 2, 0), (width / 2, 0), (width / 2 * 0.9, thick), (-width / 2 * 0.9, thick)]
        return b.loft(pts, fr, lambda i: prof, m, cap0=not closed, cap1=not closed, closed_path=closed)

    def surface_patch(self, b, y0, y1, a0, a1, nu, nv, off_fn, thick, m, axis_z=1.22, flat_bottom=False):
        """Patch over the torso: rows along Y, columns around the barrel (angle 0 = top, + = left (+X))."""
        top, bot = [], []
        for i in range(nu + 1):
            y = y0 + (y1 - y0) * i / nu
            rt, rb = [], []
            for j in range(nv + 1):
                a = a0 + (a1 - a0) * j / nv
                dirv = V((math.sin(a), 0, math.cos(a)))
                c = self.P(0, y, axis_z)
                p, n = self.hit(c + dirv * 0.9, c, 0.0)
                o = off_fn(i / nu, j / nv)
                rb.append(p + n * o)
                rt.append(p + n * (o + thick))
            top.append(rt)
            bot.append(rb)
        verts, faces = [], []
        W = nv + 1
        for g in (top, bot):
            for r in g:
                verts.extend(r)
        nT = (nu + 1) * W
        for i in range(nu):
            for j in range(nv):
                a = i * W + j
                faces.append((a, a + 1, a + W + 1, a + W))
                faces.append((nT + a, nT + a + W, nT + a + W + 1, nT + a + 1))
        # side walls
        border = [(0, j) for j in range(nv)] + [(i, nv) for i in range(nu)] + \
                 [(nu, j) for j in range(nv, 0, -1)] + [(i, 0) for i in range(nu, 0, -1)]
        for k in range(len(border)):
            i0, j0 = border[k]
            i1, j1 = border[(k + 1) % len(border)]
            a, c = i0 * W + j0, i1 * W + j1
            faces.append((a, c, nT + c, nT + a))
        return b.add(verts, faces, m), top

    # ------------------------------------------------------------ hair, hooves, face
    def build_details(self):
        P, M = self.P, self.M
        b = Builder()
        # hooves
        for k, (x, h, kn, ft) in LEGS.items():
            front = k[0] == 'f'
            sx = 1 if x > 0 else -1
            cx = sx * (0.13 if front else 0.13)
            cy = -0.523 if front else 0.468
            secs = [(0.098, 0.039, 0.044, 0.0), (0.085, 0.044, 0.050, -0.004), (0.045, 0.051, 0.060, -0.013),
                    (0.008, 0.056, 0.067, -0.021), (0.0, 0.054, 0.064, -0.021), (-0.0, 0.0, 0.0, -0.02)]
            C = [P(cx, cy + s[3], s[0]) for s in secs]
            fr = [(V((0, 0, -1)), V((1, 0, 0)), V((0, -1, 0)))] * len(C)
            ring = []
            for j in range(16):
                th = 2 * math.pi * j / 16
                c_, s_ = math.cos(th), math.sin(th)
                ring.append((c_ * (1 - 0.15 * max(0, -s_)), s_ * (1 + 0.08 * max(0, s_))))
            b.loft(C, fr, lambda i: [(xx * secs[i][1], yy * secs[i][2]) for xx, yy in ring], M['hoof'])
        hooves = b.to_object(self.name + "_hooves")
        self.hooves = hooves

        # eyes, nostrils, ears
        f = Builder()
        p0, d, up, L = self.head_frame()
        for sx in (1, -1):
            c = self.head_point(0.215, 0, 0.02)
            e, n = self.hit(c + V((sx * 0.4, 0, 0.0)), c, -0.006)
            f.ellipsoid(e, (0.02, 0.026, 0.021), M['eye'], 12, 8)
            c = self.head_point(0.965, 0, -0.012)
            pn, nn = self.hit(c + (V((sx * 0.6, 0, 0)) + d * 0.9).normalized() * 0.4, c, -0.004)
            Mrot = Matrix.Translation(pn) @ (V((0, 0, 1)).rotation_difference(nn)).to_matrix().to_4x4()
            f.ellipsoid((0, 0, 0), (0.014, 0.024, 0.008), M['nostril'], 10, 6, M=Mrot @ Matrix.Rotation(
                -0.5 * sx, 4, 'Z'))
            # ear: cupped leaf shape (separate object -> rigid on the ear bones)
            base = self.head_point(0.045, sx * 0.055, 0.075)
            tip_dir = (V((sx * 0.22, 0, 0)) + up * 0.55 + V((0, 0, 0.8)) - d * 0.1).normalized()
            pts = [base + tip_dir * (0.135 * t) for t in (0.0, 0.25, 0.5, 0.75, 0.93, 1.0)]
            wid = [0.036, 0.040, 0.034, 0.022, 0.010, 0.002]
            fr = frames_up(pts, lambda i, p: V((sx, 0, 0)))
            ring = [(math.cos(2 * math.pi * j / 14), math.sin(2 * math.pi * j / 14)) for j in range(14)]

            def prof(i, wid=wid):
                w = wid[i]
                return [(xx * w * 1.0, yy * w * 0.42 - 0.35 * w * (xx * xx)) for xx, yy in ring]
            eb = Builder()
            eb.loft(pts, fr, prof, M['coat'])
            setattr(self, 'ear_' + ('l' if sx > 0 else 'r'), eb.to_object(self.name + "_ear_" + ('l' if sx > 0 else 'r')))
        face = f.to_object(self.name + "_face")
        self.face = face
        self.build_hair()

    # ------------------------------------------------------------ hair (solid core + alpha cards)
    def crest_points(self, n=24):
        sec = catmull([(*c, w, hh) for c, w, hh in NECK], 4)
        pts = []
        for s_ in sec[1:-1]:
            c = self.P(0, s_[0], s_[1])
            p, nn = self.hit(c + V((0, -0.25, 1)).normalized() * 0.6, c, 0.0)
            pts.append(p)
        # resample uniformly
        L = [0.0]
        for i in range(1, len(pts)):
            L.append(L[-1] + (pts[i] - pts[i - 1]).length)
        out = []
        for k in range(n):
            t = L[-1] * k / (n - 1)
            i = max(j for j in range(len(L)) if L[j] <= t + 1e-9)
            i = min(i, len(pts) - 2)
            f = (t - L[i]) / max(L[i + 1] - L[i], 1e-9)
            out.append(pts[i].lerp(pts[i + 1], f))
        return out[::-1]          # poll -> withers

    def card(self, b, pts, widths, sides, u0, u1, m, normals=None, bend=0.0):
        """Strip along pts; v=1 at the root, 0 at the tip. sides: per-point unit side vectors."""
        n = len(pts)
        verts, faces, uvs = [], [], []
        for i in range(n):
            v = 1.0 - i / (n - 1)
            w = widths[i]
            s = sides[i]
            off = normals[i] * bend * w if normals is not None else V((0, 0, 0))
            verts += [pts[i] - s * w / 2 + off, pts[i] + off * 0.0, pts[i] + s * w / 2 + off]
            uvs += [(u0, v), ((u0 + u1) / 2, v), (u1, v)]
        for i in range(n - 1):
            for j in range(2):
                a = i * 3 + j
                faces.append((a, a + 1, a + 4, a + 3))
        bv, bf = b.add(verts, faces, m)
        uvl = b.uvl
        for f in bf:
            for l in f.loops:
                idx = bv.index(l.vert)
                l[uvl].uv = uvs[idx]
        return bf

    def build_hair(self):
        M = self.M
        rnd = random.Random(11)
        crest = self.crest_points(26)
        self.crest = crest
        # solid crest ridge (gives the mane volume + a dark base under the cards)
        h = Builder()
        h.sweep([c + V((-0.006, 0, 0.004)) for c in crest], [0.03] * len(crest), M['mane'], n=10,
                ellipse=(0.9, 1.0), up=(1, 0, 0))
        # short solid locks hugging the right side of the crest
        for i in range(2, len(crest) - 2, 2):
            c = crest[i]
            p1, n1 = self.bvh.find_nearest(c + V((-0.07, 0, -0.06)))[:2]
            p2, n2 = self.bvh.find_nearest(c + V((-0.10, 0.0, -0.14)))[:2]
            h.sweep([c + V((-0.01, 0, 0)), p1 + n1 * 0.016, p2 + n2 * 0.010], [0.022, 0.02, 0.006], M['mane'], n=6,
                    ellipse=(1.6, 0.5), up=(1, 0, 0), sub=2)
        self.mane = h.to_object(self.name + "_mane")
        # tail core (dock continuation; cards cover it)
        t = Builder()
        bund = [self.P(0, 0.84, 1.37), self.P(0, 0.90, 1.26), self.P(0, 0.95, 1.10), self.P(0, 0.985, 0.90),
                self.P(0, 1.00, 0.74), self.P(0, 1.005, 0.64)]
        t.sweep(bund, [0.042, 0.048, 0.055, 0.052, 0.04, 0.012], M['mane'], n=12, sub=2, ellipse=(0.9, 1.0))
        self.tail = t.to_object(self.name + "_tail")

        hm = M['hair']
        NCOL = 4

        def ucol(k):
            k = k % NCOL
            return k / NCOL + 0.004, (k + 1) / NCOL - 0.004
        # ---- mane cards: lie on the right side of the neck, shingled in 2 layers
        mc = Builder()
        nC = len(crest)
        for layer, (off, cnt) in enumerate(((0.010, 34), (0.024, 28), (0.040, 16))):
            for k in range(cnt):
                t_ = (k + rnd.uniform(-0.3, 0.3)) / (cnt - 1)
                t_ = min(max(t_, 0.0), 1.0)
                fi = t_ * (nC - 1)
                i0 = min(int(fi), nC - 2)
                root = crest[i0].lerp(crest[i0 + 1], fi - i0)
                tang = (crest[i0 + 1] - crest[i0]).normalized()
                env = math.sin(math.pi * min(1.0, 0.12 + t_ * 0.95))
                L = (0.24 + 0.24 * env) * rnd.uniform(0.85, 1.15) * (1.0 - 0.12 * layer)
                pts, sides, nrms = [], [], []
                p = root + V((0.012 if layer == 0 else 0.0, 0, 0.012))
                seg = L / 6
                dirv = V((-0.75, 0.05, 0.45)).normalized()
                for q in range(7):
                    pn, nn = self.bvh.find_nearest(p)[:2]
                    if q > 0:
                        p = pn + nn * (off + 0.006 * q)
                    pts.append(p.copy())
                    nrms.append(nn)
                    s_ = tang - nn * nn.dot(tang)
                    sides.append(s_.normalized())
                    g = V((0, 0.06, -1)).normalized()
                    dirv = (dirv + g * 0.55).normalized()
                    dirv = (dirv - nn * nn.dot(dirv) * 0.8).normalized()
                    p = p + dirv * seg
                w0 = rnd.uniform(0.055, 0.08)
                widths = [w0 * (1.0 - 0.45 * (q / 6) ** 1.5) for q in range(7)]
                self.card(mc, pts, widths, sides, *ucol(k + layer), hm, normals=nrms, bend=0.15)
        # a few upright cards along the top of the crest (the mane 'stands' a little at the root)
        for k in range(18):
            t_ = k / 17
            fi = t_ * (nC - 1)
            i0 = min(int(fi), nC - 2)
            root = crest[i0].lerp(crest[i0 + 1], fi - i0)
            tang = (crest[i0 + 1] - crest[i0]).normalized()
            out = V((-0.75, 0, 0.66)).normalized()
            pts = [root + out * (0.03 * q) + V((-0.012 * q * q, 0, -0.012 * q * q)) for q in range(5)]
            sides = [tang] * 5
            widths = [0.07, 0.068, 0.06, 0.05, 0.035]
            self.card(mc, pts, widths, sides, *ucol(k + 1), hm)
        self.mane_cards = mc.to_object(self.name + "_manecards")
        # ---- forelock: over the forehead between the ears
        fc = Builder()
        p0, d, up, L = self.head_frame()
        for k in range(7):
            xo = (k - 3) * 0.014
            pts, sides = [], []
            for q in range(6):
                s_ = q / 5
                tgt = self.head_point(0.0 + 0.24 * s_, xo * (1 + 0.6 * s_), 0.13 - 0.03 * s_)
                pn, nn = self.bvh.find_nearest(tgt)[:2]
                pts.append(pn + nn * (0.016 + 0.006 * (1 - s_)))
                sides.append(V((1, 0, 0)))
            widths = [0.045 * (1 - 0.4 * (q / 5)) for q in range(6)]
            self.card(fc, pts, widths, sides, *ucol(k), hm)
        self.forelock = fc.to_object(self.name + "_forelock")
        # ---- tail cards: fan around the core, flaring toward the bottom
        tc = Builder()
        cnt = 30
        for k in range(cnt):
            a = 2 * math.pi * k / cnt + rnd.uniform(-0.1, 0.1)
            ring = rnd.choice((0, 1))
            Lr = rnd.uniform(0.62, 0.80)
            pts, sides = [], []
            for q in range(9):
                s_ = q / 8
                z = 1.33 - Lr * s_
                yc = 0.86 + 0.16 * s_ ** 0.8 + 0.03 * math.sin(s_ * 3 + k)
                rr = (0.035 + 0.07 * s_ ** 0.7) * (1.0 + 0.25 * ring)
                pts.append(self.P(math.cos(a) * rr, yc + math.sin(a) * rr * 0.8, z))
                sides.append(V((-math.sin(a), math.cos(a) * 0.8, 0)).normalized())
            widths = [0.05 + 0.06 * (q / 8) ** 0.8 for q in range(9)]
            widths[-1] *= 0.8
            self.card(tc, pts, widths, sides, *ucol(k), hm)
        # crossing cards through the middle for a full silhouette from the side and behind
        for k in range(6):
            a = math.pi * k / 6
            pts, sides = [], []
            Lr = 0.74
            for q in range(9):
                s_ = q / 8
                pts.append(self.P(0, 0.86 + 0.16 * s_ ** 0.8, 1.30 - Lr * s_))
                sides.append(V((math.cos(a), math.sin(a), 0)))
            widths = [0.06 + 0.10 * (q / 8) ** 0.8 for q in range(9)]
            self.card(tc, pts, widths, sides, *ucol(k + 2), hm)
        self.tail_cards = tc.to_object(self.name + "_tailcards")

    # ------------------------------------------------------------ tack
    def build_saddle(self):
        P, M = self.P, self.M
        out = []
        # blanket
        b = Builder()
        y0, y1 = -0.47, 0.16
        (bv, bf), top = self.surface_patch(b, y0, y1, -1.32, 1.32, 8, 12, lambda u, v: 0.006, 0.014, M['blanket'])
        # gold trim along the lower edges
        for j in (0, 12):
            pts = [top[i][j] for i in range(9)]
            b.sweep(pts, 0.009, M['trim'], n=5)
        for i in (0, 8):
            pts = [top[i][j] for j in range(13)]
            b.sweep(pts, 0.008, M['trim'], n=5)
        out.append(('transfer', b.to_object("blanket")))
        # saddle seat (raised pommel and cantle)
        s = Builder()
        sy0, sy1 = -0.40, 0.10

        def off(u, v):
            vv = (v - 0.5) * 2
            pom = 0.075 * math.exp(-((u - 0.03) / 0.07) ** 2) * math.exp(-(vv / 0.35) ** 2)
            can = 0.10 * math.exp(-((u - 0.97) / 0.07) ** 2) * (1 - 0.6 * vv * vv)
            return 0.022 + pom + can + 0.012 * (1 - vv * vv)
        (sv, sf), stop = self.surface_patch(s, sy0, sy1, -0.95, 0.95, 12, 10, off, 0.03, M['saddle'])
        # piping on the seat edge
        s.sweep([stop[i][0] for i in range(13)], 0.007, M['leather'], n=5)
        s.sweep([stop[i][10] for i in range(13)], 0.007, M['leather'], n=5)
        s.sweep([stop[12][j] for j in range(11)], 0.008, M['leather'], n=5)
        # pommel horn cap
        ph = stop[1][5]
        s.lathe([(0, 0.022), (0.03, 0.018), (0.045, 0.028), (0.055, 0.0)], M['brass'], n=12, axis='Z', c=ph)
        # skirts / fenders
        for sx in (1, -1):
            a0, a1 = (0.85, 1.55) if sx > 0 else (-1.55, -0.85)
            self.surface_patch(s, -0.33, 0.02, a0, a1, 6, 6, lambda u, v: 0.024, 0.012, M['saddle'])
        seat_pt = stop[8][5]
        self.seat_pt = seat_pt
        out.append(('body', s.to_object("saddle")))
        # stirrups (rigid to the body)
        r = Builder()
        for sx in (1, -1):
            top_p, n = self.hit(P(sx * 0.6, -0.16, 1.40), P(0, -0.16, 1.40), 0.05)
            bot = P(sx * 0.33, -0.17, 0.98)
            r.seg_box(top_p, bot, 0.035, 0.006, M['leather'], r=0.002, up=(sx, 0, 0), uv=None)
            r.rbox(top_p.lerp(bot, 0.35), (0.012, 0.045, 0.03), M['iron'], r=0.004)   # buckle
            # iron: inverted U + tread
            c = bot + V((0, 0, -0.08))
            pts = []
            for q in range(11):
                a = math.pi * q / 10
                pts.append(c + V((sx * 0.0, math.cos(a) * 0.065, math.sin(a) * 0.08)))
            pts = [c + V((0, 0.065, -0.005))] + pts + [c + V((0, -0.065, -0.005))]
            r.sweep(pts, 0.008, M['iron'], n=6, up=(1, 0, 0))
            r.rbox(c + V((0, 0, -0.008)), (0.06, 0.14, 0.012), M['iron'], r=0.004)
        out.append(('body', r.to_object("stirrups")))
        # girth under the belly
        g = Builder()
        c = P(0, -0.30, 1.21)
        ang = [math.radians(a) for a in np.linspace(-62, -298, 26)]
        pts, nr = self.ring_hits(c, V((0, 0, 1)), V((1, 0, 0)), ang, 0.008, reach=0.8)
        self.ribbon(g, pts, nr, 0.075, 0.008, M['leather'])
        for sx in (1, -1):
            p, n = self.hit(P(sx * 0.6, -0.30, 1.08), P(0, -0.30, 1.08), 0.014)
            g.rbox(p, (0.012, 0.07, 0.05), M['iron'], r=0.004)
        # bedroll behind the cantle
        p, n = self.hit(P(0, 0.17, 2.0), P(0, 0.17, 1.2), 0.07)
        g.lathe([(-0.24, 0.0), (-0.245, 0.05), (-0.235, 0.068), (0.235, 0.068), (0.245, 0.05), (0.24, 0.0)],
                M['wool'], n=14, axis='X', c=p)
        for xx in (-0.15, 0.15):
            g.torus(p + V((xx, 0, 0)), 0.071, 0.006, M['leather'], nu=14, nv=5, axis='X')
        out.append(('transfer', g.to_object("girth")))
        return out

    def build_bridle(self, blinkers=False):
        M = self.M
        b = Builder()
        p0, d, up, L = self.head_frame()
        side = V((1, 0, 0))

        def head_ring(s, a0, a1, n, off=0.006, uoff=0.0):
            c = self.head_point(s, 0, uoff)
            ang = [math.radians(a) for a in np.linspace(a0, a1, n)]
            return self.ring_hits(c, side, up, ang, off, 0.5)
        # noseband (full ring)
        pts, nr = head_ring(0.70, 0, 360, 25)
        self.ribbon(b, pts[:-1], nr[:-1], 0.03, 0.006, M['leather'], closed=True)
        # browband
        pts, nr = head_ring(0.10, 18, 162, 11)
        self.ribbon(b, pts, nr, 0.022, 0.006, M['leather'])
        # crown + throatlatch behind the ears
        pts, nr = head_ring(0.02, -60, 240, 25)
        self.ribbon(b, pts, nr, 0.028, 0.006, M['leather'])
        # cheek pieces from crown to bit
        bits = []
        for sx in (1, -1):
            pts, nr = [], []
            for q in range(8):
                s_ = 0.03 + 0.80 * q / 7
                c = self.head_point(s_, 0, 0.0)
                u_ = 0.02 - 0.06 * q / 7
                tgt = c + up * u_
                p, n = self.hit(tgt + V((sx * 0.4, 0, 0)), tgt, 0.006)
                pts.append(p)
                nr.append(n)
            self.ribbon(b, pts, nr, 0.024, 0.006, M['leather'])
            bit = self.head_point(0.88, 0, -0.07)
            bp, bn = self.hit(bit + V((sx * 0.4, 0, 0)), bit, 0.01)
            bits.append(bp)
            b.torus(bp, 0.026, 0.0055, M['brass' if not blinkers else 'iron'], nu=16, nv=6, axis='X')
            # rosette at browband/crown junction
            rp, rn = self.hit(self.head_point(0.08, 0, 0.0) + V((sx * 0.4, 0, 0)), self.head_point(0.08, 0, 0.0),
                              0.012)
            b.lathe([(0, 0.018), (0.006, 0.014), (0.009, 0.0)], M['brass'], n=10, axis='X', c=rp,
                    M=Matrix.Scale(sx, 4, (1, 0, 0)) if False else None)
            if blinkers:
                ec = self.head_point(0.215, 0, 0.02)
                ep, en = self.hit(ec + V((sx * 0.4, 0, 0)), ec, 0.045)
                b.rbox(ep + d * (-0.01), (0.008, 0.11, 0.085), M['leather'], r=0.02,
                       M=Matrix.Translation(ep) @ Matrix.Rotation(sx * 0.25, 4, 'Z') @ Matrix.Rotation(
                           math.atan2(d.z, -d.y) * 0.5, 4, 'X') @ Matrix.Translation(-ep))
        # mouthpiece
        b.sweep([bits[0], bits[1]], 0.006, M['iron'], n=6)
        self.bits = bits
        return b.to_object("bridle")

    def build_reins(self, end_pts, sag=0.12, via=None):
        """end_pts: [(x,y,z) left, right]. via: optional intermediate points (terrets)."""
        b = Builder()
        params = []
        for k, sx in enumerate((1, -1)):
            a = self.bits[0] if sx > 0 else self.bits[1]
            e = V(end_pts[k])
            ctrl = [a]
            if via:
                ctrl.append(V(via[k]))
            ctrl.append(e)
            pts = []
            for i in range(len(ctrl) - 1):
                p, q = ctrl[i], ctrl[i + 1]
                for j in range(12):
                    t = j / 12
                    s = sag if i == 0 else sag * 1.5
                    pts.append(p.lerp(q, t) - V((0, 0, s * 4 * t * (1 - t))))
            pts.append(ctrl[-1])
            b.sweep(pts, 0.0065, self.M['leather'], n=6, up=(1, 0, 0))
        return b.to_object("reins")

    def build_harness(self, trace_end_y, trace_end_z, trace_x):
        P, M = self.P, self.M
        out = []
        # collar: padded roll around the neck base + hames
        b = Builder()
        nsec = catmull([(*c, w, h) for c, w, h in NECK], 4)
        i = 6
        c = P(0, nsec[i][0], nsec[i][1])
        c2 = P(0, nsec[i + 1][0], nsec[i + 1][1])
        t = (c2 - c).normalized()
        up = (V((0, 0, 1)) - t * t.z).normalized()
        sd = t.cross(up).normalized()
        ang = [2 * math.pi * k / 28 for k in range(28)]
        pts, nr = self.ring_hits(c, sd, up, ang, 0.03, 0.7)
        b.sweep(pts, 0.042, M['collar'], n=10, closed_path=True, cap=False, sub=0)
        # hames
        hp = [p + n * 0.05 + t * (-0.01) for p, n in zip(pts, nr)]
        hp_l = [hp[k] for k in range(len(hp)) if math.sin(ang[k]) > -0.55 and math.cos(ang[k]) > 0.05]
        hp_r = [hp[k] for k in range(len(hp)) if math.sin(ang[k]) > -0.55 and math.cos(ang[k]) < -0.05]
        for arc in (hp_l, hp_r):
            arc.sort(key=lambda p: p.z)
            b.sweep(arc, 0.013, M['brass'], n=8)
        top = max(pts, key=lambda p: p.z)
        b.lathe([(0, 0.016), (0.07, 0.012), (0.09, 0.02), (0.1, 0.0)], M['brass'], n=10, axis='Z', c=top + V((0, 0, 0.03)))
        self.hame_hooks = []
        for sx in (1, -1):
            hk = max([p for p in pts if p.x * sx > 0], key=lambda p: abs(p.x))
            hk = hk + V((sx * 0.04, 0, -0.05))
            b.rbox(hk, (0.03, 0.05, 0.05), M['brass'], r=0.008)
            self.hame_hooks.append(hk)
        out.append(('transfer', b.to_object("collar")))
        # back pad + belly band + terrets
        g = Builder()
        (gv, gf), top = self.surface_patch(g, -0.32, -0.04, -1.2, 1.2, 8, 12, lambda u, v: 0.006, 0.03, M['collar'])
        g.sweep([top[i][6] for i in range(9)], 0.01, M['brass'], n=6)
        c = P(0, -0.20, 1.21)
        ang = [math.radians(a) for a in np.linspace(-62, -298, 26)]
        pts, nr = self.ring_hits(c, V((0, 0, 1)), V((1, 0, 0)), ang, 0.01, reach=0.8)
        self.ribbon(g, pts, nr, 0.08, 0.008, M['leather'])
        self.terrets = []
        for sx in (1, -1):
            tp, tn = self.hit(P(sx * 0.12, -0.18, 2.0), P(sx * 0.12, -0.18, 1.2), 0.05)
            g.torus(tp + V((0, 0, 0.02)), 0.025, 0.006, M['brass'], nu=14, nv=6, axis='Y')
            self.terrets.append(tp + V((0, 0, 0.03)))
        out.append(('transfer', g.to_object("backpad")))
        # traces: from the hame hooks along the sides to the swingletree
        tr = Builder()
        for k, sx in enumerate((1, -1)):
            a = self.hame_hooks[k]
            pts = [a]
            for y in np.linspace(-0.45, 0.80, 8):
                z = trace_end_z + (a.z - trace_end_z) * (1 - (y + 0.45) / 1.6) ** 1.2
                tgt = P(0, y, z)
                p, n = self.hit(P(sx * 0.8, y, z), tgt, 0.018)
                pts.append(p)
            pts.append(P(sx * trace_x, trace_end_y, trace_end_z))
            tr.sweep(pts, 0.012, M['leather'], n=6, ellipse=(0.45, 1.6), up=(1, 0, 0), sub=2)
        out.append(('trace', tr.to_object("traces")))
        # breeching around the quarters, hip straps over the croup, crupper along the spine, buckles
        br = Builder()
        c = P(0, 0.42, 1.06)
        ang = [math.radians(a) for a in np.linspace(-12, 192, 30)]
        pts, nr = self.ring_hits(c, V((1, 0, 0)), V((0, 1, 0)), ang, 0.010, reach=0.9)
        self.ribbon(br, pts, nr, 0.075, 0.008, M['leather'])
        self.breech_ends = [pts[0], pts[-1]]
        for yy in (0.40, 0.62):
            cc = P(0, yy, 1.18)
            ang = [math.radians(a) for a in np.linspace(-22, 202, 24)]
            pts, nr = self.ring_hits(cc, V((1, 0, 0)), V((0, 0, 1)), ang, 0.012, reach=0.9)
            self.ribbon(br, pts, nr, 0.032, 0.006, M['leather'])
            for q in (2, len(pts) - 3):
                br.rbox(pts[q] + nr[q] * 0.006, (0.012, 0.03, 0.04), M['iron'], r=0.004,
                        M=None)
        sp = []
        snr = []
        for yy in np.linspace(-0.04, 0.80, 14):
            p_, n_ = self.hit(P(0, yy, 2.2), P(0, yy, 1.1), 0.012)
            sp.append(p_)
            snr.append(n_)
        self.ribbon(br, sp, snr, 0.03, 0.006, M['leather'])
        tp = self.P(0, 0.84, 1.36)
        br.torus(tp, 0.045, 0.012, M['leather'], nu=14, nv=6, axis='Y')
        for sx in (1, -1):
            e = self.breech_ends[0 if sx > 0 else 1]
            br.torus(e + V((0, -0.02, 0)), 0.028, 0.006, M['iron'], nu=12, nv=5, axis='X')
            # buckles on the traces and the belly band
            p_, n_ = self.hit(P(sx * 0.8, -0.05, 1.03), P(0, -0.05, 1.03), 0.02)
            br.rbox(p_, (0.014, 0.06, 0.05), M['iron'], r=0.004)
            p_, n_ = self.hit(P(sx * 0.8, -0.20, 1.02), P(0, -0.20, 1.02), 0.016)
            br.rbox(p_, (0.014, 0.05, 0.06), M['iron'], r=0.004)
        out.append(('transfer', br.to_object("breeching")))
        return out

    # ------------------------------------------------------------ weights
    def body_weights(self, coords):
        """coords: Nx3 numpy -> dict bone -> N weights (smooth, region based)."""
        N = len(coords)
        sds, chains = [], []
        for R in self.regions:
            D = coords[:, None, :] - R.C[None, :, :]          # N x K x 3
            dist = np.linalg.norm(D, axis=2)
            j = np.argmin(dist, axis=1)
            Dj = D[np.arange(N), j]
            x = np.einsum('ij,ij->i', Dj, R.S[j])
            y = np.einsum('ij,ij->i', Dj, R.U[j])
            a = np.einsum('ij,ij->i', Dj, R.T[j])
            rn = np.sqrt((x / R.hw[j]) ** 2 + (y / R.hh[j]) ** 2)
            sd = (rn - 1.0) * np.minimum(R.hw[j], R.hh[j])
            # param with sub-sample interpolation
            K = len(R.C)
            seglen = np.where(j < K - 1, R.cum[np.minimum(j + 1, K - 1)] - R.cum[j], R.cum[j] - R.cum[np.maximum(j - 1, 0)])
            Lp = np.linalg.norm(np.diff(R.C, axis=0), axis=1).sum()
            t = np.clip(R.cum[j] + a / Lp, 0, 1)
            # beyond the caps -> penalise
            over = np.maximum(0, np.abs(a) - 0.02) * ((j == 0) | (j == K - 1))
            sds.append(sd + over)
            chains.append(R.chain(t))
        S = np.array(sds)                    # R x N
        aff = np.exp(-(S - S.min(axis=0)) / 0.022)
        W = {}
        for r, ch in enumerate(chains):
            for bn, w in ch.items():
                W[bn] = W.get(bn, 0) + aff[r] * w
        tot = sum(W.values())
        return {k: v / tot for k, v in W.items()}

    def write_weights(self, ob, W):
        for bn in list(W.keys()):
            w = W[bn]
            if np.max(w) < 0.01:
                continue
            vg = ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn)
            for i in np.nonzero(w > 0.004)[0]:
                vg.add([int(i)], float(w[i]), 'REPLACE')

    def coords(self, ob):
        me = ob.data
        a = np.zeros(len(me.vertices) * 3)
        me.vertices.foreach_get('co', a)
        a = a.reshape(-1, 3)
        Mw = np.array(ob.matrix_world)
        return a @ Mw[:3, :3].T + Mw[:3, 3]

    def limit4(self, W):
        keys = list(W.keys())
        A = np.array([W[k] for k in keys])        # B x N
        if len(keys) > 4:
            idx = np.argsort(-A, axis=0)
            mask = np.zeros_like(A, dtype=bool)
            for r in range(4):
                mask[idx[r], np.arange(A.shape[1])] = True
            A = np.where(mask, A, 0)
        A = np.where(A < 0.01, 0, A)
        A /= A.sum(axis=0, keepdims=True)
        return {k: A[i] for i, k in enumerate(keys)}

    def skin(self, extra):
        """extra: list of (mode, object). mode in body/head/transfer/trace/tail/reins/chain."""
        bw = self.limit4(self.body_weights(self.coords(self.body)))
        bcoords = self.coords(self.body)
        self.write_weights(self.body, bw)
        kd = KDTree(len(bcoords))
        for i, c in enumerate(bcoords):
            kd.insert(c, i)
        kd.balance()
        P = self.P
        for mode, ob in extra:
            C = self.coords(ob)
            N = len(C)
            W = {}
            if mode in [b.name for b in self.arm.data.bones] and mode not in ('tail',):
                W[mode] = np.ones(N)
            elif mode == 'mane_cards':
                keys = list(bw.keys())
                for k in keys:
                    W[k] = np.zeros(N)
                for i, c in enumerate(C):
                    res = kd.find_n(c, 5)
                    ws = np.array([1.0 / (max(dd, 1e-4) ** 2) for _, _, dd in res])
                    ws /= ws.sum()
                    for (co, idx, dd), w in zip(res, ws):
                        for k in keys:
                            W[k][i] += w * bw[k][idx]
                cr = np.array([tuple(p) for p in self.crest])
                D = np.linalg.norm(C[:, None, :] - cr[None, :, :], axis=2)
                j = np.argmin(D, axis=1)
                dist = D[np.arange(N), j]
                tpar = j / (len(cr) - 1)
                f = sst(0.03, 0.20, dist) * 0.9
                for k in keys:
                    W[k] *= (1 - f)
                w1 = np.clip(1 - tpar * 2, 0, 1)
                w3 = np.clip(tpar * 2 - 1, 0, 1)
                w2 = 1 - w1 - w3
                for nm, w in (('mane_1', w1), ('mane_2', w2), ('mane_3', w3)):
                    W[nm] = W.get(nm, np.zeros(N)) + f * w
            elif mode in ('body', 'head', 'hooves'):
                if mode == 'hooves':
                    for k in LEGS:
                        W['leg_%s_low' % k] = np.zeros(N)
                    for i, c in enumerate(C):
                        k = ('f' if c[1] < self.dy else 'r') + ('l' if c[0] > 0 else 'r')
                        W['leg_%s_low' % k][i] = 1.0
                else:
                    W[mode] = np.ones(N)
            elif mode in ('transfer', 'trace'):
                keys = list(bw.keys())
                for k in keys:
                    W[k] = np.zeros(N)
                for i, c in enumerate(C):
                    res = kd.find_n(c, 5)
                    ws = np.array([1.0 / (max(dd, 1e-4) ** 2) for _, _, dd in res])
                    ws /= ws.sum()
                    for (co, idx, dd), w in zip(res, ws):
                        for k in keys:
                            W[k][i] += w * bw[k][idx]
                if mode == 'trace':      # rear ends are tied to the (static) root -> carriage
                    f = sst(0.62, 0.98, C[:, 1] - self.dy)
                    for k in keys:
                        W[k] *= (1 - f)
                    W['root'] = W.get('root', np.zeros(N)) + f
            elif mode == 'tail':
                b0, b1 = P(0, 0.72, 1.40), P(0, 0.98, 0.88)
                z = C[:, 2]
                f1 = sst(1.36, 1.22, z)
                f2 = sst(1.00, 0.80, z)
                f3 = sst(0.76, 0.56, z)
                W['body'] = 1 - f1
                W['tail'] = f1 * (1 - f2)
                W['tail_end'] = f1 * f2 * (1 - f3)
                W['tail_tip'] = f1 * f2 * f3
            elif mode.startswith('reins'):
                # weights by distance from the bit (head) -> neck -> body (-> root for carriage)
                bitc = (self.bits[0] + self.bits[1]) / 2
                dd = np.linalg.norm(C - np.array(bitc), axis=1)
                f1 = sst(0.05, 0.35, dd)
                f2 = sst(0.35, 0.75, dd)
                W['head'] = 1 - f1
                W['neck'] = f1 * (1 - f2)
                W['body'] = f1 * f2
                if mode == 'reins_root':
                    f3 = sst(-0.10 + self.dy, 0.45 + self.dy, C[:, 1])
                    for k in list(W.keys()):
                        W[k] = W[k] * (1 - f3)
                    W['root'] = f3
            W = self.limit4(W)
            self.write_weights(ob, W)

    # ------------------------------------------------------------ colour
    def paint(self, ob):
        me = ob.data
        attr = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
        C = self.coords(ob)
        base = np.array(srgb2lin("#7a4524"))
        dark = np.array(srgb2lin("#2a1b14"))
        points = np.array(srgb2lin("#1b1310"))
        belly = np.array(srgb2lin("#8c5634"))
        muzzle = np.array(srgb2lin("#3b2519"))
        white = np.array(srgb2lin("#e9e1d3"))
        z = C[:, 2]
        y = C[:, 1] - self.dy
        x = C[:, 0]
        rng = np.random.default_rng(5)
        col = np.tile(base, (len(C), 1))
        # dorsal darker, belly / flank lighter
        col = col * (1 - 0.18 * sst(1.35, 1.6, z)[:, None]) + (belly - col) * (0.45 * sst(1.1, 0.92, z) * (z > 0.8))[:, None]
        # dapple noise
        n = (np.sin(x * 37 + y * 23) * np.sin(y * 31 - z * 29) * np.sin(z * 19 + x * 13))
        col *= (1 + 0.06 * n)[:, None]
        # black points on the lower legs
        f = sst(0.70, 0.50, z)
        col = col * (1 - f[:, None]) + points * f[:, None]
        # head: darker muzzle + white blaze
        p0, d, up, L = self.head_frame()
        D = C - np.array(p0)
        s = D @ np.array(d) / L
        u = D @ np.array(up)
        inhead = (s > -0.05) & (y < -0.85)
        fm = sst(0.80, 0.97, s) * inhead
        col = col * (1 - 0.8 * fm[:, None]) + muzzle * (0.8 * fm[:, None])
        bw = 0.018 + 0.03 * np.exp(-((s - 0.18) / 0.08) ** 2) + 0.004 * s
        fb = sst(bw, bw * 0.6, np.abs(x)) * sst(0.0, 0.03, u) * sst(0.10, 0.16, s) * sst(0.86, 0.80, s) * inhead
        col = col * (1 - fb[:, None]) + white * fb[:, None]
        # ear tips + inside dark
        fe = sst(2.08, 2.18, z)
        col = col * (1 - fe[:, None]) + dark * fe[:, None]
        rgba = np.concatenate([np.clip(col, 0, 1), np.ones((len(C), 1))], axis=1)
        attr.data.foreach_set('color', rgba.ravel().astype(np.float32))

    # ------------------------------------------------------------ assemble
    def finish(self, extra_parts, atlas_size=1024):
        """Skin, bake the atlas, join everything into one skinned mesh named self.name."""
        from bake3 import bake_group
        solid = [self.body, self.face, self.ear_l, self.ear_r, self.mane, self.tail, self.hooves] + [o for _, o in extra_parts]
        hair = [self.mane_cards, self.forelock, self.tail_cards]
        for o in solid + hair:
            print("PARTTRIS", o.name, mesh_tris(o))
        modes = [('head', self.face), ('ear_l', self.ear_l), ('ear_r', self.ear_r), ('transfer', self.mane),
                 ('tail', self.tail), ('hooves', self.hooves), ('mane_cards', self.mane_cards),
                 ('head', self.forelock), ('tail', self.tail_cards)] + extra_parts
        self.skin(modes)
        bake_group(self.name, solid, atlas_size, handlers={'Horse_Coat': self.shade_coat}, ao_dist=0.45,
                   dirt_low=0.0, uv_weights={self.body: 1.25, self.face: 1.4, self.ear_l: 1.3, self.ear_r: 1.3},
                   ao_in_base=0.5)
        for o in hair:
            me = o.data
            me.uv_layers[0].name = 'atlas'
            while len(me.uv_layers) > 1:
                me.uv_layers.remove(me.uv_layers[1])
        ob = join(solid + hair, self.name)
        ob.parent = self.arm
        mod = ob.modifiers.new("Armature", 'ARMATURE')
        mod.object = self.arm
        self.mesh = ob
        return ob

    # ------------------------------------------------------------ coat texture (numpy, per texel)
    MUSCLES = [  # (polyline in (y, z) rig-local, radius, amplitude m)  -- side view features, mirrored in x
        ([(-0.58, 1.24), (-0.70, 1.40), (-0.82, 1.58), (-0.90, 1.74)], 0.022, -0.006),     # jugular groove
        ([(-0.56, 1.36), (-0.70, 1.53), (-0.82, 1.70), (-0.90, 1.84)], 0.05, 0.007),       # brachiocephalic
        ([(-0.30, 1.52), (-0.42, 1.38), (-0.55, 1.24), (-0.66, 1.14)], 0.022, 0.006),      # scapular spine
        ([(-0.50, 1.32)], 0.13, 0.010),                                                     # shoulder mass
        ([(-0.40, 1.04)], 0.085, 0.010),                                                    # triceps
        ([(-0.30, 1.12), (-0.36, 0.98)], 0.03, -0.005),                                     # behind triceps
        ([(-0.49, 0.86)], 0.055, 0.006),                                                    # forearm
        ([(0.28, 1.30)], 0.07, -0.007),                                                     # flank hollow
        ([(0.38, 1.46)], 0.05, 0.006),                                                      # point of hip
        ([(0.56, 1.36)], 0.15, 0.011),                                                      # hindquarter
        ([(0.74, 1.36), (0.70, 1.15), (0.63, 0.96)], 0.022, -0.006),                        # poverty line
        ([(0.36, 1.02)], 0.06, 0.007),                                                      # stifle
        ([(0.52, 0.82)], 0.06, 0.006),                                                      # gaskin
        ([(0.10, 1.00), (-0.25, 0.98)], 0.06, 0.004),                                       # belly muscle
    ]

    def shade_coat(self, c):
        from bake3 import fbm, voronoi, vnoise, lin, mixc
        C = c.P
        n = len(C)
        x, y, z = C[:, 0], C[:, 1] - self.dy, C[:, 2]
        base = lin("#7a4524"); dark = lin("#2a1b14"); points = lin("#16100d"); belly = lin("#9a6138")
        muzzle = lin("#33211a"); white = lin("#ece5d8"); dorsal = lin("#5a3019")
        col = np.tile(base, (n, 1)) * (0.92 + 0.16 * fbm(C, 1.5, 3, seed=201))[:, None]
        col = mixc(col, dorsal, 0.45 * sst(1.30, 1.62, z))
        col = mixc(col, belly, 0.55 * sst(1.12, 0.90, z) * (z > 0.75))
        col = mixc(col, belly * 1.1, 0.35 * sst(0.2, 0.0, np.abs(x)) * sst(1.2, 1.0, z) * (z > 0.8))
        # dapples on barrel & quarters
        F1, cid = voronoi(C * np.array([7.5, 6.5, 7.5]), seed=203)
        dap = sst(0.55, 0.25, F1) * sst(0.95, 1.15, z) * sst(-0.55, -0.35, y)
        col = col * (1 + 0.10 * (dap - 0.4) * (0.6 + 0.4 * cid))[:, None]
        # hair-direction streaks: along +Y on the body, along -Z on the legs
        legw = sst(1.0, 0.8, z)
        sb = fbm(C, 1.0, 3, seed=205, scale=(420, 30, 300))
        sl = fbm(C, 1.0, 3, seed=206, scale=(420, 420, 28))
        streak = sb * (1 - legw) + sl * legw
        col = col * (0.88 + 0.24 * streak)[:, None]
        # points (black lower legs), ragged edge
        edge = 0.62 + 0.05 * (fbm(C, 9, 2, seed=207) - 0.5)
        f = sst(edge + 0.08, edge - 0.12, z)
        col = mixc(col, points, f)
        # head: darker muzzle + white blaze
        p0, d, up, L = self.head_frame()
        D = C - np.array(p0)
        s = D @ np.array(d) / L
        u = D @ np.array(up)
        inhead = (s > -0.05) & (y < -0.85)
        fm = sst(0.78, 0.96, s) * inhead
        col = mixc(col, muzzle, 0.85 * fm)
        bwid = 0.018 + 0.03 * np.exp(-((s - 0.18) / 0.08) ** 2) + 0.004 * s + 0.004 * (fbm(C, 30, 2, seed=208) - 0.5)
        fb = sst(bwid, bwid * 0.7, np.abs(x)) * sst(0.0, 0.03, u) * sst(0.10, 0.15, s) * sst(0.88, 0.80, s) * inhead
        col = mixc(col, white, fb)
        fe = sst(2.08, 2.18, z)
        col = mixc(col, dark, fe)
        col = mixc(col, lin('#4a3a36'), 0.4 * sst(0.94, 1.0, s) * inhead)
        # ---- height: muscles + hair streaks + veins
        h = np.zeros(n)
        side = np.clip(np.abs(c.N[:, 0]) * 1.4, 0, 1)
        Q = np.stack([y, z], 1)
        for pts, r, amp in self.MUSCLES:
            pts = np.array(pts)
            if len(pts) == 1:
                dd = np.linalg.norm(Q - pts[0], axis=1)
            else:
                dd = np.full(n, 9.0)
                for i in range(len(pts) - 1):
                    a, b = pts[i], pts[i + 1]
                    ab = b - a
                    t = np.clip(((Q - a) @ ab) / (ab @ ab), 0, 1)
                    dd = np.minimum(dd, np.linalg.norm(Q - (a + t[:, None] * ab), axis=1))
            h += amp * np.exp(-(dd / r) ** 2)
        h *= 1.6 * side * (np.abs(x) > 0.05)
        ribs = 0.0011 * np.sin(2 * np.pi * (y + 0.3) / 0.085) * sst(-0.25, -0.10, y) * sst(0.25, 0.10, y) * \
            sst(1.06, 1.16, z) * sst(1.36, 1.26, z) * side
        h += ribs
        veins = np.abs(fbm(C, 1.0, 2, seed=209, scale=(25, 25, 25)) - 0.5)
        h += 0.0012 * sst(0.025, 0.0, veins) * (sst(1.0, 0.8, z) + inhead)
        h += 0.0016 * (streak - 0.5)
        rough = 0.64 + 0.12 * streak - 0.06 * sst(1.1, 1.5, z) + 0.1 * fe + 0.1 * fm
        return col, rough, np.zeros(n), h


# ---------------------------------------------------------------- animation (same lengths / fps as the old rig)
def _axis_local(arm, bn, world_axis):
    R = arm.data.bones[bn].matrix_local.to_3x3()
    return (R.inverted() @ Vector(world_axis)).normalized()


def build_actions(arm):
    arm.animation_data_create()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    specs = [('Idle', 48, pose_idle), ('Walk', 29, pose_walk), ('Gallop', 14, pose_gallop)]
    for name, n, fn in specs:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f in range(n + 1):
            t = (f % n) / n
            pose = fn(t)
            for pb in arm.pose.bones:
                v = pose.get(pb.name, (0.0, 0.0, 0.0))
                rx, rz, dz = v[:3]
                ry = v[3] if len(v) > 3 else 0.0
                q = Quaternion(_axis_local(arm, pb.name, (1, 0, 0)), rx)
                if ry:
                    q = Quaternion(_axis_local(arm, pb.name, (0, 1, 0)), ry) @ q
                if rz:
                    q = Quaternion(_axis_local(arm, pb.name, (0, 0, 1)), rz) @ q
                pb.rotation_quaternion = q
                R = arm.data.bones[pb.name].matrix_local.to_3x3()
                pb.location = R.inverted() @ Vector((0, 0, dz))
                pb.keyframe_insert('rotation_quaternion', frame=f)
                if pb.name == 'body':
                    pb.keyframe_insert('location', frame=f)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, act)
        strip.mute = False
        track.mute = True
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


TAU = 2 * math.pi


def _leg(p, duty, fwd, back, flex):
    """Stance: hoof planted, leg sweeps linearly from forward (-fwd) to back (+back).
    Swing: eased return with the lower leg folding (peak a little before mid-swing)."""
    p = p % 1.0
    if p < duty:
        s = p / duty
        return -fwd + (fwd + back) * s, 0.0
    s = (p - duty) / (1 - duty)
    e = 0.5 - 0.5 * math.cos(math.pi * s)
    ang = back - (fwd + back) * e - 0.06 * (fwd + back) * math.sin(math.pi * s) ** 2 * (s > 0.5)
    fl = flex * math.sin(math.pi * min(1.0, s * 1.18)) ** 1.4
    return ang, fl


def _legs(t, offs, duty, F, R):
    out = {}
    for k, off in offs.items():
        front = k[0] == 'f'
        fwd, back, flex = F if front else R
        ang, fl = _leg(t - off, duty, fwd, back, flex)
        if front:
            out['leg_%s_up' % k] = (ang, 0, 0)
            out['leg_%s_low' % k] = (fl, 0, 0)
        else:
            out['leg_%s_up' % k] = (ang - 0.35 * fl, 0, 0)
            out['leg_%s_low' % k] = (fl, 0, 0)
    return out


def _bump(t, c, w):
    """Smooth periodic pulse centred at c (0..1) with half-width w."""
    d = ((t - c + 0.5) % 1.0) - 0.5
    return math.exp(-(d / w) ** 2)


def _hair(p, ph, flap, trail, lagstep=0.6, base_flap=0.0):
    for i in range(3):
        p['mane_%d' % (i + 1)] = (0.0, -trail, 0.0, base_flap + flap * math.sin(ph - 0.9 - lagstep * i))


def pose_idle(t):
    ph = TAU * t
    look = 0.07 * math.sin(ph) + 0.03 * math.sin(2 * ph + 0.7)
    p = {
        'body': (0.0, 0.0, 0.004 * math.sin(2 * ph)),
        'neck': (0.06 + 0.035 * math.sin(ph), 0.5 * look, 0),
        'head': (0.03 * math.sin(ph + 1.0), 0.6 * look * 1.3, 0),
        'tail': (0.0, 0.20 * math.sin(2 * ph), 0),
        'tail_end': (0.04, 0.26 * math.sin(2 * ph - 0.8), 0),
        'tail_tip': (0.03, 0.30 * math.sin(2 * ph - 1.6), 0),
        'leg_rr_up': (-0.05, 0, 0), 'leg_rr_low': (0.18, 0, 0),
        'ear_l': (0.10 - 0.35 * _bump(t, 0.30, 0.04), 0.45 * _bump(t, 0.32, 0.06), 0),
        'ear_r': (0.10 + 0.15 * _bump(t, 0.72, 0.05), -0.55 * _bump(t, 0.70, 0.07), 0),
    }
    _hair(p, ph, 0.04, 0.0, 0.5)
    return p


def pose_walk(t):
    ph = TAU * t
    p = _legs(t, {'rl': 0.0, 'fl': 0.25, 'rr': 0.5, 'fr': 0.75}, 0.62, (0.30, 0.28, 0.75), (0.26, 0.26, 0.55))
    p['body'] = (0.012 * math.sin(2 * ph + 0.4), 0.012 * math.sin(ph), 0.014 * math.cos(2 * ph), 0.015 * math.sin(ph + 0.6))
    p['neck'] = (0.05 + 0.065 * math.sin(2 * ph + 0.9), 0.02 * math.sin(ph), 0)
    p['head'] = (0.035 * math.sin(2 * ph + 0.1), 0.02 * math.sin(ph - 0.5), 0)
    p['tail'] = (0.05, 0.09 * math.sin(ph), 0)
    p['tail_end'] = (0.03, 0.12 * math.sin(ph - 0.8), 0)
    p['tail_tip'] = (0.02, 0.15 * math.sin(ph - 1.6), 0)
    p['ear_l'] = (0.18 + 0.05 * math.sin(2 * ph), 0.05 * math.sin(ph), 0)
    p['ear_r'] = (0.18 + 0.05 * math.sin(2 * ph + 0.5), -0.05 * math.sin(ph), 0)
    _hair(p, 2 * ph, 0.07, 0.03)
    return p


def pose_gallop(t):
    ph = TAU * t
    p = _legs(t, {'rr': 0.0, 'rl': 0.12, 'fr': 0.38, 'fl': 0.50}, 0.33, (0.70, 0.55, 1.45), (0.55, 0.55, 0.95))
    p['body'] = (-0.075 * math.sin(ph), 0.0, 0.05 * math.cos(TAU * (t - 0.92)) + 0.02, 0.02 * math.sin(ph))
    p['neck'] = (-0.08 + 0.15 * math.sin(TAU * (t - 0.12)), 0, 0)
    p['head'] = (0.08 * math.sin(TAU * (t - 0.30)), 0, 0)
    p['tail'] = (0.50 + 0.12 * math.sin(TAU * (t - 0.30)), 0.04 * math.sin(ph), 0)
    p['tail_end'] = (0.30 + 0.16 * math.sin(TAU * (t - 0.45)), 0.05 * math.sin(ph - 1.0), 0)
    p['tail_tip'] = (0.20 + 0.20 * math.sin(TAU * (t - 0.60)), 0.06 * math.sin(ph - 2.0), 0)
    p['ear_l'] = (-0.10 + 0.06 * math.sin(ph), 0, 0)
    p['ear_r'] = (-0.10 + 0.06 * math.sin(ph + 0.4), 0, 0)
    _hair(p, ph, 0.22, 0.18, 0.5, base_flap=0.22)
    return p
