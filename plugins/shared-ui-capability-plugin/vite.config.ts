import { fileURLToPath } from "node:url";
import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const UI_SOURCE = fileURLToPath(
  new URL("../../packages/ui/src/index.ts", import.meta.url),
);
const UI_SRC_ROOT = fileURLToPath(
  new URL("../../packages/ui/src", import.meta.url),
);

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.shared.ui-capabilities",
      filename: "remoteEntry.js",
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
        "react": {
          singleton: true,
          requiredVersion: "^18.3.1",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^18.3.1",
        },
        "react-dom/client": {
          singleton: true,
          requiredVersion: "^18.3.1",
        },
        "@ghost/ui": {
          singleton: true,
          requiredVersion: "^0.0.0",
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@ghost/ui": UI_SOURCE,
      "@/": `${UI_SRC_ROOT}/`,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    cors: true,
  },
});
