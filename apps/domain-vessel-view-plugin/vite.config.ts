import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const DOMAIN_VESSEL_VIEW_DEV_PORT = 4174;
const DOMAIN_VESSEL_VIEW_DEV_ORIGIN = `http://127.0.0.1:${DOMAIN_VESSEL_VIEW_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "com.armada.domain.vessel-view",
      filename: "remoteEntry.js",
      publicPath: `${DOMAIN_VESSEL_VIEW_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts.ts",
        "./pluginComponents": "./src/plugin-components-expose.ts",
        "./pluginServices": "./src/plugin-services-expose.ts",
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
    port: DOMAIN_VESSEL_VIEW_DEV_PORT,
    origin: DOMAIN_VESSEL_VIEW_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
