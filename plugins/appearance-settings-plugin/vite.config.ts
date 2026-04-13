import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.appearance-settings",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts.ts",
      },
      shared: {
        "@ghost-shell/plugin-contracts": {
          singleton: true,
          requiredVersion: "^0.1.0",
        },
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
    cors: true,
  },
});
