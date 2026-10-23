"""Plain-python glb reader: print node tree with TRS (glTF space), skins, animations.
usage: python3 gltf_nodes.py file.glb [--compare other.glb]"""
import json, struct, sys

def load(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, ver, length = struct.unpack('<III', data[:12])
    clen, ctype = struct.unpack('<II', data[12:20])
    return json.loads(data[20:20 + clen])

def world_positions(g):
    import math
    nodes = g['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): parent[c] = i
    def qrot(q, v):
        x, y, z, w = q
        # v' = q v q*
        ix = w * v[0] + y * v[2] - z * v[1]
        iy = w * v[1] + z * v[0] - x * v[2]
        iz = w * v[2] + x * v[1] - y * v[0]
        iw = -x * v[0] - y * v[1] - z * v[2]
        return (ix * w + iw * -x + iy * -z - iz * -y,
                iy * w + iw * -y + iz * -x - ix * -z,
                iz * w + iw * -z + ix * -y - iy * -x)
    def qmul(a, b):
        ax, ay, az, aw = a; bx, by, bz, bw = b
        return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)
    cache = {}
    def wt(i):
        if i in cache: return cache[i]
        n = nodes[i]
        t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
        if i in parent:
            pt, pr, ps = wt(parent[i])
            st = [t[k] * ps[k] for k in range(3)]
            rt = qrot(pr, st)
            res = ([pt[k] + rt[k] for k in range(3)], qmul(pr, r), [ps[k] * s[k] for k in range(3)])
        else:
            res = (t, r, s)
        cache[i] = res
        return res
    return {nodes[i].get('name', str(i)): wt(i)[0] for i in range(len(nodes))}

if __name__ == '__main__':
    g = load(sys.argv[1])
    nodes = g['nodes']
    if '--compare' in sys.argv:
        h = load(sys.argv[sys.argv.index('--compare') + 1])
        def bones(gg):
            js = set()
            for sk in gg.get('skins', []): js |= set(sk['joints'])
            return {gg['nodes'][j]['name']: gg['nodes'][j] for j in js}
        a, b = bones(g), bones(h)
        print("joints A", len(a), "B", len(b), "same names:", set(a) == set(b))
        print("only A", sorted(set(a) - set(b)), "only B", sorted(set(b) - set(a)))
        md = 0.0
        for n in set(a) & set(b):
            for key, dflt in (('translation', [0, 0, 0]), ('rotation', [0, 0, 0, 1]), ('scale', [1, 1, 1])):
                va, vb = a[n].get(key, dflt), b[n].get(key, dflt)
                d = max(abs(x - y) for x, y in zip(va, vb))
                if key == 'rotation':
                    d = min(d, max(abs(x + y) for x, y in zip(va, vb)))
                if d > 1e-4: print("  DIFF", n, key, va, vb)
                md = max(md, d)
        print("max TRS diff", md)
        an_a = sorted(x['name'] for x in g.get('animations', [])); an_b = sorted(x['name'] for x in h.get('animations', []))
        print("anims A", len(an_a), "B", len(an_b), "same:", an_a == an_b)
        if an_a != an_b: print(" A", an_a, "\n B", an_b)
        allnames_a = {n.get('name') for n in g['nodes']}; allnames_b = {n.get('name') for n in h['nodes']}
        print("node names only A", sorted(allnames_a - allnames_b, key=str), "only B", sorted(allnames_b - allnames_a, key=str))
        for x in g.get('animations', []):
            y = next((z for z in h.get('animations', []) if z['name'] == x['name']), None)
            if y:
                ta = sorted((g['nodes'][c['target']['node']]['name'], c['target']['path']) for c in x['channels'])
                tb = sorted((h['nodes'][c['target']['node']]['name'], c['target']['path']) for c in y['channels'])
                if ta != tb: print("  channels differ", x['name'], len(ta), len(tb), sorted(set(ta) ^ set(tb))[:8])
        sys.exit()
    wp = world_positions(g)
    for i, n in enumerate(nodes):
        print(i, n.get('name'), 'mesh' if 'mesh' in n else '', 'skin' if 'skin' in n else '', 'T', [round(x, 4) for x in n.get('translation', [0, 0, 0])],
              'R', [round(x, 4) for x in n.get('rotation', [0, 0, 0, 1])], 'S', [round(x, 4) for x in n.get('scale', [1, 1, 1])], 'W', [round(x, 3) for x in wp[n.get('name', str(i))]],
              'children', n.get('children', []))
    print('scenes', g.get('scenes'))
    print('skins', [(s.get('name'), len(s['joints']), s.get('skeleton')) for s in g.get('skins', [])])
    print('anims', [(a['name'], len(a['channels'])) for a in g.get('animations', [])])
    print('meshes', [(m.get('name'), len(m['primitives'])) for m in g.get('meshes', [])])
    print('extensionsUsed', g.get('extensionsUsed'))
