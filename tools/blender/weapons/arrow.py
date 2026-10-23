"""War arrow ~0.77 m: ash shaft, horn nock, three goose fletches with linen whipping, barbed broadhead.
Origin at the nock (string groove); points along -Y in Blender (= glTF +Z)."""
import sys
sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/weapons")
from wcommon import *

reset_all()


def feather_tex(seed, base, tip):
    W, H = 256, 128
    u = np.linspace(0, 1, W, endpoint=False)[None, :]
    v = np.linspace(0, 1, H, endpoint=False)[:, None]
    rng = np.random.default_rng(seed)
    jitter = tnoise(256, 8, seed)[:H, :W] * 0.3
    ph = (u * 70 + v * 22 + jitter * 3) % 1.0           # barbs slanting back toward the nock
    barb = 0.75 + 0.25 * np.sin(ph * 2 * np.pi)
    split = (tnoise(256, 30, seed + 1)[:H, :W] > 0.78) * 0.25   # separated barbs
    edge = np.clip((v - 0.55) / 0.45, 0, 1)
    c0, c1 = np.array(srgb2lin(base)) ** (1 / 2.2), np.array(srgb2lin(tip)) ** (1 / 2.2)
    col = c0[None, None, :] * (1 - edge[..., None]) + c1[None, None, :] * edge[..., None]
    col = col * (barb - split)[..., None]
    rach = np.exp(-(v / 0.06) ** 2)                       # quill (rachis) along the base
    col = col * (1 - rach[..., None]) + np.array([0.86, 0.84, 0.78])[None, None, :] * rach[..., None]
    rough = np.full((H, W), 0.8)
    return dict(base=col, orm=orm(rough, 0.0), nrm=None)


ash = pbr("Arrow_Ash", tex_wood(256, seed=61, rings=10, pore_amt=0.4, nrm=0.6, late_amt=0.12), tint='#d2b083',
          nrm_px=0)
head = pbr("Arrow_Head", tex_steel(256, seed=62, dark=0.10, polish=0.6), nrm_strength=0.5)
horn = flat_mat("Arrow_Horn", '#2c2620', rough=0.35)
linen = pbr("Arrow_Whipping", tex_plain(64, 63, base_lum=0.9, rough=0.85, scale=20, amp=0.25), tint='#b23a2a',
            nrm_px=0)
hen = pbr("Fletch_Grey", feather_tex(64, '#8a8a86', '#3d3b38'), nrm_px=0)
cock = pbr("Fletch_White", feather_tex(65, '#e8e4da', '#a9a39a'), nrm_px=0)
glue = flat_mat("Arrow_Pitch", '#2a1d12', rough=0.5)

b = WBuilder()
L = 0.680                                    # shaft length (nock to socket)
# shaft: barrelled taper
prof = []
for i in range(31):
    t = i / 30
    y = -0.006 - (L - 0.006) * t
    r = 0.0038 + 0.0009 * math.sin(math.pi * min(1, t * 1.15)) ** 0.8
    prof.append((y, r))
b.lathe(prof, ash, n=12, axis='Y', cap0=True, cap1=True, uv=('cyl', (0, 1, 0), (0, 0, 0), 4.0, 1.0))
# horn nock with string slot (slot along X, cock feather on +Z)
b.lathe([(-0.022, 0.0040), (-0.019, 0.0043), (-0.004, 0.0043), (-0.0005, 0.0038), (0.0, 0.0)], horn, n=12,
        axis='Y', cap0=False)
for sx in (-1, 1):
    b.rbox((sx * 0.0027, -0.0025, 0), (0.0026, 0.007, 0.0080), horn, r=0.0011)
# fletching (3 vanes, slight helical twist)
FL0, FL1 = -0.030, -0.165


def vane(theta, m):
    NI, NK = 16, 4
    verts, uvs, faces = [], [], []
    for i in range(NI + 1):
        t = i / NI
        y = FL0 + (FL1 - FL0) * t
        h = 0.0165 * min(1.0, (t + 0.02) / 0.10) ** 0.6 * (1 - 0.88 * t ** 0.85)
        h = max(h, 0.0012)
        a = theta + math.radians(4.0) * t
        rad = V((math.sin(a), 0, math.cos(a)))
        r0 = 0.0044
        for k in range(NK + 1):
            s = k / NK
            # vane curls slightly (cupped)
            tang = V((math.cos(a), 0, -math.sin(a)))
            p = V((0, y - 0.004 * s * s, 0)) + rad * (r0 + h * s) + tang * (0.0012 * s * s)
            verts.append(p)
            uvs.append((t, s))
    for i in range(NI):
        for k in range(NK):
            a_ = i * (NK + 1) + k
            faces.append((a_, a_ + 1, a_ + NK + 2, a_ + NK + 1))
    b.add(verts, faces, m, uv=('vert', uvs))
    # quill strip glued on the shaft
    qp = [V((0, FL0 + (FL1 - FL0) * t, 0)) + V((math.sin(theta + math.radians(4) * t), 0,
          math.cos(theta + math.radians(4) * t))) * 0.0046 for t in np.linspace(-0.03, 1.02, 10)]
    b.sweep(qp, 0.0007, cock if m is cock else hen, n=5, up=(0, 0, 1))


vane(0.0, cock)
vane(2 * math.pi / 3, hen)
vane(-2 * math.pi / 3, hen)
# whipping (thread wraps) at both fletch ends + behind the head
for y0, n in ((FL0 + 0.006, 6), (FL1 - 0.004, 7)):
    for k in range(n):
        b.torus((0, y0 - k * 0.0014, 0), 0.0049, 0.00062, linen, nu=12, nv=4, axis='Y')
# broadhead: socket + barbed blade (flat faces +-Z), slight diamond section via a centre ridge
SY = -L
b.lathe([(SY + 0.010, 0.0041), (SY, 0.0050), (SY - 0.028, 0.0034), (SY - 0.034, 0.0026)], head, n=12, axis='Y',
        cap0=False, cap1=True)
b.lathe([(SY + 0.012, 0.0047), (SY + 0.0095, 0.0052), (SY + 0.007, 0.0046)], glue, n=12, axis='Y', cap0=False,
        cap1=False)
TIP = SY - 0.072
outline = [(0.0, 0.0), (0.020, 0.0105), (0.046, 0.0185), (0.056, 0.0195), (0.050, 0.0130), (0.040, 0.0060),
           (0.044, 0.0035), (0.044, -0.0035), (0.040, -0.0060), (0.050, -0.0130), (0.056, -0.0195),
           (0.046, -0.0185), (0.020, -0.0105)]
b.plate([(TIP + d, x) for d, x in outline], head, au=(0, 1, 0), av=(1, 0, 0), origin=(0, 0, 0),
        w0=-0.0007, w1=0.0007, bevel=0.00055, seg=1)
# centre ridge
b.sweep([V((0, TIP + 0.004, 0)), V((0, TIP + 0.025, 0)), V((0, SY - 0.026, 0))], [0.0004, 0.0016, 0.0026], head,
        n=4, up=(1, 0, 0), ellipse=(1.0, 1.0))

ob = b.to_object("arrow")
print("TRIS", mesh_tris(ob))
export("arrow")
