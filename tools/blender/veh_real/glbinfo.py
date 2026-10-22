import json, struct
for n in ('horse', 'carriage', 'motorcycle', 'bicycle'):
    raw = open('/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/vehicles/%s.glb' % n, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    G = json.loads(raw[20:20 + jl])
    mats = G['materials']
    print(n, 'materials:', len(mats), [m['name'] for m in mats])
    for m in mats:
        pbr = m.get('pbrMetallicRoughness', {})
        if 'baseColorTexture' in pbr or m['name'] in ('Lantern_Glow', 'Lamp_Glass', 'Horse_Coat'):
            print('  ', m['name'], pbr, m.get('emissiveFactor'))
    attrs = set()
    for me in G['meshes']:
        for p in me['primitives']:
            attrs |= set(p['attributes'].keys())
    print('  attrs', sorted(attrs))
    for i, nd in enumerate(G['nodes']):
        if nd.get('name', '').startswith(('wheel', 'steer', 'pedals', 'seat')):
            ch = [G['nodes'][c]['name'] for c in nd.get('children', [])]
            print('   node', nd['name'], 'rot', nd.get('rotation'), 'children', ch)
