import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const DOMAIN_UNPLANNED_ORDERS_DEV_PORT = 4173;

export default defineConfig({
  plugins: [
    federation({
      name: "com.armada.domain.unplanned-orders",
      filename: "mf-manifest.json",
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginParts": "./src/plugin-parts-expose.ts",
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
    port: DOMAIN_UNPLANNED_ORDERS_DEV_PORT,
    strictPort: true,
    cors: true,
  },
});
