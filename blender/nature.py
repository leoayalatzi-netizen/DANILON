"""Genera la flora y la geología originales: pinos nevados, rocas, cristales, círculo rúnico y ruina de dragón."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def make_pine(name, seed, tiers=6, h=9.0, r0=2.6, lean=0.0):
    rnd = random.Random(seed); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=7, radius1=.34, radius2=.2, depth=2.4, matrix=Matrix.Translation((0, 0, 1.2)))
    for f in bm.faces: f.material_index = 2
    span = h - 2.2
    for i in range(tiers):
        t = i / max(1, tiers - 1)
        ri = r0 * (1.0 - t) ** 0.85 + 0.45
        z0 = 1.5 + span * (i / tiers) * 0.92
        ht = span / tiers * 1.9 + 0.5
        seg = 9 + (i % 2)
        n0 = len(bm.faces)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=ri, radius2=0.03, depth=ht,
                              matrix=Matrix.Translation((0, 0, z0 + ht / 2)))
        for v in bm.verts:
            if v.co.z < z0 + ht * 0.2 and v.co.z > z0 - .01 and (v.co.xy.length > ri * .6):
                a = rnd.random()
                v.co.x *= 0.72 + a * .5; v.co.y *= 0.72 + a * .5; v.co.z -= (0.15 + a * .55) * (ht / 3.0)
        for f in list(bm.faces)[n0:]: f.material_index = 0
    bm.normal_update()
    if lean:
        for v in bm.verts: v.co.x += lean * (v.co.z / h) ** 2
    ob = new_object(name, bm, [M_needle(), M_snow(), M_bark()])
    me = ob.data
    for p in me.polygons:
        if p.material_index == 2: continue
        c = p.center; n = noise.noise(c * 1.1 + Vector((seed, 0, 0))) * 0.5 + 0.5
        p.material_index = 1 if (p.normal.z > 0.42 and n + (c.z / h) * 0.28 > 0.52) else 0
    return ob

def make_boulder(name, seed, sx=1.0, sy=1.0, sz=0.72, size=1.8):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    off = Vector((seed * 3.7, seed * 1.3, seed * 5.1))
    for v in bm.verts:
        p = v.co.copy(); n = noise.fractal(p * 1.3 + off, 1.0, 2.0, 4)
        v.co = p * (1.0 + 0.42 * n) ; v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
        v.co.z = max(v.co.z, -0.3 * sz); v.co *= size
    bmesh.ops.scale(bm, vec=(1, 1, 1), verts=bm.verts)
    ob = new_object(name, bm, [M_rock(), M_snow()])
    snow_by_normal(ob.data, thr=0.38, noise_scale=0.8, bias=0.15, z_ref=size)
    return ob

def make_crystals(name, seed, count=7, spread=1.6):
    rnd = random.Random(seed); bm = bmesh.new()
    for k in range(count):
        r = rnd.uniform(.28, .62) * (1.3 if k == 0 else 1.0); L = rnd.uniform(1.6, 4.4) * (1.35 if k == 0 else 1.0)
        ang = 0 if k == 0 else rnd.uniform(0, 6.283); dist = 0 if k == 0 else rnd.uniform(.4, spread)
        tilt = 0 if k == 0 else rnd.uniform(.12, .55); yaw = rnd.uniform(0, 6.283)
        base = Matrix.Translation((math.cos(ang) * dist, math.sin(ang) * dist, -0.1)) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'X')
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r * .86, depth=L, matrix=base @ Matrix.Translation((0, 0, L / 2)))
        t = bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=r * .86, radius2=0.0, depth=r * 1.7, matrix=base @ Matrix.Translation((0, 0, L + r * .85)))
    return new_object(name, bm, [M_crystal()])

def glyph(bm, center, normal_dir, up=Vector((0, 0, 1)), seed=0, scale=1.0, mat_index=1):
    """Runa geométrica hecha con trazos (cubos finos) mirando hacia normal_dir."""
    rnd = random.Random(seed); n = normal_dir.normalized(); t = n.cross(up).normalized(); u = t.cross(n).normalized()
    strokes = [((0, -.5), (0, .5))]
    for _ in range(rnd.randint(2, 3)):
        y0 = rnd.uniform(-.4, .3); strokes.append(((0, y0), (rnd.choice([-1, 1]) * rnd.uniform(.25, .45), y0 + rnd.uniform(.15, .4))))
    if rnd.random() < .6: strokes.append(((-.3, rnd.uniform(-.1, .2)), (.3, rnd.uniform(-.1, .2))))
    for (a, b) in strokes:
        pa = center + t * a[0] * scale + u * a[1] * scale; pb = center + t * b[0] * scale + u * b[1] * scale
        d = pb - pa; ln = d.length
        if ln < 1e-4: continue
        x_ax = d.normalized(); z_ax = n; y_ax = z_ax.cross(x_ax).normalized()
        R = Matrix(((x_ax.x, y_ax.x, z_ax.x), (x_ax.y, y_ax.y, z_ax.y), (x_ax.z, y_ax.z, z_ax.z))).to_4x4()
        r = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((pa + pb) / 2) @ R @ Matrix.Diagonal((ln, .09 * scale, .05 * scale, 1)))
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = mat_index

def make_rune_circle(name, seed=7, stones=7, radius=10.0):
    rnd = random.Random(seed); bm = bmesh.new()
    for i in range(stones):
        a = i / stones * math.tau + rnd.uniform(-.08, .08); h = rnd.uniform(4.6, 7.2); w = rnd.uniform(1.0, 1.5)
        pos = Vector((math.cos(a) * radius, math.sin(a) * radius, 0)); tilt = rnd.uniform(-.07, .07)
        M = Matrix.Translation(pos) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y')
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=w, radius2=w * .68, depth=h, matrix=M @ Matrix.Translation((0, 0, h / 2 - .4)))
        for v in r['verts']:
            if v.co.z > (pos.z + h - .6):
                v.co.z += rnd.uniform(-.55, .35)
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 0
        inward = -pos.normalized()
        glyph(bm, pos + inward * (w * .78) + Vector((0, 0, h * .45)), inward, seed=seed + i, scale=1.15, mat_index=1)
    # altar central y anillo luminoso en el suelo
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=2.5, radius2=2.2, depth=.55, matrix=Matrix.Translation((0, 0, .1)))
    r2 = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.5, radius2=1.4, depth=.5, matrix=Matrix.Translation((0, 0, .6)))
    ring = bmesh.ops.create_circle(bm, cap_ends=False, segments=64, radius=radius * .72)
    bm.faces.ensure_lookup_table()
    for f in bm.faces: f.material_index = f.material_index if f.material_index in (0, 1) else 0
    # anillo: cinta plana fina (dos círculos)
    inner = bmesh.ops.create_circle(bm, cap_ends=False, segments=64, radius=radius * .72 - .12, matrix=Matrix.Translation((0, 0, .06)))
    outer = bmesh.ops.create_circle(bm, cap_ends=False, segments=64, radius=radius * .72 + .12, matrix=Matrix.Translation((0, 0, .06)))
    for v in ring['verts']: bm.verts.remove(v)
    ev = outer['verts'] + inner['verts']
    edges = list({e for v in ev for e in v.link_edges})
    res = bmesh.ops.bridge_loops(bm, edges=edges)
    for f in res['faces']: f.material_index = 1
    ob = new_object(name, bm, [M_rock(), M_rune()])
    me = ob.data
    for p in me.polygons:
        if p.material_index == 0 and p.normal.z > .55 and p.center.z > 3.0 and (noise.noise(p.center * 1.2) * .5 + .5) > .45: pass
    return ob

def tube(bm, pts, radii, sides=8):
    """Tubo de radio variable a lo largo de una polilínea (para costillas)."""
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.cross(Vector((0, 0, 1)))
        if a.length < .01: a = t.cross(Vector((1, 0, 0)))
        a.normalize(); b = t.cross(a).normalized()
        rings.append([bm.verts.new(p + (a * math.cos(k / sides * math.tau) + b * math.sin(k / sides * math.tau)) * radii[i]) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])

def make_dragon_ruin(name, seed=11):
    """Costillar y cráneo de un dragón colosal semienterrado en la nieve (decorado, sin animación)."""
    rnd = random.Random(seed); bm = bmesh.new()
    n_vert = 13; Hs = 5.2
    for i in range(n_vert):
        y = -9.0 + i * 1.5; z = Hs + math.sin(i / n_vert * math.pi) * .5
        r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=.62 * (1.0 - .35 * abs(i - n_vert / 2) / n_vert), matrix=Matrix.Translation((0, y, z)) @ Matrix.Diagonal((1.1, 1.0, .9, 1)))
    for i in range(1, n_vert - 1):
        y = -9.0 + i * 1.5; sc = 0.55 + 0.45 * math.sin(i / n_vert * math.pi)
        for side in (-1, 1):
            Rx = (3.2 + 2.6 * sc) * (0.9 + rnd.uniform(0, .2)); Rz = Hs * 0.96
            phi_max = 1.45 if (rnd.random() > .3) else rnd.uniform(.7, 1.0)   # algunas costillas rotas
            pts = []; rad = []
            steps = 14
            for s in range(steps + 1):
                ph = phi_max * s / steps
                pts.append(Vector((side * Rx * math.sin(ph) * 1.0, y + math.sin(ph) * .5 * (1 if side > 0 else -1) * 0, (Hs - .2) - Rz * (1 - math.cos(ph)))))
                rad.append(.34 * (1.0 - .72 * s / steps) * (0.8 + .2 * sc))
            tube(bm, pts, rad, 7)
    for f in bm.faces: f.material_index = 0
    # cráneo
    hx = Matrix.Translation((0, 12.8, 3.1)) @ Matrix.Diagonal((1.7, 1.7, 1.7, 1))
    for (cx, cy, cz, sx, sy, sz) in [(0, 0, .8, 1.5, 2.4, 1.1), (0, 2.6, .35, .95, 1.8, .6), (0, 1.6, -.25, 1.05, 2.1, .38)]:
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=hx @ Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((sx, sy, sz, 1)))
    for side in (-1, 1):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=.45, radius2=0.0, depth=3.4,
                              matrix=hx @ Matrix.Translation((side * 1.3, -1.1, 1.5)) @ Matrix.Rotation(side * -.6, 4, 'Y') @ Matrix.Rotation(-1.0, 4, 'X') @ Matrix.Translation((0, 0, 1.7)))
    for k in range(9):
        for side in (-1, 1):
            bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=.13, radius2=0.0, depth=.55,
                                  matrix=hx @ Matrix.Translation((side * .72, .9 + k * .28, -.55)) @ Matrix.Rotation(math.pi, 4, 'X'))
    bm.normal_update()
    ob = new_object(name, bm, [M_bone(), M_snow()])
    snow_by_normal(ob.data, thr=.5, noise_scale=.7, bias=.1, z_ref=6.0)
    return ob

if __name__ == '__main__':
    reset()
    objs = {}
    for nm, sd, tiers, h, r0, lean in [('pine_a', 3, 6, 9.0, 2.7, 0.0), ('pine_b', 8, 4, 6.4, 2.5, .5), ('pine_c', 14, 8, 12.5, 2.0, -.4)]:
        objs[nm] = make_pine(nm, sd, tiers, h, r0, lean)
    for nm, sd, sx, sy, sz, sc in [('boulder_a', 1, 1.0, 1.0, .75, 2.0), ('boulder_b', 5, 1.4, .9, .6, 1.7), ('boulder_c', 9, .8, .8, 1.15, 2.2)]:
        objs[nm] = make_boulder(nm, sd, sx, sy, sz, sc)
    objs['crystals_a'] = make_crystals('crystals_a', 21, 7, 1.5); objs['crystals_b'] = make_crystals('crystals_b', 34, 5, 1.1)
    objs['rune_circle'] = make_rune_circle('rune_circle')
    objs['dragon_ruin'] = make_dragon_ruin('dragon_ruin')
    if '--preview' in sys.argv:
        # lineup de verificación
        pos = {'pine_a': (-14, 0), 'pine_b': (-7, 0), 'pine_c': (0, 0), 'boulder_a': (6, 0), 'boulder_b': (10, 0), 'boulder_c': (14, 0),
               'crystals_a': (19, 0), 'crystals_b': (23, 0)}
        for k, (x, y) in pos.items(): objs[k].location = (x, y, 0)
        objs['rune_circle'].location = (-8, 28, 0); objs['dragon_ruin'].location = (22, 32, 0)
        ground(300); setup_render(1600, 800, 20, (0.6, 0.7, 0.9), 4)
        camera((4, -40, 24), (4, 14, 3), lens=34); render('/tmp/prev/nature_preview.png')
    else:
        for k, o in objs.items(): export([o], k + '.glb')
