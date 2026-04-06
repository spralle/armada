import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const SHARED_UI_CAPABILITY_PLUGIN_DEV_PORT = 4175;

export default defineConfig({
  plugins: [
    federation({
      name: "com.armada.shared.ui-capabilities",
      filename: "mf-manifest.json",
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginComponents": "./src/plugin-components.ts",
        "./pluginServices": "./src/plugin-services.ts",
        "./pluginParts": "./src/plugin-parts.ts",
      },
      shared: {
        "@armada/plugin-contracts": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: SHARED_UI_CAPABILITY_PLUGIN_DEV_PORT,
    strictPort: true,
    cors: true,
  },
});
