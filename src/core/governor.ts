/**
 * Gobernador de calidad — port del OptimizerAI v4 de PriomGL. Mantiene la misma lógica de
 * degradar/mejorar por capas, y suma dos correcciones:
 *  - la predicción de carga ya no degrada por sí sola cuando los FPS están sobre el objetivo;
 *  - la previsión de Trinity (`headroom`) se usa de verdad (antes `neuralPressure` no se leía en ningún sitio).
 */
import type { DNA } from './hardware';
import type { Council } from './council';
import type { Advice } from './trinity';
export interface QualityState { quality: number; shadow: number; particles: number; entities: number; pixel: number; post: number; ssao: boolean; bloom: boolean; reason: string; action: string }
const MODES: Record<string, Omit<QualityState, 'reason' | 'action'>> = {
  ultra: { quality: 1.2, shadow: 1.2, particles: 1.3, entities: 1.2, pixel: 1, post: 1.2, ssao: true, bloom: true },
  high: { quality: 1, shadow: 1, particles: 1, entities: 1, pixel: 1, post: 1, ssao: true, bloom: true },
  balanced: { quality: .8, shadow: .7, particles: .7, entities: .8, pixel: .9, post: .7, ssao: true, bloom: true },
  performance: { quality: .48, shadow: .28, particles: .28, entities: .38, pixel: .62, post: .3, ssao: false, bloom: false },
  powersaver: { quality: .22, shadow: .12, particles: .12, entities: .18, pixel: .45, post: .15, ssao: false, bloom: false },
};
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export class Governor {
  quality = 1; shadow = 1; particles = 1; entities = 1; pixel = 1; post = 1; ssao = true; bloom = true;
  readonly target: number; readonly minFPS: number; private maxQ = 1.15; private minQ = .18;
  private hist: number[] = []; private cooldown = 0; private preemptCd = 0; private stability = 1; action = 'init'; last = ''; adjustments = 0;
  constructor(private dna: DNA, private council: Council) {
    this.target = dna.rec.targetFPS; this.minFPS = dna.platform.isMobile ? 22 : 28;
    this.setMode(({ ultra: 'high', high: 'high', medium: 'balanced', low: 'performance', potato: 'powersaver' } as const)[dna.tier]);
    if (dna.tier === 'ultra') this.setMode('ultra');
  }
  setMode(m: string) { const s = MODES[m]; this.quality = s.quality; this.shadow = s.shadow; this.particles = s.particles; this.entities = s.entities; this.pixel = s.pixel; this.post = s.post; this.ssao = s.ssao; this.bloom = s.bloom; }
  private avg(n: number) { const s = this.hist.slice(-n); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : this.target; }
  get load() { return Math.max(0, 1 - this.avg(20) / this.target); }
  private predicted() {
    const r = this.hist.slice(-60); if (r.length < 20) return .4; const tr = r[r.length - 1] - r[0]; let p = .4;
    if (tr < -5) p += .2; else if (tr > 5) p -= .15; if (this.stability < .5) p += .15; else if (this.stability > .8) p -= .1; return clamp(p, 0, 1);
  }
  private degrade(a: number) {
    const la = a * 1.2; this.particles = Math.max(.08, this.particles - la * 1.7); this.shadow = Math.max(.1, this.shadow - la * 1.35); this.quality = Math.max(this.minQ, this.quality - a);
    if (this.quality < .72) this.entities = Math.max(.15, this.entities - a * 1.15);
    if (this.quality < .55) this.pixel = Math.max(.4, this.pixel - a * .55);
    if (this.quality < .7) this.post = Math.max(.12, this.post - a * 1.1);
  }
  private upgrade(a: number) {
    const la = a * .8; this.pixel = Math.min(1, this.pixel + la * .5); this.entities = Math.min(1.2, this.entities + la * .8); this.quality = Math.min(this.maxQ, this.quality + a);
    this.post = Math.min(1.2, this.post + a * .5); this.shadow = Math.min(1.2, this.shadow + a); this.particles = Math.min(1.3, this.particles + a * 1.2);
  }
  update(dt: number, fps: number, advice: Advice): QualityState {
    this.cooldown = Math.max(0, this.cooldown - dt); this.preemptCd = Math.max(0, this.preemptCd - dt); this.hist.push(fps); if (this.hist.length > 300) this.hist.shift();
    const rec = this.hist.slice(-30);
    if (rec.length > 10) { const m = rec.reduce((a, b) => a + b, 0) / rec.length, v = rec.reduce((a, b) => a + (b - m) ** 2, 0) / rec.length; this.stability = Math.max(0, 1 - Math.sqrt(v) / 30); }
    if (this.cooldown <= 0) {
      const avg = this.avg(30), ratio = avg / this.target, pred = this.predicted(), conf = advice.confidence;
      const worried = advice.headroom < .28 && conf > .45 && ratio < 1.08 && this.quality > .6 && this.preemptCd <= 0;   // Trinity prevé presión (con suelo y enfriamiento)
      const roomy = advice.headroom > .78 && conf > .45;                               // Trinity prevé holgura
      if (ratio < .28 || avg < 12) { this.setMode('powersaver'); this.action = 'degrade_emergency'; this.cooldown = .6; }
      else if (ratio < .55 || avg < this.minFPS) { this.degrade(.22); if (avg < 18) this.setMode('performance'); this.action = 'degrade_hard'; this.cooldown = 1.1; }
      else if (ratio < .78 || (ratio < 1 && pred > .58)) { this.degrade(.11); this.action = 'degrade_soft'; this.cooldown = 1; }
      else if (worried) { this.degrade(.05); this.action = 'trinity_preempt'; this.cooldown = 1.5; this.preemptCd = 5; }
      else if (ratio > (roomy ? 1.08 : 1.15) && this.quality < this.maxQ && this.stability > .72) { this.upgrade(.05); this.action = roomy ? 'upgrade_trinity' : 'upgrade'; this.cooldown = roomy ? 2.5 : 3.5; }
      else if (ratio > 1.28 && this.quality < this.maxQ) { this.upgrade(.09); this.action = 'upgrade_quick'; this.cooldown = 2; }
      else { this.action = 'stable'; const head = this.avg(10) - this.target;
        if (head > 8 && this.quality < this.maxQ) { this.quality = Math.min(this.maxQ, this.quality + .01); this.shadow = Math.min(1.2, this.shadow + .01); this.particles = Math.min(1.3, this.particles + .015); }
        else if (head < -5 && this.quality > this.minQ) { this.quality = Math.max(this.minQ, this.quality - .01); this.shadow = Math.max(.2, this.shadow - .01); this.particles = Math.max(.15, this.particles - .015); } }
      if (this.action.startsWith('degrade') || this.action.startsWith('upgrade') || this.action === 'trinity_preempt') this.adjustments++;
    }
    const d = this.council.decide(this.quality, this.load);
    this.ssao = this.dna.rec.ssao && this.quality > (this.dna.tier === 'low' ? .7 : .5) && d.postScale > .3;
    this.bloom = this.dna.rec.bloom && this.quality > .6 && d.postScale > .4;
    return { quality: this.quality, shadow: Math.min(this.shadow, d.shadowScale), particles: this.particles, entities: Math.min(this.entities, d.entityScale + .0) ,
      pixel: Math.min(this.pixel, d.pixelScale), post: Math.min(this.post, d.postScale), ssao: this.ssao, bloom: this.bloom, reason: d.reason, action: this.action };
  }
}
