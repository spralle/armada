export type UtilityTabId =
  | "utility.plugins"
  | "utility.sync"
  | "utility.group-context"
  | "utility.commands"
  | "utility.keybindings"
  | "utility.dev-inspector";

export interface UtilityTabDescriptor {
  id: UtilityTabId;
  title: string;
  panelHostId: string;
  slot: "main";
  available: "always" | "development-only";
}

const UTILITY_TAB_DESCRIPTORS: UtilityTabDescriptor[] = [
  {
    id: "utility.plugins",
    title: "Plugins",
    panelHostId: "plugin-controls",
    slot: "main",
    available: "always",
  },
  {
    id: "utility.sync",
    title: "Cross-window sync",
    panelHostId: "sync-status",
    slot: "main",
    available: "always",
  },
  {
    id: "utility.group-context",
    title: "Group context",
    panelHostId: "context-controls",
    slot: "main",
    available: "always",
  },
  {
    id: "utility.commands",
    title: "Commands",
    panelHostId: "command-surface",
    slot: "main",
    available: "always",
  },
  {
    id: "utility.keybindings",
    title: "Keybindings",
    panelHostId: "keybinding-settings",
    slot: "main",
    available: "always",
  },
  {
    id: "utility.dev-inspector",
    title: "Dev inspector",
    panelHostId: "dev-context-inspector",
    slot: "main",
    available: "development-only",
  },
];

const UTILITY_TAB_ID_SET = new Set<string>(UTILITY_TAB_DESCRIPTORS.map((tab) => tab.id));

export function listUtilityTabs(): UtilityTabDescriptor[] {
  return [...UTILITY_TAB_DESCRIPTORS];
}

export function listAvailableUtilityTabs(options: { devMode: boolean }): UtilityTabDescriptor[] {
  return UTILITY_TAB_DESCRIPTORS.filter(
    (tab) => tab.available === "always" || options.devMode,
  );
}

export function isUtilityTabId(tabId: string): tabId is UtilityTabId {
  return UTILITY_TAB_ID_SET.has(tabId);
}

export function resolveUtilityTabById(tabId: string): UtilityTabDescriptor | null {
  return UTILITY_TAB_DESCRIPTORS.find((tab) => tab.id === tabId) ?? null;
}
