import { TerrainMaterial } from "@babylonjs/materials";
import { Scene, DynamicTexture, Texture, MeshBuilder, VertexBuffer, VertexData, PBRMaterial, Color3, Matrix, Vector3, Quaternion, Mesh } from "@babylonjs/core";
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
/** Valle serpenteante con deformación de dominio y picos afilados. Sustituible por un heightmap real (terrain.party). */
function rawHeight(x: number, z: number) {
  const wx = x + (vnoise(x * .008, z * .008) - .5) * 70, wz = z + (vnoise(x * .008 + 9, z * .008 + 4) - .5) * 70;
  const cx = Math.sin(wz * .015) * 25;
  const mask = sm(.05, 1, Math.min(1, Math.abs(wx - cx) / 95));
  const peaks = Math.pow(ridged(wx * .011 + 7, wz * .011 + 3), 1.25) * 118;
  const roll = vnoise(x * .03, z * .03) * 7 + vnoise(x * .1, z * .1) * 1.5 + vnoise(x * .35, z * .35) * .5;
  const wall = sm(.55, 1, Math.abs(z) / 350) * 70;
  return peaks * (.12 + .88 * mask) + roll * (1 - mask * .5) + wall;
}
/** Zonas aplanadas para la aldea, el círculo rúnico y las ruinas del dragón (el terreno se funde suavemente con ellas). */
export const ZONES = [{ x: 0, z: 0, r0: 50, r1: 92 }, { x: 22, z: 88, r0: 17, r1: 42 }, { x: -50, z: -45, r0: 24, r1: 48 }];
const PLATEAU = ZONES.map(z => rawHeight(z.x, z.z));
export const zoneHeight = (i: number) => PLATEAU[i];
export function zoneDist(x: number, z: number) { let m = 1e9; for (const q of ZONES) m = Math.min(m, Math.hypot(x - q.x, z - q.z) - q.r0); return m; }
export function heightAt(x: number, z: number) {
  let h = rawHeight(x, z);
  for (let i = 0; i < ZONES.length; i++) { const q = ZONES[i], t = sm(q.r0, q.r1, Math.hypot(x - q.x, z - q.z)); h = PLATEAU[i] * (1 - t) + h * t; }
  return h;
}
function tn(x: number, y: number, p: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number) => hash(((a % p) + p) % p, ((b % p) + p) % p);
  const A = h(xi, yi), B = h(xi + 1, yi), C = h(xi, yi + 1), D = h(xi + 1, yi + 1);
  return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
}
/** Mapa de normales procedural y repetible (micro-relieve de nieve y roca). */
function makeBump(scene: Scene) {
  const S = 512, tex = new DynamicTexture("bump", { width: S, height: S }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D, hg = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
    hg[y * S + x] = tn(x / S * 8, y / S * 8, 8) + tn(x / S * 16, y / S * 16, 16) * .5 + tn(x / S * 32, y / S * 32, 32) * .25 + tn(x / S * 64, y / S * 64, 64) * .12;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hg[y * S + (x + 1) % S] - hg[y * S + (x - 1 + S) % S], dy = hg[((y + 1) % S) * S + x] - hg[((y - 1 + S) % S) * S + x];
    let nx = -dx * 6, ny = -dy * 6, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; img.data[i] = (nx * .5 + .5) * 255; img.data[i + 1] = (ny * .5 + .5) * 255; img.data[i + 2] = (nz * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); tex.update(); tex.anisotropicFilteringLevel = 8;
  return tex;
}
export function buildTerrain(scene: Scene, sub = 320, base = "/", mixSize = 1024) {
  const size = 700, W = sub + 1, st = size / sub;
  const g = MeshBuilder.CreateGround("terrain", { width: size, height: size, subdivisions: sub, updatable: true }, scene);
  const pos = g.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(pos[i], pos[i + 2]);
  const nor: number[] = []; VertexData.ComputeNormals(pos, g.getIndices()!, nor);
  const n = pos.length / 3, uv = new Float32Array(n * 2), col = new Float32Array(n * 4);
  // rejillas por (fila, columna) calculadas desde las coordenadas reales de cada vértice
  const gS = new Float32Array(W * W), gR = new Float32Array(W * W), gA = new Float32Array(W * W).fill(1), gH = new Float32Array(W * W);
  const hh = (r: number, c: number) => gH[Math.min(sub, Math.max(0, r)) * W + Math.min(sub, Math.max(0, c))];
  for (let v = 0; v < n; v++) { const c = Math.round((pos[v * 3] + size / 2) / st), r = Math.round((pos[v * 3 + 2] + size / 2) / st); gH[r * W + c] = pos[v * 3 + 1]; }
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ny = nor[v * 3 + 1];
    const c = Math.round((x + size / 2) / st), r = Math.round((z + size / 2) / st), k = r * W + c;
    const j = vnoise(x * .25, z * .25), j2 = vnoise(x * .9, z * .9);
    const avg = (hh(r, c - 2) + hh(r, c + 2) + hh(r - 2, c) + hh(r + 2, c)) / 4;           // oclusión ambiental horneada
    gA[k] = Math.min(1, Math.max(.55, 1 - Math.max(0, avg - y) / (st * 2) * .5));
    gS[k] = sm(.58 + j * .12, .86, ny) * (.75 + .25 * sm(0, 30, y + j * 20)) * (.92 + .08 * j2);
    gR[k] = sm(2, 26, y) ;                                                                   // 0 = grava del valle, 1 = pizarra
    uv[v * 2] = x / size + .5; uv[v * 2 + 1] = z / size + .5;
    const sn = gS[k], rk = (.16 + j * .12) * gA[k];                                          // colores de respaldo (PBR)
    col[v * 4] = (rk * (1 - sn) + .93 * sn) * gA[k]; col[v * 4 + 1] = (rk * .9 * (1 - sn) + .95 * sn) * gA[k]; col[v * 4 + 2] = (rk * .8 * (1 - sn) + sn) * gA[k]; col[v * 4 + 3] = 1;
  }
  g.setVerticesData(VertexBuffer.PositionKind, pos); g.setVerticesData(VertexBuffer.NormalKind, nor);
  g.setVerticesData(VertexBuffer.UVKind, uv); g.hasVertexAlpha = false; g.receiveShadows = true;

  // Máscara de mezcla: R = nieve, G = roca pizarra, B = grava. Detalle fino por texel sobre la rejilla del mallado.
  const S = mixSize, mix = new DynamicTexture("mix", { width: S, height: S }, scene, true);
  const ctx = mix.getContext() as CanvasRenderingContext2D, img = ctx.createImageData(S, S);
  const samp = (G: Float32Array, fx: number, fy: number) => {
    const x0 = Math.min(sub - 1, Math.max(0, Math.floor(fx))), y0 = Math.min(sub - 1, Math.max(0, Math.floor(fy))), tx = fx - x0, ty = fy - y0;
    const a = G[y0 * W + x0], b = G[y0 * W + x0 + 1], c2 = G[(y0 + 1) * W + x0], d = G[(y0 + 1) * W + x0 + 1];
    return a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty;
  };
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const wx = (px + .5) / S * size - size / 2, wz = (1 - (py + .5) / S) * size - size / 2, fx = (wx + size / 2) / st, fy = (wz + size / 2) / st;
    const ao = samp(gA, fx, fy), nz = vnoise(wx * .35, wz * .35) - .5, nz2 = vnoise(wx * 1.3, wz * 1.3) - .5;
    const sn = sm(.38, .62, samp(gS, fx, fy) + nz * .5 + nz2 * .25);                         // borde de nieve irregular
    const rs = samp(gR, fx, fy) + nz * .6, rock = (1 - sn) * sm(.25, .6, rs), grav = (1 - sn) * (1 - sm(.25, .6, rs));
    const o = (py * S + px) * 4;
    img.data[o] = sn * ao * 255; img.data[o + 1] = rock * ao * 255; img.data[o + 2] = grav * ao * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); mix.update(); mix.wrapU = mix.wrapV = Texture.CLAMP_ADDRESSMODE;

  const L = (f: string, tile: number) => { const t = new Texture(base + "tex/" + f, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE); t.uScale = t.vScale = size / tile; t.anisotropicFilteringLevel = 8; return t; };
  const tm = new TerrainMaterial("terrainMat", scene);
  tm.mixTexture = mix;
  tm.diffuseTexture1 = L("snow_c.jpg", 12); tm.bumpTexture1 = L("snow_n.jpg", 12);
  tm.diffuseTexture2 = L("rock_c.jpg", 9);  tm.bumpTexture2 = L("rock_n.jpg", 9);
  tm.diffuseTexture3 = L("ground_c.jpg", 10); tm.bumpTexture3 = L("ground_n.jpg", 10);
  tm.specularColor = new Color3(.22, .25, .3); tm.specularPower = 40;
  g.material = tm; g.freezeWorldMatrix();

  // Respaldo: si el shader del terreno falla al compilar, vuelve al material PBR con colores por vértice (se comprueba tras 90 fotogramas).
  let frames = 0; const obs = scene.onAfterRenderObservable.add(() => {
    if (++frames < 90) return; scene.onAfterRenderObservable.remove(obs);
    const eff: any = g.subMeshes?.[0]?.effect, err = String(eff?.compilationError || eff?.getCompilationError?.() || "");
    if (!err) return;
    console.warn("TerrainMaterial no compiló; usando PBR de respaldo:", err);
    g.setVerticesData(VertexBuffer.ColorKind, col);
    const m = new PBRMaterial("snowRock", scene); m.albedoColor = Color3.White(); m.metallic = 0; m.roughness = .62; m.environmentIntensity = .8;
    const bt = makeBump(scene); bt.uScale = bt.vScale = 90; bt.level = .8; m.bumpTexture = bt; g.material = m;
  });
  return g;
}
/** Racimos de cristales de hielo emisivos (el bloom los hace brillar). */
export function scatterCrystals(scene: Scene, clusters = 24): Mesh {
  const c = MeshBuilder.CreateCylinder("crystal", { height: 5, diameterTop: 0, diameterBottom: 1.2, tessellation: 5 }, scene);
  const m = new PBRMaterial("crystalMat", scene); m.albedoColor = new Color3(.5, .8, 1); m.roughness = .15; m.metallic = 0;
  m.emissiveColor = new Color3(.15, .45, .9); m.emissiveIntensity = 2.2; c.material = m;
  const buf = new Float32Array(clusters * 6 * 16); let k = 0, placed = 0;
  for (let i = 0; i < clusters * 20 && placed < clusters; i++) {
    const cx = (hash(i, 51.3) - .5) * 260, cz = (hash(i, 73.9) - .5) * 400, ch = heightAt(cx, cz);
    if (ch > 30) continue; placed++;
    const cnt = 3 + Math.floor(hash(i, 3.3) * 3);
    for (let q = 0; q < cnt; q++) {
      const ox = (hash(i * 7 + q, 1.1) - .5) * 5, oz = (hash(i * 7 + q, 2.2) - .5) * 5, s = .6 + hash(i * 7 + q, 3.3) * 1.8;
      Matrix.Compose(new Vector3(s, s * (1 + hash(q, i) * .8), s),
        Quaternion.RotationYawPitchRoll(hash(i, q) * 6.28, (hash(q, 9.1) - .5) * .7, (hash(q, 5.5) - .5) * .7),
        new Vector3(cx + ox, heightAt(cx + ox, cz + oz) + s * 2.2, cz + oz)).copyToArray(buf, k * 16); k++;
    }
  }
  c.thinInstanceSetBuffer("matrix", buf.subarray(0, k * 16), 16, true); c.alwaysSelectAsActiveMesh = true;
  return c;
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
