import { cloneContextState, ensureGroup } from "./helpers.js";
import { ContextTabCloseability, ShellContextState } from "./types.js";

const PHASE_1_CLOSE_ACTIONS_ENABLED = false;

export function registerTab(
  state: ShellContextState,
  input: {
    tabId: string;
    groupId: string;
    groupColor?: string;
    tabLabel?: string;
    closePolicy?: "fixed" | "closeable";
  },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  const prior = next.tabs[input.tabId];
  next.tabs[input.tabId] = {
    id: input.tabId,
    groupId: input.groupId,
    label: input.tabLabel ?? prior?.label ?? input.tabId,
    closePolicy: input.closePolicy ?? prior?.closePolicy ?? "fixed",
  };
  if (!next.tabOrder.includes(input.tabId)) {
    next.tabOrder.push(input.tabId);
  }
  if (!next.activeTabId) {
    next.activeTabId = input.tabId;
  }
  return next;
}

export function setActiveTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId] || state.activeTabId === tabId) {
    return state;
  }

  return {
    ...state,
    activeTabId: tabId,
  };
}

export function moveTabToGroup(
  state: ShellContextState,
  input: { tabId: string; targetGroupId: string; targetGroupColor?: string },
): ShellContextState {
  const tab = state.tabs[input.tabId];
  if (!tab) {
    return state;
  }

  const next = cloneContextState(state);
  ensureGroup(next, input.targetGroupId, input.targetGroupColor);
  next.tabs[input.tabId] = {
    id: input.tabId,
    groupId: input.targetGroupId,
    label: tab.label,
    closePolicy: tab.closePolicy,
  };
  return next;
}

export function closeTab(state: ShellContextState, tabId: string): ShellContextState {
  if (!state.tabs[tabId]) {
    return state;
  }

  const next = cloneContextState(state);
  delete next.tabs[tabId];
  next.tabOrder = next.tabOrder.filter((id) => id !== tabId);
  delete next.subcontextsByTab[tabId];
  if (next.activeTabId === tabId) {
    next.activeTabId = next.tabOrder[0] ?? null;
  }
  return next;
}

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

  // Phase 2 hook: flip runtime close action availability from feature policy/config.
  if (!PHASE_1_CLOSE_ACTIONS_ENABLED) {
    return {
      policy: tab.closePolicy,
      canClose: false,
      actionAvailability: "disabled",
      reason: "phase1-disabled",
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

export function getTabGroupId(state: ShellContextState, tabId: string): string | null {
  return state.tabs[tabId]?.groupId ?? null;
}
