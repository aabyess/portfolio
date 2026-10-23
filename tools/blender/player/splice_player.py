"""Graft the new skinned mesh (from build_player.py) into a copy of person.glb.

Everything except the meshes is taken byte-for-byte from person.glb: node tree + default TRS (the
pose three.js shows for bones a clip does not animate), skin joint order + inverseBindMatrices, all
24 animation clips. The four Casual2_* mesh nodes are replaced by one node "Player_Body" that reuses
person.glb's skin 0. JOINTS_0 is remapped by bone name; positions/normals are converted to the
original mesh-node space (raw = Blender world / 100, Z up) if the exporter wrote another space.

usage: python3 splice_player.py person.glb player_mesh.glb out.glb
"""
import json, struct, sys, copy
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read_glb(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'glTF'
    off = 12; js = None; bin_ = b''
    while off < len(d):
        ln, ty = struct.unpack('<II', d[off:off + 8]); chunk = d[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(chunk)
        elif ty == 0x004E4942: bin_ = chunk
        off += 8 + ln
    return js, bin_

def acc_array(g, b, i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', dt.itemsize * n)
    raw = np.frombuffer(b, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=start)
    out = np.empty((a['count'], n), dtype=dt)
    for r in range(a['count']):
        out[r] = np.frombuffer(raw[r * stride: r * stride + dt.itemsize * n].tobytes(), dtype=dt)
    return out

class Out:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.accs = []
        self.vmemo = {}; self.amemo = {}
    def _pad(self):
        while len(self.bin) % 4: self.bin += b'\x00'
    def add_view(self, data, target=None, stride=None):
        self._pad()
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target: v['target'] = target
        if stride: v['byteStride'] = stride
        self.bin += data; self.views.append(v)
        return len(self.views) - 1
    def copy_view(self, key, g, b, vi):
        if (key, vi) in self.vmemo: return self.vmemo[(key, vi)]
        bv = g['bufferViews'][vi]; s = bv.get('byteOffset', 0)
        ni = self.add_view(bytes(b[s: s + bv['byteLength']]), bv.get('target'), bv.get('byteStride'))
        self.vmemo[(key, vi)] = ni
        return ni
    def copy_acc(self, key, g, b, ai):
        if (key, ai) in self.amemo: return self.amemo[(key, ai)]
        a = copy.deepcopy(g['accessors'][ai])
        assert 'sparse' not in a
        a['bufferView'] = self.copy_view(key, g, b, a['bufferView'])
        self.accs.append(a); self.amemo[(key, ai)] = len(self.accs) - 1
        return len(self.accs) - 1
    def new_acc(self, arr, ctype, typ, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr.astype(CT[ctype]))
        vi = self.add_view(arr.tobytes(), target)
        a = {'bufferView': vi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax:
            a['min'] = [float(x) for x in arr.min(axis=0)]; a['max'] = [float(x) for x in arr.max(axis=0)]
        self.accs.append(a)
        return len(self.accs) - 1

def main(pa, pb, po):
    A, Ab = read_glb(pa)
    B, Bb = read_glb(pb)
    out = Out()
    G = {'asset': {'version': '2.0', 'generator': 'person.glb + build_player.py (tools/blender/player)'},
         'scene': A.get('scene', 0), 'scenes': copy.deepcopy(A['scenes'])}

    # ---------------- nodes: keep A's, drop its mesh nodes, add one mesh node
    mesh_nodes = [i for i, n in enumerate(A['nodes']) if 'mesh' in n]
    assert mesh_nodes == list(range(mesh_nodes[0], len(A['nodes']))), "mesh nodes expected at the end"
    keep = mesh_nodes[0]
    nodes = copy.deepcopy(A['nodes'][:keep])
    tmpl = A['nodes'][mesh_nodes[0]]
    mesh_node = {k: copy.deepcopy(v) for k, v in tmpl.items() if k in ('rotation', 'scale', 'translation', 'matrix')}
    mesh_node.update(name='Player_Body', mesh=0, skin=0)
    nodes.append(mesh_node)
    for n in nodes:
        if 'children' in n:
            n['children'] = [c for c in n['children'] if c < keep] + ([keep] if any(c in mesh_nodes for c in n['children']) else [])
    G['nodes'] = nodes

    # ---------------- skin 0 (joint order of A)
    sk = copy.deepcopy(A['skins'][0])
    sk['inverseBindMatrices'] = out.copy_acc('A', A, Ab, sk['inverseBindMatrices'])
    G['skins'] = [sk]
    a_joint_names = [A['nodes'][j]['name'] for j in A['skins'][0]['joints']]
    jidx = {n: i for i, n in enumerate(a_joint_names)}

    # ---------------- animations (verbatim)
    anims = copy.deepcopy(A['animations'])
    for an in anims:
        for s in an['samplers']:
            s['input'] = out.copy_acc('A', A, Ab, s['input']); s['output'] = out.copy_acc('A', A, Ab, s['output'])
    G['animations'] = anims

    # ---------------- B mesh
    bmeshes = [n for n in B['nodes'] if 'mesh' in n]
    assert len(bmeshes) == 1, bmeshes
    bnode = bmeshes[0]
    bskin = B['skins'][bnode['skin']]
    b_joint_names = [B['nodes'][j]['name'] for j in bskin['joints']]
    remap = np.array([jidx[n] for n in b_joint_names], dtype=np.int64)
    print("B mesh node TRS", {k: bnode.get(k) for k in ('translation', 'rotation', 'scale')})
    # decide the coordinate space of B's positions: compare with A's mesh bounds (raw space)
    bm = B['meshes'][bnode['mesh']]
    pos_all = np.concatenate([acc_array(B, Bb, p['attributes']['POSITION']) for p in bm['primitives']])
    a_pos = np.concatenate([acc_array(A, Ab, p['attributes']['POSITION']) for m in A['meshes'] for p in m['primitives']])
    print("A raw bounds", a_pos.min(0), a_pos.max(0))
    print("B pos bounds", pos_all.min(0), pos_all.max(0))
    # candidate conversions -> raw
    def conv_id(v): return v
    def conv_yup_m(v): return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1) / 100.0
    def score(v):
        lo, hi = v.min(0), v.max(0); alo, ahi = a_pos.min(0), a_pos.max(0)
        return np.abs(lo - alo).sum() + np.abs(hi - ahi).sum()
    conv = min((conv_id, conv_yup_m), key=lambda c: score(c(pos_all)))
    nconv = (lambda v: v) if conv is conv_id else (lambda v: np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1))
    print("conversion:", conv.__name__, "score", score(conv(pos_all)))

    prims = []
    for p in bm['primitives']:
        np_ = {'attributes': {}, 'mode': p.get('mode', 4)}
        at = p['attributes']
        pos = conv(acc_array(B, Bb, at['POSITION']).astype(np.float64)).astype(np.float32)
        np_['attributes']['POSITION'] = out.new_acc(pos, 5126, 'VEC3', 34962, minmax=True)
        if 'NORMAL' in at:
            nrm = nconv(acc_array(B, Bb, at['NORMAL']).astype(np.float64))
            nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
            np_['attributes']['NORMAL'] = out.new_acc(nrm.astype(np.float32), 5126, 'VEC3', 34962)
        for k in at:
            if k.startswith('TEXCOORD_'):
                np_['attributes'][k] = out.copy_acc('B', B, Bb, at[k])
        j = acc_array(B, Bb, at['JOINTS_0']).astype(np.int64)
        w = acc_array(B, Bb, at['WEIGHTS_0'])
        wa = B['accessors'][at['WEIGHTS_0']]
        if w.dtype != np.float32:
            w = w.astype(np.float32) / (255.0 if w.dtype == np.uint8 else 65535.0)
        jm = remap[j]
        jm[w == 0] = 0
        np_['attributes']['JOINTS_0'] = out.new_acc(jm, 5121 if jm.max() < 256 else 5123, 'VEC4', 34962)
        w = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
        np_['attributes']['WEIGHTS_0'] = out.new_acc(w.astype(np.float32), 5126, 'VEC4', 34962)
        if 'indices' in p:
            idx = acc_array(B, Bb, p['indices']).reshape(-1)
            np_['indices'] = out.new_acc(idx.reshape(-1, 1), 5125 if idx.max() > 65535 else 5123, 'SCALAR', 34963)
        if 'material' in p: np_['material'] = p['material']
        prims.append(np_)
    G['meshes'] = [{'name': 'Player_Body', 'primitives': prims}]
    G['materials'] = copy.deepcopy(B.get('materials', []))
    if 'textures' in B: G['textures'] = copy.deepcopy(B['textures'])
    if 'samplers' in B: G['samplers'] = copy.deepcopy(B['samplers'])
    if 'images' in B:
        imgs = copy.deepcopy(B['images'])
        for im in imgs:
            if 'bufferView' in im: im['bufferView'] = out.copy_view('B', B, Bb, im['bufferView'])
        G['images'] = imgs
    for k in ('extensionsUsed', 'extensionsRequired'):
        if k in B: G[k] = copy.deepcopy(B[k])
    out._pad()
    G['accessors'] = out.accs; G['bufferViews'] = out.views
    G['buffers'] = [{'byteLength': len(out.bin)}]
    js = json.dumps(G, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(out.bin)
    with open(po, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out.bin), 0x004E4942)); f.write(bytes(out.bin))
    tris = sum(G['accessors'][p['indices']]['count'] // 3 for p in prims)
    print("WROTE", po, total, "bytes; tris", tris, "prims", len(prims))

if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(*a[:3])
