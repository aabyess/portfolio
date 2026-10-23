p = '/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/horse3.py'
s = open(p).read()
old = """            if mode in ('body', 'head', 'hooves'):"""
new = """            if mode in [b.name for b in self.arm.data.bones] and mode not in ('tail',):
                W[mode] = np.ones(N)
            elif mode == 'mane_cards':
                keys = list(bw.keys())
                for k in keys:
                    W[k] = np.zeros(N)
                for i, c in enumerate(C):
                    res = kd.find_n(c, 5)
                    ws = np.array([1.0 / (max(dd, 1e-4) ** 2) for _, _, dd in res])
                    ws /= ws.sum()
                    for (co, idx, dd), w in zip(res, ws):
                        for k in keys:
                            W[k][i] += w * bw[k][idx]
                cr = np.array([tuple(p) for p in self.crest])
                D = np.linalg.norm(C[:, None, :] - cr[None, :, :], axis=2)
                j = np.argmin(D, axis=1)
                dist = D[np.arange(N), j]
                tpar = j / (len(cr) - 1)
                f = sst(0.03, 0.20, dist) * 0.9
                for k in keys:
                    W[k] *= (1 - f)
                w1 = np.clip(1 - tpar * 2, 0, 1)
                w3 = np.clip(tpar * 2 - 1, 0, 1)
                w2 = 1 - w1 - w3
                for nm, w in (('mane_1', w1), ('mane_2', w2), ('mane_3', w3)):
                    W[nm] = W.get(nm, np.zeros(N)) + f * w
            elif mode in ('body', 'head', 'hooves'):"""
assert old in s
s = s.replace(old, new, 1)
old = """                f1 = sst(1.36, 1.22, z)
                f2 = sst(0.95, 0.75, z)
                W['body'] = 1 - f1
                W['tail'] = f1 * (1 - f2)
                W['tail_end'] = f1 * f2"""
new = """                f1 = sst(1.36, 1.22, z)
                f2 = sst(1.00, 0.80, z)
                f3 = sst(0.76, 0.56, z)
                W['body'] = 1 - f1
                W['tail'] = f1 * (1 - f2)
                W['tail_end'] = f1 * f2 * (1 - f3)
                W['tail_tip'] = f1 * f2 * f3"""
assert old in s
s = s.replace(old, new, 1)
a = s.index("    # ------------------------------------------------------------ assemble")
b = s.index("# ---------------------------------------------------------------- animation")
new = open('/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/patch_h1_finish.txt').read()
s = s[:a] + new + s[b:]
s = s.replace("""        collar=mat("Leather_Collar", "#2a1a12", rough=0.5),
    )""", """        collar=mat("Leather_Collar", "#2a1a12", rough=0.5),
        hair=hair_material(),
    )""")
s = s.replace("# ---------------------------------------------------------------- geometry helpers",
              open('/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/patch_h1_hair.txt').read() +
              "\n\n# ---------------------------------------------------------------- geometry helpers")
open(p, 'w').write(s)
print("patched")
