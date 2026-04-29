import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: {
    index: "src/index.ts",
    collection: "src/collection/index.ts",
    filter: "src/filter-compiler.ts",
    compile: "src/compile.ts",
    evaluate: "src/evaluator.ts",
    trace: "src/failure-trace.ts",
    operators: "src/operators.ts",
    ast: "src/ast.ts",
    errors: "src/errors.ts",
    "safe-path": "src/safe-path.ts",
  },
});
