p = '/Users/sang/.claude/jobs/02a78233/tmp/weapons/wcommon.py'
s = open(p).read()
a = s.index("def tex_steel(")
b = s.index("def tex_iron(")
new = '''def tex_steel(size=512, seed=1, dark=0.0, rust=0.0, polish=1.0):
    """Polished/ground steel. Grind lines + fine scratches run along U."""
    mott = tnoise(size, 5, seed)
    grind = tnoise(size, 90, seed + 1, aniso=(40, 1))
    fine = tnoise(size, 120, seed + 8)
    sc = scratches(size, int(1400 * polish), seed + 2, length=(0.03, 0.3), ang_spread=0.12) * 0.55
    sc = np.maximum(sc, scratches(size, int(300 * polish), seed + 3, length=(0.01, 0.05), ang_spread=1.4) * 0.45)
    stain = np.clip((tnoise(size, 9, seed + 4) - 0.55) * 3, 0, 1)
    pits = (tnoise(size, 60, seed + 5) > 0.86).astype(float) * 0.6
    lum = 0.60 - 0.07 * mott - 0.06 * grind + 0.16 * sc - 0.10 * stain - 0.10 * pits - 0.03 * fine - dark
    col = np.stack([lum * 0.985, lum * 0.995, lum * 1.02], -1)
    rm = 0
    if rust > 0:
        rm = np.clip((tnoise(size, 5, seed + 6) * 0.7 + tnoise(size, 30, seed + 7) * 0.3 - (1 - rust)) * 4, 0, 1)
        rcol = np.stack([0.36 + 0.1 * fine, 0.20 + 0.05 * fine, 0.11 + 0 * fine], -1)
        col = col * (1 - rm[..., None]) + rcol * rm[..., None]
    rough = np.clip(0.30 + 0.12 * mott + 0.10 * grind - 0.10 * sc + 0.20 * stain + 0.25 * pits + 0.5 * rm, 0.12, 1)
    metal = np.clip(0.6 - 0.5 * rm, 0, 0.6) if rust > 0 else 0.6
    h = -sc * 0.35 - pits * 0.5 + grind * 0.25
    return dict(base=col, orm=orm(rough, metal), nrm=normal_from_height(h, 1.2))


'''
s = s[:a] + new + s[b:]
s = s.replace('''def reset_all():''', '''class WBuilder(Builder):
    """Adds ('cyl', axis, center, su, sv): u along axis (m * su), v = angle / 2pi * sv."""

    def _uv(self, faces, uv):
        if uv is None or uv[0] != 'cyl':
            return Builder._uv(self, faces, uv)
        ax = V(uv[1]).normalized(); c = V(uv[2]); su, sv = uv[3], uv[4]
        ref = V((1, 0, 0)) if abs(ax.x) < 0.9 else V((0, 0, 1))
        e1 = (ref - ax * ax.dot(ref)).normalized(); e2 = ax.cross(e1)
        for f in faces:
            vals = []
            for l in f.loops:
                d = l.vert.co - c
                a = math.atan2(d.dot(e2), d.dot(e1)) / (2 * math.pi)
                vals.append([d.dot(ax) * su, a])
            angs = [v[1] for v in vals]
            if max(angs) - min(angs) > 0.5:
                for v in vals:
                    if v[1] < 0:
                        v[1] += 1.0
            for l, v in zip(f.loops, vals):
                l[self.uvl].uv = (v[0], v[1] * sv)


def reset_all():''')
open(p, 'w').write(s)
