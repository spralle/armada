import { isUtilityTabId } from "../utility-tabs.js";
import type { ComposedShellPart } from "../ui/parts-rendering.js";

export function deriveCloseableTabIds(parts: ReadonlyArray<ComposedShellPart>): Set<string> {
  return new Set(parts
    .filter((part) => !isUtilityTabId(part.id))
    .map((part) => part.id));
}
