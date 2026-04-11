import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const ACTION_PALETTE_DEV_PORT = 4176;
const ACTION_PALETTE_DEV_ORIGIN = `http://127.0.0.1:${ACTION_PALETTE_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost_action_palette",
      filename: "remoteEntry.js",
      publicPath: `${ACTION_PALETTE_DEV_ORIGIN}/`,
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
    port: ACTION_PALETTE_DEV_PORT,
    origin: ACTION_PALETTE_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
