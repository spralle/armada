import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;
const PLUGIN_CONTRACTS_SOURCE = fileURLToPath(
  new URL("../../packages/plugin-contracts/src/index.ts", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ghost-shell/plugin-contracts": PLUGIN_CONTRACTS_SOURCE,
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
