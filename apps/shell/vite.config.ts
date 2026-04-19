import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;
const PLUGIN_CONTRACTS_SOURCE = fileURLToPath(
  new URL("../../packages/plugin-contracts/src/index.ts", import.meta.url),
);
const UI_SOURCE = fileURLToPath(
  new URL("../../packages/ui/src/index.ts", import.meta.url),
);
const UI_SRC_ROOT = fileURLToPath(
  new URL("../../packages/ui/src", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ghost/plugin-contracts": PLUGIN_CONTRACTS_SOURCE,
      "@ghost/ui": UI_SOURCE,
      // Mirror the UI package's tsconfig path mapping so that its internal
      // `@/lib/utils` imports resolve when the shell consumes raw source.
      "@/": `${UI_SRC_ROOT}/`,
    },
  },
  server: {
    host: "127.0.0.1",
    port: SHELL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
