/**
 * Consejo políglota. Cuatro "voces": JS (reactividad), Python (tablas pre-calculadas en public/data/hw_luts.json),
 * Kotlin (política declarativa, ver legacy/kotlin) y C++ (kernels, ver legacy/native). Aquí las voces JS/Python/Kotlin
 * se fusionan; los kernels C++ se activan solo si existe un .wasm compilado (legacy/native/build.sh).
 * Corrección: el original multiplicaba dos veces por el presupuesto del tier (en pyVote y en entityScale).
 */
import type { DNA, Tier } from './hardware';
type Budget = { entities: number; shadows: number; post: number; pixels: number };
const DEF: Record<Tier, Budget> = {
  ultra: { entities: 1.15, shadows: 1.2, post: 1.15, pixels: 1 }, high: { entities: 1, shadows: 1, post: 1, pixels: .95 },
  medium: { entities: .72, shadows: .7, post: .65, pixels: .85 }, low: { entities: .42, shadows: .4, post: .35, pixels: .7 }, potato: { entities: .2, shadows: .15, post: .15, pixels: .55 } };
export interface Decision { quality: number; entityScale: number; shadowScale: number; postScale: number; pixelScale: number; reason: string }
export class Council {
  luts: any = null; dna!: DNA; private over = 0; private last = 0; log: Decision[] = [];
  async load(url: string, dna: DNA) { this.dna = dna; try { const r = await fetch(url); if (r.ok) this.luts = await r.json(); } catch { /* usa tablas por defecto */ } return this; }
  private budget(): Budget { return { ...(DEF[this.dna.tier] ?? DEF.medium), ...(this.luts?.tier_budget?.[this.dna.tier] ?? {}) }; }
  private curve<T extends { score: number }>(arr: T[] | undefined, key: keyof T, def: number) {
    if (!arr?.length) return def; const s = this.dna.score; let lo = arr[0];
    for (const p of arr) { if (p.score <= s) lo = p; else { const span = p.score - lo.score || 1, t = (s - lo.score) / span; return (lo[key] as number) + ((p[key] as number) - (lo[key] as number)) * t; } }
    return lo[key] as number;
  }
  aggressiveness() { return this.curve(this.luts?.aggressiveness_curve, 'aggressiveness' as never, 1.0); }
  /** Presupuesto de árboles recomendado por la tabla de Python (o por el perfil si no hay tabla). */
  treeBudget() { const t = this.dna.platform.isMobile ? this.luts?.tree_budget_mobile : this.luts?.tree_budget_desktop; return Math.round(this.curve(t, 'trees' as never, this.dna.rec.trees)); }
  maxCascades() { return this.luts?.max_cascades_by_tier?.[this.dna.tier] ?? (this.dna.score > 65 ? 4 : this.dna.score > 40 ? 3 : 2); }
  gust(t: number) { const g: number[] | undefined = this.luts?.wind_gust_curve; if (!g?.length) return .5 + .3 * Math.sin(t * .4) * Math.sin(t * .13); const x = (t * .25) % g.length, i = Math.floor(x), f = x - i; return g[i] + (g[(i + 1) % g.length] - g[i]) * f; }
  decide(base: number, load: number): Decision {
    const now = performance.now(), dt = this.last ? Math.min(.5, (now - this.last) / 1000) : 0; this.last = now;
    this.over = load > .85 ? Math.min(12, this.over + dt) : Math.max(0, this.over - dt * 1.5);
    const b = this.budget(), agg = this.aggressiveness();
    const py = base * b.entities * (1 - load * .35), js = base * (1 - load * .25 * agg);
    const thermal = this.dna.platform.isMobile ? 1 - Math.min(12, this.over) / 12 * .45 : 1;       // política Kotlin
    let fused = (js + py) * .5; if (this.dna.platform.isMobile) fused *= .88; if (this.dna.tier === 'potato' || this.dna.tier === 'low') fused *= .75;
    fused = Math.max(.12, Math.min(1.2, fused)) * thermal;
    const d: Decision = { quality: fused, entityScale: fused, shadowScale: b.shadows, postScale: b.post, pixelScale: b.pixels,
      reason: `JS=${js.toFixed(2)} PY=${py.toFixed(2)} KT→${fused.toFixed(2)} térmico×${thermal.toFixed(2)} [${this.dna.tier}]` };
    this.log.push(d); if (this.log.length > 30) this.log.shift(); return d;
  }
}
