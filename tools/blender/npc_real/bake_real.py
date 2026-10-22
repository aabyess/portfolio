# Texture baking: UV unwrap, albedo (vertex colour x procedural detail x AO) and tangent-space normal map.
import bpy, math
from lib_real import MATS

DETAIL = {  # key: (kind, bump strength, colour variation)
    "Cloth": ("weave", 0.28, 0.12), "Leather": ("grain", 0.5, 0.25), "Skin": ("pores", 0.12, 0.05),
    "Hair": ("strands", 0.7, 0.35), "Metal": ("scratch", 0.25, 0.18), "Wood": ("wood", 0.5, 0.30),
    "Gold": ("scratch", 0.15, 0.10), "Eye": ("none", 0.0, 0.0), "Foam": ("pores", 0.3, 0.08),
}

def _detail_height(nt, kind):
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
    if kind == "weave":
        wv = math_('MULTIPLY', wave(2200, 'X'), wave(2200, 'Z'))
        wr = noise(16, 3, 0.55, mapping((1.0, 1.0, 0.30)))
        return math_('ADD', math_('MULTIPLY', wv, 0.12), math_('MULTIPLY', wr, 0.88))
    if kind == "grain":
        return math_('ADD', math_('MULTIPLY', noise(220, 6, 0.65), 0.6), math_('MULTIPLY', noise(18, 3), 0.4))
    if kind == "pores":
        return math_('ADD', math_('MULTIPLY', noise(900, 2), 0.5), math_('MULTIPLY', noise(60, 3), 0.5))
    if kind == "strands":
        return noise(260, 3, 0.6, mapping((1.0, 1.0, 0.06)))
    if kind == "scratch":
        return math_('ADD', math_('MULTIPLY', noise(500, 2, 0.5, mapping((1, 1, 0.08))), 0.5), math_('MULTIPLY', noise(40, 4), 0.5))
    if kind == "wood":
        return wave(90, 'Z', 6.0, mapping((1, 1, 0.15)))
    return noise(50, 1)

def bake_textures(ob, name, res=1024, ao=True):
    import numpy as np
    sc = bpy.context.scene
    me = ob.data
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True)
    if not me.uv_layers: me.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    try: bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
    except Exception as e: print("pack failed", e)
    bpy.ops.object.mode_set(mode='OBJECT')
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'CPU'
    try: sc.cycles.use_denoising = False
    except Exception: pass
    alb = bpy.data.images.new(f"{name}_albedo", res, res, alpha=False)
    nrm = bpy.data.images.new(f"{name}_normal", res, res, alpha=False); nrm.colorspace_settings.name = 'Non-Color'
    aoi = bpy.data.images.new(f"{name}_ao", res // 2, res // 2, alpha=False); aoi.colorspace_settings.name = 'Non-Color'
    info = {}
    for m in me.materials:
        key = m.name.split("_", 1)[1]
        kind, bstr, cvar = DETAIL.get(key, ("none", 0.0, 0.0))
        nt = m.node_tree; N = nt.nodes; L = nt.links.new
        out = next(n for n in N if n.type == 'OUTPUT_MATERIAL'); bsdf = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
        vc = next(n for n in N if n.type == 'VERTEX_COLOR')
        h = _detail_height(nt, kind)
        cf = N.new("ShaderNodeMath"); cf.operation = 'MULTIPLY_ADD'; L(h, cf.inputs[0]); cf.inputs[1].default_value = cvar; cf.inputs[2].default_value = 1 - cvar
        mixc = N.new("ShaderNodeMix"); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'; mixc.inputs[0].default_value = 1.0
        L(vc.outputs["Color"], mixc.inputs[6]); L(cf.outputs[0], mixc.inputs[7])
        emi = N.new("ShaderNodeEmission"); L(mixc.outputs[2], emi.inputs["Color"])
        bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = bstr; bump.inputs["Distance"].default_value = 0.002
        L(h, bump.inputs["Height"]); L(bump.outputs["Normal"], bsdf.inputs["Normal"])
        img = N.new("ShaderNodeTexImage"); N.active = img
        info[m.name] = (out, bsdf, emi, img)
    def run(kind, image, **kw):
        for mname, (out, bsdf, emi, img) in info.items():
            img.image = image
            m = bpy.data.materials[mname]; m.node_tree.nodes.active = img
            m.node_tree.links.new((emi if kind == 'EMIT' else bsdf).outputs[0], out.inputs["Surface"])
        bpy.ops.object.bake(type=kind, margin=6, use_clear=True, **kw)
    run('EMIT', alb)
    run('NORMAL', nrm, normal_space='TANGENT')
    if ao:
        sc.cycles.samples = 24
        run('AO', aoi)
        a = np.array(alb.pixels[:]).reshape(res, res, 4)
        o_ = np.array(aoi.pixels[:]).reshape(res // 2, res // 2, 4)[:, :, 0]
        o_ = np.repeat(np.repeat(o_, 2, axis=0), 2, axis=1)
        f = 0.55 + 0.45 * np.clip(o_, 0, 1)
        lin = np.where(a[:, :, :3] <= 0.04045, a[:, :, :3] / 12.92, ((a[:, :, :3] + 0.055) / 1.055) ** 2.4) * f[:, :, None]
        a[:, :, :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, 1), 1 / 2.4) - 0.055)
        alb.pixels[:] = a.ravel()
    alb.pack(); nrm.pack()
    bpy.data.images.remove(aoi)
    for m in me.materials:
        key = m.name.split("_", 1)[1]
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        r, mt, sp = MATS[key]
        b.inputs["Roughness"].default_value = r; b.inputs["Metallic"].default_value = mt
        try: b.inputs["Specular IOR Level"].default_value = sp
        except Exception: pass
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = alb
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.0
        nt.links.new(ti.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
        nt.links.new(b.outputs[0], out.inputs["Surface"])
    for ca in list(me.color_attributes): me.color_attributes.remove(ca)
    sc.render.engine = 'BLENDER_EEVEE'
