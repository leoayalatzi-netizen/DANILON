import { Scene, GPUParticleSystem, ParticleSystem, DynamicTexture, Vector3, Color4 } from "@babylonjs/core";
export function createRain(scene: Scene, cap = 30000) {
  const tex = new DynamicTexture("rainTex", { width: 8, height: 64 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const gr = ctx.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = gr; ctx.fillRect(3, 0, 2, 64); tex.update(); tex.hasAlpha = true;
  const gpu = GPUParticleSystem.IsSupported;
  const ps: any = gpu ? new GPUParticleSystem("rain", { capacity: cap }, scene) : new ParticleSystem("rain", Math.min(cap, 12000), scene);
  ps.particleTexture = tex; ps.emitter = new Vector3(0, 60, 0);
  ps.minEmitBox = new Vector3(-90, 0, -90); ps.maxEmitBox = new Vector3(90, 0, 90);
  ps.direction1 = ps.direction2 = new Vector3(-.08, -1, 0);
  ps.minEmitPower = 70; ps.maxEmitPower = 95; ps.minLifeTime = .8; ps.maxLifeTime = 1.1;
  ps.minScaleX = .04; ps.maxScaleX = .06; ps.minScaleY = 1.6; ps.maxScaleY = 3;
  ps.color1 = new Color4(.7, .8, 1, .55); ps.color2 = new Color4(.6, .7, 1, .3); ps.colorDead = new Color4(.6, .7, 1, 0);
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.emitRate = 0; ps.start();
  return ps as GPUParticleSystem;
}

export function createSnow(scene: Scene, cap = 4000) {
  const tex = new DynamicTexture("snowTex", 32, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); tex.update(); tex.hasAlpha = true;
  const ps = new ParticleSystem("snow", cap, scene);
  Object.assign(ps, { particleTexture: tex, emitter: new Vector3(0, 40, 0),
    minEmitBox: new Vector3(-70, 0, -70), maxEmitBox: new Vector3(70, 0, 70),
    direction1: new Vector3(-.4, -1, -.2), direction2: new Vector3(.4, -1, .2),
    minEmitPower: 2, maxEmitPower: 5, minLifeTime: 9, maxLifeTime: 13, minSize: .12, maxSize: .35,
    gravity: new Vector3(0, -.5, 0), color1: new Color4(1, 1, 1, .8), color2: new Color4(.8, .9, 1, .5),
    colorDead: new Color4(1, 1, 1, 0), blendMode: ParticleSystem.BLENDMODE_ADD, emitRate: 0,
    minAngularSpeed: -1, maxAngularSpeed: 1 });
  ps.start();
  return ps;
}
