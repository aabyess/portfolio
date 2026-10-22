# 상호랜드 동물 공용 빌더 (화면 없는 Blender 전용)
#   메타볼로 몸을 만들고(고해상도) → 줄인 메쉬(저해상도)에 색을 굽고(512/1024 WebP) →
#   메타볼 원소의 장(field)으로 뼈 가중치를 주고 → 동작(Idle/Walk/Run/Eat/Sit[/Stand])을 키프레임으로 굽고 → GLB 내보내기.
# 좌표: Blender 기준 앞 = -Y, 위 = +Z, 왼쪽 = +X (glTF 로 나가면 앞 = +Z). 원점은 네 발 가운데 바닥. 단위 m.
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Quaternion, Euler, Matrix

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
OUT_GLB = os.environ.get("ANIMAL_OUT") or os.path.join(REPO, "models", "animals")
OUT_SRC = os.path.join(REPO, "models", "src")
FPS = 24
STIFF = 2.0
KF = math.sqrt(1 - (0.6 / STIFF) ** (1 / 3))   # 홀로 있는 원소의 표면 반지름 = R * KF (≈0.574)
D2R = math.pi / 180

def _tube_c(sp=0.3):
    """간격 sp*R 로 줄지은 공들의 표면 반지름 / R."""
    lo, hi = 0.3, 1.0
    for _ in range(50):
        c = (lo + hi) / 2
        f = sum(STIFF * max(0.0, 1 - c * c - (k * sp) ** 2) ** 3 for k in range(-8, 9))
        if f > 0.6: lo = c
        else: hi = c
    return (lo + hi) / 2
TUBE_S = 0.3
TUBE_C = _tube_c(TUBE_S)

def V(*a): return Vector(a[0] if len(a) == 1 else a)
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def sstep(e0, e1, x):
    t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t)
def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)   # sRGB → 선형

# ───────────────────────────────────────────── 원소 (표면 크기로 적는다)
class Body:
    def __init__(self):
        self.el = []       # dict(kind, c, R, size, q, bone, col)
        self.paints = []   # 색만 칠하는 타원체
        self.fpaints = []  # 함수 칠하기 f(p, col) -> col
    def _add(self, kind, c, R, size, q, bone, col, mirror):
        e = dict(kind=kind, c=Vector(c), R=R, size=tuple(size), q=q, bone=bone, col=hexc(col) if isinstance(col, str) else col)
        self.el.append(e)
        if mirror and abs(c[0]) > 1e-6:
            m = dict(e); m['c'] = Vector((-c[0], c[1], c[2]))
            qq = q.copy(); qq.y, qq.z = -qq.y, -qq.z   # x=0 평면 대칭
            m['q'] = qq; m['bone'] = flip(bone)
            self.el.append(m)
    def ball(self, c, r, bone, col, mirror=True):
        self._add('BALL', c, r / KF, (1, 1, 1), Quaternion(), bone, col, mirror)
    def ell(self, c, rr, bone, col, rot=(0, 0, 0), mirror=True):
        m = max(rr); q = Euler([a * D2R for a in rot]).to_quaternion()
        self._add('ELLIPSOID', c, m / KF, tuple(x / m for x in rr), q, bone, col, mirror)
    def cap(self, a, b, r, bone, col, mirror=True):
        a, b = Vector(a), Vector(b); d = b - a; L = d.length / 2
        q = Vector((1, 0, 0)).rotation_difference(d.normalized()) if L > 1e-6 else Quaternion()
        self._add('CAPSULE', (a + b) / 2, r / KF, (L, 1, 1), q, bone, col, mirror)
    def chain(self, pts, radii, bones, col, steps=2, mirror=True):
        """굵기가 변하는 관: 촘촘한 공(간격 0.3R)을 이어 붙인다 → 마디 혹 없이 매끈하다.
        (캡슐을 이으면 이음매에서 장이 두 배가 되어 19% 불룩해진다)"""
        for i in range(len(pts) - 1):
            a, b = Vector(pts[i]), Vector(pts[i + 1])
            L = (b - a).length
            rm = min(radii[i], radii[i + 1])
            n = max(2, int(math.ceil(L / (TUBE_S * rm / TUBE_C))))
            bone = bones[i] if isinstance(bones, (list, tuple)) else bones
            for j in range(n + (1 if i == len(pts) - 2 else 0)):
                t = j / n
                r = radii[i] + (radii[i + 1] - radii[i]) * t
                self._add('BALL', a.lerp(b, t), r / TUBE_C, (1, 1, 1), Quaternion(), bone, col, mirror)
    def paint(self, c, rr, col, soft=0.35, rot=(0, 0, 0), mirror=True):
        q = Euler([a * D2R for a in rot]).to_quaternion()
        self.paints.append(dict(c=Vector(c), rr=Vector(rr), q=q, col=hexc(col) if isinstance(col, str) else col, soft=soft))
        if mirror and abs(c[0]) > 1e-6:
            qq = q.copy(); qq.y, qq.z = -qq.y, -qq.z
            self.paints.append(dict(c=Vector((-c[0], c[1], c[2])), rr=Vector(rr), q=qq, col=self.paints[-1]['col'], soft=soft))

def flip(bone):
    if bone.endswith('.L'): return bone[:-2] + '.R'
    if bone.endswith('.R'): return bone[:-2] + '.L'
    if bone.startswith('FL_'): return 'FR_' + bone[3:]
    if bone.startswith('FR_'): return 'FL_' + bone[3:]
    if bone.startswith('BL_'): return 'BR_' + bone[3:]
    if bone.startswith('BR_'): return 'BL_' + bone[3:]
    return bone

def fields(el, P):
    """P: (N,3) → (N, M) 각 원소의 장 값 (Blender 메타볼 식: s*(1-d²/R²)^3)."""
    out = np.zeros((len(P), len(el)))
    for j, e in enumerate(el):
        R = np.array(e['q'].inverted().to_matrix())
        L = (P - np.array(e['c'])) @ R.T
        if e['kind'] == 'CAPSULE':
            dx = np.maximum(np.abs(L[:, 0]) - e['size'][0], 0)
            d2 = dx * dx + L[:, 1] ** 2 + L[:, 2] ** 2
        else:
            L = L / np.array(e['size'])
            d2 = (L * L).sum(1)
        x = np.clip(1 - d2 / (e['R'] ** 2), 0, None)
        out[:, j] = STIFF * x ** 3
    return out

def soft_dist(el, P):
    """장이 0인 점을 위한 대체값: 원소 표면까지의 대략 거리(정규화)."""
    out = np.zeros((len(P), len(el)))
    for j, e in enumerate(el):
        R = np.array(e['q'].inverted().to_matrix())
        L = (P - np.array(e['c'])) @ R.T
        if e['kind'] == 'CAPSULE':
            dx = np.maximum(np.abs(L[:, 0]) - e['size'][0], 0)
            d = np.sqrt(dx * dx + L[:, 1] ** 2 + L[:, 2] ** 2)
        else:
            d = np.sqrt(((L / np.array(e['size'])) ** 2).sum(1))
        out[:, j] = d / (e['R'] * KF)
    return out

# ───────────────────────────────────────────── 메쉬
def metaball_mesh(body, res, name):
    mb = bpy.data.metaballs.new(name); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new(name + "_mb", mb); bpy.context.scene.collection.objects.link(ob)
    for e in body.el:
        m = mb.elements.new(type=e['kind']); m.co = e['c']; m.radius = e['R']; m.stiffness = STIFF
        m.rotation = e['q']
        if e['kind'] in ('ELLIPSOID', 'CAPSULE'): m.size_x, m.size_y, m.size_z = e['size']
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.metaballs.remove(mb)
    me.name = name
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    # 겹친 점 정리
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=res * 0.05)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    return o

def vertex_colors(body, me, extra=None):
    P = np.array([v.co[:] for v in me.vertices])
    F = fields(body.el, P)
    W = F ** 2
    tot = W.sum(1)
    D = soft_dist(body.el, P)
    near = D.argmin(1)
    cols = np.array([e['col'] for e in body.el])
    C = np.where(tot[:, None] > 1e-9, (W @ cols) / np.maximum(tot, 1e-9)[:, None], cols[near])
    for pt in body.paints:
        R = np.array(pt['q'].inverted().to_matrix())
        L = (P - np.array(pt['c'])) @ R.T / np.array(pt['rr'])
        d = np.sqrt((L * L).sum(1))
        t = np.clip((1 - d) / max(pt['soft'], 1e-3), 0, 1)
        t = t * t * (3 - 2 * t)
        C = C * (1 - t[:, None]) + np.array(pt['col'])[None, :] * t[:, None]
    torso_cols = [j for j, e in enumerate(body.el) if e['bone'] in ('Hips', 'Chest')]
    near_t = np.isin(near, torso_cols).astype(float)
    ft = F[:, torso_cols].sum(1); fa = F.sum(1)
    info = dict(torso=np.where(fa > 1e-9, ft / np.maximum(fa, 1e-9), near_t))
    for f in body.fpaints:
        C = f(P, C, info)
    if extra: C = extra(P, C)
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    flat = np.ones((len(P), 4)); flat[:, :3] = np.clip(C, 0, 1)
    ca.data.foreach_set("color", flat.ravel())
    return ca

def decimate(o, target):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > target:
        m = o.modifiers.new("dec", 'DECIMATE'); m.ratio = target / tris; m.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); old = o.data; o.data = me; bpy.data.meshes.remove(old)
    for p in o.data.polygons: p.use_smooth = True
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

def tube(pts, radii, seg=7):
    """두께가 변하는 관 (뿔·엄니). 끝은 뾰족하게 닫는다."""
    verts, faces = [], []
    pts = [Vector(p) for p in pts]
    n = len(pts)
    prev_side = None
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4: side = d.cross(Vector((1, 0, 0)))
        side.normalize(); up = side.cross(d).normalized()
        r = radii[i]
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append(p + (side * math.cos(a) + up * math.sin(a)) * r)
    for i in range(n - 1):
        for k in range(seg):
            a, b = i * seg + k, i * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    verts.append(pts[0] - (pts[1] - pts[0]).normalized() * radii[0] * 0.3); c0 = len(verts) - 1
    for k in range(seg): faces.append((c0, (k + 1) % seg, k))
    return verts, faces

def uv_sphere(c, r, seg=10, rings=7, sc=(1, 1, 1)):
    verts, faces = [], []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for k in range(seg):
            ph = 2 * math.pi * k / seg
            verts.append(Vector(c) + Vector((math.sin(th) * math.cos(ph) * sc[0], math.sin(th) * math.sin(ph) * sc[1], math.cos(th) * sc[2])) * r)
    for i in range(rings):
        for k in range(seg):
            a, b = i * seg + k, i * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    return verts, faces

def surface_point(body, c, d):
    """c 에서 d 방향으로 나가며 장이 문턱(0.6) 아래가 되는 곳."""
    c, d = Vector(c), Vector(d).normalized()
    lo, hi = 0.0, 0.0
    step = 0.005
    t = 0.0
    while t < 2.0:
        f = fields(body.el, np.array([(c + d * t)[:]])).sum()
        if f < 0.6: break
        t += step
    return c + d * t

# ───────────────────────────────────────────── 재질
def mat_plain(name, col, rough=0.5, emit=0.0):
    m = bpy.data.materials.new(name)
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*col, 1); b.inputs["Emission Strength"].default_value = emit
    return m

def bake_albedo(hi, lo, name, res, fur=0.16, fur_scale=90.0):
    """hi(꼭짓점 색 × 털 결 노이즈) → lo 의 UV 텍스처로 굽는다."""
    sc = bpy.context.scene
    # lo UV
    for o in bpy.context.scene.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = lo; lo.select_set(True)
    lo.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=66 * D2R, island_margin=0.006, area_weight=0.0, scale_to_bounds=False)
    try: bpy.ops.uv.pack_islands(margin=0.008, rotate=True)
    except Exception as e: print("pack", e)
    bpy.ops.object.mode_set(mode='OBJECT')
    # hi 재질: 방출 = 꼭짓점 색 × 노이즈
    mh = bpy.data.materials.new(name + "_hi"); nt = mh.node_tree; N = nt.nodes; Lk = nt.links.new
    N.clear()
    out = N.new("ShaderNodeOutputMaterial"); emi = N.new("ShaderNodeEmission")
    vc = N.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    tc = N.new("ShaderNodeTexCoord"); mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 1.0, 0.35)
    Lk(tc.outputs["Object"], mp.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = fur_scale; nz.inputs["Detail"].default_value = 4.0
    Lk(mp.outputs["Vector"], nz.inputs["Vector"])
    nz2 = N.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = fur_scale * 0.12; nz2.inputs["Detail"].default_value = 2.0
    Lk(tc.outputs["Object"], nz2.inputs["Vector"])
    a1 = N.new("ShaderNodeMath"); a1.operation = 'MULTIPLY_ADD'; Lk(nz.outputs["Fac"], a1.inputs[0]); a1.inputs[1].default_value = fur; a1.inputs[2].default_value = 1 - fur / 2
    a2 = N.new("ShaderNodeMath"); a2.operation = 'MULTIPLY_ADD'; Lk(nz2.outputs["Fac"], a2.inputs[0]); a2.inputs[1].default_value = 0.10; a2.inputs[2].default_value = 0.95
    a3 = N.new("ShaderNodeMath"); a3.operation = 'MULTIPLY'; Lk(a1.outputs[0], a3.inputs[0]); Lk(a2.outputs[0], a3.inputs[1])
    mx = N.new("ShaderNodeMix"); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
    Lk(vc.outputs["Color"], mx.inputs[6]); Lk(a3.outputs[0], mx.inputs[7])
    Lk(mx.outputs[2], emi.inputs["Color"]); Lk(emi.outputs[0], out.inputs["Surface"])
    hi.data.materials.clear(); hi.data.materials.append(mh)
    # lo 재질 + 이미지
    img = bpy.data.images.new(name + "_albedo", res, res, alpha=False)
    ml = bpy.data.materials.new(name + "_fur"); nt = ml.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img; nt.nodes.active = ti
    b.inputs["Roughness"].default_value = 0.88
    try: b.inputs["Specular IOR Level"].default_value = 0.3
    except Exception: pass
    lo.data.materials.clear(); lo.data.materials.append(ml)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'CPU'
    try: sc.cycles.use_denoising = False
    except Exception: pass
    for o in bpy.context.scene.objects: o.select_set(False)
    hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    dims = max(lo.dimensions)
    bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=dims * 0.02,
                        max_ray_distance=dims * 0.05, margin=6, use_clear=True)
    img.pack()
    nt.links.new(ti.outputs["Color"], b.inputs["Base Color"])
    sc.render.engine = 'BLENDER_EEVEE'
    return ml

# ───────────────────────────────────────────── 뼈대
def build_armature(bones, name):
    ad = bpy.data.armatures.new(name + "_Arm")
    arm = bpy.data.objects.new(name.capitalize(), ad); bpy.context.scene.collection.objects.link(arm)
    for o in bpy.context.scene.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, (h, t, p) in bones.items():
        eb = ad.edit_bones.new(bn); eb.head = h; eb.tail = t; eb.roll = 0.0
    for bn, (h, t, p) in bones.items():
        if p: ad.edit_bones[bn].parent = ad.edit_bones[p]; ad.edit_bones[bn].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm

def skin_weights(body, ob, bones, rigid=None):
    """메타볼 원소마다 주인 뼈가 있다 → 점의 가중치 = 그 뼈 원소들의 장 합 (상위 3개, 정규화)."""
    me = ob.data
    P = np.array([v.co[:] for v in me.vertices])
    F = fields(body.el, P)
    D = soft_dist(body.el, P)
    names = list(bones.keys())
    idx = {n: i for i, n in enumerate(names)}
    Wb = np.zeros((len(P), len(names)))
    for j, e in enumerate(body.el):
        Wb[:, idx[e['bone']]] += F[:, j]
    zero = Wb.sum(1) < 1e-6
    if zero.any():
        near = D[zero].argmin(1)
        for k, vi in enumerate(np.where(zero)[0]):
            Wb[vi, idx[body.el[near[k]]['bone']]] = 1.0
    groups = {n: ob.vertex_groups.new(name=n) for n in names}
    for i in range(len(P)):
        w = Wb[i]
        top = np.argsort(-w)[:3]
        s = w[top].sum()
        for j in top:
            if w[j] / s > 0.02: groups[names[j]].add([i], float(w[j] / s), 'REPLACE')
    if rigid:
        for (vi0, vi1, bn) in rigid:
            for g in groups.values(): g.remove(list(range(vi0, vi1)))
            groups[bn].add(list(range(vi0, vi1)), 1.0, 'REPLACE')

# ───────────────────────────────────────────── 동작
class Poser:
    """회전은 '부모 기준, 몸 축'으로 적는다: pitch=X축(+면 다리는 뒤로, 앞을 향한 뼈는 코가 아래로),
    yaw=Z축(+면 왼쪽(+X)으로), roll=Y축. 값은 도(degree). loc 은 Root 의 몸 기준 이동(m)."""
    def __init__(self, arm):
        self.arm = arm; self.prev = {}
        for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    def key(self, frame, rots, loc=(0, 0, 0)):
        for pb in self.arm.pose.bones:
            p, y, r = rots.get(pb.name, (0, 0, 0))
            qa = Quaternion((0, 0, 1), y * D2R) @ Quaternion((1, 0, 0), p * D2R) @ Quaternion((0, 1, 0), r * D2R)
            M = pb.bone.matrix_local.to_quaternion()
            q = M.inverted() @ qa @ M
            pq = self.prev.get(pb.name)
            if pq is not None and pq.dot(q) < 0: q = -q
            self.prev[pb.name] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if pb.name == 'Root':
                pb.location = M.inverted() @ Vector(loc)
                pb.keyframe_insert("location", frame=frame)

def bake_actions(arm, clips):
    """clips: [(이름, 프레임수, f(t)->(rots, loc), cyclic)]"""
    arm.animation_data_create()
    for name, n, fn, cyc in clips:
        act = bpy.data.actions.new(name); act.use_fake_user = True
        arm.animation_data.action = act
        P = Poser(arm)
        for f in range(n + 1):
            rots, loc = fn(f / n)
            P.key(f, rots, loc)
        act.use_frame_range = True; act.frame_start = 0; act.frame_end = n
        act.use_cyclic = cyc
        tr = arm.animation_data.nla_tracks.new(); tr.name = name
        tr.strips.new(name, 0, act); tr.mute = True
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)

def export_glb(name):
    glb = os.path.join(OUT_GLB, f"{name}.glb")
    os.makedirs(OUT_GLB, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False,
                              export_skins=True, export_yup=True, export_apply=False,
                              export_anim_slide_to_zero=True, export_optimize_animation_size=True,
                              export_extra_animations=False, export_vertex_color='NONE',
                              export_image_format='WEBP', export_image_quality=85)
    return glb
