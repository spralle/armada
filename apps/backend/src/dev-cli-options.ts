import {
  getDefaultLocalPluginEntryUrlMap,
  normalizeSelectedPluginIds,
} from "./tenant-manifest.js";
import { normalizeAndAssertValidLocalPluginId } from "./local-ui-plugin-discovery.js";

export interface BackendDevCliOptions {
  selectedLocalPluginIds: string[];
  duplicateSelectedLocalPluginIds: string[];
}

export function parseBackendDevCliOptions(
  argv: readonly string[],
): BackendDevCliOptions {
  const collectedPluginIds = collectRepeatableOptionValues(argv, "--local-plugin").map(
    (pluginId) =>
      normalizeAndAssertValidLocalPluginId(
        pluginId,
        "from --local-plugin argument",
      ),
  );
  const duplicateSelectedLocalPluginIds = getDuplicatePluginIds(collectedPluginIds);
  const selectedLocalPluginIds = normalizeSelectedPluginIds(
    collectedPluginIds,
  );

  validateSelectedLocalPluginIds(selectedLocalPluginIds);

  return {
    selectedLocalPluginIds,
    duplicateSelectedLocalPluginIds,
  };
}

function getDuplicatePluginIds(selectedPluginIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const pluginId of selectedPluginIds) {
    if (seen.has(pluginId)) {
      duplicates.add(pluginId);
      continue;
    }

    seen.add(pluginId);
  }

  return Array.from(duplicates).sort((left, right) => left.localeCompare(right));
}

function collectRepeatableOptionValues(
  argv: readonly string[],
  optionName: string,
): string[] {
  const values: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== optionName) {
      continue;
    }

    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error(
        `Missing value for ${optionName}. Use ${optionName} <pluginId>.`,
      );
    }

    values.push(value);
    index += 1;
  }

  return values;
}

function validateSelectedLocalPluginIds(
  selectedLocalPluginIds: readonly string[],
): void {
  if (selectedLocalPluginIds.length === 0) {
    return;
  }

  const discoveredPluginIds = Array.from(
    getDefaultLocalPluginEntryUrlMap().keys(),
  ).sort((left, right) => left.localeCompare(right));
  const discoveredPluginIdSet = new Set(discoveredPluginIds);

  const unknownPluginIds = selectedLocalPluginIds.filter(
    (pluginId) => !discoveredPluginIdSet.has(pluginId),
  );

  if (unknownPluginIds.length > 0) {
    throw new Error(
      [
        `Unknown local plugin id(s): ${unknownPluginIds.join(", ")}.`,
        `Available local plugin id(s): ${discoveredPluginIds.join(", ")}.`,
        "Use --local-plugin <pluginId> with one of the available IDs.",
      ].join(" "),
    );
  }
}

export function formatLocalPluginOverrideStartupSummary(
  selectedLocalPluginIds: readonly string[],
  entryOverridesByPluginId: ReadonlyMap<string, string>,
): string {
  const normalizedSelectedPluginIds = normalizeSelectedPluginIds(
    selectedLocalPluginIds,
  );

  if (normalizedSelectedPluginIds.length === 0) {
    return "[backend] local plugin overrides: none selected";
  }

  const summaryItems = normalizedSelectedPluginIds.map((pluginId) => {
    const mappedEntry = entryOverridesByPluginId.get(pluginId);
    if (!mappedEntry) {
      throw new Error(
        `Missing local plugin override entry mapping for selected plugin '${pluginId}'. Ensure createDefaultLocalPluginEntryUrlMap includes this plugin.`,
      );
    }

    return `${pluginId} -> ${mappedEntry}`;
  });

  return `[backend] local plugin overrides (${summaryItems.length}): ${summaryItems.join("; ")}`;
}
