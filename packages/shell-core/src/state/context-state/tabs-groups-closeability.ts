import type {
  ContextTabCloseability,
  ContextTabSlot,
  ShellContextState,
} from "./types.js";
import { closeTab, closeTabWithHistory } from "./tabs-groups.js";

export function getTabCloseability(state: ShellContextState, tabId: string): ContextTabCloseability {
  const tab = state.tabs[tabId];
  if (!tab || tab.closePolicy === "fixed") {
    return {
      policy: tab?.closePolicy ?? "fixed",
      canClose: false,
      actionAvailability: "disabled",
      reason: "fixed-policy",
    };
  }

  return {
    policy: tab.closePolicy,
    canClose: true,
    actionAvailability: "enabled",
    reason: null,
  };
}

export function closeTabIfAllowed(state: ShellContextState, tabId: string): ShellContextState {
  const closeability = getTabCloseability(state, tabId);
  if (!closeability.canClose) {
    return state;
  }

  return closeTab(state, tabId);
}

export function closeTabIfAllowedWithHistory(
  state: ShellContextState,
  input: {
    tabId: string;
    slot: ContextTabSlot;
    orderIndex: number;
  },
): ShellContextState {
  const closeability = getTabCloseability(state, input.tabId);
  if (!closeability.canClose) {
    return state;
  }

  return closeTabWithHistory(state, input);
}

export function getTabGroupId(state: ShellContextState, tabId: string): string | null {
  return state.tabs[tabId]?.groupId ?? null;
}
