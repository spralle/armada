import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const THEME_DEFAULT_DEV_PORT = 4176;
const THEME_DEFAULT_DEV_ORIGIN = `http://127.0.0.1:${THEME_DEFAULT_DEV_PORT}`;

export default defineConfig({
  plugins: [
    federation({
      name: "ghost.theme.default",
      filename: "remoteEntry.js",
      publicPath: `${THEME_DEFAULT_DEV_ORIGIN}/`,
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/plugin-contract-expose.ts",
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
    port: THEME_DEFAULT_DEV_PORT,
    origin: THEME_DEFAULT_DEV_ORIGIN,
    strictPort: true,
    cors: true,
  },
});
