// Custom ESM loader hook that rewrites .js → .ts imports when the .js file doesn't exist.
// This is needed because @ghost/config-server uses TypeScript ESM convention
// (import from "./foo.js" when the file is actually ./foo.ts) and Node v24
// does not automatically rewrite these extensions.
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err?.code === "ERR_MODULE_NOT_FOUND" &&
      specifier.endsWith(".js")
    ) {
      const tsSpecifier = specifier.replace(/\.js$/, ".ts");
      return nextResolve(tsSpecifier, context);
    }
    throw err;
  }
}
