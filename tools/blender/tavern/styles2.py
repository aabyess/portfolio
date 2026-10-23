# ---- appended into booths.py (exec'd in its namespace) ----


def xform(tmp, Mx):
    for v in tmp.bm.verts:
        v.co = Mx @ v.co
    tmp.bm.normal_update()
    bmesh.ops.recalc_face_normals(tmp.bm, faces=tmp.bm.faces)
    return tmp


SWAPXY = Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))


def wall_xz(b, poly, y0, thick, m, uvs=1.0):
    """Polygon in the XZ plane extruded from y0 to y0+thick."""
    Mx = Matrix(((1, 0, 0, 0), (0, 0, 1, y0), (0, 1, 0, 0), (0, 0, 0, 1)))
    bv, bf = prism(b, poly, 0, thick, m, Mx=Mx)
    for f in bf:
        n = f.normal
        for l in f.loops:
            co = l.vert.co
            if abs(n.y) > 0.5:
                l[b.uvl].uv = (co.x * uvs, co.z * uvs)
            elif abs(n.x) > 0.5:
                l[b.uvl].uv = (co.y * uvs, co.z * uvs)
            else:
                l[b.uvl].uv = (co.x * uvs, co.y * uvs)
    return bv, bf


def panel_x(x, face, ya, yb, z0, z1, pattern, WD, PL):
    """Half-timber panel on a side wall (plane x)."""
    tmp = Builder()
    half_timber_panel(tmp, ya, yb, z0, z1, 0.0, WD, PL, pattern, face=-1)
    for v in tmp.bm.verts:
        v.co = V((x - v.co.y * face, v.co.x, v.co.z))
    tmp.bm.normal_update()
    bmesh.ops.recalc_face_normals(tmp.bm, faces=tmp.bm.faces)
    obs_tmp.append(tmp)


def flower_box(b, c, length, seed=1):
    c = V(c)
    plank(b, c, (length, 0.16, 0.14), M('wood_green'), r=0.012)
    leaf_cluster(b, c + V((0, 0, 0.1)), length / 2.4, [M('green')], n=int(length * 18), seed=seed, size=0.045)
    leaf_cluster(b, c + V((0, -0.02, 0.16)), length / 2.6, [mat("Geranium", "#c4231c", rough=0.6)],
                 n=int(length * 14), seed=seed + 1, size=0.03, flat=0.8)


def hanging_string(b, top, items, m_item, m_rope, gap=0.08, kind='sphere', size=0.03):
    top = V(top)
    b.sweep([top, top - V((0, 0, gap * (items + 0.5)))], 0.004, m_rope, n=3)
    for i in range(items):
        c = top - V((0, 0, gap * (i + 1)))
        if kind == 'sphere':
            b.ellipsoid(c, (size, size, size * 0.9), m_item, 7, 5)
        elif kind == 'chili':
            b.lathe([(0, 0.0), (0.004, size * 0.45), (size * 1.6, 0.0)], m_item, n=5, axis='Z',
                    M=Matrix.Translation(c) @ Matrix.Rotation(math.pi + 0.5 * (1 if i % 2 else -1), 4, 'Y'))
        elif kind == 'sausage':
            b.sweep([c + V((0, 0, gap * 0.45)), c + V((0.02, 0, 0)), c - V((0, 0, gap * 0.45))], size, m_item, n=6)


def fish(b, c, m, s=1.0, yaw=0.0):
    c = V(c)
    Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
    b.ellipsoid((0, 0, 0), (0.09 * s, 0.025 * s, 0.035 * s), m, 8, 5, M=Mx)
    prism(b, [(0.08 * s, 0), (0.13 * s, 0.035 * s), (0.13 * s, -0.035 * s)], -0.005, 0.005, m,
          Mx=Mx @ Matrix.Rotation(math.pi / 2, 4, 'X'))


def bavarian():
    WD = mat("Timber_Oxblood", "#8e3b2a", rough=0.75, tex=tex('wood'))
    PL = M('plaster')
    TL = mat("Tile_Beaver", "#c45a3a", rough=0.85, tex=tex('tiles'))
    GR = mat("Shutter_Green", "#3e6b48", rough=0.7, tex=tex('wood'))
    BLUE = mat("Bavarian_Blue", "#2f5da8", rough=0.6)
    WHITE = M('cloth_white')
    GOLD = mat("Gold_Leaf", "#d9a93b", rough=0.3, metal=0.6)
    b, r = Builder(), Builder()
    X0, X1, YF, YB, EH = -1.95, 1.95, -0.80, 1.30, 2.0
    RZ = 4.15
    plank(b, (0, (YF + YB) / 2, 0.1), (X1 - X0 + 0.2, YB - YF + 0.2, 0.2), M('stone'), r=0.03)
    # posts and plates
    for x in (X0, X1):
        for y in (YF, YB):
            post(b, x, y, 0.2, EH, 0.18, WD)
    for y in (YF, YB):
        plank(b, (0, y, EH + 0.07), (X1 - X0 + 0.2, 0.2, 0.14), WD, r=0.015)
    # front ground floor: panels either side of a big serving window
    half_timber_panel(b, X0 + 0.09, -1.15, 0.2, EH, YF, WD, PL, 'man', face=-1)
    half_timber_panel(b, 1.15, X1 - 0.09, 0.2, EH, YF, WD, PL, 'man', face=-1)
    half_timber_panel(b, -1.15, 1.15, 0.2, 0.95, YF, WD, PL, 'cross', face=-1)
    for x in (-1.15, 1.15):
        post(b, x, YF, 0.2, EH, 0.14, WD)
    # side + back walls
    for x, face in ((X0, -1), (X1, 1)):
        panel_x(x, face, YF + 0.09, 0.25, 0.2, EH, 'cross', WD, PL)
        panel_x(x, face, 0.25, YB - 0.09, 0.2, EH, 'man', WD, PL)
    for xa, xb in ((X0 + 0.09, 0.0), (0.0, X1 - 0.09)):
        half_timber_panel(b, xa, xb, 0.2, EH, YB, WD, PL, 'cross', face=-1)
    # front gable: plaster triangle with Andreaskreuz + Mann
    hw = X1 - X0
    for y0 in (YF - 0.05, YB - 0.05):
        wall_xz(b, [(X0, EH + 0.14), (X1, EH + 0.14), (0, RZ - 0.15)], y0, 0.1, PL)
    yt = YF - 0.08
    plank(b, (0, yt, 3.05), (2.0, 0.1, 0.12), WD, r=0.012)
    plank(b, (0, yt, (EH + RZ) / 2), (0.12, 0.1, RZ - EH - 0.2), WD, r=0.012)
    for s in (-1, 1):
        beam(b, (s * (X1 + 0.05), yt, EH + 0.14), (0, yt, RZ - 0.1), 0.14, 0.1, WD, up=(0, 1, 0))
        beam(b, (s * 0.06, yt, 3.0), (s * 1.0, yt, EH + 0.2), 0.1, 0.09, WD, up=(0, 1, 0))       # Mann braces
        beam(b, (s * 0.25, yt, EH + 0.2), (s * 1.2, yt, 2.95), 0.09, 0.09, WD, up=(0, 1, 0))     # X
        beam(b, (s * 1.2, yt, EH + 0.2), (s * 0.25, yt, 2.95), 0.09, 0.09, WD, up=(0, 1, 0))
    # small gable window with geraniums + blank name board
    plank(b, (0, yt - 0.02, 3.42), (0.36, 0.06, 0.36), WD, r=0.01)
    plank(b, (0, yt - 0.04, 3.42), (0.26, 0.02, 0.26), mat("Window_Dark", "#2b2622", rough=0.4), r=0.004, seg=1)
    flower_box(b, (0, yt - 0.12, 3.2), 0.5, seed=3)
    b.rbox((0, YF - 0.13, 2.38), (1.3, 0.05, 0.34), WD, r=0.02, uv=G('x'))
    INFO['sign'] = (V((0, YF - 0.156, 2.38)), 1.15, 0.24)
    # steep beaver-tail roof (ridge along Y, gable faces the road)
    T = SWAPXY
    for s in (-1, 1):
        roof_slab(r, YF - 0.45, YB + 0.22, (s * (X1 + 0.38), EH - 0.15), (0.0, RZ), TL, thick=0.12, lump=0.0,
                  tile_wave=0.03, tile_w=0.16, T=T, overhang_round=False)
    r.sweep([V((0, YF - 0.45, RZ + 0.12)), V((0, YB + 0.22, RZ + 0.12))], 0.07, TL, n=8, ellipse=(1.0, 0.8))
    # dovecote at the apex
    plank(b, (0, YF - 0.25, RZ - 0.45), (0.32, 0.3, 0.28), PL, r=0.01)
    for s in (-1, 1):
        plank(b, (s * 0.1, YF - 0.27, RZ - 0.25), (0.25, 0.36, 0.03), TL, r=0.005, seg=1,
              Mx=rot((s * 0.1, YF - 0.27, RZ - 0.25), 'Y', -s * 0.6))
    # window: green shutters (side leaves open + top flap propped as awning) + thick shelf counter
    for s in (-1, 1):
        plank(b, (s * 1.48, YF - 0.06, 1.48), (0.62, 0.04, 0.95), GR, r=0.01)
        for z in (1.2, 1.75):
            plank(b, (s * 1.48, YF - 0.09, z), (0.56, 0.02, 0.06), GR, r=0.005, seg=1)
    plank(b, (0, YF - 0.42, 1.98), (2.3, 0.75, 0.04), GR, r=0.01, Mx=rot((0, YF - 0.05, 2.0), 'X', 0.35))
    for s in (-1, 1):
        beam(b, (s * 1.0, YF - 0.03, 1.4), (s * 1.0, YF - 0.72, 1.74), 0.03, 0.03, IR)
    counter(b, -1.15, 1.15, YF - 0.48, 0.48, 0.98, M('wood_dark'), M('wood_light'), boards='h')
    # stoneware lidded mugs + pretzels + sausages
    for i, x in enumerate(np.linspace(-0.9, 0.2, 6)):
        c = V((x, YF - 0.28, 0.98))
        b.lathe([(0, 0.045), (0.12, 0.042), (0.13, 0.044), (0.13, 0.0)], mat("Stoneware_Grey", "#9aa3a8", rough=0.4),
                n=10, axis='Z', c=c, cap0=True)
        b.lathe([(0.13, 0.047), (0.145, 0.03), (0.15, 0.0)], M('pewter'), n=10, axis='Z', c=c)
        b.sweep([c + V((0.04, 0, 0.11)), c + V((0.075, 0, 0.09)), c + V((0.075, 0, 0.04)), c + V((0.04, 0, 0.03))],
                0.008, mat("Stoneware_Grey", "#9aa3a8", rough=0.4), n=5, sub=2)
    PR = mat("Pretzel", "#8a4a1e", rough=0.5)
    for k, x in enumerate((0.55, 0.85)):
        b.sweep([V((x, YF - 0.2, 1.92)), V((x, YF - 0.2, 1.3))], 0.012, M('wood'), n=5)
        for j in range(3):
            c = V((x, YF - 0.2, 1.75 - j * 0.17))
            b.torus(c + V((-0.035, 0, 0)), 0.04, 0.012, PR, nu=10, nv=5, axis='Y')
            b.torus(c + V((0.035, 0, 0)), 0.04, 0.012, PR, nu=10, nv=5, axis='Y')
    hanging_string(b, (-0.6, YF - 0.15, 1.95), 5, mat("Sausage", "#8c3b2c", rough=0.5), M('rope'), gap=0.1,
                   kind='sausage', size=0.016)
    hanging_string(b, (-0.35, YF - 0.15, 1.95), 4, mat("Sausage", "#8c3b2c", rough=0.5), M('rope'), gap=0.1,
                   kind='sausage', size=0.016)
    # Bierstern: golden hexagram on a scrolled iron bracket at the right corner
    yb_ = YF - 0.05
    b.sweep([V((X1 + 0.05, yb_, 2.3)), V((X1 + 0.08, YF - 0.6, 2.32)), V((X1 + 0.08, YF - 0.95, 2.3))], 0.016, IR, n=6,
            sub=2)
    curl = [V((X1 + 0.08, YF - 0.95 + 0.1 * math.cos(a), 2.2 + 0.1 * math.sin(a))) for a in np.linspace(1.6, 6.0, 9)]
    b.sweep(curl, 0.01, IR, n=5)
    b.sweep([V((X1 + 0.05, yb_, 1.9)), V((X1 + 0.08, YF - 0.45, 2.1)), V((X1 + 0.08, YF - 0.62, 2.3))], 0.012, IR, n=5,
            sub=2)
    sc = V((X1 + 0.08, YF - 0.82, 1.98))
    b.sweep([sc + V((0, 0, 0.32)), V((X1 + 0.08, YF - 0.82, 2.31))], 0.004, IR, n=3)
    for a0 in (math.pi / 2, -math.pi / 2):
        tri = [(math.cos(a0 + k * 2 * math.pi / 3) * 0.27, math.sin(a0 + k * 2 * math.pi / 3) * 0.27) for k in range(3)]
        prism(b, tri, -0.02, 0.02, GOLD, Mx=Matrix.Translation(sc) @ Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0),
                                                                              (0, 0, 0, 1))))
    # upright Fass with tap on a stand (outside left)
    fc = V((X0 - 0.35, YF - 0.25, 0.0))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        beam(b, fc + V((math.cos(a) * 0.18, math.sin(a) * 0.18, 0.0)), fc + V((math.cos(a) * 0.14, math.sin(a) * 0.14, 0.5)),
             0.05, 0.05, M('wood_dark'))
    plank(b, fc + V((0, 0, 0.52)), (0.42, 0.42, 0.05), M('wood_dark'), r=0.012)
    cask(b, fc + V((0, 0, 0.55 + 0.36)), 0.72, 0.24, M('wood'), IR, axis='Z')
    sp = fc + V((0, -0.27, 0.72))
    b.lathe([(0, 0.022), (-0.06, 0.018)], M('brass'), n=8, axis='Y', c=sp)
    b.sweep([sp + V((0, -0.06, 0)), sp + V((0, -0.07, -0.05))], 0.012, M('brass'), n=6)
    # Maibaum: blue/white spiral pole
    mx, my = X0 - 0.45, YF + 0.35
    n = 16
    for i in range(n):
        z0, z1 = 0.0 + i * 0.25, 0.25 + i * 0.25
        b.lathe([(z0, 0.06 - i * 0.001), (z1, 0.06 - (i + 1) * 0.001)], BLUE if i % 2 else WHITE, n=8, axis='Z',
                c=(mx, my, 0), cap0=(i == 0), cap1=(i == n - 1))
    b.torus((mx, my, 3.85), 0.2, 0.04, M('green'), nu=12, nv=5, axis='Z')
    for k in range(4):
        a = k * math.pi / 2
        b.sweep([V((mx, my, 3.9)), V((mx + math.cos(a) * 0.2, my + math.sin(a) * 0.2, 3.85))], 0.006, M('cloth_white'),
                n=3)
    # flower boxes under side windows + lanterns
    for s in (-1, 1):
        x = s * (X1 + 0.08)
        plank(b, (x, 0.3, 1.45), (0.04, 0.5, 0.45), mat("Window_Dark", "#2b2622", rough=0.4), r=0.004, seg=1)
        for d in (-1, 1):
            plank(b, (x + s * 0.03, 0.3 + d * 0.38, 1.45), (0.03, 0.26, 0.5), GR, r=0.006, seg=1)
        tmp = Builder()
        flower_box(tmp, (0, 0, 0), 0.55, seed=5 + s)
        xform(tmp, Matrix.Translation((x + s * 0.06, 0.3, 1.13)) @ Matrix.Rotation(math.pi / 2, 4, 'Z'))
        obs_tmp.append(tmp)
    lanterns_at(b, [V((X0 + 0.05, YF - 0.25, 1.95)), V((-0.2, YF - 0.62, 1.82))], style='round', hang=0.05)
    beam(b, (X0 + 0.05, YF - 0.05, 2.0), (X0 + 0.05, YF - 0.3, 2.0), 0.03, 0.03, IR)
    crate(b, (X1 + 0.25, 0.75, 0.22), (0.45, 0.45, 0.44), M('wood'), M('wood_dark'), yaw=0.15)
    cask(b, (X1 + 0.3, 0.2, 0.3), 0.6, 0.2, M('wood'), IR, axis='Z')
    menu_board(b, (1.65, YF - 0.75, 0.0), -0.3, M('wood_dark'), M('chalk'), s=0.85)
    finish("tavern-bavarian", [b, r] + obs_tmp)


def norse():
    TAR = M('wood_black')
    TAR2 = mat("Shingle_Tar", "#4a3c32", rough=0.6, tex=tex('wood'))
    LOG = mat("Log_Peeled", "#7a5636", rough=0.85, tex=tex('wood'))
    TURF = mat("Turf", "#5e7a3a", rough=1.0, tex=tex('thatch'))
    RED = mat("Paint_Red", "#b8322a", rough=0.6)
    YEL = mat("Paint_Yellow", "#d9a23a", rough=0.6)
    FUR = mat("Fur", "#6a5038", rough=1.0, tex=tex('thatch'))
    HORN = mat("Horn", "#d8c39a", rough=0.4)
    b, r = Builder(), Builder()
    X0, X1, YF, YB = -2.55, 2.55, -0.95, 1.10
    EZ, RZ, RY = 1.45, 3.05, 0.05
    # log posts + plates
    for y in (YF, YB):
        for x in (X0, -0.85, 0.85, X1):
            round_post(b, x, y, 0.0, 1.95 if y == YF else 1.85, 0.12, LOG, n=8)
        b.lathe([(X0 - 0.2, 0.12), (X1 + 0.2, 0.12)], LOG, n=8, axis='X', c=(0, y, 1.95 if y == YF else 1.85),
                uv=G('x'))
    # back log wall + turf berm, plank side walls
    for i in range(7):
        b.lathe([(X0, 0.1), (X1, 0.1)], LOG, n=8, axis='X', c=(0, YB + 0.05, 0.1 + i * 0.19), uv=G('x'))
    roof_slab(b, X0 - 0.1, X1 + 0.1, (YB + 0.38, 0.0), (YB + 0.12, 0.85), TURF, thick=0.15, nx=18, ny=4, lump=0.05,
              uscale=0.8)
    for x in (X0, X1):
        for k in range(10):
            y = YF + 0.3 + k * (YB - YF - 0.3) / 10
            plank(b, (x, y, 0.85), (0.05, (YB - YF - 0.3) / 10 - 0.01, 1.7), TAR, r=0.008, seg=1)
    # low long boat-like roof of fish-scale tarred shingles (ends sweep up)
    rb = Builder()
    for eave, ridge in (((YF - 0.40, EZ), (RY, RZ)), ((YB + 0.35, EZ + 0.2), (RY, RZ))):
        roof_shingles(rb, X0 - 0.4, X1 + 0.4, eave, ridge, [TAR, TAR2], sw=0.26, sl=0.34, t=0.03, rr=0.0,
                      under=TAR, seed=int(eave[0] * 7 + 9))
    rb.sweep([V((X0 - 0.4, RY, RZ + 0.06)), V((X1 + 0.4, RY, RZ + 0.06))], 0.09, TAR, n=8)
    up = lambda x: 0.35 * (abs(x) / 2.95) ** 3
    for v in rb.bm.verts:
        v.co.z += up(v.co.x)
    rb.bm.normal_update()
    obs_tmp.append(rb)
    # crossed bargeboards ending in carved dragon heads
    for x in (X0 - 0.42, X1 + 0.42):
        s = 1 if x > 0 else -1
        for side in (-1, 1):
            ye = YF - 0.40 if side < 0 else YB + 0.35
            ze = EZ + (0 if side < 0 else 0.2) + up(x)
            ztop = RZ + up(x)
            d = V((0, RY - ye, ztop - ze)).normalized()
            p_end = V((x, RY, ztop)) + d * 0.30
            pts = [V((x, ye, ze + 0.1)), V((x, RY, ztop + 0.1)), p_end + V((0, 0, 0.1))]
            b.sweep(pts, 0.05, TAR, n=6, ellipse=(0.5, 1.4), up=(1, 0, 0))
            # short neck curling outward (along the ridge axis) + carved head
            hd = p_end + V((0, 0, 0.1))
            out = V((s, 0, 0))
            neck = [hd, hd + d * 0.10 + out * 0.06 + V((0, 0, 0.05)), hd + d * 0.12 + out * 0.16 + V((0, 0, 0.10))]
            b.sweep(neck, [0.055, 0.05, 0.048], TAR, n=8, sub=2)
            hc = neck[-1] + out * 0.08
            Mh = Matrix.Translation(hc) @ V((0, 1, 0)).rotation_difference(out).to_matrix().to_4x4()
            b.ellipsoid((0, 0.05, 0), (0.06, 0.13, 0.065), TAR, 10, 6, M=Mh)                    # snout
            b.ellipsoid((0, 0.09, -0.05), (0.045, 0.09, 0.025), RED, 8, 5, M=Mh)                 # open jaw
            for e in (-1, 1):
                b.ellipsoid((e * 0.045, 0.0, 0.03), (0.014, 0.014, 0.014), YEL, 6, 4, M=Mh)       # eyes
                b.sweep([Mh @ V((e * 0.03, -0.04, 0.05)), Mh @ V((e * 0.05, -0.12, 0.13)),
                         Mh @ V((e * 0.06, -0.18, 0.14))], [0.016, 0.01, 0.003], TAR, n=5, sub=2)  # horns
    # half-log counter on blocks with carved knot band
    for x in (-1.6, 0.0, 1.6):
        plank(b, (x, YF - 0.25, 0.42), (0.3, 0.35, 0.84), LOG, r=0.03)
    hl = [(math.cos(a) * 0.22, math.sin(a) * 0.22) for a in np.linspace(0, math.pi, 10)]
    prism(b, [(p[0], p[1]) for p in hl], -2.0, 2.0, LOG,
          Mx=Matrix(((0, 0, 1, 0), (1, 0, 0, YF - 0.25), (0, 1, 0, 0.84), (0, 0, 0, 1))))
    for i in range(14):
        x = -1.82 + i * 0.28
        b.torus((x, YF - 0.47, 0.95), 0.045, 0.01, M('wood_dark'), nu=8, nv=4, axis='Y')
        b.torus((x + 0.14, YF - 0.47, 0.95), 0.03, 0.008, M('wood_dark'), nu=8, nv=4, axis='Y')
    # drinking horns on a rack, flatbread, bowls
    plank(b, (-1.0, YF - 0.25, 1.11), (0.7, 0.14, 0.05), M('wood_dark'), r=0.01)
    for k in range(4):
        x = -1.25 + k * 0.17
        pts = [V((x, YF - 0.25, 1.14)), V((x, YF - 0.25, 1.30)), V((x + 0.05, YF - 0.25, 1.42)),
               V((x + 0.12, YF - 0.25, 1.46))]
        b.sweep(pts, [0.035, 0.03, 0.018, 0.006], HORN, n=8, sub=2)
        b.torus(pts[0] + V((0, 0, 0.005)), 0.035, 0.005, M('pewter'), nu=10, nv=4, axis='Z')
    for k, x in enumerate((0.2, 0.45)):
        b.lathe([(0, 0.0), (0.0, 0.11), (0.012, 0.12), (0.014, 0.0)], mat("Flatbread", "#c8955a", rough=0.8), n=12,
                axis='Z', c=(x, YF - 0.25, 1.06 + k * 0.014))
    for x in (0.9, 1.2):
        b.lathe([(0, 0.05), (0.05, 0.09), (0.07, 0.1), (0.07, 0.085), (0.02, 0.04)], M('wood'), n=12, axis='Z',
                c=(x, YF - 0.25, 1.06), cap1=False)
    # mead vat (open) inside left
    cask(b, (-1.7, 0.45, 0.45), 0.9, 0.38, M('wood'), IR, axis='Z', lid=False)
    b.lathe([(0.82, 0.0), (0.82, 0.37)], mat("Mead", "#b8862a", rough=0.15), n=16, axis='Z', c=(-1.7, 0.45, 0))
    # shields on the back wall
    for i, x in enumerate((-0.9, 0.0, 0.9)):
        c = V((x, YB - 0.06, 1.25))
        for k in range(8):
            a0, a1 = k * math.pi / 4, (k + 1) * math.pi / 4
            wedge = [(0, 0)] + [(math.cos(a) * 0.34, math.sin(a) * 0.34) for a in np.linspace(a0, a1, 3)]
            prism(b, wedge, 0, 0.025, (RED if (k + i) % 2 else YEL) if i != 1 else (RED if k < 4 else M('wood_light')),
                  Mx=Matrix.Translation(c) @ Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1))))
        b.torus(c + V((0, -0.015, 0)), 0.34, 0.014, IR, nu=20, nv=4, axis='Y')
        b.ellipsoid(c + V((0, -0.03, 0)), (0.07, 0.04, 0.07), IR, 10, 6)
    # fur hides draped on the counter end and over a crate
    tmp = Builder()
    tmp.ellipsoid((0, 0, 0), (0.45, 0.32, 0.03), FUR, 12, 6)
    xform(tmp, Matrix.Translation((1.75, YF - 0.25, 1.07)) @ Matrix.Rotation(0.3, 4, 'Z'))
    obs_tmp.append(tmp)
    crate(b, (X1 - 0.35, 0.6, 0.22), (0.5, 0.45, 0.44), M('wood_grey'), TAR, yaw=0.2)
    tmp = Builder()
    tmp.ellipsoid((0, 0, 0), (0.4, 0.3, 0.04), mat("Fur_Grey", "#8a8378", rough=1.0, tex=tex('thatch')), 12, 6)
    xform(tmp, Matrix.Translation((X1 - 0.35, 0.6, 0.46)) @ Matrix.Rotation(-0.4, 4, 'Z'))
    obs_tmp.append(tmp)
    # smoked fish hanging from the front plate
    for k in range(6):
        x = 0.35 + k * 0.13
        b.sweep([V((x, YF, 1.88)), V((x, YF, 1.62 + 0.03 * (k % 2)))], 0.003, M('rope'), n=3)
        fish(b, (x, YF, 1.55 + 0.03 * (k % 2)), mat("Fish_Smoked", "#9a6a35", rough=0.4), s=0.9)
    # fire pit with tripod + cauldron (front right)
    fp = V((2.05, -1.05, 0.0))
    rr_ = random.Random(2)
    for k in range(9):
        a = 2 * math.pi * k / 9
        b.ellipsoid(fp + V((math.cos(a) * 0.38, math.sin(a) * 0.38, 0.06)), (0.11, 0.09, 0.08), M('stone_dk'), 7, 5,
                    M=None)
    for k in range(3):
        a = k * 2.1
        beam(b, fp + V((math.cos(a) * 0.25, math.sin(a) * 0.25, 0.06)), fp + V((-math.cos(a) * 0.2, -math.sin(a) * 0.2, 0.12)),
             0.07, 0.07, M('wood_dark'))
    flame(b, fp + V((0, 0, 0.08)), 1.3, M('flame'))
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.3
        b.sweep([fp + V((math.cos(a) * 0.5, math.sin(a) * 0.5, 0.0)), fp + V((0, 0, 1.15))], 0.014, IR, n=5)
    b.sweep([fp + V((0, 0, 1.15)), fp + V((0, 0, 0.72))], 0.004, IR, n=3)
    b.lathe([(0.45, 0.0), (0.47, 0.14), (0.55, 0.19), (0.68, 0.18), (0.72, 0.15), (0.72, 0.13)], IR, n=12, axis='Z',
            c=fp, cap1=False)
    INFO.setdefault('lanterns', []).append(fp + V((0, 0, 0.3)))
    # wall torches on the outer front posts
    for x, sx in ((X0, -1), (X1, 1)):
        tp = V((x + sx * 0.05, YF - 0.12, 1.25))
        b.sweep([V((x, YF - 0.1, 1.2)), tp + V((sx * 0.08, -0.12, 0.0))], 0.012, IR, n=4)
        b.lathe([(-0.25, 0.022), (0.05, 0.03), (0.05, 0.04), (0.14, 0.045)], M('wood_dark'), n=6, axis='Z',
                c=tp + V((sx * 0.1, -0.16, 0.0)))
        flame(b, tp + V((sx * 0.1, -0.16, 0.13)), 0.55, M('flame'))
        INFO['lanterns'].append(tp + V((sx * 0.1, -0.16, 0.25)))
    # name board hanging from the front plate
    sign_board(b, (-0.2, YF, 1.88), 0.8, 0.30, m_board=TAR)
    sack(b, (X0 + 0.35, 0.5, 0.0), M('sack'), M('rope'), yaw=0.5)
    finish("tavern-norse", [b, r] + obs_tmp)


def osteria():
    ST = mat("Stucco_Ochre", "#d9a066", rough=0.95, tex=tex('plaster'))
    TC = mat("Tile_Coppi", "#b5532e", rough=0.85, tex=tex('tiles'))
    BRK = mat("Brick", "#a5533a", rough=0.9, tex=tex('brick'))
    LIME = mat("Limestone", "#e2d8c4", rough=0.8, tex=tex('stone'))
    CHE = mat("Chestnut", "#6e4a2e", rough=0.85, tex=tex('wood'))
    LEAVES = [mat("Leaf_Red", "#a8331f", rough=0.8), mat("Leaf_Orange", "#c7681f", rough=0.8),
              mat("Leaf_Yellow", "#d6a531", rough=0.8), mat("Leaf_Green", "#6e7f3a", rough=0.8)]
    GRAPE = mat("Grape", "#5a2a4a", rough=0.35)
    b, r = Builder(), Builder()
    X0, X1, YW, YB = -2.35, 2.35, 0.05, 1.25
    plank(b, (0, (YW + YB) / 2, 0.06), (X1 - X0, YB - YW + 0.2, 0.12), LIME, r=0.02)
    # stucco walls (back + sides) with a stone plinth
    masonry(b, (0, YB, 1.35), (X1 - X0 + 0.3, 0.3, 2.7), ST, r=0.04)
    for x in (X0, X1):
        masonry(b, (x, (YW + YB) / 2, 1.3), (0.3, YB - YW, 2.6), ST, r=0.04)
        plank(b, (x, (YW + YB) / 2, 0.15), (0.34, YB - YW + 0.04, 0.3), LIME, r=0.02)
    # arched niche in the back wall with bottle shelves
    niche = [(math.cos(a) * 0.45, 1.75 + math.sin(a) * 0.45) for a in np.linspace(0, math.pi, 12)]
    poly = [(-0.45, 0.95)] + [(x, z) for x, z in reversed(niche)][::-1][::-1]
    wall_xz(b, [(0.45, 0.95)] + niche + [(-0.45, 0.95)], YB - 0.16, 0.02, mat("Niche_Dark", "#5a3a26", rough=0.9))
    arch = [V((math.cos(a) * 0.52, YB - 0.17, 1.75 + math.sin(a) * 0.52)) for a in np.linspace(0, math.pi, 12)]
    b.sweep([V((0.52, YB - 0.17, 0.92))] + arch + [V((-0.52, YB - 0.17, 0.92))], 0.06, LIME, n=6, ellipse=(1.0, 0.6))
    for z in (1.25, 1.65):
        plank(b, (0, YB - 0.28, z), (0.86, 0.22, 0.03), CHE, r=0.006, seg=1)
        for k in range(5):
            bottle(b, (-0.32 + k * 0.16, YB - 0.28, z + 0.015), M('glass_green') if k % 2 else mat("Glass_Wine", "#4a1f2a",
                                                                                                    rough=0.12), h=0.25)
    # coppi mono-pitch roof (low at the front)
    roof_slab(r, X0 - 0.3, X1 + 0.3, (YW - 0.3, 2.55), (YB + 0.3, 3.05), TC, thick=0.08, lump=0.0, tile_wave=0.045,
              tile_w=0.17, overhang_round=False)
    # pergola with autumn vine over the front
    for x in (X0, -0.8, 0.8, X1):
        round_post(b, x, -1.25, 0.0, 2.45, 0.075, CHE, n=8)
        b.lathe([(-1.35, 0.06), (YW + 0.1, 0.06)], CHE, n=8, axis='Y', c=(x, 0, 2.45), uv=G('y'))
    for y in np.linspace(-1.25, YW, 5):
        b.lathe([(X0 - 0.25, 0.04), (X1 + 0.25, 0.04)], CHE, n=6, axis='X', c=(0, y, 2.53), uv=G('x'))
    rv = random.Random(4)
    for i in range(26):
        c = V((rv.uniform(X0 - 0.1, X1 + 0.1), rv.uniform(-1.32, -0.45), 2.55))
        leaf_cluster(b, c, 0.30, LEAVES, n=34, seed=i, size=0.09, flat=0.18)
    for i in range(14):    # drooping vine tendrils off the front beam
        x = rv.uniform(X0, X1)
        for k in range(4):
            leaf_cluster(b, (x + rv.uniform(-0.05, 0.05), -1.28, 2.42 - k * 0.12), 0.07, LEAVES, n=6, seed=i * 7 + k,
                         size=0.08, flat=0.2)
    for i in range(9):
        c = V((rv.uniform(X0 + 0.3, X1 - 0.3), rv.uniform(-1.2, -0.1), 2.38))
        for k in range(9):
            b.ellipsoid(c + V((rv.uniform(-0.04, 0.04), rv.uniform(-0.04, 0.04), -k * 0.018)),
                        (0.022, 0.022, 0.022), GRAPE, 6, 4)
    for x in (X0, X1):     # vine trunks up the outer posts
        b.sweep([V((x + 0.08, -1.2, 0.0)), V((x + 0.1, -1.15, 1.0)), V((x + 0.06, -1.2, 2.0)), V((x, -1.0, 2.55))],
                0.03, mat("Vine_Wood", "#5a4430", rough=0.9), n=6, sub=2)
    # brick counter with limestone top
    masonry(b, (-0.3, -0.35, 0.5), (2.6, 0.5, 1.0), BRK, r=0.02)
    plank(b, (-0.3, -0.38, 1.03), (2.75, 0.62, 0.07), LIME, r=0.02)
    # fiaschi hanging from the front beam
    for k in range(7):
        x = -1.9 + k * 0.6 if k < 3 else 0.6 + (k - 3) * 0.4
        c = V((x, -1.25, 1.95))
        b.sweep([V((x, -1.25, 2.4)), c + V((0, 0, 0.22))], 0.004, M('rope'), n=3)
        b.lathe([(0.0, 0.0), (0.01, 0.06), (0.06, 0.085), (0.12, 0.07), (0.15, 0.03)], M('straw'), n=10, axis='Z', c=c)
        b.lathe([(0.15, 0.03), (0.17, 0.016), (0.24, 0.014), (0.25, 0.0)], M('glass_green'), n=8, axis='Z', c=c)
    # frasca (olive branch bundle) over the entrance + ham, salami, garlic
    b.sweep([V((X1, -1.25, 2.2)), V((X1 + 0.35, -1.3, 2.2))], 0.012, IR, n=5)
    leaf_cluster(b, (X1 + 0.38, -1.3, 2.0), 0.18, [mat("Olive_Leaf", "#6e7f3a", rough=0.8), mat("Olive_Leaf2", "#8a9a5a",
                                                                                                   rough=0.8)],
                 n=26, seed=9, size=0.05, flat=0.25)
    HAM = M('ham')
    for x in (-1.3, -1.05):
        b.sweep([V((x, -0.1, 2.5)), V((x, -0.1, 2.05))], 0.004, M('rope'), n=3)
        b.lathe([(0.0, 0.015), (0.08, 0.04), (0.25, 0.10), (0.38, 0.09), (0.45, 0.0)], HAM, n=10, axis='Z',
                M=Matrix.Translation((x, -0.1, 1.6)) @ Matrix.Rotation(0.15, 4, 'Y'), ellipse=(1.0, 0.7))
    hanging_string(b, (-0.7, -0.1, 2.5), 4, mat("Salami", "#7a2e26", rough=0.6), M('rope'), gap=0.12, kind='sausage',
                   size=0.025)
    hanging_string(b, (-0.45, -0.1, 2.5), 7, mat("Garlic", "#efe8d6", rough=0.7), M('rope'), gap=0.06, size=0.03)
    # cheese wheel, bread basket, terracotta cups & jug on the counter
    c = V((-1.3, -0.4, 1.07))
    b.lathe([(0, 0.0), (0, 0.17), (0.01, 0.18), (0.09, 0.18), (0.1, 0.17), (0.1, 0.0)], M('cheese'), n=16, axis='Z', c=c)
    b.lathe([(0, 0.0), (0, 0.12), (0.1, 0.16), (0.1, 0.15), (0.01, 0.11)], M('straw'), n=12, axis='Z',
            c=(-0.85, -0.4, 1.07), cap1=False)
    for k in range(3):
        b.ellipsoid((-0.9 + k * 0.05, -0.4 + (k - 1) * 0.05, 1.15), (0.07, 0.05, 0.04), M('bread'), 8, 5)
    for k in range(4):
        b.lathe([(0, 0.032), (0.08, 0.04), (0.08, 0.036), (0.01, 0.028)], M('terracotta'), n=10, axis='Z',
                c=(-0.4 + k * 0.13, -0.5, 1.07), cap1=False)
    jug(b, (0.3, -0.4, 1.07), M('terracotta'), h=0.28, r=0.09)
    # barrique pyramid, olive-oil jar, lemon tree
    cask_stack(b, (1.65, 0.6, 0.12), 0.2, 0.5, M('wood'), IR, axis='Y', n_bottom=2)
    b.lathe([(0, 0.15), (0.1, 0.25), (0.4, 0.3), (0.65, 0.22), (0.75, 0.13), (0.8, 0.15), (0.82, 0.0)],
            M('terracotta'), n=14, axis='Z', c=(X0 + 0.15, -0.95, 0))
    lp = V((X1 - 0.2, -0.95, 0))
    b.lathe([(0, 0.13), (0.3, 0.18), (0.32, 0.2), (0.34, 0.0)], M('terracotta'), n=12, axis='Z', c=lp)
    b.sweep([lp + V((0, 0, 0.3)), lp + V((0.02, 0, 0.75))], 0.025, mat("Vine_Wood", "#5a4430", rough=0.9), n=5)
    leaf_cluster(b, lp + V((0, 0, 0.95)), 0.22, [mat("Lemon_Leaf", "#3f5a2a", rough=0.7)], n=26, seed=3, size=0.06)
    for k in range(7):
        a = k * 0.9
        b.ellipsoid(lp + V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.85 + 0.1 * math.sin(k))), (0.03, 0.03, 0.035),
                    mat("Lemon", "#e8c22e", rough=0.5), 7, 5)
    # name board hanging under the pergola + iron lanterns
    sign_board(b, (0.0, -1.25, 2.38), 0.9, 0.34, m_board=CHE)
    lanterns_at(b, [V((-1.55, -1.25, 2.38)), V((1.55, -1.25, 2.38))], style='box', hang=0.25)
    menu_board(b, (X0 + 0.15, -0.35, 0.0), 0.6, CHE, M('chalk'), s=0.8)
    finish("tavern-osteria", [b, r] + obs_tmp)


def venta():
    WH = mat("Whitewash", "#f5f2ea", rough=0.95, tex=tex('plaster'))
    TL = mat("Tile_Red", "#b04a2e", rough=0.85, tex=tex('tiles'))
    TG = mat("Tile_Green", "#3f6b4c", rough=0.6, tex=tex('tiles'))
    COB = mat("Paint_Cobalt", "#2d5c8a", rough=0.6, tex=tex('wood'))
    AZ = mat("Azulejo", "#ffffff", rough=0.3, tex=tex('azulejo'))
    OAK = mat("Sherry_Oak", "#c9883a", rough=0.7, tex=tex('wood'))
    BRK = mat("Brick", "#a5533a", rough=0.9, tex=tex('brick'))
    LEA = M('leather')
    b, r = Builder(), Builder()
    X0, X1, YF, YB, H = -2.45, 2.45, -0.85, 1.25, 2.6
    arches = [(-1.6, 1.05, 1.15), (0.0, 1.3, 1.1), (1.6, 1.05, 1.15)]
    wall_arches(b, X0, X1, YF, 0.40, H, arches, WH, uvs=0.8)
    for x in (X0, X1):                                   # rounded corners
        b.lathe([(0, 0.2), (H, 0.2)], WH, n=10, axis='Z', c=(x, YF + 0.2, 0), uv=None)
    for x in (X0, X1):
        masonry(b, (x, (YF + YB) / 2 + 0.2, H / 2), (0.40, YB - YF - 0.4, H), WH, r=0.06)
    masonry(b, (0, YB, H / 2), (X1 - X0 + 0.4, 0.4, H), WH, r=0.06)
    b.lathe([(0, 0.21), (H, 0.21)], WH, n=10, axis='Z', c=(X0, YB, 0))
    b.lathe([(0, 0.21), (H, 0.21)], WH, n=10, axis='Z', c=(X1, YB, 0))
    plank(b, (0, YF + 0.2, 0.05), (X1 - X0 + 0.5, 0.5, 0.1), mat("Ochre_Base", "#c9a06a", rough=0.9, tex=tex('plaster')),
          r=0.02)
    # low red tile roof with a few green tiles
    roof_slab(r, X0 - 0.35, X1 + 0.35, (YF - 0.30, H + 0.02), (YB + 0.25, H + 0.45), TL, thick=0.07, lump=0.0,
              tile_wave=0.04, tile_w=0.17, overhang_round=False)
    for (xa, xb) in ((-1.9, -1.55), (0.7, 0.88), (1.9, 2.25)):
        roof_slab(r, xa, xb, (YF - 0.29, H + 0.04), (YF + 0.6, H + 0.2), TG, thick=0.07, lump=0.0, tile_wave=0.04,
                  tile_w=0.17, overhang_round=False)
    # tile-framed name panel above the middle arch
    b.rbox((0, YF - 0.02, 2.2), (1.15, 0.04, 0.42), AZ, r=0.01, uv=('box', 2.0))
    INFO['sign'] = (V((0, YF - 0.042, 2.2)), 0.95, 0.28)
    # counter in the middle arch: whitewashed with an azulejo band, wood top
    masonry(b, (0, YF + 0.2, 0.5), (1.3, 0.4, 1.0), WH, r=0.03)
    b.rbox((0, YF - 0.005, 0.8), (1.28, 0.02, 0.22), AZ, r=0.004, seg=1, uv=('box', 2.0))
    plank(b, (0, YF + 0.12, 1.04), (1.45, 0.62, 0.07), OAK, r=0.015)
    # sherry solera (3 tiers) behind the left arch
    for tier, n in enumerate((3, 2, 1)):
        for k in range(n):
            x = -1.6 + (k - (n - 1) / 2) * 0.44
            cask(b, (x, 0.45, 0.24 + tier * 0.41), 0.6, 0.2, OAK, M('iron'), axis='Y')
            b.rbox((x, 0.15 - 0.005, 0.24 + tier * 0.41 + 0.05), (0.08, 0.005, 0.03), M('cloth_white'), r=0.0, seg=0)
    # cobalt door leaves open at the left arch, iron grille + geraniums at the right arch
    for sd in (-1, 1):
        plank(b, (-1.6 + sd * 0.76, YF - 0.035, 0.85), (0.44, 0.04, 1.62), COB, r=0.01)
        for z in (0.35, 1.35):
            b.rbox((-1.6 + sd * 0.62, YF - 0.06, z), (0.16, 0.012, 0.025), IR, r=0.003, seg=1)
    for k in range(9):
        x = 1.6 - 0.45 + k * 0.1125
        z_top = 1.15 + math.sqrt(max(0, 0.52 ** 2 - (x - 1.6) ** 2)) - 0.03
        b.sweep([V((x, YF + 0.05, 0.5)), V((x, YF + 0.05, z_top))], 0.008, IR, n=4)
    for z in (0.5, 1.0):
        b.sweep([V((1.12, YF + 0.05, z)), V((2.08, YF + 0.05, z))], 0.01, IR, n=4)
    masonry(b, (1.6, YF + 0.2, 0.25), (1.05, 0.42, 0.5), BRK, r=0.02)
    for k in range(3):
        c = V((1.3 + k * 0.3, YF - 0.05, 0.5))
        b.lathe([(0, 0.06), (0.14, 0.09), (0.15, 0.0)], M('terracotta'), n=10, axis='Z', c=c)
        leaf_cluster(b, c + V((0, 0, 0.2)), 0.08, [M('green')], n=8, seed=k, size=0.04)
        leaf_cluster(b, c + V((0, 0, 0.26)), 0.07, [mat("Geranium", "#c4231c", rough=0.6)], n=6, seed=k + 9, size=0.03,
                     flat=0.8)
    # wall pots on hooks + ristras + lanterns on brackets
    for x in (-2.15, -0.8, 0.8, 2.15):
        b.sweep([V((x, YF, 1.7)), V((x, YF - 0.12, 1.7))], 0.008, IR, n=4)
        b.lathe([(0, 0.06), (0.13, 0.08), (0.14, 0.0)], mat("Pot_Blue", "#2d5c8a", rough=0.4), n=10, axis='Z',
                c=(x, YF - 0.15, 1.6))
        leaf_cluster(b, (x, YF - 0.15, 1.82), 0.08, [mat("Geranium", "#c4231c", rough=0.6), M('green')], n=10, seed=int(x * 10),
                     size=0.035)
    for x in (-0.82, 0.82):
        hanging_string(b, (x, YF - 0.05, 1.35), 7, mat("Chili", "#b3241a", rough=0.5), M('rope'), gap=0.07, kind='chili',
                       size=0.04)
    lanterns_at(b, [V((-0.8, YF - 0.38, 2.42)), V((0.8, YF - 0.38, 2.42))], style='box', hang=0.02)
    for x in (-0.8, 0.8):
        b.sweep([V((x, YF, 2.42)), V((x, YF - 0.25, 2.48)), V((x, YF - 0.38, 2.44))], 0.01, IR, n=5, sub=2)
    # botas + jamón hanging inside the middle arch
    for k, x in enumerate((-0.35, -0.12)):
        b.sweep([V((x, YF + 0.2, 1.9)), V((x, YF + 0.2, 1.62))], 0.004, M('rope'), n=3)
        b.ellipsoid((x, YF + 0.2, 1.48), (0.08, 0.035, 0.13), LEA, 10, 6)
    b.lathe([(0.0, 0.015), (0.08, 0.04), (0.25, 0.10), (0.38, 0.09), (0.45, 0.0)], M('ham'), n=10, axis='Z',
            M=Matrix.Translation((0.35, YF + 0.2, 1.3)) @ Matrix.Rotation(0.15, 4, 'Y'), ellipse=(1.0, 0.7))
    b.sweep([V((0.35, YF + 0.2, 1.9)), V((0.35, YF + 0.2, 1.75))], 0.004, M('rope'), n=3)
    # tinaja + botijo jars outside, horse ring
    b.lathe([(0, 0.12), (0.15, 0.25), (0.45, 0.3), (0.75, 0.22), (0.85, 0.14), (0.9, 0.16), (0.92, 0.0)],
            M('terracotta'), n=14, axis='Z', c=(X0 + 0.05, YF - 0.35, 0))
    b.lathe([(0, 0.08), (0.12, 0.14), (0.25, 0.12), (0.32, 0.03), (0.36, 0.0)], mat("Clay_Pale", "#d9b48a", rough=0.8),
            n=12, axis='Z', c=(X1 - 0.1, YF - 0.3, 0))
    b.torus((X1 - 0.6, YF - 0.03, 1.0), 0.05, 0.008, IR, nu=10, nv=4, axis='Y')
    cups = [(0.25, YF + 0.1), (0.4, YF + 0.0)]
    for x, y in cups:
        tankard(b, (x, y, 1.075), M('clay_glaze'), None, pewter=True, h=0.11, r=0.04)
    finish("tavern-venta", [b, r] + obs_tmp)


def flemish():
    BRK = mat("Brick_Flemish", "#8a3b2b", rough=0.9, tex=tex('brick'))
    LIME = mat("Limestone", "#d8cfc0", rough=0.8, tex=tex('stone'))
    SL = mat("Slate", "#3b4048", rough=0.6)
    SL2 = mat("Slate_Light", "#4a505a", rough=0.6)
    HOP = mat("Hop_Green", "#5f7f5a", rough=0.7, tex=tex('wood'))
    CU = M('copper')
    b, r = Builder(), Builder()
    X0, X1, YF, YB, H = -2.25, 2.25, -0.75, 1.30, 2.7
    arches = [(-1.05, 1.45, 1.15), (1.05, 1.45, 1.15)]
    wall_arches(b, X0, X1, YF, 0.32, H, arches, BRK, uvs=1.0)
    # stepped gable above
    steps = 5
    top = 4.35
    poly = [(X0, H)]
    for k in range(steps):
        x = X0 + (k + 1) * (abs(X0) - 0.3) / steps
        z = H + (k + 1) * (top - H) / steps
        poly += [(poly[-1][0], z), (x, z)]
    right = [(-x, z) for x, z in reversed(poly)]
    gpoly = poly + [(0.3, top)] + right[1:]
    gpoly = [p for i, p in enumerate(gpoly) if i == 0 or (abs(p[0] - gpoly[i - 1][0]) > 1e-6 or abs(p[1] - gpoly[i - 1][1]) > 1e-6)]
    wall_xz(b, [(X0, H)] + [p for p in gpoly[1:-1]] + [(X1, H)], YF, 0.32, BRK)
    for k in range(steps):
        x = X0 + k * (abs(X0) - 0.3) / steps
        z = H + (k + 1) * (top - H) / steps
        for s in (-1, 1):
            plank(b, (s * (abs(x) - (abs(X0) - 0.3) / steps / 2), YF + 0.16, z + 0.03),
                  ((abs(X0) - 0.3) / steps + 0.06, 0.40, 0.06), LIME, r=0.01)
    plank(b, (0, YF + 0.16, top + 0.04), (0.7, 0.42, 0.08), LIME, r=0.012)
    for z in (H, 1.95):
        plank(b, (0, YF - 0.01, z), (X1 - X0 + 0.04, 0.08, 0.1), LIME, r=0.01)
    # wall anchors (iron S) + hoisting beam with pulley and malt sack
    for x in (-1.6, 1.6, -0.9, 0.9):
        z = 3.2 if abs(x) > 1 else 3.75
        b.sweep([V((x - 0.06, YF - 0.02, z + 0.12)), V((x + 0.06, YF - 0.03, z + 0.05)), V((x - 0.06, YF - 0.03, z - 0.05)),
                 V((x + 0.06, YF - 0.02, z - 0.12))], 0.012, IR, n=4, sub=2)
    beam(b, (0, YF + 0.1, 4.0), (0, YF - 0.75, 4.0), 0.12, 0.14, M('wood_dark'))
    b.lathe([(-0.03, 0.08), (0.03, 0.08)], M('wood'), n=12, axis='X', c=(0, YF - 0.62, 3.88))
    b.sweep([V((0, YF - 0.7, 3.85)), V((0, YF - 0.7, 3.05))], 0.008, M('rope'), n=4)
    sack(b, (0, YF - 0.7, 2.72), M('sack'), M('rope'), s=0.7)
    # slate roof behind the gable (ridge along Y)
    for s in (-1, 1):
        tmp = Builder()
        roof_shingles(tmp, YF + 0.3, YB + 0.25, (s * (X1 + 0.25), H - 0.1), (0, 3.95), [SL, SL2], sw=0.22, sl=0.28,
                      t=0.015, under=M('wood_dark'), seed=3 + s)
        xform(tmp, SWAPXY)
        obs_tmp.append(tmp)
    r.sweep([V((0, YF + 0.3, 4.0)), V((0, YB + 0.25, 4.0))], 0.06, SL, n=6)
    for x in (X0, X1):
        masonry(b, (x + (0.16 if x < 0 else -0.16), (YF + YB) / 2 + 0.16, H / 2), (0.32, YB - YF - 0.32, H), BRK, r=0.02)
    masonry(b, (0, YB - 0.16, H / 2), (X1 - X0, 0.32, H), BRK, r=0.02)
    for s in (-1, 1):
        wall_xz(b, [(s * X1, H), (0, 3.95), (s * X1 * 0.01, H)], YB - 0.3, 0.3, BRK)
    wall_xz(b, [(X0, H), (0, 3.92), (X1, H)], YB - 0.3, 0.3, BRK)
    # green arch frames + drop-down shutter counters
    for xc, w, hs in arches:
        rad = w / 2 - 0.03
        pts = [V((xc + rad, YF + 0.05, 1.0))] + [V((xc + math.cos(a) * rad, YF + 0.05, hs + math.sin(a) * rad))
                                                  for a in np.linspace(0, math.pi, 12)] + [V((xc - rad, YF + 0.05, 1.0))]
        b.sweep(pts, 0.035, HOP, n=6, ellipse=(1.0, 0.6))
        masonry(b, (xc, YF + 0.16, 0.5), (w, 0.32, 1.0), BRK, r=0.02)
        plank(b, (xc, YF - 0.25, 1.0), (w - 0.1, 0.55, 0.05), HOP, r=0.01)
        for s in (-1, 1):
            b.sweep([V((xc + s * (w / 2 - 0.08), YF, 1.55)), V((xc + s * (w / 2 - 0.08), YF - 0.5, 1.03))], 0.005, IR, n=3)
        # hop garland over the arch
        g = [V((xc + math.cos(a) * (rad + 0.12), YF - 0.06, hs + math.sin(a) * (rad + 0.12))) for a in np.linspace(0.2, math.pi - 0.2, 7)]
        for k, p in enumerate(g):
            leaf_cluster(b, p, 0.07, [mat("Hop_Leaf", "#6f8f3a", rough=0.7), mat("Hop_Cone", "#a9b85a", rough=0.7)], n=7,
                         seed=k + int(xc * 10), size=0.04)
    # tap barrel behind the right arch, jugs & römers on the shutters, herring + bread + cheese
    plank(b, (1.05, YF + 0.55, 0.6), (1.2, 0.5, 0.06), M('wood_dark'), r=0.01)
    tap_barrel(b, (1.05, YF + 0.55, 0.6 + 0.27), M('wood'), IR, M('brass'), length=0.5, r=0.2)
    for k in range(3):
        jug(b, (-1.5 + k * 0.22, YF - 0.3, 1.025), mat("Stoneware_Brown", "#6b4a2e", rough=0.3), h=0.24, r=0.075)
    for k in range(4):
        goblet(b, (-0.85 + k * 0.12, YF - 0.35, 1.025), mat("Glass_Romer", "#5f8a4a", rough=0.1), h=0.14)
    for k in range(4):
        x = 0.62 + k * 0.12
        b.sweep([V((x, YF - 0.05, 1.95)), V((x, YF - 0.05, 1.68))], 0.003, M('rope'), n=3)
        fish(b, (x, YF - 0.05, 1.6), mat("Herring", "#b8b0a0", rough=0.3), s=0.8)
    bread_cheese(b, (1.3, YF - 0.3, 1.025))
    # copper brew kettle on a brick firebox (front left)
    kc = V((-1.75, -1.1, 0.0))
    b.lathe([(0, 0.32), (0.45, 0.32)], BRK, n=10, axis='Z', c=kc, uv=None)
    b.lathe([(0.45, 0.25), (0.5, 0.33), (0.75, 0.36), (0.95, 0.30), (1.02, 0.18), (1.04, 0.19), (1.04, 0.0)], CU, n=16,
            axis='Z', c=kc)
    b.sweep([kc + V((0, 0, 1.03)), kc + V((0, 0, 1.4)), kc + V((0.15, 0.25, 1.9)), kc + V((0.3, 0.8, 2.2))],
            0.05, CU, n=10, sub=3)
    b.rbox(kc + V((0, -0.33, 0.18)), (0.22, 0.04, 0.18), mat("Firebox_Glow", "#ff8a3a", rough=0.5, emit="#ff6a1a",
                                                              emit_strength=2.5), r=0.01)
    INFO.setdefault('lanterns', []).append(kc + V((0, -0.4, 0.2)))
    # guild sign (shield with crossed malt shovel and mash rake) + blank name board on the facade
    beam(b, (X1, YF, 2.3), (X1, YF - 0.75, 2.3), 0.05, 0.06, IR)
    gc = hanging_sign(b, (X1, YF - 0.5, 2.28), 0.5, 0.6, M('wood_dark'), IR, style='shield')
    Mt = rot(gc, 'Y', 0.6)
    b.seg_box(gc + V((-0.15, -0.035, -0.18)), gc + V((0.15, -0.035, 0.18)), 0.025, 0.012, M('wood_light'), r=0.004,
              up=(0, -1, 0))
    b.rbox(gc + V((0.13, -0.04, 0.16)), (0.08, 0.012, 0.1), M('wood_light'), r=0.008)
    b.seg_box(gc + V((0.15, -0.035, -0.18)), gc + V((-0.15, -0.035, 0.18)), 0.025, 0.012, IR, r=0.004, up=(0, -1, 0))
    for k in range(4):
        b.seg_box(gc + V((-0.19 + k * 0.03, -0.04, 0.12 + k * 0.03)), gc + V((-0.13 + k * 0.03, -0.04, 0.18 + k * 0.03 - 0.06)),
                  0.01, 0.01, IR, r=0.0, seg=0, up=(0, -1, 0))
    b.rbox((0, YF - 0.02, 2.32), (1.2, 0.04, 0.42), M('wood_dark'), r=0.015, uv=G('x'))
    INFO['sign'] = (V((0, YF - 0.042, 2.32)), 1.02, 0.30)
    lanterns_at(b, [V((0, YF - 0.3, 1.9))], style='box', hang=0.0)
    b.sweep([V((0, YF, 1.95)), V((0, YF - 0.3, 1.95))], 0.01, IR, n=4)
    crate(b, (X1 + 0.12, -0.2, 0.22), (0.45, 0.45, 0.44), M('wood'), M('wood_dark'), yaw=0.3)
    cask(b, (X1 + 0.15, 0.45, 0.3), 0.6, 0.2, M('wood'), IR, axis='Z')
    finish("tavern-flemish", [b, r] + obs_tmp)


def tent():
    CR = mat("Canvas_Cream", "#efe3c6", rough=0.95, tex=tex('canvas'))
    STR = mat("Canvas_StripeRed", "#ffffff", rough=0.95, tex=tex('stripes'))
    RED = mat("Heraldic_Red", "#b3282d", rough=0.85, tex=tex('cloth'))
    GRN = mat("Heraldic_Green", "#2e6a4f", rough=0.85, tex=tex('cloth'))
    GLD = mat("Heraldic_Gold", "#d8a93b", rough=0.6)
    POLE = mat("Ash_Pole", "#6a4b32", rough=0.8, tex=tex('wood'))
    b, r = Builder(), Builder()
    C = V((0, 0.2, 0))
    R, WH, APEX = 1.6, 1.9, 3.75
    # walls: back 3/4 of a cylinder (front open)
    a0, a1 = math.radians(-35), math.radians(215)
    n = 28
    verts, faces = [], []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        for z in (0.0, WH):
            verts.append(C + V((math.cos(a) * R, math.sin(a) * R, z)))
    for i in range(n):
        faces.append((i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1))
    bv, bf = b.add(verts, faces, STR)
    cyl_uv(b, bf, C, ku=6.0, kv=0.5)
    # cone roof
    bv, bf = r.lathe([(WH - 0.05, R + 0.12), (WH + 0.6, R * 0.7), (APEX - 0.4, 0.3), (APEX, 0.02)], STR, n=32, axis='Z',
                     c=(C.x, C.y, 0), cap0=False, cap1=True)
    cyl_uv(r, bf, C, ku=6.0, kv=0.5)
    # dagged valance
    nd = 30
    for i in range(nd):
        a = 2 * math.pi * (i + 0.5) / nd
        p = C + V((math.cos(a) * (R + 0.13), math.sin(a) * (R + 0.13), WH - 0.05))
        tri = [(-0.17, 0.0), (0.17, 0.0), (0.0, -0.28)]
        prism(b, tri, -0.006, 0.006, RED if i % 2 else GRN,
              Mx=Matrix.Translation(p) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix(((1, 0, 0, 0), (0, 0, 1, 0),
                                                                                           (0, 1, 0, 0), (0, 0, 0, 1))))
    b.torus(C + V((0, 0, WH - 0.05)), R + 0.13, 0.025, GLD, nu=36, nv=4, axis='Z')
    # centre pole + pennant
    b.lathe([(0, 0.06), (APEX + 0.6, 0.04)], POLE, n=8, axis='Z', c=(C.x, C.y, 0), uv=G('z'))
    b.ellipsoid(C + V((0, 0, APEX + 0.62)), (0.06, 0.06, 0.06), GLD, 8, 5)
    tmp = Builder()
    prism(tmp, [(0, 0), (1.1, -0.12), (0, -0.30)], -0.006, 0.006, RED)
    xform(tmp, Matrix.Translation(C + V((0, 0, APEX + 0.55))) @ Matrix.Rotation(-0.5, 4, 'Z') @
          Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
    obs_tmp.append(tmp)
    # front awning on two poles
    yA = -1.95
    for x in (-1.95, 1.95):
        b.lathe([(0, 0.045), (2.3, 0.04)], POLE, n=8, axis='Z', c=(x, yA, 0), uv=G('z'))
        b.ellipsoid((x, yA, 2.33), (0.05, 0.05, 0.05), GLD, 8, 5)
        b.sweep([V((x, yA, 2.25)), V((x * 1.25, yA - 0.35, 0.0))], 0.006, M('rope'), n=3)
    av, af = [], []
    nx = 14
    for j, (y, z) in enumerate(((C.y - R * 0.55, WH + 0.35), (yA, 2.2))):
        for i in range(nx + 1):
            x = -1.95 + 3.9 * i / nx
            sag = 0.08 * math.sin(math.pi * i / nx) if j == 1 else 0.0
            av.append(V((x, y, z - sag)))
    for i in range(nx):
        af.append((i, i + 1, nx + 1 + i + 1, nx + 1 + i))
    bv, bf = b.add(av, af, STR)
    for f in bf:
        for l in f.loops:
            l[b.uvl].uv = (l.vert.co.x * 1.0, l.vert.co.y * 0.5)
    for i in range(nx):
        x = -1.95 + 3.9 * (i + 0.5) / nx
        tri = [(-0.14, 0.0), (0.14, 0.0), (0.0, -0.24)]
        prism(b, tri, -0.006, 0.006, RED if i % 2 else GRN,
              Mx=Matrix.Translation((x, yA - 0.01, 2.2 - 0.08 * math.sin(math.pi * (i + 0.5) / nx))) @
              Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
    # bunting between the awning poles
    bpts = [V((-1.95 + 3.9 * i / 12, yA - 0.02, 2.0 - 0.25 * math.sin(math.pi * i / 12))) for i in range(13)]
    b.sweep(bpts, 0.004, M('rope'), n=3)
    for i in range(12):
        p = (bpts[i] + bpts[i + 1]) / 2
        prism(b, [(-0.1, 0.0), (0.1, 0.0), (0.0, -0.2)], -0.004, 0.004, [RED, GLD, GRN, CR][i % 4],
              Mx=Matrix.Translation(p) @ Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
    # guy ropes at the back
    for a in np.linspace(math.radians(20), math.radians(160), 4):
        p0 = C + V((math.cos(a) * (R + 0.1), math.sin(a) * (R + 0.1), WH))
        p1 = C + V((math.cos(a) * (R + 0.55), math.sin(a) * min(R + 0.55, 1.2), 0.05))
        b.sweep([p0, p1], 0.006, M('rope'), n=3)
        b.lathe([(-0.02, 0.02), (0.15, 0.025)], POLE, n=5, axis='Z', c=p1)
    # trestle counter (two planks) with small casks, funnel, bowls, quaichs
    for x in (-1.0, 1.0):
        for s in (-1, 1):
            beam(b, (x, -0.95 + s * 0.2, 0.0), (x, -0.95, 0.95), 0.06, 0.05, POLE, up=(1, 0, 0))
        plank(b, (x, -0.95, 0.9), (0.08, 0.5, 0.06), POLE, r=0.01)
    for k in range(2):
        plank(b, (0, -1.07 + k * 0.25, 0.97), (2.6, 0.24, 0.05), M('wood_grey'), r=0.012)
    for x in (-0.9, -0.45):
        cask(b, (x, -0.95, 1.0 + 0.19), 0.42, 0.16, M('wood'), IR, axis='Y')
    b.lathe([(0, 0.008), (0.07, 0.01), (0.14, 0.07), (0.15, 0.07)], M('pewter'), n=10, axis='Z', c=(0.0, -1.0, 0.995),
            cap1=False)
    for k in range(3):
        c = V((0.35 + k * 0.2, -1.0, 0.995))
        b.lathe([(0, 0.03), (0.02, 0.06), (0.04, 0.07), (0.04, 0.064), (0.01, 0.03)], M('wood'), n=10, axis='Z', c=c,
                cap1=False)
        for s in (-1, 1):
            b.rbox(c + V((s * 0.085, 0, 0.035)), (0.04, 0.03, 0.01), M('wood'), r=0.004, seg=1)
    for k in range(3):
        b.lathe([(0, 0.03), (0.09, 0.038), (0.09, 0.034), (0.01, 0.026)], M('clay'), n=10, axis='Z',
                c=(0.95 + k * 0.1, -0.85, 0.995), cap1=False)
    # brazier with a spit of meat skewers (front left)
    bz = V((-1.85, -1.05, 0.0))
    for k in range(3):
        a = k * 2.094 + 0.4
        b.sweep([bz + V((math.cos(a) * 0.28, math.sin(a) * 0.28, 0)), bz + V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.62))],
                0.014, IR, n=5)
    b.lathe([(0.55, 0.06), (0.62, 0.2), (0.75, 0.3), (0.76, 0.3)], IR, n=14, axis='Z', c=bz, cap1=False)
    flame(b, bz + V((0, 0, 0.66)), 0.9, M('flame'))
    for s in (-1, 1):
        b.sweep([bz + V((s * 0.38, 0, 0.6)), bz + V((s * 0.38, 0, 0.98))], 0.012, IR, n=4)
    b.sweep([bz + V((-0.45, 0, 0.95)), bz + V((0.45, 0, 0.95))], 0.008, IR, n=4)
    for k in range(4):
        b.ellipsoid(bz + V((-0.2 + k * 0.13, 0, 0.95)), (0.05, 0.045, 0.06), mat("Roast", "#7a3e1c", rough=0.5), 8, 5)
    INFO.setdefault('lanterns', []).append(bz + V((0, 0, 0.8)))
    # handcart with straw (right side)
    hc = V((1.85, 0.75, 0.0))
    Mx = rot(hc, 'Z', 0.5)
    plank(b, hc + V((0, 0, 0.55)), (0.75, 1.0, 0.06), M('wood_grey'), r=0.01, Mx=Mx)
    for s in (-1, 1):
        plank(b, hc + V((s * 0.36, 0, 0.68)), (0.04, 1.0, 0.22), M('wood_grey'), r=0.008, Mx=Mx)
        plank(b, hc + V((s * 0.3, -0.85, 0.6)), (0.05, 0.8, 0.05), M('wood_grey'), r=0.008,
              Mx=Mx @ rot(hc + V((s * 0.3, -0.85, 0.6)), 'X', 0.1))
    tmp = Builder()
    for s in (-1, 1):
        wagon = tmp
        wagon.lathe([(-0.03, 0.30), (0.03, 0.30)], M('wood_dark'), n=16, axis='X', c=(s * 0.45, 0.15, 0.30))
        wagon.lathe([(-0.04, 0.05), (0.04, 0.05)], M('wood_dark'), n=8, axis='X', c=(s * 0.45, 0.15, 0.30))
        for k in range(6):
            a = k * math.pi / 3
            wagon.sweep([V((s * 0.45, 0.15, 0.30)), V((s * 0.45, 0.15 + math.cos(a) * 0.27, 0.30 + math.sin(a) * 0.27))],
                        0.015, M('wood_dark'), n=4)
    xform(tmp, Matrix.Translation(hc) @ Matrix.Rotation(0.5, 4, 'Z'))
    obs_tmp.append(tmp)
    tmp = Builder()
    tmp.ellipsoid((0, 0, 0), (0.33, 0.48, 0.2), M('straw'), 12, 7)
    xform(tmp, Matrix.Translation(hc + V((0, 0, 0.72))) @ Matrix.Rotation(0.5, 4, 'Z'))
    obs_tmp.append(tmp)
    # lanterns hanging from the awning edge + name board centre
    lanterns_at(b, [V((-1.2, yA + 0.05, 2.12)), V((1.2, yA + 0.05, 2.12))], style='round', hang=0.12)
    sign_board(b, (0, yA + 0.05, 2.12), 0.85, 0.32, m_board=M('wood_dark'))
    menu_board(b, (1.45, -1.25, 0.0), -0.4, POLE, M('chalk'), s=0.85)
    cask(b, (-1.2, 0.6, 0.3), 0.6, 0.2, M('wood'), IR, axis='Z')
    sack(b, (-0.8, 0.95, 0.0), M('sack'), M('rope'), yaw=0.3)
    finish("tavern-tent", [b, r] + obs_tmp)
