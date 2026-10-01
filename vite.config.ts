import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    // Register Element Plus components (and their CSS) on demand instead of
    // installing the whole library, which produced a ~1 MB chunk.
    Components({
      resolvers: [ElementPlusResolver({ importStyle: "css" })],
      // Only resolve library components; app components stay explicitly imported.
      dirs: [],
      dts: "src/components.d.ts",
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: ["llmfair.dev-serve.me"],
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: ["llmfair.dev-serve.me"],
  },
});
