/**
 * PriomEngine — motor gráfico de PriomGL Quantum.
 * Orquesta: render (Babylon.js) + IA (Trinity, Consejo políglota, Gobernador) + mundo (terreno, cielo, clima, props de Blender).
 */
import { Engine, Scene, ArcRotateCamera, Vector3, Vector4, Color3, Color4, DirectionalLight, HemisphericLight, ShadowGenerator, CascadedShadowGenerator,
  ReflectionProbe, RenderTargetTexture, MeshBuilder, StandardMaterial, Mesh } from "@babylonjs/core";
import { profileHardware, DNA } from "../core/hardware";
import { Council } from "../core/council";
import { Governor, QualityState } from "../core/governor";
import { Trinity } from "../core/trinity";
import { buildTerrain, heightAt, zoneHeight } from "./terrain";
import { createSky } from "./sky";
import { createRain, createSnow } from "./rain";
import { setupPost } from "./post";
import { buildProps, Props } from "./props";
import { Weather, ORDER } from "./weather";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export class PriomEngine {
  dna!: DNA; council = new Council(); governor!: Governor; trinity = new Trinity(); weather = new Weather();
  engine!: Engine; scene!: Scene; cam!: ArcRotateCamera; props: Props | null = null; post!: ReturnType<typeof setupPost>;
  quality!: QualityState; auto = false; fps = 60; wind = .4; stage = "inicio"; time = 0; shadowKind = "";
  onStage: (s: string) => void = () => {};
  private sg!: ShadowGenerator; private sun!: DirectionalLight; private autoT = 0; private qT = 0; private curScale = 1; private basePR = 1;
  private rain: any; private snow: any; private tel = { frameMs: 16, dayTime: 6, weatherIntensity: 0, load: 0, quality: 1, entities: 0, wind: .4, raining: false, drawCalls: 0, triangles: 0, cam: [0, 0, 0] as [number, number, number] };

  async start(canvas: HTMLCanvasElement, base: string) {
    const st = (s: string) => { this.stage = s; this.onStage(s); };
    st("perfilando hardware"); const dna = (this.dna = profileHardware());
    await this.council.load(base + "data/hw_luts.json", dna); this.governor = new Governor(dna, this.council); const mobile = dna.platform.isMobile;
    st("motor"); const engine = (this.engine = new Engine(canvas, !mobile, { stencil: true, powerPreference: "high-performance" }, false));
    this.basePR = Math.min(window.devicePixelRatio || 1, dna.rec.pixelRatio); this.curScale = this.basePR; engine.setHardwareScalingLevel(1 / this.curScale);
    const scene = (this.scene = new Scene(engine)); scene.clearColor = new Color4(0, 0, 0, 1); scene.fogMode = Scene.FOGMODE_EXP2; scene.skipPointerMovePicking = true;
    const target = new Vector3(0, zoneHeight(0) + 14, 0);
    const cam = (this.cam = new ArcRotateCamera("cam", -Math.PI / 2, 1.38, 85, target, scene)); cam.attachControl(canvas, true);
    Object.assign(cam, { lowerRadiusLimit: 15, upperRadiusLimit: 260, lowerBetaLimit: .35, upperBetaLimit: 1.5, wheelPrecision: 4, minZ: .5, maxZ: 3000, fov: .95 });

    st("cielo"); const sky = createSky(scene, base);
    const sunMesh = MeshBuilder.CreateSphere("sun", { diameter: 90, segments: 12 }, scene), sunMat = new StandardMaterial("sunMat", scene);
    sunMat.disableLighting = true; sunMat.emissiveColor = Color3.White(); sunMat.fogEnabled = false; sunMesh.material = sunMat; sunMesh.applyFog = false;
    st("terreno"); const terrain = buildTerrain(scene, mobile ? 220 : dna.score > 70 ? 400 : 300, base, mobile ? 768 : 1024);

    st("luces"); const hemi = new HemisphericLight("hemi", Vector3.Up(), scene), sun = (this.sun = new DirectionalLight("dir", new Vector3(0, -1, 1), scene));
    let sg: ShadowGenerator;
    try { // sombras en cascada (nítidas cerca, estables lejos); el consejo fija el máximo de cascadas
      const csm = new CascadedShadowGenerator(dna.rec.shadowSize, sun); csm.numCascades = Math.min(this.council.maxCascades(), mobile ? 2 : 3); csm.lambda = .8; csm.shadowMaxZ = 260;
      csm.stabilizeCascades = true; csm.autoCalcDepthBounds = true; csm.usePercentageCloserFiltering = true; csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM; csm.bias = .002; csm.normalBias = .03; sg = csm; this.shadowKind = `CSM×${csm.numCascades}`;
    } catch (e) { console.warn("CSM no disponible", e); sg = new ShadowGenerator(dna.rec.shadowSize, sun); sg.usePercentageCloserFiltering = true; sg.bias = .0006; sg.normalBias = .02; sun.shadowMaxZ = 700; sun.autoCalcShadowZBounds = true; this.shadowKind = "PCF"; }
    this.sg = sg; sg.addShadowCaster(terrain);

    st("props de Blender"); const trees = Math.round(Math.min(this.council.treeBudget(), dna.rec.trees) * .8);
    this.props = await buildProps(scene, base, sg, { trees, rocks: mobile ? 90 : 220, crystals: mobile ? 12 : 26 });

    st("entorno"); let probe: ReflectionProbe | null = null, envT = 0, envDirty = true;
    try { probe = new ReflectionProbe("env", 64, scene); probe.renderList!.push(sky.mesh); scene.environmentTexture = probe.cubeTexture; scene.environmentIntensity = .7; } catch (e) { console.warn("Sin entorno", e); probe = null; }
    st("partículas"); this.rain = createRain(scene, mobile ? 6000 : 30000); this.snow = createSnow(scene, mobile ? 3000 : 12000);
    st("postproceso"); this.post = setupPost(scene, cam, sunMesh, [sky.mesh], { ssao: dna.rec.ssao, vls: !mobile && dna.score > 55, samples: mobile ? 1 : 4, bloom: dna.rec.bloom, neural: dna.rec.neuralTonemap });
    this.weather.set("amanecer"); this.quality = this.governor.update(0, dna.rec.targetFPS, this.trinity.advice);

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(.1, engine.getDeltaTime() / 1000); this.time += dt; const time = this.time; this.weather.update(dt); this.fps = engine.getFps() || 60;
      const w = this.weather.cur, el = w.sunElev * Math.PI / 180, toSun = new Vector3(Math.sin(.15) * Math.cos(el), Math.sin(el), Math.cos(.15) * Math.cos(el)).normalize(), c3 = (a: number[]) => new Color3(a[0], a[1], a[2]);
      // --- IA: telemetría → Trinity → Gobernador/Consejo → calidad aplicada
      const t = this.tel; t.frameMs = engine.getDeltaTime(); t.dayTime = w.hour; t.weatherIntensity = w.wet * 2 - 1 > 0 ? w.wet : -.5 + w.wet; t.load = this.governor.load; t.quality = this.quality.quality;
      t.entities = this.props ? this.props.scatters.reduce((a, s) => a + s.mesh.thinInstanceCount, 0) : 0; t.wind = this.wind; t.raining = w.rain > 100;
      t.drawCalls = (engine as any)._drawCalls?.current ?? 0; t.triangles = scene.getActiveIndices() / 3; t.cam = [cam.position.x, cam.position.y, cam.position.z];
      const advice = this.trinity.tick(dt, t); this.qT += dt;
      if (this.qT > .25) { this.quality = this.governor.update(this.qT, this.fps, advice); this.qT = 0; this.applyQuality(this.quality); }
      // --- viento: curva de ráfagas de Python modulada por Trinity
      const gust = this.council.gust(time), windBase = w.rain > 100 ? .8 : w.snow > 600 ? .2 : .45; this.wind = clamp(windBase * (.45 + .75 * gust) * (.85 + .3 * advice.windHint), 0, 1);
      if (this.props?.blades) this.props.blades.rotation.z += dt * (.2 + this.wind * 1.7);
      const flick = .93 + .07 * Math.sin(time * 6.3) * Math.sin(time * 2.1 + 1); this.props?.glow.forEach(g => (g.mat.emissiveIntensity = g.base * w.lamp * flick));
      // --- cielo, luces, niebla, post
      sky.mat.setVector3("top", new Vector3(...w.top)); sky.mat.setVector3("hor", new Vector3(...w.hor)); sky.mat.setVector3("sunDir", toSun); sky.mat.setVector3("sunCol", new Vector3(...w.sunCol));
      sky.mat.setFloat("stars", w.stars); sky.mat.setFloat("aur", w.aur); sky.mat.setFloat("cloud", w.cloud); sky.mat.setFloat("t", time);
      sky.mat.setVector4("tx", new Vector4(...w.tx)); sky.mat.setVector3("tn", new Vector3(...w.tn)); sky.mat.setVector3("ts", new Vector3(...w.ts)); sky.mat.setVector3("to", new Vector3(...w.to));
      sun.direction = toSun.scale(-1); sun.position = target.add(toSun.scale(400)); sun.diffuse = c3(w.sunCol); sun.intensity = w.sunInt;
      hemi.diffuse = c3(w.hemiSky); hemi.groundColor = c3(w.hemiGnd); hemi.intensity = w.hemiInt; scene.fogColor = c3(w.fogCol); scene.fogDensity = w.fog;
      sunMesh.position = cam.position.add(toSun.scale(1200)); sunMat.emissiveColor = c3(w.sunCol); sunMesh.setEnabled(!!this.post.vls && toSun.y > -.05);
      this.post.pipe.imageProcessing.exposure = w.exposure; this.post.pipe.bloomWeight = w.bloom;
      if (this.post.vls) { this.post.vls.weight = w.rays * 1.4; this.post.vls.exposure = .1 + w.rays * .4; }
      const pm = this.quality.particles, wx = (this.wind - .35) * 1.6;
      this.rain.emitRate = w.rain * pm; this.rain.direction1.x = this.rain.direction2.x = -.08 - wx * .35; (this.rain.emitter as Vector3).copyFromFloats(cam.position.x, cam.position.y + 45, cam.position.z);
      this.snow.emitRate = w.snow * (mobile ? .35 : 1) * pm; this.snow.gravity.x = wx * 1.8; (this.snow.emitter as Vector3).copyFromFloats(cam.position.x, cam.position.y + 30, cam.position.z);
      envT += dt; if (probe && envT > .4 && (this.weather.busy || envDirty)) { probe.cubeTexture.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; envT = 0; envDirty = this.weather.busy; }
      // --- clima automático guiado por Trinity
      if (this.auto && (this.autoT += dt) > 38 + 22 * advice.confidence) { this.autoT = 0; const i = ORDER.indexOf(this.weather.name); this.weather.set(ORDER[(i + (advice.weatherHint > .6 ? 2 : 1)) % ORDER.length]); }
      cam.alpha += dt * .012;
    });
    st("listo"); let started = false;
    const go = () => { if (started) return; started = true; engine.runRenderLoop(() => scene.render()); };
    scene.executeWhenReady(go); setTimeout(go, 9000); addEventListener("resize", () => engine.resize());
    return this;
  }
  /** El Gobernador decide; aquí se traduce a ajustes reales del motor. */
  private applyQuality(q: QualityState) {
    const s = clamp(this.basePR * q.pixel, .5, 2); if (Math.abs(s - this.curScale) > .05) { this.curScale = s; this.engine.setHardwareScalingLevel(1 / s); }
    const sm = this.sg.getShadowMap(); if (sm) sm.refreshRate = q.shadow >= .6 ? 1 : 2; this.sun.shadowEnabled = q.shadow > .15;
    this.post.setBloom(q.bloom); this.post.setSSAO(q.ssao);
    const e = clamp(q.entities, .1, 1); this.props?.scatters.forEach(sc => { sc.mesh.thinInstanceCount = Math.max(1, Math.floor(sc.total * e)); });
  }
  setWeather(name: string) { this.auto = false; this.weather.set(name); }
  setNeural(on: boolean) { return this.post.setNeural(on); }
  get hasNeural() { return this.post.hasNT; }
}
export { heightAt };
