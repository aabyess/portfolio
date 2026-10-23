import bpy
from mathutils import Vector

def setup_scene(res=(1800, 700), world=(0.55, 0.62, 0.70)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
    try: sc.eevee.taa_render_samples = 32
    except Exception: pass
    try: sc.view_settings.view_transform = 'Standard'
    except Exception: pass
    sc.world = bpy.data.worlds.new("W")
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (*world, 1); bg.inputs[1].default_value = 0.8
    bpy.ops.mesh.primitive_plane_add(size=60)
    fl = bpy.context.object
    m = bpy.data.materials.new("floor")
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.32, 0.40, 0.22, 1); b.inputs["Roughness"].default_value = 0.95
    fl.data.materials.append(m)
    sd = bpy.data.lights.new("Sun", 'SUN'); sd.energy = 3.2; sd.angle = 0.15
    so = bpy.data.objects.new("Sun", sd); sc.collection.objects.link(so)
    so.rotation_euler = (0.85, 0.15, -0.6)
    return sc

def cam(sc, loc, target, lens=50, ortho=None):
    cd = bpy.data.cameras.new("C"); cd.lens = lens
    if ortho: cd.type = 'ORTHO'; cd.ortho_scale = ortho
    c = bpy.data.objects.new("C", cd); sc.collection.objects.link(c)
    c.location = loc
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = c
    return c

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)
