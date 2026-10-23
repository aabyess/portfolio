"""List the images embedded in .glb files: mime, size (px), bytes, material role.
usage: python3 tools/tex/glbinfo.py models/npc/*.glb ..."""
import json, struct, sys


def dims(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', b[16:24])
    if b[:4] == b'RIFF':
        c = b[12:16]
        if c == b'VP8 ':
            return (struct.unpack('<H', b[26:28])[0] & 0x3fff, struct.unpack('<H', b[28:30])[0] & 0x3fff)
        if c == b'VP8L':
            v = struct.unpack('<I', b[21:25])[0]
            return ((v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1)
        if c == b'VP8X':
            return (int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1)
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b):
            m = b[i + 1]
            L = struct.unpack('>H', b[i + 2:i + 4])[0]
            if m in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', b[i + 5:i + 9])
                return (w, h)
            i += 2 + L
    return None


def parse(p):
    d = open(p, 'rb').read()
    l = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + l])
    bo = 20 + l
    bl = struct.unpack('<I', d[bo:bo + 4])[0]
    return d, j, d[bo + 8:bo + 8 + bl]


def tex_source(t):
    ext = t.get('extensions', {})
    for k in ('EXT_texture_webp', 'KHR_texture_basisu'):
        if k in ext:
            return ext[k]['source']
    return t.get('source')


def roles(j):
    """image index -> set of roles (base/mr/nrm/occ/emi)"""
    r = {}
    src = [tex_source(t) for t in j.get('textures', [])]
    for m in j.get('materials', []):
        pb = m.get('pbrMetallicRoughness', {})
        for k, v in [('base', pb.get('baseColorTexture')), ('mr', pb.get('metallicRoughnessTexture')),
                     ('nrm', m.get('normalTexture')), ('occ', m.get('occlusionTexture')),
                     ('emi', m.get('emissiveTexture'))]:
            if v:
                r.setdefault(src[v['index']], set()).add(k)
    return r


def image_bytes(j, binc, im):
    bv = j['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    return binc[o:o + bv['byteLength']]


if __name__ == '__main__':
    tot = 0
    for p in sys.argv[1:]:
        d, j, binc = parse(p)
        r = roles(j)
        out = []
        it = 0
        for i, im in enumerate(j.get('images', [])):
            b = image_bytes(j, binc, im)
            it += len(b)
            out.append(f"{im.get('mimeType', '?')[6:]}{dims(b)}{len(b) // 1000}k:{','.join(sorted(r.get(i, [])))}")
        tot += len(d)
        print(f"{p} {len(d) // 1000}k img{it // 1000}k :: " + ' | '.join(out))
    print('total', tot)
