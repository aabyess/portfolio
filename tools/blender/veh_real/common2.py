"""Shared helpers for the 'realistic' vehicle pass (headless Blender 5.x).
Convention: front = -Y, up = +Z, origin on ground at vehicle centre. Real metres."""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
OUT_DIR = os.path.join(REPO, "models", "vehicles")
SRC_DIR = os.path.join(REPO, "models", "src")
FPS = 24
V = Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0
    _MATS.clear()


def srgb2lin(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


# ---------------------------------------------------------------- textures
def make_image(name, arr):
    """arr: HxWx3 float 0..1 (sRGB). Packed into the .blend, exported as JPEG."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    img.file_format = 'JPEG'
    return img


def _noise1d(n, octaves, rng):
    out = np.zeros(n)
    for o in range(octaves):
        k = 2 ** (o + 2)
        pts = rng.random(k + 1)
        xs = np.linspace(0, k, n, endpoint=False)
        i = xs.astype(int)
        f = xs - i
        f = f * f * (3 - 2 * f)
        out += (pts[i] * (1 - f) + pts[(i + 1) % (k + 1)] * f) / (2 ** o)
    return out / out.max()


def wood_texture(size=256, seed=3):
    """Light, near-white wood grain; tinted per material via baseColorFactor."""
    rng = np.random.default_rng(seed)
    v = np.linspace(0, 1, size, endpoint=False)
    u = np.linspace(0, 1, size, endpoint=False)
    U, Vv = np.meshgrid(u, v)          # grain runs along U (columns = along the board)
    warp = 0.02 * np.sin(2 * np.pi * (U * 2 + _noise1d(size, 3, rng)[None, :] * 0.4)) + \
        0.01 * np.sin(2 * np.pi * U * 5 + 1.3)
    rings = Vv * 26 + warp * 4 + _noise1d(size, 4, rng)[:, None] * 3.0
    g = 0.5 + 0.5 * np.sin(2 * np.pi * rings)
    g = g ** 4
    fine = rng.random((size, 1)) * 0.25 + rng.random((size, size)) * 0.05
    lum = 0.90 - 0.16 * g - fine * 0.45
    lum = np.clip(lum, 0.45, 1.0)
    col = np.stack([lum, lum * 0.93, lum * 0.86], -1)
    return col


def wicker_texture(size=256):
    u = np.linspace(0, 1, size, endpoint=False)
    U, Vv = np.meshgrid(u, u)
    n = 16
    cu = (U * n) % 1.0
    cv = (Vv * n * 0.5) % 1.0
    row = np.floor(Vv * n * 0.5).astype(int)
    col = np.floor(U * n).astype(int)
    over = ((row + col) % 2 == 0)
    strand_h = np.sin(np.pi * cv) ** 0.6           # horizontal weavers
    strand_v = np.sin(np.pi * cu) ** 0.6
    lum = np.where(over, 0.55 + 0.45 * strand_h, 0.35 + 0.45 * strand_v * strand_h)
    lum = lum * (0.85 + 0.15 * np.sin(U * 90))
    return np.stack([lum, lum * 0.86, lum * 0.66], -1)


# ---------------------------------------------------------------- materials
_MATS = {}


def mat(name, hexcol, rough=0.8, metal=0.0, tex=None, vcol=False, emit=None, emit_strength=1.0):
    if name in _MATS:
        return _MATS[name]
    lin = srgb2lin(hexcol)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if tex is not None:
        ti = nt.nodes.new('ShaderNodeTexImage')
        ti.image = tex
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(ti.outputs['Color'], mix.inputs[6])
        mix.inputs[7].default_value = (*lin, 1.0)
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    elif vcol:
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = "Col"
        nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (*srgb2lin(emit), 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    m.diffuse_color = (*lin, 1.0)
    _MATS[name] = m
    return m


# ---------------------------------------------------------------- math helpers
def catmull(points, sub=4, closed=False):
    """Catmull-Rom through points (list of tuples/Vectors or scalars-in-tuples)."""
    P = [np.array(p, dtype=float) for p in points]
    n = len(P)
    out = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else 2 * P[0] - P[1]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else 2 * P[-1] - P[-2]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out


def frames_along(pts, up_hint=(0, 0, 1), closed=False):
    """Parallel-transport frames. Returns list of (tangent, side, up)."""
    pts = [V(p) for p in pts]
    n = len(pts)
    T = []
    for i in range(n):
        if closed:
            d = pts[(i + 1) % n] - pts[(i - 1) % n]
        elif i == 0:
            d = pts[1] - pts[0]
        elif i == n - 1:
            d = pts[-1] - pts[-2]
        else:
            d = pts[i + 1] - pts[i - 1]
        T.append(d.normalized())
    up = V(up_hint)
    u = (up - T[0] * T[0].dot(up))
    if u.length < 1e-4:
        u = V((1, 0, 0)) - T[0] * T[0].x
    u.normalize()
    out = []
    for i in range(n):
        if i > 0:
            q = T[i - 1].rotation_difference(T[i])
            u = q @ u
            u = (u - T[i] * T[i].dot(u)).normalized()
        s = T[i].cross(u).normalized()   # side
        out.append((T[i], s, u))
    return out


def frames_up(pts, up_fn):
    """Frames with explicit up vector per point (callable(i, p) or constant)."""
    pts = [V(p) for p in pts]
    n = len(pts)
    out = []
    for i in range(n):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        u = V(up_fn(i, pts[i]) if callable(up_fn) else up_fn)
        u = (u - d * d.dot(u)).normalized()
        s = d.cross(u).normalized()
        out.append((d, s, u))
    return out


# ---------------------------------------------------------------- builder
class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []
        self.uvl = self.bm.loops.layers.uv.verify()

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, m, M=None, uv=None, flat=False):
        mi = self._mi(m)
        if M is not None:
            verts = [M @ V(v) for v in verts]
        bv = [self.bm.verts.new(V(v)) for v in verts]
        new = []
        for f in faces:
            try:
                face = self.bm.faces.new([bv[i] for i in f])
            except ValueError:
                continue
            face.material_index = mi
            face.smooth = not flat
            new.append(face)
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        self._uv(new, uv)
        return bv, new

    def _uv(self, faces, uv):
        """uv=None -> simple box projection; uv=('grain', axis, su, sv)."""
        g = None
        su, sv = 1.0, 1.0
        if uv is not None and uv[0] == 'box':
            su = uv[1]
            uv = None
        if uv is not None:
            g = V(uv[1]).normalized()
            su, sv = (uv[2], uv[3]) if len(uv) > 2 else (1.0, 3.0)
        for f in faces:
            n = f.normal
            if g is None:
                a = max(range(3), key=lambda k: abs(n[k]))
                ax = [k for k in range(3) if k != a]
                for l in f.loops:
                    l[self.uvl].uv = (l.vert.co[ax[0]] * su, l.vert.co[ax[1]] * su)
                continue
            w = n.cross(g)
            if w.length < 0.3:      # end grain
                w = n.cross(V((0, 0, 1)) if abs(n.z) < 0.9 else V((1, 0, 0)))
                gg = w.cross(n).normalized()
            else:
                gg = g
            w.normalize()
            for l in f.loops:
                c = l.vert.co
                l[self.uvl].uv = (c.dot(gg) * su, c.dot(w) * sv)

    # ---- primitives -------------------------------------------------
    def loft(self, centers, frames, profile, m, cap0=True, cap1=True, closed_path=False, uv=None, M=None,
             flat=False):
        """centers: list of points; frames: list of (t, side, up); profile(i) -> list of (x, y) ring."""
        rings = []
        for i, c in enumerate(centers):
            t, s, u = frames[i]
            ring = [V(c) + s * x + u * y for x, y in profile(i)]
            rings.append(ring)
        k = len(rings[0])
        verts = [p for r in rings for p in r]
        faces = []
        nr = len(rings)
        last = nr if closed_path else nr - 1
        for i in range(last):
            a, b = i * k, ((i + 1) % nr) * k
            for j in range(k):
                j2 = (j + 1) % k
                faces.append((a + j, a + j2, b + j2, b + j))
        if not closed_path:
            if cap0:
                verts.append(sum(rings[0], V()) / k)
                ci = len(verts) - 1
                faces += [(ci, (j + 1) % k, j) for j in range(k)]
            if cap1:
                verts.append(sum(rings[-1], V()) / k)
                ci = len(verts) - 1
                o = (nr - 1) * k
                faces += [(ci, o + j, o + (j + 1) % k) for j in range(k)]
        return self.add(verts, faces, m, M=M, uv=uv, flat=flat)

    def sweep(self, pts, radius, m, n=10, sub=0, closed_path=False, cap=True, up=(0, 0, 1), uv=None,
              rscale=None, M=None, ellipse=(1.0, 1.0), flat=False):
        """Round (or elliptical) tube along pts. radius: float or list (per input point)."""
        rad = radius if isinstance(radius, (list, tuple)) else [radius] * len(pts)
        if sub:
            pp = catmull([(*p, r) for p, r in zip(pts, rad)], sub, closed_path)
            if closed_path:
                pass
            pts = [V(q[:3]) for q in pp]
            rad = [q[3] for q in pp]
        pts = [V(p) for p in pts]
        fr = frames_along(pts, up, closed_path)
        ex, ey = ellipse
        ring = [(math.cos(2 * math.pi * j / n), math.sin(2 * math.pi * j / n)) for j in range(n)]
        return self.loft(pts, fr, lambda i: [(x * rad[i] * ex, y * rad[i] * ey) for x, y in ring], m,
                         cap0=cap, cap1=cap, closed_path=closed_path, uv=uv, M=M, flat=flat)

    def lathe(self, profile, m, n=16, axis='X', c=(0, 0, 0), uv=None, M=None, cap0=True, cap1=True, flat=False,
              ellipse=(1.0, 1.0), phase=0.0):
        """profile: list of (along, r). Revolves around axis through c."""
        c = V(c)
        ax = {'X': V((1, 0, 0)), 'Y': V((0, 1, 0)), 'Z': V((0, 0, 1))}[axis]
        s = {'X': V((0, 1, 0)), 'Y': V((1, 0, 0)), 'Z': V((1, 0, 0))}[axis]
        u = ax.cross(s)
        verts, faces = [], []
        k = n
        for a, r in profile:
            for j in range(k):
                th = phase + 2 * math.pi * j / k
                verts.append(c + ax * a + s * (math.cos(th) * r * ellipse[0]) + u * (math.sin(th) * r * ellipse[1]))
        nr = len(profile)
        for i in range(nr - 1):
            for j in range(k):
                j2 = (j + 1) % k
                faces.append((i * k + j, i * k + j2, (i + 1) * k + j2, (i + 1) * k + j))
        if cap0 and profile[0][1] > 1e-5:
            verts.append(c + ax * profile[0][0]); ci = len(verts) - 1
            faces += [(ci, (j + 1) % k, j) for j in range(k)]
        if cap1 and profile[-1][1] > 1e-5:
            verts.append(c + ax * profile[-1][0]); ci = len(verts) - 1
            o = (nr - 1) * k
            faces += [(ci, o + j, o + (j + 1) % k) for j in range(k)]
        return self.add(verts, faces, m, M=M, uv=uv, flat=flat)

    def torus(self, c, R, r, m, nu=24, nv=8, axis='X', M=None, ellipse=(1.0, 1.0)):
        c = V(c)
        ax = {'X': V((1, 0, 0)), 'Y': V((0, 1, 0)), 'Z': V((0, 0, 1))}[axis]
        s = {'X': V((0, 1, 0)), 'Y': V((1, 0, 0)), 'Z': V((1, 0, 0))}[axis]
        u = ax.cross(s)
        verts, faces = [], []
        for i in range(nu):
            a = 2 * math.pi * i / nu
            radial = s * math.cos(a) + u * math.sin(a)
            for j in range(nv):
                b = 2 * math.pi * j / nv
                verts.append(c + radial * (R + math.cos(b) * r * ellipse[0]) + ax * (math.sin(b) * r * ellipse[1]))
        for i in range(nu):
            i2 = (i + 1) % nu
            for j in range(nv):
                j2 = (j + 1) % nv
                faces.append((i * nv + j, i2 * nv + j, i2 * nv + j2, i * nv + j2))
        return self.add(verts, faces, m, M=M)

    def ellipsoid(self, c, r, m, nu=12, nv=8, M=None, flat=False):
        c = V(c)
        verts, faces = [], []
        verts.append(c + V((0, 0, -r[2])))
        for j in range(1, nv):
            b = -math.pi / 2 + math.pi * j / nv
            for i in range(nu):
                a = 2 * math.pi * i / nu
                verts.append(c + V((math.cos(a) * math.cos(b) * r[0], math.sin(a) * math.cos(b) * r[1], math.sin(b) * r[2])))
        verts.append(c + V((0, 0, r[2])))
        top = len(verts) - 1
        for i in range(nu):
            i2 = (i + 1) % nu
            faces.append((0, 1 + i2, 1 + i))
        for j in range(nv - 2):
            o, q = 1 + j * nu, 1 + (j + 1) * nu
            for i in range(nu):
                i2 = (i + 1) % nu
                faces.append((o + i, o + i2, q + i2, q + i))
        o = 1 + (nv - 2) * nu
        for i in range(nu):
            i2 = (i + 1) % nu
            faces.append((o + i, o + i2, top))
        return self.add(verts, faces, m, M=M, flat=flat)

    def rbox(self, c, size, m, r=0.01, seg=2, M=None, uv=None):
        """Bevelled box centred at c (before M)."""
        tb = bmesh.new()
        bmesh.ops.create_cube(tb, size=1.0)
        for v in tb.verts:
            v.co = V((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        r = min(r, min(size) * 0.49)
        if r > 0:
            bmesh.ops.bevel(tb, geom=list(tb.edges) + list(tb.verts), offset=r, segments=seg,
                            affect='EDGES', profile=0.5)
        verts = [V(v.co) + V(c) for v in tb.verts]
        idx = {v: i for i, v in enumerate(tb.verts)}
        faces = [[idx[v] for v in f.verts] for f in tb.faces]
        tb.free()
        return self.add(verts, faces, m, M=M, uv=uv)

    def seg_box(self, p0, p1, w, h, m, r=0.01, up=(0, 0, 1), uv='auto', seg=2):
        """Bevelled beam from p0 to p1 with cross-section w (side) x h (up)."""
        p0, p1 = V(p0), V(p1)
        d = p1 - p0
        L = d.length
        t = d.normalized()
        u = V(up) - t * t.dot(V(up))
        if u.length < 1e-4:
            u = V((1, 0, 0)) - t * t.x
        u.normalize()
        s = t.cross(u)
        M = Matrix((s, t, u)).transposed().to_4x4()
        M.translation = (p0 + p1) / 2
        uvs = ('grain', t, 1.0, 3.0) if uv == 'auto' else uv
        return self.rbox((0, 0, 0), (w, L, h), m, r=r, M=M, uv=uvs, seg=seg)

    def to_object(self, name, origin=(0, 0, 0), parent=None, sharp=40.0, collection=None):
        o = V(origin)
        for v in self.bm.verts:
            v.co -= o
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-6)
        self.bm.normal_update()
        lim = math.radians(sharp)
        for e in self.bm.edges:
            if len(e.link_faces) == 2:
                a = e.link_faces[0].normal.angle(e.link_faces[1].normal, 0)
                e.smooth = a < lim
                if not (e.link_faces[0].smooth and e.link_faces[1].smooth):
                    e.smooth = False
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        if parent is not None:
            ob.parent = parent
            bpy.context.view_layer.update()
            ob.matrix_world = Matrix.Translation(o)
        else:
            ob.location = o
        return ob


def mesh_tris(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    return ob


def join(objs, name):
    """Join objects into the first (keeps vertex groups / materials)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = objs[0]
    ob.name = name
    ob.data.name = name
    return ob


def empty(name, loc, parent=None, parent_bone=None, size=0.15):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = size
    bpy.context.scene.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
        if parent_bone:
            e.parent_type = 'BONE'
            e.parent_bone = parent_bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(V(loc))
    bpy.context.view_layer.update()
    return e


# ---------------------------------------------------------------- wheels
def wagon_wheel(b, r, width, wood, iron, spokes=12, n=32):
    """Wooden spoked wagon wheel centred at origin, axle = X. Outer radius exactly r."""
    tyre_t = 0.022
    # iron tyre (slightly crowned)
    b.lathe([(-width / 2 - 0.004, r - tyre_t), (-width / 2 - 0.004, r - 0.004), (-width / 2 + 0.006, r),
             (width / 2 - 0.006, r), (width / 2 + 0.004, r - 0.004), (width / 2 + 0.004, r - tyre_t)],
            iron, n=n, axis='X', cap0=False, cap1=False)
    b.lathe([(width / 2 + 0.004, r - tyre_t), (-width / 2 - 0.004, r - tyre_t)], iron, n=n, axis='X',
            cap0=False, cap1=False)
    # felloe (wood rim) with rounded inner edge
    fr0, fr1 = r - tyre_t, r - tyre_t - 0.075
    b.lathe([(-width / 2, fr0), (-width / 2, fr1 + 0.012), (-width / 2 + 0.01, fr1), (width / 2 - 0.01, fr1),
             (width / 2, fr1 + 0.012), (width / 2, fr0)], wood, n=n, axis='X', cap0=False, cap1=False,
            uv=('grain', (0, 0, 1), 1.0, 3.0))
    # nave / hub: barrel shape with iron bands
    hr = max(0.075, r * 0.17)
    hl = width * 3.2
    prof = [(-hl / 2, hr * 0.55), (-hl / 2 + 0.012, hr * 0.78), (-hl * 0.25, hr * 0.95), (0, hr),
            (hl * 0.25, hr * 0.95), (hl / 2 - 0.012, hr * 0.78), (hl / 2, hr * 0.55)]
    b.lathe(prof, wood, n=16, axis='X', uv=('grain', (1, 0, 0), 1.0, 3.0))
    for a in (-hl / 2 + 0.02, hl / 2 - 0.02):
        rr = hr * (0.84 if abs(a) > hl * 0.3 else 1.0) + 0.006
        b.lathe([(a - 0.012, rr), (a - 0.008, rr + 0.004), (a + 0.008, rr + 0.004), (a + 0.012, rr)], iron, n=16,
                axis='X')
    b.lathe([(-hl / 2 - 0.035, hr * 0.32), (-hl / 2 - 0.02, hr * 0.42), (-hl / 2, hr * 0.42)], iron, n=12, axis='X')
    b.lathe([(hl / 2, hr * 0.42), (hl / 2 + 0.02, hr * 0.42), (hl / 2 + 0.035, hr * 0.32)], iron, n=12, axis='X')
    # spokes: tapered oval section, slightly dished (staggered)
    for i in range(spokes):
        a = 2 * math.pi * i / spokes + math.pi / spokes
        d = V((0, math.cos(a), math.sin(a)))
        dish = 0.012 * (1 if i % 2 else -1)
        p0 = d * (hr * 0.92) + V((dish, 0, 0))
        p1 = d * (fr1 + 0.01) + V((dish * 0.3, 0, 0))
        pts = [p0, p0.lerp(p1, 0.5), p1]
        rad = [0.024, 0.019, 0.016]
        b.sweep(pts, rad, wood, n=6, up=(1, 0, 0), ellipse=(1.0, 0.62), uv=('grain', d, 1.0, 3.0))


def wire_wheel(b, r, tyre_w, rub, rim_m, hub_m, spoke_m, spokes=32, n=36, hub_w=0.10, hub_r=0.035,
               spoke_r=0.0022, nv=8):
    """Tyre (torus-ish) + metal rim + wire spokes. Outer radius exactly r. Axle = X."""
    tr = tyre_w / 2
    R = r - tr
    b.torus((0, 0, 0), R, tr, rub, nu=n, nv=nv, axis='X', ellipse=(1.0, 0.92))
    # rim channel
    rim_o = R - tr * 0.55
    rim_i = rim_o - max(0.012, tr * 0.6)
    rw = tyre_w * 0.85
    b.lathe([(-rw / 2, rim_o), (-rw / 2, rim_i + 0.004), (-rw / 4, rim_i), (rw / 4, rim_i), (rw / 2, rim_i + 0.004),
             (rw / 2, rim_o)], rim_m, n=n, axis='X', cap0=False, cap1=False)
    # hub with flanges
    b.lathe([(-hub_w / 2 - 0.01, 0.008), (-hub_w / 2, 0.012), (-hub_w / 2, hub_r), (-hub_w / 2 + 0.006, hub_r),
             (-hub_w / 2 + 0.012, hub_r * 0.55), (hub_w / 2 - 0.012, hub_r * 0.55), (hub_w / 2 - 0.006, hub_r),
             (hub_w / 2, hub_r), (hub_w / 2, 0.012), (hub_w / 2 + 0.01, 0.008)], hub_m, n=14, axis='X')
    # spokes (tangential lacing, alternating flanges)
    for i in range(spokes):
        side = 1 if i % 2 else -1
        a = 2 * math.pi * i / spokes
        cross = 0.35 * side * (1 if (i // 2) % 2 else -1)
        h = V((side * (hub_w / 2 - 0.004), math.cos(a + cross) * hub_r * 0.92, math.sin(a + cross) * hub_r * 0.92))
        q = V((side * 0.004, math.cos(a) * (rim_i + 0.002), math.sin(a) * (rim_i + 0.002)))
        b.sweep([h, q], spoke_r, spoke_m, n=4, cap=False)


# ---------------------------------------------------------------- export
def export(name):
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SRC_DIR, exist_ok=True)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC_DIR, name + ".blend"))
    path = os.path.join(OUT_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False,
        export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_anim_slide_to_zero=True,
        export_skins=True, export_morph_animation=False,
        export_image_format='JPEG', export_jpeg_quality=80,
        export_vertex_color='MATERIAL',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
    )
    print("EXPORTED", path, os.path.getsize(path))
