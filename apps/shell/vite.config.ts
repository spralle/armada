import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const SHELL_DEV_PORT = 5173;
const BACKEND_DEV_PORT = 8787;

export default defineConfig({
  plugins: [react()],
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
