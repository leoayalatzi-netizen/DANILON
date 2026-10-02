import { Scene, MeshBuilder, VertexBuffer, VertexData, PBRMaterial, Color3, Matrix, Vector3, Quaternion, Mesh } from "@babylonjs/core";
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function ridged(x: number, y: number) {
  let a = 1, f = 1, s = 0, w = 0;
  for (let i = 0; i < 6; i++) { let n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1); n *= n; s += n * a; w += a; a *= .5; f *= 2.07; }
  return s / w;
}
/** Valle central serpenteante rodeado de picos afilados. Sustituible por un heightmap real (terrain.party). */
export function heightAt(x: number, z: number) {
  const cx = Math.sin(z * .015) * 25;
  const mask = sm(.05, 1, Math.min(1, Math.abs(x - cx) / 95));
  const peaks = ridged(x * .011 + 7, z * .011 + 3) * 95;
  const roll = vnoise(x * .03, z * .03) * 7 + vnoise(x * .1, z * .1) * 1.5;
  const wall = sm(.55, 1, Math.abs(z) / 350) * 70;
  return peaks * (.12 + .88 * mask) + roll * (1 - mask * .5) + wall;
}
export function buildTerrain(scene: Scene, sub = 320) {
  const size = 700;
  const g = MeshBuilder.CreateGround("terrain", { width: size, height: size, subdivisions: sub, updatable: true }, scene);
  const pos = g.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(pos[i], pos[i + 2]);
  const nor: number[] = []; VertexData.ComputeNormals(pos, g.getIndices()!, nor);
  const n = pos.length / 3, col = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const ny = nor[v * 3 + 1], x = pos[v * 3], z = pos[v * 3 + 2], j = vnoise(x * .25, z * .25);
    const snow = sm(.58 + j * .12, .86, ny) * (.75 + .25 * sm(0, 30, pos[v * 3 + 1] + j * 20));
    const rock = .16 + j * .12; // roca oscura parda
    col[v * 4] = rock * (1 - snow) + .93 * snow; col[v * 4 + 1] = (rock * .85) * (1 - snow) + .95 * snow;
    col[v * 4 + 2] = (rock * .8) * (1 - snow) + 1 * snow; col[v * 4 + 3] = 1;
  }
  g.setVerticesData(VertexBuffer.PositionKind, pos); g.setVerticesData(VertexBuffer.NormalKind, nor);
  g.setVerticesData(VertexBuffer.ColorKind, col); g.hasVertexAlpha = false; g.receiveShadows = true;
  // Aquí se cambia por albedo/normal/ORM .ktx2 de ambientCG o Poly Haven y un splat real.
  const m = new PBRMaterial("snowRock", scene);
  m.albedoColor = Color3.White(); m.metallic = 0; m.roughness = .82; m.environmentIntensity = .6;
  g.material = m; g.freezeWorldMatrix();
  return g;
}
function pineMesh(scene: Scene): Mesh {
  const parts: Mesh[] = [];
  const trunk = MeshBuilder.CreateCylinder("tr", { height: 1.4, diameter: .5, tessellation: 5 }, scene); trunk.position.y = .7; parts.push(trunk);
  for (let i = 0; i < 4; i++) {
    const c = MeshBuilder.CreateCylinder("tier" + i, { height: 3.2 - i * .4, diameterTop: 0, diameterBottom: 4.2 - i * .9, tessellation: 7 }, scene);
    c.position.y = 1.8 + i * 1.5; parts.push(c);
  }
  const m = Mesh.MergeMeshes(parts, true, true)!; m.name = "pine";
  const pos = m.getVerticesData(VertexBuffer.PositionKind)!, col = new Float32Array(pos.length / 3 * 4);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const sn = Math.min(1, Math.max(0, (y - 1.5) / 6)) * (.3 + .5 * hash(Math.round(x * 3), Math.round(z * 3 + y * 2)));
    col[v * 4] = .03 * (1 - sn) + .85 * sn; col[v * 4 + 1] = .07 * (1 - sn) + .9 * sn; col[v * 4 + 2] = .08 * (1 - sn) + sn; col[v * 4 + 3] = 1;
  }
  m.setVerticesData(VertexBuffer.ColorKind, col); m.hasVertexAlpha = false;
  return m;
}
/** Pinos nevados con thin instances (1 draw call). */
export function scatterTrees(scene: Scene, count = 900): Mesh {
  const t = pineMesh(scene);
  const m = new PBRMaterial("pineMat", scene); m.albedoColor = Color3.White(); m.roughness = .9; m.metallic = 0; t.material = m;
  const buf = new Float32Array(count * 16); let k = 0;
  for (let i = 0; i < count * 8 && k < count; i++) {
    const x = (hash(i, 1.7) - .5) * 600, z = (hash(i, 9.3) - .5) * 600, h = heightAt(x, z);
    const sl = Math.abs(heightAt(x + 2, z) - h) + Math.abs(heightAt(x, z + 2) - h);
    if (h > 22 || sl > 2.2) continue;
    const s = .7 + hash(i, 4.1) * 1.1;
    Matrix.Compose(new Vector3(s, s * (1 + hash(i, 6) * .6), s), Quaternion.RotationAxis(Vector3.Up(), hash(i, 2.2) * 6.28), new Vector3(x, h - .2, z)).copyToArray(buf, k * 16); k++;
  }
  t.thinInstanceSetBuffer("matrix", buf.subarray(0, k * 16), 16, true);
  t.receiveShadows = true; t.alwaysSelectAsActiveMesh = true;
  return t;
}
/** Rocas facetadas dispersas. */
export function scatterRocks(scene: Scene, count = 300): Mesh {
  const r = MeshBuilder.CreateIcoSphere("rock", { radius: 1, subdivisions: 1, flat: true }, scene);
  const m = new PBRMaterial("rockMat", scene); m.albedoColor = new Color3(.2, .19, .22); m.roughness = .95; m.metallic = 0; r.material = m;
  const buf = new Float32Array(count * 16);
  for (let i = 0; i < count; i++) {
    const x = (hash(i, 31.1) - .5) * 520, z = (hash(i, 17.7) - .5) * 520, s = .6 + hash(i, 8.8) * 2.4;
    Matrix.Compose(new Vector3(s * 1.4, s, s * 1.1), Quaternion.RotationAxis(Vector3.Up(), hash(i, 5.5) * 6.28), new Vector3(x, heightAt(x, z) + s * .15, z)).copyToArray(buf, i * 16);
  }
  r.thinInstanceSetBuffer("matrix", buf, 16, true); r.receiveShadows = true; r.alwaysSelectAsActiveMesh = true;
  return r;
}
