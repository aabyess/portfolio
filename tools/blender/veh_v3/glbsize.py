import json, struct, sys
for n in sys.argv[1:]:
    raw = open('/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm/models/vehicles/%s.glb' % n, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    G = json.loads(raw[20:20 + jl])
    img = sum(G['bufferViews'][i['bufferView']]['byteLength'] for i in G.get('images', []))
    print(n, 'total %.0fKB' % (len(raw) / 1024), 'images %.0fKB' % (img / 1024), 'rest %.0fKB' % ((len(raw) - img) / 1024))
    for i in G.get('images', []):
        print('   ', i.get('name'), '%.0fKB' % (G['bufferViews'][i['bufferView']]['byteLength'] / 1024))
    for m in G['materials']:
        print('   mat', m['name'], m.get('alphaMode', ''), 'double' if m.get('doubleSided') else '')
    meshes = []
    for me in G['meshes']:
        tot = 0
        for p in me['primitives']:
            ext = p.get('extensions', {}).get('KHR_draco_mesh_compression')
            if ext:
                tot += G['bufferViews'][ext['bufferView']]['byteLength']
        meshes.append((tot, me['name'], len(me['primitives'])))
    for t, nm, np_ in sorted(meshes, reverse=True)[:8]:
        print('   mesh %-18s %.0fKB prims=%d' % (nm, t / 1024, np_))
    an = 0
    for a in G.get('animations', []):
        for smp in a['samplers']:
            for k in ('input', 'output'):
                an += G['bufferViews'][G['accessors'][smp[k]]['bufferView']]['byteLength']
    print('   anim ~%.0fKB (shared inputs counted multiple)' % (an / 1024))
