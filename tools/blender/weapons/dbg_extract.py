import json, struct, sys, os
p = sys.argv[1]; out = sys.argv[2]
os.makedirs(out, exist_ok=True)
raw = open(p, 'rb').read()
jl = struct.unpack('<I', raw[12:16])[0]; G = json.loads(raw[20:20 + jl])
bin0 = 20 + jl + 8
for i, im in enumerate(G.get('images', [])):
    bv = G['bufferViews'][im['bufferView']]
    d = raw[bin0 + bv.get('byteOffset', 0):bin0 + bv.get('byteOffset', 0) + bv['byteLength']]
    fn = os.path.join(out, '%s_%d_%s.jpg' % (os.path.basename(p)[:-4], i, im.get('name')))
    open(fn, 'wb').write(d); print(fn, len(d))
for m in G['materials']:
    print(json.dumps(m))
