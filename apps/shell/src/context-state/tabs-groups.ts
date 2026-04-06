import { cloneContextState, ensureGroup } from "./helpers.js";
import { ShellContextState } from "./types.js";

export function registerTab(
  state: ShellContextState,
  input: { tabId: string; groupId: string; groupColor?: string },
): ShellContextState {
  const next = cloneContextState(state);
  ensureGroup(next, input.groupId, input.groupColor);
  next.tabs[input.tabId] = {
    id: input.tabId,
    groupId: input.groupId,
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

export function getTabGroupId(state: ShellContextState, tabId: string): string | null {
  return state.tabs[tabId]?.groupId ?? null;
}
