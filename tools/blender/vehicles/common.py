"""Shared helpers for low-poly vehicle building (headless Blender).
Convention: front = -Y, up = +Z, origin on ground at vehicle center."""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Quaternion

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
OUT_DIR = os.path.join(REPO, "models", "vehicles")
SRC_DIR = os.path.join(REPO, "models", "src")
FPS = 24


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0


# ---------------------------------------------------------------- materials
_MATS = {}


def mat(name, hexcol, rough=0.85, metal=0.0):
    if name in _MATS:
        return _MATS[name]
    h = hexcol.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*lin, 1.0)
    _MATS[name] = m
    return m


# ---------------------------------------------------------------- builder
def _frame(d):
    d = d.normalized()
    side = Vector((1, 0, 0)) - d * d.x
    if side.length < 1e-3:
        side = Vector((0, 1, 0)) - d * d.y
    side.normalize()
    up = d.cross(side).normalized()
    return side, up


class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []
        self.groups = []
        self.dl = self.bm.verts.layers.deform.verify()

    def _add(self, verts, faces, m, group=None):
        if m not in self.mats:
            self.mats.append(m)
        mi = self.mats.index(m)
        gi = None
        if group is not None:
            if group not in self.groups:
                self.groups.append(group)
            gi = self.groups.index(group)
        bv = [self.bm.verts.new(Vector(v)) for v in verts]
        if gi is not None:
            for v in bv:
                v[self.dl][gi] = 1.0
        new = []
        for f in faces:
            try:
                face = self.bm.faces.new([bv[i] for i in f])
                face.material_index = mi
                new.append(face)
            except ValueError:
                pass
        bmesh.ops.recalc_face_normals(self.bm, faces=new)
        return bv

    # tapered box between two points; s = (width along X-ish, height along 'up')
    def seg(self, p0, p1, s0, s1, m, group=None, twist_up=None):
        p0, p1 = Vector(p0), Vector(p1)
        side, up = _frame(p1 - p0)
        if twist_up is not None:  # force 'up' to be closest to given vector
            d = (p1 - p0).normalized()
            u = Vector(twist_up) - d * d.dot(Vector(twist_up))
            up = u.normalized()
            side = up.cross(d).normalized()
        vs = []
        for p, (w, h) in ((p0, s0), (p1, s1)):
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                vs.append(p + side * (sx * w / 2) + up * (sy * h / 2))
        faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        return self._add(vs, faces, m, group)

    def box(self, c, size, m, group=None):
        c = Vector(c)
        sx, sy, sz = size
        return self.seg(c - Vector((0, sy / 2, 0)), c + Vector((0, sy / 2, 0)), (sx, sz), (sx, sz), m, group)

    # n-gon tube between two points
    def tube(self, p0, p1, r0, r1, m, n=8, group=None, rot=0.0):
        p0, p1 = Vector(p0), Vector(p1)
        side, up = _frame(p1 - p0)
        vs = []
        for p, r in ((p0, r0), (p1, r1)):
            for i in range(n):
                a = rot + 2 * math.pi * i / n
                vs.append(p + side * (math.cos(a) * r) + up * (math.sin(a) * r))
        faces = [tuple(range(n)), tuple(range(n, 2 * n))]
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        return self._add(vs, faces, m, group)

    # annulus around X axis (wheel rims / tyres)
    def ring(self, c, r_out, r_in, width, m, n=12, group=None, rot=0.0):
        c = Vector(c)
        vs = []
        for i in range(n):
            a = rot + 2 * math.pi * i / n
            ca, sa = math.cos(a), math.sin(a)
            for x, r in ((-width / 2, r_out), (width / 2, r_out), (width / 2, r_in), (-width / 2, r_in)):
                vs.append(c + Vector((x, ca * r, sa * r)))
        faces = []
        for i in range(n):
            j = (i + 1) % n
            for k in range(4):
                k2 = (k + 1) % 4
                faces.append((i * 4 + k, i * 4 + k2, j * 4 + k2, j * 4 + k))
        return self._add(vs, faces, m, group)

    # curved band in YZ plane (fenders); angle measured from +Y toward +Z
    def arc(self, c, R, t, w, a0, a1, m, k=6, group=None, x=0.0):
        c = Vector(c)
        vs = []
        for i in range(k + 1):
            a = math.radians(a0 + (a1 - a0) * i / k)
            ca, sa = math.cos(a), math.sin(a)
            for xx, r in ((-w / 2, R), (w / 2, R), (w / 2, R - t), (-w / 2, R - t)):
                vs.append(c + Vector((x + xx, ca * r, sa * r)))
        faces = [(0, 1, 2, 3), (k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 3)]
        for i in range(k):
            j = i + 1
            for q in range(4):
                q2 = (q + 1) % 4
                faces.append((i * 4 + q, i * 4 + q2, j * 4 + q2, j * 4 + q))
        return self._add(vs, faces, m, group)

    def to_object(self, name, origin=(0, 0, 0), parent=None):
        o = Vector(origin)
        for v in self.bm.verts:
            v.co -= o
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        for g in self.groups:
            ob.vertex_groups.new(name=g)
        if parent is not None:
            ob.parent = parent
            ob.location = o - parent_world_origin(parent)
        else:
            ob.location = o
        return ob


def parent_world_origin(p):
    bpy.context.view_layer.update()
    return p.matrix_world.translation.copy()


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
    e.matrix_world = Matrix.Translation(Vector(loc))
    bpy.context.view_layer.update()
    return e


# ---------------------------------------------------------------- wheels
def spoked_wheel(b, r, width, wood, iron, hubm, spokes=8, n=14, spoke_m=None, thin=False):
    """Builds a wheel centred at origin into builder b; axis = X."""
    if thin:  # bicycle / motorcycle: rubber tyre + metal rim + wire spokes
        b.ring((0, 0, 0), r, r - width * 0.9, width, wood, n=n)          # tyre (wood arg = rubber)
        b.ring((0, 0, 0), r - width * 0.85, r - width * 1.35, width * 0.5, iron, n=n)  # rim
        b.tube((-width * 0.7, 0, 0), (width * 0.7, 0, 0), r * 0.09, r * 0.09, hubm, n=6)
        sm = spoke_m or iron
        for i in range(spokes):
            a = 2 * math.pi * i / spokes
            off = (-1 if i % 2 else 1) * width * 0.25
            p1 = Vector((off * 0.3, math.cos(a) * (r - width * 1.3), math.sin(a) * (r - width * 1.3)))
            p0 = Vector((off, math.cos(a + 0.3) * r * 0.08, math.sin(a + 0.3) * r * 0.08))
            b.seg(p0, p1, (0.012, 0.012), (0.012, 0.012), sm)
        return
    b.ring((0, 0, 0), r, r - 0.03, width + 0.01, iron, n=n)           # iron tyre
    b.ring((0, 0, 0), r - 0.025, r - 0.10, width, wood, n=n)          # wooden felloe
    hr = max(0.07, r * 0.17)
    b.tube((-width * 1.4, 0, 0), (width * 1.4, 0, 0), hr, hr * 0.8, hubm, n=8)
    b.tube((-width * 1.6, 0, 0), (width * 1.6, 0, 0), hr * 0.45, hr * 0.45, iron, n=6)
    for i in range(spokes):
        a = 2 * math.pi * i / spokes + math.pi / spokes
        d = Vector((0, math.cos(a), math.sin(a)))
        b.seg(d * hr * 0.9, d * (r - 0.09), (width * 0.45, 0.05), (width * 0.35, 0.04), wood)


# ---------------------------------------------------------------- export
def export(name, extra_note=""):
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
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
    )
    print("EXPORTED", path, os.path.getsize(path))
