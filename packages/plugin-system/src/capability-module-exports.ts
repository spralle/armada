interface PluginCapabilityComponentContribution {
  id: string;
  version: string;
}

interface PluginCapabilityServiceContribution {
  id: string;
  version: string;
}

export type PluginComponentsModule = Record<string, unknown>;
export type PluginServicesModule = Record<string, unknown>;

export function pickComponentModuleExport(
  module: unknown,
  contribution: PluginCapabilityComponentContribution,
): unknown {
  return pickCapabilityModuleExport(module, contribution.id);
}

export function pickServiceModuleExport(module: unknown, contribution: PluginCapabilityServiceContribution): unknown {
  return pickCapabilityModuleExport(module, contribution.id);
}

function pickCapabilityModuleExport(module: unknown, capabilityId: string): unknown {
  if (!module || typeof module !== "object") {
    return null;
  }

  const record = module as Record<string, unknown>;
  if (capabilityId in record) {
    return record[capabilityId];
  }

  const fallback =
    "default" in record
      ? record.default
      : (record.pluginComponents ?? record.components ?? record.pluginServices ?? record.services);
  if (fallback && typeof fallback === "object" && capabilityId in (fallback as Record<string, unknown>)) {
    return (fallback as Record<string, unknown>)[capabilityId];
  }

  return null;
}
