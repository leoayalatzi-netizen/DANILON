// En Render (RENDER=true) copia dist/ a la raíz, por si el "Publish Directory" no es dist.
import { cpSync, existsSync } from "node:fs";
if (process.env.RENDER === "true" && existsSync("dist")) {
  cpSync("dist", ".", { recursive: true, force: true });
  console.log("postbuild: dist copiado a la raíz para Render");
}
