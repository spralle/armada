import type { PluginContract } from "@ghost-shell/contracts";

interface PluginContractCapabilityShape {
  contributes?: {
    capabilities?: {
      components?: Array<{ id: string; version: string }>;
      services?: Array<{ id: string; version: string }>;
    };
  };
}

export function readCapabilityComponents(
  contract: PluginContract | null,
): Array<{ id: string; version: string }> {
  if (!contract || !("contributes" in contract)) {
    return [];
  }

  const contributes = (contract as PluginContractCapabilityShape).contributes;
  return contributes?.capabilities?.components ?? [];
}

export function readCapabilityServices(
  contract: PluginContract | null,
): Array<{ id: string; version: string }> {
  if (!contract || !("contributes" in contract)) {
    return [];
  }

  const contributes = (contract as PluginContractCapabilityShape).contributes;
  return contributes?.capabilities?.services ?? [];
}
