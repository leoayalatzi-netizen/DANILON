import { Scene, Mesh, MeshBuilder, TransformNode, PBRMaterial, StandardMaterial, Color3, ShadowGenerator } from "@babylonjs/core";
import { heightAt } from "../world/terrain";

export interface Actor { id: string; node: TransformNode; orb: Mesh; y0: number; s: number; phase: number; pulse: number; }
const pbr = (sc: Scene, c: Color3, r = .6, m = .1) => { const x = new PBRMaterial("m" + Math.random(), sc); x.albedoColor = c; x.roughness = r; x.metallic = m; return x; };
const glow = (sc: Scene, c: Color3) => { const x = new StandardMaterial("g" + Math.random(), sc); x.emissiveColor = c; x.disableLighting = true; return x; };
function put(p: TransformNode, m: Mesh, mat: any, x: number, y: number, z: number, rx = 0, rz = 0) {
  m.material = mat; m.parent = p; m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; return m;
}
const LOOK: Record<string, { cloak: Color3; trim: Color3 }> = {
  guardian: { cloak: new Color3(.16, .09, .09), trim: new Color3(1, .45, .12) },
  tejedor: { cloak: new Color3(.12, .2, .45), trim: new Color3(.55, .85, 1) },
  sombra: { cloak: new Color3(.07, .07, .1), trim: new Color3(.7, .3, 1) },
  vigia: { cloak: new Color3(.75, .7, .55), trim: new Color3(1, .9, .5) },
};
export function spawnParty(sc: Scene, sg: ShadowGenerator): Actor[] {
  return Object.keys(LOOK).map((id, i) => {
    const L = LOOK[id], node = new TransformNode(id, sc), cloak = pbr(sc, L.cloak, .7, .05), skin = pbr(sc, new Color3(.8, .65, .55), .8, 0);
    const metal = pbr(sc, new Color3(.55, .57, .62), .35, .9), gl = glow(sc, L.trim), B = MeshBuilder, parts: Mesh[] = [];
    const add = (m: Mesh, mat: any, x: number, y: number, z: number, rx = 0, rz = 0) => { parts.push(put(node, m, mat, x, y, z, rx, rz)); return m; };
    add(B.CreateCylinder("b", { height: 2.4, diameterTop: .7, diameterBottom: 1.6, tessellation: 10 }, sc), cloak, 0, 1.2, 0);
    add(B.CreateSphere("h", { diameter: .7, segments: 8 }, sc), skin, 0, 2.75, 0);
    let orb: Mesh;
    if (id === "guardian") {
      add(B.CreateSphere("p1", { diameter: .8, segments: 6 }, sc), metal, -.7, 2.2, 0); add(B.CreateSphere("p2", { diameter: .8, segments: 6 }, sc), metal, .7, 2.2, 0);
      add(B.CreateCylinder("sh", { height: .12, diameter: 1.5, tessellation: 12 }, sc), metal, -1.1, 1.4, .3, Math.PI / 2);
      add(B.CreateCylinder("sw", { height: 2.2, diameter: .12, tessellation: 5 }, sc), metal, 1.1, 1.6, .3);
      orb = add(B.CreateSphere("o", { diameter: .3, segments: 6 }, sc), gl, 1.1, 2.8, .3);
    } else if (id === "tejedor") {
      add(B.CreateCylinder("hat", { height: 1.5, diameterTop: 0, diameterBottom: 1.0, tessellation: 8 }, sc), cloak, 0, 3.5, 0);
      add(B.CreateCylinder("br", { height: .06, diameter: 1.4, tessellation: 12 }, sc), cloak, 0, 3.0, 0);
      add(B.CreateCylinder("st", { height: 3.4, diameter: .1, tessellation: 5 }, sc), metal, 1, 1.7, .2);
      orb = add(B.CreateSphere("o", { diameter: .5, segments: 8 }, sc), gl, 1, 3.5, .2);
    } else if (id === "sombra") {
      add(B.CreateCylinder("hd", { height: 1, diameterTop: 0, diameterBottom: .95, tessellation: 8 }, sc), cloak, 0, 3.1, 0);
      add(B.CreateCylinder("d1", { height: 1, diameter: .09, tessellation: 4 }, sc), metal, -.9, 1.2, .3, 0, .4);
      add(B.CreateCylinder("d2", { height: 1, diameter: .09, tessellation: 4 }, sc), metal, .9, 1.2, .3, 0, -.4);
      orb = add(B.CreateSphere("o", { diameter: .25, segments: 6 }, sc), gl, 0, 1.9, .55);
    } else {
      add(B.CreateTorus("halo", { diameter: 1.1, thickness: .07, tessellation: 20 }, sc), gl, 0, 3.4, 0);
      add(B.CreateCylinder("st", { height: 3.4, diameter: .1, tessellation: 5 }, sc), metal, 1, 1.7, .2);
      orb = add(B.CreateSphere("o", { diameter: .45, segments: 8 }, sc), gl, 1, 3.5, .2);
    }
    parts.forEach(m => sg.addShadowCaster(m));
    const x = (i - 1.5) * 7, z = -22 + Math.abs(i - 1.5) * 2.5, s = 2.2, y0 = heightAt(x, z);
    node.position.set(x, y0, z); node.scaling.setAll(s);
    return { id, node, orb, y0, s, phase: i * 1.7, pulse: 0 };
  });
}
export function spawnBoss(sc: Scene, sg: ShadowGenerator): Actor {
  const node = new TransformNode("wyrm", sc), B = MeshBuilder, parts: Mesh[] = [];
  const ice = pbr(sc, new Color3(.55, .75, .95), .35, .2); ice.emissiveColor = new Color3(.04, .1, .18);
  const eye = glow(sc, new Color3(.5, .95, 1));
  const add = (m: Mesh, mat: any, x: number, y: number, z: number, rx = 0, rz = 0) => { parts.push(put(node, m, mat, x, y, z, rx, rz)); return m; };
  add(B.CreateIcoSphere("body", { radius: 1.6, subdivisions: 2, flat: true }, sc), ice, 0, 2.2, 0).scaling.set(1, .8, 1.7);
  add(B.CreateCylinder("neck", { height: 2.6, diameterTop: .6, diameterBottom: 1.1, tessellation: 7 }, sc), ice, 0, 3.4, 2, -.7);
  add(B.CreateIcoSphere("head", { radius: .8, subdivisions: 1, flat: true }, sc), ice, 0, 4.6, 3.1).scaling.set(.9, .8, 1.3);
  add(B.CreateCylinder("hn1", { height: 1.4, diameterTop: 0, diameterBottom: .3, tessellation: 5 }, sc), ice, -.45, 5.3, 2.8, -.5);
  add(B.CreateCylinder("hn2", { height: 1.4, diameterTop: 0, diameterBottom: .3, tessellation: 5 }, sc), ice, .45, 5.3, 2.8, -.5);
  for (const sx of [-1, 1]) add(B.CreateDisc("wing", { radius: 3.4, tessellation: 3 }, sc), ice, sx * 2.6, 3.4, -.2, Math.PI / 2.4, sx * -.5).scaling.set(1.2, 1, 1);
  add(B.CreateSphere("e1", { diameter: .22, segments: 6 }, sc), eye, -.35, 4.8, 3.8); add(B.CreateSphere("e2", { diameter: .22, segments: 6 }, sc), eye, .35, 4.8, 3.8);
  const orb = add(B.CreateSphere("breath", { diameter: .5, segments: 8 }, sc), eye, 0, 4.3, 4.0);
  parts.forEach(m => { m.material && ((m.material as any).backFaceCulling = false); sg.addShadowCaster(m); });
  const s = 3.2, y0 = heightAt(0, 62); node.position.set(0, y0, 62); node.rotation.y = Math.PI; node.scaling.setAll(s);
  return { id: "wyrm", node, orb, y0, s, phase: 0, pulse: 0 };
}
export function animate(list: Actor[], t: number, dt: number) {
  for (const a of list) {
    a.node.position.y = a.y0 + Math.sin(t * 1.6 + a.phase) * .08 * a.s;
    a.node.scaling.setAll(a.s * (1 + .2 * a.pulse));
    a.orb.scaling.setAll(1 + .15 * Math.sin(t * 3 + a.phase) + a.pulse * .9);
    a.pulse = Math.max(0, a.pulse - dt * 2.5);
  }
}
