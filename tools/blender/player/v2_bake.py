# Player v2 texturing: body atlas (albedo = vertex colour x procedural detail x AO, tangent normal map)
# + separate painted face texture (v2_head.paint_face) on a front-planar / cylinder UV layout.
import bpy, bmesh, math
import numpy as np
from lib_real import MATS
import v2_head as VH

RES = 1024

def _detail(nt, kind):
    N = nt.nodes; L = nt.links.new
    tc = N.new("ShaderNodeTexCoord")
    def noise(scale, detail=2.0, rough=0.5, vec=None):
        n = N.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail; n.inputs["Roughness"].default_value = rough
        L(vec or tc.outputs["Object"], n.inputs["Vector"]); return n.outputs["Fac"]
    def mapping(sc):
        m = N.new("ShaderNodeMapping"); m.inputs["Scale"].default_value = sc
        L(tc.outputs["Object"], m.inputs["Vector"]); return m.outputs["Vector"]
    def math_(op, a, b):
        m = N.new("ShaderNodeMath"); m.operation = op
        for i, x in enumerate((a, b)):
            if isinstance(x, (int, float)): m.inputs[i].default_value = x
            else: L(x, m.inputs[i])
        return m.outputs[0]
    def wave(scale, direction, dist=0.0, vec=None):
        w = N.new("ShaderNodeTexWave"); w.wave_type = 'BANDS'; w.bands_direction = direction
        w.inputs["Scale"].default_value = scale; w.inputs["Distortion"].default_value = dist
        L(vec or tc.outputs["Object"], w.inputs["Vector"]); return w.outputs["Fac"]
    if kind == "quilt":      # stitched channels every ~3.5 cm (vertical on the body, rings on the sleeves)
        g = math_('POWER', wave(9.0, 'X'), 10.0)
        weave = noise(160, 2, 0.5)
        h = math_('SUBTRACT', 1.0, math_('MULTIPLY', g, 0.85))
        return math_('ADD', math_('MULTIPLY', h, 0.85), math_('MULTIPLY', weave, 0.15))
    if kind == "weave":
        wv = math_('MULTIPLY', wave(220, 'X'), wave(220, 'Z'))
        wr = noise(16, 3, 0.55, mapping((1.0, 1.0, 0.30)))
        return math_('ADD', math_('MULTIPLY', wv, 0.15), math_('MULTIPLY', wr, 0.85))
    if kind == "grain":
        return math_('ADD', math_('MULTIPLY', noise(220, 6, 0.65), 0.6), math_('MULTIPLY', noise(18, 3), 0.4))
    if kind == "skin":
        return math_('ADD', math_('MULTIPLY', noise(700, 2), 0.3), math_('MULTIPLY', noise(40, 3), 0.7))
    if kind == "hair":
        return noise(180, 3, 0.6, mapping((1.0, 1.0, 0.15)))
    if kind == "metal":
        return math_('ADD', math_('MULTIPLY', noise(500, 2, 0.5, mapping((1, 1, 0.08))), 0.4), math_('MULTIPLY', noise(40, 4), 0.6))
    return noise(50, 1)

DETAIL = {  # key: (kind, bump strength, colour variation)
    "Quilt": ("quilt", 0.55, 0.22), "Cloth": ("weave", 0.30, 0.10), "Cape": ("weave", 0.28, 0.10),
    "Leather": ("grain", 0.45, 0.22), "Boot": ("grain", 0.40, 0.20), "Skin": ("skin", 0.08, 0.04),
    "Hair": ("hair", 0.45, 0.25), "Gold": ("metal", 0.15, 0.10),
}

def _face_uvs(me, face_mi):
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    nf = 0
    for f in bm.faces:
        if f.material_index != face_mi: continue
        c = f.calc_center_median(); n = f.normal
        front = n.y < -0.30 and c.y < -0.060 and abs(c.x) < 0.082 and 1.566 < c.z < 1.795
        for l in f.loops:
            co = l.vert.co
            l[uv].uv = VH.face_uv_front(co.x, co.z) if front else VH.face_uv_cyl(co.x, co.y, co.z)
        nf += front
    # cylinder seam at the back: faces straddling az=+-pi get u wrapped -> push them to one side
    for f in bm.faces:
        if f.material_index != face_mi: continue
        us = [l[uv].uv.x for l in f.loops]
        if min(us) > 0.81 and max(us) - min(us) > 0.09:
            for l in f.loops:
                if l[uv].uv.x < 0.91: l[uv].uv.x += 0.18
    bm.to_mesh(me); bm.free()
    print("FACE front faces", nf)

def texture(ob, bake=True):
    sc = bpy.context.scene
    me = ob.data
    mats = [m.name.split("_", 1)[1] for m in me.materials]
    face_mi = mats.index("Face")
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True)
    if not me.uv_layers: me.uv_layers.new(name="UVMap")
    # atlas UVs for everything except the face material
    for p in me.polygons: p.select = p.material_index != face_mi
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    try: bpy.ops.uv.pack_islands(margin=0.005, rotate=True)
    except Exception as e: print("pack failed", e)
    bpy.ops.object.mode_set(mode='OBJECT')
    _face_uvs(me, face_mi)
    # painted face image
    fimg = bpy.data.images.new("player_face", VH.FACE_RES, VH.FACE_RES, alpha=False)
    px = VH.paint_face()
    rgba = np.concatenate([px, np.ones(px.shape[:2] + (1,))], -1)
    fimg.pixels[:] = rgba.ravel(); fimg.pack()
    dummy = bpy.data.images.new("dummy", 64, 64, alpha=False)

    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'CPU'
    try: sc.cycles.use_denoising = False
    except Exception: pass
    alb = bpy.data.images.new("player_albedo", RES, RES, alpha=False)
    nrm = bpy.data.images.new("player_normal", RES, RES, alpha=False); nrm.colorspace_settings.name = 'Non-Color'
    aoi = bpy.data.images.new("player_ao", RES, RES, alpha=False); aoi.colorspace_settings.name = 'Non-Color'
    info = {}
    for m, key in zip(me.materials, mats):
        kind, bstr, cvar = DETAIL.get(key, ("none", 0.0, 0.0))
        nt = m.node_tree; N = nt.nodes; L = nt.links.new
        out = next(n for n in N if n.type == 'OUTPUT_MATERIAL'); bsdf = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
        vc = next(n for n in N if n.type == 'VERTEX_COLOR')
        emi = N.new("ShaderNodeEmission")
        if key != "Face":
            h = _detail(nt, kind)
            cf = N.new("ShaderNodeMath"); cf.operation = 'MULTIPLY_ADD'; L(h, cf.inputs[0]); cf.inputs[1].default_value = cvar; cf.inputs[2].default_value = 1 - cvar
            mixc = N.new("ShaderNodeMix"); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'; mixc.inputs[0].default_value = 1.0
            L(vc.outputs["Color"], mixc.inputs[6]); L(cf.outputs[0], mixc.inputs[7])
            L(mixc.outputs[2], emi.inputs["Color"])
            bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = bstr; bump.inputs["Distance"].default_value = 0.002
            L(h, bump.inputs["Height"]); L(bump.outputs["Normal"], bsdf.inputs["Normal"])
        img = N.new("ShaderNodeTexImage"); N.active = img
        info[m.name] = (key, out, bsdf, emi, img)
    def run(kind, image, **kw):
        for mname, (key, out, bsdf, emi, img) in info.items():
            img.image = dummy if key == "Face" else image
            m = bpy.data.materials[mname]; m.node_tree.nodes.active = img
            m.node_tree.links.new((emi if kind == 'EMIT' else bsdf).outputs[0], out.inputs["Surface"])
        bpy.ops.object.bake(type=kind, margin=8, use_clear=True, **kw)
    # bake only the non-face polygons' islands (face loops share UV space with nothing in the atlas images
    # because the face material writes into the dummy image)
    run('EMIT', alb)
    if bake:
        run('NORMAL', nrm, normal_space='TANGENT')
        sc.cycles.samples = 48
        run('AO', aoi)
        a = np.array(alb.pixels[:]).reshape(RES, RES, 4)
        o_ = np.array(aoi.pixels[:]).reshape(RES, RES, 4)[:, :, 0]
        f = 0.50 + 0.50 * np.clip(o_, 0, 1) ** 0.8
        lin = np.where(a[:, :, :3] <= 0.04045, a[:, :, :3] / 12.92, ((a[:, :, :3] + 0.055) / 1.055) ** 2.4) * f[:, :, None]
        a[:, :, :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, 1), 1 / 2.4) - 0.055)
        alb.pixels[:] = a.ravel()
    alb.pack()
    if bake: nrm.pack()
    bpy.data.images.remove(aoi); bpy.data.images.remove(dummy)
    for m, key in zip(me.materials, mats):
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        r, mt, sp = MATS[key]
        b.inputs["Roughness"].default_value = r; b.inputs["Metallic"].default_value = mt
        try: b.inputs["Specular IOR Level"].default_value = sp
        except Exception: pass
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = fimg if key == "Face" else alb
        nt.links.new(ti.outputs["Color"], b.inputs["Base Color"])
        if bake and key != "Face":
            tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm
            nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.0
            nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
        nt.links.new(b.outputs[0], out.inputs["Surface"])
    for ca in list(me.color_attributes): me.color_attributes.remove(ca)
    if not bake: bpy.data.images.remove(nrm)
    sc.render.engine = 'BLENDER_EEVEE'
