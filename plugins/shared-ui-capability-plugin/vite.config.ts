import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const gatewayOrigin = process.env.PLUGIN_DEV_GATEWAY_ORIGIN;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.shared.ui-capabilities",
      filename: "remoteEntry.js",
      ...(gatewayOrigin
        ? { publicPath: `${gatewayOrigin}/ghost.shared.ui-capabilities/` }
        : {}),
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
        "./pluginComponents": "./src/plugin-components.ts",
        "./pluginServices": "./src/plugin-services.ts",
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
    port: 4175,
    strictPort: true,
    cors: true,
  },
});
