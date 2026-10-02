import { CLASES, HeroClass } from "./classes";
export const d = (n: number) => 1 + Math.floor(Math.random() * n);
export interface Combatant { id: string; nombre: string; pg: number; pgMax: number; ca: number; mod: { DES: number }; equipo: "heroes" | "enemigos"; init: number; }
export const mod = (v: number) => Math.floor((v - 10) / 2);
export const desdeClase = (c: HeroClass): Combatant =>
  ({ id: c.id, nombre: c.nombre, pg: c.pg, pgMax: c.pg, ca: c.ca, mod: { DES: mod(c.stats.DES) }, equipo: "heroes", init: 0 });
export class Combate {
  orden: Combatant[]; turno = 0;
  constructor(public participantes: Combatant[]) {
    participantes.forEach(p => (p.init = d(20) + p.mod.DES));
    this.orden = [...participantes].sort((a, b) => b.init - a.init);
  }
  get actual() { return this.orden.find((_, i) => i === this.turno % this.orden.length && this.orden[i].pg > 0) ?? this.siguiente(); }
  siguiente(): Combatant { do { this.turno++; } while (this.orden[this.turno % this.orden.length].pg <= 0); return this.orden[this.turno % this.orden.length]; }
  atacar(a: Combatant, b: Combatant, bono: number, dado = 8) {
    const tirada = d(20), impacta = tirada === 20 || (tirada !== 1 && tirada + bono >= b.ca);
    const dmg = impacta ? d(dado) * (tirada === 20 ? 2 : 1) + bono : 0; b.pg = Math.max(0, b.pg - dmg);
    return { tirada, impacta, dmg };
  }
  fin() { const v = (e: string) => this.orden.some(p => p.equipo === e && p.pg > 0); return !v("heroes") ? "enemigos" : !v("enemigos") ? "heroes" : null; }
}
export const PARTY_INICIAL = CLASES.slice(0, 4).map(desdeClase);
