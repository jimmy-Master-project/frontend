import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/__tests__/*.spec.ts"],
      // Element Plus ships ESM + CSS imports that must go through Vite.
      server: { deps: { inline: ["element-plus"] } },
    },
  }),
);
