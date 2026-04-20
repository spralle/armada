import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@ghost/formr-core": resolve("../../packages/formr-core/src/index.ts"),
      "@ghost/formr-from-schema": resolve("../../packages/formr-from-schema/src/index.ts"),
      "@ghost/formr-react": resolve("../../packages/formr-react/src/index.ts"),
      "@ghost/ui": resolve("../../packages/ui/src/index.ts"),
      "@ghost/plugin-contracts": resolve("../../packages/plugin-contracts/src/index.ts"),
      "@ghost/predicate": resolve("../../packages/predicate/src/index.ts"),
      "@ghost/arbiter": resolve("../../packages/arbiter/src/index.ts"),
      "@/": resolve("../../packages/ui/src") + "/",
    },
  },
  server: { port: 5174, host: "127.0.0.1" },
});
