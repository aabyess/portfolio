p = '/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/horse3.py'
s = open(p).read()
old = """        out.append(('trace', tr.to_object("traces")))"""
new = """        out.append(('trace', tr.to_object("traces")))
        # breeching around the quarters, hip straps over the croup, crupper along the spine, buckles
        br = Builder()
        c = P(0, 0.42, 1.06)
        ang = [math.radians(a) for a in np.linspace(-12, 192, 30)]
        pts, nr = self.ring_hits(c, V((1, 0, 0)), V((0, 1, 0)), ang, 0.010, reach=0.9)
        self.ribbon(br, pts, nr, 0.075, 0.008, M['leather'])
        self.breech_ends = [pts[0], pts[-1]]
        for yy in (0.40, 0.62):
            cc = P(0, yy, 1.18)
            ang = [math.radians(a) for a in np.linspace(-22, 202, 24)]
            pts, nr = self.ring_hits(cc, V((1, 0, 0)), V((0, 0, 1)), ang, 0.012, reach=0.9)
            self.ribbon(br, pts, nr, 0.032, 0.006, M['leather'])
            for q in (2, len(pts) - 3):
                br.rbox(pts[q] + nr[q] * 0.006, (0.012, 0.03, 0.04), M['iron'], r=0.004,
                        M=None)
        sp = []
        snr = []
        for yy in np.linspace(-0.04, 0.80, 14):
            p_, n_ = self.hit(P(0, yy, 2.2), P(0, yy, 1.1), 0.012)
            sp.append(p_)
            snr.append(n_)
        self.ribbon(br, sp, snr, 0.03, 0.006, M['leather'])
        tp = self.P(0, 0.84, 1.36)
        br.torus(tp, 0.045, 0.012, M['leather'], nu=14, nv=6, axis='Y')
        for sx in (1, -1):
            e = self.breech_ends[0 if sx > 0 else 1]
            br.torus(e + V((0, -0.02, 0)), 0.028, 0.006, M['iron'], nu=12, nv=5, axis='X')
            # buckles on the traces and the belly band
            p_, n_ = self.hit(P(sx * 0.8, -0.05, 1.03), P(0, -0.05, 1.03), 0.02)
            br.rbox(p_, (0.014, 0.06, 0.05), M['iron'], r=0.004)
            p_, n_ = self.hit(P(sx * 0.8, -0.20, 1.02), P(0, -0.20, 1.02), 0.016)
            br.rbox(p_, (0.014, 0.05, 0.06), M['iron'], r=0.004)
        out.append(('transfer', br.to_object("breeching")))"""
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)

p = '/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/carriage3.py'
s = open(p).read()
s = s.replace("from horse3 import Horse, build_actions", "from horse3 import Horse, build_actions\nfrom bake3 import bake_group")
old = """body = b.to_object("carriage_body")"""
new = open('/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/patch_c1_under.txt').read() + """
body = b.to_object("carriage_body")"""
assert old in s
s = s.replace(old, new)
old = """empty("seat", P(0, 0.15, 1.51))"""
new = """empty("seat", P(0, 0.15, 1.51))
PATCHES = [(0.42, 1.80 + SH, 1.98, 0.12, 0.16, 0.10, '#cbbd92'), (-0.57, 1.05 + SH, 1.79, 0.10, 0.13, 0.14, '#b9ab86'),
           (-0.06, 2.45 + SH, 2.14, 0.16, 0.11, 0.06, '#d8cfb2')]
wagon = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'horse']
bake_group("carriage", wagon, 1024, extra={'Cloth_Canvas': {'patches': PATCHES}}, ao_dist=0.6, dirt_low=1.0,
           mat_scale={'Rope': 0.5})"""
assert old in s
s = s.replace(old, new)
open(p, 'w').write(s)
print("ok")
