# 동물 한 종(또는 여러 종)을 만들어 models/animals/<이름>.glb 와 models/src/animal-<이름>.blend 로 내보낸다.
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/animals/build.py -- panda bear ...
#   (인자가 없으면 전부. build_all.sh 는 종마다 따로 띄워 나란히 돌린다)
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from mathutils import Vector, Quaternion
import lib, species
from lib import sstep, D2R

def rot2(y, z, a):
    """YZ 평면에서 X축 회전(+면 앞을 향한 것이 아래로)."""
    c, s = math.cos(a * D2R), math.sin(a * D2R)
    return y * c - z * s, y * s + z * c

def bisect(f, lo, hi, n=40):
    flo = f(lo)
    for _ in range(n):
        m = (lo + hi) / 2; fm = f(m)
        if (fm > 0) == (flo > 0): lo, flo = m, fm
        else: hi = m
    return (lo + hi) / 2

# ───────────────────────────────────────────── 동작 만들기
def make_clips(S, hipverts):
    hy, hz = S['hip']; F, Bk = S['front'], S['back']
    sz = S['size']
    wag = S.get('wag', False)
    hop = S['gait'] == 'hop'
    nk = S['neck']['pts']; n0, n1 = nk[0], nk[-1]; nose = S['nose']['c']
    sin, cos, pi = math.sin, math.cos, math.pi
    bump = lambda t, c, w=0.035: math.exp(-((t - c) / w) ** 2)
    legs = ('FL', 'FR', 'BL', 'BR')

    def idle_overlay(r, t, look=1.0, tail=True):
        r['Chest'] = tuple(np.add(r.get('Chest', (0, 0, 0)), (1.2 * sin(4 * pi * t), 0, 0)))
        nkr = r.get('Neck', (0, 0, 0))
        r['Neck'] = (nkr[0] + 3 * sin(4 * pi * t + 1), nkr[1] + 20 * look * sin(2 * pi * t), nkr[2])
        hd = r.get('Head', (0, 0, 0))
        r['Head'] = (hd[0] + 2 * sin(6 * pi * t), hd[1] + 8 * look * sin(2 * pi * t + 0.6), hd[2] + 4 * look * sin(2 * pi * t + 1.2))
        if tail:
            w = (26 * sin(2 * pi * 8 * t)) if wag else 9 * sin(2 * pi * 2 * t)
            r['Tail1'] = (r.get('Tail1', (0, 0, 0))[0], w, 0); r['Tail2'] = (r.get('Tail2', (0, 0, 0))[0], w * 0.9, 0)
        r['Ear.L'] = (-22 * bump(t, 0.30), 0, 0); r['Ear.R'] = (-22 * bump(t, 0.64), 0, 0)
        return r

    def idle(t):
        return idle_overlay({}, t), (0, 0, 0)

    def gait(t, A, Bend, D, phases, bob, spine, tailw, ears=0.0):
        r = {}
        for leg in legs:
            u = (t + phases[leg]) % 1.0
            if u < D:
                up = A * (-1 + 2 * u / D); low = 0.0
            else:
                s = (u - D) / (1 - D)
                up = A * (1 - 2 * (0.5 - 0.5 * cos(pi * s))); low = Bend * sin(pi * s)
            r[leg + '_Upper'] = (up, 0, 0); r[leg + '_Lower'] = (low, 0, 0)
        return r

    def walk(t):
        if hop: return hopgait(t, 0.55, 18, 0.05 * sz)
        A = S.get('walk_A', 22)
        r = gait(t, A, 38, 0.62, dict(BL=0.0, FL=0.25, BR=0.5, FR=0.75), 0, 0, 0)
        r['Hips'] = (0, 0, 2.5 * sin(2 * pi * t)); r['Chest'] = (0, 1.5 * sin(2 * pi * t), -2.5 * sin(2 * pi * t))
        r['Neck'] = (2.5 * sin(4 * pi * t), -2 * sin(2 * pi * t), 0); r['Head'] = (-1.5 * sin(4 * pi * t), 0, 0)
        w = (22 * sin(2 * pi * 4 * t)) if wag else 8 * sin(2 * pi * t)
        r['Tail1'] = (0, w, 0); r['Tail2'] = (0, w, 0)
        return r, (0, 0, -0.012 * sz * (0.5 + 0.5 * cos(4 * pi * t)))

    def hopgait(t, D, A, hgt):
        r = gait(t, A, 30, D, dict(FL=0.0, FR=0.03, BL=0.48, BR=0.5), 0, 0, 0)
        ph = 2 * pi * (t - 0.1)
        r['Hips'] = (8 * sin(ph), 0, 0); r['Chest'] = (-6 * sin(ph), 0, 0)
        r['Neck'] = (-4 * sin(ph), 0, 0); r['Ear.L'] = (10 + 8 * sin(ph), 0, 0); r['Ear.R'] = (10 + 8 * sin(ph), 0, 0)
        return r, (0, 0, hgt * max(0.0, sin(ph)))

    def run(t):
        if hop: return hopgait(t, 0.42, 34, 0.11 * sz)
        A = S.get('run_A', 40)
        r = gait(t, A, 70, 0.40, dict(BL=0.0, BR=0.1, FL=0.5, FR=0.6), 0, 0, 0)
        ph = 2 * pi * t
        r['Hips'] = (7 * sin(ph), 0, 0); r['Chest'] = (-11 * sin(ph), 0, 0)
        r['Neck'] = (6 * sin(ph + 0.6) - 6, 0, 0); r['Head'] = (-3 * sin(ph), 0, 0)
        r['Tail1'] = (-15 + 8 * sin(ph), 0, 0); r['Tail2'] = (-8 + 6 * sin(ph + 0.8), 0, 0)
        r['Ear.L'] = (28, 0, 0); r['Ear.R'] = (28, 0, 0)
        return r, (0, 0, 0.05 * sz * (0.5 + 0.5 * sin(ph - 0.4)))

    # 풀 뜯기: 코끝이 땅(코 반지름) 높이에 오게 목·머리 각을 푼다
    HEAD_TOT = S.get('eat_head_total', 100.0)     # 머리 전체 기울기 상한 (코가 뒤를 보지 않게)
    hloc = lambda a: max(0.0, min(0.5 * a, HEAD_TOT - a))
    def nose_z(a):
        y1, z1 = rot2(n1[0] - n0[0], n1[1] - n0[1], a)
        y2, z2 = rot2(nose[0] - n1[0], nose[1] - n1[1], a + hloc(a))
        return n0[1] + z1 + z2
    target = S['nose']['rr'][2] * 1.5 + 0.015 * sz
    amax = S.get('eat_max', 75.0)
    zs = [(nose_z(a), a) for a in np.linspace(0, amax, 76)]
    a_eat = next((a for z, a in zs if z <= target), min(zs)[1])
    def eat(t):
        r = {'Neck': (a_eat, 4 * sin(2 * pi * t), 0), 'Head': (hloc(a_eat) + 4 * sin(2 * pi * 4 * t), 3 * sin(2 * pi * 2 * t), 0),
             'Chest': (3, 0, 0), 'FL_Upper': (-5, 0, 0), 'FR_Upper': (-5, 0, 0)}
        w = (18 * sin(2 * pi * 6 * t)) if wag else 12 * sin(2 * pi * 2 * t)
        r['Tail1'] = (0, w, 0); r['Tail2'] = (0, w, 0)
        r['Ear.L'] = (-18 * bump(t, 0.4), 0, 0); r['Ear.R'] = (-18 * bump(t, 0.8), 0, 0)
        return r, (0, 0, 0)

    # 엉덩이 바닥: Hips 점들을 θ 만큼 돌렸을 때 가장 낮은 점
    def rump_low(th):
        if hipverts is None or not len(hipverts): return hz * 0.5
        c, s = math.cos(th * D2R), math.sin(th * D2R)
        vy = hipverts[:, 1] - hy; vz = hipverts[:, 2] - hz
        return (hz + vy * s + vz * c).min()

    ft = F['top']; flen = ft[1] - F['foot'][1]
    sit_kind = S['sit']
    if sit_kind == 'dog':
        th, d = -30.0, hz * 0.4
        for _ in range(8):
            d = rump_low(th) - 0.01 * sz
            vy, vz = ft[0] - hy, ft[1] - hz
            th = bisect(lambda a: (hz - d + vy * math.sin(a * D2R) + vz * math.cos(a * D2R) - flen) - F['foot'][1], -85.0, 0.0)
        th_sit, d_sit = th, d
        def sit(t):
            r = {'Hips': (th_sit, 0, 0), 'FL_Upper': (-th_sit, 0, 0), 'FR_Upper': (-th_sit, 0, 0),
                 'BL_Upper': (-62 - th_sit, 0, 0), 'BR_Upper': (-62 - th_sit, 0, 0), 'BL_Lower': (135, 0, 0), 'BR_Lower': (135, 0, 0),
                 'Neck': (-th_sit * 0.55, 0, 0), 'Head': (-th_sit * 0.35, 0, 0), 'Tail1': (35, 0, 0)}
            return idle_overlay(r, t, 0.8), (0, 0, -d_sit)
    elif sit_kind == 'upright':
        th_sit = -66.0
        d_sit = rump_low(th_sit) - 0.02 * sz
        def sit(t):
            m = sin(2 * pi * 2 * t)
            r = {'Hips': (th_sit, 0, 0), 'BL_Upper': (-84 - th_sit, -8, 0), 'BR_Upper': (-84 - th_sit, 8, 0),
                 'BL_Lower': (12, 0, 0), 'BR_Lower': (12, 0, 0),
                 'FL_Upper': (-38 - th_sit + 10 * m, -12, 0), 'FR_Upper': (-38 - th_sit - 10 * m, 12, 0),
                 'FL_Lower': (-105 - 8 * m, 0, 0), 'FR_Lower': (-105 + 8 * m, 0, 0),
                 'Neck': (-th_sit * 0.62, 0, 0), 'Head': (20 + 6 * sin(2 * pi * 4 * t), 6 * sin(2 * pi * t), 0), 'Tail1': (40, 0, 0)}
            return idle_overlay(r, t, 0.3, tail=False), (0, 0, -d_sit)
    elif sit_kind == 'loaf':
        def sit(t):
            r = {'FL_Upper': (-25, 0, 0), 'FR_Upper': (-25, 0, 0), 'FL_Lower': (55, 0, 0), 'FR_Lower': (55, 0, 0),
                 'BL_Upper': (-15, 0, 0), 'BR_Upper': (-15, 0, 0), 'BL_Lower': (30, 0, 0), 'BR_Lower': (30, 0, 0),
                 'Head': (3 * sin(2 * pi * 12 * t), 0, 0)}
            return idle_overlay(r, t, 0.6), (0, 0, -0.022 * sz / 0.25 * 0.25)
    else:   # lie: 다리를 접고 배를 땅에
        d_lie = flen * 0.82
        def sit(t):
            r = {'FL_Upper': (78, 0, 0), 'FR_Upper': (78, 0, 0), 'FL_Lower': (-150, 0, 0), 'FR_Lower': (-150, 0, 0),
                 'BL_Upper': (-70, 0, 0), 'BR_Upper': (-70, 0, 0), 'BL_Lower': (140, 0, 0), 'BR_Lower': (140, 0, 0),
                 'Neck': (-12, 0, 0), 'Head': (8 + 3 * sin(2 * pi * 4 * t), 0, 0)}
            return idle_overlay(r, t, 0.7), (0, 0, -d_lie)

    def stand(t):
        e = sstep(0.0, 0.22, t) * (1 - sstep(0.80, 1.0, t))
        th = -72 * e if not hop else -60 * e
        r = {'Hips': (th, 0, 0), 'BL_Upper': (-th * 0.95, 0, 0), 'BR_Upper': (-th * 0.95, 0, 0),
             'Neck': (-th * 0.62, 0, 0), 'Head': (-th * 0.2, 0, 0), 'Tail1': (-th * 0.4, 0, 0)}
        if hop:
            r['FL_Upper'] = (-th * 0.5, 0, 0); r['FR_Upper'] = (-th * 0.5, 0, 0)
            r['FL_Lower'] = (45 * e, 0, 0); r['FR_Lower'] = (45 * e, 0, 0)
            r['Neck'] = (-th * 0.7, 25 * e * sin(2 * pi * 2 * t), 0)
            r['Ear.L'] = (-10 * e, 0, 0); r['Ear.R'] = (-10 * e, 0, 0)
        else:
            w = sin(2 * pi * 5 * t)
            roar = bump(t, 0.45, 0.12)
            r['FL_Upper'] = (-75 * e, 0, (-30 + 28 * w) * e); r['FL_Lower'] = (-35 * e, 0, 0)
            r['FR_Upper'] = (-25 * e, 0, 10 * e); r['FR_Lower'] = (-20 * e, 0, 0)
            r['Head'] = (-th * 0.2 - 22 * roar * e, 10 * e * sin(2 * pi * 3 * t), 0)
            r['Ear.L'] = (30 * roar, 0, 0); r['Ear.R'] = (30 * roar, 0, 0)
        return r, (0, 0, 0.02 * sz * e)

    clips = [('Idle', 72, idle, True), ('Walk', 24, walk, True), ('Run', 16 if not hop else 14, run, True),
             ('Eat', 48, eat, True), ('Sit', 48, sit, True)]
    if S.get('stand'): clips.append(('Stand', 72, stand, False))
    return clips

# ───────────────────────────────────────────── 한 종 만들기
def build(nm, export=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = lib.FPS
    S, B = species.SPECIES[nm]()
    sz = S['size']
    hi = lib.metaball_mesh(B, sz * float(os.environ.get('ANIMAL_HIRES', '0.007')), nm + "_hi")
    lib.vertex_colors(B, hi.data)
    lo = lib.metaball_mesh(B, sz * 0.011, nm)
    tris = lib.decimate(lo, S['tris'])
    for ca in list(lo.data.color_attributes): lo.data.color_attributes.remove(ca)
    lib.bake_albedo(hi, lo, nm, S.get('tex', 512), fur=S.get('fur', 0.16), fur_scale=S.get('fur_scale', 90.0) / sz)
    bpy.data.objects.remove(hi)

    # 단단한 부품: 눈·눈 반짝이·뿔·엄니 (모두 Head 에 100%)
    verts, faces, fmat = [], [], []
    mats = []
    def add(kind, vs, fs):
        if kind not in mats: mats.append(kind)
        o = len(verts); verts.extend(vs); faces.extend([tuple(i + o for i in f) for f in fs]); fmat.extend([mats.index(kind)] * len(fs))
    e = S['eye']; hc = Vector((0, *S['head']['c']))
    for sx in (1, -1):
        t = Vector((sx * e['t'][0], e['t'][1], e['t'][2]))
        d = (t - hc).normalized()
        sp = lib.surface_point(B, hc, d)
        c = sp - d * e['r'] * 0.42
        add('Eye', *lib.uv_sphere(c, e['r'], 12, 8))
        side = Vector((sx, 0, 0))
        sh = c + (d * 0.78 + Vector((0, 0, 0.42)) + side * 0.0) .normalized() * e['r'] * 0.93
        add('Shine', *lib.uv_sphere(sh, e['r'] * 0.26, 6, 4))
    for kind, (vs, fs), bone in S.get('extras', []): add(kind, vs, fs)
    me = bpy.data.meshes.new(nm + "_parts"); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    for i, p in enumerate(me.polygons): p.material_index = fmat[i]; p.use_smooth = True
    MAT = dict(Eye=(e['col'], 0.12, 0), Shine=((1, 1, 1), 0.3, 2.0), Horn=((0.62, 0.52, 0.38), 0.6, 0), Tusk=((0.88, 0.85, 0.76), 0.45, 0))
    for k in mats:
        col, rough, emi = MAT[k]
        me.materials.append(lib.mat_plain(f"{nm}_{k}", col, rough, emi))
    parts = bpy.data.objects.new(nm + "_parts", me); sc.collection.objects.link(parts)
    tris += len(me.polygons) * 2

    bones = species.bones_from(S)
    arm = lib.build_armature(bones, nm)
    lib.skin_weights(B, lo, bones)
    g = parts.vertex_groups.new(name='Head'); g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    for o in (lo, parts):
        o.parent = arm
        m = o.modifiers.new("Armature", 'ARMATURE'); m.object = arm

    # Hips 에 주로 붙은 점 (앉을 때 엉덩이 바닥 계산)
    gi = lo.vertex_groups['Hips'].index
    hv = []
    for v in lo.data.vertices:
        for gg in v.groups:
            if gg.group == gi and gg.weight > 0.5: hv.append(v.co[:])
    hv = np.array(hv)
    clips = make_clips(S, hv)
    lib.bake_actions(arm, clips)
    sc.frame_start = 0; sc.frame_end = 72
    info = dict(name=nm, tris=tris, height=round(max(v.co.z for v in lo.data.vertices), 3),
                length=round(lo.dimensions.y, 3), clips=[c[0] for c in clips])
    # 걸음·뜀 기준 속도(타임스케일 1에서 발이 미끄러지지 않는 속도, m/s)
    Lb = S['back']['top'][1] - S['back']['foot'][1]
    if S['gait'] == 'hop':
        info['walkRef'] = round(2 * Lb * math.sin(18 * D2R) / (0.55 * 1.0) * 1.6, 2)
        info['runRef'] = round(2 * Lb * math.sin(34 * D2R) / (0.42 * 14 / 24) * 1.8, 2)
    else:
        info['walkRef'] = round(2 * Lb * math.sin(S.get('walk_A', 22) * D2R) / (0.62 * 1.0), 2)
        info['runRef'] = round(2 * Lb * math.sin(S.get('run_A', 40) * D2R) / (0.40 * 16 / 24), 2)
    print("INFO", json.dumps(info))
    os.makedirs(lib.OUT_SRC, exist_ok=True)
    if export:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lib.OUT_SRC, f"animal-{nm}.blend"))
        glb = lib.export_glb(nm)
        print("BUILT", nm, "tris", tris, "bytes", os.path.getsize(glb))
    return info

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for nm in (argv or list(species.SPECIES)):
        build(nm)
