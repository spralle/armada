import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const PLUGIN_STARTER_DEV_PORT = 4171;

export default defineConfig({
  plugins: [
    federation({
      name: "com.armada.plugin-starter",
      filename: "mf-manifest.json",
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
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
    port: PLUGIN_STARTER_DEV_PORT,
    strictPort: true,
    cors: true,
  },
});
