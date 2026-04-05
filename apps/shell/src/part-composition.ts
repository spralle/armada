import type { LocalMockPart } from "./mock-parts.js";

export interface PluginEnablementSnapshot {
  plugins: Array<{
    id: string;
    enabled: boolean;
  }>;
}

export function composeVisibleParts(
  parts: readonly LocalMockPart[],
  snapshot: PluginEnablementSnapshot,
): LocalMockPart[] {
  const enabledPluginIds = new Set(
    snapshot.plugins
      .filter((plugin) => plugin.enabled)
      .map((plugin) => plugin.id),
  );

  return parts.filter((part) => {
    if (part.alwaysVisible) {
      return true;
    }

    if (!part.ownerPluginId) {
      return true;
    }

    return enabledPluginIds.has(part.ownerPluginId);
  });
}
