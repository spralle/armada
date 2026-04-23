import { REACT_PARTS_SYMBOL, type ReactPartsModule } from "@ghost-shell/contracts";
import type { ComponentType } from "react";

/**
 * Extract part IDs from a plugin manifest's contributes.parts array.
 * Falls back to `string` when the manifest shape is not statically known.
 */
type ExtractPartIds<M> = M extends {
  contributes?: { parts?: ReadonlyArray<{ id: infer Id }> };
}
  ? Id extends string
    ? Id
    : never
  : string;

/**
 * Define a React-based plugin module that maps manifest part IDs to React components.
 *
 * The `components` record is type-checked against the manifest's `contributes.parts`
 * so that missing or extra part IDs are caught at compile time.
 *
 * Note: `ComponentType<unknown>` is not usable here because React components
 * typically declare specific props. Using the widened form is acceptable since
 * plugin authors own both the manifest and the component types.
 */
export function defineReactParts<
  const M extends { contributes?: { parts?: ReadonlyArray<{ id: string }> } },
>(
  manifest: M,
  components: Record<ExtractPartIds<M>, ComponentType<never>>,
): ReactPartsModule {
  return {
    [REACT_PARTS_SYMBOL]: true as const,
    components: components as Record<string, unknown>,
    manifest,
  };
}
