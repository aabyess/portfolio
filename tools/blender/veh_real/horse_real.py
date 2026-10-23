"""Realistic rigged horse: anatomical lofts -> voxel union -> smooth -> decimate,
smooth region-based skin weights, mane/tail strands, saddle or draft harness.
Bone names identical to the old rig (+ tail_end). Actions Idle/Walk/Gallop."""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from common2 import (Builder, mat, empty, catmull, frames_along, frames_up, apply_mods, join, mesh_tris,
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
    )


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
        for k, (x, h, kn, ft) in LEGS.items():
            bone('leg_%s_up' % k, P(x, *h), P(x, *kn), 'body')
            bone('leg_%s_low' % k, P(x, *kn), P(x, *ft), 'leg_%s_up' % k)
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
            # ear: cupped leaf shape
            base = self.head_point(0.045, sx * 0.055, 0.075)
            tip_dir = (V((sx * 0.22, 0, 0)) + up * 0.55 + V((0, 0, 0.8)) - d * 0.1).normalized()
            pts = [base + tip_dir * (0.135 * t) for t in (0.0, 0.25, 0.5, 0.75, 0.93, 1.0)]
            wid = [0.036, 0.040, 0.034, 0.022, 0.010, 0.002]
            fwd = (d + up * 0.3).normalized()
            fr = frames_up(pts, lambda i, p: V((sx, 0, 0)))
            ring = []
            for j in range(12):
                th = 2 * math.pi * j / 12
                c_, s_ = math.cos(th), math.sin(th)
                ring.append((c_, s_))

            def prof(i, wid=wid):
                w = wid[i]
                return [(xx * w * 1.0, yy * w * 0.42 - 0.35 * w * (xx * xx)) for xx, yy in ring]
            f.loft(pts, fr, prof, M['coat'])
        face = f.to_object(self.name + "_face")
        self.face = face

        # mane: crest ridge + hanging locks (fall to the horse's right, -X)
        h = Builder()
        sec = catmull([(*c, w, hh) for c, w, hh in NECK], 3)
        crest = []
        for s in sec[2:]:
            c = self.P(0, s[0], s[1])
            p, n = self.hit(c + V((0, -0.25, 1)).normalized() * 0.6, c, 0.0)
            crest.append(p)
        crest = crest[:-1]
        nC = len(crest)
        h.sweep([c + V((0, 0, 0.006)) for c in crest], [0.044] * nC, M['mane'], n=10, ellipse=(0.85, 1.0),
                up=(1, 0, 0))
        rnd = random.Random(7)
        nl = 22
        nsec = catmull([(*c, w, hh) for c, w, hh in NECK], 6)
        nsec = nsec[3:-2]
        for i in range(nl):
            t = i / (nl - 1)
            k = t * (len(nsec) - 1)
            i0 = int(k)
            q0, q1 = nsec[min(i0, len(nsec) - 1)], nsec[min(i0 + 1, len(nsec) - 1)]
            f_ = k - i0
            c = self.P(0, q0[0] * (1 - f_) + q1[0] * f_, q0[1] * (1 - f_) + q1[1] * f_)
            c2 = self.P(0, q1[0], q1[1]) if i0 + 1 < len(nsec) else c + V((0, -0.01, 0.01))
            tdir = (c2 - c).normalized() if (c2 - c).length > 1e-5 else V((0, -0.5, 0.8)).normalized()
            upv = (V((0, -0.25, 1)) - tdir * tdir.dot(V((0, -0.25, 1)))).normalized()
            sdv = V((-1, 0, 0))
            ln = 0.5 + 0.5 * math.sin(math.pi * min(1, 0.15 + t * 1.1))
            ln = 0.75 + 0.35 * ln + rnd.uniform(-0.12, 0.12)
            angs = [math.radians(a_) for a_ in np.linspace(90, 90 - 62 * ln, 6)]
            if rnd.random() < 0.08:
                angs = [math.pi - a_ for a_ in angs]
            pts, nr = self.ring_hits(c + tdir * rnd.uniform(-0.01, 0.01), -sdv, upv, angs, 0.0, 0.6)
            pts = [p + n * (0.016 - 0.006 * j / 5) - tdir * (0.03 * (j / 5) ** 1.5) for j, (p, n) in enumerate(zip(pts, nr))]
            rad = [0.022, 0.032, 0.030, 0.024, 0.015, 0.004]
            h.sweep(pts, rad, M['mane'], n=5, sub=0, ellipse=(1.8, 0.45), up=(1, 0, 0))
        # forelock
        for sx in (-0.025, 0.0, 0.025):
            c = self.head_point(0.02, sx, 0.10)
            pts = []
            for q in range(5):
                s_ = q / 4
                tgt = self.head_point(0.02 + 0.22 * s_, sx * (1 + s_), 0.10)
                pn, nn = self.bvh.find_nearest(tgt)[:2]
                pts.append(pn + nn * (0.012 + 0.004 * (1 - s_)))
            h.sweep(pts, [0.024, 0.022, 0.018, 0.012, 0.004], M['mane'], n=7, sub=2, ellipse=(1.4, 0.6))
        mane = h.to_object(self.name + "_mane")
        self.mane = mane

        # tail: full hair bundle + strands
        t = Builder()
        bund = [self.P(0, 0.84, 1.37), self.P(0, 0.90, 1.26), self.P(0, 0.95, 1.10), self.P(0, 0.985, 0.90),
                self.P(0, 1.00, 0.72), self.P(0, 1.005, 0.60)]
        t.sweep(bund, [0.045, 0.055, 0.075, 0.08, 0.07, 0.035], M['mane'], n=12, sub=2, ellipse=(0.9, 1.0))
        for i in range(7):
            a = 2 * math.pi * i / 7 + 0.3
            ox, oy = math.cos(a), math.sin(a)
            ln = rnd.uniform(-0.06, 0.06)
            pts = []
            for q in range(5):
                s_ = q / 4
                r_ = 0.03 + 0.05 * math.sin(math.pi * min(1, s_ * 1.3))
                pts.append(self.P(ox * r_ + 0.01 * math.sin(s_ * 4 + i),
                                  0.90 + oy * r_ * 0.8 + 0.10 * s_,
                                  1.25 - (0.70 + ln) * s_))
            t.sweep(pts, [0.03, 0.034, 0.03, 0.02, 0.005], M['mane'], n=6, sub=2, ellipse=(1.0, 0.75))
        tail = t.to_object(self.name + "_tail")
        self.tail = tail

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
            if mode in ('body', 'head', 'hooves'):
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
                f2 = sst(0.95, 0.75, z)
                W['body'] = 1 - f1
                W['tail'] = f1 * (1 - f2)
                W['tail_end'] = f1 * f2
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
    def finish(self, extra_parts):
        """Join everything into one skinned mesh named self.name."""
        parts = [self.body, self.face, self.mane, self.tail, self.hooves] + [o for _, o in extra_parts]
        for o in parts:
            print("PARTTRIS", o.name, mesh_tris(o))
        modes = [('head', self.face), ('transfer', self.mane), ('tail', self.tail), ('hooves', self.hooves)] + extra_parts
        # body region weights for the face part: ears / eyes are on the head
        self.skin(modes)
        ob = join(parts, self.name)
        self.paint(ob)
        ob.parent = self.arm
        mod = ob.modifiers.new("Armature", 'ARMATURE')
        mod.object = self.arm
        self.mesh = ob
        return ob


# ---------------------------------------------------------------- animation (same timing as the old rig)
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
                rx, rz, dz = pose.get(pb.name, (0.0, 0.0, 0.0))
                q = Quaternion(_axis_local(arm, pb.name, (1, 0, 0)), rx) @ Quaternion((1, 0, 0, 0))
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


def _legs(t, offs, A_f, A_h, B_f, B_h, bias=0.0):
    out = {}
    for k, off in offs.items():
        ph = TAU * (t + off)
        front = k[0] == 'f'
        A, B = (A_f, B_f) if front else (A_h, B_h)
        up = -A * math.sin(ph) + bias
        flex = B * max(0.0, math.cos(ph)) ** 1.5
        if front:
            out['leg_%s_up' % k] = (up, 0, 0)
            out['leg_%s_low' % k] = (flex, 0, 0)
        else:
            out['leg_%s_up' % k] = (up - flex * 0.35, 0, 0)
            out['leg_%s_low' % k] = (flex, 0, 0)
    return out


def pose_idle(t):
    ph = TAU * t
    return {
        'body': (0, 0, 0.006 * math.sin(ph)),
        'neck': (0.05 + 0.05 * math.sin(ph), 0, 0),
        'head': (0.04 * math.sin(ph + 1.0), 0.05 * math.sin(ph), 0),
        'tail': (0.0, 0.22 * math.sin(2 * ph), 0),
        'tail_end': (0.05, 0.25 * math.sin(2 * ph - 1.0), 0),
        'leg_rr_up': (-0.05, 0, 0), 'leg_rr_low': (0.18, 0, 0),
    }


def pose_walk(t):
    ph = TAU * t
    p = _legs(t, {'rl': 0.0, 'fl': 0.25, 'rr': 0.5, 'fr': 0.75}, 0.30, 0.26, 0.55, 0.40)
    p['body'] = (0.015 * math.sin(2 * ph), 0, 0.015 * math.cos(2 * ph))
    p['neck'] = (0.07 * math.sin(2 * ph + 0.6), 0, 0)
    p['head'] = (0.04 * math.sin(2 * ph), 0, 0)
    p['tail'] = (0.05, 0.10 * math.sin(ph), 0)
    p['tail_end'] = (0.03, 0.12 * math.sin(ph - 0.9), 0)
    return p


def pose_gallop(t):
    ph = TAU * t
    p = _legs(t, {'rr': 0.0, 'rl': 0.10, 'fr': 0.42, 'fl': 0.52}, 0.62, 0.55, 1.05, 0.75)
    p['body'] = (0.09 * math.sin(ph + 0.9), 0, 0.06 * math.sin(ph + 2.4) + 0.02)
    p['neck'] = (-0.10 + 0.16 * math.sin(ph - 0.8), 0, 0)
    p['head'] = (0.08 * math.sin(ph), 0, 0)
    p['tail'] = (0.55 + 0.12 * math.sin(ph), 0.05 * math.sin(ph), 0)
    p['tail_end'] = (0.35 + 0.15 * math.sin(ph - 1.0), 0.04 * math.sin(ph - 1.0), 0)
    return p
