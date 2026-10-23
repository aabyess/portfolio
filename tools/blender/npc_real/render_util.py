import bpy, math
from mathutils import Vector

def setup_scene(res=(1600, 800), floor=True, world=(0.10, 0.09, 0.085)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    try: sc.eevee.taa_render_samples = 32
    except Exception: pass
    try: sc.view_settings.view_transform = 'Standard'
    except Exception: pass
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (*world, 1); bg.inputs[1].default_value = 1.0
    if floor:
        bpy.ops.mesh.primitive_plane_add(size=40)
        fl = bpy.context.object
        m = bpy.data.materials.new("floor")
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (0.22, 0.19, 0.16, 1); b.inputs["Roughness"].default_value = 0.95
        fl.data.materials.append(m)
    def area(name, loc, target, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
        o = bpy.data.objects.new(name, ld); sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o
    area("Key", (4.0, -6.0, 5.0), (0, 0, 1.0), 1100, 4.0, (1.0, 0.93, 0.84))
    area("Fill", (-6.0, -4.0, 2.5), (0, 0, 1.0), 380, 6.0, (0.80, 0.86, 1.0))
    area("Rim", (-1.5, 6.0, 4.0), (0, 0, 1.2), 800, 3.0, (1.0, 0.9, 0.8))
    return sc

def cam(sc, loc, target, lens=40):
    cd = bpy.data.cameras.new("C"); cd.lens = lens
    c = bpy.data.objects.new("C", cd); sc.collection.objects.link(c)
    c.location = loc
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = c
    return c

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)

def fix_imported_vcol():
    """Mimic three.js: COLOR_0 multiplies base colour. Wire a Color Attribute node if the importer did not."""
    for m in bpy.data.materials:
        if not m.node_tree: continue
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not b: continue
        if any(n.type == 'VERTEX_COLOR' for n in m.node_tree.nodes) and b.inputs["Base Color"].is_linked: continue
        c = m.node_tree.nodes.new("ShaderNodeVertexColor"); c.layer_name = "Color"
        if b.inputs["Base Color"].is_linked:
            continue
        mixn = m.node_tree.nodes.new("ShaderNodeMix"); mixn.data_type = 'RGBA'; mixn.blend_type = 'MULTIPLY'
        mixn.inputs[0].default_value = 1.0
        mixn.inputs[6].default_value = b.inputs["Base Color"].default_value
        m.node_tree.links.new(c.outputs["Color"], mixn.inputs[7])
        m.node_tree.links.new(mixn.outputs[2], b.inputs["Base Color"])
