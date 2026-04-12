import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const gatewayOrigin = process.env.PLUGIN_DEV_GATEWAY_ORIGIN;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost_action_palette",
      filename: "remoteEntry.js",
      ...(gatewayOrigin
        ? { publicPath: `${gatewayOrigin}/ghost_action_palette/` }
        : {}),
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
    port: 4179,
    strictPort: true,
    cors: true,
  },
});
