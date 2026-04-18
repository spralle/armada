import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    federation({
      name: "ghost.ui",
      filename: "remoteEntry.js",
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
        "@ghost/ui": {
          singleton: true,
          // eager bundles @ghost/ui into the entry chunk so it's always available
          eager: true,
          requiredVersion: "^0.0.0",
        } as Record<string, unknown>,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 4186,
    strictPort: true,
    cors: true,
  },
});
