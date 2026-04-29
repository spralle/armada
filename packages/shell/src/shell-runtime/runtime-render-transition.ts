import type { ComposedShellPart } from "../ui/parts-rendering.js";

export function deriveCloseableTabIds(parts: ReadonlyArray<ComposedShellPart>): Set<string> {
  return new Set(parts.map((part) => part.id));
}

export function rerenderAfterPluginToggle(renderParts: () => void, renderPanels: () => void): void {
  renderParts();
  renderPanels();
}
