import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const resolve = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@ghost\/formr-core$/, replacement: resolve("../../packages/formr-core/src/index.ts") },
      { find: /^@ghost\/formr-from-schema$/, replacement: resolve("../../packages/formr-from-schema/src/index.ts") },
      { find: /^@ghost\/formr-react$/, replacement: resolve("../../packages/formr-react/src/index.ts") },
      { find: /^@ghost\/ui$/, replacement: resolve("../../packages/ui/src/index.ts") },
      { find: /^@ghost\/plugin-contracts$/, replacement: resolve("../../packages/plugin-contracts/src/index.ts") },
      { find: /^@ghost\/predicate$/, replacement: resolve("../../packages/predicate/src/index.ts") },
      { find: /^@ghost\/arbiter$/, replacement: resolve("../../packages/arbiter/src/index.ts") },
      { find: /^@\//, replacement: resolve("../../packages/ui/src") + "/" },
    ],
  },
  server: { port: 5174, host: "127.0.0.1" },
});
