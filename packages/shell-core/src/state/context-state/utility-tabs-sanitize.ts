import { DEV_MODE } from "../app/constants.js";
import type { ContextTab } from "./types.js";
import { listAvailableUtilityTabs, isUtilityTabId } from "../utility-tabs.js";

const DEFAULT_UTILITY_GROUP_ID = "group-main";

export function ensureRequiredUtilityTabs(tabs: Record<string, ContextTab>): void {
  for (const tab of listAvailableUtilityTabs({ devMode: DEV_MODE })) {
    const existing = tabs[tab.id];
    tabs[tab.id] = {
      id: tab.id,
      definitionId: tab.id,
      partDefinitionId: tab.id,
      groupId: existing?.groupId ?? DEFAULT_UTILITY_GROUP_ID,
      label: tab.title,
      closePolicy: "fixed",
      args: existing?.args ?? {},
    };
  }
}

export function isNonUtilityClosedHistoryEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") {
    return true;
  }

  const record = entry as { tabId?: unknown };
  return !(typeof record.tabId === "string" && isUtilityTabId(record.tabId));
}
