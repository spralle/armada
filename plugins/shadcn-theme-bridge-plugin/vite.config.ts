import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const SHADCN_BRIDGE_DEV_PORT = 4177;
const SHADCN_BRIDGE_DEV_ORIGIN = `http://127.0.0.1:${SHADCN_BRIDGE_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.shadcn.theme-bridge",
      filename: "remoteEntry.js",
      publicPath: `${SHADCN_BRIDGE_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
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
    port: SHADCN_BRIDGE_DEV_PORT,
    origin: SHADCN_BRIDGE_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
