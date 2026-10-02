import { Engine, Scene, ArcRotateCamera, Vector3, Color3, Color4, DirectionalLight, HemisphericLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Scene as S } from "@babylonjs/core";
import { buildTerrain, scatterTrees, scatterRocks, heightAt } from "./world/terrain";
import { spawnParty, spawnBoss, animate } from "./game/heroes";
import { createHud } from "./game/hud";
import { createSky } from "./world/sky";
import { createRain, createSnow } from "./world/rain";
import { setupPost } from "./world/post";
import { Weather, PRESETS } from "./world/weather";

(window as any).__ok = true;
document.getElementById("boot")?.remove();
document.getElementById("err")?.remove();
const stageEl = { v: "inicio" };
function fail(m: string) {
  let d = document.getElementById("err");
  if (!d) { d = document.createElement("pre"); d.id = "err";
    d.style.cssText = "position:fixed;top:60px;left:12px;right:12px;margin:0;padding:12px;background:rgba(120,0,20,.85);color:#fff;font:12px monospace;white-space:pre-wrap;z-index:9;border-radius:8px;max-height:60%;overflow:auto";
    document.body.appendChild(d); }
  d.textContent += m + "\n";
}
addEventListener("error", e => fail(`[${stageEl.v}] ${e.message}`));
addEventListener("unhandledrejection", e => fail(`[${stageEl.v}] ${(e.reason && e.reason.message) || e.reason}`));

const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches;
const Q = mobile
  ? { sub: 140, shadow: 1024, trees: 350, rainCap: 6000, snowCap: 3000, rocks: 120, snowK: .35, post: { ssao: false, vls: false, samples: 1, bloom: true } }
  : { sub: 320, shadow: 2048, trees: 900, rainCap: 30000, snowCap: 12000, rocks: 300, snowK: 1, post: { ssao: true, vls: true, samples: 4, bloom: true } };

const canvas = document.getElementById("c") as HTMLCanvasElement;
const weather = new Weather();
const ui = document.getElementById("ui")!;
Object.entries(PRESETS).forEach(([k, p], i) => {
  const b = document.createElement("button"); b.textContent = `${i + 1} ${p.label}`;
  b.onclick = () => select(k); b.dataset.k = k; ui.appendChild(b);
});
function select(k: string) { weather.set(k); ui.querySelectorAll("button").forEach(b => b.classList.toggle("on", (b as HTMLElement).dataset.k === k)); }
addEventListener("keydown", e => { const k = Object.keys(PRESETS)[+e.key - 1]; if (k) select(k); });
select("amanecer");

try {
  stageEl.v = "motor";
  const engine = new Engine(canvas, !mobile, { stencil: true, powerPreference: "high-performance" }, !mobile);
  if (mobile) engine.setHardwareScalingLevel(1.25);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.clearColor = new Color4(0, 0, 0, 1);
  scene.fogMode = S.FOGMODE_EXP2;

  const target = new Vector3(0, heightAt(0, -20) + 8, -15);
  const cam = new ArcRotateCamera("cam", -Math.PI / 2, 1.38, 62, target, scene);
  cam.attachControl(canvas, true);
  cam.lowerRadiusLimit = 15; cam.upperRadiusLimit = 260; cam.lowerBetaLimit = .35; cam.upperBetaLimit = 1.5;
  cam.wheelPrecision = 4; cam.minZ = .5; cam.maxZ = 3000; cam.fov = .95;

  stageEl.v = "cielo";
  const sky = createSky(scene);
  const sunMesh = MeshBuilder.CreateSphere("sun", { diameter: 90, segments: 12 }, scene);
  const sunMat = new StandardMaterial("sunMat", scene); sunMat.disableLighting = true; sunMat.emissiveColor = Color3.White(); sunMat.fogEnabled = false;
  sunMesh.material = sunMat; sunMesh.applyFog = false;

  stageEl.v = "terreno";
  const terrain = buildTerrain(scene, Q.sub);
  const trees = scatterTrees(scene, Q.trees);
  const rocks = scatterRocks(scene, Q.rocks);

  stageEl.v = "luces";
  const hemi = new HemisphericLight("hemi", Vector3.Up(), scene);
  const sun = new DirectionalLight("dir", new Vector3(0, -1, 1), scene);
  const sg = new ShadowGenerator(Q.shadow, sun);
  sg.usePercentageCloserFiltering = true; sg.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  sg.bias = .0006; sg.normalBias = .02; sg.addShadowCaster(terrain); sg.addShadowCaster(trees);
  sun.shadowMaxZ = 700; sun.autoCalcShadowZBounds = true;
  sg.addShadowCaster(rocks);
  stageEl.v = "héroes";
  const party = spawnParty(scene, sg), boss = spawnBoss(scene, sg), actors = [...party, boss];
  createHud(id => { const a = actors.find(x => x.id === id); if (a) a.pulse = 1; });

  stageEl.v = "lluvia";
  const rain = createRain(scene, Q.rainCap);
  const snow = createSnow(scene, Q.snowCap);
  stageEl.v = "postproceso";
  const { pipe, vls } = setupPost(scene, cam, sunMesh, [sky.mesh], Q.post);

  stageEl.v = "bucle";
  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000; time += dt; weather.update(dt);
    const w = weather.cur, el = w.sunElev * Math.PI / 180;
    const toSun = new Vector3(Math.sin(.15) * Math.cos(el), Math.sin(el), Math.cos(.15) * Math.cos(el)).normalize();
    const c3 = (a: number[]) => new Color3(a[0], a[1], a[2]);
    sky.mat.setVector3("top", new Vector3(...w.top)); sky.mat.setVector3("hor", new Vector3(...w.hor));
    sky.mat.setVector3("sunDir", toSun); sky.mat.setVector3("sunCol", new Vector3(...w.sunCol));
    sky.mat.setFloat("stars", w.stars); sky.mat.setFloat("t", time);
    sun.direction = toSun.scale(-1); sun.position = target.add(toSun.scale(400));
    sun.diffuse = c3(w.sunCol); sun.intensity = w.sunInt;
    hemi.diffuse = c3(w.hemiSky); hemi.groundColor = c3(w.hemiGnd); hemi.intensity = w.hemiInt;
    scene.fogColor = c3(w.fogCol); scene.fogDensity = w.fog;
    sunMesh.position = cam.position.add(toSun.scale(1200)); sunMat.emissiveColor = c3(w.sunCol);
    sunMesh.setEnabled(Q.post.vls && toSun.y > -.05);
    pipe.imageProcessing.exposure = w.exposure; pipe.bloomWeight = w.bloom;
    if (vls) { vls.weight = w.rays * 1.4; vls.exposure = .1 + w.rays * .4; }
    rain.emitRate = w.rain; (rain.emitter as Vector3).copyFromFloats(cam.position.x, cam.position.y + 45, cam.position.z);
    snow.emitRate = w.snow * Q.snowK; (snow.emitter as Vector3).copyFromFloats(cam.position.x, cam.position.y + 30, cam.position.z);
    animate(actors, time, dt);
    cam.alpha += dt * .012;
  });
  engine.runRenderLoop(() => scene.render());
  let acc = 0, lvl = mobile ? 1.25 : 1; // escalado dinámico de resolución según FPS
  scene.onAfterRenderObservable.add(() => {
    acc += engine.getDeltaTime(); if (acc < 2500) return; acc = 0;
    const f = engine.getFps(), old = lvl;
    if (f < 28 && lvl < 2.25) lvl += .25; else if (f > 56 && lvl > (mobile ? 1 : 1)) lvl -= .25;
    if (lvl !== old) engine.setHardwareScalingLevel(lvl);
  });
  addEventListener("resize", () => engine.resize());
} catch (e: any) { fail(`[${stageEl.v}] ${e?.message ?? e}`); console.error(e); }
