import {
  getDefaultLocalPluginEntryUrlMap,
  normalizeSelectedPluginIds,
} from "./tenant-manifest.js";

export interface BackendDevCliOptions {
  selectedLocalPluginIds: string[];
}

export function parseBackendDevCliOptions(
  argv: readonly string[],
): BackendDevCliOptions {
  const selectedLocalPluginIds = normalizeSelectedPluginIds(
    collectRepeatableOptionValues(argv, "--local-plugin"),
  );

  validateSelectedLocalPluginIds(selectedLocalPluginIds);

  return {
    selectedLocalPluginIds,
  };
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
