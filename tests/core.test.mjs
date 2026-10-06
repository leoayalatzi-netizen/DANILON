// Pruebas del núcleo de IA (sin navegador). Requiere Node >= 22.13:  npm test
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), tmp = mkdtempSync(join(tmpdir(), 'priom-'));
const load = async n => { const o = join(tmp, n + '.mjs'); writeFileSync(o, stripTypeScriptTypes(readFileSync(join(root, 'src/core', n + '.ts'), 'utf8'), { mode: 'transform' })); return import(o); };
const { Trinity } = await load('trinity'), { Council } = await load('council'), { Governor } = await load('governor'), { classifyGPU } = await load('hardware');
const luts = JSON.parse(readFileSync(join(root, 'public/data/hw_luts.json'), 'utf8'));
const dnaOf = (tier, score, mobile) => ({ tier, score, platform: { isMobile: mobile }, rec: { targetFPS: mobile ? 40 : 55, trees: 900, ssao: !mobile, bloom: true } });
let n = 0; const ok = (name, fn) => { fn(); console.log('  ✓', name); n++; };

await (async () => {
  ok('clasificación de GPU', () => { assert.equal(classifyGPU('Adreno (TM) 740', ''), 'mobile-high'); assert.equal(classifyGPU('NVIDIA GeForce RTX 4070', ''), 'desktop-ultra'); assert.equal(classifyGPU('SwiftShader', ''), 'software'); });
  ok('Trinity: aprende y resiste NaN/Infinity en la telemetría', () => {
    const T = new Trinity();
    for (let i = 0; i < 3000; i++) { const fps = 60 + 20 * Math.sin(i * .01);
      const a = T.tick(1 / 60, { frameMs: 1000 / fps, dayTime: (i / 100) % 24, weatherIntensity: Math.sin(i * .003), load: Math.max(0, 1 - fps / 60), quality: 1, entities: i % 300, wind: .5, raining: i % 900 > 450, drawCalls: i === 1500 ? NaN : 80, triangles: i === 1501 ? Infinity : 4e5, cam: [10, 30, 10] });
      for (const v of Object.values(a)) assert.ok(Number.isFinite(v)); }
    const d = T.diagnostics(); assert.ok(d.steps > 1500); assert.ok(d.world < .05 && d.optimizer < .05 && d.meta < .05);
  });
  ok('Consejo: sin doble multiplicación del tier y con tablas de Python', () => {
    const c = new Council(); c.dna = dnaOf('medium', 50, true); c.luts = luts; const d = c.decide(1, .2);
    assert.equal(d.entityScale, d.quality); assert.ok(c.treeBudget() >= 140 && c.treeBudget() <= 1600); assert.ok(c.maxCascades() >= 1);
    for (let t = 0; t < 40; t += .7) { const g = c.gust(t); assert.ok(g >= 0 && g <= 1.001); }
  });
  ok('Gobernador: degrada con FPS bajos y se recupera', () => {
    const dna = dnaOf('high', 70, false), c = new Council(); c.dna = dna; c.luts = luts; const G = new Governor(dna, c), a = { headroom: .5, confidence: .5 }; let q;
    for (let i = 0; i < 480; i++) q = G.update(1 / 60, 60, a); const q0 = q.quality;
    for (let i = 0; i < 480; i++) q = G.update(1 / 60, 20, a); assert.ok(q.quality < q0 - .3, 'debe degradar'); const low = q.quality;
    for (let i = 0; i < 1800; i++) q = G.update(1 / 60, 90, a); assert.ok(q.quality > low, 'debe recuperar');
  });
  ok('Gobernador: no degrada de más cuando Trinity pide cautela (suelo y enfriamiento)', () => {
    const dna = dnaOf('high', 70, false), c = new Council(); c.dna = dna; c.luts = luts; const G = new Governor(dna, c); let q;
    for (let i = 0; i < 1200; i++) q = G.update(1 / 60, 58, { headroom: .1, confidence: .9 }); assert.ok(q.quality > .55, 'el suelo de calidad debe respetarse');
  });
})();
console.log(`\n${n} pruebas OK`);
