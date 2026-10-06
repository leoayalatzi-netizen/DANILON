import { PriomEngine } from "./engine/PriomEngine";
import { createHud } from "./ui/hud";
(window as any).__ok = true;
const boot = document.getElementById("boot")!, eng = new PriomEngine();
eng.onStage = s => { boot.textContent = `PriomGL Quantum · ${s}…`; };
eng.start(document.getElementById("c") as HTMLCanvasElement, import.meta.env.BASE_URL)
  .then(() => { createHud(eng); boot.remove(); document.getElementById("err")?.remove(); })
  .catch(e => { console.error(e); const d = document.createElement("pre"); d.id = "err"; d.style.cssText = "position:fixed;top:100px;left:12px;right:12px;margin:0;padding:12px;background:rgba(120,0,20,.9);color:#fff;font:12px monospace;white-space:pre-wrap;border-radius:8px;z-index:9"; d.textContent = `[${eng.stage}] ${e?.message ?? e}`; document.body.appendChild(d); });
