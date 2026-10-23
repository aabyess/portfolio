"""Re-encode the images embedded in a .glb as WebP (optionally smaller), keeping
everything else (nodes, bones, animations, skins, materials, Draco) byte-identical.

usage: python3 tools/tex/glbtex.py IN.glb OUT.glb [--base 1024] [--nrm 512] [--other 512]
                                    [--qbase 82] [--qnrm 90] [--qother 85] [--min-gain 0.08]

- base  = baseColor / emissive maps, nrm = normal maps, other = metallicRoughness / occlusion.
- An image is only replaced when the new WebP is at least --min-gain smaller than the original
  (or when it had to be resized), so already-small textures are left alone.
- JPEG/PNG images become image/webp and their textures get EXT_texture_webp (same layout as
  models/npc/*.glb: {"extensions":{"EXT_texture_webp":{"source":N}}} with no fallback source),
  and EXT_texture_webp is added to extensionsUsed + extensionsRequired.
- Needs cwebp (+ dwebp for WebP input) on PATH.
"""
import argparse, json, os, struct, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbinfo import dims, parse, roles  # noqa: E402


def encode(src_bytes, mime, max_dim, q, w, h, is_normal):
    with tempfile.TemporaryDirectory() as td:
        ext = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}[mime]
        src = os.path.join(td, 'in' + ext)
        open(src, 'wb').write(src_bytes)
        if mime == 'image/webp':  # decode first so cwebp gets lossless pixels
            png = os.path.join(td, 'in.png')
            subprocess.run(['dwebp', '-quiet', src, '-o', png], check=True)
            src = png
        out = os.path.join(td, 'out.webp')
        cmd = ['cwebp', '-quiet', '-m', '6', '-q', str(q), '-sharp_yuv', '-alpha_q', '100']
        if is_normal:
            cmd += ['-sns', '0', '-f', '0']  # no psycho-visual smoothing on vector data
        if max(w, h) > max_dim:
            s = max_dim / max(w, h)
            cmd += ['-resize', str(max(1, round(w * s))), str(max(1, round(h * s)))]
        cmd += [src, '-o', out]
        subprocess.run(cmd, check=True)
        best = open(out, 'rb').read()
        # flat colour palettes / swatch atlases: lossless is both exact and smaller
        lcmd = ['cwebp', '-quiet', '-lossless', '-z', '9', '-exact'] + cmd[cmd.index('-resize'):cmd.index('-resize') + 3] if '-resize' in cmd else ['cwebp', '-quiet', '-lossless', '-z', '9', '-exact']
        lout = os.path.join(td, 'outl.webp')
        subprocess.run(lcmd + [src, '-o', lout], check=True)
        lb = open(lout, 'rb').read()
        return lb if len(lb) <= len(best) else best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--base', type=int, default=1024)
    ap.add_argument('--nrm', type=int, default=512)
    ap.add_argument('--other', type=int, default=512)
    ap.add_argument('--qbase', type=int, default=82)
    ap.add_argument('--qnrm', type=int, default=90)
    ap.add_argument('--qother', type=int, default=85)
    ap.add_argument('--min-gain', type=float, default=0.08)
    a = ap.parse_args()

    d, j, binc = parse(a.inp)
    r = roles(j)
    bvs = j['bufferViews']
    images = j.get('images', [])
    img_bv = {im['bufferView']: i for i, im in enumerate(images) if 'bufferView' in im}
    new_payload = {}  # bufferView index -> bytes
    converted = set()  # image indices that changed mime to webp
    log = []
    for i, im in enumerate(images):
        if 'bufferView' not in im:
            continue
        bv = bvs[im['bufferView']]
        o = bv.get('byteOffset', 0)
        b = binc[o:o + bv['byteLength']]
        mime = im.get('mimeType')
        w, h = dims(b)
        rl = r.get(i, {'base'})
        if 'nrm' in rl:
            md, q, isn = a.nrm, a.qnrm, True
        elif rl & {'base', 'emi'}:
            md, q, isn = a.base, a.qbase, False
        else:
            md, q, isn = a.other, a.qother, False
        nb = encode(b, mime, md, q, w, h, isn)
        resized = max(w, h) > md
        if resized or len(nb) <= len(b) * (1 - a.min_gain):
            new_payload[im['bufferView']] = nb
            if mime != 'image/webp':
                im['mimeType'] = 'image/webp'
                converted.add(i)
            log.append(f"  {im.get('name', i)} {mime[6:]} {w}x{h} {len(b)//1000}k -> {dims(nb)} {len(nb)//1000}k")
        else:
            log.append(f"  {im.get('name', i)} kept ({len(b)//1000}k, webp {len(nb)//1000}k)")

    # rebuild BIN chunk: every bufferView keeps its data; 4-byte align each view
    out = bytearray()
    for k, bv in enumerate(bvs):
        if bv.get('buffer', 0) != 0:
            sys.exit('multi-buffer glb not supported')
    order = sorted(range(len(bvs)), key=lambda k: bvs[k].get('byteOffset', 0))
    for k in order:
        bv = bvs[k]
        o = bv.get('byteOffset', 0)
        data = new_payload.get(k, binc[o:o + bv['byteLength']])
        while len(out) % 4:
            out.append(0)
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(data)
        out += data
    while len(out) % 4:
        out.append(0)
    j['buffers'][0]['byteLength'] = len(out)

    if converted:
        for t in j.get('textures', []):
            if t.get('source') in converted:
                ext = t.setdefault('extensions', {})
                ext['EXT_texture_webp'] = {'source': t.pop('source')}
        for key in ('extensionsUsed', 'extensionsRequired'):
            lst = j.setdefault(key, [])
            if 'EXT_texture_webp' not in lst:
                lst.append('EXT_texture_webp')

    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(a.out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    print(f"{a.inp}: {len(d)//1000}k -> {total//1000}k")
    print('\n'.join(log))


if __name__ == '__main__':
    main()
