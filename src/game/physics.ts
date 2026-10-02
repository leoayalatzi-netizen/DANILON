import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin, Scene, Vector3 } from "@babylonjs/core";
/** Activar cuando haya personajes/colisiones: await enablePhysics(scene) en main.ts */
export async function enablePhysics(scene: Scene) {
  const hk = await HavokPhysics();
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, hk));
}
