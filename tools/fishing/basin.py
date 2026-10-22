# 연못 자리 찾기 — 지형 높이 격자에서 '둘레보다 안쪽이 낮은' 오목한 곳을 찾는다.
# python3 tools/fishing/basin.py
import json, math, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
d = json.load(open(os.path.join(ROOT, 'models/autumn-world.json')))
g = d['grid']; GX, GZ = g['nx'], g['nz']; HX, HZ = g['halfX'], g['halfZ']; st = g['step']
H = g['h']

def h(x, z):
    fx = min(GX - 1.001, max(0, (x + HX) / st)); fy = min(GZ - 1.001, max(0, (-z + HZ) / st))
    ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
    a = lambda i, j: H[j * GX + i]
    return (a(ix, iy) * (1 - tx) + a(ix + 1, iy) * tx) * (1 - ty) + (a(ix, iy + 1) * (1 - tx) + a(ix + 1, iy + 1) * tx) * ty

px = lambda z: d['path']['amp'] * math.sin(-d['path']['k'] * z)
stalls = [(s['x'], s['z']) for s in d['stalls']] + [(4.2, 42)]
res = []
for R in (3.5, 4.0, 4.5, 5.0):
    for z10 in range(-780, 780, 10):
        z = z10 / 10
        for x10 in range(-360, 361, 10):
            x = x10 / 10
            if abs(x - px(z)) < R + 3.5: continue
            if any(math.hypot(x - a, z - b) < R + 8 for a, b in stalls): continue
            if abs(z - d['stream']['z']) < R + 5: continue
            ring = [h(x + R * math.cos(t * math.pi / 24), z + R * math.sin(t * math.pi / 24)) for t in range(48)]
            L = min(ring) - 0.04
            inside = []
            for i in range(-10, 11):
                for j in range(-10, 11):
                    u, v = i / 10 * R, j / 10 * R
                    if u * u + v * v <= R * R * 0.98: inside.append(L - h(x + u, z + v))
            wet = sum(1 for s in inside if s > 0.03) / len(inside)
            depth = max(inside)
            res.append((round(wet * min(depth, 0.6), 3), R, x, z, round(L, 2), round(wet, 2), round(depth, 2)))
res.sort(reverse=True)
seen = []
for r in res:
    if any(math.hypot(r[2] - a, r[3] - b) < 12 for a, b in seen): continue
    seen.append((r[2], r[3])); print(r)
    if len(seen) > 18: break
