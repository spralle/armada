import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: [
    "src/index.ts",
    "src/plugin.ts",
    "src/services.ts",
    "src/layer.ts",
    "src/theme.ts",
    "src/parts.ts",
    "src/context.ts",
    "src/schemas.ts",
    "src/capabilities.ts",
  ],
});
