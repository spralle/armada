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
  slot: "left" | "right" | "bottom";
  component: string;
}

export interface PluginCommandContribution {
  id: string;
  title: string;
  handler: string;
}

export interface PluginSelectionContribution {
  id: string;
  target: string;
}

export interface PluginDragDropSessionReference {
  type: string;
  sessionId: string;
}

export interface PluginPopoutCapabilityFlags {
  allowPopout?: boolean;
  allowMultiplePopouts?: boolean;
}

export interface PluginContributions {
  views?: PluginViewContribution[];
  parts?: PluginPartContribution[];
  commands?: PluginCommandContribution[];
  selection?: PluginSelectionContribution[];
  dragDropSessionReferences?: PluginDragDropSessionReference[];
  popoutCapabilities?: PluginPopoutCapabilityFlags;
}

export interface PluginContract {
  manifest: PluginManifestIdentity;
  contributes?: PluginContributions;
}
