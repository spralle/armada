import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const SAMPLE_PLUGIN_DEV_PORT = 4172;
const SAMPLE_PLUGIN_DEV_ORIGIN = `http://127.0.0.1:${SAMPLE_PLUGIN_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.sample.contract-consumer",
      filename: "remoteEntry.js",
      publicPath: `${SAMPLE_PLUGIN_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts-expose.ts",
        "./pluginComponents": "./src/plugin-components-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
      },
      shared: {
        "@ghost/plugin-contracts": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: SAMPLE_PLUGIN_DEV_PORT,
    origin: SAMPLE_PLUGIN_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
