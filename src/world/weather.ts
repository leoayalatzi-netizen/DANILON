type RGB = [number, number, number];
export interface Preset {
  label: string; top: RGB; hor: RGB; sunCol: RGB; sunElev: number; sunInt: number;
  hemiSky: RGB; hemiGnd: RGB; hemiInt: number; fog: number; fogCol: RGB;
  stars: number; rain: number; snow: number; exposure: number; bloom: number; rays: number;
}
export const PRESETS: Record<string, Preset> = {
  amanecer: { label: "Amanecer", top: [.10,.12,.36], hor: [.95,.60,.62], sunCol: [1,.78,.62], sunElev: 6, sunInt: 2.6,
    hemiSky: [.38,.38,.85], hemiGnd: [.30,.20,.50], hemiInt: .9, fog: .0022, fogCol: [.46,.40,.72], stars: .8, rain: 0, snow: 450, exposure: 1.15, bloom: .32, rays: .35 },
  atardecer: { label: "Atardecer", top: [.07,.08,.18], hor: [1,.48,.14], sunCol: [1,.50,.15], sunElev: 4, sunInt: 2.8,
    hemiSky: [.45,.28,.22], hemiGnd: [.12,.07,.05], hemiInt: .7, fog: .003, fogCol: [.62,.34,.16], stars: .6, rain: 0, snow: 350, exposure: 1.1, bloom: .38, rays: .45 },
  lluvia: { label: "Lluvia", top: [.02,.04,.10], hor: [.10,.15,.28], sunCol: [.5,.62,.95], sunElev: 28, sunInt: .55,
    hemiSky: [.20,.28,.52], hemiGnd: [.06,.08,.14], hemiInt: .8, fog: .006, fogCol: [.08,.12,.22], stars: .15, rain: 9000, snow: 0, exposure: 1.0, bloom: .2, rays: 0 },
  niebla: { label: "Niebla", top: [.42,.44,.58], hor: [.62,.63,.78], sunCol: [.82,.82,.96], sunElev: 30, sunInt: .9,
    hemiSky: [.62,.62,.78], hemiGnd: [.35,.35,.48], hemiInt: 1, fog: .017, fogCol: [.55,.56,.68], stars: 0, rain: 0, snow: 900, exposure: 1.05, bloom: .22, rays: .1 },
};
function mix(a: any, b: any, t: number): any {
  if (typeof a === "number") return a + (b - a) * t;
  if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], t));
  if (typeof a === "object") { const o: any = {}; for (const k in a) o[k] = mix(a[k], b[k], t); return o; }
  return b;
}
export class Weather {
  cur: Preset = structuredClone(PRESETS.amanecer);
  private from = this.cur; private to = this.cur; private t = 1;
  set(name: string) { this.from = structuredClone(this.cur); this.to = PRESETS[name]; this.t = 0; }
  update(dt: number) {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / 3);
    const e = this.t * this.t * (3 - 2 * this.t);
    this.cur = mix(this.from, this.to, e);
  }
}
