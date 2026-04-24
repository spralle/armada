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
 * Find a ReactPartsModule in a loaded MF module.
 * Checks the module itself first, then iterates named exports.
 */
export function findReactPartsModule(module: unknown): ReactPartsModule | undefined {
  if (isReactPartsModule(module)) {
    return module;
  }
  if (typeof module !== "object" || module === null) {
    return undefined;
  }
  for (const value of Object.values(module as Record<string, unknown>)) {
    if (isReactPartsModule(value)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Check whether a loaded MF module contains a ReactPartsModule in its exports.
 */
export function containsReactParts(module: unknown): boolean {
  return findReactPartsModule(module) !== undefined;
}
