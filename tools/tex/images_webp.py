"""Convert the project screenshots in images/ (PNG/JPG) to WebP, max width 1600, q82.
usage: python3 tools/tex/images_webp.py images/*.png images/*.jpg"""
import os, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbinfo import dims  # noqa: E402

for f in sys.argv[1:]:
    b = open(f, 'rb').read()
    w, h = dims(b)
    out = os.path.splitext(f)[0] + '.webp'
    cmd = ['cwebp', '-quiet', '-m', '6', '-q', '82', '-sharp_yuv']
    if w > 1600:
        cmd += ['-resize', '1600', '0']
    subprocess.run(cmd + [f, '-o', out], check=True)
    print(f"{f} {w}x{h} {len(b)} -> {dims(open(out, 'rb').read())} {os.path.getsize(out)}")
