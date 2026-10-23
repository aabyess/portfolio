"""Low-poly rigged horse (rigid skinning, weight 1 per part) + Idle/Walk/Gallop actions."""
import bpy, math
from mathutils import Vector, Quaternion, Matrix
from common import Builder, mat, empty, FPS

COAT = None


def mats():
    return dict(
        coat=mat("Horse_Coat", "#8a4a26"),
        coat_dk=mat("Horse_CoatDark", "#6a3519"),
        mane=mat("Horse_Mane", "#2a1a12"),
        hoof=mat("Horse_Hoof", "#2e2622"),
        white=mat("Horse_Blaze", "#efe6d6"),
        eye=mat("Horse_Eye", "#111014"),
        leather=mat("Leather_Dark", "#3b2416"),
        saddle=mat("Leather_Saddle", "#6b3d1f"),
        blanket=mat("Cloth_Red", "#8e2b22"),
        trim=mat("Cloth_Gold", "#c79a3b"),
        brass=mat("Metal_Brass", "#b8924a", rough=0.5),
    )


LEGS = {  # name: (x, upper head, upper tail/knee, foot)
    'fl': (0.15, (-0.48, 1.15), (-0.48, 0.58), (-0.49, 0.02)),
    'fr': (-0.15, (-0.48, 1.15), (-0.48, 0.58), (-0.49, 0.02)),
    'rl': (0.15, (0.42, 1.18), (0.53, 0.60), (0.47, 0.02)),
    'rr': (-0.15, (0.42, 1.18), (0.53, 0.60), (0.47, 0.02)),
}


def build_horse(dy=0.0, saddle=True, harness=False, name="horse"):
    M = mats()
    O = Vector((0, dy, 0))

    def P(x, y, z):
        return Vector((x, y + dy, z))

    # ---------------- armature
    arm_data = bpy.data.armatures.new(name + "_rig")
    arm = bpy.data.objects.new(name + "_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(n, h, t, parent=None):
        b = eb.new(n)
        b.head, b.tail = h, t
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b

    bone('root', P(0, 0, 0), P(0, -0.4, 0))
    bone('body', P(0, 0.0, 1.22), P(0, -0.4, 1.22), 'root')
    bone('neck', P(0, -0.62, 1.40), P(0, -0.95, 1.90), 'body')
    bone('head', P(0, -0.95, 1.92), P(0, -1.32, 1.62), 'neck')
    bone('tail', P(0, 0.70, 1.38), P(0, 0.98, 0.88), 'body')
    for k, (x, h, kn, ft) in LEGS.items():
        bone('leg_%s_up' % k, P(x, *h), P(x, *kn), 'body')
        bone('leg_%s_low' % k, P(x, *kn), P(x, *ft), 'leg_%s_up' % k)
    bpy.ops.object.mode_set(mode='OBJECT')

    # ---------------- mesh
    b = Builder()
    c, cd = M['coat'], M['coat_dk']
    # torso
    b.seg(P(0, -0.80, 1.24), P(0, -0.56, 1.24), (0.40, 0.46), (0.50, 0.54), c, 'body')   # chest
    b.seg(P(0, -0.58, 1.23), P(0, 0.52, 1.24), (0.50, 0.54), (0.52, 0.52), c, 'body')    # barrel
    b.seg(P(0, 0.50, 1.26), P(0, 0.76, 1.24), (0.52, 0.52), (0.40, 0.40), c, 'body')     # rump
    b.seg(P(0, -0.40, 0.98), P(0, 0.40, 0.98), (0.40, 0.06), (0.40, 0.06), cd, 'body')   # belly shade
    b.seg(P(0, -0.66, 1.42), P(0, -0.40, 1.50), (0.30, 0.10), (0.26, 0.06), c, 'body')   # withers
    # neck + mane
    b.seg(P(0, -0.58, 1.30), P(0, -0.98, 1.90), (0.30, 0.50), (0.22, 0.30), c, 'neck')
    b.seg(P(0, -0.50, 1.56), P(0, -0.90, 2.04), (0.09, 0.12), (0.08, 0.10), M['mane'], 'neck')
    # head
    b.seg(P(0, -0.90, 1.97), P(0, -1.36, 1.62), (0.22, 0.28), (0.17, 0.22), c, 'head')
    b.seg(P(0, -1.18, 1.82), P(0, -1.37, 1.66), (0.06, 0.03), (0.05, 0.03), M['white'], 'head', twist_up=(0, -0.6, 0.8))
    for s in (1, -1):
        b.seg(P(0.07 * s, -0.90, 2.06), P(0.08 * s, -0.86, 2.20), (0.06, 0.05), (0.02, 0.02), c, 'head')   # ear
        b.box(P(0.112 * s, -1.03, 1.89), (0.02, 0.05, 0.04), M['eye'], 'head')                           # eye
        b.box(P(0.06 * s, -1.37, 1.62), (0.03, 0.02, 0.03), M['eye'], 'head')                            # nostril
    b.seg(P(0, -0.92, 2.04), P(0, -1.00, 1.98), (0.12, 0.06), (0.10, 0.04), M['mane'], 'head')       # forelock
    # bridle
    L = M['leather']
    b.seg(P(0, -1.22, 1.75), P(0, -1.27, 1.71), (0.20, 0.25), (0.20, 0.25), L, 'head')               # noseband
    b.seg(P(0, -0.95, 1.99), P(0, -0.99, 1.96), (0.245, 0.30), (0.24, 0.29), L, 'head')               # browband
    for s in (1, -1):
        b.seg(P(0.115 * s, -0.97, 1.96), P(0.105 * s, -1.24, 1.73), (0.015, 0.03), (0.015, 0.03), L, 'head')  # cheek
        b.box(P(0.10 * s, -1.28, 1.66), (0.03, 0.035, 0.035), M['brass'], 'head')                          # bit ring
    # tail
    b.seg(P(0, 0.70, 1.40), P(0, 0.82, 1.30), (0.10, 0.10), (0.13, 0.12), M['mane'], 'tail')
    b.seg(P(0, 0.80, 1.32), P(0, 1.02, 0.84), (0.13, 0.13), (0.17, 0.07), M['mane'], 'tail')
    # legs
    for k, (x, h, kn, ft) in LEGS.items():
        front = k[0] == 'f'
        up_w = (0.17, 0.26) if front else (0.19, 0.36)
        b.seg(P(x, h[0], h[1] + 0.06), P(x, kn[0], kn[1]), up_w, (0.12, 0.14), c, 'leg_%s_up' % k)
        b.box(P(x, kn[0], kn[1]), (0.12, 0.14, 0.12), cd, 'leg_%s_low' % k)                            # knee
        b.seg(P(x, kn[0], kn[1]), P(x, ft[0], 0.12), (0.10, 0.11), (0.09, 0.10), c, 'leg_%s_low' % k)   # cannon
        b.seg(P(x, ft[0] - 0.005, 0.14), P(x, ft[0] - 0.01, 0.0), (0.12, 0.14), (0.14, 0.17), M['hoof'], 'leg_%s_low' % k)

    if saddle:
        sy = -0.14
        b.seg(P(0, sy - 0.30, 1.50), P(0, sy + 0.28, 1.50), (0.58, 0.035), (0.58, 0.035), M['blanket'], 'body')
        for s in (1, -1):
            b.seg(P(0.285 * s, sy - 0.30, 1.32), P(0.285 * s, sy + 0.28, 1.32), (0.03, 0.36), (0.03, 0.36), M['blanket'], 'body')
            b.seg(P(0.297 * s, sy - 0.30, 1.155), P(0.297 * s, sy + 0.28, 1.155), (0.012, 0.035), (0.012, 0.035), M['trim'], 'body')
        b.seg(P(0, sy - 0.24, 1.55), P(0, sy + 0.20, 1.55), (0.34, 0.07), (0.38, 0.07), M['saddle'], 'body')   # seat
        b.seg(P(0, sy - 0.28, 1.53), P(0, sy - 0.20, 1.67), (0.20, 0.08), (0.10, 0.06), M['saddle'], 'body')   # pommel
        b.seg(P(0, sy + 0.16, 1.55), P(0, sy + 0.26, 1.66), (0.36, 0.06), (0.32, 0.05), M['saddle'], 'body')   # cantle
        b.box(P(0, sy - 0.27, 1.66), (0.05, 0.05, 0.04), M['brass'], 'body')
        for s in (1, -1):
            b.seg(P(0.21 * s, sy - 0.18, 1.56), P(0.24 * s, sy + 0.12, 1.56), (0.03, 0.30), (0.03, 0.26), M['saddle'], 'body')  # flap
            b.seg(P(0.25 * s, sy - 0.04, 1.42), P(0.27 * s, sy - 0.06, 1.00), (0.03, 0.04), (0.03, 0.04), L, 'body')  # strap
            b.box(P(0.27 * s, sy - 0.06, 0.97), (0.04, 0.12, 0.06), M['brass'], 'body')                        # stirrup
        b.seg(P(0, sy + 0.05, 0.955), P(0, sy + 0.11, 0.955), (0.44, 0.03), (0.44, 0.03), L, 'body')      # girth
        for s in (1, -1):
            b.seg(P(0.11 * s, -1.27, 1.68), P(0.17 * s, -0.42, 1.60), (0.015, 0.015), (0.015, 0.015), L, 'neck')  # reins
    if harness:
        # collar round the neck base + saddle pad + belly band + traces
        b.seg(P(0, -0.64, 1.39), P(0, -0.73, 1.53), (0.38, 0.60), (0.36, 0.56), M['leather'], 'neck')
        b.seg(P(0, -0.625, 1.37), P(0, -0.645, 1.40), (0.40, 0.63), (0.40, 0.63), M['trim'], 'neck')
        b.seg(P(0, -0.47, 1.62), P(0, -0.43, 1.69), (0.10, 0.06), (0.06, 0.05), M['brass'], 'neck')
        for s in (1, -1):
            b.box(P(0.20 * s, -0.70, 1.45), (0.04, 0.06, 0.10), M['brass'], 'neck')
        b.seg(P(0, -0.32, 1.50), P(0, -0.06, 1.50), (0.40, 0.05), (0.40, 0.05), M['blanket'], 'body')   # pad
        for s in (1, -1):
            b.seg(P(0.255 * s, -0.24, 1.48), P(0.265 * s, -0.24, 0.97), (0.03, 0.07), (0.03, 0.07), L, 'body')
            b.seg(P(0.265 * s, -0.68, 1.22), P(0.27 * s, 0.70, 1.12), (0.02, 0.05), (0.02, 0.05), L, 'body')   # trace
        b.seg(P(0, -0.27, 0.955), P(0, -0.21, 0.955), (0.44, 0.03), (0.44, 0.03), L, 'body')
        for s in (1, -1):
            b.seg(P(0.11 * s, -1.27, 1.68), P(0.16 * s, -0.45, 1.55), (0.015, 0.015), (0.015, 0.015), L, 'neck')

    ob = b.to_object(name)
    ob.parent = arm
    mod = ob.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm

    seat = None
    if saddle:
        seat = empty("seat", P(0, -0.15, 1.59), parent=arm, parent_bone='body')

    build_actions(arm)
    return arm, ob, seat


# ---------------------------------------------------------------- animation
def _axis_local(arm, bn, world_axis):
    R = arm.data.bones[bn].matrix_local.to_3x3()
    return (R.inverted() @ Vector(world_axis)).normalized()


def build_actions(arm):
    arm.animation_data_create()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    specs = [('Idle', 48, pose_idle), ('Walk', 29, pose_walk), ('Gallop', 14, pose_gallop)]
    for name, n, fn in specs:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f in range(n + 1):
            t = (f % n) / n
            pose = fn(t)
            for pb in arm.pose.bones:
                rx, rz, dz = pose.get(pb.name, (0.0, 0.0, 0.0))
                q = Quaternion(_axis_local(arm, pb.name, (1, 0, 0)), rx) @ Quaternion((1, 0, 0, 0))
                if rz:
                    q = Quaternion(_axis_local(arm, pb.name, (0, 0, 1)), rz) @ q
                pb.rotation_quaternion = q
                R = arm.data.bones[pb.name].matrix_local.to_3x3()
                pb.location = R.inverted() @ Vector((0, 0, dz))
                pb.keyframe_insert('rotation_quaternion', frame=f)
                pb.keyframe_insert('location', frame=f)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, act)
        strip.mute = False
        track.mute = True
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


TAU = 2 * math.pi


def _legs(t, offs, A_f, A_h, B_f, B_h, bias=0.0):
    out = {}
    for k, off in offs.items():
        ph = TAU * (t + off)
        front = k[0] == 'f'
        A, B = (A_f, B_f) if front else (A_h, B_h)
        up = -A * math.sin(ph) + bias
        flex = B * max(0.0, math.cos(ph)) ** 1.5
        if front:
            out['leg_%s_up' % k] = (up, 0, 0)
            out['leg_%s_low' % k] = (flex, 0, 0)
        else:
            out['leg_%s_up' % k] = (up - flex * 0.35, 0, 0)
            out['leg_%s_low' % k] = (flex, 0, 0)
    return out


def pose_idle(t):
    ph = TAU * t
    return {
        'body': (0, 0, 0.006 * math.sin(ph)),
        'neck': (0.05 + 0.05 * math.sin(ph), 0, 0),
        'head': (0.04 * math.sin(ph + 1.0), 0.05 * math.sin(ph), 0),
        'tail': (0.0, 0.22 * math.sin(2 * ph), 0),
        'leg_rr_up': (-0.05, 0, 0), 'leg_rr_low': (0.18, 0, 0),
    }


def pose_walk(t):
    ph = TAU * t
    p = _legs(t, {'rl': 0.0, 'fl': 0.25, 'rr': 0.5, 'fr': 0.75}, 0.30, 0.26, 0.55, 0.40)
    p['body'] = (0.015 * math.sin(2 * ph), 0, 0.015 * math.cos(2 * ph))
    p['neck'] = (0.07 * math.sin(2 * ph + 0.6), 0, 0)
    p['head'] = (0.04 * math.sin(2 * ph), 0, 0)
    p['tail'] = (0.05, 0.10 * math.sin(ph), 0)
    return p


def pose_gallop(t):
    ph = TAU * t
    p = _legs(t, {'rr': 0.0, 'rl': 0.10, 'fr': 0.42, 'fl': 0.52}, 0.62, 0.55, 1.05, 0.75)
    p['body'] = (0.09 * math.sin(ph + 0.9), 0, 0.06 * math.sin(ph + 2.4) + 0.02)
    p['neck'] = (-0.10 + 0.16 * math.sin(ph - 0.8), 0, 0)
    p['head'] = (0.08 * math.sin(ph), 0, 0)
    p['tail'] = (0.55 + 0.12 * math.sin(ph), 0.05 * math.sin(ph), 0)
    return p
