/**
 * Canonical local UI plugin definitions mirrored from the backend.
 *
 * This is duplicated from apps/backend/src/local-ui-plugin-discovery.ts to
 * avoid cross-project import issues (backend has noEmit: true, no exports field).
 * If a plugin is added or removed in the backend, this list must be updated.
 */

export interface CanonicalPluginDefinition {
  id: string;
  folderName: string;
  devPort: number;
}

export const CANONICAL_PLUGIN_DEFINITIONS: readonly CanonicalPluginDefinition[] = [
  { id: "ghost.plugin-starter", folderName: "plugin-starter", devPort: 4171 },
  { id: "ghost.sample.contract-consumer", folderName: "sample-contract-consumer-plugin", devPort: 4172 },
  { id: "ghost.domain.unplanned-orders", folderName: "domain-unplanned-orders-plugin", devPort: 4173 },
  { id: "ghost.domain.vessel-view", folderName: "domain-vessel-view-plugin", devPort: 4174 },
  { id: "ghost.shared.ui-capabilities", folderName: "shared-ui-capability-plugin", devPort: 4175 },
  { id: "ghost.theme.default", folderName: "theme-default-plugin", devPort: 4176 },
  { id: "ghost.shadcn.theme-bridge", folderName: "shadcn-theme-bridge-plugin", devPort: 4177 },
  { id: "ghost.appearance-settings", folderName: "appearance-settings-plugin", devPort: 4178 },
] as const;
