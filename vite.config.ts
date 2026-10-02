import { defineConfig } from "vite";
export default defineConfig({ build: { chunkSizeWarningLimit: 4000 }, optimizeDeps: { exclude: ["@babylonjs/havok"] } });
