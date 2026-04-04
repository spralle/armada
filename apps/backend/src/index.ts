export interface TenantPluginManifestEntry {
  id: string;
  version: string;
  entry: string;
}

export function getTenantManifest(tenantId: string): TenantPluginManifestEntry[] {
  return [
    {
      id: `tenant.${tenantId}.sample`,
      version: "0.0.0",
      entry: "local://apps/plugin-starter/src/index.ts",
    },
  ];
}

console.log("[backend] POC backend stub ready");
