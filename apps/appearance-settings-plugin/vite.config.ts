import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const APPEARANCE_SETTINGS_DEV_PORT = 4178;
const APPEARANCE_SETTINGS_DEV_ORIGIN = `http://127.0.0.1:${APPEARANCE_SETTINGS_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.appearance-settings",
      filename: "remoteEntry.js",
      publicPath: `${APPEARANCE_SETTINGS_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
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
    port: APPEARANCE_SETTINGS_DEV_PORT,
    origin: APPEARANCE_SETTINGS_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
