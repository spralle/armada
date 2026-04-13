import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.shadcn.theme-bridge",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
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
    port: 4177,
    strictPort: true,
    cors: true,
  },
});
