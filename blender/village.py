"""Kitbash de la aldea nevada con piezas Kenney (CC0): casas modulares, plaza, molino, farolas y ventanas con luz.
Todo se fusiona en un solo mesh (pocas llamadas de dibujo) y el rotor del molino se exporta aparte para animarlo en el motor."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CACHE = {}; KEN = {'mat': None}
OUTBM = None
SLOTS = {}

def load_piece(name):
    if name in CACHE: return CACHE[name]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=KENNEY + name + '.glb')
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = []
    for o in new:
        if o.type == 'MESH':
            if KEN['mat'] is None and o.data.materials: KEN['mat'] = o.data.materials[0]
            bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.transform(bm, matrix=o.matrix_world, verts=bm.verts)
            tmp = bpy.data.meshes.new('cache_' + name); bm.to_mesh(tmp); bm.free(); meshes.append(tmp)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    CACHE[name] = meshes
    return meshes

def commit(bm):
    t = bpy.data.meshes.new('t'); bm.to_mesh(t); bm.free(); OUTBM.from_mesh(t); bpy.data.meshes.remove(t)

def add_snow(bm, s, thr=0.28, lift=0.05):
    bm.normal_update()
    for f in list(bm.faces):
        if f.normal.z > thr:
            vs = [bm.verts.new(v.co + f.normal * (lift * s) + Vector((0, 0, .03 * s))) for v in f.verts]
            nf = bm.faces.new(vs); nf.material_index = SLOTS['snow']

def add(name, loc=(0, 0, 0), rot=0.0, s=1.0, snow=False):
    loc = tuple(loc) + (0.0,) * (3 - len(loc))
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Scale(s, 4)
    for tmp in load_piece(name):
        bm = bmesh.new(); bm.from_mesh(tmp); bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        for f in bm.faces: f.material_index = 0
        if snow: add_snow(bm, s)
        commit(bm)

def solid(kind, matrix, slot, **kw):
    bm = bmesh.new()
    if kind == 'cube': bmesh.ops.create_cube(bm, size=1.0, matrix=matrix)
    elif kind == 'cone': bmesh.ops.create_cone(bm, cap_ends=True, **kw, matrix=matrix)
    elif kind == 'ico': bmesh.ops.create_icosphere(bm, **kw, matrix=matrix)
    for f in bm.faces: f.material_index = slot
    if kind == 'cone' and slot == SLOTS['roofm']:
        bm.normal_update()
        for f in list(bm.faces):
            if f.normal.z > .5 and (noise.noise(f.calc_center_median() * .9) * .5 + .5) > .4: f.material_index = SLOTS['snow']
    commit(bm)

def glow_quad(center, n, w, z0, z1, slot):
    n = Vector(n).normalized(); t = n.cross(Vector((0, 0, 1))).normalized()
    bm = bmesh.new()
    vs = [bm.verts.new(center + t * w * sx + Vector((0, 0, z))) for (sx, z) in ((-1, z0), (1, z0), (1, z1), (-1, z1))]
    f = bm.faces.new(vs)
    if f.normal.dot(n) < 0: f.normal_flip()
    f.material_index = slot; commit(bm)

def house(layout, center, rot, S=5.0):
    W, D = layout['W'], layout['D']; cx, cy = center
    Rz = Matrix.Rotation(rot, 4, 'Z')
    def world(lx, ly, lz=0.0):
        v = Rz @ Vector((lx * S, ly * S, lz * S)); return Vector((cx + v.x, cy + v.y, v.z))
    sides = {'S': (-math.pi / 2, [(i, 0) for i in range(W)], (0, -1)), 'N': (math.pi / 2, [(i, D - 1) for i in range(W)], (0, 1)),
             'E': (0.0, [(W - 1, j) for j in range(D)], (1, 0)), 'W': (math.pi, [(0, j) for j in range(D)], (-1, 0))}
    for key, (ang, cells, nrm) in sides.items():
        for k, (i, j) in enumerate(cells):
            nm = layout['edges'][key][k]; lx, ly = i + .5 - W / 2, j + .5 - D / 2
            add(nm, world(lx, ly), rot + ang, S)
            if 'window' in nm or 'door' in nm:
                o = Rz @ Vector((nrm[0], nrm[1], 0)); c = world(lx, ly) + o * (0.25 * S)
                glow_quad(c, o, .42 * S, .08 * S, .82 * S, SLOTS['win'])
    for i in range(W):
        for j in range(D):
            add(layout.get('roof', 'roof-high'), world(i + .5 - W / 2, j + .5 - D / 2, 1.0), rot + math.pi / 2, S, snow=True)
    if layout.get('chimney'):
        ci, cj = layout['chimney']; add('chimney', world(ci + .5 - W / 2 - .12, cj + .5 - D / 2, 1.38), rot, S)
    solid('cube', Matrix.Translation(world(0, 0, -.02)) @ Rz @ Matrix.Diagonal((W * S + .6, D * S + .6, .2 * S, 1)), SLOTS['stone'])

def lantern(x, y, s=3.0):
    add('lantern', (x, y, 0), 0, s)
    solid('ico', Matrix.Translation((x, y, 1.36 * s)), SLOTS['lamp'], subdivisions=1, radius=.15 * s)

def windmill(x, y):
    H = 15.0
    solid('cone', Matrix.Translation((x, y, H / 2)), SLOTS['tower'], segments=10, radius1=3.6, radius2=2.5, depth=H)
    solid('cone', Matrix.Translation((x, y, H + 2.2)), SLOTS['roofm'], segments=10, radius1=3.5, radius2=0.1, depth=4.4)
    solid('cube', Matrix.Translation((x, y - 3.1, 1.6)) @ Matrix.Diagonal((1.9, .5, 3.2, 1)), SLOTS['stone'])
    solid('cone', Matrix.Translation((x, y - 3.0, 15.5)) @ Matrix.Rotation(math.pi / 2, 4, 'X') , SLOTS['stone'], segments=8, radius1=.35, radius2=.35, depth=2.2)
    glow_quad(Vector((x, y - 2.6, 8.5)), (0, -1, 0), 0.4, -0.6, 1.0, SLOTS['win'])
    return Vector((x, y - 3.9, 15.5))

if __name__ == '__main__':
    reset()
    OUTBM = bmesh.new()
    load_piece('road')   # captura el material de paleta Kenney
    mats = [KEN['mat'], M_snow(), M_stone(), mat('VentanaBrillo', (1.0, .72, .35), .5, 0, (1.0, .62, .22), 4.0),
            mat('FarolBrillo', (1.0, .8, .45), .5, 0, (1.0, .7, .3), 6.0), mat('TorrePiedra', (.62, .63, .7), .9), mat('TejadoMolino', (.42, .13, .1), .85)]
    SLOTS.update(snow=1, stone=2, win=3, lamp=4, tower=5, roofm=6)
    S = 5.0; rnd = random.Random(4)
    # plaza 3x3 + camino hacia el sur
    for ix in (-1, 0, 1):
        for iy in (-1, 0, 1): add('road', (ix * S, iy * S, 0), 0, S)
    for k in range(2, 5): add('road', (0, -k * S, 0), 0, S)
    add('fountain-round-detail', (0, 0, .1), 0, 2.6)
    L = lambda **kw: dict(W=kw['W'], D=kw['D'], edges=kw['edges'], chimney=kw.get('chimney'), roof=kw.get('roof', 'roof-high'))
    A = L(W=2, D=1, edges={'S': ['wall-door', 'wall-window-round'], 'N': ['wall-window-round', 'wall'], 'E': ['wall-window-shutters'], 'W': ['wall']}, chimney=(1, 0))
    B = L(W=3, D=1, edges={'S': ['wall-window-shutters', 'wall-door', 'wall-window-round'], 'N': ['wall', 'wall-window-round', 'wall'], 'E': ['wall'], 'W': ['wall-window-round']}, chimney=(0, 0))
    C = L(W=1, D=1, edges={'S': ['wall-door'], 'N': ['wall'], 'E': ['wall-window-round'], 'W': ['wall-window-shutters']})
    Wd = L(W=2, D=1, edges={'S': ['wall-wood-door', 'wall-wood-window-shutters'], 'N': ['wall-wood', 'wall-wood-window-round'], 'E': ['wall-wood'], 'W': ['wall-wood-window-round']}, chimney=(0, 0))
    house(A, (-22, 9), math.radians(18), S)         # noroeste
    house(B, (23, 10), math.radians(-14), S)        # noreste
    house(C, (-23, -9), math.radians(90), S)         # oeste, mira al este
    house(Wd, (24, -8), math.radians(-90), S)        # este, mira al oeste
    hub = windmill(0, 29)
    for (x, y) in [(-9, -9), (9, -9), (-9, 9), (9, 9), (-4.5, -26), (4.5, -26), (-14, 1), (14, 1)]: lantern(x, y)
    add('cart', (13, -15), math.radians(25), 3.0); add('stall-red', (-12, -14), math.radians(-30), 3.2)
    for k in range(6): add('fence', (-34 + k * 4, 20.5), math.radians(0) + math.pi / 2, 4.0)
    for k in range(5): add('fence', (22 + k * 4, 22), math.pi / 2, 4.0)
    add('rock-small', (-16, -22), .6, 3.5, snow=True); add('rock-small', (17, -24), 2.1, 2.8, snow=True)
    village = new_object('village', OUTBM, mats)
    print('VILLAGE tris', sum(len(p.vertices) - 2 for p in village.data.polygons), 'hub', tuple(hub))
    # rotor del molino (eje Y, sentido -Y), centrado en el origen
    bl = load_piece('windmill'); bm = bmesh.new()
    for t in bl: bm.from_mesh(t)
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Scale(5.4, 4), verts=bm.verts)
    blades = new_object('windmill_blades', bm, [KEN['mat']])
    if '--preview' in sys.argv:
        blades.location = hub; ground(400, (.88, .92, 1.0)); setup_render(1300, 700, 14, (.55, .65, .9), 4.0)
        camera((-12, -52, 20), (0, 6, 7), lens=34); render('/tmp/prev/village_c.png')
    else:
        blades.location = (0, 0, 0)
        export([village], 'village.glb'); export([blades], 'windmill_blades.glb')
        open(os.path.join(OUT, 'village_meta.json'), 'w').write('{"hub":[%.3f,%.3f,%.3f]}' % tuple(hub))
