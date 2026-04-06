import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const SAMPLE_PLUGIN_DEV_PORT = 4172;

export default defineConfig({
  plugins: [
    federation({
      name: "com.armada.sample.contract-consumer",
      filename: "mf-manifest.json",
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts-expose.ts",
        "./pluginComponents": "./src/plugin-components-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
      },
      shared: {
        "@armada/plugin-contracts": {
          singleton: true,
          requiredVersion: false,
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: SAMPLE_PLUGIN_DEV_PORT,
    strictPort: true,
    cors: true,
  },
});
