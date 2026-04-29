// Register the .js → .ts ESM resolve hook
import { register } from "node:module";

register("./ts-resolve-hook.mjs", import.meta.url);
