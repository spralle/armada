export interface PluginManifestIdentity {
  id: string;
  name: string;
  version: string;
}

export interface PluginViewContribution {
  id: string;
  title: string;
  component: string;
}

export interface PluginPartContribution {
  id: string;
  title: string;
  component?: string | undefined;
  dock?: PluginDockableTabMetadata | undefined;
}

export interface PluginDockableTabMetadata {
  container?: string | undefined;
  order?: number | undefined;
}

export interface PluginCapabilityComponentContribution {
  id: string;
  version: string;
}

export interface PluginCapabilityServiceContribution {
  id: string;
  version: string;
}

export interface PluginDependencyPluginRequirement {
  pluginId: string;
  versionRange: string;
}

export interface PluginDependencyComponentRequirement {
  id: string;
  versionRange: string;
  optional?: boolean | undefined;
}

export interface PluginDependencyServiceRequirement {
  id: string;
  versionRange: string;
  optional?: boolean | undefined;
}

export interface PluginProvidedCapabilities {
  components?: PluginCapabilityComponentContribution[] | undefined;
  services?: PluginCapabilityServiceContribution[] | undefined;
}

export interface PluginDependencies {
  plugins?: PluginDependencyPluginRequirement[] | undefined;
  components?: PluginDependencyComponentRequirement[] | undefined;
  services?: PluginDependencyServiceRequirement[] | undefined;
}

export type PluginContributionPredicate = Record<string, unknown>;

export interface PluginActionContribution {
  id: string;
  title: string;
  intent: string;
  predicate?: PluginContributionPredicate | undefined;
}

export interface PluginMenuContribution {
  menu: string;
  action: string;
  group?: string | undefined;
  order?: number | undefined;
  when?: PluginContributionPredicate | undefined;
}

export interface PluginKeybindingContribution {
  action: string;
  keybinding: string;
  when?: PluginContributionPredicate | undefined;
}

export interface PluginSelectionContribution {
  id: string;
  receiverEntityType: string;
  interests: PluginSelectionInterest[];
}

export interface PluginSelectionInterest {
  sourceEntityType: string;
  adapter?: string;
}

export interface PluginDerivedLaneContribution {
  id: string;
  key: string;
  sourceEntityType: string;
  scope: "global" | "group";
  valueType: "entity-id" | "entity-id-list";
  strategy: "priority-id" | "joined-selected-ids";
}

export interface PluginDragDropSessionReference {
  type: string;
  sessionId: string;
}

export interface PluginPopoutCapabilityFlags {
  allowPopout?: boolean | undefined;
  allowMultiplePopouts?: boolean | undefined;
}

export interface PluginContributions {
  views?: PluginViewContribution[] | undefined;
  parts?: PluginPartContribution[] | undefined;
  capabilities?: PluginProvidedCapabilities | undefined;
  actions?: PluginActionContribution[] | undefined;
  menus?: PluginMenuContribution[] | undefined;
  keybindings?: PluginKeybindingContribution[] | undefined;
  selection?: PluginSelectionContribution[] | undefined;
  derivedLanes?: PluginDerivedLaneContribution[] | undefined;
  dragDropSessionReferences?: PluginDragDropSessionReference[] | undefined;
  popoutCapabilities?: PluginPopoutCapabilityFlags | undefined;
}

export interface PluginContract {
  manifest: PluginManifestIdentity;
  contributes?: PluginContributions | undefined;
  dependsOn?: PluginDependencies | undefined;
}

export interface PluginCompatibilityMetadata {
  shell: string;
  pluginContract: string;
}

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: PluginCompatibilityMetadata;
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}
