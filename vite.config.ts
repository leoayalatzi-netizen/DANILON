import { defineConfig } from "vite";
export default defineConfig({ base: "./", build: { chunkSizeWarningLimit: 6000 }, optimizeDeps: { exclude: ["@babylonjs/havok"] } });
