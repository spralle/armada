import type { PluginContract } from "./types.js";

/**
 * Define a plugin manifest with full literal type preservation.
 * Uses `const` generic parameter so part IDs, action IDs, etc. are
 * inferred as literal types, enabling compile-time checks in defineReactParts().
 */
export function definePlugin<const T extends PluginContract>(manifest: T): T {
  return manifest;
}

/** Extract literal union of part IDs from a manifest. */
export type ExtractPartIds<M> = M extends {
  contributes?: { parts?: ReadonlyArray<{ id: infer Id }> };
}
  ? Id extends string
    ? Id
    : never
  : never;

/** Extract literal union of action IDs from a manifest. */
export type ExtractActionIds<M> = M extends {
  contributes?: { actions?: ReadonlyArray<{ id: infer Id }> };
}
  ? Id extends string
    ? Id
    : never
  : never;
