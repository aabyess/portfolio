"""Extra weapons: crossbow(+bolt), flail(+ball, link), javelin, bomb, pan, bazooka(+rocket), mortar(+shell).
Blender -b --factory-startup --python extra_weapons.py -- [name ...]   (no names = all)

Frame (same as wcommon / GLB_FIX R90 in weapons.js): Blender (x, y, z) == three.js model (x, y, z) after the
+90deg X fix.  +Y = along the grip toward the head, +Z = front (edge / muzzle / flight), origin = main hand.
All coordinates copy the procedural fallback models in weapons.js so userData anchors (muzzle, tips, anchor,
fuse, front, rear, hold) stay valid.

Extra parts are separate objects (weapons.js detaches them by name):
  crossbow: 'bolt'   origin = tail, shaft along +Z         (loaded bolt + flying projectile)
  flail:    'ball'   origin = centre                        (world-space ball at the chain end)
            'link'   origin = centre, long axis +Y          (cloned along the chain)
  bazooka:  'rocket' origin = body/nose joint, nose +Z      (loaded warhead + flying rocket)
  mortar:   'shell'  origin = centre, nose +Y               (hand-held shell + flying shell)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wcommon import *

D2R = math.pi / 180


def rot_x(a):
    return Matrix.Rotation(a, 4, 'X')


def rsq(c, ax_u, ax_v, hu, hv, r, n=3):
    pts = []
    r = min(r, hu * 0.99, hv * 0.99)
    for q, (su, sv) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cu, cv = su * (hu - r), sv * (hv - r)
        for k in range(n + 1):
            a = math.pi / 2 * (q + k / n)
            pts.append(V(c) + V(ax_u) * (cu + math.cos(a) * r) + V(ax_v) * (cv + math.sin(a) * r))
    return pts


def mats_common():
    return dict(
        steel=pbr("X_Steel", tex_steel(256, seed=71, dark=0.04, polish=0.6), nrm_strength=0.6),
        iron=pbr("X_Iron", tex_iron(256, seed=72)),
        oak=pbr("X_Oak", tex_wood(256, seed=73, rings=18), tint='#8a5a36', nrm_px=128),
        ash=pbr("X_Ash", tex_wood(256, seed=74, rings=10, pore_amt=0.4, nrm=0.6, late_amt=0.14), tint='#d0ab7c',
                nrm_px=0),
        leather=pbr("X_Leather", tex_leather(256, seed=75, wrap=3), tint='#4a2c1a', nrm_px=128),
        brass=pbr("X_Brass", tex_brass(128, seed=76), nrm_px=0),
    )


def finish(b, name, parts=()):
    ob = b.to_object(name)
    total = mesh_tris(ob)
    for p in parts:
        total += mesh_tris(p)
    print("TRIS", name, total, "(main %d)" % mesh_tris(ob), [(p.name, mesh_tris(p)) for p in parts])
    export(name)


def arrowish(b, m_shaft, m_head, m_vane, m_vane2, L, r, head_len, head_r, vane_len, vane_h, z0=0.0, ax=2):
    """Shaft from z0 to z0+L along +Z (Blender), pyramidal head, 3 vanes."""
    b.lathe([(z0, r * 0.9), (z0 + 0.004, r), (z0 + L, r)], m_shaft, n=8, axis='Z', uv=('cyl', (0, 0, 1), (0, 0, 0), 4, 1))
    b.lathe([(z0 + L - 0.004, r * 1.5), (z0 + L + 0.004, head_r), (z0 + L + head_len * 0.45, head_r * 0.85),
             (z0 + L + head_len, 0.0)], m_head, n=4, axis='Z', phase=math.pi / 4, cap0=True, flat=True)
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        d = V((math.cos(a), math.sin(a), 0))
        outline = [(0.0, r * 0.5), (vane_len * 0.25, vane_h), (vane_len, vane_h * 0.75), (vane_len, r * 0.5)]
        b.plate(outline, m_vane if k == 0 else m_vane2, au=(0, 0, 1), av=tuple(d), origin=(0, 0, z0 + 0.012),
                w0=-0.0007, w1=0.0007, bevel=0.0, uv=('box', 10.0))


# =================================================================== crossbow
def build_crossbow():
    reset_all()
    M = mats_common()
    red = flat_mat("X_RedPaint", '#a8322a', rough=0.6)
    white = flat_mat("X_Vane", '#efe8da', rough=0.8)
    cord = flat_mat("X_Cord", '#d8c79c', rough=0.9)
    b = WBuilder()
    # tiller / stock: rings of rounded rects along Z  (z, centre y, half-height, half-width)
    prof = [(-0.27, -0.045, 0.062, 0.027), (-0.24, -0.040, 0.066, 0.029), (-0.17, -0.030, 0.058, 0.028),
            (-0.10, -0.012, 0.040, 0.026), (-0.05, -0.002, 0.031, 0.024), (0.05, 0.0, 0.030, 0.024),
            (0.30, 0.0, 0.030, 0.024), (0.34, 0.0, 0.036, 0.030), (0.43, 0.0, 0.036, 0.030), (0.45, 0.0, 0.030, 0.026)]
    rings = [rsq((0, cy, z), (1, 0, 0), (0, 1, 0), hw, hh, 0.012) for z, cy, hh, hw in prof]
    b.rings(rings, M['oak'], uv=('grain', (0, 0, 1), 5.0, 5.0))
    # iron bands + butt plate
    for z, cy, hh, hw in ((0.12, 0.0, 0.031, 0.025), (-0.06, -0.003, 0.033, 0.025)):
        b.rings([rsq((0, cy, z - 0.008), (1, 0, 0), (0, 1, 0), hw + 0.002, hh + 0.002, 0.01),
                 rsq((0, cy, z + 0.008), (1, 0, 0), (0, 1, 0), hw + 0.002, hh + 0.002, 0.01)], M['iron'],
                cap0=False, cap1=False)
    b.rbox((0, -0.045, -0.275), (0.058, 0.13, 0.012), M['iron'], r=0.005)
    # brass rails either side of the bolt groove
    for sx in (-1, 1):
        b.rbox((sx * 0.012, 0.031, 0.22), (0.006, 0.004, 0.38), M['brass'], r=0.0015)
    # red painted inlay on the butt sides (cartoon royal touch)
    for sx in (-1, 1):
        b.plate([(-0.24, -0.08), (-0.11, -0.03), (-0.11, -0.005), (-0.24, -0.01)], red, au=(0, 0, 1), av=(0, 1, 0),
                origin=(sx * 0.0285, 0, 0), w0=0, w1=sx * 0.002, bevel=0.0)
    # prod (bow limbs) — tips must stay at (+-0.33, 0.02, 0.30) for the code string
    pts = [(-0.33, 0.02, 0.30), (-0.25, 0.02, 0.345), (-0.13, 0.02, 0.38), (0, 0.02, 0.392),
           (0.13, 0.02, 0.38), (0.25, 0.02, 0.345), (0.33, 0.02, 0.30)]
    rad = [0.009, 0.012, 0.015, 0.017, 0.015, 0.012, 0.009]
    b.sweep(pts, rad, M['steel'], n=8, sub=3, up=(0, 1, 0), ellipse=(0.75, 1.15))
    for sx in (-1, 1):
        b.ellipsoid((sx * 0.33, 0.02, 0.30), (0.012, 0.012, 0.012), M['brass'], nu=8, nv=5)
    # bridle (front iron binding) + cord lashing
    b.rbox((0, 0.012, 0.392), (0.07, 0.066, 0.05), M['iron'], r=0.008)
    for sx in (-1, 1):
        b.torus((sx * 0.045, 0.02, 0.392), 0.02, 0.004, cord, nu=10, nv=5, axis='X')
    # stirrup (foot loop) in front
    sp = [(-0.03, -0.005, 0.44), (-0.055, -0.005, 0.48), (-0.04, -0.005, 0.525), (0, -0.005, 0.54),
          (0.04, -0.005, 0.525), (0.055, -0.005, 0.48), (0.03, -0.005, 0.44)]
    b.sweep(sp, 0.0065, M['iron'], n=6, sub=2, up=(0, 1, 0))
    # nut (string latch) + trigger lever
    b.lathe([(-0.018, 0.016), (0.018, 0.016)], M['brass'], n=12, axis='X', c=(0, 0.026, 0.0))
    b.seg_box((0, -0.025, -0.01), (0, -0.115, -0.13), 0.012, 0.016, M['iron'], r=0.004, up=(0, 0, 1))
    b.lathe([(-0.016, 0.006), (0.016, 0.006)], M['brass'], n=8, axis='X', c=(0, -0.02, -0.005))
    # studs
    for z in (0.02, 0.2):
        for sx in (-1, 1):
            b.lathe([(0, 0.005), (sx * 0.002, 0.004), (sx * 0.003, 0.0)], M['brass'], n=6, axis='X',
                    c=(sx * 0.024, 0, z), cap1=False)
    # bolt (separate object, origin at tail)
    bb = WBuilder()
    arrowish(bb, M['oak'], M['iron'], red, white, L=0.36, r=0.0062, head_len=0.055, head_r=0.014,
             vane_len=0.06, vane_h=0.022)
    bolt = bb.to_object("bolt", origin=(0, 0, 0))
    bolt.location = (0, 0.045, 0.02)
    finish(b, "crossbow", [bolt])


# =================================================================== flail
def build_flail():
    reset_all()
    M = mats_common()
    b = WBuilder()
    # haft along +Y
    b.lathe([(-0.095, 0.0215), (0.0, 0.0225), (0.12, 0.0235), (0.30, 0.0255), (0.315, 0.026)], M['oak'], n=14,
            axis='Y', uv=('cyl', (0, 1, 0), (0, 0, 0), 3, 1))
    # leather grip + brass bands
    g = [(-0.092 + 0.11 * i / 10, 0.0245 + 0.0008 * math.sin(math.pi * i / 10)) for i in range(11)]
    b.lathe(g, M['leather'], n=14, axis='Y', cap0=False, cap1=False, uv=('cyl', (0, 1, 0), (0, 0, 0), 14, 1))
    for y in (-0.092, 0.018):
        b.torus((0, y, 0), 0.0255, 0.003, M['brass'], nu=14, nv=5, axis='Y')
    # pommel
    b.lathe([(-0.096, 0.024), (-0.104, 0.030), (-0.118, 0.028), (-0.128, 0.016), (-0.132, 0.0)], M['brass'], n=12,
            axis='Y', cap0=True)
    # iron cap + eye (chain anchor at y=0.36)
    b.lathe([(0.30, 0.0275), (0.31, 0.030), (0.345, 0.028), (0.355, 0.016), (0.36, 0.0)], M['iron'], n=12,
            axis='Y', cap0=True)
    b.torus((0, 0.372, 0), 0.014, 0.0045, M['iron'], nu=12, nv=6, axis='X')
    # langets
    for k in range(4):
        a = k * math.pi / 2
        d = V((math.cos(a), 0, math.sin(a)))
        b.rbox(d * 0.026 + V((0, 0.265, 0)), (0.008 if abs(d.x) < 0.5 else 0.004, 0.08, 0.004 if abs(d.x) < 0.5 else 0.008),
               M['iron'], r=0.0015)
    # spiked ball (separate)
    bb = WBuilder()
    bb.ellipsoid((0, 0, 0), (0.08, 0.08, 0.08), M['iron'], nu=16, nv=10)
    n = 14
    for i in range(n):
        phi = math.acos(1 - 2 * (i + 0.5) / n); th = i * 2.39996
        d = V((math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), math.cos(phi)))
        q = V((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        bb.lathe([(0.07, 0.019), (0.09, 0.012), (0.125, 0.0)], M['steel'], n=5, axis='Z', M=q, cap0=False, flat=True)
    bb.torus((0, 0, 0.088), 0.012, 0.004, M['iron'], nu=10, nv=5, axis='X')
    ball = bb.to_object("ball")
    ball.location = (0.0, -0.3, 0.0)        # parked below; code reads only its shape
    # chain link (separate), long axis +Y
    lb = WBuilder()
    pts = [(math.cos(2 * math.pi * k / 12) * 0.011, math.sin(2 * math.pi * k / 12) * 0.022, 0) for k in range(12)]
    lb.sweep(pts, 0.0042, M['iron'], n=5, closed_path=True, cap=False, up=(0, 0, 1))
    link = lb.to_object("link")
    link.location = (0.0, -0.45, 0.0)
    finish(b, "flail", [ball, link])


# =================================================================== javelin
def build_javelin():
    reset_all()
    M = mats_common()
    red = flat_mat("X_RedCloth", '#b8352b', rough=0.85)
    b = WBuilder()
    b.lathe([(-0.75, 0.0105), (-0.4, 0.0125), (0.2, 0.0132), (0.7, 0.012), (1.02, 0.0105)], M['ash'], n=10,
            axis='Z', uv=('cyl', (0, 0, 1), (0, 0, 0), 1.5, 1))
    # butt spike
    b.lathe([(-0.78, 0.0), (-0.765, 0.008), (-0.74, 0.0122), (-0.70, 0.0118)], M['iron'], n=8, axis='Z', cap1=False)
    # leather grip
    g = [(-0.10 + 0.20 * i / 8, 0.0148 + 0.0006 * math.sin(math.pi * i / 8)) for i in range(9)]
    b.lathe(g, M['leather'], n=10, axis='Z', uv=('cyl', (0, 0, 1), (0, 0, 0), 14, 1))
    for z in (-0.102, 0.102):
        b.torus((0, 0, z), 0.0148, 0.0025, M['brass'], nu=10, nv=5, axis='Z')
    # socket + leaf blade
    b.lathe([(0.99, 0.0112), (1.05, 0.0125), (1.07, 0.0108)], M['iron'], n=10, axis='Z', cap0=False, cap1=False)
    b.lathe([(1.05, 0.013), (1.08, 0.030), (1.13, 0.034), (1.19, 0.022), (1.25, 0.0)], M['steel'], n=4, axis='Z',
            phase=0.0, ellipse=(1.0, 0.25), cap0=True, flat=True)
    # little red pennant ribbons under the head
    for sx in (-1, 1):
        b.plate([(0.0, 0.0), (0.05, 0.0), (0.12, -0.012), (0.09, -0.018)], red, au=(0, 0, -1), av=(sx, -0.6, 0),
                origin=(0, 0, 0.985), w0=-0.0008, w1=0.0008, bevel=0.0)
    b.torus((0, 0, 0.985), 0.0118, 0.003, red, nu=10, nv=4, axis='Z')
    finish(b, "javelin")


# =================================================================== bomb
def build_bomb():
    reset_all()
    M = mats_common()
    shell = pbr("X_BombIron", tex_plain(256, 81, base_lum=0.16, rough=0.38, metal=0.35, scale=12, amp=0.05),
                tint='#30343a', nrm_strength=0.6)
    rope = pbr("X_Fuse", tex_leather(128, seed=82, wrap=6), tint='#e0c58e', nrm_px=0)
    b = WBuilder()
    # rings are along Z in ellipsoid → use lathe around Y so seams sit at the bottom
    prof = [(-0.085 * math.cos(math.pi * i / 14) , 0.085 * math.sin(math.pi * i / 14)) for i in range(15)]
    prof[0] = (prof[0][0], 0.0); prof[-1] = (prof[-1][0], 0.0)
    b.lathe(prof, shell, n=22, axis='Y')
    # riveted band around the equator (cartoon)
    b.torus((0, 0, 0), 0.0855, 0.004, M['iron'], nu=22, nv=4, axis='Y')
    for k in range(8):
        a = k * math.pi / 4
        b.ellipsoid((math.cos(a) * 0.088, 0, math.sin(a) * 0.088), (0.006, 0.006, 0.006), M['brass'], nu=6, nv=4)
    # brass collar
    b.lathe([(0.072, 0.034), (0.080, 0.036), (0.098, 0.033), (0.103, 0.028), (0.103, 0.010)], M['brass'], n=16,
            axis='Y', cap0=False, cap1=True)
    # fuse: tip must be near (0.03, 0.155, 0)
    b.sweep([(0, 0.095, 0), (0.002, 0.118, 0.004), (0.012, 0.138, 0.006), (0.03, 0.152, 0.0)], 0.0058, rope,
            n=6, sub=3, up=(0, 0, 1))
    b.ellipsoid((0.03, 0.153, 0.0), (0.006, 0.006, 0.006), flat_mat("X_FuseTip", '#3a2a1a', rough=0.9), nu=6, nv=4)
    finish(b, "bomb")


# =================================================================== frying pan
def build_pan():
    reset_all()
    M = mats_common()
    cast = pbr("X_CastIron", tex_iron(256, seed=91), tint='#7b7d82')
    seasoned = pbr("X_PanInside", tex_plain(256, 92, base_lum=0.13, rough=0.6, metal=0.25, scale=25, amp=0.06),
                   nrm_px=0)
    b = WBuilder()
    C = V((0, 0.38, 0))
    outer = [(-0.019, 0.0), (-0.019, 0.112), (-0.016, 0.128), (-0.008, 0.138), (0.006, 0.146), (0.017, 0.152),
             (0.022, 0.152)]
    b.lathe(outer, cast, n=28, axis='Z', c=C, cap0=True, cap1=False, uv=('box', 6.0))
    inner = [(0.022, 0.152), (0.024, 0.148), (0.020, 0.142), (0.004, 0.132), (-0.009, 0.118), (-0.011, 0.10),
             (-0.011, 0.0)]
    b.lathe(inner, seasoned, n=28, axis='Z', c=C, cap0=False, cap1=True, uv=('box', 6.0))
    # handle strap (iron) from the rim down to the grip, riveted
    b.seg_box((0, 0.245, -0.002), (0, 0.035, -0.002), 0.026, 0.012, cast, r=0.004, up=(0, 0, 1))
    b.seg_box((0, 0.25, -0.002), (0, 0.205, -0.002), 0.036, 0.016, cast, r=0.005, up=(0, 0, 1))
    for y in (0.232, 0.215):
        b.lathe([(0.0, 0.0045), (0.004, 0.0035), (0.006, 0.0)], M['brass'], n=6, axis='Z', c=(0, y, 0.004), cap1=False)
    # wooden grip
    g = [(-0.10, 0.0), (-0.098, 0.014), (-0.09, 0.019), (-0.03, 0.0195), (0.02, 0.018), (0.04, 0.016), (0.045, 0.0)]
    b.lathe(g, M['oak'], n=12, axis='Y', uv=('cyl', (0, 1, 0), (0, 0, 0), 4, 1))
    b.torus((0, 0.04, 0), 0.0165, 0.0032, M['brass'], nu=12, nv=5, axis='Y')
    b.torus((0, -0.115, 0), 0.012, 0.0028, M['iron'], nu=10, nv=5, axis='X')      # hanging ring
    finish(b, "pan")


# =================================================================== bazooka
def build_bazooka():
    reset_all()
    M = mats_common()
    olive = pbr("X_Olive", tex_plain(256, 101, base_lum=0.9, rough=0.62, metal=0.15, scale=18, amp=0.12),
                tint='#6a7a40', nrm_strength=0.5)
    oliveD = pbr("X_OliveDark", tex_plain(256, 102, base_lum=0.9, rough=0.6, metal=0.2, scale=18, amp=0.12),
                 tint='#434d29', nrm_strength=0.5)
    yellow = flat_mat("X_Yellow", '#e8b43a', rough=0.55)
    redp = flat_mat("X_RedP", '#c8402e', rough=0.5)
    black = flat_mat("X_Black", '#232120', rough=0.55, metal=0.3)
    bore = flat_mat("X_Bore", '#0d0c0b', rough=0.9)
    T = 0.11
    C = V((0, T, 0))
    b = WBuilder()
    # main tube with a flared rear bell and a front ring; hollow ends
    tube = [(-0.60, 0.084), (-0.57, 0.092), (-0.52, 0.080), (-0.47, 0.066), (-0.44, 0.064), (0.56, 0.064),
            (0.575, 0.079), (0.66, 0.079), (0.67, 0.072)]
    b.lathe(tube, olive, n=24, axis='Z', c=C, cap0=False, cap1=False, uv=('box', 5.0))
    b.lathe([(0.67, 0.072), (0.665, 0.058), (0.50, 0.058), (0.50, 0.0)], bore, n=24, axis='Z', c=C, cap0=False)
    b.lathe([(-0.60, 0.084), (-0.595, 0.076), (-0.46, 0.058), (-0.46, 0.0)], bore, n=24, axis='Z', c=C, cap0=False)
    # dark rings (rear bell lip, mid joint)
    b.torus((0, T, -0.60), 0.084, 0.006, oliveD, nu=24, nv=5, axis='Z')
    b.lathe([(0.03, 0.0655), (0.035, 0.069), (0.075, 0.069), (0.08, 0.0655)], oliveD, n=24, axis='Z', c=C,
            cap0=False, cap1=False)
    # painted bands
    b.lathe([(0.425, 0.0648), (0.475, 0.0648)], yellow, n=24, axis='Z', c=C, cap0=False, cap1=False)
    b.lathe([(0.485, 0.0648), (0.515, 0.0648)], redp, n=24, axis='Z', c=C, cap0=False, cap1=False)
    # shoulder rest (leather pad on a bracket)
    b.rbox((0, T - 0.07, -0.22), (0.1, 0.04, 0.2), M['leather'], r=0.012)
    b.rbox((0, T - 0.05, -0.22), (0.03, 0.03, 0.12), oliveD, r=0.006)
    # pistol grip (origin) + trigger + guard
    b.rbox((0, 0.0, 0.0), (0.036, 0.13, 0.052), black, r=0.01, M=rot_x(0.22))
    b.rbox((0, T - 0.07, 0.02), (0.03, 0.03, 0.12), black, r=0.006)
    b.rbox((0, 0.035, 0.05), (0.008, 0.026, 0.01), M['steel'], r=0.002)
    gp = [(0, 0.062, 0.018), (0, 0.022, 0.03), (0, 0.006, 0.06), (0, 0.022, 0.09), (0, 0.045, 0.095)]
    b.sweep(gp, 0.004, black, n=5, sub=2, up=(1, 0, 0))
    # front grip (left hand at (0, 0, 0.3)) + bracket
    b.lathe([(-0.07, 0.0), (-0.068, 0.018), (-0.06, 0.021), (0.04, 0.021), (0.05, 0.016)], black, n=10, axis='Y',
            c=(0, 0.0, 0.3))
    b.rbox((0, T - 0.07, 0.3), (0.03, 0.04, 0.05), black, r=0.006)
    # sight (left side)
    b.rbox((0.075, T + 0.03, 0.22), (0.02, 0.06, 0.03), black, r=0.004)
    b.rbox((0.075, T + 0.07, 0.22), (0.012, 0.02, 0.02), black, r=0.003)
    b.rbox((0.055, T + 0.02, 0.22), (0.03, 0.02, 0.02), black, r=0.004)
    # rivets
    for z in (-0.4, 0.2, 0.62):
        for a in (0.5, 2.6):
            b.ellipsoid((math.cos(a) * 0.066, T + math.sin(a) * 0.066, z), (0.005, 0.005, 0.005), oliveD, nu=6, nv=4)
    # rocket (separate) origin at body/nose joint, nose +Z
    rb = WBuilder()
    rb.lathe([(-0.30, 0.0), (-0.30, 0.026), (-0.27, 0.042), (-0.02, 0.045), (0.0, 0.046)], olive, n=14, axis='Z')
    rb.lathe([(0.0, 0.050), (0.04, 0.050), (0.10, 0.040), (0.15, 0.020), (0.17, 0.006), (0.172, 0.0)], redp, n=14,
             axis='Z', cap0=True)
    rb.lathe([(0.0, 0.051), (0.012, 0.051)], yellow, n=14, axis='Z', cap0=False, cap1=False)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d = V((math.cos(a), math.sin(a), 0))
        rb.plate([(-0.30, 0.03), (-0.30, 0.075), (-0.25, 0.075), (-0.19, 0.04)], oliveD, au=(0, 0, 1), av=tuple(d),
                 origin=(0, 0, 0), w0=-0.003, w1=0.003, bevel=0.001, seg=1)
    rocket = rb.to_object("rocket")
    rocket.location = (0, T, 0.675)
    finish(b, "bazooka", [rocket])


# =================================================================== mortar
def build_mortar():
    reset_all()
    M = mats_common()
    olive = pbr("X_Olive", tex_plain(256, 111, base_lum=0.9, rough=0.62, metal=0.15, scale=18, amp=0.12),
                tint='#6a7a40', nrm_strength=0.5)
    oliveD = pbr("X_OliveDark", tex_plain(256, 112, base_lum=0.9, rough=0.6, metal=0.2, scale=18, amp=0.12),
                 tint='#434d29', nrm_strength=0.5)
    yellow = flat_mat("X_Yellow", '#e8b43a', rough=0.55)
    bore = flat_mat("X_Bore", '#0d0c0b', rough=0.9)
    tl = 30 * D2R
    L = 0.95
    b = WBuilder()
    Rp = rot_x(-tl)
    # base plate (tilted -30deg so it lies flat when the tube leans forward)
    b.lathe([(-0.022, 0.0), (-0.022, 0.215), (-0.012, 0.232), (0.008, 0.226), (0.016, 0.20), (0.018, 0.07),
             (0.04, 0.06), (0.05, 0.0)], oliveD, n=20, axis='Y', M=Rp)
    for k in range(4):
        a = k * math.pi / 4
        b.seg_box(Rp @ V((math.cos(a) * 0.2, 0.018, math.sin(a) * 0.2)), Rp @ V((-math.cos(a) * 0.2, 0.018, -math.sin(a) * 0.2)),
                  0.03, 0.022, olive, r=0.006, up=tuple(Rp.to_3x3() @ V((0, 1, 0))))
    # ball joint + tube
    b.ellipsoid((0, 0.045, 0), (0.05, 0.05, 0.05), M['iron'], nu=12, nv=8)
    b.lathe([(0.04, 0.056), (0.10, 0.058), (L - 0.04, 0.051), (L - 0.03, 0.066), (L + 0.03, 0.068), (L + 0.035, 0.062)],
            olive, n=20, axis='Y', cap0=True, cap1=False, uv=('box', 5.0))
    b.lathe([(L + 0.035, 0.062), (L + 0.03, 0.046), (L - 0.15, 0.046), (L - 0.15, 0.0)], bore, n=20, axis='Y', cap0=False)
    b.lathe([(L * 0.72 - 0.025, 0.0545), (L * 0.72 + 0.025, 0.0535)], yellow, n=20, axis='Y', cap0=False, cap1=False)
    # collar clamp for the bipod
    b.rbox((0, L * 0.6, 0.03), (0.14, 0.055, 0.1), oliveD, r=0.012)
    b.lathe([(L * 0.6 - 0.03, 0.06), (L * 0.6 + 0.03, 0.06)], oliveD, n=20, axis='Y', cap0=False, cap1=False)
    # bipod legs to the feet
    fy, fz = 0.45 * math.sin(tl), 0.45 * math.cos(tl)
    for sx in (-1, 1):
        b.sweep([(sx * 0.035, L * 0.6, 0.06), (sx * 0.22, fy, fz)], 0.013, M['iron'], n=8)
        b.rbox((sx * 0.22, fy - 0.004, fz), (0.06, 0.016, 0.07), M['iron'], r=0.005, M=None)
    # cross brace + elevation screw with crank
    b.sweep([(-0.15, 0.36, 0.25), (0.15, 0.36, 0.25)], 0.009, M['iron'], n=6)
    b.sweep([(0, 0.36, 0.25), (0, L * 0.6 - 0.02, 0.08)], 0.011, M['steel'], n=8)
    b.torus((0, 0.36, 0.25), 0.035, 0.005, M['steel'], nu=12, nv=5, axis='Z')
    b.sweep([(0.035, 0.36, 0.25), (0.035, 0.36, 0.29)], 0.006, M['steel'], n=6)
    # shell (separate) nose +Y, origin centre
    sb = WBuilder()
    prof = [(-0.08, 0.0), (-0.08, 0.026), (-0.06, 0.042), (-0.02, 0.05), (0.02, 0.05), (0.06, 0.044),
            (0.09, 0.03), (0.11, 0.012), (0.116, 0.0)]
    sb.lathe(prof, olive, n=14, axis='Y')
    sb.lathe([(0.012, 0.0505), (0.038, 0.0495)], yellow, n=14, axis='Y', cap0=False, cap1=False)
    sb.lathe([(-0.17, 0.0), (-0.17, 0.014), (-0.08, 0.018)], oliveD, n=8, axis='Y', cap1=False)
    for k in range(4):
        a = k * math.pi / 2
        d = V((math.cos(a), 0, math.sin(a)))
        sb.plate([(-0.175, 0.012), (-0.175, 0.045), (-0.14, 0.045), (-0.11, 0.016)], oliveD, au=(0, 1, 0),
                 av=tuple(d), origin=(0, 0, 0), w0=-0.0025, w1=0.0025, bevel=0.0008, seg=1)
    shell = sb.to_object("shell")
    shell.location = (0.5, 0.2, 0.0)
    finish(b, "mortar", [shell])


ALL = dict(crossbow=build_crossbow, flail=build_flail, javelin=build_javelin, bomb=build_bomb, pan=build_pan,
           bazooka=build_bazooka, mortar=build_mortar)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for n in (args or list(ALL)):
    ALL[n]()
