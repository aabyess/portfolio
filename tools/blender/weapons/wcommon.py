"""Weapons pass: shared textures / materials / export (headless Blender 5.x).
Hand frame (Blender axes): grip axis +Y (towards blade / head / upper limb),
forward (edge, striking face, barrel, arrow flight) = +Z, origin = centre of main grip."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from wbase import (Builder, reset, srgb2lin, catmull, frames_along, frames_up, mesh_tris, join, V,
                   REPO)

OUT_DIR = os.path.join(REPO, "models", "weapons")
SRC_DIR = os.path.join(REPO, "models", "src")


# ------------------------------------------------------------------ tileable noise
def tnoise(size, scale, seed, aniso=(1.0, 1.0), power=2.0):
    """Periodic fractal noise in 0..1. scale ~ feature frequency (cycles per tile)."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((size, size))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(size)[:, None] * size * aniso[1]
    fx = np.fft.fftfreq(size)[None, :] * size * aniso[0]
    f = np.sqrt(fx ** 2 + fy ** 2)
    filt = 1.0 / (1.0 + (f / max(scale, 1e-3)) ** power)
    filt[0, 0] = 0
    n = np.real(np.fft.ifft2(F * filt))
    n = (n - n.min()) / (n.max() - n.min() + 1e-9)
    return n


def scratches(size, count, seed, length=(0.02, 0.25), ang_spread=0.35, ang0=0.0, width=1):
    """Wrap-around scratch mask 0..1. ang0=0 -> mostly along U (columns axis)."""
    rng = np.random.default_rng(seed)
    m = np.zeros((size, size))
    for _ in range(count):
        x0, y0 = rng.random() * size, rng.random() * size
        a = ang0 + rng.normal() * ang_spread
        L = rng.uniform(*length) * size
        n = int(L * 1.5) + 2
        t = np.linspace(0, 1, n)
        curve = rng.normal() * 0.05
        xs = x0 + np.cos(a) * L * t - np.sin(a) * curve * L * t * t
        ys = y0 + np.sin(a) * L * t + np.cos(a) * curve * L * t * t
        inten = rng.uniform(0.3, 1.0) * np.sin(np.pi * t) ** 0.5
        for dw in range(width):
            xi = (xs.astype(int) + dw) % size
            yi = ys.astype(int) % size
            m[yi, xi] = np.maximum(m[yi, xi], inten)
    return m


def blur(a, k=1):
    out = a.copy()
    for _ in range(k):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5
    return out


def normal_from_height(h, strength=2.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def img(name, arr, noncolor=False):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=False, is_data=noncolor)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    im.pixels.foreach_set(rgba.ravel())
    im.update()
    im.pack()
    im.file_format = 'JPEG'
    return im


def orm(rough, metal):
    """glTF metallicRoughness: G = roughness, B = metalness."""
    z = np.zeros_like(rough)
    return np.stack([np.ones_like(rough), rough, np.broadcast_to(metal, rough.shape)], -1)


# ------------------------------------------------------------------ texture sets
# each returns dict(base=HxWx3 sRGB, orm=..., nrm=...)
def tex_steel(size=512, seed=1, dark=0.0, rust=0.0, polish=1.0):
    """Polished/ground steel. Grind lines + fine scratches run along U."""
    mott = tnoise(size, 5, seed)
    grind = tnoise(size, 90, seed + 1, aniso=(40, 1))
    fine = tnoise(size, 120, seed + 8)
    sc = scratches(size, int(1400 * polish), seed + 2, length=(0.03, 0.3), ang_spread=0.12) * 0.55
    sc = np.maximum(sc, scratches(size, int(300 * polish), seed + 3, length=(0.01, 0.05), ang_spread=1.4) * 0.45)
    stain = np.clip((tnoise(size, 9, seed + 4) - 0.55) * 3, 0, 1)
    pits = (tnoise(size, 60, seed + 5) > 0.86).astype(float) * 0.6
    lum = 0.60 - 0.07 * mott - 0.06 * grind + 0.16 * sc - 0.10 * stain - 0.10 * pits - 0.03 * fine - dark
    col = np.stack([lum * 0.985, lum * 0.995, lum * 1.02], -1)
    rm = 0
    if rust > 0:
        rm = np.clip((tnoise(size, 5, seed + 6) * 0.7 + tnoise(size, 30, seed + 7) * 0.3 - (1 - rust)) * 4, 0, 1)
        rcol = np.stack([0.36 + 0.1 * fine, 0.20 + 0.05 * fine, 0.11 + 0 * fine], -1)
        col = col * (1 - rm[..., None]) + rcol * rm[..., None]
    rough = np.clip(0.30 + 0.12 * mott + 0.10 * grind - 0.10 * sc + 0.20 * stain + 0.25 * pits + 0.5 * rm, 0.12, 1)
    metal = np.clip(0.6 - 0.5 * rm, 0, 0.6) if rust > 0 else 0.6
    h = -sc * 0.35 - pits * 0.5 + grind * 0.25
    return dict(base=col, orm=orm(rough, metal), nrm=normal_from_height(h, 1.2))


def tex_iron(size=256, seed=11):
    """Blackened forged iron: subtle hammer facets, dark oxide, worn highlights."""
    mott = tnoise(size, 10, seed)
    ham = tnoise(size, 22, seed + 1, power=5)
    fine = tnoise(size, 90, seed + 2)
    sc = scratches(size, 220, seed + 3, ang_spread=1.2, length=(0.02, 0.08)) * 0.5
    lum = 0.30 + 0.07 * mott + 0.05 * fine + 0.16 * sc + 0.05 * ham
    col = np.stack([lum, lum * 0.985, lum * 0.97], -1)
    rough = np.clip(0.50 + 0.15 * mott - 0.18 * sc + 0.08 * fine - 0.08 * ham, 0.2, 1)
    return dict(base=col, orm=orm(rough, 0.55), nrm=normal_from_height(ham * 0.8 + fine * 0.2 - sc * 0.3, 1.6))


def tex_wood(size=512, seed=21, rings=22, figure=0.4, pore_amt=1.0, nrm=1.5, late_amt=0.30):
    """Grain runs along U (texture columns axis = 'along the board')."""
    rng = np.random.default_rng(seed)
    u = np.linspace(0, 1, size, endpoint=False)
    U, Vv = np.meshgrid(u, u)
    warp = tnoise(size, 3, seed, aniso=(4, 1)) * 1.6 + tnoise(size, 10, seed + 1, aniso=(6, 1)) * 0.3
    r = (Vv * rings + warp * 2.5) % 1.0
    late = np.clip((r - 0.62) / 0.38, 0, 1) ** 1.5
    pores = (tnoise(size, 120, seed + 2, aniso=(12, 1)) > 0.62).astype(float) * 0.5
    streak = tnoise(size, 40, seed + 3, aniso=(20, 1))
    fig = tnoise(size, 6, seed + 4) * figure
    pores = pores * pore_amt
    lum = 0.92 - late_amt * late - 0.10 * pores - 0.10 * streak - 0.12 * fig
    col = np.stack([lum, lum * 0.90, lum * 0.80], -1)
    rough = np.clip(0.55 + 0.15 * late + 0.15 * pores - 0.1 * fig, 0.3, 1)
    h = -late * 0.5 - pores * 0.8 + streak * 0.2
    return dict(base=col, orm=orm(rough, 0.0), nrm=normal_from_height(blur(h), nrm))


def tex_leather(size=256, seed=31, wrap=0):
    """Leather; wrap>0 adds diagonal strap seams (count per tile)."""
    u = np.linspace(0, 1, size, endpoint=False)
    U, Vv = np.meshgrid(u, u)
    pore = tnoise(size, 90, seed)
    crease = tnoise(size, 18, seed + 1, power=3)
    mott = tnoise(size, 5, seed + 2)
    h = pore * 0.3 + crease * 0.4
    lum = 0.55 + 0.25 * mott + 0.15 * pore - 0.15 * crease
    if wrap:
        ph = (U * wrap + Vv) % 1.0     # helical strap: wrap turns per tile along U, one per V
        seam = np.exp(-((ph - 0.0) / 0.06) ** 2) + np.exp(-((ph - 1.0) / 0.06) ** 2)
        bulge = np.sin(np.pi * ph) ** 0.35
        h = h + bulge * 1.5 - seam * 1.5
        lum = lum * (0.65 + 0.35 * bulge) - 0.25 * seam
        wear = np.clip(bulge - 0.3, 0, 1) * 0.12
        lum = lum + wear
    col = np.stack([lum, lum * 0.82, lum * 0.66], -1)
    rough = np.clip(0.62 + 0.2 * crease - 0.15 * mott, 0.35, 1)
    return dict(base=col, orm=orm(rough, 0.0), nrm=normal_from_height(blur(h), 2.0))


def tex_brass(size=256, seed=41):
    mott = tnoise(size, 6, seed)
    fine = tnoise(size, 60, seed + 1)
    tarn = np.clip((tnoise(size, 8, seed + 2) - 0.45) * 2.5, 0, 1)
    sc = scratches(size, 200, seed + 3, ang_spread=1.4, length=(0.02, 0.1)) * 0.6
    lum = 0.85 - 0.12 * mott - 0.05 * fine + 0.1 * sc
    col = np.stack([lum, lum * 0.80, lum * 0.48], -1)
    tc = np.stack([0.36 + 0 * lum, 0.30 + 0 * lum, 0.16 + 0 * lum], -1)
    col = col * (1 - tarn[..., None] * 0.6) + tc * tarn[..., None] * 0.6
    rough = np.clip(0.30 + 0.25 * tarn + 0.1 * fine - 0.1 * sc, 0.15, 1)
    return dict(base=col, orm=orm(rough, 0.6), nrm=normal_from_height(blur(fine * 0.3 - sc * 0.4), 1.5))


def tex_plain(size, seed, base_lum=0.7, rough=0.7, metal=0.0, scale=30, amp=0.1):
    n = tnoise(size, scale, seed)
    lum = base_lum - amp * n
    col = np.stack([lum, lum, lum], -1)
    return dict(base=col, orm=orm(np.clip(rough + 0.15 * (n - 0.5), 0.1, 1), metal),
                nrm=normal_from_height(blur(n), 1.0))


# ------------------------------------------------------------------ materials
_PBR = {}


def pbr(name, t, tint='#ffffff', base_px=None, orm_px=None, nrm_px=None, nrm_strength=1.0, alpha=None):
    """t: texture dict. tint multiplies base colour (via baseColorFactor)."""
    if name in _PBR:
        return _PBR[name]

    def rs(a, px):
        if px is None or px == a.shape[0]:
            return a
        st = a.shape[0] // px
        return a.reshape(px, st, px, st, 3).mean(axis=(1, 3))

    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    ib = nt.nodes.new('ShaderNodeTexImage'); ib.image = img(name + "_base", rs(t['base'], base_px))
    lin = srgb2lin(tint)
    if tint.lower() != '#ffffff':
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(ib.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (*lin, 1)
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    else:
        nt.links.new(ib.outputs['Color'], bsdf.inputs['Base Color'])
    io = nt.nodes.new('ShaderNodeTexImage'); io.image = img(name + "_orm", rs(t['orm'], orm_px), True)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(io.outputs['Color'], sep.inputs[0])
    nt.links.new(sep.outputs[1], bsdf.inputs['Roughness'])
    nt.links.new(sep.outputs[2], bsdf.inputs['Metallic'])
    if t.get('nrm') is not None and nrm_px != 0:
        inn = nt.nodes.new('ShaderNodeTexImage'); inn.image = img(name + "_nrm", rs(t['nrm'], nrm_px), True)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nrm_strength
        nt.links.new(inn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    m.diffuse_color = (*lin, 1)
    _PBR[name] = m
    return m


def flat_mat(name, hexcol, rough=0.7, metal=0.0, emit=None, emit_strength=1.0):
    if name in _PBR:
        return _PBR[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*srgb2lin(hexcol), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*srgb2lin(emit), 1)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    _PBR[name] = m
    return m


class WBuilder(Builder):
    """Adds ('cyl', axis, center, su, sv): u along axis (m * su), v = angle / 2pi * sv."""

    def add(self, verts, faces, m, M=None, uv=None, flat=False):
        if uv is None or uv[0] != 'vert':
            return Builder.add(self, verts, faces, m, M=M, uv=uv, flat=flat)
        uvs = uv[1]
        bv, new = Builder.add(self, verts, faces, m, M=M, uv=None, flat=flat)
        look = {v: uvs[i] for i, v in enumerate(bv)}
        for f in new:
            vals = [list(look[l.vert]) for l in f.loops]
            vs = [q[1] for q in vals]
            if max(vs) - min(vs) > 0.5:
                for q in vals:
                    if q[1] < 0.5:
                        q[1] += 1.0
            for l, q in zip(f.loops, vals):
                l[self.uvl].uv = q
        return bv, new

    def _uv(self, faces, uv):
        if uv is None or uv[0] != 'cyl':
            return Builder._uv(self, faces, uv)
        ax = V(uv[1]).normalized(); c = V(uv[2]); su, sv = uv[3], uv[4]
        ref = V((1, 0, 0)) if abs(ax.x) < 0.9 else V((0, 0, 1))
        e1 = (ref - ax * ax.dot(ref)).normalized(); e2 = ax.cross(e1)
        for f in faces:
            vals = []
            for l in f.loops:
                d = l.vert.co - c
                a = math.atan2(d.dot(e2), d.dot(e1)) / (2 * math.pi)
                vals.append([d.dot(ax) * su, a])
            angs = [v[1] for v in vals]
            if max(angs) - min(angs) > 0.5:
                for v in vals:
                    if v[1] < 0:
                        v[1] += 1.0
            for l, v in zip(f.loops, vals):
                l[self.uvl].uv = (v[0], v[1] * sv)


def _rings(self, rings, m, cap0=True, cap1=True, uv=None, flat=False):
    """rings: list of equal-length closed point loops (Vectors)."""
    k = len(rings[0]); nr = len(rings)
    verts = [V(p) for r in rings for p in r]
    faces = []
    for i in range(nr - 1):
        a, b = i * k, (i + 1) * k
        for j in range(k):
            j2 = (j + 1) % k
            faces.append((a + j, a + j2, b + j2, b + j))
    if cap0:
        verts.append(sum(rings[0], V()) / k); ci = len(verts) - 1
        faces += [(ci, (j + 1) % k, j) for j in range(k)]
    if cap1:
        verts.append(sum(rings[-1], V()) / k); ci = len(verts) - 1
        o = (nr - 1) * k
        faces += [(ci, o + j, o + (j + 1) % k) for j in range(k)]
    return self.add(verts, faces, m, uv=uv, flat=flat)


WBuilder.rings = _rings


def _plate(self, outline, m, au=(0, 1, 0), av=(0, 0, 1), origin=(0, 0, 0), w0=0.0, w1=0.003, bevel=0.0008,
           seg=2, uv=None, smooth_outline=0):
    """Extrude a 2D outline [(u, v), ...] (counter-clockwise or not) between w0..w1 along au x av; bevelled."""
    au, av = V(au).normalized(), V(av).normalized()
    an = au.cross(av)
    o = V(origin)
    pts = list(outline)
    if smooth_outline:
        pts = [tuple(p[:2]) for p in catmull([(*p, 0) for p in pts], smooth_outline, closed=True)]
    tb = bmesh.new()
    vs = [tb.verts.new(o + au * u + av * v + an * w0) for u, v in pts]
    f = tb.faces.new(vs)
    r = bmesh.ops.extrude_face_region(tb, geom=[f])
    nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(tb, verts=nv, vec=an * (w1 - w0))
    bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
    if bevel > 0:
        caps = [e for e in tb.edges if len(e.link_faces) == 2 and
                abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
        bmesh.ops.bevel(tb, geom=caps, offset=bevel, segments=seg, affect='EDGES', profile=0.5, clamp_overlap=True)
    bmesh.ops.triangulate(tb, faces=[f for f in tb.faces if len(f.verts) > 4])
    verts = [V(v.co) for v in tb.verts]
    idx = {v: i for i, v in enumerate(tb.verts)}
    faces = [[idx[v] for v in f.verts] for f in tb.faces]
    tb.free()
    return self.add(verts, faces, m, uv=uv if uv is not None else ('box', 8.0))


WBuilder.plate = _plate


def reset_all():
    reset()
    _PBR.clear()


# ------------------------------------------------------------------ helpers
def xform_builder(b, M):
    for v in b.bm.verts:
        v.co = M @ v.co
    b.bm.normal_update()


def empty_at(name, loc, fwd=None, parent=None, parent_bone=None, size=0.05):
    """Empty whose glTF local +Z (= Blender local -Y) points along fwd (Blender world vector)."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = size
    bpy.context.scene.collection.objects.link(e)
    R = Matrix.Identity(3)
    if fwd is not None:
        f = V(fwd).normalized()
        # local -Y -> f ; choose local +Z (Blender) close to world +Y/+Z
        y = -f
        hint = V((0, 0, 1)) if abs(f.z) < 0.9 else V((0, 1, 0))
        z = (hint - y * y.dot(hint)).normalized()
        x = y.cross(z)
        R = Matrix((x, y, z)).transposed()
    Mw = R.to_4x4(); Mw.translation = V(loc)
    if parent is not None:
        e.parent = parent
        if parent_bone:
            e.parent_type = 'BONE'
            e.parent_bone = parent_bone
    bpy.context.view_layer.update()
    e.matrix_world = Mw
    bpy.context.view_layer.update()
    return e


def export(name):
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SRC_DIR, exist_ok=True)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC_DIR, "weapon-" + name + ".blend"))
    path = os.path.join(OUT_DIR, name + ".glb")
    has_anim = len(bpy.data.actions) > 0
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=False,
        export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False,
        export_animations=has_anim, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_anim_slide_to_zero=True,
        export_skins=True, export_morph_animation=False,
        export_image_format='JPEG', export_jpeg_quality=78,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print("EXPORTED", path, os.path.getsize(path))
