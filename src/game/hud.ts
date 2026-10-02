import { CLASES } from "./classes";
import { Combate, Combatant, desdeClase } from "./combat";
/** HUD de grupo + combate por turnos (un toque = un turno). onAct(id) anima al actor. */
export function createHud(onAct: (id: string) => void) {
  const root = document.createElement("div"); root.id = "hud";
  root.innerHTML = '<div id="party"></div><div id="log"></div><button id="fight">⚔ Combate</button>';
  document.body.appendChild(root);
  const party = root.querySelector("#party") as HTMLElement, log = root.querySelector("#log") as HTMLElement, btn = root.querySelector("#fight") as HTMLButtonElement;
  const mk = () => ({ id: "wyrm", nombre: "Wyrm de Escarcha", pg: 90, pgMax: 90, ca: 15, mod: { DES: 1 }, equipo: "enemigos", init: 0 } as Combatant);
  let heroes = CLASES.slice(0, 4).map(desdeClase), boss = mk(), c: Combate | null = null; const lines: string[] = [];
  const say = (t: string) => { lines.push(t); while (lines.length > 5) lines.shift(); log.innerHTML = lines.join("<br>"); };
  const draw = () => { party.innerHTML = [...heroes, boss].map(p => `<div class="card ${p.equipo}${p.pg <= 0 ? " dead" : ""}"><b>${p.nombre}</b><i style="width:${100 * p.pg / p.pgMax}%"></i><span>${p.pg}/${p.pgMax}</span></div>`).join(""); };
  btn.onclick = () => {
    if (!c) { heroes = CLASES.slice(0, 4).map(desdeClase); boss = mk(); c = new Combate([...heroes, boss]); lines.length = 0; say("¡Un Wyrm de Escarcha ataca!"); btn.textContent = "⚔ Siguiente turno"; draw(); return; }
    const a = c.actual, foes = c.orden.filter(p => p.equipo !== a.equipo && p.pg > 0), b = foes[Math.floor(Math.random() * foes.length)];
    const r = c.atacar(a, b, a.equipo === "heroes" ? 5 : 7, a.equipo === "heroes" ? 8 : 12);
    say(`${a.nombre} → ${b.nombre}: d20=${r.tirada} ${r.impacta ? "−" + r.dmg + " PG" : "falla"}`); onAct(a.id);
    const fin = c.fin();
    if (fin) { say(fin === "heroes" ? "🏆 ¡Victoria!" : "💀 Derrota"); c = null; btn.textContent = "⚔ Nuevo combate"; } else c.siguiente();
    draw();
  };
  draw();
}
