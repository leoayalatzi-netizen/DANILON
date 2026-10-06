/** Props 3D hechos en Blender (ver /blender) cargados como GLB. Árboles/rocas/cristales usan thin instances (1 draw call por tipo). */
import "@babylonjs/loaders/glTF";
import { Scene, SceneLoader, Mesh, TransformNode, Matrix, Vector3, Quaternion, ShadowGenerator, PBRMaterial, AbstractMesh } from "@babylonjs/core";
import { heightAt, zoneDist, ZONES, zoneHeight, scatterTrees, scatterRocks, scatterCrystals } from "./terrain";

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export interface Scatter { mesh: Mesh; total: number }
export interface Props { scatters: Scatter[]; glow: { mat: PBRMaterial; base: number }[]; blades: TransformNode | null; stats: string; fromBlender: boolean }

async function load(scene: Scene, base: string, file: string) {
  const r = await SceneLoader.ImportMeshAsync("", base + "models/", file, scene);
  const meshes = r.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[];
  return { root: r.meshes[0] as AbstractMesh, meshes };
}
function collectGlow(meshes: AbstractMesh[], out: Props["glow"]) {
  for (const m of meshes) { const mats = m.material ? ((m.material as any).subMaterials ?? [m.material]) : [];
    for (const mt of mats) if (mt instanceof PBRMaterial && /Brillo|Cristal/.test(mt.name) && !out.some(g => g.mat === mt)) out.push({ mat: mt, base: mt.emissiveIntensity || 1 }); }
}
function instances(mesh: Mesh, world: Matrix[]) {
  // El cargador glTF refleja el eje Z (mano derecha → izquierda) con un nodo raíz; Babylon decide el sentido de las caras por ese espejo.
  // Para no romperlo, cada instancia se define como  M · W · M⁻¹  (se aplica el espejo del mesh y luego la colocación W en el mundo).
  mesh.computeWorldMatrix(true); const M = mesh.getWorldMatrix().clone(), inv = M.clone().invert(), buf = new Float32Array(world.length * 16);
  world.forEach((w, i) => M.multiply(w).multiply(inv).copyToArray(buf, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true); mesh.alwaysSelectAsActiveMesh = true; mesh.receiveShadows = true;
}
const compose = (p: Vector3, yaw: number, sx: number, sy = sx, sz = sx, tilt = 0) =>
  Matrix.Compose(new Vector3(sx, sy, sz), Quaternion.RotationYawPitchRoll(yaw, tilt, 0), p);

export async function buildProps(scene: Scene, base: string, sg: ShadowGenerator, opt: { trees: number; rocks: number; crystals: number }): Promise<Props> {
  const props: Props = { scatters: [], glow: [], blades: null, stats: "", fromBlender: true };
  try {
    // ---- aldea (kitbash Kenney en Blender) + molino animado
    const v = await load(scene, base, "village.glb"), hv = new TransformNode("village", scene); v.root.parent = hv;
    hv.position.set(ZONES[0].x, zoneHeight(0) - .05, ZONES[0].z);
    v.meshes.forEach(m => { m.receiveShadows = true; sg.addShadowCaster(m); }); collectGlow(v.meshes, props.glow);
    const b = await load(scene, base, "windmill_blades.glb"), hb = new TransformNode("blades", scene); b.root.parent = hb;
    let hub = [0, 25.1, 15.5]; try { hub = (await (await fetch(base + "models/village_meta.json")).json()).hub; } catch { /* usa el valor por defecto */ }
    hb.position.set(ZONES[0].x + hub[0], zoneHeight(0) - .05 + hub[2], ZONES[0].z + hub[1]);   // Blender (x,y,z) → Babylon (x,z,y)
    b.meshes.forEach(m => sg.addShadowCaster(m)); props.blades = hb;
    // ---- círculo rúnico y ruinas del dragón (colocados sobre sus zonas planas)
    const rc = await load(scene, base, "rune_circle.glb"), hr = new TransformNode("runes", scene); rc.root.parent = hr; hr.position.set(ZONES[1].x, zoneHeight(1), ZONES[1].z);
    rc.meshes.forEach(m => { m.receiveShadows = true; sg.addShadowCaster(m); }); collectGlow(rc.meshes, props.glow);
    const dr = await load(scene, base, "dragon_ruin.glb"), hd = new TransformNode("ruin", scene); dr.root.parent = hd; hd.position.set(ZONES[2].x, zoneHeight(2) - .2, ZONES[2].z); hd.rotation.y = .9;
    dr.meshes.forEach(m => { m.receiveShadows = true; sg.addShadowCaster(m); });
    // ---- pinos (3 variantes), rocas (3), cristales (2)
    const place = async (files: string[], total: number, fn: (i: number) => Matrix | null, shadow = true) => {
      const per = files.length, mats: Matrix[][] = files.map(() => []); let i = 0, guard = 0;
      while (mats.reduce((a, m) => a + m.length, 0) < total && guard++ < total * 14) { const w = fn(i++); if (w) mats[i % per].push(w); }
      for (let k = 0; k < per; k++) { const l = await load(scene, base, files[k]); const m = l.meshes[0]; instances(m, mats[k]); if (shadow) sg.addShadowCaster(m); props.scatters.push({ mesh: m, total: mats[k].length }); collectGlow(l.meshes, props.glow); }
    };
    await place(["pine_a.glb", "pine_b.glb", "pine_c.glb"], opt.trees, i => {
      const x = (hash(i, 1.7) - .5) * 620, z = (hash(i, 9.3) - .5) * 620, h = heightAt(x, z);
      const sl = Math.abs(heightAt(x + 2, z) - h) + Math.abs(heightAt(x, z + 2) - h);
      if (h > 24 || sl > 2.4 || zoneDist(x, z) < 6) return null; const s = .75 + hash(i, 4.1) * .9;
      return compose(new Vector3(x, h - .15, z), hash(i, 2.2) * 6.28, s, s * (1 + hash(i, 6) * .35));
    });
    await place(["boulder_a.glb", "boulder_b.glb", "boulder_c.glb"], opt.rocks, i => {
      const x = (hash(i, 31.1) - .5) * 560, z = (hash(i, 17.7) - .5) * 560;
      if (zoneDist(x, z) < 4) return null; const s = .7 + hash(i, 8.8) * 1.5;
      return compose(new Vector3(x, heightAt(x, z) - .2 * s, z), hash(i, 5.5) * 6.28, s, s * (.8 + hash(i, 1.3) * .5), s);
    });
    await place(["crystals_a.glb", "crystals_b.glb"], opt.crystals, i => {
      const x = (hash(i, 51.3) - .5) * 300, z = (hash(i, 73.9) - .5) * 460, h = heightAt(x, z);
      if (h > 34 || zoneDist(x, z) < 3) return null; const s = .9 + hash(i, 3.3) * 1.3;
      return compose(new Vector3(x, h - .3, z), hash(i, 7.7) * 6.28, s);
    }, false);
    props.stats = `${props.scatters.reduce((a, s) => a + s.total, 0)} instancias · ${props.glow.length} materiales emisivos`;
  } catch (e) {
    // Respaldo: si los GLB no cargan, se usan los props procedurales del motor.
    console.warn("GLB no disponibles; usando props procedurales", e); props.fromBlender = false;
    const t = scatterTrees(scene, opt.trees), r = scatterRocks(scene, opt.rocks), c = scatterCrystals(scene, 18);
    sg.addShadowCaster(t); sg.addShadowCaster(r); props.scatters.push({ mesh: t, total: opt.trees }, { mesh: r, total: opt.rocks }, { mesh: c, total: 18 * 6 });
    props.stats = "props procedurales (respaldo)";
  }
  return props;
}
