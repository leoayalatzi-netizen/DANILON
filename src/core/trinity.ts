/**
 * Trinity — núcleo neuronal de PriomGL (port a TypeScript del TrinityNeuralCore original).
 * Tres redes densas pequeñas (World / Optimizer / Meta) con aprendizaje en línea y una memoria
 * episódica hiperesférica (LSH). Correcciones respecto al original:
 *  - protección NaN/Inf: una telemetría corrupta ya no envenena los pesos para siempre;
 *  - la salida "neuralPressure" del original nunca se leía; ahora se expone como `headroom`
 *    (predicción de holgura de FPS) y el Gobernador sí la usa.
 */
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const finite = (x: number) => (Number.isFinite(x) ? x : 0);

export class DenseNet {
  W: Float32Array[] = []; b: Float32Array[] = []; state: Float32Array; lastLoss = 0; step = 0;
  constructor(public name: string, public sizes: number[], seed: number, public o: { lr?: number; decay?: number; clip?: number } = {}) {
    let s = seed >>> 0; const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
    for (let l = 0; l < sizes.length - 1; l++) {
      const fi = sizes[l], fo = sizes[l + 1], sc = Math.sqrt(6 / (fi + fo)), w = new Float32Array(fi * fo);
      for (let i = 0; i < w.length; i++) w[i] = (rnd() * 2 - 1) * sc;
      this.W.push(w); this.b.push(new Float32Array(fo));
    }
    this.state = new Float32Array(sizes[sizes.length - 1]);
  }
  private get lr() { return this.o.lr ?? .002; }
  private get decay() { return this.o.decay ?? 1e-5; }
  private get clip() { return this.o.clip ?? 1; }
  private layers(input: ArrayLike<number>) {
    const acts: Float32Array[] = [Float32Array.from(input, finite)];
    for (let l = 0; l < this.W.length; l++) {
      const ni = this.sizes[l], no = this.sizes[l + 1], w = this.W[l], b = this.b[l], prev = acts[l], out = new Float32Array(no), last = l === this.W.length - 1;
      for (let j = 0; j < no; j++) { let z = b[j]; for (let i = 0; i < ni; i++) z += prev[i] * w[i * no + j]; out[j] = last ? z : Math.tanh(z); }
      acts.push(out);
    }
    return acts;
  }
  forward(input: ArrayLike<number>) { const a = this.layers(input); return a[a.length - 1]; }
  recurrent(input: ArrayLike<number>, leak = .86) {
    const y = this.forward(input);
    for (let i = 0; i < this.state.length; i++) this.state[i] = this.state[i] * leak + finite(y[i]) * (1 - leak);
    return this.state;
  }
  train(input: ArrayLike<number>, target: ArrayLike<number>) {
    const acts = this.layers(input), L = this.W.length, out = acts[L], delta: Float32Array[] = new Array(L);
    let loss = 0; delta[L - 1] = new Float32Array(out.length);
    for (let j = 0; j < out.length; j++) { const e = out[j] - finite(target[j] ?? 0); loss += e * e; delta[L - 1][j] = clamp(e, -this.clip, this.clip); }
    for (let l = L - 2; l >= 0; l--) {
      const no = this.sizes[l + 1], nn = this.sizes[l + 2], d = new Float32Array(no);
      for (let j = 0; j < no; j++) { let v = 0; for (let k = 0; k < nn; k++) v += this.W[l + 1][j * nn + k] * delta[l + 1][k]; const a = acts[l + 1][j]; d[j] = v * (1 - a * a); }
      delta[l] = d;
    }
    for (let l = 0; l < L; l++) {
      const ni = this.sizes[l], no = this.sizes[l + 1], prev = acts[l], d = delta[l], w = this.W[l], b = this.b[l];
      for (let j = 0; j < no; j++) { b[j] -= this.lr * d[j]; for (let i = 0; i < ni; i++) w[i * no + j] -= this.lr * (d[j] * prev[i] + this.decay * w[i * no + j]); }
    }
    this.step++; this.lastLoss = loss / out.length;
    if (!Number.isFinite(this.lastLoss)) this.reset();
    return this.lastLoss;
  }
  /** Último recurso si los pesos se corrompen: reinicia y sigue (el motor nunca depende de la red para ser seguro). */
  reset() { for (let l = 0; l < this.W.length; l++) { const sc = Math.sqrt(6 / (this.sizes[l] + this.sizes[l + 1])); for (let i = 0; i < this.W[l].length; i++) this.W[l][i] = (Math.random() * 2 - 1) * sc; this.b[l].fill(0); } this.state.fill(0); this.lastLoss = 0; }
}

/** Memoria episódica por similitud coseno con LSH (hiperplanos aleatorios). */
export class HyperSphere {
  private planes: Float32Array[][] = []; private tables: Map<number, number[]>[] = []; private vecs = new Map<number, Float32Array>();
  constructor(public dim: number, private bits = 9, private nTables = 5, seed = 0x77AA) {
    let s = seed >>> 0; const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
    for (let t = 0; t < nTables; t++) { this.tables.push(new Map()); this.planes.push(Array.from({ length: bits }, () => Float32Array.from({ length: dim }, rnd))); }
  }
  private norm(v: ArrayLike<number>) { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; s = Math.sqrt(s) || 1; return Float32Array.from(v, x => x / s); }
  private hash(v: Float32Array, t: number) { let c = 0; for (let b = 0; b < this.bits; b++) { let d = 0; const p = this.planes[t][b]; for (let i = 0; i < v.length; i++) d += v[i] * p[i]; if (d >= 0) c |= 1 << b; } return c; }
  insert(id: number, v: ArrayLike<number>) {
    const x = this.norm(v); this.vecs.set(id, x);
    for (let t = 0; t < this.nTables; t++) { const h = this.hash(x, t), m = this.tables[t], a = m.get(h) ?? []; a.push(id); if (a.length > 24) a.shift(); m.set(h, a); }
    if (this.vecs.size > 600) this.vecs.delete(this.vecs.keys().next().value as number);
  }
  query(v: ArrayLike<number>, k = 4): [number, number][] {
    if (!this.vecs.size) return [];
    const x = this.norm(v), cand = new Set<number>();
    for (let t = 0; t < this.nTables; t++) { const h = this.hash(x, t); for (const id of this.tables[t].get(h) ?? []) cand.add(id); for (let b = 0; b < this.bits; b += 3) for (const id of this.tables[t].get(h ^ (1 << b)) ?? []) cand.add(id); }
    const r: [number, number][] = [];
    for (const id of cand) { const y = this.vecs.get(id); if (!y) continue; let d = 0; for (let i = 0; i < x.length; i++) d += x[i] * y[i]; r.push([id, d]); }
    return r.sort((a, b) => b[1] - a[1]).slice(0, k);
  }
}

export interface Telemetry {
  frameMs: number; dayTime: number; weatherIntensity: number; load: number; quality: number; entities: number;
  wind: number; raining: boolean; drawCalls: number; triangles: number; cam: [number, number, number];
}
export interface Advice { headroom: number; confidence: number; windHint: number; weatherHint: number }

export class Trinity {
  world = new DenseNet('World', [18, 64, 64, 32, 10], 0x51A7, { lr: .0018 });
  optimizer = new DenseNet('Optimizer', [16, 56, 40, 20, 8], 0xA91C, { lr: .0022 });
  meta = new DenseNet('Meta', [22, 80, 64, 32, 10], 0xC0DE, { lr: .0012 });
  memory = new HyperSphere(18); advice: Advice = { headroom: .5, confidence: .5, windHint: .5, weatherHint: .2 };
  private t = 0; private budget = 0; private memTick = 0; private memSim = 0; private ow = new Float32Array(10); private oo = new Float32Array(8);
  private n(x: number, a: number, b: number) { return clamp((finite(x) - a) / (b - a) * 2 - 1, -1, 1); }
  tick(dt: number, s: Telemetry): Advice {
    const n = this.n.bind(this), fps = n(1000 / Math.max(1, s.frameMs || 16.7), 20, 100), day = n(s.dayTime, 0, 24), weather = clamp(s.weatherIntensity, -1, 1);
    const load = n(s.load, 0, 1), quality = n(s.quality, .1, 1.2), ent = n(s.entities, 0, 2000), wind = n(s.wind, 0, 1), rain = s.raining ? 1 : -1;
    const t = this.t, base = new Float32Array([fps, day, weather, load, quality, ent, wind, rain, Math.sin(t), Math.cos(t), Math.sin(t * .17), Math.cos(t * .17),
      n(s.drawCalls, 0, 400), n(s.triangles, 0, 2e6), n(s.cam[1], -10, 200), n(s.cam[0], -500, 500), n(s.cam[2], -500, 500), this.memSim]);
    this.ow = this.world.recurrent(base);
    this.oo = this.optimizer.recurrent(base.subarray(0, 16));
    const min = new Float32Array(22); min.set(base); min[18] = this.ow[0]; min[19] = this.ow[1]; min[20] = this.oo[0]; min[21] = this.oo[1];
    const om = this.meta.recurrent(min);
    if ((++this.memTick & 7) === 0) this.memory.insert(this.memTick, base);
    const near = this.memory.query(base, 4); this.memSim = near.length ? near[0][1] : 0;
    this.budget += dt;
    if (this.budget > .08) {
      this.budget = 0;
      this.world.train(base, [.5 + .5 * fps, Math.max(0, 1 - load), weather, quality, ent, wind, day, 1]);
      this.optimizer.train(base.subarray(0, 16), [fps, 1 - load, quality, Math.max(0, 1 - load), this.ow[0], this.ow[1]]);
      this.meta.train(min, [fps, quality, load, this.ow[0], this.oo[0], day, weather, 1]);
    }
    this.t += dt;
    this.advice = {
      headroom: clamp((finite(this.oo[0]) + 1) * .5, 0, 1),            // 1 = holgura de FPS prevista, 0 = presión
      confidence: clamp((finite(om[0]) + 1) * .5, .1, 1),
      windHint: clamp((finite(this.ow[5]) + 1) * .5, 0, 1),
      weatherHint: clamp((finite(this.ow[2]) + 1) * .5, 0, 1),
    };
    return this.advice;
  }
  diagnostics() { return { steps: this.world.step + this.optimizer.step + this.meta.step, world: this.world.lastLoss, optimizer: this.optimizer.lastLoss, meta: this.meta.lastLoss, memory: this.memSim }; }
}
