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
