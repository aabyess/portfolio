"""Extra detail helpers for v3 (chain links, fins, rivets)."""
import math
from mathutils import Vector

V = Vector


def roller_chain(b, loop, x, pitch, plate_h, plate_t, gap, m, m_pin=None):
    """loop: closed list of points in the YZ plane (x ignored). Places alternating inner / outer side plates
    every `pitch` along the loop plus optional roller pins."""
    pts = [V((x, p[1], p[2])) for p in loop]
    n = len(pts)
    L = [0.0]
    for i in range(n):
        L.append(L[-1] + (pts[(i + 1) % n] - pts[i]).length)
    tot = L[-1]
    cnt = max(4, int(round(tot / pitch)))
    if cnt % 2:
        cnt += 1
    step = tot / cnt

    def at(s):
        s %= tot
        i = max(j for j in range(n) if L[j] <= s)
        f = (s - L[i]) / max(L[i + 1] - L[i], 1e-9)
        return pts[i].lerp(pts[(i + 1) % n], f)

    def box(p0, p1, w, h, xoff):
        d = (p1 - p0)
        t = d.normalized()
        u = V((1, 0, 0)).cross(t).normalized()
        c = (p0 + p1) / 2 + V((xoff, 0, 0))
        hl = d.length / 2 + h * 0.35
        vs = []
        for sx in (-1, 1):
            for st in (-1, 1):
                for su in (-1, 1):
                    vs.append(c + V((sx * w / 2, 0, 0)) + t * (st * hl) + u * (su * h / 2))
        fs = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        b.add(vs, fs, m, flat=True)
    for k in range(cnt):
        p0, p1 = at(k * step), at((k + 1) * step)
        inner = k % 2 == 0
        off = gap / 2 + (0 if inner else plate_t)
        hh = plate_h * (0.85 if inner else 1.0)
        for sx in (-1, 1):
            box(p0, p1, plate_t, hh, sx * (off + plate_t / 2))
        if m_pin is not None:
            b.lathe([(-gap / 2 - plate_t * 2.2, plate_h * 0.18), (gap / 2 + plate_t * 2.2, plate_h * 0.18)], m_pin,
                    n=6, axis='X', c=p0)
    return cnt


def sprocket(b, c, r, teeth, width, m, x_axis=True):
    """Toothed disc around axis X at c."""
    prof = []
    k = teeth * 2
    import bmesh
    verts, faces = [], []
    ring = []
    for i in range(k):
        a = 2 * math.pi * i / k
        rr = r if i % 2 == 0 else r * 0.90
        ring.append((math.cos(a) * rr, math.sin(a) * rr))
    for sx in (-width / 2, width / 2):
        for (y, z) in ring:
            verts.append(V(c) + V((sx, y, z)))
    verts.append(V(c) + V((-width / 2, 0, 0)))
    verts.append(V(c) + V((width / 2, 0, 0)))
    c0, c1 = 2 * k, 2 * k + 1
    for i in range(k):
        j = (i + 1) % k
        faces.append((i, j, k + j, k + i))
        faces.append((c0, j, i))
        faces.append((c1, k + i, k + j))
    b.add(verts, faces, m, flat=True)
