import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "../../packages/ui/src") + "/",
    },
  },
  plugins: [
    tailwindcss(),
    federation({
      name: "ghost.ui",
      filename: "remoteEntry.js",
      manifest: {
        fileName: "mf-manifest.json",
      },
      exposes: {
        "./pluginContract": "./src/index.ts",
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
        react: {
          singleton: true,
          eager: true,
          requiredVersion: "^18.3.1",
        } as Record<string, unknown>,
        "react-dom": {
          singleton: true,
          eager: true,
          requiredVersion: "^18.3.1",
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
