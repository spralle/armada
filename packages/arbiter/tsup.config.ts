import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: {
    index: "src/index.ts",
    testing: "src/testing/index.ts",
    debug: "src/debug/index.ts",
  },
});
