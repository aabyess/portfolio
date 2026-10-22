import json, sys

src, dst = sys.argv[1], sys.argv[2]
w = json.load(open(src))
g = w['grid']
n, step, half = g['n'], g['step'], g['half']


def samp(arr, x, z):
    fx = min(n - 1.001, max(0, (x + half) / step))
    fy = min(n - 1.001, max(0, (-z + half) / step))
    ix, iy = int(fx), int(fy)
    tx, ty = fx - ix, fy - iy
    h = lambda i, j: arr[j * n + i]
    return (h(ix, iy) * (1 - tx) + h(ix + 1, iy) * tx) * (1 - ty) + (h(ix, iy + 1) * (1 - tx) + h(ix + 1, iy + 1) * tx) * ty


NX, NZ, HX, HZ = n, 2 * (n - 1) + 1, half, 2 * half
H, M = [], []
for j in range(NZ):
    z = HZ - j * step
    for i in range(NX):
        x = -HX + i * step
        H.append(round(samp(g['h'], x, z / 2), 3))
        M.append(round(samp(g['mask'], x, z / 2), 2))
w['grid'] = {'n': NX, 'nx': NX, 'nz': NZ, 'step': step, 'half': HX, 'halfX': HX, 'halfZ': HZ, 'h': H, 'mask': M}
w['path']['k'] = w['path']['k'] / 2
b = w['bridge']; b['z0'] *= 2; b['z1'] *= 2
s = w['stream']; s['z'] *= 2; s['amp'] *= 2
w['start']['z'] *= 2
for st in w['stalls']:
    st['z'] = round(st['z'] * 2, 2)
w['stretchZ'] = 2
json.dump(w, open(dst, 'w'), separators=(',', ':'))
print('grid', NX, 'x', NZ, '\nstalls', w['stalls'], '\nstart', w['start'], '\nbridge', b, '\nstream', s, '\npath', w['path'])
