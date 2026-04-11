import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const SHARED_UI_CAPABILITY_PLUGIN_DEV_PORT = 4175;
const SHARED_UI_CAPABILITY_PLUGIN_DEV_ORIGIN = `http://127.0.0.1:${SHARED_UI_CAPABILITY_PLUGIN_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.shared.ui-capabilities",
      filename: "remoteEntry.js",
      publicPath: `${SHARED_UI_CAPABILITY_PLUGIN_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginComponents": "./src/plugin-components.ts",
        "./pluginServices": "./src/plugin-services.ts",
        "./pluginParts": "./src/plugin-parts.ts",
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
    port: SHARED_UI_CAPABILITY_PLUGIN_DEV_PORT,
    origin: SHARED_UI_CAPABILITY_PLUGIN_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
