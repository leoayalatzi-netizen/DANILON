"""Utilidades compartidas de los scripts de Blender de PriomGL Quantum (Blender 5.x, modo -b)."""
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, noise

OUT = os.environ.get('PRIOM_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models'))
KENNEY = os.environ.get('KENNEY', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'kenney', 'fantasy-town')) + os.sep

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, color, rough=.6, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def new_object(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    for p in me.polygons: p.use_smooth = False
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return ob

def export(objs, filename):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False)
    print('EXPORT', filename, os.path.getsize(path) // 1024, 'KB')

def setup_render(w=900, h=600, samples=24, sky=(0.5, 0.6, 0.85), sun_energy=4.0):
    s = bpy.context.scene; s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'; s.cycles.samples = samples; s.cycles.use_denoising = False
    s.render.resolution_x = w; s.render.resolution_y = h; s.render.resolution_percentage = 100
    wd = bpy.data.worlds.new('w'); s.world = wd; wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']; bg.inputs[0].default_value = (*sky, 1); bg.inputs[1].default_value = 1.0
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = sun_energy
    so = bpy.data.objects.new('sun', sun); bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), 0, math.radians(30))

def camera(loc, target, lens=35):
    cam = bpy.data.cameras.new('c'); cam.lens = lens
    co = bpy.data.objects.new('c', cam); bpy.context.collection.objects.link(co)
    co.location = loc
    co.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = co

def render(path):
    bpy.context.scene.render.filepath = path; bpy.ops.render.render(write_still=True)

def ground(size=200, color=(0.85, 0.9, 1.0)):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, -0.02))
    g = bpy.context.active_object; g.data.materials.append(mat('PreviewGround', color, .8))
    return g

# materiales compartidos (mismos nombres en todos los GLB)
def M_snow():    return mat('Nieve',  (0.93, 0.96, 1.0), .55)
def M_needle():  return mat('Aguja',  (0.035, 0.12, 0.13), .85)
def M_bark():    return mat('Corteza',(0.12, 0.075, 0.05), .9)
def M_rock():    return mat('Roca',   (0.16, 0.17, 0.2), .92)
def M_bone():    return mat('Hueso',  (0.60, 0.55, 0.46), .75)
def M_crystal(): return mat('Cristal',(0.35, 0.75, 1.0), .12, 0.0, (0.2, 0.55, 1.0), 1.3)
def M_rune():    return mat('RunaBrillo', (0.3, 0.9, 1.0), .4, 0.0, (0.3, 0.9, 1.0), 3.0)
def M_stone():   return mat('Piedra', (0.34, 0.36, 0.4), .9)

def snow_by_normal(me, thr=0.5, noise_scale=1.3, bias=0.0, slot=1, z_ref=1.0):
    """Asigna el material de nieve a caras que miran hacia arriba, con ruido para que sea irregular."""
    for p in me.polygons:
        c = p.center
        n = noise.noise(c * noise_scale) * 0.5 + 0.5
        if p.normal.z > thr and (n + bias + (c.z / z_ref) * 0.15) > 0.5:
            p.material_index = slot
