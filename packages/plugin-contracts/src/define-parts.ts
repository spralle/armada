/**
 * React parts detection symbols and helpers.
 * Used by the renderer registry to distinguish React-based plugin modules
 * from vanilla DOM modules, enabling correct renderer dispatch.
 */

export const REACT_PARTS_SYMBOL: unique symbol = Symbol.for("ghost-shell.react-parts");

export interface ReactPartsModule {
  readonly [REACT_PARTS_SYMBOL]: true;
  readonly components: Record<string, unknown>;
  readonly manifest?: unknown;
}

export function isReactPartsModule(mod: unknown): mod is ReactPartsModule {
  return typeof mod === "object" && mod !== null && REACT_PARTS_SYMBOL in mod;
}

/**
 * Check whether a loaded MF module contains a ReactPartsModule in any export.
 * MF exposes return the file's exports as an object, so the Symbol
 * may live on a named export rather than the module object itself.
 */
export function containsReactParts(module: unknown): boolean {
  if (isReactPartsModule(module)) {
    return true;
  }
  if (typeof module !== "object" || module === null) {
    return false;
  }
  for (const value of Object.values(module as Record<string, unknown>)) {
    if (isReactPartsModule(value)) {
      return true;
    }
  }
  return false;
}
