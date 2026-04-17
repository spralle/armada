import type { PartialThemePalette, TerminalPalette } from "./theme-derivation.js";
/** Configuration property schema (JSON Schema subset with extension fields). */
export interface ConfigurationPropertySchema {
  type?: string | readonly string[] | undefined;
  title?: string | undefined;
  description?: string | undefined;
  default?: unknown;
  enum?: readonly unknown[] | undefined;
  format?: string | undefined;
  pattern?: string | undefined;
  properties?: Readonly<Record<string, ConfigurationPropertySchema>> | undefined;
  items?: ConfigurationPropertySchema | readonly ConfigurationPropertySchema[] | undefined;
  oneOf?: readonly ConfigurationPropertySchema[] | undefined;
  anyOf?: readonly ConfigurationPropertySchema[] | undefined;
  [key: string]: unknown;
}

export interface PluginGalleryBanner {
  color?: string | undefined;
  theme?: "dark" | "light" | undefined;
}

export interface PluginGallery {
  screenshots?: string[] | undefined;
  banner?: PluginGalleryBanner | undefined;
}

export interface PluginManifestIdentity {
  id: string;
  name: string;
  version: string;
  icon?: string | undefined;
  gallery?: PluginGallery | undefined;
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

export interface ThemeBackgroundEntry {
  url: string;
  mode?: "cover" | "contain" | "tile" | undefined;
}

export interface ThemeFonts {
  body?: string | undefined;
  mono?: string | undefined;
  heading?: string | undefined;
}

export interface ThemeContribution {
  id: string;
  name: string;
  author?: string | undefined;
  mode: "dark" | "light";
  palette: PartialThemePalette;
  backgrounds?: ThemeBackgroundEntry[] | undefined;
  fonts?: ThemeFonts | undefined;
  terminal?: TerminalPalette | undefined;
  preview?: string | undefined;
}

export interface BrandingLogo {
  light?: string | undefined;
  dark?: string | undefined;
}

export interface BrandingLoadingScreen {
  logo?: string | undefined;
  backgroundColor?: string | undefined;
}

export interface BrandingContribution {
  appName?: string | undefined;
  logo?: BrandingLogo | undefined;
  favicon?: string | undefined;
  loadingScreen?: BrandingLoadingScreen | undefined;
}

export interface PluginConfigurationContribution {
  properties: Record<string, ConfigurationPropertySchema>;
}

/** Edge slot position for shell chrome areas */
export type ShellEdgeSlot = "top" | "bottom" | "left" | "right"

/** Position within an edge slot's flex layout (mirrors Waybar modules-left/center/right) */
export type ShellEdgeSlotPosition = "start" | "center" | "end"

/** Plugin contribution for edge slot components */
export interface PluginSlotContribution {
  /** Unique identifier for this slot contribution */
  id: string;
  /** Which edge of the shell to render in */
  slot: ShellEdgeSlot;
  /** Position within the slot's flex layout */
  position: ShellEdgeSlotPosition;
  /** Sort order within the position group (lower = earlier) */
  order: number;
  /** Component ID from capability registry to mount */
  component: string;
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
  themes?: ThemeContribution[] | undefined;
  branding?: BrandingContribution | undefined;
  configuration?: PluginConfigurationContribution | undefined;
  slots?: PluginSlotContribution[] | undefined;
}

export interface PluginContract {
  manifest: PluginManifestIdentity;
  contributes?: PluginContributions | undefined;
  dependsOn?: PluginDependencies | undefined;
  activationEvents?: ("onStartup")[] | undefined;
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
