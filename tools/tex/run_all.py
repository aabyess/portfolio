"""Re-encode textures of every runtime .glb with per-group settings.
usage: python3 tools/tex/run_all.py SRC_MODELS_DIR OUT_MODELS_DIR
(run from the repo root; SRC should be a pristine copy of models/, e.g. a backup)"""
import glob, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
# group glob -> glbtex.py args
RULES = [
    ('npc/*.glb',      ['--base', '1024', '--nrm', '512']),          # faces need 1024 albedo (dialogue close-up)
    ('player.glb',     ['--base', '1024', '--nrm', '512']),
    ('vehicles/*.glb', ['--base', '1024', '--nrm', '512']),
    ('props/*.glb',    ['--base', '1024', '--nrm', '512']),
    ('animals/*.glb',  ['--base', '512']),
    ('weapons/*.glb',  ['--base', '512', '--nrm', '256', '--other', '256']),
]

src, dst = sys.argv[1], sys.argv[2]
for pat, args in RULES:
    for f in sorted(glob.glob(os.path.join(src, pat))):
        rel = os.path.relpath(f, src)
        out = os.path.join(dst, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        r = subprocess.run([sys.executable, os.path.join(HERE, 'glbtex.py'), f, out] + args,
                           capture_output=True, text=True, check=True)
        print(r.stdout.splitlines()[0])
