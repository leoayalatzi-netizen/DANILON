/** Hardware DNA — perfilado de dispositivo (port de HardwareProfiler.js con micro-benchmark real de GPU+CPU). */
export type Tier = 'ultra' | 'high' | 'medium' | 'low' | 'potato';
export interface DNA {
  tier: Tier; score: number; platform: { isMobile: boolean; isIOS: boolean; isAndroid: boolean };
  gpu: { renderer: string; vendor: string; family: string }; caps: { webgl: number; maxTex: number; maxAniso: number };
  memoryGB: number; cores: number; bench: { cpuMs: number; gpuMs: number; composite: number; ms: number };
  rec: { pixelRatio: number; shadowSize: number; ssao: boolean; bloom: boolean; entityScale: number; trees: number; targetFPS: number; neuralTonemap: boolean };
}
export function classifyGPU(renderer: string, vendor: string) {
  const r = (renderer || '').toLowerCase(), v = (vendor || '').toLowerCase();
  if (/adreno/.test(r)) return /7[3-9]0|8\d{2}/.test(r) ? 'mobile-high' : /6\d{2}|5[4-9]0/.test(r) ? 'mobile-mid' : 'mobile-low';
  if (/mali/.test(r)) return /g7[1-9]|g78|g710|g610/.test(r) ? 'mobile-high' : /g5[2-7]|g68/.test(r) ? 'mobile-mid' : 'mobile-low';
  if (/apple\s*gpu|a1[5-9]|a2\d|m[1-3]/.test(r)) return 'mobile-high';
  if (/powervr|sgx/.test(r)) return 'mobile-low';
  if (/swiftshader|llvmpipe|software/.test(r)) return 'software';
  if (/nvidia|geforce|rtx|gtx|quadro/.test(r) || /nvidia/.test(v)) return /rtx\s*4\d|rtx\s*3\d|rtx\s*20/.test(r) ? 'desktop-ultra' : /gtx\s*16|gtx\s*10|rtx/.test(r) ? 'desktop-high' : 'desktop-mid';
  if (/amd|radeon|rx\s*[5-7]|vega/.test(r) || /ati|amd/.test(v)) return /rx\s*6|rx\s*7|rx\s*680|rx\s*790/.test(r) ? 'desktop-ultra' : 'desktop-high';
  if (/intel.*uhd|intel.*iris|intel.*hd/.test(r)) return 'desktop-low';
  return 'unknown';
}
function benchmark(gl: WebGL2RenderingContext | null) {
  const t0 = performance.now(); let acc = 0; for (let i = 0; i < 1.2e6; i++) acc += Math.sin(i * .001) * Math.sqrt(i + 1); if (acc === 12345.678) console.log(acc);
  const cpuMs = performance.now() - t0; let gpuMs = 40;
  if (gl) try {
    const mk = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}'));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision mediump float;out vec4 o;void main(){float a=gl_FragCoord.x*.01;for(int i=0;i<48;i++)a=sin(a*1.3+float(i))*cos(a+.7);o=vec4(a);}'));
    gl.linkProgram(p); gl.useProgram(p);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.viewport(0, 0, 512, 512);
    const px = new Uint8Array(4), t1 = performance.now(); for (let i = 0; i < 10; i++) gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gpuMs = (performance.now() - t1) / 10;
  } catch { /* se queda con el valor pesimista */ }
  const composite = Math.max(0, 100 - gpuMs * 8) * .65 + Math.max(0, 100 - cpuMs * 1.2) * .35;
  return { cpuMs: +cpuMs.toFixed(1), gpuMs: +gpuMs.toFixed(2), composite: +composite.toFixed(1) };
}
export function profileHardware(): DNA {
  const t0 = performance.now(), ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua), isAndroid = /Android/i.test(ua), isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || matchMedia('(pointer:coarse)').matches;
  let renderer = '', vendor = '', webgl = 0, maxTex = 0, maxAniso = 1, gl: WebGL2RenderingContext | null = null;
  try {
    const c = document.createElement('canvas'); gl = c.getContext('webgl2') as WebGL2RenderingContext | null; webgl = gl ? 2 : 0;
    const g: any = gl || c.getContext('webgl'); if (g && !gl) webgl = 1;
    if (g) { const ext = g.getExtension('WEBGL_debug_renderer_info'); renderer = String(ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)); vendor = String(ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR));
      maxTex = g.getParameter(g.MAX_TEXTURE_SIZE); const an = g.getExtension('EXT_texture_filter_anisotropic'); maxAniso = an ? g.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1; }
  } catch { /* sin WebGL */ }
  const family = classifyGPU(renderer, vendor), bench = benchmark(gl), memoryGB = (navigator as any).deviceMemory ?? (isMobile ? 4 : 8), cores = navigator.hardwareConcurrency ?? 4;
  let score = 50;
  score += ({ 'desktop-ultra': 35, 'desktop-high': 25, 'desktop-mid': 12, 'desktop-low': -5, 'mobile-high': 15, 'mobile-mid': 5, 'mobile-low': -15, software: -40 } as Record<string, number>)[family] ?? 0;
  score = score * .45 + bench.composite * .55;
  score += memoryGB >= 8 ? 8 : memoryGB <= 2 ? -12 : 0; score += cores >= 8 ? 6 : cores <= 2 ? -8 : 0;
  if (isMobile) score -= 10; if (webgl >= 2) score += 5; if (maxTex >= 8192) score += 3;
  score = Math.max(5, Math.min(98, Math.round(score)));
  const tier: Tier = score >= 78 ? 'ultra' : score >= 62 ? 'high' : score >= 42 ? 'medium' : score >= 25 ? 'low' : 'potato';
  const rec = {
    pixelRatio: isMobile ? (score > 55 ? 1.25 : score > 35 ? 1.0 : .75) : (score > 70 ? 1.75 : score > 50 ? 1.4 : 1.1),
    shadowSize: score > 70 ? 2048 : score > 45 ? 1024 : 512, ssao: !isMobile && score > 48, bloom: score > 40,
    entityScale: score > 70 ? 1 : score > 50 ? .75 : score > 30 ? .45 : .22,
    trees: isMobile ? (score > 50 ? 480 : score > 30 ? 280 : 140) : (score > 65 ? 1600 : score > 45 ? 900 : 450),
    targetFPS: isMobile ? (score > 45 ? 40 : 30) : (score > 60 ? 55 : 45), neuralTonemap: !isMobile && webgl >= 2 && score >= 62,
  };
  return { tier, score, platform: { isMobile, isIOS, isAndroid }, gpu: { renderer, vendor, family }, caps: { webgl, maxTex, maxAniso }, memoryGB, cores, bench: { ...bench, ms: +(performance.now() - t0).toFixed(1) }, rec };
}
