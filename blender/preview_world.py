"""Render de composición del mundo con los GLB reales y el mismo layout que el motor (terreno plano). Sirve para verificar escalas."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
M = OUT + os.sep
def imp(name):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=M + name)
    new = [o for o in bpy.data.objects if o not in before]; return [o for o in new if o.type == 'MESH'][0], new
def put(name, pos, yaw=0.0, scale=(1, 1, 1), link=None):
    if link is None:
        ob, _ = imp(name)
        if ob.parent: ob.parent = None
        for o in list(bpy.data.objects):
            if o.type == 'EMPTY' and not o.children: bpy.data.objects.remove(o)
    else:
        ob = bpy.data.objects.new(name, link.data); bpy.context.collection.objects.link(ob)
    ob.location = pos; ob.rotation_euler = (0, 0, yaw); ob.scale = scale; return ob
reset(); setup_render(1280, 720, 22, (.12, .14, .30), 2.2)
ground(900, (.8, .86, .98))
village = put('village.glb', (0, 0, 0)); blades = put('windmill_blades.glb', (0, 25.1, 15.5), 0); put('rune_circle.glb', (22, 88, 0)); put('dragon_ruin.glb', (-50, -45, 0), -.9)
protos = {k: put(k + '.glb', (0, 0, -50)) for k in ['pine_a', 'pine_b', 'pine_c', 'boulder_a', 'boulder_b', 'crystals_a', 'crystals_b']}
rnd = random.Random(5)
def ok(x, y):
    return min(math.hypot(x - a, y - b) - r for a, b, r in [(0, 0, 52), (22, 88, 20), (-50, -45, 28)]) > 0
n = 0
while n < 170:
    x, y = rnd.uniform(-170, 170), rnd.uniform(-130, 170)
    if not ok(x, y) or abs(x) < 20 and -25 < y < 0: continue
    k = rnd.choice(['pine_a', 'pine_b', 'pine_c']); s = rnd.uniform(.75, 1.6); put(k, (x, y, -.15), rnd.uniform(0, 6.28), (s, s, s * rnd.uniform(1, 1.35)), protos[k]); n += 1
for _ in range(40):
    x, y = rnd.uniform(-150, 150), rnd.uniform(-120, 160)
    if ok(x, y): s = rnd.uniform(.8, 2.1); put(rnd.choice(['boulder_a', 'boulder_b']), (x, y, -.2), rnd.uniform(0, 6.28), (s, s, s), protos['boulder_a' if rnd.random() < .5 else 'boulder_b'])
for _ in range(14):
    x, y = rnd.uniform(-60, 60), rnd.uniform(-70, 140)
    if ok(x, y): s = rnd.uniform(1, 2.2); k = rnd.choice(['crystals_a', 'crystals_b']); put(k, (x, y, -.2), rnd.uniform(0, 6.28), (s, s, s), protos[k])
for k in ['boulder_a', 'boulder_b']: protos[k].location = (0, 0, -50)
bpy.context.scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
cam = bpy.data.cameras.new('c'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = .95; co = bpy.data.objects.new('c', cam); bpy.context.collection.objects.link(co)
co.location = (0, -83.4, 30.5); co.rotation_euler = (Vector((0, 0, 14)) - co.location).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = co
render(sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/prev/world_layout.png')
