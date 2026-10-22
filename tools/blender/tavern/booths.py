"""Usage: Blender -b --factory-startup --python booths.py -- <style> [--noexport]
Styles: tudor bavarian norse osteria venta flemish tent.
Built in real metres (front -Y, origin ground centre), exported scaled x(1/0.62) = station-group units."""
import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/tavern")
import bpy, math, random
from mathutils import Vector as V, Matrix
from kit import *
import kit
from common2 import join

STYLE = sys.argv[sys.argv.index('--') + 1]
NOEXPORT = '--noexport' in sys.argv
reset()
rnd = random.Random(11)
INFO = {}

# footprint (real metres): x +-2.6, y -1.4 (front) .. +1.45 (back, board posts behind at +1.74)
GLOW = M('glow')
IR = M('iron')


def lanterns_at(b, pts, style='box', s=1.0, hang=0.1):
    cs = []
    for p in pts:
        cs.append(lantern(b, p, IR, GLOW, style=style, s=s, hang=hang))
    INFO.setdefault('lanterns', []).extend(cs)
    return cs


def counter_props(b, x0, x1, y, z, kind='ale', seed=3):
    """Mugs / jug / food along a counter top at height z, y = row."""
    r = random.Random(seed)
    x = x0
    W, IRm = M('wood'), M('iron')
    while x < x1:
        k = r.random()
        if kind == 'ale':
            if k < 0.45:
                tankard(b, (x, y + r.uniform(-0.05, 0.05), z), W, IRm)
                x += 0.16
            elif k < 0.6:
                tankard(b, (x, y, z), M('pewter'), None, pewter=True)
                x += 0.16
            elif k < 0.75:
                jug(b, (x, y, z), M('clay'), h=0.26, r=0.085)
                x += 0.24
            else:
                x += 0.25
        else:
            x += 0.2


def bread_cheese(b, c):
    c = V(c)
    b.rbox(c, (0.40, 0.26, 0.03), M('wood_light'), r=0.012, uv=G('x'))
    b.ellipsoid(c + V((-0.08, 0, 0.065)), (0.11, 0.09, 0.055), M('bread'), 12, 6)
    poly = [(0, 0), (0.14, 0.03), (0.14, -0.03)]
    prism(b, [(0.0, 0.0), (0.13, 0.05), (0.13, -0.05)], 0, 0.07, M('cheese'),
          Mx=Matrix.Translation(c + V((0.04, 0.02, 0.015))) @ Matrix.Rotation(0.4, 4, 'Z'))


def sign_board(b, anchor, w, h, style='plain', m_board=None):
    c = hanging_sign(b, anchor, w, h, m_board or M('wood_dark'), IR, style=style)
    INFO['sign'] = (c, w * 0.82, h * 0.72)
    return c


def finish(name, parts):
    """parts: list of Builders -> one mesh `tavern_<style>` + separate `sign_face` quad."""
    gt = Builder()
    rg = random.Random(len(STYLE))
    pts = []
    for k in range(22):
        side = rg.random()
        if side < 0.35:
            pts.append((rg.choice((-1, 1)) * rg.uniform(2.3, 2.6), rg.uniform(-1.2, 1.35), 0))
        elif side < 0.7:
            pts.append((rg.uniform(-2.6, 2.6), rg.uniform(1.15, 1.4), 0))
        else:
            pts.append((rg.choice((-1, 1)) * rg.uniform(1.4, 2.6), rg.uniform(-1.35, -0.9), 0))
    grass_tufts(gt, pts, seed=len(STYLE), n=7)
    parts = parts + [gt]
    obs = []
    for i, b in enumerate(parts):
        obs.append(b.to_object("p%d" % i))
    ob = join(obs, "tavern_" + STYLE) if len(obs) > 1 else obs[0]
    ob.name = "tavern_" + STYLE
    if 'sign' in INFO:
        c, w, h = INFO['sign']
        sign_face_object("sign_face", c + V((0, -0.002, 0)), w, h)
    tris = mesh_tris(ob)
    print("BOOTH", STYLE, "tris", tris)
    for c in INFO.get('lanterns', []):
        g = V((c.x, c.z, -c.y)) * TO_GROUP
        print("LANTERN real=(%.2f,%.2f,%.2f) group(three)=(%.2f,%.2f,%.2f)" % (c.x, c.y, c.z, g.x, g.y, g.z))
    if NOEXPORT:
        bpy.ops.wm.save_as_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/tavern/%s_test.blend" % name)
    else:
        export_prop(name, scale=TO_GROUP)


def deck(b, x0, x1, y0, y1, z=0.10, m=None, plank_w=0.22):
    m = m or M('wood_grey')
    n = int((y1 - y0) / plank_w)
    for i in range(n):
        y = y0 + (i + 0.5) * (y1 - y0) / n
        plank(b, ((x0 + x1) / 2 + rnd.uniform(-0.02, 0.02), y, z - 0.03), (x1 - x0, (y1 - y0) / n - 0.008, 0.05),
              m if i % 3 else M('wood'), r=0.006, seg=1)
    for x in (x0 + 0.1, 0.0, x1 - 0.1):
        plank(b, (x, (y0 + y1) / 2, (z - 0.06) / 2), (0.1, y1 - y0, z - 0.06), M('wood_dark'), r=0.008, seg=1)


# =====================================================================================
def tudor():
    WD, PL, TH = M('wood_black'), M('plaster'), M('thatch')
    b, r = Builder(), Builder()
    X0, X1, YF, YB = -2.25, 2.25, -0.75, 1.20
    EH = 2.15            # wall plate height
    # stone plinth + floor
    for x0_, x1_, y0_, y1_ in ((X0 - 0.08, X1 + 0.08, YB - 0.12, YB + 0.12), (X0 - 0.12, X0 + 0.12, YF, YB),
                               (X1 - 0.12, X1 + 0.12, YF, YB)):
        plank(b, ((x0_ + x1_) / 2, (y0_ + y1_) / 2, 0.12), (x1_ - x0_, y1_ - y0_, 0.24), M('stone'), r=0.03)
    deck(b, X0 + 0.1, X1 - 0.1, YF - 0.05, YB - 0.1, z=0.12)
    # posts (corner + door), wall plates, tie beams
    for x in (X0, X1):
        for y in (YF, YB):
            post(b, x, y, 0.22, EH, 0.18, WD)
    for y in (YF, YB):
        plank(b, (0, y, EH + 0.08), (X1 - X0 + 0.3, 0.2, 0.16), WD, r=0.02)
    for x in (X0, X1):
        plank(b, (x, (YF + YB) / 2, EH + 0.08), (0.2, YB - YF + 0.3, 0.16), WD, r=0.02)
    # back wall + side walls: wattle & daub panels
    xs = [X0 + 0.09, -1.1, 0.0, 1.1, X1 - 0.09]
    pats = ['cross', 'post', 'post', 'cross']
    for i in range(4):
        half_timber_panel(b, xs[i], xs[i + 1], 0.24, 1.15, YB, WD, PL, 'rail', face=-1)
        half_timber_panel(b, xs[i], xs[i + 1], 1.15, EH, YB, WD, PL, pats[i], face=-1)
    for x, face in ((X0, -1), (X1, 1)):
        for (ya, yb_) in ((YF + 0.09, 0.22), (0.22, YB - 0.09)):
            Mx = rot((x, 0, 0), 'Z', math.pi / 2 * (-face))
            # build in a local frame then rotate: panel plane x
            tmp = Builder()
            half_timber_panel(tmp, ya, yb_, 0.24, EH, 0.0, WD, PL, 'diag' if ya < 0 else 'cross', face=-1)
            for v in tmp.bm.verts:
                v.co = V((x + v.co.y * face * -1, v.co.x, v.co.z))
            tmp.bm.normal_update()
            bmesh.ops.recalc_face_normals(tmp.bm, faces=tmp.bm.faces)
            obs_tmp.append(tmp)
    # front: shop window with hinged shutters (lower one folded down as a counter, upper propped as awning)
    plank(b, (0, YF, 0.95), (X1 - X0 - 0.2, 0.16, 0.12), WD, r=0.015)                 # sill
    for x in (-1.25, 1.25):
        post(b, x, YF, 0.95, EH, 0.14, WD)
    counter(b, -2.05, 2.05, YF - 0.62, 0.55, 1.05, M('wood_dark'), M('wood'), boards='v')
    th = -1.15
    hc_ = V((0, YF - 0.06 - 0.32 * math.sin(-th), 2.05 - 0.32 * math.cos(th)))
    for i in range(7):
        c_ = V((-2.0 + 4.0 * (i + 0.5) / 7, hc_.y, hc_.z))
        plank(b, c_, (4.0 / 7 - 0.01, 0.04, 0.64), M('wood'), r=0.006, seg=1, Mx=rot(c_, 'X', th))
    for x in (-1.9, 1.9):
        beam(b, (x, YF - 0.05, 1.15), (x, hc_.y - 0.27, hc_.z - 0.12), 0.035, 0.035, WD)
    # gable ends (plaster + king post) under the thatch
    RZ, RY = 3.55, 0.22
    for x in (X0, X1):
        tri = Builder()
        poly = [(YF - 0.05, EH + 0.16), (YB + 0.05, EH + 0.16), (RY, RZ - 0.25)]
        prism(tri, [(p[0], p[1]) for p in poly], -0.05, 0.05, PL, uv=None,
              Mx=Matrix(((0, 0, 1, x), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
        obs_tmp.append(tri)
        plank(b, (x + (0.05 if x > 0 else -0.05), RY, (EH + RZ) / 2), (0.08, 0.14, RZ - EH - 0.1), WD, r=0.012)
        beam(b, (x + (0.05 if x > 0 else -0.05), YF, EH + 0.2), (x + (0.05 if x > 0 else -0.05), RY, RZ - 0.3), 0.08, 0.12,
             WD, up=(1, 0, 0))
        beam(b, (x + (0.05 if x > 0 else -0.05), YB, EH + 0.2), (x + (0.05 if x > 0 else -0.05), RY, RZ - 0.3), 0.08, 0.12,
             WD, up=(1, 0, 0))
    # thick thatch, half-hipped
    for eave, ridge in (((YF - 0.55, EH + 0.05), (RY, RZ)), ((YB + 0.30, EH + 0.12), (RY, RZ))):
        roof_slab(r, X0 - 0.45, X1 + 0.45, eave, ridge, TH, thick=0.32, nx=26, ny=9, lump=0.035, seed=int(eave[0] * 10),
                  uscale=0.6)
    ridge_cap(r, X0 - 0.3, X1 + 0.3, RY, RZ + 0.27, TH, r=0.13, ellipse=(1.0, 0.6))
    for x in np.linspace(X0 - 0.2, X1 + 0.2, 9):          # ridge pegs (liggers)
        r.sweep([V((x, RY - 0.18, RZ + 0.26)), V((x, RY + 0.18, RZ + 0.26))], 0.012, M('wood_light'), n=4)
    # ale-stake with evergreen bush toward the road
    beam(b, (X0 + 0.05, YF, 1.95), (X0 - 0.2, YF - 1.9, 2.25), 0.07, 0.07, WD)
    beam(b, (X0 + 0.05, YF, 1.35), (X0 - 0.05, YF - 0.6, 2.0), 0.05, 0.05, WD)
    leaf_cluster(b, (X0 - 0.22, YF - 1.95, 2.05), 0.30, [M('green'), mat("Evergreen", "#2f4a2a", rough=0.9)], n=110,
                 seed=3, size=0.09, flat=0.6)
    # hanging picture sign (red lion) from a bracket on the right corner post
    beam(b, (X1 + 0.05, YF, 2.05), (X1 + 0.05, YF - 0.9, 2.05), 0.06, 0.08, WD)
    beam(b, (X1 + 0.05, YF, 1.55), (X1 + 0.05, YF - 0.6, 2.02), 0.05, 0.05, WD)
    sign_board(b, (X1 + 0.05, YF - 0.55, 2.0), 0.62, 0.48, m_board=mat("Sign_Red", "#7a2e22", rough=0.7))
    # casks on a stand behind the counter, tankards, bread & cheese
    plank(b, (-1.2, 0.75, 0.35), (1.3, 0.55, 0.06), WD, r=0.01)
    for x in (-1.6, -0.8):
        for y in (0.55, 0.95):
            post(b, x, y, 0.12, 0.35, 0.08, WD)
    for x in (-1.5, -0.9):
        cask(b, (x, 0.75, 0.62), 0.55, 0.24, M('wood'), IR, axis='Y')
    tap_barrel(b, (0.95, YF - 0.30, 1.05 + 0.24), M('wood'), IR, M('brass'), length=0.50, r=0.19)
    counter_props(b, -1.85, 0.4, YF - 0.42, 1.05, seed=4)
    bread_cheese(b, (0.15, YF - 0.25, 1.05))
    # lanterns on the plate beam (front)
    lanterns_at(b, [V((-1.55, YF - 0.55, 1.83)), V((1.55, YF - 0.55, 1.83))], hang=0.06)
    # tally board by the window + crates and sacks
    plank(b, (X0 + 0.02, YF - 0.12, 1.45), (0.04, 0.02, 0.5), WD, r=0.004, seg=1)
    tb = Builder()
    menu_board(b, (X0 - 0.15, YF - 0.45, 0.0), 0.5, WD, M('chalk'), s=0.9)
    crate(b, (X1 + 0.15, 0.2, 0.22), (0.5, 0.45, 0.44), M('wood'), WD, yaw=0.2)
    sack(b, (X1 + 0.18, 0.65, 0.0), M('sack'), M('rope'), yaw=0.4)
    finish("tavern-tudor", [b, r] + obs_tmp)


obs_tmp = []
exec(open("/Users/sang/.claude/jobs/02a78233/tmp/tavern/styles2.py").read())
{'tudor': tudor, 'bavarian': bavarian, 'norse': norse, 'osteria': osteria, 'venta': venta, 'flemish': flemish,
 'tent': tent}.get(STYLE, lambda: print("unknown style", STYLE))()
