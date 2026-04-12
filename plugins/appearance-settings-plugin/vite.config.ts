import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const gatewayOrigin = process.env.PLUGIN_DEV_GATEWAY_ORIGIN;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.appearance-settings",
      filename: "remoteEntry.js",
      ...(gatewayOrigin
        ? { publicPath: `${gatewayOrigin}/ghost.appearance-settings/` }
        : {}),
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
    port: 4178,
    strictPort: true,
    cors: true,
  },
});
