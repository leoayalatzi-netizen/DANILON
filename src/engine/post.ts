import { Scene, ArcRotateCamera, Mesh, DefaultRenderingPipeline, ImageProcessingConfiguration, ColorCurves, Effect, PostProcess,
  SSAO2RenderingPipeline, VolumetricLightScatteringPostProcess, Texture } from "@babylonjs/core";
import NT_WEIGHTS from "../../legacy/python/neural_tonemap.glsl.txt?raw";

export interface PostOpts { ssao: boolean; vls: boolean; samples: number; bloom: boolean; neural: boolean }
/** Tonemap neuronal de PriomGL (MLP 1→12→12→1 entrenado offline): se evalúa por píxel sobre la luminancia. Experimental, tecla N. */
Effect.ShadersStore["neuralTonemapFragmentShader"] = `precision highp float;
varying vec2 vUV; uniform sampler2D textureSampler; uniform float on;
${NT_WEIGHTS.split("\n").filter(l => !l.trim().startsWith("//")).join("\n")}
float neuralTonemapChannel(float x){
  float xn=x*.25-1.0; float a1[12];
  for(int i=0;i<12;i++) a1[i]=tanh(xn*NT_W1[i]+NT_B1[i]);
  float a2[12];
  for(int j=0;j<12;j++){ float s=NT_B2[j]; for(int i=0;i<12;i++) s+=a1[i]*NT_W2[i*12+j]; a2[j]=tanh(s); }
  float z3=NT_B3; for(int j=0;j<12;j++) z3+=a2[j]*NT_W3[j];
  float raw=1.0/(1.0+exp(-z3));
  return clamp((raw-NT_CALIB_Y0)/(NT_CALIB_YCEIL-NT_CALIB_Y0),0.0,1.0);
}
vec3 ntMap(vec3 hdr){ float lum=dot(hdr,vec3(.2126,.7152,.0722)); float lo=neuralTonemapChannel(lum); float r=lum>.0005?lo/lum:0.0; return clamp(hdr*r,0.0,1.0); }
void main(){ vec3 c=texture2D(textureSampler,vUV).rgb; if(on>.5){ c=pow(max(c,vec3(0.0)),vec3(2.2)); c=pow(ntMap(c),vec3(1.0/2.2)); } gl_FragColor=vec4(c,1.0); }`;

export function setupPost(scene: Scene, cam: ArcRotateCamera, sun: Mesh, exclude: Mesh[], q: PostOpts) {
  const pipe = new DefaultRenderingPipeline("pipe", q.neural, scene, [cam]);   // HDR solo si el tonemap neuronal está disponible
  pipe.fxaaEnabled = q.samples <= 1; pipe.samples = q.samples;
  pipe.bloomEnabled = q.bloom; pipe.bloomThreshold = .8; pipe.bloomKernel = 64; pipe.bloomScale = .5;
  pipe.sharpenEnabled = true; pipe.sharpen.edgeAmount = .25;
  pipe.grainEnabled = q.samples > 1; pipe.grain.intensity = 5; pipe.grain.animated = true;
  const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.contrast = 1.25; ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteStretch = .4;
  ip.colorCurvesEnabled = true; const cc = new ColorCurves(); cc.globalSaturation = 18; cc.shadowsHue = 245; cc.shadowsDensity = 35; cc.shadowsSaturation = 40; ip.colorCurves = cc;
  let ssao: SSAO2RenderingPipeline | null = null, ssaoOn = false;
  if (q.ssao) try {
    ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: .5, blurRatio: 1 }, [cam]);
    ssao.radius = 4; ssao.totalStrength = .9; ssao.expensiveBlur = false; ssao.maxZ = 400; ssaoOn = true;
  } catch (e) { console.warn("SSAO no disponible", e); }
  let vls: VolumetricLightScatteringPostProcess | null = null;
  if (q.vls) {
    vls = new VolumetricLightScatteringPostProcess("rays", 1, cam, sun, 70, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine(), false);
    vls.excludedMeshes.push(...exclude); vls.decay = .96; vls.weight = .6; vls.density = .95; vls.exposure = .3;
  }
  let nt: PostProcess | null = null, ntOn = false;
  if (q.neural) try { nt = new PostProcess("nt", "neuralTonemap", ["on"], null, 1.0, cam); nt.onApply = e => e.setFloat("on", ntOn ? 1 : 0); } catch (e) { console.warn("Tonemap neuronal no disponible", e); nt = null; }
  const mgr = scene.postProcessRenderPipelineManager;
  const lastFix = () => { if (nt) { cam.detachPostProcess(nt); cam.attachPostProcess(nt); } };   // el pipeline reordena al cambiar efectos
  return {
    pipe, vls, hasNT: !!nt,
    setSSAO(on: boolean) { if (!ssao || on === ssaoOn) return; ssaoOn = on; try { on ? mgr.attachCamerasToRenderPipeline("ssao", cam) : mgr.detachCamerasFromRenderPipeline("ssao", cam); lastFix(); } catch { /* ignorar */ } },
    setBloom(on: boolean) { if (pipe.bloomEnabled !== on) { pipe.bloomEnabled = on; lastFix(); } },
    setNeural(on: boolean) { if (!nt) return false; ntOn = on; ip.toneMappingEnabled = !on; lastFix(); return on; },
    get neural() { return ntOn; },
    ntError() { return nt?.getEffect()?.getCompilationError?.() || ""; },
    killNT() { if (nt) { ntOn = false; ip.toneMappingEnabled = true; nt.dispose(cam); nt = null; } },
  };
}
