# 동물 9종 정의 — 메타볼 원소(표면 크기, m) + 칠하기 + 뼈 위치 + 동작 성격.
# 좌표는 Blender: 앞 = -Y, 위 = +Z, 왼쪽 = +X. 점 (y, z) 는 몸 가운데(x=0) 기준.
import math
import numpy as np
from mathutils import Vector
from lib import Body, KF, hexc, tube, D2R

def ear(B, base, tip, w, t, col, bone='Ear.L', mirror=True):
    base, tip = Vector(base), Vector(tip)
    d = tip - base; L = d.length
    q = d.normalized().to_track_quat('Z', 'Y')
    rr = (w, t, L / 2); m = max(rr)
    B._add('ELLIPSOID', (base + tip) / 2, m / KF, tuple(x / m for x in rr), q, bone, hexc(col) if isinstance(col, str) else col, mirror)

def quad(S):
    """공통 네발 동물 몸."""
    B = Body(); C = S['col']
    body = C['body']
    B.ell((0, *S['rump']['c']), S['rump']['rr'], 'Hips', C.get('rump', body))
    B.ell((0, *S['belly']['c']), S['belly']['rr'], 'Hips', C.get('belly_el', body))
    B.ell((0, *S['chest']['c']), S['chest']['rr'], 'Chest', C.get('chest', body))
    n = S['neck']
    B.chain([(0, *p) for p in n['pts']], n['r'], 'Neck', C.get('neck', body))
    h = S['head']
    B.ell((0, *h['c']), h['rr'], 'Head', C.get('head', body))
    if 'cheek' in S: B.ball(S['cheek']['c'], S['cheek']['r'], 'Head', C.get('cheek', C.get('head', body)))
    s = S['snout']
    B.chain([(0, *s['a']), (0, *s['b'])], s['r'], 'Head', C.get('snout', C.get('head', body)), steps=2)
    no = S['nose']
    B.ell((0, *no['c']), no['rr'], 'Head', C.get('nose', '#1b1716'))
    e = S['ear']
    ear(B, e['base'], e['tip'], e['w'], e['t'], C.get('ear', body))
    for pre, key in (('FL', 'front'), ('BL', 'back')):
        Lg = S[key]; x = Lg['x']
        pts = [(x, *Lg['top']), (x, *Lg['knee']), (x, *Lg['foot'])]
        B.chain(pts, Lg['r'], [pre + '_Upper', pre + '_Lower'], C.get('leg', body), steps=4)
        py, pz = Lg['foot'][0] + Lg.get('paw_dy', -0.15 * Lg['paw'][1]), Lg['paw'][2]
        B.ell((x, py, pz), Lg['paw'], pre + '_Lower', C.get('paw', C.get('leg', body)))
    t = S['tail']
    B.chain([(0, *p) for p in t['pts']], t['r'], ['Tail1' if i < len(t['pts']) // 2 else 'Tail2' for i in range(len(t['pts']) - 1)], C.get('tail', body), steps=t.get('steps', 2))
    return B

def bones_from(S):
    hy, hz = S['hip']; sy, sz = S['sh']
    my, mz = (hy + sy) / 2, (hz + sz) / 2 + 0.02 * S['size']
    n = S['neck']['pts']; h0 = n[-1]
    no = S['nose']['c']
    b = {}
    b['Root'] = ((0, 0, 0), (0, 0, 0.15 * S['size']), None)
    b['Hips'] = ((0, hy, hz), (0, my, mz), 'Root')
    b['Chest'] = ((0, my, mz), (0, sy, sz), 'Hips')
    b['Neck'] = ((0, *n[0]), (0, *h0), 'Chest')
    b['Head'] = ((0, *h0), (0, *no), 'Neck')
    tp = S['tail']['pts']; tm = tp[len(tp) // 2]
    b['Tail1'] = ((0, *tp[0]), (0, *tm), 'Hips')
    b['Tail2'] = ((0, *tm), (0, *tp[-1]), 'Tail1')
    e = S['ear']
    b['Ear.L'] = (e['base'], e['tip'], 'Head')
    b['Ear.R'] = ((-e['base'][0], *e['base'][1:]), (-e['tip'][0], *e['tip'][1:]), 'Head')
    for pre, key, par in (('F', 'front', 'Chest'), ('B', 'back', 'Hips')):
        Lg = S[key]; x = Lg['x']
        for side, sx in (('L', 1), ('R', -1)):
            b[f'{pre}{side}_Upper'] = ((sx * x, *Lg['top']), (sx * x, *Lg['knee']), par)
            b[f'{pre}{side}_Lower'] = ((sx * x, *Lg['knee']), (sx * x, *Lg['foot']), f'{pre}{side}_Upper')
    return b

def underside(light, z0, z1, ymin=-9, ymax=9, xw=None, zmin=None):
    """배 쪽을 밝게: 높이 z0..z1 사이에서 섞는다(아래가 밝다)."""
    L = np.array(hexc(light))
    def f(P, C, info):
        t = np.clip((z1 - P[:, 2]) / max(z1 - z0, 1e-4), 0, 1)
        t = t * t * (3 - 2 * t)
        m = ((P[:, 1] > ymin) & (P[:, 1] < ymax)).astype(float)
        if xw is not None: m *= np.clip(1 - np.abs(P[:, 0]) / xw, 0, 1) ** 0.5
        if zmin is not None: m *= np.clip((info['torso'] - 0.35) / 0.4, 0, 1)   # 다리는 빼고 몸통만
        k = (t * m)[:, None]
        return C * (1 - k) + L[None, :] * k
    return f

# ═══════════════════════════════════════════════ 종별
def panda():
    S = dict(size=1.0, hip=(0.36, 0.52), sh=(-0.34, 0.56),
             rump=dict(c=(0.33, 0.55), rr=(0.30, 0.30, 0.31)),
             belly=dict(c=(0.0, 0.55), rr=(0.33, 0.36, 0.31)),
             chest=dict(c=(-0.30, 0.60), rr=(0.31, 0.29, 0.32)),
             neck=dict(pts=[(-0.46, 0.68), (-0.60, 0.80)], r=[0.22, 0.20]),
             head=dict(c=(-0.74, 0.86), rr=(0.26, 0.23, 0.235)),
             cheek=dict(c=(0.13, -0.80, 0.79), r=0.12),
             snout=dict(a=(-0.88, 0.80), b=(-0.99, 0.785), r=(0.10, 0.075)),
             nose=dict(c=(-1.045, 0.805), rr=(0.045, 0.028, 0.03)),
             ear=dict(base=(0.15, -0.68, 1.03), tip=(0.20, -0.67, 1.12), w=0.075, t=0.04),
             front=dict(x=0.19, top=(-0.34, 0.50), knee=(-0.36, 0.28), foot=(-0.38, 0.08), r=(0.14, 0.12, 0.11), paw=(0.11, 0.13, 0.07)),
             back=dict(x=0.18, top=(0.38, 0.46), knee=(0.42, 0.27), foot=(0.40, 0.08), r=(0.15, 0.125, 0.11), paw=(0.11, 0.13, 0.07)),
             tail=dict(pts=[(0.62, 0.64), (0.67, 0.62), (0.70, 0.59)], r=[0.07, 0.07, 0.05]),
             col=dict(body='#f1eee6', leg='#1f1e23', ear='#1f1e23', nose='#141316'),
             eye=dict(t=(0.105, -0.98, 0.885), r=0.024, col=(0.05, 0.035, 0.03)),
             gait='quad', sit='upright', stand=True, tex=1024, tris=5200, speed=(0.6, 2.4), eat_max=62)
    B = quad(S)
    B.paint((0, -0.31, 0.56), (0.44, 0.23, 0.50), '#1f1e23', soft=0.2)
    B.paint((0.19, -0.33, 0.42), (0.15, 0.17, 0.24), '#1f1e23', soft=0.3)           # 어깨 띠
    B.paint((0.105, -0.95, 0.86), (0.055, 0.06, 0.085), '#1f1e23', soft=0.3, rot=(0, -28, 0))   # 눈 무늬
    return S, B

def bear():
    S = dict(size=1.3, hip=(0.50, 0.72), sh=(-0.45, 0.78),
             rump=dict(c=(0.46, 0.78), rr=(0.36, 0.36, 0.37)),
             belly=dict(c=(0.0, 0.76), rr=(0.40, 0.48, 0.40)),
             chest=dict(c=(-0.40, 0.84), rr=(0.38, 0.36, 0.41)),
             neck=dict(pts=[(-0.62, 0.92), (-0.80, 1.00)], r=[0.27, 0.22]),
             head=dict(c=(-0.95, 1.03), rr=(0.245, 0.25, 0.23)),
             cheek=dict(c=(0.12, -0.98, 0.97), r=0.12),
             snout=dict(a=(-1.10, 0.98), b=(-1.25, 0.955), r=(0.12, 0.085)),
             nose=dict(c=(-1.315, 0.975), rr=(0.05, 0.033, 0.035)),
             ear=dict(base=(0.15, -0.90, 1.21), tip=(0.19, -0.89, 1.29), w=0.07, t=0.04),
             front=dict(x=0.24, top=(-0.45, 0.70), knee=(-0.47, 0.38), foot=(-0.49, 0.08), r=(0.17, 0.145, 0.13), paw=(0.13, 0.16, 0.08)),
             back=dict(x=0.23, top=(0.50, 0.64), knee=(0.55, 0.36), foot=(0.52, 0.08), r=(0.18, 0.145, 0.13), paw=(0.13, 0.16, 0.08)),
             tail=dict(pts=[(0.82, 0.86), (0.86, 0.84), (0.88, 0.81)], r=[0.07, 0.065, 0.05]),
             col=dict(body='#6e4a2c', leg='#4d321e', paw='#3e2817', snout='#b38c63', ear='#5a3c24', nose='#16110f'),
             eye=dict(t=(0.10, -1.14, 1.075), r=0.022, col=(0.04, 0.025, 0.02)),
             gait='quad', sit='dog', stand=True, tex=1024, tris=5200, speed=(0.8, 3.6), eat_max=65)
    B = quad(S)
    B.ball((0, -0.38, 1.08), 0.25, 'Chest', '#6a4629')   # 어깨 혹
    B.paint((0, -0.30, 1.15), (0.30, 0.40, 0.16), '#7d5634', soft=0.6)
    B.fpaints.append(underside('#5a3b22', 0.45, 0.70, -0.7, 0.8))
    return S, B

def deer():
    S = dict(size=1.2, hip=(0.42, 0.95), sh=(-0.38, 1.00),
             rump=dict(c=(0.38, 0.99), rr=(0.20, 0.24, 0.22)),
             belly=dict(c=(0.0, 0.98), rr=(0.205, 0.42, 0.215)),
             chest=dict(c=(-0.34, 1.02), rr=(0.20, 0.24, 0.25)),
             neck=dict(pts=[(-0.42, 1.12), (-0.52, 1.32), (-0.58, 1.47)], r=[0.13, 0.09, 0.075]),
             head=dict(c=(-0.64, 1.53), rr=(0.095, 0.12, 0.095)),
             snout=dict(a=(-0.73, 1.49), b=(-0.84, 1.43), r=(0.06, 0.042)),
             nose=dict(c=(-0.875, 1.43), rr=(0.03, 0.022, 0.025)),
             ear=dict(base=(0.065, -0.60, 1.60), tip=(0.17, -0.585, 1.68), w=0.045, t=0.014),
             front=dict(x=0.12, top=(-0.36, 0.90), knee=(-0.38, 0.48), foot=(-0.38, 0.05), r=(0.075, 0.042, 0.032), paw=(0.032, 0.042, 0.04), paw_dy=-0.005),
             back=dict(x=0.115, top=(0.42, 0.88), knee=(0.49, 0.50), foot=(0.44, 0.05), r=(0.10, 0.048, 0.032), paw=(0.032, 0.042, 0.04), paw_dy=-0.005),
             tail=dict(pts=[(0.58, 1.07), (0.63, 1.02), (0.65, 0.96)], r=[0.045, 0.04, 0.03]),
             col=dict(body='#9b6a3d', leg='#8a5c33', paw='#2a1f18', ear='#8d6038', snout='#8a5c35', nose='#1b1512', tail='#9b6a3d'),
             eye=dict(t=(0.075, -0.71, 1.555), r=0.019, col=(0.04, 0.025, 0.02)),
             gait='quad', sit='lie', tex=1024, tris=5200, speed=(0.9, 5.5))
    B = quad(S)
    B.fpaints.append(underside('#efe5d4', 0.78, 0.92, -0.45, 0.55, zmin=0.74))
    B.paint((0, -0.79, 1.44), (0.06, 0.08, 0.05), '#e9dfcf', soft=0.5)    # 하얀 주둥이 아래
    B.paint((0, -0.50, 1.24), (0.07, 0.07, 0.09), '#efe5d4', soft=0.5)    # 목 앞 흰 무늬
    B.paint((0, 0.60, 1.00), (0.13, 0.08, 0.14), '#f3ece0', soft=0.4)     # 엉덩이 흰 무늬
    B.paint((0, -0.62, 1.565), (0.07, 0.05, 0.04), '#7a5030', soft=0.6)   # 이마
    # 뿔 (Head 고정)
    beam = [(0.045, -0.615, 1.62), (0.10, -0.60, 1.76), (0.17, -0.55, 1.90), (0.20, -0.48, 2.00), (0.19, -0.42, 2.06)]
    tines = [
        ([(0.10, -0.60, 1.76), (0.09, -0.69, 1.83), (0.09, -0.72, 1.89)], [0.014, 0.010, 0.006]),
        ([(0.17, -0.55, 1.90), (0.15, -0.63, 1.98), (0.14, -0.64, 2.05)], [0.013, 0.009, 0.005]),
        ([(0.20, -0.48, 2.00), (0.25, -0.50, 2.07), (0.27, -0.50, 2.12)], [0.012, 0.008, 0.005]),
    ]
    extras = []
    for sx in (1, -1):
        m = lambda pts: [(sx * p[0], p[1], p[2]) for p in pts]
        extras.append(('Horn', tube(m(beam), [0.020, 0.017, 0.014, 0.010, 0.005], 7), 'Head'))
        for pts, rr in tines: extras.append(('Horn', tube(m(pts), rr, 6), 'Head'))
    S['extras'] = extras
    return S, B

def fox():
    S = dict(size=0.5, hip=(0.20, 0.36), sh=(-0.20, 0.38),
             rump=dict(c=(0.20, 0.37), rr=(0.11, 0.13, 0.12)),
             belly=dict(c=(0.0, 0.36), rr=(0.105, 0.22, 0.105)),
             chest=dict(c=(-0.18, 0.39), rr=(0.115, 0.13, 0.13)),
             neck=dict(pts=[(-0.24, 0.44), (-0.30, 0.52)], r=[0.085, 0.075]),
             head=dict(c=(-0.36, 0.555), rr=(0.095, 0.085, 0.08)),
             cheek=dict(c=(0.06, -0.375, 0.52), r=0.038),
             snout=dict(a=(-0.42, 0.535), b=(-0.525, 0.515), r=(0.04, 0.021)),
             nose=dict(c=(-0.548, 0.52), rr=(0.016, 0.012, 0.013)),
             ear=dict(base=(0.05, -0.34, 0.61), tip=(0.085, -0.34, 0.73), w=0.042, t=0.012),
             front=dict(x=0.065, top=(-0.19, 0.33), knee=(-0.20, 0.18), foot=(-0.21, 0.03), r=(0.045, 0.027, 0.021), paw=(0.024, 0.034, 0.02)),
             back=dict(x=0.065, top=(0.20, 0.32), knee=(0.25, 0.18), foot=(0.22, 0.03), r=(0.055, 0.03, 0.021), paw=(0.024, 0.034, 0.02)),
             tail=dict(pts=[(0.29, 0.40), (0.42, 0.35), (0.56, 0.27), (0.66, 0.22)], r=[0.04, 0.075, 0.075, 0.035], steps=2),
             col=dict(body='#d8732a', leg='#2b1e18', ear='#d06a25', snout='#d8732a', nose='#151110'),
             eye=dict(t=(0.045, -0.435, 0.578), r=0.013, col=(0.10, 0.06, 0.02)),
             gait='quad', sit='dog', tex=512, tris=4800, speed=(0.8, 5.0))
    B = quad(S)
    B.fpaints.append(underside('#f4ede3', 0.31, 0.36, -0.30, 0.10, zmin=0.285))
    B.paint((0, -0.25, 0.40), (0.07, 0.09, 0.09), '#f4ede3', soft=0.5)    # 가슴
    B.paint((0, -0.46, 0.505), (0.075, 0.10, 0.03), '#f4ede3', soft=0.6)  # 주둥이 아래·볼
    B.paint((0, 0.66, 0.22), (0.07, 0.07, 0.07), '#f6f1ea', soft=0.4)     # 꼬리 끝
    B.paint((0.08, -0.33, 0.72), (0.03, 0.03, 0.035), '#2b1e18', soft=0.6)  # 귀 끝
    B.paint((0.065, -0.22, 0.16), (0.04, 0.05, 0.10), '#2b1e18', soft=0.5)
    return S, B

def rabbit():
    S = dict(size=0.25, hip=(0.07, 0.12), sh=(-0.07, 0.11),
             rump=dict(c=(0.065, 0.13), rr=(0.09, 0.10, 0.10)),
             belly=dict(c=(0.0, 0.12), rr=(0.08, 0.11, 0.085)),
             chest=dict(c=(-0.07, 0.13), rr=(0.07, 0.07, 0.075)),
             neck=dict(pts=[(-0.09, 0.16), (-0.11, 0.19)], r=[0.05, 0.045]),
             head=dict(c=(-0.13, 0.215), rr=(0.055, 0.06, 0.052)),
             cheek=dict(c=(0.033, -0.15, 0.195), r=0.03),
             snout=dict(a=(-0.165, 0.205), b=(-0.183, 0.20), r=(0.025, 0.02)),
             nose=dict(c=(-0.197, 0.205), rr=(0.008, 0.006, 0.006)),
             ear=dict(base=(0.022, -0.12, 0.255), tip=(0.042, -0.095, 0.375), w=0.026, t=0.008),
             front=dict(x=0.03, top=(-0.07, 0.09), knee=(-0.08, 0.05), foot=(-0.085, 0.012), r=(0.02, 0.014, 0.012), paw=(0.012, 0.02, 0.01)),
             back=dict(x=0.045, top=(0.07, 0.10), knee=(0.10, 0.045), foot=(0.06, 0.012), r=(0.045, 0.025, 0.015), paw=(0.018, 0.045, 0.012), paw_dy=-0.02),
             tail=dict(pts=[(0.15, 0.15), (0.165, 0.15), (0.175, 0.15)], r=[0.025, 0.03, 0.02]),
             col=dict(body='#9d8b78', leg='#a6957f', ear='#8f7d6a', tail='#f6f2ec', nose='#c98b8b'),
             eye=dict(t=(0.04, -0.162, 0.222), r=0.011, col=(0.03, 0.02, 0.02)),
             gait='hop', sit='loaf', stand=True, tex=512, tris=4000, speed=(0.5, 4.5))
    B = quad(S)
    B.fpaints.append(underside('#ece4d8', 0.05, 0.10, zmin=0))
    B.paint((0.032, -0.105, 0.31), (0.012, 0.012, 0.05), '#e3a9a6', soft=0.6, rot=(-12, 0, -10))   # 귀 안쪽
    return S, B

def sheep():
    S = dict(size=0.9, hip=(0.30, 0.55), sh=(-0.28, 0.57),
             rump=dict(c=(0.26, 0.62), rr=(0.29, 0.28, 0.29)),
             belly=dict(c=(0.0, 0.62), rr=(0.30, 0.34, 0.30)),
             chest=dict(c=(-0.27, 0.64), rr=(0.28, 0.25, 0.30)),
             neck=dict(pts=[(-0.42, 0.74), (-0.52, 0.81)], r=[0.15, 0.10]),
             head=dict(c=(-0.61, 0.84), rr=(0.095, 0.125, 0.105)),
             snout=dict(a=(-0.69, 0.79), b=(-0.75, 0.76), r=(0.06, 0.05)),
             nose=dict(c=(-0.795, 0.765), rr=(0.02, 0.012, 0.016)),
             ear=dict(base=(0.07, -0.58, 0.865), tip=(0.18, -0.585, 0.835), w=0.042, t=0.016),
             front=dict(x=0.15, top=(-0.28, 0.48), knee=(-0.29, 0.26), foot=(-0.30, 0.04), r=(0.07, 0.038, 0.032), paw=(0.035, 0.045, 0.035), paw_dy=-0.005),
             back=dict(x=0.14, top=(0.30, 0.48), knee=(0.34, 0.26), foot=(0.30, 0.04), r=(0.08, 0.04, 0.032), paw=(0.035, 0.045, 0.035), paw_dy=-0.005),
             tail=dict(pts=[(0.52, 0.66), (0.56, 0.60), (0.57, 0.53)], r=[0.07, 0.06, 0.045]),
             col=dict(body='#ede4d0', neck='#ede4d0', head='#3d332d', snout='#3d332d', nose='#120f0e', ear='#2f2723', leg='#2f2723', paw='#171311'),
             eye=dict(t=(0.075, -0.665, 0.865), r=0.016, col=(0.05, 0.04, 0.02)),
             gait='quad', sit='lie', tex=512, tris=5600, speed=(0.6, 3.2))
    B = quad(S)
    # 양털 뭉치: 몸 타원체 겉에 작은 공
    import random
    rnd = random.Random(7)
    for i in range(70):
        u, v = rnd.uniform(0, 2 * math.pi), rnd.uniform(-0.85, 1.0)
        y = 0.62 * rnd.uniform(-1, 1)
        rz = 0.28 * math.sqrt(max(0.0, 1 - (y / 0.62) ** 2))
        ang = rnd.uniform(-1.6, 1.6)
        x, z = math.sin(ang) * (rz + 0.04), 0.63 + math.cos(ang) * (rz + 0.02)
        if z < 0.45: continue
        B.ball((x, y - 0.02, z), rnd.uniform(0.075, 0.10), 'Hips' if y > -0.08 else 'Chest', '#efe7d4', mirror=False)
    B.ball((0, -0.58, 0.93), 0.075, 'Head', '#ece2cc')      # 이마 털
    B.paint((0.15, -0.28, 0.47), (0.10, 0.10, 0.07), '#ede4d0', soft=0.5)   # 다리 위쪽은 털
    B.paint((0.14, 0.30, 0.47), (0.10, 0.10, 0.07), '#ede4d0', soft=0.5)
    return S, B

def boar():
    S = dict(size=0.9, hip=(0.32, 0.52), sh=(-0.26, 0.58),
             rump=dict(c=(0.30, 0.53), rr=(0.19, 0.21, 0.20)),
             belly=dict(c=(0.02, 0.54), rr=(0.24, 0.36, 0.25)),
             chest=dict(c=(-0.24, 0.63), rr=(0.26, 0.26, 0.32)),
             neck=dict(pts=[(-0.40, 0.63), (-0.50, 0.62)], r=[0.22, 0.19]),
             head=dict(c=(-0.56, 0.60), rr=(0.15, 0.17, 0.17)),
             snout=dict(a=(-0.66, 0.53), b=(-0.78, 0.47), r=(0.10, 0.075)),
             nose=dict(c=(-0.815, 0.465), rr=(0.07, 0.024, 0.06)),
             ear=dict(base=(0.09, -0.50, 0.73), tip=(0.15, -0.47, 0.86), w=0.056, t=0.016),
             front=dict(x=0.14, top=(-0.26, 0.45), knee=(-0.27, 0.24), foot=(-0.28, 0.04), r=(0.10, 0.052, 0.04), paw=(0.04, 0.05, 0.04), paw_dy=-0.005),
             back=dict(x=0.13, top=(0.32, 0.42), knee=(0.36, 0.24), foot=(0.32, 0.04), r=(0.11, 0.052, 0.04), paw=(0.04, 0.05, 0.04), paw_dy=-0.005),
             tail=dict(pts=[(0.50, 0.62), (0.55, 0.54), (0.56, 0.45)], r=[0.022, 0.016, 0.02]),
             col=dict(body='#4e3d32', leg='#3a2d25', paw='#181210', snout='#5e4a40', nose='#6d5550', ear='#3a2d25', tail='#2a201b'),
             eye=dict(t=(0.095, -0.65, 0.66), r=0.016, col=(0.06, 0.03, 0.02)),
             gait='quad', sit='lie', tex=512, tris=5200, speed=(0.8, 4.5))
    B = quad(S)
    B.cap((0, -0.42, 0.91), (0, 0.05, 0.79), 0.08, 'Chest', '#2c221d')   # 갈기
    B.paint((0, -0.15, 0.86), (0.10, 0.45, 0.12), '#2c221d', soft=0.6)
    B.fpaints.append(underside('#6b5848', 0.35, 0.45, -0.3, 0.4))
    extras = []
    for sx in (1, -1):
        extras.append(('Tusk', tube([(sx * 0.07, -0.73, 0.45), (sx * 0.10, -0.765, 0.51), (sx * 0.115, -0.75, 0.58)], [0.019, 0.014, 0.004], 7), 'Head'))
    S['extras'] = extras
    return S, B

def dog():
    S = dict(size=0.55, hip=(0.22, 0.40), sh=(-0.22, 0.42),
             rump=dict(c=(0.21, 0.42), rr=(0.12, 0.14, 0.13)),
             belly=dict(c=(0.0, 0.41), rr=(0.12, 0.24, 0.12)),
             chest=dict(c=(-0.20, 0.44), rr=(0.13, 0.14, 0.15)),
             neck=dict(pts=[(-0.27, 0.50), (-0.33, 0.60)], r=[0.10, 0.085]),
             head=dict(c=(-0.38, 0.635), rr=(0.105, 0.10, 0.095)),
             cheek=dict(c=(0.06, -0.41, 0.60), r=0.042),
             snout=dict(a=(-0.45, 0.60), b=(-0.53, 0.585), r=(0.05, 0.034)),
             nose=dict(c=(-0.563, 0.595), rr=(0.022, 0.016, 0.018)),
             ear=dict(base=(0.055, -0.36, 0.70), tip=(0.072, -0.37, 0.80), w=0.042, t=0.014),
             front=dict(x=0.075, top=(-0.21, 0.38), knee=(-0.22, 0.20), foot=(-0.23, 0.03), r=(0.05, 0.031, 0.025), paw=(0.03, 0.04, 0.022)),
             back=dict(x=0.075, top=(0.22, 0.36), knee=(0.27, 0.20), foot=(0.24, 0.03), r=(0.06, 0.034, 0.025), paw=(0.03, 0.04, 0.022)),
             tail=dict(pts=[(0.32, 0.49), (0.37, 0.60), (0.30, 0.68), (0.24, 0.66)], r=[0.04, 0.045, 0.042, 0.03]),
             col=dict(body='#cf8645', paw='#f6efe4', ear='#c47b3c', nose='#141110'),
             eye=dict(t=(0.05, -0.465, 0.655), r=0.015, col=(0.06, 0.035, 0.02)),
             gait='quad', sit='dog', tex=512, tris=4800, speed=(0.9, 5.0), wag=True)
    B = quad(S)
    B.fpaints.append(underside('#f6efe4', 0.32, 0.39, -0.32, 0.18, zmin=0.30))
    B.paint((0, -0.26, 0.45), (0.08, 0.08, 0.11), '#f6efe4', soft=0.5)     # 가슴
    B.paint((0, -0.48, 0.575), (0.09, 0.09, 0.04), '#f6efe4', soft=0.5)   # 주둥이·볼
    B.paint((0.04, -0.46, 0.67), (0.018, 0.018, 0.012), '#f6efe4', soft=0.6)  # 눈썹 점
    B.paint((0, 0.30, 0.66), (0.06, 0.05, 0.04), '#f6efe4', soft=0.6)       # 꼬리 안쪽
    B.paint((0.075, -0.23, 0.07), (0.04, 0.05, 0.07), '#f6efe4', soft=0.5)
    B.paint((0.075, 0.24, 0.07), (0.04, 0.05, 0.07), '#f6efe4', soft=0.5)
    return S, B

def cat():
    S = dict(size=0.32, hip=(0.12, 0.21), sh=(-0.12, 0.22),
             rump=dict(c=(0.12, 0.22), rr=(0.07, 0.085, 0.075)),
             belly=dict(c=(0.0, 0.215), rr=(0.072, 0.15, 0.072)),
             chest=dict(c=(-0.11, 0.23), rr=(0.07, 0.08, 0.08)),
             neck=dict(pts=[(-0.15, 0.27), (-0.18, 0.32)], r=[0.05, 0.045]),
             head=dict(c=(-0.21, 0.345), rr=(0.07, 0.065, 0.06)),
             cheek=dict(c=(0.036, -0.24, 0.322), r=0.032),
             snout=dict(a=(-0.25, 0.327), b=(-0.268, 0.322), r=(0.024, 0.017)),
             nose=dict(c=(-0.281, 0.33), rr=(0.008, 0.006, 0.006)),
             ear=dict(base=(0.04, -0.20, 0.385), tip=(0.056, -0.205, 0.445), w=0.029, t=0.008),
             front=dict(x=0.04, top=(-0.11, 0.20), knee=(-0.12, 0.11), foot=(-0.125, 0.015), r=(0.03, 0.018, 0.015), paw=(0.016, 0.022, 0.012)),
             back=dict(x=0.04, top=(0.12, 0.19), knee=(0.15, 0.11), foot=(0.13, 0.015), r=(0.035, 0.02, 0.015), paw=(0.016, 0.022, 0.012)),
             tail=dict(pts=[(0.18, 0.25), (0.25, 0.32), (0.28, 0.42), (0.27, 0.50)], r=[0.021, 0.019, 0.018, 0.016]),
             col=dict(body='#e08f45', nose='#d48a8a', paw='#f4e9db'),
             eye=dict(t=(0.034, -0.272, 0.352), r=0.013, col=(0.25, 0.42, 0.08)),
             gait='quad', sit='dog', tex=512, tris=4400, speed=(0.6, 4.0), wag=False)
    B = quad(S)
    def stripes(P, C, info):
        dark = np.array(hexc('#b9662a'))
        s = 0.5 + 0.5 * np.sin(P[:, 1] * 95 + np.sin(P[:, 0] * 40) * 1.2)
        t = np.clip((s - 0.62) / 0.15, 0, 1) * np.clip((P[:, 2] - 0.17) / 0.05, 0, 1)
        head = P[:, 1] < -0.17
        t = np.where(head, np.clip((0.5 + 0.5 * np.sin(P[:, 0] * 120) - 0.6) / 0.15, 0, 1) * np.clip((P[:, 2] - 0.36) / 0.02, 0, 1), t)
        return C * (1 - t[:, None] * 0.8) + dark[None, :] * (t[:, None] * 0.8)
    B.fpaints.append(stripes)
    B.fpaints.append(underside('#f4e9db', 0.17, 0.21, -0.2, 0.08, zmin=0.155))
    B.paint((0, -0.27, 0.315), (0.035, 0.03, 0.02), '#f4e9db', soft=0.5)
    B.paint((0, -0.15, 0.25), (0.045, 0.06, 0.06), '#f4e9db', soft=0.5)
    return S, B

SPECIES = dict(panda=panda, bear=bear, deer=deer, fox=fox, rabbit=rabbit, sheep=sheep, boar=boar, dog=dog, cat=cat)
