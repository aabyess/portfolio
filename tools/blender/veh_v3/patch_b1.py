p = '/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/bikes3.py'
s = open(p).read()


def rep(a, b, cnt=1):
    global s
    assert s.count(a) >= 1, a[:60]
    s = s.replace(a, b, cnt)


rep("from bake3 import bake_group", "from bake3 import bake_group\nfrom parts3 import roller_chain, sprocket")
# denser, thinner cylinder fins
rep("""    for f in range(9):
        rr = 0.09 if f < 6 else 0.10
        prof += [(z, 0.058), (z + 0.004, rr), (z + 0.014, rr), (z + 0.018, 0.058)]
        z += 0.03""", """    for f in range(13):
        rr = 0.088 if f < 9 else 0.098
        prof += [(z, 0.058), (z + 0.002, rr), (z + 0.008, rr), (z + 0.010, 0.058)]
        z += 0.021""")
rep("""    b.lathe(prof, ALU, n=16, axis='Z', M=Mc)
    b.rbox((0, 0, z + 0.04), (0.11, 0.13, 0.06), ALU, r=0.02, M=Mc)""", """    b.lathe(prof, ALU, n=20, axis='Z', M=Mc)
    b.rbox((0, 0, z + 0.04), (0.11, 0.13, 0.06), ALU, r=0.02, M=Mc)
    for k in range(4):                                     # cylinder-head fins
        b.rbox((0, 0, z + 0.018 + k * 0.016), (0.15, 0.17, 0.004), ALU, r=0.0015, seg=1, M=Mc)
    # pushrod tubes (right side) crankcase -> head, rocker box
    for dy in (-0.012, 0.012):
        b.sweep([(-0.065, -0.02 + dy, 0.47), (-0.075, -0.115 + dy, 0.76)], 0.007, CHR, n=6)
    b.rbox(cyl0 + ax * (z + 0.07) + V((-0.04, 0.0, 0.0)), (0.05, 0.08, 0.035), ALU, r=0.01)
    # spark plug + HT lead to the magneto
    plug = cyl0 + ax * (z - 0.02) + V((0, -0.06, 0.0))
    b.lathe([(0, 0.008), (0.03, 0.008), (0.032, 0.006), (0.05, 0.004)], mat("Ceramic", "#e8e2d4", rough=0.3), n=8,
            axis='Y', c=(0, 0, 0), M=Matrix.Translation(plug) @ Matrix.Rotation(math.pi, 4, 'Z'))
    b.sweep([plug + V((0, -0.05, 0)), plug + V((-0.02, -0.08, -0.08)), (-0.03, -0.25, 0.56), (0, -0.20, 0.535)],
            0.004, mat("Rubber_Lead", "#141212", rough=0.6), n=5, sub=3)
    # carburettor: body, float bowl, tickler, bell mouth + fuel line from the tank tap
    cb = cyl0 + ax * 0.23 + V((0, 0.10, -0.02))
    b.lathe([(-0.025, 0.0), (-0.025, 0.022), (0.025, 0.022), (0.025, 0.0)], ALU, n=12, axis='Z', c=cb + V((0, 0.03, 0.01)))
    b.lathe([(-0.07, 0.0), (-0.07, 0.024), (-0.03, 0.026), (-0.025, 0.0)], ALU, n=12, axis='Z', c=cb + V((-0.035, 0.03, 0.0)))
    b.lathe([(0, 0.004), (0.02, 0.004), (0.022, 0.007), (0.026, 0.0)], CHR, n=8, axis='Z', c=cb + V((-0.035, 0.03, 0.024)))
    b.lathe([(0.0, 0.016), (0.02, 0.018), (0.04, 0.03), (0.042, 0.03)], CHR, n=12, axis='Y', c=cb + V((0, 0.05, 0.01)),
            cap1=False)
    b.sweep([(-0.04, -0.12, 0.93), (-0.05, -0.05, 0.86), (-0.04, 0.0, 0.74), cb + V((-0.035, 0.03, 0.03))], 0.004,
            mat("Fuel_Line", "#6a4a2a", rough=0.5), n=5, sub=3)
    b.lathe([(0, 0.008), (0.02, 0.008), (0.022, 0.0)], BRS, n=8, axis='Z', c=(-0.04, -0.12, 0.925))  # fuel tap
    # kick-starter (right) + brake pedal (left), tool box
    b.sweep([(-0.10, 0.25, 0.40), (-0.12, 0.33, 0.47), (-0.125, 0.42, 0.56)], 0.011, CHR, n=8, sub=2)
    b.rbox((-0.15, 0.43, 0.565), (0.06, 0.025, 0.03), RUB, r=0.008)
    b.sweep([(0.08, 0.18, 0.24), (0.15, 0.06, 0.25), (0.17, -0.02, 0.28)], 0.008, FRM, n=6, sub=2)
    b.rbox((0.19, -0.03, 0.285), (0.05, 0.04, 0.015), RUB, r=0.005)
    b.rbox((0.12, 0.46, 0.50), (0.06, 0.16, 0.10), FRM, r=0.012)""")
# chain with link plates and a toothed gearbox sprocket
rep("""    b.sweep(loop, 0.006, DRK, n=4, closed_path=True, cap=False, ellipse=(1.4, 1.0))""",
    """    CHN = mat("Metal_Chain", "#3a3632", rough=0.45, metal=0.45)
    roller_chain(b, loop, 0.12, 0.0159, 0.013, 0.0016, 0.007, CHN)
    sprocket(b, cs, cr - 0.002, 17, 0.006, DRK)""")
rep("""    empty("seat", (0, 0.28, 1.065))""", """    empty("seat", (0, 0.28, 1.065))
    bake_group("motorcycle", [o for o in bpy.data.objects if o.type == 'MESH'], 1024, ao_dist=0.3,
               mat_scale={'Metal_Spoke': 0.15, 'Metal_Chain': 0.4})""")
# ---- bicycle
rep("""    b.sweep(loop, 0.004, DRK, n=4, closed_path=True, cap=False, ellipse=(1.5, 1.0))""",
    """    CHN = mat("Metal_Chain", "#3a3632", rough=0.45, metal=0.45)
    roller_chain(b, loop, CX, 0.0127, 0.0085, 0.0011, 0.0045, CHN)""")
rep("""    for k in range(5):
        a = -0.6 + 0.3 * k
        b.ellipsoid((math.sin(a) * 0.11, 0.245 + math.cos(a) * 0.035, 1.0), (0.005, 0.005, 0.004), BRS, 6, 4)""",
    """    for k in range(9):                    # copper rivets around the cantle + nose
        a = -1.0 + 0.25 * k
        b.ellipsoid((math.sin(a) * 0.108, 0.245 + math.cos(a) * 0.036, 1.0), (0.0045, 0.0045, 0.0035), BRS, 6, 4)
    for sx in (1, -1):
        b.ellipsoid((sx * 0.012, 0.035, 1.003), (0.004, 0.004, 0.003), BRS, 6, 4)""")
rep("bake_group(\"bicycle\", [o for o in bpy.data.objects if o.type == 'MESH'], 1024, ao_dist=0.25, mat_scale={'Metal_Spoke': 0.15})",
    "bake_group(\"bicycle\", [o for o in bpy.data.objects if o.type == 'MESH'], 1024, ao_dist=0.25,\n               mat_scale={'Metal_Spoke': 0.15, 'Metal_Chain': 0.4})")
open(p, 'w').write(s)

p = '/Users/sang/.claude/jobs/02a78233/tmp/veh_v3/bake3.py'
s = open(p).read()
rep("    N = 3.2\n", "    N = 9.0\n")
rep("('Metal_Spoke', 'chrome'),", "('Metal_Spoke', 'chrome'), ('Metal_Chain', 'iron_dark'), ('Ceramic', 'plain'), ('Fuel_Line', 'rubber'),")
# weathered wood: desaturate a bit
rep("    base = c.base * (0.80 + 0.40 * pv)[:, None]",
    "    bb = c.base * 0.85 + c.base.mean() * 0.15\n    base = bb * (0.78 + 0.40 * pv)[:, None]")
open(p, 'w').write(s)
print("ok")
