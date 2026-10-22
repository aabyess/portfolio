# Headless builder for 4 low-poly medieval tavern villagers.
# Blender Z-up, character faces -Y (toes toward -Y), character's left = +X. Origin = feet center.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler, Quaternion

REPO = "/Users/sang/GitHub/portfolio/.claude/worktrees/portfolio-bgm"
OUT_GLB = os.path.join(REPO, "models", "npc")
OUT_SRC = os.path.join(REPO, "models", "src")
os.makedirs(OUT_GLB, exist_ok=True)
os.makedirs(OUT_SRC, exist_ok=True)
FPS = 24
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# ---------------------------------------------------------------- skeleton
SIDE = {"L": 1, "R": -1}
def skeleton():
    b = {}  # name: (head, tail, parent)
    b["Hips"] = ((0, 0, 0.93), (0, 0, 1.05), None)
    b["Spine"] = ((0, 0, 1.05), (0, 0, 1.25), "Hips")
    b["Chest"] = ((0, 0, 1.25), (0, 0, 1.47), "Spine")
    b["Neck"] = ((0, 0, 1.47), (0, 0, 1.56), "Chest")
    b["Head"] = ((0, 0, 1.56), (0, 0, 1.80), "Neck")
    for s, k in SIDE.items():
        b[f"UpperArm.{s}"] = ((0.21 * k, 0, 1.42), (0.24 * k, 0, 1.15), "Chest")
        b[f"LowerArm.{s}"] = ((0.24 * k, 0, 1.15), (0.25 * k, 0, 0.92), f"UpperArm.{s}")
        b[f"Hand.{s}"] = ((0.25 * k, 0, 0.92), (0.25 * k, 0, 0.82), f"LowerArm.{s}")
        b[f"UpperLeg.{s}"] = ((0.10 * k, 0, 0.92), (0.10 * k, 0, 0.50), "Hips")
        b[f"LowerLeg.{s}"] = ((0.10 * k, 0, 0.50), (0.10 * k, 0, 0.09), f"UpperLeg.{s}")
        b[f"Foot.{s}"] = ((0.10 * k, 0, 0.09), (0.10 * k, -0.15, 0.03), f"LowerLeg.{s}")
    # prop bone: mug center, child of right hand. Mug axis (top) points -Y at rest.
    b["Prop.R"] = ((-0.17, 0.0, 0.875), (-0.17, -0.08, 0.875), "Hand.R")
    return b

# ---------------------------------------------------------------- mesh builder
class Builder:
    def __init__(self):
        self.verts, self.faces, self.fmat, self.weights = [], [], [], []
        self.mats = {}  # name -> (index, color, metal)
    def mat(self, name, color, metal=0.0):
        if name not in self.mats:
            self.mats[name] = (len(self.mats), color, metal)
        return self.mats[name][0]
    def _w(self, wt, p):
        if callable(wt):
            return wt(p)
        return {wt: 1.0}
    def add(self, verts, faces, mat, wt):
        base = len(self.verts)
        for v in verts:
            v = Vector(v)
            self.verts.append(v)
            self.weights.append(self._w(wt, v))
        for f in faces:
            self.faces.append([base + i for i in f])
            self.fmat.append(mat)

    def box(self, c, s, mat, wt, rot=None):
        c = Vector(c); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        vs = []
        for x in (-hx, hx):
            for y in (-hy, hy):
                for z in (-hz, hz):
                    v = Vector((x, y, z))
                    if rot: v = Euler([math.radians(a) for a in rot]).to_matrix() @ v
                    vs.append(c + v)
        f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        self.add(vs, f, mat, wt)

    def tube(self, pts, radii, mat, wt, segs=8, cap0=True, cap1=True, phase=None):
        """Loft rings along a polyline. radii: list of r or (rx, ry)."""
        pts = [Vector(p) for p in pts]
        if phase is None: phase = math.pi / segs
        vs, fs = [], []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            u = Vector((1, 0, 0))
            if abs(d.dot(u)) > 0.9: u = Vector((0, 0, 1))
            u = (u - d * d.dot(u)).normalized(); v = d.cross(u)
            r = radii[i]; rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
            for k in range(segs):
                a = phase + 2 * math.pi * k / segs
                vs.append(p + u * (math.cos(a) * rx) + v * (math.sin(a) * ry))
        n = len(pts)
        for i in range(n - 1):
            for k in range(segs):
                a, b = i * segs + k, i * segs + (k + 1) % segs
                fs.append((a, b, b + segs, a + segs))
        if cap0: fs.append(tuple(reversed(range(segs))))
        if cap1: fs.append(tuple((n - 1) * segs + k for k in range(segs)))
        self.add(vs, fs, mat, wt)

    def sphere(self, c, r, mat, wt, segs=8, rings=6, keep=None):
        c = Vector(c); rx, ry, rz = r
        vs = [c + Vector((0, 0, -rz))]
        for j in range(1, rings):
            th = -math.pi / 2 + math.pi * j / rings
            for k in range(segs):
                a = 2 * math.pi * k / segs + math.pi / segs
                vs.append(c + Vector((math.cos(th) * math.cos(a) * rx, math.cos(th) * math.sin(a) * ry, math.sin(th) * rz)))
        vs.append(c + Vector((0, 0, rz)))
        top = len(vs) - 1
        fs = []
        for k in range(segs):
            fs.append((0, 1 + (k + 1) % segs, 1 + k))
        for j in range(rings - 2):
            for k in range(segs):
                a = 1 + j * segs + k; b = 1 + j * segs + (k + 1) % segs
                fs.append((a, b, b + segs, a + segs))
        o = 1 + (rings - 2) * segs
        for k in range(segs):
            fs.append((o + k, o + (k + 1) % segs, top))
        if keep:  # drop faces whose centroid fails keep(centroid - c)
            fs = [f for f in fs if keep(sum((vs[i] for i in f), Vector()) / len(f) - c)]
        self.add(vs, fs, mat, wt)

# weight helpers ------------------------------------------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def legblend(z_top=0.98, z_bot=0.80, back_factor=1.0, xw=0.12):
    """Skirt/apron weights: above z_top -> Hips, below z_bot -> legs (split by x)."""
    def f(p):
        t = clamp((z_top - p.z) / (z_top - z_bot))
        if back_factor != 1.0:
            ff = 1.0 if p.y <= 0 else 1.0 + (back_factor - 1.0) * clamp(p.y / 0.15)
            t *= ff
        wl = clamp(0.5 + p.x / (2 * xw))
        w = {"Hips": 1 - t, "UpperLeg.L": t * wl, "UpperLeg.R": t * (1 - wl)}
        return {k: v for k, v in w.items() if v > 1e-4}
    return f
def legblend3(z_top=0.98, z_bot=0.80, zk_top=0.60, zk_bot=0.44, xw=0.12, lower_max=1.0):
    """Long robes: Hips -> UpperLeg (z_top..z_bot) -> LowerLeg (zk_top..zk_bot). Max 4 influences."""
    def f(p):
        t = clamp((z_top - p.z) / (z_top - z_bot))
        u = clamp((zk_top - p.z) / (zk_top - zk_bot)) * lower_max
        wl = clamp(0.5 + p.x / (2 * xw))
        w = {"Hips": 1 - t, "UpperLeg.L": t * (1 - u) * wl, "UpperLeg.R": t * (1 - u) * (1 - wl),
             "LowerLeg.L": t * u * wl, "LowerLeg.R": t * u * (1 - wl)}
        return {k: v for k, v in w.items() if v > 1e-4}
    return f
def panel(B, zs, hw, ys, thick, m, wt):
    """Flat hanging panel (apron/tabard). ys = front-face y per level; thickness goes toward +Y."""
    vs, fs = [], []
    for z, w, y in zip(zs, hw, ys):
        vs += [Vector((-w, y, z)), Vector((w, y, z))]
    vs += [v + Vector((0, thick, 0)) for v in vs]
    n = len(zs); N = 2 * n
    for i in range(n - 1):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        fs += [(a, b, c, d), (d + N, c + N, b + N, a + N), (a, d, d + N, a + N), (b + N, c + N, c, b)]
    fs += [(0, N, N + 1, 1), (2 * n - 2, 2 * n - 1, N + 2 * n - 1, N + 2 * n - 2)]
    B.add(vs, fs, m, wt)
def zsplit(zcut, above, below):
    return lambda p: {above: 1.0} if p.z >= zcut else {below: 1.0}

# ---------------------------------------------------------------- palette
C = dict(
    skin=(0.80, 0.56, 0.42), skin2=(0.62, 0.42, 0.30), eye=(0.06, 0.04, 0.03),
    wood=(0.42, 0.25, 0.12), band=(0.18, 0.16, 0.15), foam=(0.93, 0.88, 0.74),
    cream=(0.86, 0.80, 0.64), brown=(0.36, 0.21, 0.10), dbrown=(0.20, 0.12, 0.07),
    ochre=(0.72, 0.52, 0.18), dred=(0.50, 0.11, 0.08), green=(0.24, 0.32, 0.18),
    steel=(0.55, 0.56, 0.58), mail=(0.38, 0.39, 0.42), wine=(0.46, 0.14, 0.13),
    leather=(0.30, 0.18, 0.09), grey=(0.34, 0.31, 0.28), hair_red=(0.48, 0.22, 0.09),
    beard=(0.42, 0.30, 0.20), white=(0.90, 0.87, 0.80),
)

# ---------------------------------------------------------------- base body
def base_body(B, o):
    sk = B.mat("Skin", o.get("skin", C["skin"]))
    eye = B.mat("Eye", C["eye"])
    shirt = B.mat("Shirt", o["shirt"]); pants = B.mat("Pants", o["pants"])
    shoes = B.mat("Shoes", o["shoes"]); sleeve = B.mat("Sleeve", o.get("sleeve", o["shirt"]))
    boots = o.get("boots")
    belly = o.get("belly", 1.0); broad = o.get("broad", 1.0)
    pants_by_side = {"L": pants, "R": B.mat("PantsR", o["pants_r"]) if o.get("pants_r") else pants}
    for s, k in SIDE.items():
        x = 0.10 * k
        pants_s = pants_by_side[s]
        B.box((x, -0.045, 0.045), (0.11, 0.24, 0.09), shoes, f"Foot.{s}")
        if boots:
            bm = B.mat("Boots", boots)
            B.tube([(x, 0, 0.07), (x, 0, 0.32)], [0.068, 0.072], bm, f"LowerLeg.{s}")
            B.tube([(x, 0, 0.30), (x, 0, 0.53)], [0.062, 0.072], pants_s, f"LowerLeg.{s}", cap0=False)
        else:
            B.tube([(x, 0, 0.07), (x, 0, 0.53)], [0.055, 0.072], pants_s, f"LowerLeg.{s}")
        if not o.get("no_thigh"):
            B.tube([(x, 0, 0.48), (x, 0, 0.97)], [0.074, 0.095], pants_s, f"UpperLeg.{s}")
        # arms
        ax0, ax1, ax2 = 0.21 * k, 0.24 * k, 0.25 * k
        B.sphere((ax0, 0, 1.42), (0.065 * broad, 0.065 * broad, 0.065 * broad), sleeve, f"UpperArm.{s}", segs=8, rings=5)
        B.tube([(ax0, 0, 1.43), (ax1, 0, 1.13)], [0.058 * broad, 0.05 * broad], sleeve, f"UpperArm.{s}")
        B.tube([(ax1, 0, 1.17), (ax2, 0, 0.93)], [o.get("fore_r", 0.046), 0.04], B.mat("Fore", o.get("fore", o.get("sleeve", o["shirt"]))), f"LowerArm.{s}")
        B.sphere((ax2, -0.005, 0.875), (0.042, 0.048, 0.058), sk, f"Hand.{s}", segs=6, rings=4)
    # pelvis & torso
    B.tube([(0, 0, 0.86), (0, 0, 1.05)], [(0.17, 0.11), (0.165 * belly ** 0.5, 0.115 * belly ** 0.5)], pants, "Hips")
    B.tube([(0, 0, 1.03), (0, 0, 1.14), (0, 0, 1.27)],
           [(0.165 * belly ** 0.5, 0.115 * belly ** 0.5), (0.17 * belly, 0.125 * belly), (0.175 * belly ** 0.7, 0.12 * belly ** 0.7)], shirt, "Spine")
    B.tube([(0, 0, 1.25), (0, 0, 1.40), (0, 0, 1.49)],
           [(0.175 * belly ** 0.7, 0.12 * belly ** 0.7), (0.185 * broad, 0.115 * broad), (0.13 * broad, 0.09)], shirt, "Chest")
    B.tube([(0, 0, 1.46), (0, 0, 1.59)], [0.048, 0.044], sk, "Neck", segs=6)
    # head
    B.sphere((0, -0.005, 1.67), (0.105, 0.11, 0.125), sk, "Head", segs=8, rings=6)
    B.box((0, -0.118, 1.655), (0.034, 0.04, 0.05), sk, "Head")
    for k in (1, -1):
        B.box((0.042 * k, -0.098, 1.69), (0.024, 0.02, 0.03), eye, "Head")
        B.box((0.10 * k, -0.005, 1.665), (0.025, 0.04, 0.05), sk, "Head")  # ears

def tankard(B):
    wood = B.mat("MugWood", C["wood"]); band = B.mat("MugBand", C["band"]); foam = B.mat("Foam", C["foam"])
    cx, cz = -0.165, 0.875   # mug center (rest); axis along -Y (top = -Y)
    B.tube([(cx, 0.065, cz), (cx, -0.065, cz)], [0.048, 0.052], wood, "Prop.R", segs=8)
    for yy in (0.04, -0.04):
        B.tube([(cx, yy + 0.008, cz), (cx, yy - 0.008, cz)], [0.054, 0.054], band, "Prop.R", segs=8)
    B.tube([(cx, -0.06, cz), (cx, -0.08, cz)], [0.046, 0.03], foam, "Prop.R", segs=8)
    # handle (between mug and fist, toward -X i.e. toward the right hand)
    B.box((cx - 0.062, 0.0, cz), (0.022, 0.085, 0.03), wood, "Prop.R")

# ---------------------------------------------------------------- characters
def innkeeper(B):
    base_body(B, dict(shirt=C["cream"], pants=C["dbrown"], shoes=C["leather"], belly=1.3,
                      skin=(0.82, 0.55, 0.42)))
    vest = B.mat("Vest", C["brown"]); apron = B.mat("Apron", C["white"]); beard = B.mat("Beard", C["beard"])
    # vest over chest (open front is implied by apron)
    B.tube([(0, 0.0, 1.20), (0, 0, 1.40), (0, 0, 1.47)], [(0.205, 0.14), (0.195, 0.125), (0.14, 0.098)], vest, "Chest", cap0=True)
    # apron: front panel from chest to knees
    def panel(B, zs, half_w, ys, thick, m, wt):
        pts_f, pts_b = [], []
        for z, w, y in zip(zs, half_w, ys):
            pts_f += [Vector((-w, y, z)), Vector((w, y, z))]
        vs = []
        for p in pts_f: vs.append(p)
        for p in pts_f: vs.append(p + Vector((0, thick, 0)))
        n = len(zs); fs = []
        N = 2 * n
        for i in range(n - 1):
            a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
            fs.append((a, b, c, d)); fs.append((d + N, c + N, b + N, a + N))
            fs.append((a, d, d + N, a + N)); fs.append((b + N, c + N, c, b))
        fs.append((0, N, N + 1, 1)); fs.append((2 * n - 2, 2 * n - 1, N + 2 * n - 1, N + 2 * n - 2))
        B.add(vs, fs, m, wt)
    B.panel = panel
    def apron_w(p):
        if p.z > 1.08: return {"Spine": 1.0}
        return legblend(0.98, 0.80)(p)
    panel(B, [1.30, 1.14, 1.0, 0.90, 0.75, 0.60], [0.13, 0.19, 0.19, 0.17, 0.155, 0.145],
          [-0.125, -0.175, -0.165, -0.135, -0.105, -0.105], 0.012, apron, apron_w)
    # apron strings/belt
    B.tube([(0, 0, 1.10), (0, 0, 1.15)], [(0.225, 0.172), (0.225, 0.172)], apron, "Spine", segs=10)
    # bald head with side/back hair ring + big beard
    B.box((0, 0.075, 1.645), (0.17, 0.06, 0.07), beard, "Head")
    for k in (1, -1):
        B.box((0.095 * k, 0.02, 1.665), (0.035, 0.09, 0.06), beard, "Head")
    B.sphere((0, -0.075, 1.575), (0.10, 0.07, 0.085), beard, "Head", segs=8, rings=5)
    B.box((0, -0.115, 1.625), (0.11, 0.03, 0.025), beard, "Head")  # moustache
    B.box((0, -0.10, 1.745), (0.15, 0.03, 0.018), beard, "Head")   # brows
    tankard(B)

def traveler(B):
    base_body(B, dict(shirt=C["ochre"], pants=C["grey"], shoes=C["dbrown"], boots=C["leather"],
                      sleeve=C["ochre"], skin=(0.74, 0.52, 0.38)))
    cloak = B.mat("Cloak", C["green"]); belt = B.mat("Belt", C["leather"]); hair = B.mat("Hair", C["dbrown"])
    B.tube([(0, 0, 1.00), (0, 0, 1.06)], [(0.18, 0.125), (0.18, 0.125)], belt, "Hips", segs=10)
    B.box((0.13, -0.10, 0.98), (0.07, 0.04, 0.08), belt, "Hips")  # pouch
    # shoulder mantle
    B.tube([(0, 0.0, 1.30), (0, 0, 1.43), (0, 0, 1.52)], [(0.27, 0.17), (0.24, 0.15), (0.12, 0.10)], cloak, "Chest", segs=10, cap0=False)
    # cape on the back: from shoulders to calves
    def cape_w(p):
        if p.z > 1.2: return {"Chest": 1.0}
        if p.z > 1.0: return {"Spine": 1.0}
        return {"Hips": 1.0}
    zs = [1.46, 1.30, 1.10, 0.90, 0.67, 0.46]
    hw = [0.20, 0.25, 0.26, 0.27, 0.28, 0.29]
    ys = [0.10, 0.16, 0.18, 0.19, 0.21, 0.23]
    vs, fs = [], []
    for z, w, y in zip(zs, hw, ys):
        for t in (-1, -0.5, 0, 0.5, 1):
            vs.append(Vector((w * t, y - 0.05 * (1 - t * t) * -1 + 0.0, z)))
    n = len(zs); m = 5
    for i in range(n - 1):
        for j in range(m - 1):
            a = i * m + j
            fs.append((a, a + 1, a + m + 1, a + m))
    vs2 = [v + Vector((0, 0.015, 0)) for v in vs]
    off = len(vs)
    fs2 = [tuple(reversed([i + off for i in f])) for f in fs]
    B.add(vs + vs2, fs + fs2, cloak, cape_w)
    # hood: shell around head with face opening + tip
    def keep(d):
        front = d.y < -0.03 and d.z < 0.10 and abs(d.x) < 0.11
        return not front
    B.sphere((0, 0.018, 1.685), (0.128, 0.135, 0.148), cloak, "Head", segs=10, rings=7, keep=keep)
    B.tube([(0, 0.12, 1.72), (0, 0.21, 1.60)], [0.05, 0.012], cloak, "Head", segs=6)
    B.box((0, -0.085, 1.745), (0.17, 0.05, 0.03), hair, "Head")  # fringe
    B.sphere((0, -0.07, 1.585), (0.085, 0.055, 0.05), hair, "Head", segs=8, rings=4)  # stubble beard
    tankard(B)

def guard(B):
    base_body(B, dict(shirt=C["mail"], pants=C["dbrown"], shoes=C["leather"], boots=C["leather"],
                      sleeve=C["mail"], fore=C["leather"], fore_r=0.05, skin=(0.78, 0.54, 0.40)))
    tab = B.mat("Tabard", C["dred"]); em = B.mat("Emblem", C["ochre"]); steel = B.mat("Steel", C["steel"], 0.5)
    belt = B.mat("Belt", C["leather"]); hair = B.mat("Hair", C["dbrown"])
    # tabard torso (sleeveless tube) + front and back hanging panels
    B.tube([(0, 0, 0.98), (0, 0, 1.20), (0, 0, 1.42), (0, 0, 1.49)],
           [(0.185, 0.135), (0.19, 0.138), (0.19, 0.122), (0.135, 0.095)], tab, lambda p: {"Chest": 1.0} if p.z > 1.25 else ({"Spine": 1.0} if p.z > 1.05 else {"Hips": 1.0}), segs=10)
    def panel(zs, hw, ys, thick, m, wt):
        vs, fs = [], []
        for z, w, y in zip(zs, hw, ys):
            vs += [Vector((-w, y, z)), Vector((w, y, z))]
        vs += [v + Vector((0, thick, 0)) for v in vs]
        n = len(zs); N = 2 * n
        for i in range(n - 1):
            a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
            fs += [(a, b, c, d), (d + N, c + N, b + N, a + N), (a, d, d + N, a + N), (b + N, c + N, c, b)]
        fs += [(0, N, N + 1, 1), (2 * n - 2, 2 * n - 1, N + 2 * n - 1, N + 2 * n - 2)]
        B.add(vs, fs, m, wt)
    panel([1.00, 0.88, 0.72, 0.58], [0.15, 0.15, 0.145, 0.14], [-0.15, -0.12, -0.105, -0.105], 0.012, tab, legblend(1.0, 0.84))
    panel([1.00, 0.88, 0.72, 0.58], [0.15, 0.15, 0.145, 0.14], [0.135, 0.13, 0.13, 0.13], 0.012, tab, {"Hips": 1.0} and (lambda p: {"Hips": 1.0}))
    # emblem (yellow cross) on chest
    B.box((0, -0.143, 1.27), (0.035, 0.012, 0.16), em, "Chest")
    B.box((0, -0.143, 1.30), (0.13, 0.012, 0.035), em, "Chest")
    B.tube([(0, 0, 1.00), (0, 0, 1.05)], [(0.2, 0.15), (0.2, 0.15)], belt, "Hips", segs=10)
    B.box((0, -0.15, 1.025), (0.05, 0.02, 0.05), steel, "Hips")
    # kettle helmet: dome + wide brim
    B.sphere((0, -0.005, 1.70), (0.125, 0.13, 0.12), steel, "Head", segs=10, rings=6, keep=lambda d: d.z > -0.01)
    B.tube([(0, -0.005, 1.695), (0, -0.005, 1.71)], [0.20, 0.20], steel, "Head", segs=10)
    B.tube([(0, -0.005, 1.80), (0, -0.005, 1.835)], [0.03, 0.012], steel, "Head", segs=6)
    B.box((0, -0.115, 1.625), (0.12, 0.03, 0.03), hair, "Head")  # moustache
    for k in (1, -1):
        B.box((0.10 * k, 0.03, 1.65), (0.03, 0.08, 0.07), hair, "Head")
    B.box((0, 0.085, 1.65), (0.16, 0.04, 0.08), hair, "Head")
    tankard(B)

def maid(B):
    base_body(B, dict(shirt=C["wine"], pants=C["skin2"], shoes=C["dbrown"], sleeve=C["cream"],
                      fore=C["skin"], fore_r=0.042, skin=(0.86, 0.63, 0.50)))
    dress = B.mat("Dress", C["wine"]); apron = B.mat("Apron", C["white"]); bonnet = B.mat("Bonnet", C["cream"])
    hair = B.mat("Hair", C["hair_red"])
    # skirt: cone from waist to mid-calf, legs below stay visible
    zs = [1.06, 0.94, 0.80, 0.60, 0.36]
    rr = [(0.175, 0.13), (0.215, 0.165), (0.25, 0.20), (0.28, 0.23), (0.31, 0.26)]
    B.tube([(0, 0, z) for z in zs], rr, dress, legblend(0.97, 0.74, back_factor=0.6, xw=0.14), segs=12, cap0=False, cap1=True)
    # apron over skirt (front)
    vs, fs = [], []
    zz = [1.02, 0.90, 0.78, 0.66, 0.54]; ww = [0.09, 0.11, 0.12, 0.125, 0.13]
    for z, w, (rx, ry) in zip(zz, ww, [(0.18, 0.135), (0.22, 0.17), (0.25, 0.20), (0.265, 0.215), (0.28, 0.23)]):
        y = -(ry * 0.97 + 0.01)
        vs += [Vector((-w, y, z)), Vector((w, y, z))]
    vs += [v + Vector((0, 0.01, 0)) for v in vs]
    n = len(zz); N = 2 * n
    for i in range(n - 1):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        fs += [(a, b, c, d), (d + N, c + N, b + N, a + N), (a, d, d + N, a + N), (b + N, c + N, c, b)]
    fs += [(0, N, N + 1, 1), (2 * n - 2, 2 * n - 1, N + 2 * n - 1, N + 2 * n - 2)]
    B.add(vs, fs, apron, legblend(0.97, 0.74, back_factor=0.6, xw=0.14))
    B.tube([(0, 0, 1.04), (0, 0, 1.09)], [(0.185, 0.14), (0.185, 0.14)], apron, "Spine", segs=10)
    # bodice lacing hint + white chemise collar
    B.tube([(0, 0, 1.43), (0, 0, 1.49)], [(0.17, 0.11), (0.12, 0.085)], bonnet, "Chest", segs=10)
    # hair: back volume + braid, bangs
    B.sphere((0, 0.03, 1.67), (0.115, 0.11, 0.13), hair, "Head", segs=8, rings=6, keep=lambda d: not (d.y < -0.02 and d.z < 0.08))
    B.tube([(0, 0.11, 1.62), (0, 0.13, 1.50), (0, 0.12, 1.36)], [0.035, 0.03, 0.02], hair, "Head", segs=6)
    # bonnet: cap over the top/back + frill band
    B.sphere((0, 0.02, 1.70), (0.13, 0.13, 0.13), bonnet, "Head", segs=10, rings=6,
             keep=lambda d: d.z > -0.02 and not (d.y < -0.06 and d.z < 0.06))
    B.tube([(0, -0.085, 1.68), (0, -0.115, 1.80)], [(0.135, 0.02), (0.13, 0.02)], bonnet, "Head", segs=8, phase=0)
    tankard(B)

# ---------------------------------------------------------------- batch 2 (6 more)
def blacksmith(B):
    tan = (0.70, 0.47, 0.33)
    base_body(B, dict(shirt=(0.27, 0.25, 0.24), sleeve=tan, fore=tan, fore_r=0.052, pants=C["dbrown"],
                      shoes=C["dbrown"], boots=(0.16, 0.10, 0.06), belly=1.15, broad=1.28, skin=tan))
    lea = B.mat("LeatherApron", (0.33, 0.19, 0.09)); hair = B.mat("Hair", (0.09, 0.07, 0.05))
    band = B.mat("Band", (0.18, 0.11, 0.06)); steel = B.mat("Steel", C["steel"], 0.5)
    def w(p):
        if p.z > 1.27: return {"Chest": 1.0}
        if p.z > 1.08: return {"Spine": 1.0}
        return legblend(0.98, 0.80)(p)
    panel(B, [1.42, 1.25, 1.05, 0.92, 0.75, 0.56], [0.12, 0.17, 0.19, 0.18, 0.16, 0.15],
          [-0.155, -0.165, -0.165, -0.13, -0.105, -0.105], 0.014, lea, w)
    for k in (1, -1):  # apron neck straps + wrist bands
        B.box((0.07 * k, -0.11, 1.47), (0.03, 0.09, 0.07), lea, "Chest", rot=(-35, 0, 0))
        B.tube([(0.245 * k, 0, 1.00), (0.25 * k, 0, 0.94)], [0.052, 0.05], band, f"LowerArm.{'L' if k > 0 else 'R'}", segs=6)
    B.tube([(0, 0, 1.08), (0, 0, 1.13)], [(0.215, 0.165), (0.215, 0.165)], band, "Spine", segs=10)
    B.box((0.0, -0.17, 1.105), (0.05, 0.02, 0.045), steel, "Spine")
    # flat-top short hair, short boxy beard, heavy brows
    B.sphere((0, -0.0, 1.69), (0.112, 0.117, 0.12), hair, "Head", segs=8, rings=6, keep=lambda d: d.z > 0.035 or (d.y > 0.02 and d.z > -0.05))
    B.box((0, -0.075, 1.585), (0.15, 0.08, 0.075), hair, "Head")
    B.box((0, -0.11, 1.625), (0.10, 0.025, 0.02), hair, "Head")
    B.box((0, -0.102, 1.72), (0.15, 0.03, 0.025), hair, "Head")
    tankard(B)

def bard(B):
    teal = (0.16, 0.36, 0.38)
    base_body(B, dict(shirt=teal, sleeve=C["ochre"], fore=teal, pants=C["dred"], pants_r=C["ochre"],
                      shoes=C["dbrown"], skin=(0.84, 0.62, 0.48)))
    t = B.mat("Doublet", teal); och = B.mat("Trim", C["ochre"]); red = B.mat("Cap", C["dred"])
    fea = B.mat("Feather", (0.93, 0.86, 0.62)); hair = B.mat("Hair", (0.70, 0.50, 0.22))
    lw = B.mat("LuteWood", (0.64, 0.42, 0.19)); ld = B.mat("LuteDark", (0.22, 0.13, 0.07))
    # doublet peplum + belt, puffed shoulders, pointed shoes
    B.tube([(0, 0, 1.06), (0, 0, 0.90), (0, 0, 0.84)], [(0.18, 0.13), (0.215, 0.165), (0.22, 0.17)], t, legblend(1.0, 0.86), segs=10, cap0=False)
    B.tube([(0, 0, 1.05), (0, 0, 1.10)], [(0.19, 0.14), (0.19, 0.14)], och, "Spine", segs=10)
    for s, k in SIDE.items():
        B.sphere((0.215 * k, 0, 1.40), (0.085, 0.085, 0.08), och, f"UpperArm.{s}", segs=8, rings=5)
        B.tube([(0.10 * k, -0.10, 0.04), (0.10 * k, -0.22, 0.05)], [0.04, 0.008], B.mat("Shoes", C["dbrown"]), f"Foot.{s}", segs=5)
    # strap across chest
    B.tube([(-0.17, -0.10, 1.44), (0.0, -0.138, 1.27), (0.17, -0.13, 1.10)], [0.014, 0.014, 0.014], ld, "Chest", segs=4)
    # beret + feather, bob hair
    B.sphere((0, 0.01, 1.67), (0.114, 0.118, 0.13), hair, "Head", segs=8, rings=6, keep=lambda d: not (d.y < -0.02 and d.z < 0.07))
    B.sphere((0.03, 0.0, 1.785), (0.15, 0.14, 0.05), red, "Head", segs=10, rings=4)
    B.tube([(0.10, 0.04, 1.80), (0.17, 0.11, 1.87), (0.24, 0.19, 1.92)], [0.022, 0.016, 0.004], fea, "Head", segs=4)
    # lute on the back (diagonal neck)
    B.sphere((0.05, 0.18, 1.12), (0.12, 0.05, 0.15), lw, "Chest", segs=8, rings=5)
    B.tube([(0.03, 0.17, 1.24), (-0.10, 0.165, 1.58)], [0.025, 0.02], ld, "Chest", segs=4)
    B.box((-0.115, 0.165, 1.62), (0.05, 0.03, 0.08), ld, "Chest", rot=(0, 20, 0))
    B.tube([(0.05, 0.225, 1.10), (0.05, 0.235, 1.10)], [0.03, 0.03], ld, "Chest", segs=8)  # sound hole
    tankard(B)

def monk(B):
    robe = (0.38, 0.25, 0.14)
    base_body(B, dict(shirt=robe, sleeve=robe, fore=robe, fore_r=0.05, pants=robe, shoes=(0.45, 0.30, 0.16),
                      belly=1.1, skin=(0.80, 0.58, 0.45), no_thigh=True))
    r = B.mat("Robe", robe); rope = B.mat("Rope", (0.78, 0.68, 0.45)); hair = B.mat("Hair", (0.36, 0.26, 0.16))
    wood = B.mat("CrossWood", C["wood"])
    B.tube([(0, 0, z) for z in (1.08, 0.94, 0.75, 0.55, 0.32, 0.09)],
           [(0.18, 0.135), (0.205, 0.16), (0.225, 0.18), (0.24, 0.195), (0.255, 0.21), (0.27, 0.225)],
           r, legblend3(0.97, 0.80, 0.60, 0.44, xw=0.14), segs=12, cap0=False, cap1=False)
    for s, k in SIDE.items():  # wide open sleeves
        B.tube([(0.24 * k, 0, 1.17), (0.25 * k, 0, 0.93)], [0.058, 0.09], r, f"LowerArm.{s}", segs=8, cap0=False, cap1=False)
    B.tube([(0, 0, 1.03), (0, 0, 1.065)], [(0.205, 0.16), (0.205, 0.16)], rope, "Hips", segs=10)
    B.tube([(0.07, -0.155, 1.03), (0.075, -0.17, 0.86), (0.08, -0.17, 0.72)], [0.013, 0.012, 0.012], rope, legblend(1.0, 0.88), segs=4)
    # hood down: bunched cowl around the neck + lump on the back
    B.tube([(0, 0, 1.40), (0, 0, 1.47), (0, 0, 1.53)], [(0.19, 0.14), (0.17, 0.135), (0.11, 0.10)], r, "Chest", segs=10, cap0=False)
    B.sphere((0, 0.13, 1.40), (0.13, 0.07, 0.10), r, "Chest", segs=8, rings=5)
    B.box((0, -0.15, 1.30), (0.02, 0.012, 0.07), wood, "Chest"); B.box((0, -0.15, 1.315), (0.05, 0.012, 0.018), wood, "Chest")
    # tonsure: ring of hair, bald crown
    B.tube([(0, -0.005, 1.62), (0, -0.005, 1.665), (0, -0.005, 1.72)], [(0.11, 0.115), (0.113, 0.118), (0.098, 0.103)], hair, "Head", segs=10, cap0=False, cap1=False)
    tankard(B)

def baker(B):
    base_body(B, dict(shirt=C["cream"], sleeve=C["cream"], fore=(0.88, 0.64, 0.52), fore_r=0.044,
                      pants=C["skin2"], shoes=C["dbrown"], belly=1.15, skin=(0.88, 0.64, 0.52), no_thigh=True))
    sk = B.mat("Skirt", (0.58, 0.40, 0.20)); bod = B.mat("Bodice", (0.30, 0.18, 0.10))
    ap = B.mat("FlourApron", (0.95, 0.94, 0.90)); sc = B.mat("Scarf", (0.68, 0.30, 0.15)); hair = B.mat("Hair", (0.40, 0.24, 0.12))
    cheek = B.mat("Cheek", (0.90, 0.50, 0.42))
    zs = [1.06, 0.94, 0.80, 0.58, 0.32]
    rr = [(0.19, 0.145), (0.23, 0.18), (0.265, 0.21), (0.29, 0.235), (0.31, 0.255)]
    wt = legblend3(0.97, 0.78, 0.58, 0.40, xw=0.14)
    B.tube([(0, 0, z) for z in zs], rr, sk, wt, segs=12, cap0=False, cap1=False)
    B.tube([(0, 0, 1.08), (0, 0, 1.25), (0, 0, 1.40)], [(0.20, 0.15), (0.205, 0.155), (0.195, 0.125)], bod, "Spine", segs=10, cap0=False, cap1=False)
    for s, k in SIDE.items():  # rolled-up sleeve cuffs
        B.tube([(0.235 * k, 0, 1.19), (0.24 * k, 0, 1.13)], [0.062, 0.06], B.mat("Sleeve", C["cream"]), f"UpperArm.{s}", segs=8)
    def apw(p):
        return {"Spine": 1.0} if p.z > 1.09 else wt(p)
    ys = [-0.158, -0.168] + [-(ry * 0.97 + 0.028) for ry in (0.18, 0.205, 0.218, 0.23)]
    panel(B, [1.24, 1.10, 0.94, 0.80, 0.68, 0.56], [0.12, 0.14, 0.13, 0.135, 0.14, 0.14], ys, 0.01, ap, apw)
    B.tube([(0, 0, 1.065), (0, 0, 1.10)], [(0.205, 0.16), (0.205, 0.16)], ap, "Spine", segs=10)
    # headscarf with knot and tails
    B.sphere((0, 0.012, 1.69), (0.122, 0.128, 0.132), sc, "Head", segs=10, rings=6, keep=lambda d: d.z > -0.035 and not (d.y < -0.05 and d.z < 0.075))
    B.sphere((0, 0.125, 1.66), (0.04, 0.035, 0.035), sc, "Head", segs=6, rings=4)
    for k in (1, -1):
        B.box((0.025 * k, 0.135, 1.59), (0.035, 0.015, 0.11), sc, "Head", rot=(0, 12 * k, 0))
        B.box((0.06 * k, -0.095, 1.645), (0.03, 0.01, 0.022), cheek, "Head")
    B.box((0, -0.098, 1.745), (0.15, 0.03, 0.03), hair, "Head")
    tankard(B)

def noble(B):
    plum = (0.36, 0.13, 0.30); gold = (0.80, 0.62, 0.20)
    base_body(B, dict(shirt=plum, sleeve=plum, fore=plum, pants=C["skin2"], shoes=gold, belly=0.9,
                      skin=(0.90, 0.72, 0.62), no_thigh=True))
    g = B.mat("Gown", plum); au = B.mat("Gold", gold, 0.6); veil = B.mat("Veil", (0.92, 0.89, 0.82)); hair = B.mat("Hair", (0.75, 0.58, 0.30))
    zs = [1.10, 0.96, 0.80, 0.60, 0.36, 0.085]
    rr = [(0.155, 0.115), (0.19, 0.15), (0.22, 0.18), (0.25, 0.21), (0.285, 0.24), (0.33, 0.285)]
    wt = legblend3(0.97, 0.80, 0.60, 0.44, xw=0.14)
    B.tube([(0, 0, z) for z in zs], rr, g, wt, segs=12, cap0=False, cap1=False)
    B.tube([(0, 0, 0.15), (0, 0, 0.09)], [(0.306, 0.261), (0.337, 0.292)], au, wt, segs=12, cap0=False, cap1=False)  # hem trim
    B.tube([(0, 0, 1.06), (0, 0, 1.10)], [(0.165, 0.125), (0.16, 0.12)], au, "Hips", segs=10)
    B.tube([(0.03, -0.13, 1.06), (0.035, -0.20, 0.80), (0.04, -0.22, 0.55)], [0.012, 0.012, 0.01], au, legblend3(1.05, 0.95, 0.70, 0.55), segs=4)
    for s, k in SIDE.items():  # bell sleeves
        B.tube([(0.24 * k, 0, 1.16), (0.25 * k, 0, 0.98), (0.255 * k, 0, 0.90)], [0.052, 0.085, 0.11], g, f"LowerArm.{s}", segs=8, cap0=False, cap1=False)
    B.tube([(0, 0, 1.44), (0, 0, 1.47)], [(0.15, 0.10), (0.13, 0.095)], au, "Chest", segs=10)  # neckline trim
    # hair, circlet, veil (cap behind + hanging cloth)
    B.sphere((0, 0.012, 1.672), (0.113, 0.118, 0.13), hair, "Head", segs=8, rings=6, keep=lambda d: not (d.y < -0.02 and d.z < 0.075))
    B.tube([(0, -0.003, 1.715), (0, -0.003, 1.74)], [(0.118, 0.124), (0.116, 0.122)], au, "Head", segs=10, cap0=False, cap1=False)
    B.box((0, -0.126, 1.728), (0.03, 0.012, 0.03), B.mat("Gem", (0.55, 0.08, 0.10)), "Head")
    B.sphere((0, 0.03, 1.69), (0.13, 0.13, 0.14), veil, "Head", segs=10, rings=6, keep=lambda d: d.y > -0.02 and d.z > -0.07)
    panel(B, [1.68, 1.55, 1.42, 1.32], [0.11, 0.13, 0.15, 0.16], [0.12, 0.135, 0.13, 0.13], 0.01, veil,
          lambda p: {"Head": 1.0} if p.z > 1.50 else {"Chest": 1.0})
    tankard(B)

def herbalist(B):
    base_body(B, dict(shirt=(0.80, 0.74, 0.60), sleeve=(0.80, 0.74, 0.60), pants=C["skin2"], shoes=C["leather"],
                      skin=(0.78, 0.56, 0.44), no_thigh=True))
    sage = (0.40, 0.50, 0.30)
    sh = B.mat("Shawl", sage); sk = B.mat("Skirt", (0.30, 0.20, 0.12)); hair = B.mat("Hair", (0.70, 0.68, 0.64))
    wick = B.mat("Wicker", (0.62, 0.46, 0.24)); herb = B.mat("Herbs", (0.30, 0.48, 0.18)); flower = B.mat("Flower", (0.62, 0.45, 0.70))
    zs = [1.06, 0.94, 0.78, 0.56, 0.22]
    rr = [(0.175, 0.13), (0.205, 0.16), (0.23, 0.185), (0.25, 0.20), (0.27, 0.22)]
    B.tube([(0, 0, z) for z in zs], rr, sk, legblend3(0.97, 0.80, 0.58, 0.42, xw=0.14), segs=12, cap0=False, cap1=False)
    B.tube([(0, 0, 1.05), (0, 0, 1.09)], [(0.18, 0.135), (0.18, 0.135)], B.mat("Belt", C["leather"]), "Spine", segs=10)
    # shawl over shoulders (ends above elbows) + point down the back
    B.tube([(0, 0, 1.53), (0, 0, 1.45), (0, 0, 1.32), (0, 0, 1.21)],
           [(0.12, 0.10), (0.26, 0.17), (0.295, 0.20), (0.30, 0.205)], sh, "Chest", segs=12, cap0=False, cap1=False)
    vs = [Vector((-0.24, 0.17, 1.24)), Vector((0.24, 0.17, 1.24)), Vector((0.0, 0.17, 0.98))]
    B.add(vs + [v + Vector((0, 0.012, 0)) for v in vs], [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], sh,
          lambda p: {"Chest": 1.0} if p.z > 1.15 else {"Spine": 1.0})
    # hood up
    def keep(d):
        return not (d.y < -0.03 and d.z < 0.10 and abs(d.x) < 0.11)
    B.sphere((0, 0.02, 1.68), (0.13, 0.137, 0.15), sh, "Head", segs=10, rings=7, keep=keep)
    for k in (1, -1):
        B.box((0.098 * k, -0.06, 1.63), (0.025, 0.03, 0.10), hair, "Head")
    # basket in the crook of the left elbow (weighted to UpperArm.L so it stays roughly upright when seated)
    bx = 0.36
    B.tube([(bx, 0, 0.84), (bx, 0, 0.97)], [(0.085, 0.065), (0.105, 0.08)], wick, "UpperArm.L", segs=8, cap0=True, cap1=False)
    B.tube([(bx, 0, 0.955), (bx, 0, 0.975)], [(0.11, 0.085), (0.11, 0.085)], wick, "UpperArm.L", segs=8)
    B.tube([(bx - 0.10, 0, 0.97), (bx - 0.085, 0, 1.08), (bx, 0, 1.14), (bx + 0.085, 0, 1.08), (bx + 0.10, 0, 0.97)],
           [0.011] * 5, wick, "UpperArm.L", segs=4, cap0=False, cap1=False)
    for dx, dy, m in ((-0.04, 0.02, herb), (0.03, -0.02, herb), (0.0, 0.03, flower), (0.05, 0.03, herb)):
        B.sphere((bx + dx, dy, 0.985), (0.04, 0.035, 0.035), m, "UpperArm.L", segs=6, rings=3)
    tankard(B)

CHARS = {"innkeeper": innkeeper, "traveler": traveler, "guard": guard, "maid": maid,
         "blacksmith": blacksmith, "bard": bard, "monk": monk, "baker": baker, "noble": noble, "herbalist": herbalist}

# ---------------------------------------------------------------- animation
def rest_rot(pb):
    return pb.bone.matrix_local.to_3x3()

class Anim:
    """Rotations given as armature-axis Euler XYZ (deg) applied in the bone's rest frame (relative to parent)."""
    def __init__(self, arm):
        self.arm = arm; self.prevq = {}
    def pose(self, rots, hips_loc=(0, 0, 0), prop_scale=1.0):
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            e = rots.get(pb.name, (0, 0, 0))
            R = Euler([math.radians(a) for a in e], 'XYZ').to_matrix()
            M = rest_rot(pb)
            q = (M.inverted() @ R @ M).to_quaternion()
            pq = self.prevq.get(pb.name)
            if pq is not None and pq.dot(q) < 0: q.negate()
            self.prevq[pb.name] = q.copy()
            pb.rotation_quaternion = q
            pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
        hp = self.arm.pose.bones["Hips"]
        hp.location = rest_rot(hp).inverted() @ Vector(hips_loc)
        s = max(prop_scale, 0.001)
        self.arm.pose.bones["Prop.R"].scale = (s, s, s)
    def key(self, f):
        for pb in self.arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("scale", frame=f)

def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def smooth(t): t = clamp(t); return t * t * (3 - 2 * t)
def add(*vs): return tuple(sum(c) for c in zip(*vs))

SIT_HIPS = (0, 0.0, -0.42)
def sit_base(t, period):
    w = 2 * math.pi * t / period
    sway = math.sin(w)
    r = {
        "Hips": (0, 0, 0),
        "UpperLeg.L": (-90, 0, 9), "UpperLeg.R": (-90, 0, -9),
        "LowerLeg.L": (90, 0, 0), "LowerLeg.R": (90, 0, 0),
        "Foot.L": (0, 0, 0), "Foot.R": (0, 0, 0),
        "Spine": (6 + 1.0 * math.sin(2 * w), 0, 1.5 * sway),
        "Chest": (3 + 1.2 * math.sin(2 * w + 0.5), 0, 1.0 * sway),
        "Neck": (-3, 0, 0), "Head": (-2 + 2 * math.sin(w + 1), 0, 8 * math.sin(w * 0.5 + 0.3) if period > 60 else 0),
        "UpperArm.L": (-28, 0, 4), "LowerArm.L": (-55, 0, 0), "Hand.L": (0, 0, 0),
        "UpperArm.R": (-22, 0, 8), "LowerArm.R": (-68 + 2 * sway, 0, 0), "Hand.R": (0, 0, 0),
    }
    return r

def act_idle(A):
    P = 72
    for f in range(0, P + 1, 2):
        w = 2 * math.pi * f / P
        b = math.sin(w)
        r = {"Spine": (1.0 * b, 0, 0.8 * math.sin(w + 0.7)), "Chest": (1.5 * b, 0, 0), "Neck": (0, 0, 0),
             "Head": (-1.0 * b, 0, 3 * math.sin(w * 1 + 1.3)),
             "UpperArm.L": (2 * b, 0, -4), "UpperArm.R": (2 * b, 0, 4),
             "LowerArm.L": (-8 - 2 * b, 0, 0), "LowerArm.R": (-8 - 2 * b, 0, 0),
             "Hips": (0, 0, 1.0 * math.sin(w + 0.7)),
             "UpperLeg.L": (0, 0, 1.5), "UpperLeg.R": (0, 0, -1.5)}
        A.pose(r, hips_loc=(0.008 * math.sin(w + 0.7), 0, 0.004 * b), prop_scale=0.0)
        A.key(f)
    return P

def act_walk(A):
    P = 24
    for f in range(0, P + 1, 1):
        ph = 2 * math.pi * f / P
        s, c = math.sin(ph), math.cos(ph)
        thL, thR = -26 * s, 26 * s
        kL = 6 + 42 * max(0.0, c) ** 1.5 + 6 * max(0.0, -c)
        kR = 6 + 42 * max(0.0, -c) ** 1.5 + 6 * max(0.0, c)
        fL = -(thL + kL) * 0.6 if c < 0 else -kL * 0.3
        fR = -(thR + kR) * 0.6 if c > 0 else -kR * 0.3
        r = {"UpperLeg.L": (thL, 0, 1.5), "UpperLeg.R": (thR, 0, -1.5),
             "LowerLeg.L": (kL, 0, 0), "LowerLeg.R": (kR, 0, 0),
             "Foot.L": (fL, 0, 0), "Foot.R": (fR, 0, 0),
             "UpperArm.L": (22 * s, 0, -5), "UpperArm.R": (-22 * s, 0, 5),
             "LowerArm.L": (-18 - 10 * max(0, -s), 0, 0), "LowerArm.R": (-18 - 10 * max(0, s), 0, 0),
             "Hips": (0, 0, 6 * s), "Spine": (3, 0, -3 * s), "Chest": (1, 0, -4 * s),
             "Head": (-2, 0, 1 * s)}
        bob = -0.035 * abs(s) + 0.01
        A.pose(r, hips_loc=(0, 0, bob - 0.01), prop_scale=0.0)
        A.key(f)
    return P

def act_sit(A):
    P = 96
    for f in range(0, P + 1, 2):
        A.pose(sit_base(f, P), hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

# right-arm drinking poses (armature-axis eulers)
ARM_REST = {"UpperArm.R": (-22, 0, 8), "LowerArm.R": (-68, 0, 0), "Hand.R": (0, 0, 0)}
ARM_DRINK = {"UpperArm.R": (-72, 0, 62), "LowerArm.R": (-95, 0, -14), "Hand.R": (-22, 40, 26)}
ARM_DRINK2 = {"UpperArm.R": (-80, 0, 80), "LowerArm.R": (-103, 0, -20), "Hand.R": (-41, 59, 38)}
ARM_CHEERS = {"UpperArm.R": (-120, 0, 15), "LowerArm.R": (-12, 0, 0), "Hand.R": (42, 0, 0)}
ARM_CHEERS2 = {"UpperArm.R": (-128, 0, 13), "LowerArm.R": (-4, 0, 0), "Hand.R": (42, 0, 0)}

def blend_arm(a, b, t):
    return {k: lerp(a[k], b[k], t) for k in a}

def act_drink(A):
    P = 72
    keys = [(0, ARM_REST, 0), (12, ARM_REST, 0), (28, ARM_DRINK, 1), (40, ARM_DRINK2, 1.3), (50, ARM_DRINK, 1), (64, ARM_REST, 0), (72, ARM_REST, 0)]
    for f in range(0, P + 1, 2):
        r = sit_base(f, P)
        for i in range(len(keys) - 1):
            f0, a0, h0 = keys[i]; f1, a1, h1 = keys[i + 1]
            if f0 <= f <= f1:
                t = smooth((f - f0) / (f1 - f0)); arm = blend_arm(a0, a1, t); h = h0 + (h1 - h0) * t
                break
        r.update(arm)
        r["Head"] = (-2 - 14 * h, 0, 0)
        r["Neck"] = (-3 - 5 * h, 0, 0)
        r["Chest"] = (3 - 4 * h, 0, 0)
        A.pose(r, hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

def act_cheers(A):
    P = 36
    keys = [(0, ARM_REST, 0), (10, ARM_CHEERS, 1), (14, ARM_CHEERS2, 1.4), (18, ARM_CHEERS, 1), (24, ARM_CHEERS, 1), (36, ARM_REST, 0)]
    for f in range(0, P + 1, 2):
        r = sit_base(f, P)
        for i in range(len(keys) - 1):
            f0, a0, h0 = keys[i]; f1, a1, h1 = keys[i + 1]
            if f0 <= f <= f1:
                t = smooth((f - f0) / (f1 - f0)); arm = blend_arm(a0, a1, t); h = h0 + (h1 - h0) * t
                break
        r.update(arm)
        r["Spine"] = (6 + 4 * h, 0, 4 * h)
        r["Chest"] = (3 + 2 * h, 0, 3 * h)
        r["Head"] = (-2 - 6 * h, 0, 0)
        r["UpperArm.L"] = (-28 + 6 * h, 0, 4)
        A.pose(r, hips_loc=SIT_HIPS, prop_scale=1.0); A.key(f)
    return P

ACTIONS = [("Idle", act_idle), ("Walk", act_walk), ("Sit", act_sit), ("Drink", act_drink), ("Cheers", act_cheers)]

# ---------------------------------------------------------------- build one
def build(name, fn):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    # armature
    ad = bpy.data.armatures.new(f"{name}_Rig")
    arm = bpy.data.objects.new("Armature", ad)
    sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    sk = skeleton()
    for bn, (h, t, p) in sk.items():
        eb = ad.edit_bones.new(bn); eb.head = h; eb.tail = t
        eb.roll = 0.0
    for bn, (h, t, p) in sk.items():
        if p: ad.edit_bones[bn].parent = ad.edit_bones[p]; ad.edit_bones[bn].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    ad.display_type = 'STICK'
    # mesh
    B = Builder(); fn(B)
    me = bpy.data.meshes.new(f"{name}_Mesh")
    me.from_pydata([tuple(v) for v in B.verts], [], B.faces)
    me.update()
    ob = bpy.data.objects.new(f"NPC_{name.capitalize()}", me)
    sc.collection.objects.link(ob)
    for mname, (idx, col, metal) in sorted(B.mats.items(), key=lambda kv: kv[1][0]):
        m = bpy.data.materials.new(f"{name}_{mname}")
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*col, 1)
        bsdf.inputs["Roughness"].default_value = 0.85 if metal == 0 else 0.45
        bsdf.inputs["Metallic"].default_value = metal
        m.diffuse_color = (*col, 1)
        me.materials.append(m)
    for i, p in enumerate(me.polygons):
        p.material_index = B.fmat[i]
    # fix normals per island
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    # vertex groups (remove_doubles may merge verts: weights recomputed from final positions via nearest original)
    groups = {bn: ob.vertex_groups.new(name=bn) for bn in sk}
    from mathutils.kdtree import KDTree
    kd = KDTree(len(B.verts))
    for i, v in enumerate(B.verts): kd.insert(v, i)
    kd.balance()
    for v in me.vertices:
        _, i, _ = kd.find(v.co)
        for bn, w in B.weights[i].items():
            groups[bn].add([v.index], w, 'REPLACE')
    ob.parent = arm
    mod = ob.modifiers.new("Armature", 'ARMATURE'); mod.object = arm
    # actions
    arm.animation_data_create()
    A = Anim(arm)
    for an, af in ACTIONS:
        act = bpy.data.actions.new(an); act.use_fake_user = True
        arm.animation_data.action = act
        A.prevq = {}
        P = af(A)
        act.use_frame_range = True; act.frame_start = 0; act.frame_end = P
        act.use_cyclic = True
        tr = arm.animation_data.nla_tracks.new(); tr.name = an
        st = tr.strips.new(an, 0, act); tr.mute = True
        arm.animation_data.action = None
    # rest pose
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    sc.frame_start = 0; sc.frame_end = 96
    blend = os.path.join(OUT_SRC, f"npc-{name}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    glb = os.path.join(OUT_GLB, f"npc-{name}.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False,
                              export_skins=True, export_yup=True, export_apply=False,
                              export_anim_slide_to_zero=True, export_optimize_animation_size=True,
                              export_extra_animations=False)
    print("BUILT", name, len(me.polygons), "faces", os.path.getsize(glb), "bytes")

if __name__ == "__main__":
    for n, f in CHARS.items():
        if ONLY and n not in ONLY: continue
        build(n, f)
