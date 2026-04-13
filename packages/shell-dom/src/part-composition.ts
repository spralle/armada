export interface ComposablePart {
  id: string;
  title: string;
  slot: string;
  ownerPluginId?: string;
  alwaysVisible?: boolean;
}

export interface PluginEnablementSnapshot {
  plugins: Array<{
    id: string;
    enabled: boolean;
  }>;
}

export function composeVisibleParts(
  parts: readonly ComposablePart[],
  snapshot: PluginEnablementSnapshot,
): ComposablePart[] {
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
