import { Scene, ArcRotateCamera, Mesh, DefaultRenderingPipeline, ImageProcessingConfiguration, ColorCurves,
  SSAO2RenderingPipeline, VolumetricLightScatteringPostProcess, Texture } from "@babylonjs/core";
export interface Quality { ssao: boolean; vls: boolean; samples: number; bloom: boolean }
export function setupPost(scene: Scene, cam: ArcRotateCamera, sun: Mesh, exclude: Mesh[], q: Quality) {
  const pipe = new DefaultRenderingPipeline("pipe", false, scene, [cam]);
  pipe.fxaaEnabled = q.samples <= 1; pipe.samples = q.samples;
  pipe.bloomEnabled = q.bloom; pipe.bloomThreshold = .8; pipe.bloomKernel = 64; pipe.bloomScale = .5;
  pipe.grainEnabled = q.samples > 1; pipe.grain.intensity = 5; pipe.grain.animated = true;
  const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.contrast = 1.25; ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteStretch = .4;
  ip.colorCurvesEnabled = true; const cc = new ColorCurves(); cc.globalSaturation = 18; cc.shadowsHue = 245; cc.shadowsDensity = 35; cc.shadowsSaturation = 40; ip.colorCurves = cc;
  if (q.ssao) try {
    const ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: .5, blurRatio: 1 }, [cam]);
    ssao.radius = 4; ssao.totalStrength = .9; ssao.expensiveBlur = false; ssao.maxZ = 400;
  } catch (e) { console.warn("SSAO no disponible", e); }
  let vls: VolumetricLightScatteringPostProcess | null = null;
  if (q.vls) {
    vls = new VolumetricLightScatteringPostProcess("rays", 1, cam, sun, 70, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine(), false);
    vls.excludedMeshes.push(...exclude); vls.decay = .96; vls.weight = .6; vls.density = .95; vls.exposure = .3;
  }
  return { pipe, vls };
}
