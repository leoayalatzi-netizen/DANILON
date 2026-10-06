import { PriomEngine } from "../engine/PriomEngine";
import { PRESETS } from "../engine/weather";
/** Barra de clima + panel de diagnóstico de la IA (toca el título para ver/ocultar el panel). */
export function createHud(eng: PriomEngine) {
  const ui = document.getElementById("ui")!, info = document.getElementById("info")!, title = document.getElementById("t")!;
  const btn = (txt: string, key: string, fn: () => void) => { const b = document.createElement("button"); b.textContent = txt; b.dataset.k = key; b.onclick = fn; ui.appendChild(b); return b; };
  const mark = () => ui.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.classList.toggle("on", b.dataset.k === (eng.auto ? "auto" : eng.weather.name) || (b.dataset.k === "nt" && eng.post.neural)));
  Object.entries(PRESETS).forEach(([k, p], i) => btn(`${i + 1} ${p.label}`, k, () => { eng.setWeather(k); mark(); }));
  btn("Auto", "auto", () => { eng.auto = !eng.auto; mark(); });
  if (eng.hasNeural) btn("N", "nt", () => { eng.setNeural(!eng.post.neural); mark(); });
  addEventListener("keydown", e => { const k = Object.keys(PRESETS)[+e.key - 1]; if (k) { eng.setWeather(k); mark(); } if (e.key === "n" && eng.hasNeural) { eng.setNeural(!eng.post.neural); mark(); } });
  mark(); let open = false; title.style.cursor = "pointer"; title.onclick = () => { open = !open; info.style.display = open ? "block" : "none"; };
  const d = eng.dna; info.textContent = "";
  setInterval(() => {
    const q = eng.quality, tr = eng.trinity.diagnostics(), a = eng.trinity.advice;
    const head = `${d.tier.toUpperCase()} ${d.score} · ${d.gpu.family} · ${eng.fps.toFixed(0)} FPS · Q ${q.quality.toFixed(2)} · ${eng.shadowKind}`;
    info.textContent = open ? [head, `Trinity: ${tr.steps} pasos · holgura ${a.headroom.toFixed(2)} · confianza ${a.confidence.toFixed(2)} · memoria ${tr.memory.toFixed(2)}`,
      `Consejo: ${q.reason}`, `Gobernador: ${q.action} · pix ${q.pixel.toFixed(2)} · ent ${q.entities.toFixed(2)} · post ${q.post.toFixed(2)}`,
      `Mundo: ${eng.props?.stats ?? "-"} · viento ${eng.wind.toFixed(2)}`, `Bench: CPU ${d.bench.cpuMs} ms · GPU ${d.bench.gpuMs} ms · ${d.gpu.renderer.slice(0, 40)}`].join("\n") : "";
  }, 500);
}
